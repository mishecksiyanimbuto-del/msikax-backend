// ============================================================================
// CHECKOUT CONTROLLER (Phase 6/10) — the correct flow:
//   Buyer -> Checkout -> Create Order (pending) -> Request payment ->
//   Customer confirms -> Webhook -> Payment verified -> Paid -> Seller
//   wallet credited
//
// The amount charged is ALWAYS computed from the server-side cart/product
// prices, never taken from the client — a buyer editing dev tools cannot
// change what they pay.
// ============================================================================
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const Transaction = require('../models/Transaction');
const { CartItem, hydrateCart } = require('./cartController');
const paymentService = require('../services/paymentService');
const { buildShopBreakdown } = require('../services/commissionService');
const { creditOrderToWallet } = require('../services/walletService');
const { notify } = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const DUPLICATE_CHECKOUT_WINDOW_MS = 2 * 60 * 1000; // how long a "still pending" order blocks a brand new one

const startCheckout = asyncHandler(async (req, res) => {
  const { method, phone } = req.body;
  const cart = await hydrateCart(req.user._id);
  if (!cart.length) throw new ApiError(400, 'Your cart is empty.');
  if ((method === 'airtel' || method === 'mpamba') && !phone) throw new ApiError(400, 'A phone number is required for mobile money.');

  // Stock can change between "added to cart" and "hit pay" (someone else
  // buying it out) — re-check right before charging, not just at add-to-cart
  // time, or a buyer can pay for something that's no longer available.
  for (const c of cart) {
    if (c.qty > c.product.stock) {
      throw new ApiError(400, `"${c.product.title}" only has ${c.product.stock} left — please update your cart.`);
    }
  }

  // Guards against a double-click or a retried request creating two orders
  // (and charging the buyer twice) — if there's already a pending order
  // from the last couple of minutes, hand that one back instead of
  // starting a new charge.
  const recentPending = await Order.findOne({
    buyer: req.user._id, paymentStatus: 'pending', createdAt: { $gt: new Date(Date.now() - DUPLICATE_CHECKOUT_WINDOW_MS) }
  }).sort({ createdAt: -1 });
  if (recentPending) {
    return res.json({
      chargeId: recentPending.chargeId, status: 'pending',
      instructions: 'Your previous payment request is still processing — check your phone, or wait a moment before retrying.'
    });
  }

  const items = cart.map(c => ({ product: c.product._id, name: c.product.title, price: c.product.price, qty: c.qty, emoji: c.product.emoji, shopId: c.product.seller?._id || c.product.seller }));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shopBreakdown = buildShopBreakdown(items);
  const commission = shopBreakdown.reduce((sum, r) => sum + r.commission, 0);
  const chargeId = `MX-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

  const order = await Order.create({
    buyer: req.user._id, items, subtotal, commission, deliveryFee: 0, total: subtotal,
    shopBreakdown, chargeId, method, phone, paymentStatus: 'pending', orderStatus: 'awaiting_payment'
  });

  try {
    const { result } = await paymentService.chargeBuyer({
      method, mobile: phone, amount: subtotal, chargeId, buyer: req.user,
      callbackUrl: `${req.protocol}://${req.get('host')}/api/webhooks/paychangu`,
      returnUrl: process.env.FRONTEND_ORIGIN,
      description: `${items.length} item(s) from MsikaX`
    });
    await Transaction.create({ type: 'charge', reference: chargeId, amount: subtotal, status: 'pending', buyer: req.user._id, order: order._id, raw: result });

    if (method === 'paychangu') {
      return res.json({ chargeId, status: 'pending', checkoutUrl: result?.data?.checkout_url, instructions: 'Continue on the PayChangu page that just opened to complete payment.' });
    }
    if (method === 'mo626') {
      const account = result?.data?.payment_account_details;
      return res.json({
        chargeId, status: 'pending',
        instructions: account ? `Open your Mo626 app, choose Instant Bank Transfer, and pay MWK ${subtotal} to ${account.account_name} (${account.bank_name}, acct ${account.account_number}).` : 'Instant bank transfer initiated.',
        account
      });
    }
    return res.json({ chargeId, status: 'pending', instructions: `We've sent a payment prompt to ${phone}. Approve it on your phone to finish paying.` });
  } catch (err) {
    order.paymentStatus = 'failed';
    await order.save();
    await Transaction.findOneAndUpdate({ reference: chargeId }, { status: 'failed' });
    throw new ApiError(502, 'Payment could not be started. Please try again.');
  }
});

const checkoutStatus = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ chargeId: req.params.chargeId, buyer: req.user._id });
  if (!order) throw new ApiError(404, 'Unknown order.');

  if (order.paymentStatus === 'pending') {
    try {
      const result = await paymentService.verifyCharge(order.method, order.chargeId);
      const remoteStatus = result?.data?.status || result?.data?.transaction?.status;
      if (remoteStatus === 'success' || remoteStatus === 'successful') await fulfillOrder(order);
      else if (remoteStatus === 'failed') {
        order.paymentStatus = 'failed';
        await order.save();
        await Transaction.findOneAndUpdate({ reference: order.chargeId }, { status: 'failed' });
      }
    } catch (err) {
      console.error('[checkout] verify error:', err.body || err.message);
    }
  }
  res.json({ order: await Order.findById(order._id) });
});

/**
 * Marks an order paid, drops stock (atomically, never below zero — see
 * below), clears the buyer's cart, and credits each seller's wallet with
 * their 91% share. Called from both the webhook and the status-poll
 * fallback, so confirmation is only ever handled once no matter which path
 * notices it first (creditOrderToWallet() itself is idempotent per-shop).
 */
async function fulfillOrder(order) {
  if (order.paymentStatus === 'paid') return order; // already handled
  order.paymentStatus = 'paid';
  order.orderStatus = 'paid';

  // Atomic, guarded decrement: only succeeds if stock is still >= qty at
  // the exact moment of the write. Without the $gte guard, two orders for
  // the last unit confirmed at nearly the same time could both decrement
  // and push stock negative. If it can't be satisfied here (rare — would
  // mean stock ran out in the gap between charge and confirmation), the
  // order is still honored as paid (the buyer already paid, and there's no
  // automated refund flow yet), but flagged on the order for manual
  // follow-up rather than silently oversold.
  const stockConflicts = [];
  for (const item of order.items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.qty } },
      { $inc: { stock: -item.qty } },
      { new: true }
    );
    if (!updated) {
      stockConflicts.push({ product: item.product, name: item.name, qty: item.qty });
      console.error(`[checkout] order ${order.chargeId}: "${item.name}" ran out of stock before fulfillment — needs manual follow-up.`);
    } else if (updated.stock === 0) {
      const shop = await Shop.findById(updated.seller);
      await notify(shop?.owner, 'product_out_of_stock', `"${item.name}" is out of stock`, 'The last unit just sold — restock it or buyers will keep seeing it as unavailable.', { relatedShop: shop?._id });
    }
  }
  if (stockConflicts.length) order.stockConflicts = stockConflicts;

  await order.save();
  await Transaction.findOneAndUpdate({ reference: order.chargeId }, { status: 'success' });
  await CartItem.deleteMany({ user: order.buyer, product: { $in: order.items.map(i => i.product) } });
  await creditOrderToWallet(order);

  await notify(order.buyer, 'order_paid', 'Payment confirmed', `Your order ${order.chargeId} for ${order.items.length} item(s) is confirmed.`, { relatedOrder: order._id });
  for (const row of order.shopBreakdown) {
    const shop = await Shop.findById(row.shop);
    await notify(shop?.owner, 'new_order', 'New order received', `An order worth MK ${row.subtotal.toLocaleString('en-US')} just came in.`, { relatedOrder: order._id, relatedShop: shop?._id });
  }
  return order;
}

module.exports = { startCheckout, checkoutStatus, fulfillOrder };

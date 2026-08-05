// ============================================================================
// REFUND CONTROLLER — buyer-facing (request) and seller-facing (respond)
// actions live here. Admin-facing approve/reject live in adminController.js
// alongside every other admin action, consistent with how this app
// separates "who can do this" across controllers rather than mixing roles
// in one file.
// ============================================================================
const Order = require('../models/Order');
const Shop = require('../models/Shop');
const Refund = require('../models/Refund');
const { notify } = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const requestRefund = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, buyer: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentStatus !== 'paid') throw new ApiError(400, 'Only paid orders can be refunded.');

  const existing = await Refund.findOne({ order: order._id, status: { $in: ['requested', 'seller_responded'] } });
  if (existing) throw new ApiError(409, 'A refund request is already pending for this order.');

  const { reason } = req.body || {};
  if (!reason || !reason.trim()) throw new ApiError(400, 'Tell us why you\'re requesting a refund.');

  const refund = await Refund.create({ order: order._id, buyer: req.user._id, reason: reason.trim() });
  for (const row of order.shopBreakdown) {
    const shop = await Shop.findById(row.shop);
    await notify(shop?.owner, 'refund_requested', 'Refund requested', `A buyer requested a refund for order ${order.chargeId} — respond so an admin can review it.`, { relatedOrder: order._id, relatedShop: shop?._id });
  }
  res.status(201).json({ refund });
});

const myRefundRequests = asyncHandler(async (req, res) => {
  const refunds = await Refund.find({ buyer: req.user._id }).populate('order', 'chargeId total').sort({ createdAt: -1 }).lean();
  res.json({ refunds });
});

/** Refund requests concerning any order that includes this seller's shop. */
const shopRefundRequests = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  const orderIds = await Order.find({ 'shopBreakdown.shop': shop._id }).distinct('_id');
  const refunds = await Refund.find({ order: { $in: orderIds } }).populate('order', 'chargeId total items').populate('buyer', 'name').sort({ createdAt: -1 }).lean();
  res.json({ refunds });
});

const respondToRefund = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  const refund = await Refund.findById(req.params.id).populate('order');
  if (!refund) throw new ApiError(404, 'Refund request not found.');
  const concernsThisShop = refund.order.shopBreakdown.some(r => r.shop.toString() === shop._id.toString());
  if (!concernsThisShop) throw new ApiError(403, 'This refund request is not for your shop.');
  if (refund.status !== 'requested') throw new ApiError(409, 'This request has already been responded to.');

  const { response } = req.body || {};
  refund.sellerResponse = (response || '').trim() || 'No comment provided.';
  refund.sellerRespondedAt = new Date();
  refund.status = 'seller_responded';
  await refund.save();
  res.json({ refund });
});

module.exports = { requestRefund, myRefundRequests, shopRefundRequests, respondToRefund };

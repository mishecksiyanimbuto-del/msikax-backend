// ============================================================================
// ADMIN CONTROLLER — everything here requires requireAuth + requireAdmin
// (wired in routes/adminRoutes.js). Read access to the platform's real
// state, moderation actions (ban a user, suspend a shop, remove a listing,
// clear a reviewed suggestion), and refund approval — the one place here
// that does touch money, via services/refundService.js and
// services/walletService.js rather than moving money directly in this file.
// ============================================================================
const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const Suggestion = require('../models/Suggestion');
const LedgerEntry = require('../models/LedgerEntry');
const Refund = require('../models/Refund');
const refundService = require('../services/refundService');
const { notify } = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { escapeRegex } = require('../utils/text');

function paginate(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// ------------------------------------------------------------- overview --
const getStats = asyncHandler(async (req, res) => {
  const [userCount, shopCount, productCount, orderCount, pendingWithdrawals, openSuggestions, commissionRows] = await Promise.all([
    User.countDocuments(),
    Shop.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments({ paymentStatus: 'paid' }),
    Withdrawal.countDocuments({ status: 'processing' }),
    Suggestion.countDocuments(),
    LedgerEntry.aggregate([{ $match: { type: 'commission' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  // Commission entries are stored negative (a debit from the shop's wallet);
  // platform revenue is the positive mirror of that same number.
  const totalRevenue = commissionRows[0] ? Math.abs(commissionRows[0].total) : 0;
  res.json({ userCount, shopCount, productCount, orderCount, pendingWithdrawals, openSuggestions, totalRevenue });
});

// ---------------------------------------------------------------- users --
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const filter = {};
  if (req.query.search) filter.$or = [{ name: new RegExp(escapeRegex(req.query.search), 'i') }, { email: new RegExp(escapeRegex(req.query.search), 'i') }];
  const [users, total] = await Promise.all([
    User.find(filter).select('-passwordHash -emailVerificationTokenHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  res.json({ users, total, page });
});

const toggleUserBan = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role === 'admin') throw new ApiError(400, "Admins can't be banned from here.");
  user.banned = !user.banned;
  await user.save();
  res.json({ user: { ...user.toObject(), passwordHash: undefined } });
});

// ---------------------------------------------------------------- shops --
const listShops = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [shops, total] = await Promise.all([
    Shop.find().populate('owner', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Shop.countDocuments()
  ]);
  res.json({ shops, total, page });
});

const toggleShopSuspend = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) throw new ApiError(404, 'Shop not found.');
  shop.suspended = !shop.suspended;
  await shop.save();
  res.json({ shop });
});

// ------------------------------------------------------------ products --
const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [products, total] = await Promise.all([
    Product.find().populate('seller', 'shopName').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments()
  ]);
  res.json({ products, total, page });
});

/** Moderation removal — unlike the seller's own deleteProduct, this can remove ANY listing (different authorization, not a duplicate of that logic). */
const removeProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Listing not found.');
  await product.deleteOne();
  res.json({ ok: true });
});

// --------------------------------------------------------------- orders --
const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [orders, total] = await Promise.all([
    Order.find().populate('buyer', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments()
  ]);
  res.json({ orders, total, page });
});

// --------------------------------------------------------- transactions --
const listTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [transactions, total] = await Promise.all([
    Transaction.find().populate('buyer', 'name').populate('shop', 'shopName').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments()
  ]);
  res.json({ transactions, total, page });
});

// ---------------------------------------------------------- withdrawals --
const listWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [withdrawals, total] = await Promise.all([
    Withdrawal.find().populate('shop', 'shopName').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Withdrawal.countDocuments()
  ]);
  res.json({ withdrawals, total, page });
});

// --------------------------------------------------------- suggestions --
const listSuggestions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [suggestions, total] = await Promise.all([
    Suggestion.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Suggestion.countDocuments()
  ]);
  res.json({ suggestions, total, page });
});

const dismissSuggestion = asyncHandler(async (req, res) => {
  const result = await Suggestion.findByIdAndDelete(req.params.id);
  if (!result) throw new ApiError(404, 'Suggestion not found.');
  res.json({ ok: true });
});

// --------------------------------------------------------------- refunds --
const listRefunds = asyncHandler(async (req, res) => {
  const status = req.query.status; // undefined = all
  const filter = status ? { status } : {};
  const refunds = await Refund.find(filter).populate('order', 'chargeId total items').populate('buyer', 'name email').sort({ createdAt: -1 }).lean();
  res.json({ refunds });
});

/**
 * The one place in this app that both moves money AND changes an order's
 * status in the same action — approving a refund means: debit every
 * involved shop's wallet (with a ledger trail), attempt to repay the
 * buyer, then mark the order refunded. See services/refundService.js for
 * why buyer repayment isn't always automatic.
 */
const approveRefund = asyncHandler(async (req, res) => {
  const refund = await Refund.findById(req.params.id).populate('order');
  if (!refund) throw new ApiError(404, 'Refund request not found.');
  if (refund.status === 'approved' || refund.status === 'rejected') throw new ApiError(409, 'This request has already been resolved.');

  const order = refund.order;
  const { negativeShops } = await refundService.reverseShopEarnings(order);
  const repayment = await refundService.repayBuyer(order);

  order.orderStatus = 'refunded';
  await order.save();

  refund.status = 'approved';
  refund.adminNote = req.body?.adminNote || null;
  refund.reviewedBy = req.user._id;
  refund.reviewedAt = new Date();
  refund.buyerRepayment = { status: repayment.status, detail: repayment.detail };
  await refund.save();

  await notify(order.buyer, 'refund_resolved', 'Refund approved', repayment.status === 'paid' ? `MK ${order.total.toLocaleString('en-US')} has been sent back to you.` : "Your refund was approved — we're processing your repayment.", { relatedOrder: order._id });

  res.json({ refund, negativeShops }); // negativeShops: any shop whose wallet went negative because they'd already withdrawn — needs manual recovery
});

const rejectRefund = asyncHandler(async (req, res) => {
  const refund = await Refund.findById(req.params.id);
  if (!refund) throw new ApiError(404, 'Refund request not found.');
  if (refund.status === 'approved' || refund.status === 'rejected') throw new ApiError(409, 'This request has already been resolved.');

  refund.status = 'rejected';
  refund.adminNote = req.body?.adminNote || 'Request did not meet refund criteria.';
  refund.reviewedBy = req.user._id;
  refund.reviewedAt = new Date();
  await refund.save();
  await notify(refund.buyer, 'refund_resolved', 'Refund not approved', refund.adminNote, { relatedOrder: refund.order });
  res.json({ refund });
});

module.exports = {
  getStats,
  listUsers, toggleUserBan,
  listShops, toggleShopSuspend,
  listProducts, removeProduct,
  listOrders,
  listTransactions,
  listWithdrawals,
  listSuggestions, dismissSuggestion,
  listRefunds, approveRefund, rejectRefund
};

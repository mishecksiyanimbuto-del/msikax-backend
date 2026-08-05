// ============================================================================
// ORDER CONTROLLER — buyer's own purchase history. Commission figures are
// intentionally NOT sent here in a way the buyer-facing UI displays
// prominently — see client/js/checkout.js for how the frontend only shows
// Subtotal/Delivery/Total to buyers. Sellers see their own earnings via
// GET /api/shops/mine instead.
// ============================================================================
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');

const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ orders });
});

module.exports = { myOrders };

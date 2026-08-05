// ============================================================================
// WISHLIST CONTROLLER — stored as an array of Product IDs directly on the
// User document (see models/User.js) rather than a separate collection.
// There's no per-item metadata to track (no "date added" the UI needs, no
// notes) — just "is this product in my list or not" — so a dedicated
// collection would be unnecessary indirection for what's really a toggle.
// ============================================================================
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const listWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    populate: { path: 'seller', select: 'shopName' }
  }).lean();
  const products = (user.wishlist || []).map(p => ({ ...p, shopName: p.seller?.shopName || 'MsikaX Shop', shopId: p.seller?._id }));
  res.json({ products });
});

const addToWishlist = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { wishlist: req.params.productId } });
  res.status(201).json({ ok: true });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $pull: { wishlist: req.params.productId } });
  res.json({ ok: true });
});

module.exports = { listWishlist, addToWishlist, removeFromWishlist };

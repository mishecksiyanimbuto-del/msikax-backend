// ============================================================================
// FOLLOW CONTROLLER — same pattern as wishlistController.js: an array of
// Shop IDs on the User document, not a separate collection. When a
// followed shop publishes a new listing, every follower gets notified —
// see the notify() call added to productController.createProduct.
// ============================================================================
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const listFollowing = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('following').lean();
  res.json({ shops: user.following || [] });
});

const followShop = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: req.params.shopId } });
  res.status(201).json({ ok: true });
});

const unfollowShop = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.shopId } });
  res.json({ ok: true });
});

module.exports = { listFollowing, followShop, unfollowShop };

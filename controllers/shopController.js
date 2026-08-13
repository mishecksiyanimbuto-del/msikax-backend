// ============================================================================
// SHOP CONTROLLER — open a shop, browse shops, the seller's own dashboard
// data, and updating payout details.
// ============================================================================
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { getListingStatus } = require('../services/listingQuotaService');
const { escapeRegex } = require('../utils/text');
const { resolvePublicFileUrl } = require('../middleware/upload');

const listShops = asyncHandler(async (req, res) => {
  const { category, district, verifiedOnly } = req.query;
  const filter = { suspended: false, deleted: false };
  if (category && category !== 'All') filter.category = category;
  if (district) filter.district = new RegExp('^' + escapeRegex(district) + '$', 'i');
  if (verifiedOnly === 'true') filter.verified = true;

  const shops = await Shop.find(filter).populate('owner', 'name').select('-verification').lean();
  const counts = await Product.aggregate([{ $group: { _id: '$seller', count: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));
  res.json({ shops: shops.map(s => ({ ...s, productCount: countMap[s._id.toString()] || 0, ownerName: s.owner?.name || 'MsikaX Verified' })) });
});

const getShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ _id: req.params.id, suspended: false, deleted: false }).populate('owner', 'name').select('-verification').lean();
  if (!shop) throw new ApiError(404, 'Shop not found.');
  const products = await Product.find({ seller: shop._id }).lean();
  res.json({ shop: { ...shop, ownerName: shop.owner?.name || 'MsikaX Verified' }, products });
});

const createShop = asyncHandler(async (req, res) => {
  const existing = await Shop.findOne({ owner: req.user._id, deleted: false });
  if (existing) throw new ApiError(409, 'You already have a shop.');
  const { name, description, category, district, emoji, payoutOperator, payoutMobile } = req.body;
  if (!name) throw new ApiError(400, 'Give your shop a name.');
  const logo = resolvePublicFileUrl(req.file, 'shops'); // profile picture, optional — falls back to the emoji icon
  const shop = await Shop.create({
    owner: req.user._id, shopName: name, description, category, district, emoji, logo,
    payoutOperator: payoutOperator || null, payoutMobile: payoutMobile || null
  });
  res.status(201).json({ shop });
});

const updateLogo = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id, deleted: false });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  if (!req.file) throw new ApiError(400, 'Choose an image to upload.');
  shop.logo = resolvePublicFileUrl(req.file, 'shops');
  await shop.save();
  res.json({ shop });
});

const myShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id, deleted: false });
  if (!shop) return res.json({ shop: null, products: [], listingStatus: null });
  const products = await Product.find({ seller: shop._id }).lean();
  res.json({ shop, products, listingStatus: await getListingStatus(shop) });
});

const updatePayout = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id, deleted: false });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  const { payoutOperator, payoutMobile } = req.body;
  if (!['airtel', 'mpamba'].includes(payoutOperator)) throw new ApiError(400, 'payoutOperator must be "airtel" or "mpamba".');
  if (!payoutMobile) throw new ApiError(400, 'A payout mobile number is required.');
  shop.payoutOperator = payoutOperator; shop.payoutMobile = payoutMobile;
  await shop.save();
  res.json({ shop });
});

const listingStatus = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id, deleted: false });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  res.json({ listingStatus: await getListingStatus(shop) });
});

/**
 * A seller asking to close their shop — this only ever creates a pending
 * request. The shop is not touched here; an admin has to approve it (see
 * adminController.approveShopDeletion), same pattern as seller
 * verification and refunds. That's deliberate: unilateral self-deletion
 * would let a seller dodge an open dispute or a pending refund just by
 * deleting the shop it's attached to.
 */
const requestShopDeletion = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id, deleted: false });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  if (shop.deletionRequest.status === 'pending') throw new ApiError(409, 'A deletion request is already pending review.');

  const { reason } = req.body || {};
  shop.deletionRequest = { status: 'pending', reason: (reason || '').trim() || null, requestedAt: new Date(), reviewedAt: null, reviewedBy: null, adminNote: null };
  await shop.save();
  res.status(201).json({ shop });
});

module.exports = { listShops, getShop, createShop, myShop, updatePayout, updateLogo, listingStatus, requestShopDeletion };

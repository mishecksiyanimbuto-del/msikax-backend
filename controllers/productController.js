// ============================================================================
// PRODUCT CONTROLLER — list/search products, publish a new listing (with
// real photo upload + listing-quota enforcement), remove a listing.
// ============================================================================
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { getListingStatus } = require('../services/listingQuotaService');
const { escapeRegex } = require('../utils/text');
const { notify } = require('../services/notificationService');

const listProducts = asyncHandler(async (req, res) => {
  const { search, category, district, minPrice, maxPrice, minRating, verifiedOnly, sort } = req.query;

  // Shop-level filters (district, rating, verified, suspended) narrow down
  // which shops' products are even eligible before touching Product at all.
  const shopFilter = { suspended: false };
  if (district) shopFilter.district = new RegExp('^' + escapeRegex(district) + '$', 'i');
  if (minRating) shopFilter.rating = { $gte: Number(minRating) };
  if (verifiedOnly === 'true') shopFilter.verified = true;
  const eligibleShopIds = await Shop.find(shopFilter).distinct('_id');

  const filter = { stock: { $gt: 0 }, seller: { $in: eligibleShopIds } };
  if (category && category !== 'All') filter.category = category;
  if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const sortMap = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } };
  const products = await Product.find(filter).populate('seller', 'shopName rating verified').sort(sortMap[sort] || sortMap.newest).lean();
  res.json({ products: products.map(p => ({ ...p, shopName: p.seller?.shopName || 'MsikaX Shop', shopId: p.seller?._id, shopRating: p.seller?.rating, shopVerified: p.seller?.verified })) });
});

const createProduct = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop before listing items.');

  const status = await getListingStatus(shop);
  if (!status.allowed) throw Object.assign(new ApiError(402, status.reason), { listingStatus: status });

  const { name, price, description, category, emoji, stock } = req.body;
  const numPrice = Number(price);
  if (!name || !numPrice || numPrice <= 0) throw new ApiError(400, 'Add a name and a valid price.');

  const images = (req.files || []).map(f => `/uploads/products/${f.filename}`);
  const product = await Product.create({
    seller: shop._id, title: name, price: numPrice, description: description || undefined,
    category: category || 'Other', emoji: emoji || '🛍️', images, stock: Math.max(0, parseInt(stock, 10) || 0)
  });

  const followers = await User.find({ following: shop._id }).select('_id');
  for (const follower of followers) {
    await notify(follower._id, 'shop_new_listing', `${shop.shopName} just listed something new`, `"${product.title}" — ${numPrice.toLocaleString('en-US')} MWK`, { relatedShop: shop._id });
  }

  res.status(201).json({ product, listingStatus: await getListingStatus(shop) });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Listing not found.');
  if (!shop || product.seller.toString() !== shop._id.toString()) throw new ApiError(403, "You can only remove your own shop's listings.");
  await product.deleteOne();
  res.json({ ok: true });
});

module.exports = { listProducts, createProduct, deleteProduct };

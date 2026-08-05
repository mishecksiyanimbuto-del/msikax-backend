// ============================================================================
// REVIEW CONTROLLER — a buyer can only review a product they actually
// bought (verified against a paid order they own), a seller can only reply
// to reviews on their own shop's products. Reading reviews is public.
// ============================================================================
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const Review = require('../models/Review');
const { recomputeShopRating } = require('../services/reviewService');
const { notify } = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const createReview = asyncHandler(async (req, res) => {
  const { orderId, productId, rating, comment } = req.body || {};
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) throw new ApiError(400, 'Rating must be between 1 and 5.');

  const order = await Order.findOne({ _id: orderId, buyer: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentStatus !== 'paid') throw new ApiError(400, 'You can only review items from a paid order.');
  const boughtThis = order.items.some(i => i.product?.toString() === productId);
  if (!boughtThis) throw new ApiError(400, 'This product isn\'t part of that order.');

  const existing = await Review.findOne({ order: orderId, product: productId });
  if (existing) throw new ApiError(409, 'You\'ve already reviewed this item from this order.');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found.');

  const review = await Review.create({
    order: orderId, product: productId, shop: product.seller, buyer: req.user._id,
    rating: numRating, comment: (comment || '').trim()
  });
  await recomputeShopRating(product.seller);

  const shop = await Shop.findById(product.seller);
  await notify(shop?.owner, 'new_review', 'New review', `${numRating}★ review on "${product.title}"${comment ? ': "' + comment.slice(0, 80) + '"' : ''}`, { relatedShop: product.seller });

  res.status(201).json({ review });
});

const listProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId }).populate('buyer', 'name').sort({ createdAt: -1 }).lean();
  res.json({ reviews });
});

const listShopReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ shop: req.params.shopId }).populate('buyer', 'name').populate('product', 'title').sort({ createdAt: -1 }).lean();
  res.json({ reviews });
});

/** What a buyer's already reviewed, so the client can hide "leave a review" for items already done. */
const myReviewedItems = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ buyer: req.user._id }).select('order product').lean();
  res.json({ reviewed: reviews.map(r => ({ order: r.order, product: r.product })) });
});

const replyToReview = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found.');
  if (review.shop.toString() !== shop._id.toString()) throw new ApiError(403, 'This review is not for your shop.');

  const { reply } = req.body || {};
  if (!reply || !reply.trim()) throw new ApiError(400, 'Write a reply before sending.');
  review.sellerReply = reply.trim();
  review.sellerRepliedAt = new Date();
  await review.save();
  res.json({ review });
});

module.exports = { createReview, listProductReviews, listShopReviews, myReviewedItems, replyToReview };

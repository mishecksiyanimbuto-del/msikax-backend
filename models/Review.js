// ============================================================================
// REVIEW MODEL — a review is anchored to a specific ORDER + PRODUCT, not
// just "a buyer reviewing a product" in the abstract. That's what makes it
// a verified review: reviewController.js checks the order actually belongs
// to this buyer, is paid, and contains this product before allowing one —
// so there's no way to review something you never bought.
//
// `shop` is denormalized here (copied from the product at review time)
// purely so services/reviewService.js can recompute a shop's average
// rating with one query instead of a join through Product for every review.
// ============================================================================
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  sellerReply: { type: String, default: null },
  sellerRepliedAt: { type: Date, default: null }
}, { timestamps: true });

// One review per product per order — can't review the same purchase twice.
reviewSchema.index({ order: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

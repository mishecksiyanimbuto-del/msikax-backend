// ============================================================================
// REVIEW SERVICE — the one place Shop.rating gets recalculated. Called
// after a review is created; nowhere else writes to that field, so it can
// never drift out of sync with the reviews that actually exist.
// ============================================================================
const Review = require('../models/Review');
const Shop = require('../models/Shop');

async function recomputeShopRating(shopId) {
  const [agg] = await Review.aggregate([
    { $match: { shop: shopId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const rating = agg ? Math.round(agg.avg * 10) / 10 : 0; // one decimal place, e.g. 4.7
  await Shop.findByIdAndUpdate(shopId, { rating, reviewCount: agg ? agg.count : 0 });
  return rating;
}

module.exports = { recomputeShopRating };

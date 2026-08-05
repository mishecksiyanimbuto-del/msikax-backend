// ============================================================================
// LISTING QUOTA SERVICE — 10 free listings in a shop's first month, 5 in
// its second, then a paid monthly subscription is required. Enforced here
// (called from controllers/productController.js) so it can't be bypassed
// by hitting the API directly instead of clicking through the UI.
// ============================================================================
const Product = require('../models/Product');

const FREE_LISTINGS_MONTH_1 = 10;
const FREE_LISTINGS_MONTH_2 = 5;
const LISTING_SUBSCRIPTION_PRICE = 5000; // MWK/month
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function monthsSinceCreation(shop) {
  return Math.floor((Date.now() - new Date(shop.createdAt).getTime()) / MS_PER_DAY / 30);
}

function isSubscriptionActive(shop) {
  return !!(shop.subscription?.active && shop.subscription.expiresAt && new Date(shop.subscription.expiresAt) > new Date());
}

function freeListingAllowance(shop) {
  const monthIndex = monthsSinceCreation(shop);
  if (monthIndex === 0) return FREE_LISTINGS_MONTH_1;
  if (monthIndex === 1) return FREE_LISTINGS_MONTH_2;
  return 0;
}

async function getListingStatus(shop) {
  const freeUsed = await Product.countDocuments({ seller: shop._id });
  const freeAllowance = freeListingAllowance(shop);
  const subscriptionActive = isSubscriptionActive(shop);
  const allowed = subscriptionActive || freeUsed < freeAllowance;
  return {
    allowed, freeUsed, freeAllowance, subscriptionActive,
    subscriptionExpiresAt: shop.subscription?.expiresAt || null,
    monthlyPrice: LISTING_SUBSCRIPTION_PRICE,
    reason: allowed ? null : (freeAllowance === 0
      ? 'Your free listing period has ended. Subscribe to keep listing new items.'
      : `You've used all ${freeAllowance} free listings for this month. Subscribe to list more.`)
  };
}

module.exports = { LISTING_SUBSCRIPTION_PRICE, getListingStatus, isSubscriptionActive };

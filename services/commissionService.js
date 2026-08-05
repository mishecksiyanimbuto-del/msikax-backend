// ============================================================================
// COMMISSION SERVICE — the ONE place the platform fee rate lives. Change
// PLATFORM_FEE_RATE here and the entire app follows: checkout, the seller
// dashboard, and payouts all read from this module rather than each having
// their own copy of "9%" scattered around.
// ============================================================================
const PLATFORM_FEE_RATE = 0.09; // MsikaX keeps 9% of every paid sale

/** Splits a shop's subtotal into MsikaX's commission and the seller's take-home. */
function splitCommission(subtotal) {
  const commission = Math.round(subtotal * PLATFORM_FEE_RATE);
  return { commission, sellerEarnings: subtotal - commission };
}

/**
 * Groups order line items by shop and computes each shop's commission
 * split. A single cart/order can span multiple shops; each is only ever
 * paid its own 91% share.
 */
function buildShopBreakdown(items) {
  const byShop = new Map();
  for (const item of items) {
    const shopId = item.shopId.toString();
    if (!byShop.has(shopId)) byShop.set(shopId, { shop: item.shopId, subtotal: 0 });
    byShop.get(shopId).subtotal += item.price * item.qty;
  }
  return [...byShop.values()].map(row => ({ ...row, ...splitCommission(row.subtotal), walletCredited: false }));
}

module.exports = { PLATFORM_FEE_RATE, splitCommission, buildShopBreakdown };

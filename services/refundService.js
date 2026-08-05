// ============================================================================
// REFUND SERVICE — what actually happens when an admin approves a refund:
//   1. Every shop involved in the order gets debited its own share
//      (refund_adjustment ledger entry — see walletService.debitForRefund)
//   2. The buyer is repaid, if the order's payment rail supports an
//      automated reversal (Airtel Money / TNM Mpamba only — see note below)
// Kept separate from refundController.js the same way every other
// controller in this app defers money-moving logic to a service.
// ============================================================================
const wallet = require('../services/walletService');
const paymentService = require('./paymentService');

/**
 * Debits every shop's wallet for its share of a refunded order. Returns any
 * shops whose wallet went negative (seller already withdrew before the
 * refund was approved) so the caller can flag it for manual recovery.
 */
async function reverseShopEarnings(order) {
  const negativeShops = [];
  for (const row of order.shopBreakdown) {
    if (!row.walletCredited) continue; // nothing was ever credited for this row — nothing to reverse
    const { wentNegative } = await wallet.debitForRefund({
      shopId: row.shop, amount: row.sellerEarnings,
      description: `Refund — order ${order.chargeId}`, orderId: order._id
    });
    if (wentNegative) negativeShops.push(row.shop);
  }
  return { negativeShops };
}

/**
 * Attempts to send the buyer's money back to them. Only possible for
 * airtel/mpamba-paid orders, since PayChangu's payout endpoint (reused here
 * from paymentService.payoutSeller — it's generic, just operator+mobile+
 * amount) only reaches mobile money wallets. Mo626 (bank transfer) and
 * PayChangu standard checkout (could be card) orders have no automated
 * reversal path — those are flagged 'manual_required' rather than silently
 * failing, so an admin knows to handle it outside the app (bank transfer,
 * or a manual reversal through the PayChangu dashboard).
 */
async function repayBuyer(order) {
  if (order.method !== 'airtel' && order.method !== 'mpamba') {
    return { status: 'manual_required', detail: `${order.method} orders have no automated refund path — repay the buyer manually.` };
  }
  if (!order.phone) {
    return { status: 'manual_required', detail: 'No phone number on file for this order — repay the buyer manually.' };
  }
  try {
    const reference = `MXR-${order.chargeId}`;
    await paymentService.payoutSeller({ operator: order.method, mobile: order.phone, amount: order.total, chargeId: reference });
    return { status: 'paid', detail: `Repaid to ${order.phone} via ${order.method === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'}.` };
  } catch (err) {
    return { status: 'failed', detail: err.body || err.message || 'Repayment attempt failed.' };
  }
}

module.exports = { reverseShopEarnings, repayBuyer };

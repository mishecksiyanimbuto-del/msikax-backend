// ============================================================================
// WALLET SERVICE (Phase 8/9) — replaces the old payoutService.js. Sellers
// are never paid the instant a sale happens; instead:
//
//   Buyer -> MsikaX -> Seller Wallet -> Withdraw
//
// Every sale writes ledger entries (never edits a stored balance), and a
// seller only ever receives real mobile money when they request a
// withdrawal. This is what makes refunds/disputes possible without trying
// to claw back a mobile money transfer that's already gone out.
// ============================================================================
const crypto = require('crypto');
const LedgerEntry = require('../models/LedgerEntry');
const Withdrawal = require('../models/Withdrawal');
const Shop = require('../models/Shop');
const paymentService = require('./paymentService');
const { notify } = require('./notificationService');
const ApiError = require('../utils/apiError');

/** The authoritative balance: always summed from the ledger, never read from a stored field. */
async function getBalance(shopId) {
  const [row] = await LedgerEntry.aggregate([
    { $match: { shop: shopId } },
    { $group: { _id: null, balance: { $sum: '$amount' } } }
  ]);
  return row ? row.balance : 0;
}

async function getLedger(shopId, { limit = 50, skip = 0 } = {}) {
  return LedgerEntry.find({ shop: shopId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
}

/** Writes one signed entry and stamps it with the balance immediately after it. */
async function writeEntry({ shop, type, amount, description, order = null, withdrawal = null }) {
  const currentBalance = await getBalance(shop);
  return LedgerEntry.create({
    shop, type, amount, description, order, withdrawal,
    balanceAfter: currentBalance + amount
  });
}

/**
 * Called once an order is confirmed paid. For each shop in the order,
 * writes a "sale" credit (the gross subtotal) and a "commission" debit
 * (MsikaX's 9%) — net effect is the seller's 91% landing in their wallet,
 * but kept as two auditable lines rather than one pre-netted number.
 * Idempotent: an order whose shopBreakdown rows are already marked
 * walletCredited won't be credited twice, even if this is called again by
 * both the webhook and the status-poll fallback.
 */
async function creditOrderToWallet(order) {
  for (const row of order.shopBreakdown) {
    if (row.walletCredited) continue;
    await writeEntry({ shop: row.shop, type: 'sale', amount: row.subtotal, description: `Sale — order ${order.chargeId}`, order: order._id });
    await writeEntry({ shop: row.shop, type: 'commission', amount: -row.commission, description: `MsikaX service fee (9%) — order ${order.chargeId}`, order: order._id });
    row.walletCredited = true;
    row.walletCreditedAt = new Date();
  }
  await order.save();
  return order;
}

const LOCK_TIMEOUT_MS = 60 * 1000; // auto-expires if a process crashes mid-withdrawal, so a shop can never get permanently stuck

/**
 * Atomically acquires the per-shop withdrawal lock. This is a single-document
 * findOneAndUpdate — always atomic in MongoDB, with or without replica-set
 * transactions — so of two concurrent requests, exactly one of these calls
 * can ever succeed at a time. That's what actually prevents the race where
 * two withdrawal requests both read the same balance before either writes.
 */
async function acquireWithdrawalLock(shopId) {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const locked = await Shop.findOneAndUpdate(
    { _id: shopId, $or: [{ withdrawalLockedAt: null }, { withdrawalLockedAt: { $lt: staleBefore } }] },
    { $set: { withdrawalLockedAt: new Date() } },
    { new: true }
  );
  return !!locked;
}
async function releaseWithdrawalLock(shopId) {
  await Shop.findByIdAndUpdate(shopId, { $set: { withdrawalLockedAt: null } });
}

/**
 * A seller cashing out. Validates the amount against the *real* balance
 * (never trusts a client-supplied balance), calls PayChangu's payout
 * endpoint, and only writes the ledger debit if the payout actually
 * succeeded — so a failed transfer never shrinks a wallet that still has
 * the money sitting in it. Guarded by acquireWithdrawalLock() above so two
 * simultaneous requests for the same shop can't both pass the balance
 * check before either one writes anything.
 */
async function requestWithdrawal(shop, amount) {
  if (!shop.payoutOperator || !shop.payoutMobile) {
    throw new ApiError(400, 'Add your Airtel Money or TNM Mpamba number in shop settings before withdrawing.');
  }
  if (!amount || amount <= 0) throw new ApiError(400, 'Enter a valid amount to withdraw.');

  const gotLock = await acquireWithdrawalLock(shop._id);
  if (!gotLock) {
    throw new ApiError(409, 'A withdrawal is already being processed for this shop. Please wait a moment and try again.');
  }

  try {
    const balance = await getBalance(shop._id);
    if (amount > balance) throw new ApiError(400, `You can withdraw at most MK ${balance.toLocaleString('en-US')}.`);

    const reference = `MXW-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const withdrawal = await Withdrawal.create({
      shop: shop._id, amount, operator: shop.payoutOperator, mobile: shop.payoutMobile, reference, status: 'processing'
    });

    try {
      await paymentService.payoutSeller({ operator: shop.payoutOperator, mobile: shop.payoutMobile, amount, chargeId: reference });
      withdrawal.status = 'paid';
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      await writeEntry({ shop: shop._id, type: 'withdrawal', amount: -amount, description: `Withdrawal to ${shop.payoutOperator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'}`, withdrawal: withdrawal._id });
      await notify(shop.owner, 'withdrawal_paid', 'Withdrawal sent', `MK ${amount.toLocaleString('en-US')} is on its way to your mobile money account.`, { relatedShop: shop._id });
    } catch (err) {
      withdrawal.status = 'failed';
      withdrawal.failureReason = err.body || err.message;
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      await notify(shop.owner, 'withdrawal_failed', 'Withdrawal failed', `Your MK ${amount.toLocaleString('en-US')} withdrawal couldn't go through — your wallet balance is unaffected. Try again.`, { relatedShop: shop._id });
      // No ledger entry — the money never left the wallet, so the balance is untouched.
      throw new ApiError(502, 'The withdrawal could not be completed. Your wallet balance is unaffected — please try again.');
    }
    return withdrawal;
  } finally {
    await releaseWithdrawalLock(shop._id); // always release, even if the balance check or payout threw
  }
}

async function listWithdrawals(shopId, { limit = 20 } = {}) {
  return Withdrawal.find({ shop: shopId }).sort({ createdAt: -1 }).limit(limit).lean();
}

/**
 * Debits a shop's wallet for an approved refund. Reuses the SAME
 * withdrawal lock as requestWithdrawal() above — a refund and a withdrawal
 * are both "money leaving this shop's wallet" and must never be allowed to
 * race each other, or a stale balance read could let one of them go through
 * when it shouldn't.
 *
 * Deliberately does NOT block if the debit would take the wallet negative:
 * if a seller already withdrew their earnings before a refund was later
 * approved, the buyer still deserves their money back — the negative
 * balance instead becomes a flag for MsikaX to recover that amount from
 * the seller through other means. Callers should surface `wentNegative`.
 */
async function debitForRefund({ shopId, amount, description, orderId }) {
  const gotLock = await acquireWithdrawalLock(shopId);
  if (!gotLock) throw new ApiError(409, 'This shop has a withdrawal in progress — try processing the refund again in a moment.');
  try {
    const entry = await writeEntry({ shop: shopId, type: 'refund_adjustment', amount: -amount, description, order: orderId });
    return { balanceAfter: entry.balanceAfter, wentNegative: entry.balanceAfter < 0 };
  } finally {
    await releaseWithdrawalLock(shopId);
  }
}

module.exports = { getBalance, getLedger, creditOrderToWallet, requestWithdrawal, listWithdrawals, debitForRefund };

// ============================================================================
// LEDGER ENTRY MODEL (Phase 9) — the financial ledger. A shop's wallet
// balance is NEVER stored as a single editable number; it is always the
// sum of its ledger entries. This model is that append-only log:
//   +12,000  sale         (gross sale amount)
//   -1080    commission   (MsikaX's 9%)
//   -5,000   withdrawal   (seller cashed out)
//   +500     refund_adjustment
// `balanceAfter` is written once, at creation time, purely as a fast
// display cache (like a bank statement's running total) — it is never
// edited afterwards, and getBalance()/getLedger() in walletService.js can
// always re-derive the true balance by summing `amount` directly, so this
// cache drifting would never corrupt the actual number.
// ============================================================================
const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  type: { type: String, enum: ['sale', 'commission', 'withdrawal', 'refund_adjustment'], required: true },
  amount: { type: Number, required: true }, // signed: positive = credit, negative = debit
  description: { type: String, default: '' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: 'Withdrawal', default: null },
  balanceAfter: { type: Number, required: true } // cached running total — see note above
}, { timestamps: true });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);

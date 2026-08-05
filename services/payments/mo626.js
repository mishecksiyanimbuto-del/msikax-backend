// ============================================================================
// MO626 RAIL — Mo626 is National Bank of Malawi's banking app, not a
// telecom mobile money wallet, so there's no "operator" to select. Instead
// this goes through PayChangu's Instant Bank Transfer: the buyer gets a
// generated account number and pays into it from their Mo626 app.
// ============================================================================
const paychangu = require('./paychangu');

async function charge({ amount, chargeId }) {
  return paychangu.chargeBankTransfer({ amount, chargeId });
}

const verify = chargeId => paychangu.verifyBankTransferCharge(chargeId);

module.exports = { charge, verify };

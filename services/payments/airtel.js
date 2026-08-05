// ============================================================================
// AIRTEL MONEY RAIL — thin wrapper selecting the "airtel" operator on the
// shared PayChangu client (see paychangu.js for why PayChangu sits in front
// of the telecoms rather than Claude calling Airtel's own API directly).
// ============================================================================
const paychangu = require('./paychangu');

async function charge({ mobile, amount, chargeId, email, firstName, lastName }) {
  const operatorRefId = await paychangu.findOperatorRefId('airtel');
  if (!operatorRefId) throw Object.assign(new Error('Airtel Money is not available via PayChangu right now.'), { status: 502 });
  return paychangu.chargeMobileMoney({ mobile, operatorRefId, amount, chargeId, email, firstName, lastName });
}

const verify = chargeId => paychangu.verifyMobileMoneyCharge(chargeId);

async function payout({ mobile, amount, chargeId }) {
  const operatorRefId = await paychangu.findOperatorRefId('airtel');
  return paychangu.payoutMobileMoney({ mobile, operatorRefId, amount, chargeId });
}

module.exports = { charge, verify, payout };

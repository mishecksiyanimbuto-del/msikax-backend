// ============================================================================
// TNM MPAMBA RAIL — same shape as airtel.js, different operator.
// ============================================================================
const paychangu = require('./paychangu');

async function charge({ mobile, amount, chargeId, email, firstName, lastName }) {
  const operatorRefId = await paychangu.findOperatorRefId('mpamba');
  if (!operatorRefId) throw Object.assign(new Error('TNM Mpamba is not available via PayChangu right now.'), { status: 502 });
  return paychangu.chargeMobileMoney({ mobile, operatorRefId, amount, chargeId, email, firstName, lastName });
}

const verify = chargeId => paychangu.verifyMobileMoneyCharge(chargeId);

async function payout({ mobile, amount, chargeId }) {
  const operatorRefId = await paychangu.findOperatorRefId('mpamba');
  return paychangu.payoutMobileMoney({ mobile, operatorRefId, amount, chargeId });
}

module.exports = { charge, verify, payout };

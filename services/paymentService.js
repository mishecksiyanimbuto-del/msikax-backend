// ============================================================================
// PAYMENT SERVICE — the one place that decides "buyer picked X, so call Y".
// Controllers never talk to airtel.js/mpamba.js/mo626.js/paychangu.js
// directly; they go through here.
// ============================================================================
const airtel = require('./payments/airtel');
const mpamba = require('./payments/mpamba');
const mo626 = require('./payments/mo626');
const paychangu = require('./payments/paychangu');
const ApiError = require('../utils/apiError');

async function chargeBuyer({ method, mobile, amount, chargeId, buyer, returnUrl, callbackUrl, description }) {
  if (method === 'airtel') return { rail: 'airtel', result: await airtel.charge({ mobile, amount, chargeId, email: buyer.email, firstName: buyer.name.split(' ')[0], lastName: buyer.name.split(' ').slice(1).join(' ') }) };
  if (method === 'mpamba') return { rail: 'mpamba', result: await mpamba.charge({ mobile, amount, chargeId, email: buyer.email, firstName: buyer.name.split(' ')[0], lastName: buyer.name.split(' ').slice(1).join(' ') }) };
  if (method === 'mo626') return { rail: 'mo626', result: await mo626.charge({ amount, chargeId }) };
  if (method === 'paychangu') {
    const result = await paychangu.createStandardCheckout({
      amount, txRef: chargeId, email: buyer.email, firstName: buyer.name.split(' ')[0], lastName: buyer.name.split(' ').slice(1).join(' '),
      callbackUrl, returnUrl, title: 'MsikaX order', description: description || 'MsikaX order'
    });
    return { rail: 'paychangu', result };
  }
  throw new ApiError(400, `Unknown payment method "${method}".`);
}

async function verifyCharge(method, chargeId) {
  if (method === 'airtel') return airtel.verify(chargeId);
  if (method === 'mpamba') return mpamba.verify(chargeId);
  if (method === 'mo626') return mo626.verify(chargeId);
  if (method === 'paychangu') return paychangu.verifyStandardCheckout(chargeId);
  throw new ApiError(400, `Unknown payment method "${method}".`);
}

async function payoutSeller({ operator, mobile, amount, chargeId }) {
  if (operator === 'airtel') return airtel.payout({ mobile, amount, chargeId });
  if (operator === 'mpamba') return mpamba.payout({ mobile, amount, chargeId });
  throw new ApiError(400, `Unsupported payout operator "${operator}".`);
}

module.exports = { chargeBuyer, verifyCharge, payoutSeller };

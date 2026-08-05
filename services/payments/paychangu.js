// ============================================================================
// LOW-LEVEL PAYCHANGU HTTP CLIENT — the only file that talks to PayChangu's
// API directly. airtel.js, mpamba.js, and mo626.js each call into this with
// the right parameters for their rail; nothing else in the app should
// import this file directly.
//
// Why PayChangu at all, instead of Airtel/TNM directly? Airtel Money and
// TNM Mpamba don't offer direct merchant APIs to individual small
// businesses — you'd need a direct commercial agreement with each telecom.
// PayChangu is a Reserve Bank of Malawi-licensed gateway that already holds
// those agreements and exposes both (plus bank transfer and card) behind
// one API. That's the realistic integration path at this stage.
// ============================================================================
const crypto = require('crypto');

const BASE_URL = 'https://api.paychangu.com';

async function pcFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `PayChangu request failed (${res.status})`);
    err.status = res.status; err.body = body;
    throw err;
  }
  return body;
}

async function getMobileMoneyOperators() {
  const res = await pcFetch('/mobile-money', { method: 'GET' });
  return res.data || res.operators || res;
}

async function findOperatorRefId(providerLabel) {
  const operators = await getMobileMoneyOperators();
  const list = Array.isArray(operators) ? operators : Object.values(operators || {});
  const match = list.find(op => (op.name || op.short_code || '').toLowerCase().includes(providerLabel.toLowerCase()));
  return match ? (match.ref_id || match.id) : null;
}

async function chargeMobileMoney({ mobile, operatorRefId, amount, chargeId, email, firstName, lastName }) {
  return pcFetch('/mobile-money/payments/initialize', {
    method: 'POST',
    body: JSON.stringify({
      mobile, mobile_money_operator_ref_id: operatorRefId, amount: String(amount), charge_id: chargeId,
      ...(email ? { email } : {}), ...(firstName ? { first_name: firstName } : {}), ...(lastName ? { last_name: lastName } : {})
    })
  });
}

async function verifyMobileMoneyCharge(chargeId) {
  return pcFetch(`/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`, { method: 'GET' });
}

async function chargeBankTransfer({ amount, chargeId }) {
  return pcFetch('/direct-charge/payments/initialize', {
    method: 'POST',
    body: JSON.stringify({ payment_method: 'mobile_bank_transfer', amount: String(amount), currency: 'MWK', charge_id: chargeId })
  });
}

async function verifyBankTransferCharge(chargeId) {
  return pcFetch(`/direct-charge/transactions/${encodeURIComponent(chargeId)}/details`, { method: 'GET' });
}

async function createStandardCheckout({ amount, txRef, email, firstName, lastName, callbackUrl, returnUrl, title, description }) {
  return pcFetch('/payment', {
    method: 'POST',
    body: JSON.stringify({
      amount: String(amount), currency: 'MWK', email, first_name: firstName, last_name: lastName,
      tx_ref: txRef, callback_url: callbackUrl, return_url: returnUrl, customization: { title, description }
    })
  });
}

async function verifyStandardCheckout(txRef) {
  return pcFetch(`/verify-payment/${encodeURIComponent(txRef)}`, { method: 'GET' });
}

async function payoutMobileMoney({ mobile, operatorRefId, amount, chargeId }) {
  return pcFetch('/mobile-money/payouts/initialize', {
    method: 'POST',
    body: JSON.stringify({ mobile_money_operator_ref_id: operatorRefId, mobile, amount: String(amount), charge_id: chargeId })
  });
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader)); }
  catch { return false; }
}

module.exports = {
  getMobileMoneyOperators, findOperatorRefId,
  chargeMobileMoney, verifyMobileMoneyCharge,
  chargeBankTransfer, verifyBankTransferCharge,
  createStandardCheckout, verifyStandardCheckout,
  payoutMobileMoney, verifyWebhookSignature
};

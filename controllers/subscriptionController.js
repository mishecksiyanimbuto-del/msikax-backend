// ============================================================================
// SUBSCRIPTION CONTROLLER — once a shop's free listing quota runs out, this
// is the paid package that unlocks unlimited listings for 30 more days.
// Uses the same payment rails as checkout, charging the shop owner instead
// of a buyer — and the same two safeguards checkout has: no duplicate
// charge from a double-click, and the Transaction log actually reflects
// the final outcome instead of staying "pending" forever.
// ============================================================================
const crypto = require('crypto');
const Shop = require('../models/Shop');
const Transaction = require('../models/Transaction');
const paymentService = require('../services/paymentService');
const { LISTING_SUBSCRIPTION_PRICE, getListingStatus } = require('../services/listingQuotaService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const DUPLICATE_CHARGE_WINDOW_MS = 2 * 60 * 1000;

const startSubscription = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  const { method, phone } = req.body;
  const amount = LISTING_SUBSCRIPTION_PRICE;

  const recentPending = await Transaction.findOne({
    shop: shop._id, type: 'charge', status: 'pending', createdAt: { $gt: new Date(Date.now() - DUPLICATE_CHARGE_WINDOW_MS) }
  }).sort({ createdAt: -1 });
  if (recentPending) {
    return res.json({ chargeId: recentPending.reference, status: 'pending', instructions: 'Your previous subscription payment is still processing — check your phone, or wait a moment before retrying.' });
  }

  const chargeId = `MXSUB-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

  try {
    const { result } = await paymentService.chargeBuyer({
      method, mobile: phone, amount, chargeId, buyer: req.user,
      callbackUrl: `${req.protocol}://${req.get('host')}/api/webhooks/paychangu`,
      returnUrl: process.env.FRONTEND_ORIGIN, description: '30 days of unlimited MsikaX listings'
    });
    await Transaction.create({ type: 'charge', reference: chargeId, amount, status: 'pending', buyer: req.user._id, shop: shop._id, raw: result });

    res.json({ chargeId, status: 'pending', checkoutUrl: result?.data?.checkout_url, instructions: method === 'paychangu' ? 'Continue on the PayChangu page.' : `Approve the MWK ${amount} prompt sent to ${phone}.` });
  } catch (err) {
    await Transaction.findOneAndUpdate({ reference: chargeId }, { status: 'failed' }).catch(() => {}); // may not have been created yet if the charge call itself failed
    throw new ApiError(502, 'Subscription payment could not be started. Please try again.');
  }
});

const subscriptionStatus = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop first.');

  // Subscriptions can be paid via any of the 4 rails; try each verifier.
  let remoteStatus;
  for (const method of ['airtel', 'mpamba', 'mo626', 'paychangu']) {
    try { remoteStatus = (await paymentService.verifyCharge(method, req.params.chargeId))?.data?.status; if (remoteStatus) break; } catch { /* wrong rail for this charge */ }
  }
  if (remoteStatus === 'success' || remoteStatus === 'successful') {
    await Transaction.findOneAndUpdate({ reference: req.params.chargeId }, { status: 'success' });
    const now = new Date();
    const base = shop.subscription?.active && shop.subscription.expiresAt > now ? new Date(shop.subscription.expiresAt) : now;
    shop.subscription = { active: true, expiresAt: new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000) };
    await shop.save();
    return res.json({ status: 'paid', listingStatus: await getListingStatus(shop) });
  }
  if (remoteStatus === 'failed') await Transaction.findOneAndUpdate({ reference: req.params.chargeId }, { status: 'failed' });
  res.json({ status: remoteStatus || 'pending' });
});

module.exports = { startSubscription, subscriptionStatus };

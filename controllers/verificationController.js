// ============================================================================
// SELLER VERIFICATION (Phase 13) — National ID (+ optional business
// registration) submitted by the seller, reviewed by an admin. Both sides
// of this one workflow live here rather than being split across
// shopController.js and adminController.js, since "submit" and "review"
// only make sense together.
//
// Documents are stored under private-uploads/ (see middleware/upload.js)
// and only ever leave the server through getMyDocument/getDocumentForAdmin
// below, each of which checks authorization before streaming a single file
// back — never through the public /uploads static route.
// ============================================================================
const path = require('path');
const Shop = require('../models/Shop');
const { PRIVATE_UPLOADS_ROOT, usingCloudinary } = require('../middleware/upload');
const { signedPrivateUrl } = require('../utils/privateFileUrl');
const { notify } = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

/** Cloudinary: redirect to a signed, short-lived URL. Local disk fallback: stream the file directly. */
function serveDocument(res, filename) {
  if (usingCloudinary) return res.redirect(signedPrivateUrl(filename));
  return res.sendFile(path.join(PRIVATE_UPLOADS_ROOT, filename));
}

// ------------------------------------------------------------- seller side --
const submitVerification = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id, deleted: false });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  if (shop.verification.status === 'verified') throw new ApiError(409, 'This shop is already verified.');
  if (!req.files?.idDocument?.[0]) throw new ApiError(400, 'A photo of your National ID is required.');

  shop.verification = {
    status: 'pending',
    idDocument: req.files.idDocument[0].filename,
    businessDocument: req.files.businessDocument?.[0]?.filename || null,
    submittedAt: new Date(),
    reviewedAt: null, reviewedBy: null, rejectionReason: null
  };
  await shop.save();
  res.status(201).json({ shop });
});

/** The seller viewing their own submitted document back (e.g. to confirm what was sent). */
const getMyDocument = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id, deleted: false });
  const filename = req.params.type === 'business' ? shop?.verification?.businessDocument : shop?.verification?.idDocument;
  if (!shop || !filename) throw new ApiError(404, 'No document on file.');
  serveDocument(res, filename);
});

// -------------------------------------------------------------- admin side --
const listVerifications = asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  const shops = await Shop.find({ 'verification.status': status }).populate('owner', 'name email phone').sort({ 'verification.submittedAt': 1 }).lean();
  res.json({ shops });
});

/** An admin viewing a specific shop's submitted document to review it. */
const getDocumentForAdmin = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.params.shopId);
  const filename = req.params.type === 'business' ? shop?.verification?.businessDocument : shop?.verification?.idDocument;
  if (!shop || !filename) throw new ApiError(404, 'No document on file.');
  serveDocument(res, filename);
});

const approveVerification = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.params.shopId);
  if (!shop) throw new ApiError(404, 'Shop not found.');
  shop.verification.status = 'verified';
  shop.verification.reviewedAt = new Date();
  shop.verification.reviewedBy = req.user._id;
  shop.verification.rejectionReason = null;
  shop.verified = true;
  await shop.save();
  await notify(shop.owner, 'verification_approved', "You're verified ✓", 'Your shop now shows a verified badge to buyers.', { relatedShop: shop._id });
  res.json({ shop });
});

const rejectVerification = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.params.shopId);
  if (!shop) throw new ApiError(404, 'Shop not found.');
  const { reason } = req.body || {};
  shop.verification.status = 'rejected';
  shop.verification.reviewedAt = new Date();
  shop.verification.reviewedBy = req.user._id;
  shop.verification.rejectionReason = reason || 'Documents did not meet requirements.';
  shop.verified = false;
  await shop.save();
  await notify(shop.owner, 'verification_rejected', 'Verification not approved', shop.verification.rejectionReason, { relatedShop: shop._id });
  res.json({ shop });
});

module.exports = { submitVerification, getMyDocument, listVerifications, getDocumentForAdmin, approveVerification, rejectVerification };

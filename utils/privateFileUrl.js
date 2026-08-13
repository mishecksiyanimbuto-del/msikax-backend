// ============================================================================
// PRIVATE FILE URL — a National ID document uploaded with Cloudinary's
// `authenticated` delivery type can't be viewed from its plain URL; it
// needs a signed URL that expires quickly. This is the one place that
// signing happens, called only from verificationController.js's two
// document-viewing endpoints (the shop owner viewing their own submission,
// or an admin reviewing it) — never anywhere a buyer or another seller
// could reach.
// ============================================================================
const { cloudinary, isConfigured } = require('../config/cloudinary');

/**
 * @param {string} publicId - the Cloudinary public_id stored on the shop
 *   (or, in local-disk fallback mode, the filename)
 * @returns {string} a URL valid for a short window — regenerate on every view, never cache/store it
 */
function signedPrivateUrl(publicId) {
  if (!isConfigured) {
    throw new Error('signedPrivateUrl() called without Cloudinary configured — use the local-disk fallback path instead.');
  }
  return cloudinary.utils.private_download_url(publicId, 'jpg', {
    resource_type: 'image',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 5 * 60 // 5 minutes
  });
}

module.exports = { signedPrivateUrl };

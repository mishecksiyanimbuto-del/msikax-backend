// ============================================================================
// CLOUDINARY CONFIG — configures the Cloudinary SDK from environment
// variables. Used by middleware/upload.js for storing uploaded images
// somewhere durable, since Railway's (and most PaaS platforms') local disk
// is ephemeral — files written to it can vanish on redeploy or restart.
// ============================================================================
const cloudinary = require('cloudinary').v2;

const isConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.warn('[cloudinary] not configured — uploads will fall back to local disk (fine for local dev, NOT safe on Railway/Render/etc., since that disk is ephemeral there).');
}

module.exports = { cloudinary, isConfigured };

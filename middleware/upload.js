// ============================================================================
// FILE UPLOAD MIDDLEWARE — real image uploads (multipart/form-data).
//
// Storage backend: Cloudinary if configured (CLOUDINARY_* env vars set),
// otherwise falls back to local disk — same graceful-degradation pattern
// used for email (utils/email.js) and payments: works out of the box for
// local development, upgrades automatically once real credentials exist.
// Cloudinary matters in production specifically because most PaaS hosts
// (Railway, Render, etc.) have EPHEMERAL local disks — anything written to
// them can vanish on the next redeploy or restart.
//
// Two storage "roots" with very different privacy rules:
//   PUBLIC   — product photos, shop logos. Anyone can view these; that's
//              the point. Stored as plain Cloudinary URLs.
//   PRIVATE  — National ID / business registration documents. NEVER
//              publicly viewable. Uploaded with Cloudinary's `authenticated`
//              delivery type, which refuses to serve the file without a
//              signed, time-limited URL — see utils/privateFileUrl.js for
//              where those signed URLs get generated, only for the shop
//              owner or an admin.
// ============================================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary, isConfigured } = require('../config/cloudinary');

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
  cb(null, true);
}

function localDiskStorage(root, subfolder) {
  const dest = path.join(__dirname, '..', '..', root, subfolder);
  return multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(dest, { recursive: true }); // multer won't create this itself — do it once, cheaply, per request
      cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`)
  });
}

function cloudinaryStorage(folder, { authenticated = false } = {}) {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `msikax/${folder}`,
      resource_type: 'image',
      type: authenticated ? 'authenticated' : 'upload', // 'authenticated' = never servable without a signed URL
      // Verification documents get normalized to a fixed format at upload
      // time — otherwise generating a signed download URL later would need
      // to already know whether the original file was a png, jpg, etc.
      ...(authenticated ? { format: 'jpg' } : {})
    }
  });
}

function makeUploader(folder, { authenticated = false } = {}) {
  const storage = isConfigured
    ? cloudinaryStorage(folder, { authenticated })
    : localDiskStorage(authenticated ? 'private-uploads' : 'uploads', folder);
  return multer({ storage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB cap
}

module.exports = {
  productUpload: makeUploader('products'),
  shopLogoUpload: makeUploader('shops'),
  verificationUpload: makeUploader('verifications', { authenticated: true }),
  // Kept for the local-disk fallback path only — controllers/verificationController.js
  // uses this when Cloudinary isn't configured (see isConfigured below).
  PRIVATE_UPLOADS_ROOT: path.join(__dirname, '..', '..', 'private-uploads', 'verifications'),
  usingCloudinary: isConfigured,
  /**
   * A public (non-authenticated) uploaded file's usable URL, regardless of
   * which backend handled it: Cloudinary already gives back a full
   * absolute URL on `file.path`; local disk only gives a filename, so it
   * has to be turned into the relative path the static /uploads route
   * serves (see app.js).
   */
  resolvePublicFileUrl(file, folder) {
    if (!file) return null;
    return isConfigured ? file.path : `/uploads/${folder}/${file.filename}`;
  }
};

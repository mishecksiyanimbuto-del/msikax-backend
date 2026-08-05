// ============================================================================
// FILE UPLOAD MIDDLEWARE — real image uploads (multipart/form-data).
// Two storage roots, not one, and that split matters:
//   uploads/            PUBLIC — served statically by app.js at /uploads/*.
//                        Product photos and shop logos live here; anyone
//                        can view them, which is the whole point.
//   private-uploads/     NEVER statically served. National ID / business
//                        registration documents live here — only reachable
//                        through an authenticated, authorized endpoint
//                        (controllers/verificationController.js) that
//                        checks "is this the shop owner, or an admin?"
//                        before streaming the file back. Putting a sensitive
//                        ID document under the public folder by mistake
//                        would make it viewable by anyone with the URL.
// ============================================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
  cb(null, true);
}

function makeUploader(root, subfolder, fileFilter) {
  const dest = path.join(__dirname, '..', '..', root, subfolder);
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(dest, { recursive: true }); // multer won't create this itself — do it once, cheaply, per request
      cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`)
  });
  return multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB cap
}

module.exports = {
  productUpload: makeUploader('uploads', 'products', imageFileFilter),
  shopLogoUpload: makeUploader('uploads', 'shops', imageFileFilter),
  verificationUpload: makeUploader('private-uploads', 'verifications', imageFileFilter),
  PRIVATE_UPLOADS_ROOT: path.join(__dirname, '..', '..', 'private-uploads', 'verifications')
};

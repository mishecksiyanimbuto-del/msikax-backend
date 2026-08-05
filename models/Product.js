// ============================================================================
// PRODUCT MODEL — a single listing. `images` holds paths under /uploads
// (see middleware/upload.js), not base64 — real files now, not JSON blobs.
// ============================================================================
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: 'No description provided.' },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'Other' },
  emoji: { type: String, default: '🛍️' }, // shown when no photo has been uploaded
  images: [{ type: String }],             // e.g. ["/uploads/products/abc123.jpg"]
  stock: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

productSchema.index({ title: 'text' });

module.exports = mongoose.model('Product', productSchema);

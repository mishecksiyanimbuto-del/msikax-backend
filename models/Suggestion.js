// ============================================================================
// SUGGESTION MODEL — the "how can we improve MsikaX?" feedback box.
// ============================================================================
const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, default: 'Anonymous' },
  message: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);

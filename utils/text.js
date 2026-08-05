// A search box should do a literal substring match, not let a visitor run
// arbitrary regex against the database — escape it so typed punctuation
// (parentheses, plus signs, etc.) is treated as plain text, not regex syntax.
// Shared here because it was independently duplicated in productController.js
// and adminController.js — one implementation now, both import it.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };

// ============================================================================
// LIGHTWEIGHT VALIDATION MIDDLEWARE (Phase 10) — never trust the browser.
// Usage: router.post('/x', validate({ name: 'string', price: 'positiveNumber' }), controller)
// ============================================================================
function isPositiveNumber(v) { return typeof v === 'number' ? v > 0 : Number(v) > 0; }

const checks = {
  string: v => typeof v === 'string' && v.trim().length > 0,
  email: v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  positiveNumber: isPositiveNumber,
  phone: v => typeof v === 'string' && v.replace(/\D/g, '').length >= 9
};

function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rule] of Object.entries(schema)) {
      const check = checks[rule];
      if (!check(req.body?.[field])) errors.push(`"${field}" is missing or invalid.`);
    }
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    next();
  };
}

module.exports = validate;

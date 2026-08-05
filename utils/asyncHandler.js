// ============================================================================
// Wraps an async controller so a thrown error (or rejected promise) is
// forwarded to the central error handler instead of crashing the process or
// needing try/catch repeated in every single controller.
// ============================================================================
module.exports = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

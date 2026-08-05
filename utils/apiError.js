// ============================================================================
// A small helper for throwing errors with an HTTP status + a message that's
// SAFE to show the user (err.expose = true tells errorHandler.js to pass
// err.message straight through instead of the generic fallback).
// ============================================================================
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}
module.exports = ApiError;

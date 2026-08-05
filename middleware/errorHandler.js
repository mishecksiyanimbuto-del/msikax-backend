// ============================================================================
// CENTRAL ERROR HANDLER (Phase 19) — every controller forwards errors here
// via next(err) (or asyncHandler catching a thrown error) instead of
// handling try/catch inconsistently in every route. Logs full detail on the
// server, but only ever sends the user a safe, human message + a reference.
// ============================================================================
function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Multer's own errors (file too large, too many files) and our upload
// middleware's fileFilter rejection ("Only image files are allowed.") don't
// carry a status/expose flag the way ApiError does — translate the ones
// worth explaining to the user here, in the one place error formatting
// happens, rather than wrapping every upload route in its own try/catch.
function translateUploadError(err) {
  if (err.code === 'LIMIT_FILE_SIZE') return { status: 400, message: 'That image is too large — please choose one under 5MB.' };
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') return { status: 400, message: 'Too many files — please choose fewer images.' };
  if (err.message === 'Only image files are allowed.') return { status: 400, message: err.message };
  return null;
}

function errorHandler(err, req, res, _next) {
  const reference = `ERR-${Date.now().toString(36).toUpperCase()}`;
  console.error(`[${reference}]`, err.stack || err.message);

  const uploadError = (err.name === 'MulterError' || err.message === 'Only image files are allowed.') ? translateUploadError(err) : null;
  const status = uploadError?.status || err.status || 500;
  const message = uploadError?.message || (err.expose ? err.message : 'Something didn\'t go through on our end. Please try again.');
  res.status(status).json({ error: message, reference });
}

module.exports = { notFound, errorHandler };

// ============================================================================
// REQUEST LOGGER (Phase 19) — one line per request. Swap for a real logging
// service (e.g. pino + a log drain) once this is running in production.
// ============================================================================
function logger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
}

module.exports = logger;

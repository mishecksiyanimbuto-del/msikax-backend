const Suggestion = require('../models/Suggestion');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const createSuggestion = asyncHandler(async (req, res) => {
  const { name, message } = req.body || {};
  if (!message || !message.trim()) throw new ApiError(400, 'Write a suggestion before sending.');
  const suggestion = await Suggestion.create({ user: req.user?._id || null, name, message: message.trim() });
  res.status(201).json({ suggestion });
});

module.exports = { createSuggestion };

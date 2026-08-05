const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

module.exports = generateToken;

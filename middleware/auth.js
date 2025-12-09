const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    if (user.isBlocked) return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

module.exports = auth;
module.exports.authenticate = auth;
module.exports.isAdmin = isAdmin;
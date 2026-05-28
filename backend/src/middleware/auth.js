const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'haqms-jwt-secret-2026-x9k2p7m3q1w8n5v4';

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // FIX: Removed ignoreExpiration — tokens now properly expire
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // FIX: No longer leaking internal error details to client
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Role authorization middleware
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. User context missing.' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden. Requires role: ${roles.join(' or ')}` });
    }

    next();
  };
};

// FIX: Restored actual admin role check — was commented out, allowing any user to perform admin actions
const authorizeAdminOnlyLegacy = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  authorizeAdminOnlyLegacy,
};

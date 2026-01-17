const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to verify JWT token and attach user to request
 * Use this for routes that REQUIRE authentication
 * Adds req.user with { id, username, role }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional authentication - doesn't fail if no token, but attaches user if present
 * Use this for routes that work with or without authentication
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      };
    } catch (err) {
      // Token invalid, but that's okay - continue without user
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Middleware factory to restrict access to specific roles
 * Must be used AFTER authenticate middleware
 * 
 * @param  {...string} allowedRoles - Roles that can access this route
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

// Convenience middleware for common role checks
const requireAdmin = requireRole('admin');

module.exports = { 
  authenticate, 
  optionalAuth, 
  requireRole, 
  requireAdmin 
};

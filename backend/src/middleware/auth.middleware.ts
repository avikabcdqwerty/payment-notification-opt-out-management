import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getRepository } from 'typeorm';
import { User } from '../models/models';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
      };
    }
  }
}

/**
 * JWT authentication middleware.
 * Verifies JWT token and attaches user info to request.
 * Blocks unauthorized access and logs attempts.
 */
const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Accept JWT from Authorization header (Bearer) or cookie
    let token: string | undefined;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies['jwt_token']) {
      token = req.cookies['jwt_token'];
    }

    if (!token) {
      // eslint-disable-next-line no-console
      console.warn('Authentication failed: No token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify JWT
    const secret = process.env.JWT_SECRET || 'changeme';
    let decoded: JwtPayload | string;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Authentication failed: Invalid token');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    const payload = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
    const userId = payload.id || payload.userId;
    if (!userId) {
      // eslint-disable-next-line no-console
      console.warn('Authentication failed: No user ID in token');
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Optionally, fetch user from DB to ensure existence and status
    const userRepo = getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      // eslint-disable-next-line no-console
      console.warn(`Authentication failed: User not found (${userId})`);
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Authentication middleware error:', err);
    res.status(500).json({ error: 'Authentication error' });
  }
};

export default authMiddleware;
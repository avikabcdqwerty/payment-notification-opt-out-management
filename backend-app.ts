// backend-app.ts

import express, { Request, Response, NextFunction } from 'express';
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import bodyParser from 'body-parser';
import http from 'http';

// ==================
// Configuration
// ==================
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/payment_notifications';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==================
// Database Connection
// ==================
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ==================
// Models & Types
// ==================

export enum PaymentNotificationType {
  PaymentSuccess = 'payment_success',
  PaymentFailure = 'payment_failure',
  PaymentRefund = 'payment_refund',
}

export interface NotificationPreference {
  type: PaymentNotificationType;
  optedOut: boolean;
}

export interface User {
  id: string;
  email: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  notification_type: PaymentNotificationType;
  old_opted_out: boolean;
  new_opted_out: boolean;
  changed_at: Date;
  ip_address: string | null;
  user_agent: string | null;
}

// ==================
// Middleware
// ==================

/**
 * Authentication middleware.
 * In production, replace this with real JWT or session validation.
 * For demo, expects Authorization: Bearer <user-id>
 */
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logUnauthorizedAttempt(req, null, 'Missing or malformed Authorization header');
    return res.status(401).json({ message: 'Unauthorized: Missing or malformed Authorization header' });
  }
  const token = authHeader.substring('Bearer '.length).trim();
  if (!token || !isValidUserId(token)) {
    logUnauthorizedAttempt(req, token, 'Invalid user token');
    return res.status(401).json({ message: 'Unauthorized: Invalid user token' });
  }
  // Attach user info to request
  (req as any).user = { id: token };
  next();
}

/**
 * Simple user ID validation.
 * Replace with real user lookup in production.
 */
function isValidUserId(userId: string): boolean {
  // For demo, accept any non-empty string
  return typeof userId === 'string' && userId.length > 0;
}

/**
 * Logs unauthorized access attempts for audit.
 */
async function logUnauthorizedAttempt(req: Request, userId: string | null, reason: string) {
  // In production, log to a secure audit log
  // eslint-disable-next-line no-console
  console.warn(`[AUDIT] Unauthorized access attempt: userId=${userId}, ip=${req.ip}, reason=${reason}`);
}

// ==================
// Express App Setup
// ==================

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// ==================
// Database Schema Setup (Migration)
// ==================

/**
 * Ensures required tables exist.
 * In production, use a migration tool (e.g., Knex, TypeORM, Flyway).
 */
async function ensureDbSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_type TEXT NOT NULL,
        opted_out BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (user_id, notification_type)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        notification_type TEXT NOT NULL,
        old_opted_out BOOLEAN NOT NULL,
        new_opted_out BOOLEAN NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      );
    `);
  } finally {
    client.release();
  }
}

// ==================
// Services
// ==================

/**
 * Fetches all notification preferences for a user.
 * If not present, returns default (all opted_in).
 */
async function getUserNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
  const client = await pool.connect();
  try {
    // Get all possible types
    const allTypes = Object.values(PaymentNotificationType);

    // Fetch existing preferences
    const { rows } = await client.query(
      `SELECT notification_type, opted_out FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );
    const prefMap: Record<string, boolean> = {};
    for (const row of rows) {
      prefMap[row.notification_type] = row.opted_out;
    }
    // Fill in defaults for missing types (opted_in)
    return allTypes.map((type) => ({
      type: type as PaymentNotificationType,
      optedOut: prefMap[type] ?? false,
    }));
  } finally {
    client.release();
  }
}

/**
 * Atomically updates a user's notification preference and logs the change.
 * Returns the updated preferences.
 */
async function updateUserNotificationPreference(
  userId: string,
  type: PaymentNotificationType,
  optedOut: boolean,
  ipAddress: string | null,
  userAgent: string | null
): Promise<NotificationPreference[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get old value
    const { rows: oldRows } = await client.query(
      `SELECT opted_out FROM notification_preferences WHERE user_id = $1 AND notification_type = $2`,
      [userId, type]
    );
    const oldOptedOut = oldRows.length > 0 ? oldRows[0].opted_out : false;

    // Only update if value changes
    if (oldOptedOut !== optedOut) {
      // Upsert preference
      await client.query(
        `
        INSERT INTO notification_preferences (user_id, notification_type, opted_out)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, notification_type)
        DO UPDATE SET opted_out = EXCLUDED.opted_out
        `,
        [userId, type, optedOut]
      );
      // Insert audit log
      await client.query(
        `
        INSERT INTO audit_logs (id, user_id, notification_type, old_opted_out, new_opted_out, changed_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        `,
        [uuidv4(), userId, type, oldOptedOut, optedOut, ipAddress, userAgent]
      );
    }

    await client.query('COMMIT');
    // Return updated preferences
    return await getUserNotificationPreferences(userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ==================
// Controllers
// ==================

/**
 * GET /notification-preferences
 * Returns all payment notification preferences for the authenticated user.
 */
async function getNotificationPreferencesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user as User;
    const preferences = await getUserNotificationPreferences(user.id);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /notification-preferences
 * Updates a single notification preference for the authenticated user.
 * Body: { type: PaymentNotificationType, optedOut: boolean }
 */
async function updateNotificationPreferenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user as User;
    const { type, optedOut } = req.body;

    // Validate input
    if (
      !type ||
      !Object.values(PaymentNotificationType).includes(type) ||
      typeof optedOut !== 'boolean'
    ) {
      return res.status(400).json({ message: 'Malformed input: Invalid notification type or optedOut value.' });
    }

    // Update preference atomically with audit log
    const updatedPreferences = await updateUserNotificationPreference(
      user.id,
      type,
      optedOut,
      req.ip,
      req.headers['user-agent'] || null
    );
    res.json({ success: true, preferences: updatedPreferences });
  } catch (err) {
    next(err);
  }
}

// ==================
// Payment Event Processing Integration (Stub)
// ==================

/**
 * Checks if a user has opted out of a notification type.
 * Used by payment event processing to suppress notifications.
 */
export async function shouldSendNotification(
  userId: string,
  type: PaymentNotificationType
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT opted_out FROM notification_preferences WHERE user_id = $1 AND notification_type = $2`,
      [userId, type]
    );
    if (rows.length === 0) return true; // Default: send notification
    return !rows[0].opted_out;
  } finally {
    client.release();
  }
}

// ==================
// Error Handling Middleware
// ==================

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  if (err.code === '23505') {
    // Unique violation
    return res.status(409).json({ message: 'Conflict: Duplicate entry.' });
  }
  res.status(500).json({ message: 'Internal server error.' });
});

// ==================
// Routes
// ==================

const router = express.Router();

router.get('/notification-preferences', authMiddleware, getNotificationPreferencesHandler);
router.put('/notification-preferences', authMiddleware, updateNotificationPreferenceHandler);

app.use('/api', router);

// ==================
// Swagger/OpenAPI Docs
// ==================

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Payment Notification Opt-Out API',
    version: '1.0.0',
    description: 'API for managing payment notification opt-out preferences.',
  },
  servers: [
    {
      url: '/api',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: [], // No external YAML files; inline docs below
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================
// Health Check
// ==================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ==================
// Server Startup
// ==================

async function startServer() {
  try {
    await ensureDbSchema();
    // eslint-disable-next-line no-console
    console.log('Database schema ensured.');
    const server = http.createServer(app);
    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

// ==================
// Exports (for testing)
// ==================

export {
  app,
  pool,
  getUserNotificationPreferences,
  updateUserNotificationPreference,
  PaymentNotificationType,
  shouldSendNotification,
};

// ==================
// Tests (Jest)
// ==================

/* Example Jest tests (place in __tests__/backend-app.test.ts for real projects)
import request from 'supertest';

describe('Notification Preferences API', () => {
  let userId: string;

  beforeAll(async () => {
    // Create a test user
    userId = uuidv4();
    await pool.query('INSERT INTO users (id, email) VALUES ($1, $2)', [userId, 'test@example.com']);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  it('should get default preferences', async () => {
    const res = await request(app)
      .get('/api/notification-preferences')
      .set('Authorization', `Bearer ${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.preferences).toBeDefined();
    expect(res.body.preferences.length).toBeGreaterThan(0);
  });

  it('should update a preference', async () => {
    const res = await request(app)
      .put('/api/notification-preferences')
      .set('Authorization', `Bearer ${userId}`)
      .send({ type: 'payment_success', optedOut: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences.find((p: any) => p.type === 'payment_success').optedOut).toBe(true);
  });

  it('should reject unauthorized access', async () => {
    const res = await request(app)
      .get('/api/notification-preferences');
    expect(res.status).toBe(401);
  });
});
*/

// ==================
// End of backend-app.ts
// ==================
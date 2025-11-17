import { createConnection, Connection } from 'typeorm';
import dotenv from 'dotenv';
import { User, NotificationType, UserNotificationPreference, AuditLog } from '../models/models';

// Load environment variables from .env file
dotenv.config();

/**
 * Initializes and returns the TypeORM database connection.
 * Ensures all entities are registered and migrations are run.
 * @returns {Promise<Connection>}
 */
export const initializeDb = async (): Promise<Connection> => {
  try {
    const connection = await createConnection({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'payment_notifications',
      entities: [User, NotificationType, UserNotificationPreference, AuditLog],
      synchronize: process.env.TYPEORM_SYNC === 'true', // Use migrations in production!
      logging: process.env.TYPEORM_LOGGING === 'true',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    // eslint-disable-next-line no-console
    console.log('Database connection established');
    return connection;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Database initialization failed:', err);
    throw err;
  }
};
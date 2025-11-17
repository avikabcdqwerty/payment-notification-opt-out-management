import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createConnection } from 'typeorm';
import routes from './routes/routes';
import { initializeDb } from './db/db';

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const app: Application = express();

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Register API routes
app.use('/api', routes);

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Log error details (can be replaced with a logging service)
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const message =
    err.message ||
    'An unexpected error occurred. Please try again later or contact support.';

  res.status(status).json({ error: message });
});

// Start server after DB initialization
const startServer = async () => {
  try {
    await initializeDb();
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
};

startServer();

export default app;
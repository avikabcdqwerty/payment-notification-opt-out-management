import request from 'supertest';
import { createConnection, getConnection, getRepository } from 'typeorm';
import app from '../src/server';
import { User, NotificationType, UserNotificationPreference, AuditLog } from '../src/models/models';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

describe('Notification Preferences API', () => {
  let user: User;
  let token: string;
  let notificationTypes: NotificationType[];

  beforeAll(async () => {
    // Initialize test database connection
    await createConnection({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'payment_notifications_test',
      entities: [User, NotificationType, UserNotificationPreference, AuditLog],
      synchronize: true,
      dropSchema: true,
      logging: false,
    });

    // Create test user
    user = getRepository(User).create({
      email: 'testuser@example.com',
      name: 'Test User',
      passwordHash: 'hashedpassword',
    });
    await getRepository(User).save(user);

    // Create notification types
    notificationTypes = [
      getRepository(NotificationType).create({
        id: 'payment_success',
        name: 'Payment Success',
        description: 'You receive this when a payment succeeds.',
      }),
      getRepository(NotificationType).create({
        id: 'payment_failure',
        name: 'Payment Failure',
        description: 'You receive this when a payment fails.',
      }),
      getRepository(NotificationType).create({
        id: 'refund_processed',
        name: 'Refund Processed',
        description: 'You receive this when a refund is processed.',
      }),
    ];
    await getRepository(NotificationType).save(notificationTypes);

    // Generate JWT token for test user
    token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  afterAll(async () => {
    await getConnection().close();
  });

  afterEach(async () => {
    // Clean up user preferences and audit logs after each test
    await getRepository(UserNotificationPreference).delete({});
    await getRepository(AuditLog).delete({});
  });

  describe('GET /api/notification-preferences', () => {
    it('should return all notification types and user preferences (all defaulted to opted-in)', async () => {
      const res = await request(app)
        .get('/api/notification-preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notificationTypes).toHaveLength(3);
      expect(res.body.userPreferences).toHaveLength(0);
    });

    it('should return user preferences if set', async () => {
      // Set one preference to opted out
      await getRepository(UserNotificationPreference).save({
        userId: user.id,
        notificationTypeId: 'payment_failure',
        optedOut: true,
      });

      const res = await request(app)
        .get('/api/notification-preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.userPreferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            notificationTypeId: 'payment_failure',
            optedOut: true,
          }),
        ])
      );
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/notification-preferences');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notification-preferences', () => {
    it('should update user preferences and create audit logs', async () => {
      const preferences = [
        { notificationTypeId: 'payment_success', optedOut: false },
        { notificationTypeId: 'payment_failure', optedOut: true },
        { notificationTypeId: 'refund_processed', optedOut: false },
      ];

      const res = await request(app)
        .post('/api/notification-preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.userPreferences).toHaveLength(3);

      // Check DB for preferences
      const dbPrefs = await getRepository(UserNotificationPreference).find({
        where: { userId: user.id },
      });
      expect(dbPrefs).toHaveLength(3);
      expect(dbPrefs.find((p) => p.notificationTypeId === 'payment_failure')?.optedOut).toBe(true);

      // Check audit logs
      const logs = await getRepository(AuditLog).find({ where: { userId: user.id } });
      expect(logs).toHaveLength(3);
      expect(logs[0].action).toBe('UPDATE');
    });

    it('should reject invalid notificationTypeId', async () => {
      const preferences = [
        { notificationTypeId: 'invalid_type', optedOut: true },
      ];

      const res = await request(app)
        .post('/api/notification-preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid notificationTypeId/);
    });

    it('should reject invalid optedOut value', async () => {
      const preferences = [
        { notificationTypeId: 'payment_success', optedOut: 'yes' },
      ];

      const res = await request(app)
        .post('/api/notification-preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid optedOut value/);
    });

    it('should reject unauthenticated requests', async () => {
      const preferences = [
        { notificationTypeId: 'payment_success', optedOut: true },
      ];

      const res = await request(app)
        .post('/api/notification-preferences')
        .send({ preferences });

      expect(res.status).toBe(401);
    });

    it('should not allow a user to update another user\'s preferences', async () => {
      // Create a second user and JWT
      const user2 = getRepository(User).create({
        email: 'otheruser@example.com',
        name: 'Other User',
        passwordHash: 'hashedpassword2',
      });
      await getRepository(User).save(user2);
      const token2 = jwt.sign({ id: user2.id, email: user2.email }, JWT_SECRET, {
        expiresIn: '1h',
      });

      // User2 tries to update preferences for user1 (should not be possible via API)
      const preferences = [
        { notificationTypeId: 'payment_success', optedOut: true },
      ];

      const res = await request(app)
        .post('/api/notification-preferences')
        .set('Authorization', `Bearer ${token2}`)
        .send({ preferences });

      expect(res.status).toBe(200); // Allowed, but only updates user2's preferences
      const dbPrefs = await getRepository(UserNotificationPreference).find({
        where: { userId: user.id },
      });
      expect(dbPrefs).toHaveLength(0);
      const dbPrefs2 = await getRepository(UserNotificationPreference).find({
        where: { userId: user2.id },
      });
      expect(dbPrefs2).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle DB errors gracefully', async () => {
      // Simulate DB error by closing connection
      await getConnection().close();

      const res = await request(app)
        .get('/api/notification-preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);

      // Reconnect for other tests
      await createConnection({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'payment_notifications_test',
        entities: [User, NotificationType, UserNotificationPreference, AuditLog],
        synchronize: true,
        dropSchema: false,
        logging: false,
      });
    });
  });
});
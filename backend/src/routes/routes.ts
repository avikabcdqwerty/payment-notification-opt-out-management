import { Router } from 'express';
import { getNotificationPreferences, updateNotificationPreferences } from '../controllers/notificationPreferences.controller';
import authMiddleware from '../middleware/auth.middleware';

// Create router instance
const router = Router();

/**
 * @route GET /notification-preferences
 * @desc Get all payment notification types and current user's opt-out preferences
 * @access Protected (authenticated users only)
 */
router.get('/notification-preferences', authMiddleware, getNotificationPreferences);

/**
 * @route POST /notification-preferences
 * @desc Update current user's payment notification opt-out preferences
 * @access Protected (authenticated users only)
 */
router.post('/notification-preferences', authMiddleware, updateNotificationPreferences);

export default router;
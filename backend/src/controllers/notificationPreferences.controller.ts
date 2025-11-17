import { Request, Response, NextFunction } from 'express';
import notificationPreferencesService from '../services/notificationPreferences.service';
import auditLogService from '../services/auditLog.service';
import { NotificationType, UserNotificationPreference } from '../models/models';

/**
 * Controller to get notification types and current user preferences.
 * Only authenticated users can access their own preferences.
 */
export const getNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch all notification types and user's preferences
    const notificationTypes: NotificationType[] =
      await notificationPreferencesService.getNotificationTypes();
    const userPreferences: UserNotificationPreference[] =
      await notificationPreferencesService.getUserPreferences(userId);

    res.status(200).json({ notificationTypes, userPreferences });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to update user's notification preferences.
 * Only authenticated users can modify their own preferences.
 * All changes are audited.
 */
export const updateNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { preferences } = req.body;
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Invalid preferences format.' });
    }

    // Validate notificationTypeIds
    const validTypes = await notificationPreferencesService.getNotificationTypeIds();
    for (const pref of preferences) {
      if (!validTypes.includes(pref.notificationTypeId)) {
        return res.status(400).json({
          error: `Invalid notificationTypeId: ${pref.notificationTypeId}`,
        });
      }
      if (typeof pref.optedOut !== 'boolean') {
        return res.status(400).json({
          error: `Invalid optedOut value for notificationTypeId: ${pref.notificationTypeId}`,
        });
      }
    }

    // Transactionally update preferences
    const updatedPreferences = await notificationPreferencesService.updateUserPreferences(
      userId,
      preferences
    );

    // Audit each change
    for (const pref of preferences) {
      await auditLogService.logPreferenceChange({
        userId,
        notificationTypeId: pref.notificationTypeId,
        optedOut: pref.optedOut,
        timestamp: new Date(),
        action: 'UPDATE',
      });
    }

    res.status(200).json({ success: true, userPreferences: updatedPreferences });
  } catch (err) {
    next(err);
  }
};
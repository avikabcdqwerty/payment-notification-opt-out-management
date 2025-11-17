import { getRepository, In, getManager } from 'typeorm';
import {
  NotificationType,
  UserNotificationPreference,
  User,
} from '../models/models';

/**
 * Fetch all available payment-related notification types.
 * @returns {Promise<NotificationType[]>}
 */
const getNotificationTypes = async (): Promise<NotificationType[]> => {
  const repo = getRepository(NotificationType);
  return await repo.find({ order: { name: 'ASC' } });
};

/**
 * Fetch all notification type IDs.
 * @returns {Promise<string[]>}
 */
const getNotificationTypeIds = async (): Promise<string[]> => {
  const repo = getRepository(NotificationType);
  const types = await repo.find({ select: ['id'] });
  return types.map((type) => type.id);
};

/**
 * Fetch the user's current notification preferences.
 * @param userId - The user's ID
 * @returns {Promise<UserNotificationPreference[]>}
 */
const getUserPreferences = async (
  userId: string
): Promise<UserNotificationPreference[]> => {
  const repo = getRepository(UserNotificationPreference);
  return await repo.find({ where: { userId } });
};

/**
 * Transactionally update the user's notification preferences.
 * Ensures all-or-nothing update and reliable persistence.
 * @param userId - The user's ID
 * @param preferences - Array of { notificationTypeId, optedOut }
 * @returns {Promise<UserNotificationPreference[]>} - Updated preferences
 */
const updateUserPreferences = async (
  userId: string,
  preferences: { notificationTypeId: string; optedOut: boolean }[]
): Promise<UserNotificationPreference[]> => {
  return await getManager().transaction(async (transactionalEntityManager) => {
    const prefRepo = transactionalEntityManager.getRepository(
      UserNotificationPreference
    );

    // Fetch all notification types for validation
    const validTypeIds = await getNotificationTypeIds();

    // Validate input
    for (const pref of preferences) {
      if (!validTypeIds.includes(pref.notificationTypeId)) {
        throw new Error(`Invalid notificationTypeId: ${pref.notificationTypeId}`);
      }
      if (typeof pref.optedOut !== 'boolean') {
        throw new Error(
          `Invalid optedOut value for notificationTypeId: ${pref.notificationTypeId}`
        );
      }
    }

    // Fetch existing preferences for user
    const existingPrefs = await prefRepo.find({
      where: { userId },
    });

    // Map for quick lookup
    const existingMap = new Map(
      existingPrefs.map((p) => [p.notificationTypeId, p])
    );

    // Upsert preferences
    for (const pref of preferences) {
      const existing = existingMap.get(pref.notificationTypeId);
      if (existing) {
        // Update only if changed
        if (existing.optedOut !== pref.optedOut) {
          existing.optedOut = pref.optedOut;
          await prefRepo.save(existing);
        }
      } else {
        // Create new preference
        const newPref = prefRepo.create({
          userId,
          notificationTypeId: pref.notificationTypeId,
          optedOut: pref.optedOut,
        });
        await prefRepo.save(newPref);
      }
    }

    // Remove preferences for notification types not present in input
    const inputTypeIds = preferences.map((p) => p.notificationTypeId);
    const toRemove = existingPrefs.filter(
      (p) => !inputTypeIds.includes(p.notificationTypeId)
    );
    if (toRemove.length > 0) {
      await prefRepo.remove(toRemove);
    }

    // Return updated preferences
    return await prefRepo.find({ where: { userId } });
  });
};

export default {
  getNotificationTypes,
  getNotificationTypeIds,
  getUserPreferences,
  updateUserPreferences,
};
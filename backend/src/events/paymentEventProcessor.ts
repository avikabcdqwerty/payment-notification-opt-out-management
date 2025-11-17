import { getRepository } from 'typeorm';
import { UserNotificationPreference, NotificationType, User } from '../models/models';

/**
 * Payment event payload interface.
 * Extend as needed for your payment event structure.
 */
export interface PaymentEvent {
  userId: string;
  notificationTypeId: string; // e.g., 'payment_success', 'payment_failure', etc.
  payload: any; // Event-specific data
}

/**
 * Interface for notification sending function.
 * Replace with actual push notification integration.
 */
export type SendNotificationFn = (
  user: User,
  notificationType: NotificationType,
  payload: any
) => Promise<void>;

/**
 * Checks user notification preferences and sends/suppresses notifications accordingly.
 * Ensures that opted-out notifications are not sent.
 * @param event - Payment event containing userId, notificationTypeId, and payload
 * @param sendNotification - Function to send notification (injected for testability)
 */
export const processPaymentEvent = async (
  event: PaymentEvent,
  sendNotification: SendNotificationFn
): Promise<void> => {
  const { userId, notificationTypeId, payload } = event;

  // Fetch user preference for this notification type
  const prefRepo = getRepository(UserNotificationPreference);
  const pref = await prefRepo.findOne({
    where: { userId, notificationTypeId },
  });

  // If user has opted out, suppress notification
  if (pref && pref.optedOut) {
    // Optionally log suppression for audit/debugging
    // eslint-disable-next-line no-console
    console.log(
      `Notification of type '${notificationTypeId}' suppressed for user '${userId}' (opted out).`
    );
    return;
  }

  // Fetch user and notification type details
  const userRepo = getRepository(User);
  const notificationTypeRepo = getRepository(NotificationType);

  const user = await userRepo.findOne({ where: { id: userId } });
  const notificationType = await notificationTypeRepo.findOne({
    where: { id: notificationTypeId },
  });

  if (!user || !notificationType) {
    // eslint-disable-next-line no-console
    console.error(
      `Cannot send notification: user or notification type not found (userId: ${userId}, notificationTypeId: ${notificationTypeId})`
    );
    return;
  }

  // Send notification (actual implementation injected)
  try {
    await sendNotification(user, notificationType, payload);
    // Optionally log successful delivery
    // eslint-disable-next-line no-console
    console.log(
      `Notification of type '${notificationTypeId}' sent to user '${userId}'.`
    );
  } catch (err) {
    // Log error but do not throw to avoid impacting payment event processing latency
    // eslint-disable-next-line no-console
    console.error(
      `Failed to send notification of type '${notificationTypeId}' to user '${userId}':`,
      err
    );
  }
};

export default {
  processPaymentEvent,
};
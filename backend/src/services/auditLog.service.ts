import { getRepository } from 'typeorm';
import { AuditLog } from '../models/models';

/**
 * Audit log entry for notification preference changes.
 */
export interface AuditLogEntry {
  userId: string;
  notificationTypeId: string;
  optedOut: boolean;
  timestamp: Date;
  action: 'UPDATE' | 'CREATE' | 'DELETE';
}

/**
 * Write an immutable audit log entry for a notification preference change.
 * Ensures tamper-evidence by never allowing updates or deletes.
 * @param entry - AuditLogEntry
 * @returns {Promise<void>}
 */
const logPreferenceChange = async (entry: AuditLogEntry): Promise<void> => {
  const repo = getRepository(AuditLog);

  // Create and save the audit log entry
  const auditLog = repo.create({
    userId: entry.userId,
    notificationTypeId: entry.notificationTypeId,
    optedOut: entry.optedOut,
    timestamp: entry.timestamp,
    action: entry.action,
  });

  await repo.save(auditLog);
};

export default {
  logPreferenceChange,
};
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';

/**
 * User entity.
 * Represents a platform user.
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  email!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ nullable: true })
  passwordHash!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * NotificationType entity.
 * Represents a type of payment-related notification (e.g., payment_success, payment_failure).
 */
@Entity({ name: 'notification_types' })
@Unique(['name'])
export class NotificationType {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string; // e.g., 'payment_success', 'payment_failure'

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

/**
 * UserNotificationPreference entity.
 * Stores a user's opt-out status for each notification type.
 */
@Entity({ name: 'user_notification_preferences' })
@Unique(['userId', 'notificationTypeId'])
export class UserNotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  notificationTypeId!: string;

  @Column({ type: 'boolean', default: false })
  optedOut!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations (optional, for eager loading)
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @ManyToOne(() => NotificationType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationTypeId' })
  notificationType?: NotificationType;
}

/**
 * AuditLog entity.
 * Immutable, tamper-evident log of all notification preference changes.
 */
@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  notificationTypeId!: string;

  @Column({ type: 'boolean' })
  optedOut!: boolean;

  @Column({ type: 'varchar', length: 16 })
  action!: 'UPDATE' | 'CREATE' | 'DELETE';

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}

export {
  User as default,
  NotificationType,
  UserNotificationPreference,
  AuditLog,
};
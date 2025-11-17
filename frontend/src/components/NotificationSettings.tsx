import React, { useEffect, useState } from 'react';
import { getNotificationPreferences, updateNotificationPreferences } from '../api/api';
import { useAuth } from '../App';

// Types for notification preferences
export interface NotificationType {
  id: string;
  name: string;
  description: string;
}

export interface UserNotificationPreference {
  notificationTypeId: string;
  optedOut: boolean;
}

// UI state for each notification type
interface NotificationPreferenceUI extends NotificationType {
  optedOut: boolean;
}

// Main NotificationSettings component
const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferenceUI[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch notification preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      setLoading(true);
      setError(null);
      try {
        // API returns { notificationTypes: NotificationType[], userPreferences: UserNotificationPreference[] }
        const { notificationTypes, userPreferences } = await getNotificationPreferences();
        // Merge notification types with user preferences
        const merged: NotificationPreferenceUI[] = notificationTypes.map((type: NotificationType) => {
          const pref = userPreferences.find(
            (p: UserNotificationPreference) => p.notificationTypeId === type.id
          );
          return {
            ...type,
            optedOut: pref ? pref.optedOut : false,
          };
        });
        setPreferences(merged);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to load notification preferences. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  // Handle toggle for opt-out
  const handleToggle = (notificationTypeId: string) => {
    setPreferences((prev) =>
      prev.map((pref) =>
        pref.id === notificationTypeId ? { ...pref, optedOut: !pref.optedOut } : pref
      )
    );
    setSuccess(null);
    setError(null);
  };

  // Handle save action
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // Prepare payload for API
      const updatedPrefs = preferences.map((pref) => ({
        notificationTypeId: pref.id,
        optedOut: pref.optedOut,
      }));
      await updateNotificationPreferences(updatedPrefs);
      setSuccess('Preferences updated successfully.');
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update preferences. No changes were saved.'
      );
      // Optionally, reload preferences from backend to ensure consistency
    } finally {
      setSaving(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <span>Loading notification settings...</span>
      </div>
    );
  }

  // Render error state
  if (error && !saving) {
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  // Render preferences UI
  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h1 style={{ marginBottom: '1rem' }}>Payment Notification Settings</h1>
      <p style={{ marginBottom: '2rem', color: '#555' }}>
        Manage which payment-related push notifications you receive. Toggle to opt-out of specific alerts.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        aria-label="Notification Preferences Form"
      >
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {preferences.map((pref) => (
            <li key={pref.id} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>{pref.name}</strong>
                <div style={{ fontSize: '0.95rem', color: '#888' }}>{pref.description}</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={pref.optedOut}
                  onChange={() => handleToggle(pref.id)}
                  disabled={saving}
                  aria-checked={pref.optedOut}
                  aria-label={`Opt out of ${pref.name}`}
                />
                <span style={{ fontSize: '0.95rem' }}>
                  {pref.optedOut ? 'Opted Out' : 'Opted In'}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {success && (
            <span style={{ color: 'green', fontWeight: 500 }}>{success}</span>
          )}
          {error && (
            <span style={{ color: 'red', fontWeight: 500 }}>{error}</span>
          )}
        </div>
      </form>
      <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#aaa' }}>
        All changes are securely saved and audited. Only you can view and edit your preferences.
      </div>
    </div>
  );
};

export default NotificationSettings;
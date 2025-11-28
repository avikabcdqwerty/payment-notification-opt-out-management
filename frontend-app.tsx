import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import axios, { AxiosError } from 'axios';

// ==================
// Types & Constants
// ==================

/**
 * Enum of payment notification types.
 * Extend as needed to match backend.
 */
export enum PaymentNotificationType {
  PaymentSuccess = 'payment_success',
  PaymentFailure = 'payment_failure',
  PaymentRefund = 'payment_refund',
}

export interface NotificationPreference {
  type: PaymentNotificationType;
  optedOut: boolean;
}

export interface NotificationPreferenceResponse {
  preferences: NotificationPreference[];
}

export interface UpdatePreferenceRequest {
  type: PaymentNotificationType;
  optedOut: boolean;
}

export interface UpdatePreferenceResponse {
  success: boolean;
  preferences: NotificationPreference[];
}

export interface ApiError {
  message: string;
  code?: string;
}

// ==================
// API Client
// ==================

/**
 * API client for notification preferences.
 * Assumes authentication token is available via localStorage or similar.
 */
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const getAuthToken = (): string | null => {
  // Replace with your auth token retrieval logic (e.g., from localStorage)
  return localStorage.getItem('authToken');
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

/**
 * Fetches the current user's notification preferences.
 */
export async function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  try {
    const response = await api.get<NotificationPreferenceResponse>('/notification-preferences');
    return response.data.preferences;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Updates a single notification preference for the current user.
 * Returns the updated preferences.
 */
export async function updateNotificationPreference(
  type: PaymentNotificationType,
  optedOut: boolean
): Promise<NotificationPreference[]> {
  try {
    const response = await api.put<UpdatePreferenceResponse>('/notification-preferences', {
      type,
      optedOut,
    });
    return response.data.preferences;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Handles API errors and logs them.
 */
function handleApiError(error: unknown): void {
  if (axios.isAxiosError(error)) {
    // eslint-disable-next-line no-console
    console.error('API Error:', error.response?.data || error.message);
  } else {
    // eslint-disable-next-line no-console
    console.error('Unknown API Error:', error);
  }
}

// ==================
// Auth Context (Stub)
// ==================

/**
 * Auth context for user info and authentication state.
 * Replace with your actual auth provider.
 */
interface AuthContextType {
  userId: string | null;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  userId: null,
  isAuthenticated: false,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// ==================
// UI Components
// ==================

/**
 * Toggle switch for opt-out/in.
 */
interface OptOutToggleProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id: string;
}

const OptOutToggle: React.FC<OptOutToggleProps> = ({
  checked,
  disabled,
  onChange,
  label,
  id,
}) => (
  <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-checked={checked}
      aria-label={label}
      style={{ width: 20, height: 20 }}
    />
    <span>{label}</span>
  </label>
);

/**
 * Notification settings page.
 */
const notificationTypeLabels: Record<PaymentNotificationType, string> = {
  [PaymentNotificationType.PaymentSuccess]: 'Payment Success',
  [PaymentNotificationType.PaymentFailure]: 'Payment Failure',
  [PaymentNotificationType.PaymentRefund]: 'Payment Refund',
};

const NotificationSettingsPage: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();

  const [preferences, setPreferences] = useState<NotificationPreference[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<Record<PaymentNotificationType, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch preferences on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchNotificationPreferences()
      .then((prefs) => {
        if (mounted) {
          setPreferences(prefs);
          setLoading(false);
        }
      })
      .catch((err) => {
        setError(
          'Failed to load notification preferences. Please try again later.'
        );
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Handle toggle
  const handleToggle = useCallback(
    async (type: PaymentNotificationType, optedOut: boolean) => {
      setSaving((prev) => ({ ...prev, [type]: true }));
      setError(null);
      setSuccessMsg(null);
      try {
        const updated = await updateNotificationPreference(type, optedOut);
        setPreferences(updated);
        setSuccessMsg('Preferences updated successfully.');
      } catch (err) {
        setError(
          'Could not update preference. Please check your connection and try again.'
        );
      } finally {
        setSaving((prev) => ({ ...prev, [type]: false }));
      }
    },
    []
  );

  // Render
  if (!isAuthenticated) {
    return (
      <div className="notification-settings-container">
        <h2>Notification Settings</h2>
        <p>You must be logged in to manage your notification preferences.</p>
      </div>
    );
  }

  return (
    <div className="notification-settings-container" style={{ maxWidth: 480, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
      <h2>Payment Notification Settings</h2>
      <p>
        Manage which payment-related push notifications you receive. Toggle to opt-out of specific notification types.
      </p>
      {loading && <div>Loading preferences...</div>}
      {error && (
        <div style={{ color: 'red', marginBottom: 12 }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ color: 'green', marginBottom: 12 }}>
          {successMsg}
        </div>
      )}
      {!loading && preferences && (
        <form
          aria-label="Notification Preferences"
          style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}
          onSubmit={(e) => e.preventDefault()}
        >
          {Object.values(PaymentNotificationType).map((type) => {
            const pref = preferences.find((p) => p.type === type);
            const checked = pref ? pref.optedOut : false;
            return (
              <OptOutToggle
                key={type}
                id={`toggle-${type}`}
                checked={checked}
                disabled={!!saving[type]}
                label={`Opt-out of "${notificationTypeLabels[type]}" notifications`}
                onChange={(checked) => handleToggle(type, checked)}
              />
            );
          })}
        </form>
      )}
      <div style={{ marginTop: 32 }}>
        <button type="button" onClick={logout} style={{ color: '#c00', background: 'none', border: 'none', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
    </div>
  );
};

// ==================
// App Entry Point
// ==================

/**
 * Example AuthProvider.
 * Replace with your actual authentication logic.
 */
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Simulate authentication state
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Simulate fetching user info from token
    const token = getAuthToken();
    if (token) {
      // Decode token or fetch user info as needed
      setUserId('user-123'); // Replace with real user ID
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('authToken');
    setUserId(null);
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        isAuthenticated: !!userId,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Root App component.
 */
const App: React.FC = () => (
  <AuthProvider>
    <NotificationSettingsPage />
  </AuthProvider>
);

export default App;
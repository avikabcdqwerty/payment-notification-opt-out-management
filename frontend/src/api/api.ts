import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { NotificationType, UserNotificationPreference } from '../components/NotificationSettings';
import { User } from '../App';

// Base API URL (can be set via environment variable for different environments)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// Create a configured Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true, // send cookies for auth if needed
});

// Attach JWT token to requests if available
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Centralized error handler
const handleApiError = (error: any): never => {
  // Log error for debugging (can be replaced with a logging service)
  // eslint-disable-next-line no-console
  console.error('API Error:', error);
  if (error.response && error.response.data && error.response.data.message) {
    throw new Error(error.response.data.message);
  }
  throw new Error(error.message || 'API request failed');
};

/**
 * Fetch the authenticated user's profile.
 * @returns {Promise<User>}
 */
export const getUserProfile = async (): Promise<User> => {
  try {
    const response: AxiosResponse<User> = await apiClient.get('/users/me');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Fetch notification types and current user preferences.
 * @returns {Promise<{ notificationTypes: NotificationType[]; userPreferences: UserNotificationPreference[] }>}
 */
export const getNotificationPreferences = async (): Promise<{
  notificationTypes: NotificationType[];
  userPreferences: UserNotificationPreference[];
}> => {
  try {
    const response: AxiosResponse<{
      notificationTypes: NotificationType[];
      userPreferences: UserNotificationPreference[];
    }> = await apiClient.get('/notification-preferences');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Update the user's notification preferences.
 * @param {UserNotificationPreference[]} preferences - Array of updated preferences
 * @returns {Promise<void>}
 */
export const updateNotificationPreferences = async (
  preferences: UserNotificationPreference[]
): Promise<void> => {
  try {
    await apiClient.post('/notification-preferences', { preferences });
  } catch (error) {
    handleApiError(error);
  }
};

export default {
  getUserProfile,
  getNotificationPreferences,
  updateNotificationPreferences,
};
import React, { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import NotificationSettings from './components/NotificationSettings';
import { getUserProfile } from './api/api';

// Define types for user context
export interface User {
  id: string;
  email: string;
  name: string;
  // Add other relevant user fields as needed
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

// Create AuthContext for global user state
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// AuthProvider component to wrap app and provide user state
const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile on mount
  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await getUserProfile();
      setUser(profile);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load user profile. Please try again.'
      );
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    // Optionally, add logic to refresh token/session here
  }, []);

  // Expose method to refresh user (e.g., after login/logout)
  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// ProtectedRoute component to enforce authentication
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    // Show loading spinner while checking auth
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page or show unauthorized message
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'red' }}>
        <h2>Unauthorized</h2>
        <p>You must be logged in to access this page.</p>
        {/* Optionally, add a link to login page */}
      </div>
    );
  }

  return <>{children}</>;
};

// Main App component
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Notification Settings page (protected) */}
          <Route
            path="/settings/notifications"
            element={
              <ProtectedRoute>
                <NotificationSettings />
              </ProtectedRoute>
            }
          />
          {/* Default route: redirect to notification settings */}
          <Route path="*" element={<Navigate to="/settings/notifications" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
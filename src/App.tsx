import React, { useState, useEffect } from 'react';
import AdminPanel from './AdminPanel';
import LoginScreen from './LoginScreen';
import {
  validateAuthToken,
  getStoredAuthToken,
  clearAuthToken,
} from '../lib/adminAuth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredAuthToken();
      const expectedHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH || '';

      if (token && await validateAuthToken(token, expectedHash)) {
        setIsAuthenticated(true);
      } else {
        clearAuthToken();
        setIsAuthenticated(false);
      }
      setIsChecking(false);
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated ? (
        <AdminPanel onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLogin} />
      )}
    </div>
  );
}

export default App;

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

export const DEMO_PROFILES = [
  { username: 'rohit_student', label: 'Student (Rohit - Regular)', role: 'STUDENT', is_priority: false, password: 'student123' },
  { username: 'priya_medical', label: 'Student (Priya - Medical Priority)', role: 'STUDENT', is_priority: true, password: 'student123' },
  { username: 'harpreet_driver', label: 'Shuttle Driver (Harpreet)', role: 'DRIVER', driver_type: 'SHUTTLE', password: 'driver123' },
  { username: 'gurpreet_cart', label: 'Golf Cart Driver (Gurpreet)', role: 'DRIVER', driver_type: 'GOLF_CART', password: 'driver123' },
  { username: 'admin_officer', label: 'Admin (Campus Transport)', role: 'ADMIN', password: 'admin123' },
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize with default demo student
  useEffect(() => {
    switchPersona('rohit_student');
  }, []);

  const switchPersona = async (username) => {
    setLoading(true);
    const profile = DEMO_PROFILES.find((p) => p.username === username) || DEMO_PROFILES[0];
    try {
      const res = await api.login(profile.username, profile.password);
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
    } catch (err) {
      console.error('Failed to switch persona:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, switchPersona, loading, demoProfiles: DEMO_PROFILES }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

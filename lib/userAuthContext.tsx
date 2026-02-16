'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { userApi } from './api';

interface User {
  id: string;
  email: string;
  username: string;
  suspended?: boolean;
}

interface UserAuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      // Fetch latest profile to ensure suspended/isActive flags are up-to-date
      (async () => {
        try {
          const profile = await userApi.getProfile(savedToken) as { user: User };
          setUser(profile.user);
          localStorage.setItem('user', JSON.stringify(profile.user));
        } catch (e) {
          // fallback to saved user
          setUser(JSON.parse(savedUser));
        }
      })();
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/user/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      setToken(data.token);
      setUser(data.user);

      localStorage.setItem('userToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (token) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/user/logout`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          }
        );
      }
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('userToken');
      localStorage.removeItem('user');
      setIsLoading(false);
    }
  };

  return (
    <UserAuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (context === undefined) {
    throw new Error('useUserAuth must be used within UserAuthProvider');
  }
  return context;
}

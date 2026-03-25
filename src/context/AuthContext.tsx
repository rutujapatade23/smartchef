import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import client from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('smartchef_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('smartchef_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await client.post('/login', { username, password });
      if (response.data.success) {
        const realUser: User = {
          name:     response.data.user.name,
          username: response.data.user.username,
          height:   response.data.user.height,
          weight:   response.data.user.weight,
          goal:     response.data.user.goal,
        };
        setUser(realUser);
        localStorage.setItem('smartchef_user', JSON.stringify(realUser));
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (err: any) {
      // Extract friendly message from axios error response
      const message = err.response?.data?.message || err.message || 'Invalid email or password';
      throw new Error(message);
    }
  };

  const register = async (data: any) => {
    try {
      const response = await client.post('/register', data);
      if (response.data.success) {
        const newUser: User = {
          name:     response.data.user?.name     || data.name,
          username: response.data.user?.username || data.username,
          height:   response.data.user?.height   || Number(data.height),
          weight:   response.data.user?.weight   || Number(data.weight),
          goal:     response.data.user?.goal     || data.goal,
          age:      response.data.user?.age      || Number(data.age),
        };
        setUser(newUser);
        localStorage.setItem('smartchef_user', JSON.stringify(newUser));
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Registration failed';
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await client.get('/logout');
    } catch {
      // still clear local state even if backend fails
    }
    setUser(null);
    localStorage.removeItem('smartchef_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
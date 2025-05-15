"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: "Super Administrator" | "DJ";
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fixed key for XOR operation (must match daemon)
const FIXED_KEY = 'uploadDistributor2025';

function encodePassword(password: string): string {
  // Apply XOR with the fixed key
  let result = '';
  for (let i = 0; i < password.length; i++) {
    const keyIndex = i % FIXED_KEY.length;
    const keyChar = FIXED_KEY.charAt(keyIndex);
    const charCode = password.charCodeAt(i) ^ keyChar.charCodeAt(0);
    result += String.fromCharCode(charCode);
  }
  
  // Convert to base64 for safe transmission
  return Buffer.from(result).toString('base64');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      validateToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setToken(token);
        localStorage.setItem('authToken', token);
      } else {
        // Token is invalid, clear auth state
        logout();
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const encodedPassword = encodePassword(password);

      console.log('Attempting login with:', JSON.stringify({ email, encodedPassword }, null, 2));
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          encodedPassword: encodedPassword,
        }),
      });

      const data = await response.json();
      console.log('Login response:', JSON.stringify(data, null, 2));

      if (data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
        router.push('/upload');
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Authentication failed' };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

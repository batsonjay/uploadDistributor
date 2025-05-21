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
    const tokenCreatedAt = localStorage.getItem('tokenCreatedAt');
    
    if (storedToken) {
      // Check token expiration if we have a creation timestamp
      if (tokenCreatedAt) {
        const creationTime = parseInt(tokenCreatedAt, 10);
        const currentTime = Date.now();
        const tokenAge = currentTime - creationTime;
        const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        // If token is older than 24 hours, log out
        if (tokenAge > oneDayInMs) {
          console.log('Token has expired (older than 24 hours), logging out');
          logout();
          return;
        }
      }
      
      validateToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);
  
  // Add a periodic check for token expiration
  useEffect(() => {
    // Only set up the interval if we have a token
    if (!token) return;
    
    const tokenCreatedAt = localStorage.getItem('tokenCreatedAt');
    if (!tokenCreatedAt) return;
    
    const checkInterval = setInterval(() => {
      const creationTime = parseInt(tokenCreatedAt, 10);
      const currentTime = Date.now();
      const tokenAge = currentTime - creationTime;
      const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      // If token is older than 24 hours, log out
      if (tokenAge > oneDayInMs) {
        console.log('Token has expired during session, logging out');
        logout();
      }
    }, 60000); // Check every minute
    
    // Clean up the interval when the component unmounts or token changes
    return () => clearInterval(checkInterval);
  }, [token]);

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
        
        // If there's no creation timestamp, set it now
        if (!localStorage.getItem('tokenCreatedAt')) {
          localStorage.setItem('tokenCreatedAt', Date.now().toString());
        }
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
        
        // Store token and current timestamp
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('tokenCreatedAt', Date.now().toString());
        
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
    localStorage.removeItem('tokenCreatedAt'); // Remove creation timestamp
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

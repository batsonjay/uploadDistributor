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
  requestLoginLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  login: (token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('authToken');
    const tokenExpires = localStorage.getItem('tokenExpires');
    
    if (storedToken) {
      // Check token expiration if we have an expiration timestamp
      if (tokenExpires) {
        const expirationTime = parseInt(tokenExpires, 10);
        const currentTime = Date.now();
        
        // If token has expired, log out
        if (currentTime > expirationTime) {
          console.log('Token has expired, logging out');
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
    
    const tokenExpires = localStorage.getItem('tokenExpires');
    if (!tokenExpires) return;
    
    const checkInterval = setInterval(() => {
      const expirationTime = parseInt(tokenExpires, 10);
      const currentTime = Date.now();
      
      // If token has expired, log out
      if (currentTime > expirationTime) {
        console.log('Token has expired during session, logging out');
        logout();
      }
    }, 60000); // Check every minute
    
    // Clean up the interval when the component unmounts or token changes
    return () => clearInterval(checkInterval);
  }, [token]);

  // Utility function for making authenticated API requests
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    
    // Create a proper Headers object
    const headersObj = new Headers(options.headers);
    
    // Only set Content-Type for JSON requests, not for FormData
    if (!(options.body instanceof FormData)) {
      headersObj.set('Content-Type', 'application/json');
    }
    
    if (token) {
      headersObj.set('Authorization', `Bearer ${token}`);
      console.log(`Adding Authorization header: Bearer ${token.substring(0, 10)}...`);
    } else {
      console.warn('No auth token found in localStorage');
    }
    
    console.log(`Making authenticated request to: ${url}`);
    console.log(`Request method: ${options.method || 'GET'}`);
    console.log(`Request headers:`, Object.fromEntries([...headersObj.entries()]));
    
    return fetch(url, {
      ...options,
      headers: headersObj,
    });
  };

  const validateToken = async (token: string) => {
    try {
      const response = await authenticatedFetch('http://localhost:3001/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setToken(token);
        localStorage.setItem('authToken', token);
        
        // If there's no expiration timestamp, set it based on the user's role
        if (!localStorage.getItem('tokenExpires')) {
          setTokenExpiration(data.user.role);
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
  
  // Set token expiration based on user role
  const setTokenExpiration = (role: string) => {
    const currentTime = Date.now();
    let expirationTime: number;
    
    if (role === 'Super Administrator') {
      // 10 years for admins (effectively permanent)
      expirationTime = currentTime + (10 * 365 * 24 * 60 * 60 * 1000);
    } else {
      // 24 hours for DJs
      expirationTime = currentTime + (24 * 60 * 60 * 1000);
    }
    
    localStorage.setItem('tokenExpires', expirationTime.toString());
  };

  // Request a login link to be sent to the user's email
  const requestLoginLink = async (email: string) => {
    try {
      setIsLoading(true);
      
      console.log('Requesting login link for:', email);
      const response = await authenticatedFetch('http://localhost:3001/api/auth/request-login', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      console.log('Request login link response:', data);

      if (data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to send login link' };
      }
    } catch (error) {
      console.error('Request login link failed:', error);
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verify a magic link token and log in the user
  const login = async (token: string) => {
    try {
      setIsLoading(true);
      
      console.log('Verifying login token:', token.substring(0, 10) + '...');
      
      // Log the full request details
      console.log('Making request to:', 'http://localhost:3001/api/auth/verify-login');
      console.log('Request body:', { token });
      
      const response = await authenticatedFetch('http://localhost:3001/api/auth/verify-login', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
      
      const data = await response.json();
      console.log('Verify login token response data:', data);

      if (data.success) {
        console.log('Login successful, user:', data.user);
        setUser(data.user);
        setToken(data.token);
        
        // Store token and set expiration based on role
        localStorage.setItem('authToken', data.token);
        setTokenExpiration(data.user.role);
        
        // Immediately set the cookie for navigation
        document.cookie = `authToken=${data.token}; path=/; max-age=31536000; SameSite=Strict`;
        console.log('Set auth cookie for navigation:', data.token.substring(0, 10) + '...');
        
        return { success: true };
      } else {
        console.error('Login failed:', data.error);
        return { success: false, error: data.error || 'Invalid or expired token' };
      }
    } catch (error) {
      console.error('Token verification failed with exception:', error);
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };
  

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpires'); // Remove expiration timestamp
    router.push('/login');
  };

  // Add a script to the document head to sync localStorage to cookies
  useEffect(() => {
    // This script runs on the client side to sync localStorage token to a cookie
    // for middleware compatibility during page navigation
    const syncTokenToCookie = () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        document.cookie = `authToken=${token}; path=/; max-age=31536000; SameSite=Strict`;
      } else {
        document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
    };
    
    // Run once on mount
    syncTokenToCookie();
    
    // Set up an interval to keep the cookie in sync
    const intervalId = setInterval(syncTokenToCookie, 60000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      requestLoginLink,
      login,
      logout, 
      isLoading,
      authenticatedFetch
    }}>
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

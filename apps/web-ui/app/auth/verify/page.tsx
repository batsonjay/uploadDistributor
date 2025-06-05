'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../auth/AuthContext';
import styles from './page.module.css';

/**
 * Inner component that uses useSearchParams
 */
function VerifyLoginInner() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const verificationAttempted = useRef(false);
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    console.log('Verify page loaded with token:', token ? 'Token present' : 'No token');
    
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid login link. Please request a new one.');
      return;
    }
    
    // Use a ref to prevent duplicate verification attempts
    // This is important because React's strict mode in development
    // causes components to mount twice
    if (verificationAttempted.current) {
      console.log('Verification already attempted, skipping duplicate request');
      return;
    }
    
    const verifyToken = async () => {
      try {
        // Mark that we've attempted verification
        verificationAttempted.current = true;
        
        console.log('Attempting to verify token...');
        const result = await login(token);
        console.log('Token verification result:', result);
        
        if (!result.success) {
          console.error('Token verification failed:', result.error);
          setStatus('error');
          setErrorMessage(result.error || 'Invalid or expired login link');
          return;
        }
        
        console.log('Token verification successful, user:', result);
        setStatus('success');
        // Redirect to send page after a short delay
        setTimeout(() => {
          console.log('Redirecting to send page...');
          router.push('/send');
        }, 1500);
      } catch (error) {
        console.error('Error verifying token:', error);
        setStatus('error');
        setErrorMessage('An error occurred. Please try again.');
      }
    };
    
    verifyToken();
  }, [searchParams, login, router]);
  
  return (
    <div className={styles.container}>
      <h1>Verifying Login</h1>
      
      {status === 'verifying' && (
        <div className={styles.verifying}>
          <p>Verifying your login link...</p>
          <div className={styles.spinner}></div>
        </div>
      )}
      
      {status === 'success' && (
        <div className={styles.success}>
          <h2>Login Successful!</h2>
          <p>Redirecting to the send page...</p>
        </div>
      )}
      
      {status === 'error' && (
        <div className={styles.error}>
          <h2>Login Failed</h2>
          <p>{errorMessage}</p>
          <button 
            onClick={() => router.push('/login')}
            className={styles.button}
          >
            Back to Login
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Verification page for magic link authentication
 * 
 * This page is accessed when a user clicks on a magic link in their email.
 * It extracts the token from the URL, verifies it with the server,
 * and redirects to the upload page on success.
 */
export default function VerifyLogin() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <h1>Verifying Login</h1>
        <div className={styles.verifying}>
          <p>Loading...</p>
          <div className={styles.spinner}></div>
        </div>
      </div>
    }>
      <VerifyLoginInner />
    </Suspense>
  );
}

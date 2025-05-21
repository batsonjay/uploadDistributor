"use client";

import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import styles from "./page.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const { requestLoginLink, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLinkSent(false);

    const result = await requestLoginLink(email);
    if (result.success) {
      setLinkSent(true);
    } else {
      setError(result.error || "Failed to send login link");
    }
  };

  return (
    <div className={styles.loginPage}>
      <main className={styles.main}>
        <h1 className={styles.title}>Login</h1>
        
        {linkSent ? (
          <div className={styles.linkSent}>
            <h2>Check Your Email</h2>
            <p>We've sent a login link to <strong>{email}</strong></p>
            <p>Click the link in the email to log in to Upload Distributor.</p>
            <p className={styles.note}>The link will expire in 15 minutes.</p>
            
            <button
              className={styles.resendButton}
              onClick={() => setLinkSent(false)}
              disabled={isLoading}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send Login Link"}
            </button>
            
            <p className={styles.info}>
              We'll send you a secure link to log in without a password.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

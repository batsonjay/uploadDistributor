"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import styles from "./DjSelector.module.css";

interface DJ {
  id: string;
  displayName: string;
  email: string;
}

interface DjSelectorProps {
  onSelectDj: (dj: DJ | null) => void;
}

export default function DjSelector({ onSelectDj }: DjSelectorProps) {
  const [djs, setDjs] = useState<DJ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDj, setSelectedDj] = useState<DJ | null>(null);
  const { user, authenticatedFetch } = useAuth();

  // Use a ref to prevent double execution of the effect
  const fetchedRef = useRef(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    // Skip if we've already fetched successfully
    if (fetchedRef.current || hasFetched) return;
    
    const fetchDjs = async () => {
      // Set the ref immediately to prevent concurrent calls
      fetchedRef.current = true;
      
      try {
        setLoading(true);
        setError(null);
        
        // Check if user is authenticated and has the correct role
        if (!user) {
          setError("You must be logged in to view DJs");
          setLoading(false);
          return;
        }
        
        if (user.role !== 'Super Administrator') {
          setError("You don't have permission to view DJs");
          setLoading(false);
          return;
        }
        
        // Use authenticatedFetch to get the DJ list
        const apiUrl = "http://localhost:3001/api/auth/djs";
        
        const response = await authenticatedFetch(apiUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.djs) {
          setDjs(data.djs);
          // Mark as successfully fetched
          setHasFetched(true);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        // Reset the ref if there was an error, so we can try again
        fetchedRef.current = false;
      } finally {
        setLoading(false);
      }
    };
    
    fetchDjs();
    
    // Reset the ref when dependencies change
    return () => {
      fetchedRef.current = false;
    };
  }, [authenticatedFetch, user, hasFetched]);

  const handleSelectDj = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const djId = event.target.value;
    
    if (djId === "") {
      setSelectedDj(null);
      onSelectDj(null);
      return;
    }
    
    const selected = djs.find(dj => dj.id === djId) || null;
    setSelectedDj(selected);
    onSelectDj(selected);
    console.log("Selected DJ:", selected);
  };

  // Only show for admin users
  if (user?.role !== 'Super Administrator') {
    return null;
  }
  
  if (loading) {
    return <div className={styles.loading}>Loading DJs...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <label htmlFor="dj-selector" className={styles.label}>
        Upload as DJ:
      </label>
      <select
        id="dj-selector"
        className={styles.select}
        value={selectedDj?.id || ""}
        onChange={handleSelectDj}
      >
        <option value="">-- Select a DJ --</option>
        {djs.map(dj => (
          <option key={dj.id} value={dj.id}>
            {dj.displayName} ({dj.email})
          </option>
        ))}
      </select>
      {selectedDj && (
        <p className={styles.info}>
          You are uploading on behalf of <strong>{selectedDj.displayName}</strong>
        </p>
      )}
    </div>
  );
}

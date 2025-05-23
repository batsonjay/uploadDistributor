"use client";

import { useState, useEffect } from "react";
import styles from "./GenreSelector.module.css";

// The approved list of genres from docs/songlists.md
const APPROVED_GENRES = [
  "Acid House", "Afro House", "Bass House", "Chicago House", 
  "Deep House", "Electro House", "Funky House", "Future House", 
  "Garage House", "Hard House", "Jackin House", "Latin House", 
  "Melodic House", "Minimal House", "Progressive House", "Soulful House", 
  "Tech House", "Tribal House", "Vocal House", "Techno"
];

// Maximum number of genres that can be selected
const MAX_SELECTIONS = 5;

interface GenreSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function GenreSelector({ value, onChange, disabled = false }: GenreSelectorProps) {
  // Parse the initial value (comma-separated string) into an array of selected genres
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    return value ? value.split(',').map(g => g.trim()).filter(g => APPROVED_GENRES.includes(g)) : [];
  });

  // Toggle a genre selection
  const toggleGenre = (genre: string) => {
    if (disabled) return;
    
    setSelectedGenres(prev => {
      // If already selected, remove it
      if (prev.includes(genre)) {
        return prev.filter(g => g !== genre);
      }
      
      // If not selected and we haven't reached the limit, add it
      if (prev.length < MAX_SELECTIONS) {
        return [...prev, genre];
      }
      
      // Otherwise, we've reached the limit, so don't change anything
      return prev;
    });
  };

  // Update the parent component's value when selections change
  useEffect(() => {
    onChange(selectedGenres.join(', '));
  }, [selectedGenres, onChange]);

  return (
    <div className={styles.container}>
      <p className={styles.instruction}>Select up to 5 genres</p>
      <div className={styles.genreGrid}>
        {APPROVED_GENRES.map(genre => {
          const isSelected = selectedGenres.includes(genre);
          const isDisabled = !isSelected && selectedGenres.length >= MAX_SELECTIONS;
          
          return (
            <button
              key={genre}
              type="button"
              className={`${styles.genreChip} ${isSelected ? styles.selected : ''} ${isDisabled ? styles.disabled : ''}`}
              onClick={() => toggleGenre(genre)}
              disabled={disabled || isDisabled}
            >
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );
}

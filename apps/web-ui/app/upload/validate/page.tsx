"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface Song {
  title: string;
  artist: string;
}

// Mock data for initial development
const mockSongs: Song[] = [
  { title: "Song One", artist: "Artist One" },
  { title: "Song Two", artist: "Artist Two" },
  { title: "Song Three", artist: "Artist Three" },
];

export default function ValidatePage() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>(mockSongs);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSwap = () => {
    setSongs(songs.map(song => ({
      title: song.artist,
      artist: song.title,
    })));
  };

  const handleBack = () => {
    router.back();
  };

  const handleUpload = async () => {
    setIsLoading(true);
    setError("");

    try {
      // TODO: Implement actual upload logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      // TODO: Redirect to status page once implemented
      router.push("/");
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.validatePage}>
      <main className={styles.main}>
        <h1 className={styles.title}>Validate Songlist</h1>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <h2>Songs</h2>
            <button
              type="button"
              className={styles.swapButton}
              onClick={handleSwap}
              disabled={isLoading}
            >
              Swap Title/Artist
            </button>
          </div>

          <table className={styles.songTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Artist</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{song.title}</td>
                  <td>{song.artist}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.backButton}
              onClick={handleBack}
              disabled={isLoading}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.uploadButton}
              onClick={handleUpload}
              disabled={isLoading}
            >
              {isLoading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

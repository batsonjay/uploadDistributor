"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth/AuthContext";
import styles from "./page.module.css";

interface Song {
  title: string;
  artist: string;
}

interface UploadData {
  fileId: string;
  metadata: {
    title: string;
    djName: string;
    broadcastDate: string;
    broadcastTime: string;
    genre: string;
    description: string;
  };
}

export default function ValidatePage() {
  const router = useRouter();
  const { user, authenticatedFetch } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [uploadData, setUploadData] = useState<UploadData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Ref to prevent duplicate API calls in StrictMode
  const hasFetchedSongs = useRef(false);

  useEffect(() => {
    // Load upload data from session storage
    const storedData = sessionStorage.getItem("uploadData");
    if (!storedData) {
      router.replace("/upload");
      return;
    }

    const data = JSON.parse(storedData) as UploadData;
    setUploadData(data);

    // Get auth token and fetch parsed songs
    const fetchSongs = async () => {
      // Prevent duplicate API calls in StrictMode
      if (hasFetchedSongs.current) {
        console.log('Preventing duplicate API call in StrictMode');
        return;
      }
      
      try {
        setIsLoading(true);
        setError("");
        hasFetchedSongs.current = true;

        // Fetch parsed songs
        const response = await authenticatedFetch(`http://localhost:3001/parse-songlist/${data.fileId}/`);

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const result = await response.json();
        setSongs(result.songs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load songs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSongs();
  }, [router]);

  const handleSwap = () => {
    setSongs(songs.map(song => ({
      title: song.artist,
      artist: song.title,
    })));
  };

  const handleBack = () => {
    router.back();
  };

  // Ref to prevent duplicate confirm requests in StrictMode
  const isConfirming = useRef(false);

  const handleUpload = async () => {
    if (!uploadData) return;

    // Prevent duplicate confirm requests in StrictMode
    if (isConfirming.current) {
      console.log('Preventing duplicate confirm request in StrictMode');
      return;
    }

    isConfirming.current = true;
    setIsLoading(true);
    setError("");

    try {
      // Confirm the upload
      const response = await authenticatedFetch(`http://localhost:3001/parse-songlist/${uploadData.fileId}/confirm/`, {
        method: "POST",
        body: JSON.stringify({ songs })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Clear the upload data from session storage
      sessionStorage.removeItem("uploadData");

      // TODO: Redirect to status page once implemented
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
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

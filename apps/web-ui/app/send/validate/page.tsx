"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth/AuthContext";
import { useFilePathsContext } from "../../components/FileContext";
import { getSendFiles, clearSendFiles } from "../../utils/fileStorage";
import styles from "./page.module.css";

interface Song {
  title: string;
  artist: string;
}

interface SendData {
  songs: Song[];
  metadata: {
    title: string;
    djName: string;
    broadcastDate: string;
    broadcastTime: string;
    genre: string;
    description: string;
    audioFile: string | null;
    artworkFile: string | null;
    songlistFile: string;
  };
  files: {
    audio: boolean;
    artwork: boolean;
    songlist: boolean;
  };
}

export default function ValidatePage() {
  const router = useRouter();
  const { user, authenticatedFetch } = useAuth();
  const { 
    audioFilePath, 
    artworkFilePath, 
    metadata: contextMetadata,
    setAudioFilePath, 
    setArtworkFilePath, 
    setSonglistFilePath,
    setMetadata 
  } = useFilePathsContext();
  const [songs, setSongs] = useState<Song[]>([]);
  const [sendData, setSendData] = useState<SendData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Ref to prevent duplicate API calls in StrictMode
  const hasFetchedSongs = useRef(false);

  useEffect(() => {
    // Load songs from session storage
    const storedData = sessionStorage.getItem("sendData");
    if (!storedData) {
      router.replace("/send");
      return;
    }

    const data = JSON.parse(storedData);
    setSongs(data.songs);
    
    // Create sendData from context metadata and songs
    setSendData({
      songs: data.songs,
      metadata: {
        title: contextMetadata.title,
        djName: contextMetadata.djName,
        broadcastDate: contextMetadata.broadcastDate,
        broadcastTime: contextMetadata.broadcastTime,
        genre: contextMetadata.genre,
        description: contextMetadata.description,
        audioFile: audioFilePath,
        artworkFile: artworkFilePath,
        songlistFile: "validated-songs.json"
      },
      files: {
        audio: !!audioFilePath,
        artwork: !!artworkFilePath,
        songlist: true
      }
    });
    
    hasFetchedSongs.current = true;
  }, [router, audioFilePath, artworkFilePath, contextMetadata]);


  const handleSwap = () => {
    setSongs(songs.map(song => ({
      title: song.artist,
      artist: song.title,
    })));
  };

  const handleBack = () => {
    // Clear session storage when going back to prevent stale data
    sessionStorage.removeItem("sendData");
    router.back();
  };

  // Ref to prevent duplicate send requests in StrictMode
  const isSending = useRef(false);

  const handleSend = async () => {
    if (!sendData) {
      console.error("Send data is missing");
      return;
    }

    // Prevent duplicate send requests in StrictMode
    if (isSending.current) {
      console.log('Preventing duplicate send request in StrictMode');
      return;
    }

      console.log("Starting file sending process");

    isSending.current = true;
    setIsLoading(true);
    setError("");
    setUploadProgress(0);

    try {
      // Create form data with all files and metadata
      const formData = new FormData();
      
      // Retrieve actual files from IndexedDB
      console.log("Retrieving files from IndexedDB...");
      const { audio: audioFile, artwork: artworkFile } = await getSendFiles();
      
      if (audioFile) {
        formData.append("audio", audioFile);
        console.log("Added audio file to form data:", audioFile.name, audioFile.size, "bytes");
      } else {
        console.warn("No audio file found in IndexedDB");
      }
      
      if (artworkFile) {
        formData.append("artwork", artworkFile);
        console.log("Added artwork file to form data:", artworkFile.name, artworkFile.size, "bytes");
      } else {
        console.warn("No artwork file found in IndexedDB");
      }
      
      // Create a new songlist file from the validated songs as JSON
      // This avoids the need for re-parsing on the daemon side
      const songsData = {
        format: "json",
        songs: songs
      };
      const songsBlob = new Blob([JSON.stringify(songsData)], { type: 'application/json' });
      formData.append("songlist", songsBlob, "songlist.json");
      
      // Add metadata as a single JSON object
      const metadata = {
        title: sendData.metadata.title,
        broadcastDate: sendData.metadata.broadcastDate,
        broadcastTime: sendData.metadata.broadcastTime,
        genre: sendData.metadata.genre,
        description: sendData.metadata.description,
        djName: sendData.metadata.djName
      };
      
      formData.append("metadata", JSON.stringify(metadata));
      
      // Add selectedDjId if present in session storage
      const storedData = sessionStorage.getItem("sendData");
      if (storedData) {
        const data = JSON.parse(storedData);
        if (data.selectedDjId) {
          formData.append("selectedDjId", data.selectedDjId);
          console.log("Added selectedDjId to form data:", data.selectedDjId);
        }
      }
      
      // Send files to daemon using the send/process endpoint
      setCurrentFile("audio");
      setUploadProgress(10);
      
      const response = await authenticatedFetch("http://localhost:3001/send/process", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      setUploadProgress(100);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to send files");
      }
      
      console.log("Files sent successfully");
      
      // Clear the send data from session storage
      sessionStorage.removeItem("sendData");
      
      // Clear files from IndexedDB
      try {
        await clearSendFiles();
        console.log("Cleared files from IndexedDB");
      } catch (error) {
        console.error("Error clearing files from IndexedDB:", error);
        // Don't fail the whole operation if cleanup fails
      }
      
      // Reset FileContext
      setAudioFilePath(null);
      setArtworkFilePath(null);
      setSonglistFilePath(null);
      setMetadata({
        title: "",
        djName: "",
        broadcastDate: "",
        broadcastTime: "",
        genre: "",
        description: ""
      });
      
      // Show success message
      setUploadSuccess(true);
      
      // Redirect to send page after 3 seconds
      setTimeout(() => {
        router.push("/send");
      }, 3000);
    } catch (err) {
      console.error("Error during file sending:", err);
      setError(err instanceof Error ? err.message : "File sending failed");
      
      // Clean up IndexedDB files on failure to prevent stale data
      try {
        await clearSendFiles();
        console.log("Cleaned up files from IndexedDB after failure");
      } catch (cleanupError) {
        console.error("Error cleaning up files after failure:", cleanupError);
      }
    } finally {
      setIsLoading(false);
      isSending.current = false;
    }
  };

  // We don't need cleanup on component unmount here
  // The session data should persist until explicitly cleared
  // This prevents issues when the component is unmounted during navigation

  return (
    <div className={styles.validatePage}>
      <main className={styles.main}>
        <h1 className={styles.title}>Validate Songlist</h1>

        {uploadSuccess ? (
          <div className={styles.successMessage}>
            <h2>Success!</h2>
            <p>Your files have been sent successfully.</p>
            <p>Redirecting to the send page in 3 seconds...</p>
          </div>
        ) : (
          <>
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

              {/* Metadata and file info section */}
              <div className={styles.metadataSection}>
                <div className={styles.metadataGrid}>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Title:</span>
                    <span className={styles.metadataValue}>{contextMetadata.title}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>DJ:</span>
                    <span className={styles.metadataValue}>{contextMetadata.djName}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Date:</span>
                    <span className={styles.metadataValue}>{contextMetadata.broadcastDate}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Time:</span>
                    <span className={styles.metadataValue}>{contextMetadata.broadcastTime}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Genre:</span>
                    <span className={styles.metadataValue}>{contextMetadata.genre}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Audio:</span>
                    <span className={styles.metadataValue}>{audioFilePath || "No file selected"}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Artwork:</span>
                    <span className={styles.metadataValue}>{artworkFilePath || "No file selected"}</span>
                  </div>
                </div>
                {contextMetadata.description && (
                  <div className={styles.descriptionItem}>
                    <span className={styles.metadataLabel}>Description:</span>
                    <span className={styles.metadataValue}>{contextMetadata.description}</span>
                  </div>
                )}
              </div>

              {/* Progress bar for file upload */}
              {isLoading && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressInfo}>
                    <span>Sending {currentFile} file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

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
                  className={styles.sendButton}
                  onClick={handleSend}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send"}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthContext";
import { useFilePathsContext } from "../components/FileContext";
import DjSelector from "../components/DjSelector";
import GenreSelector from "../components/GenreSelector";
import { storeSendFiles, fileStorage } from "../utils/fileStorage";
import styles from "./page.module.css";

interface DJ {
  id: string;
  displayName: string;
  email: string;
}

interface FileState {
  file: File | null;
  error: string;
}

export default function SendPage() {
  const router = useRouter();
  const { user, logout, authenticatedFetch } = useAuth();
  const { 
    setAudioFilePath, 
    setArtworkFilePath, 
    setSonglistFilePath,
    setMetadata 
  } = useFilePathsContext();
  const [audioFile, setAudioFile] = useState<FileState>({ file: null, error: "" });
  const [songlistFile, setSonglistFile] = useState<FileState>({ file: null, error: "" });
  const [artworkFile, setArtworkFile] = useState<FileState>({ file: null, error: "" });
  const [setTitle, setSetTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [broadcastDate, setBroadcastDate] = useState("");
  const [broadcastTime, setBroadcastTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDj, setSelectedDj] = useState<DJ | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");

  // Hidden file input refs
  const audioInputRef = useRef<HTMLInputElement>(null);
  const songlistInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (state: FileState) => void,
    acceptedTypes: string[]
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFile({ file: null, error: "No file selected" });
      return;
    }

    const fileType = file.name.split(".").pop()?.toLowerCase() || "";
    if (!acceptedTypes.includes(fileType)) {
      setFile({ 
        file: null, 
        error: `Invalid file type. Accepted types: ${acceptedTypes.join(", ")}` 
      });
      return;
    }

    setFile({ file, error: "" });
    
    // Store files in IndexedDB for persistence across page navigation
    try {
      if (setFile === setAudioFile && file) {
        await storeSendFiles(file, artworkFile.file);
        setAudioFilePath(file.name);
      } else if (setFile === setArtworkFile && file) {
        await storeSendFiles(audioFile.file, file);
        setArtworkFilePath(file.name);
      } else if (setFile === setSonglistFile && file) {
        setSonglistFilePath(file.name);
      }
    } catch (error) {
      console.error('Error storing file in IndexedDB:', error);
      // Continue anyway - the file is still in memory for this session
    }
  };

  const handleDrop = async (
    e: React.DragEvent,
    setFile: (state: FileState) => void,
    acceptedTypes: string[]
  ) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) {
      setFile({ file: null, error: "No file dropped" });
      return;
    }

    const fileType = file.name.split(".").pop()?.toLowerCase() || "";
    if (!acceptedTypes.includes(fileType)) {
      setFile({ 
        file: null, 
        error: `Invalid file type. Accepted types: ${acceptedTypes.join(", ")}` 
      });
      return;
    }

    setFile({ file, error: "" });
    
    // Store files in IndexedDB for persistence across page navigation
    try {
      if (setFile === setAudioFile && file) {
        await storeSendFiles(file, artworkFile.file);
        setAudioFilePath(file.name);
      } else if (setFile === setArtworkFile && file) {
        await storeSendFiles(audioFile.file, file);
        setArtworkFilePath(file.name);
      } else if (setFile === setSonglistFile && file) {
        setSonglistFilePath(file.name);
      }
    } catch (error) {
      console.error('Error storing file in IndexedDB:', error);
      // Continue anyway - the file is still in memory for this session
    }
  };

  // Handle DJ selection
  const handleDjSelection = (dj: DJ | null) => {
    setSelectedDj(dj);
  };

  // Ref to prevent duplicate form submissions in StrictMode
  const isSubmitting = useRef(false);

  // Clean up old files and session data on page load
  useEffect(() => {
    // Clean up old IndexedDB files (older than 24 hours) when page loads
    const cleanupOldFiles = async () => {
      try {
        await fileStorage.cleanupOldFiles();
        console.log('Cleaned up old IndexedDB files');
      } catch (error) {
        console.error('Error cleaning up old files:', error);
      }
    };
    
    cleanupOldFiles();
    
    return () => {
      // Only clean up if we're not navigating to the validate page
      // We can check this by looking at the current URL
      if (!window.location.pathname.includes('/send/validate')) {
        console.log('Cleaning up session data on unmount');
        sessionStorage.removeItem("sendData");
      } else {
        console.log('Preserving session data for validate page');
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songlistFile.file) {
      return;
    }

    // Prevent duplicate submissions in StrictMode
    if (isSubmitting.current) {
      console.log('Preventing duplicate form submission in StrictMode');
      return;
    }
    
    isSubmitting.current = true;
    setIsLoading(true);
    setError("");
    
    // We don't need to clear session data here, as we're about to set new data
    // and the validate page needs this data

    try {
      // Step 1: Send only the songlist file for validation
      const formData = new FormData();
      formData.append("songlist", songlistFile.file);
      
      // Add metadata as JSON
      const metadata = {
        title: setTitle,
        broadcastDate,
        broadcastTime,
        genre,
        description,
        djName: user?.displayName || ""
      };
      
      formData.append("metadata", JSON.stringify(metadata));
      
      // Add selected DJ ID if an admin has selected one
      if (user?.role === 'Super Administrator' && selectedDj) {
        formData.append("selectedDjId", selectedDj.id);
      }

      // Send songlist to daemon for validation
      setCurrentFile("songlist");
      setUploadProgress(10);
      
      const response = await authenticatedFetch("http://localhost:3001/parse-songlist/validate", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      setUploadProgress(100);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to validate songlist");
      }
      
      // Store the metadata in the context
      setMetadata({
        title: setTitle,
        djName: selectedDj?.displayName || user?.displayName || "",
        broadcastDate,
        broadcastTime,
        genre,
        description
      });
      
      // Store the parsed songs and selectedDjId in sessionStorage
      sessionStorage.setItem("sendData", JSON.stringify({
        songs: result.songs,
        selectedDjId: selectedDj?.id || null
      }));

      router.push("/send/validate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setIsLoading(false);
      isSubmitting.current = false;
    }
  };

  return (
    <div className={styles.sendPage}>
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.titleColumn}>
              <h1 className={styles.title}>Send New Mix</h1>
              <p className={styles.requiredNote}>All fields are required</p>
            </div>
            <div className={styles.userInfo}>
              <span>Logged in as {user?.displayName}</span>
              <button onClick={logout} className={styles.logoutButton}>
                Logout
              </button>
            </div>
          </div>
        </div>
        
        {/* DJ Selector - only shown for admin users */}
        {user?.role === 'Super Administrator' && (
          <DjSelector onSelectDj={handleDjSelection} />
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* File Upload Row */}
          <div className={styles.fileUploadRow}>
            {/* Audio File Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Audio File</h2>
              <div className={styles.fileInput}>
                <label className={styles.fileInputLabel}>MP3 File</label>
                <div
                  className={styles.dropzone}
                  onDrop={(e) => handleDrop(e, setAudioFile, ["mp3"])}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => audioInputRef.current?.click()}
                >
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept=".mp3"
                    onChange={(e) => handleFileChange(e, setAudioFile, ["mp3"])}
                    style={{ display: "none" }}
                  />
                  <p className={`${styles.dropzoneText} ${audioFile.file ? styles.dropzoneFilename : styles.dropzonePlaceholder}`}>
                    {audioFile.file
                      ? audioFile.file.name
                      : "Click or drag and drop MP3 file here"}
                  </p>
                </div>
                {audioFile.error && <div className={styles.error}>{audioFile.error}</div>}
              </div>
            </section>

            {/* Songlist File Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Songlist</h2>
              <div className={styles.fileInput}>
                <label className={styles.fileInputLabel}>Songlist File</label>
                <div
                  className={styles.dropzone}
                  onDrop={(e) => handleDrop(e, setSonglistFile, ["txt", "rtf", "docx", "nml", "m3u8"])}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => songlistInputRef.current?.click()}
                >
                  <input
                    ref={songlistInputRef}
                    type="file"
                    accept=".txt,.rtf,.docx,.nml,.m3u8"
                    onChange={(e) => handleFileChange(e, setSonglistFile, ["txt", "rtf", "docx", "nml", "m3u8"])}
                    style={{ display: "none" }}
                  />
                  <p className={`${styles.dropzoneText} ${songlistFile.file ? styles.dropzoneFilename : styles.dropzonePlaceholder}`}>
                    {songlistFile.file
                      ? songlistFile.file.name
                      : "Click or drag and drop songlist file here"}
                  </p>
                </div>
                {songlistFile.error && <div className={styles.error}>{songlistFile.error}</div>}
              </div>
            </section>

            {/* Artwork File Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Artwork</h2>
              <div className={styles.fileInput}>
                <label className={styles.fileInputLabel}>Artwork File</label>
                <div
                  className={styles.dropzone}
                  onDrop={(e) => handleDrop(e, setArtworkFile, ["jpg", "jpeg"])}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => artworkInputRef.current?.click()}
                >
                  <input
                    ref={artworkInputRef}
                    type="file"
                    accept=".jpg,.jpeg"
                    onChange={(e) => handleFileChange(e, setArtworkFile, ["jpg", "jpeg"])}
                    style={{ display: "none" }}
                  />
                  <p className={`${styles.dropzoneText} ${artworkFile.file ? styles.dropzoneFilename : styles.dropzonePlaceholder}`}>
                    {artworkFile.file
                      ? artworkFile.file.name
                      : "Click or drag and drop artwork file here (1440x1440 JPG)"}
                  </p>
                </div>
                {artworkFile.error && <div className={styles.error}>{artworkFile.error}</div>}
              </div>
            </section>
          </div>

          {/* Broadcast Details Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Broadcast Details</h2>
            
            <div className={styles.dateTimeGroup}>
              <div className={styles.inputGroup}>
                <label htmlFor="broadcastDate" className={styles.label}>
                  Broadcast Date
                </label>
                <input
                  id="broadcastDate"
                  type="date"
                  className={styles.input}
                  value={broadcastDate}
                  onChange={(e) => setBroadcastDate(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="broadcastTime" className={styles.label}>
                  Broadcast Time
                </label>
                <input
                  id="broadcastTime"
                  type="time"
                  className={styles.input}
                  value={broadcastTime}
                  onChange={(e) => setBroadcastTime(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </section>

          {/* Mix Details Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Mix Details</h2>
            
            <div className={styles.inputGroup}>
              <label htmlFor="genre" className={styles.label}>
                Genre
              </label>
              <GenreSelector
                value={genre}
                onChange={setGenre}
                disabled={isLoading}
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="setTitle" className={styles.label}>
                Set Title
              </label>
              <input
                id="setTitle"
                type="text"
                className={styles.input}
                value={setTitle}
                onChange={(e) => setSetTitle(e.target.value)}
                required
                placeholder="Enter mix title"
                disabled={isLoading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="description" className={styles.label}>
                Description
              </label>
              <textarea
                id="description"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter mix description"
                disabled={isLoading}
                rows={4}
              />
            </div>
          </section>

          {/* Progress bar for file upload */}
          {isLoading && (
            <div className={styles.progressContainer}>
              <div className={styles.progressInfo}>
                <span>Validating {currentFile} file...</span>
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

          <button
            type="submit"
            className={styles.nextButton}
            disabled={isLoading || !songlistFile.file}
          >
            {isLoading ? "Validating..." : "Next"}
          </button>
        </form>
      </main>
    </div>
  );
}

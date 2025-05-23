"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthContext";
import DjSelector from "../components/DjSelector";
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

export default function UploadPage() {
  const router = useRouter();
  const { user, logout, authenticatedFetch } = useAuth();
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

  // Hidden file input refs
  const audioInputRef = useRef<HTMLInputElement>(null);
  const songlistInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
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
  };

  const handleDrop = (
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
  };

  // Handle DJ selection
  const handleDjSelection = (dj: DJ | null) => {
    setSelectedDj(dj);
    console.log("DJ selected in parent component:", dj);
  };

  // Ref to prevent duplicate form submissions in StrictMode
  const isSubmitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile.file || !songlistFile.file) {
      return;
    }

    // Prevent duplicate submissions in StrictMode
    if (isSubmitting.current) {
      console.log('Preventing duplicate form submission in StrictMode');
      return;
    }
    
    isSubmitting.current = true;
    setIsLoading(true);

    try {
      // Create form data with files and metadata
      const formData = new FormData();
      formData.append("audio", audioFile.file);
      formData.append("songlist", songlistFile.file);
      if (artworkFile.file) {
        formData.append("artwork", artworkFile.file);
      }

      // Add metadata fields
      formData.append("title", setTitle);
      formData.append("broadcastDate", broadcastDate);
      formData.append("broadcastTime", broadcastTime);
      formData.append("genre", genre);
      formData.append("description", description);
      
      // Add selected DJ ID if an admin has selected one
      if (user?.role === 'Super Administrator' && selectedDj) {
        console.log("Adding selectedDjId to form data:", selectedDj.id);
        formData.append("selectedDjId", selectedDj.id);
      }

      // Send files to daemon using the new upload endpoint
      console.log("Sending files to /upload endpoint");
      const response = await authenticatedFetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      
      // Store the fileId and metadata for the validate page
      sessionStorage.setItem("uploadData", JSON.stringify({
        fileId: result.fileId,
        metadata: {
          title: setTitle,
          djName: user?.displayName,
          broadcastDate,
          broadcastTime,
          genre,
          description
        }
      }));

      router.push("/upload/validate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.uploadPage}>
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.titleColumn}>
              <h1 className={styles.title}>Upload New Mix</h1>
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
              <input
                id="genre"
                type="text"
                className={styles.input}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                required
                placeholder="Enter primary genre"
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

          <button
            type="submit"
            className={styles.nextButton}
            disabled={isLoading || !audioFile.file || !songlistFile.file}
          >
            {isLoading ? "Processing..." : "Next"}
          </button>
        </form>
      </main>
    </div>
  );
}

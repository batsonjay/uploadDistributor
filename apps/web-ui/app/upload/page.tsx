"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface FileState {
  file: File | null;
  error: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [audioFile, setAudioFile] = useState<FileState>({ file: null, error: "" });
  const [songlistFile, setSonglistFile] = useState<FileState>({ file: null, error: "" });
  const [artworkFile, setArtworkFile] = useState<FileState>({ file: null, error: "" });
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile.file || !songlistFile.file) {
      return;
    }

    setIsLoading(true);
    // TODO: Implement actual file upload logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    router.push("/upload/validate");
  };

  return (
    <div className={styles.uploadPage}>
      <main className={styles.main}>
        <h1 className={styles.title}>Upload New Mix</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Audio File Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Audio File</h2>
            <div className={styles.fileInput}>
              <label className={styles.fileInputLabel}>MP3 File (Required)</label>
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
              <label className={styles.fileInputLabel}>Songlist File (Required)</label>
              <div
                className={styles.dropzone}
                onDrop={(e) => handleDrop(e, setSonglistFile, ["txt", "rtf"])}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => songlistInputRef.current?.click()}
              >
                <input
                  ref={songlistInputRef}
                  type="file"
                  accept=".txt,.rtf"
                  onChange={(e) => handleFileChange(e, setSonglistFile, ["txt", "rtf"])}
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
              <label className={styles.fileInputLabel}>Artwork File (Optional)</label>
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

          {/* Metadata Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Metadata</h2>
            <div className={styles.inputGroup}>
              <label htmlFor="title" className={styles.label}>
                Title
              </label>
              <input
                id="title"
                type="text"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Enter mix title"
                disabled={isLoading}
              />
            </div>

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
                placeholder="Enter genre"
                disabled={isLoading}
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

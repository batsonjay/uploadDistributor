"use client";

import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import styles from "./page.module.css";

interface Song {
  title: string;
  artist: string;
}

interface ParseResult {
  songs: Song[];
  error: string;
}

export default function TestParsePage() {
  const { authenticatedFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setError("No file selected");
      return;
    }

    const fileType = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["txt", "rtf", "docx", "nml"].includes(fileType || "")) {
      setError("Invalid file type. Accepted types: txt, rtf, docx, nml");
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setIsLoading(true);
    setError("");
    setParseResult(null);

    try {
      const formData = new FormData();
      formData.append("songlist", file);

      // Send the file with authentication
      const response = await authenticatedFetch("http://localhost:3001/parse-songlist", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      setParseResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse songlist");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Test Songlist Parser</h1>
        <div className={styles.description}>
          <p>Upload a songlist file (.nml, .rtf, .docx, or .txt) to test the parser</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.fileInput}>
              <label htmlFor="songlist" className={styles.label}>
                Select Songlist File
              </label>
              <input
                id="songlist"
                type="file"
                accept=".txt,.rtf,.docx,.nml"
                onChange={handleFileChange}
                className={styles.input}
                disabled={isLoading}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.button}
              disabled={!file || isLoading}
            >
              {isLoading ? "Parsing..." : "Parse Songlist"}
            </button>

            {parseResult && (
              <div className={styles.result}>
                <h2>Parse Result</h2>
                <table className={styles.songTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Artist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.songs.map((song, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{song.title}</td>
                        <td>{song.artist}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </form>
      </main>
    </div>
  );
}

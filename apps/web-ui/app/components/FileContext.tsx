"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface FilePathsContextType {
  audioFilePath: string | null;
  artworkFilePath: string | null;
  songlistFilePath: string | null;
  setAudioFilePath: (path: string | null) => void;
  setArtworkFilePath: (path: string | null) => void;
  setSonglistFilePath: (path: string | null) => void;
  // Additional metadata for the files
  metadata: {
    title: string;
    djName: string;
    broadcastDate: string;
    broadcastTime: string;
    genre: string;
    description: string;
  };
  setMetadata: (metadata: {
    title: string;
    djName: string;
    broadcastDate: string;
    broadcastTime: string;
    genre: string;
    description: string;
  }) => void;
}

const FilePathsContext = createContext<FilePathsContextType | undefined>(undefined);

export function useFilePathsContext() {
  const context = useContext(FilePathsContext);
  if (context === undefined) {
    throw new Error("useFilePathsContext must be used within a FilePathsProvider");
  }
  return context;
}

interface FilePathsProviderProps {
  children: ReactNode;
}

export function FilePathsProvider({ children }: FilePathsProviderProps) {
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
  const [artworkFilePath, setArtworkFilePath] = useState<string | null>(null);
  const [songlistFilePath, setSonglistFilePath] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    title: "",
    djName: "",
    broadcastDate: "",
    broadcastTime: "",
    genre: "",
    description: "",
  });

  const value = {
    audioFilePath,
    artworkFilePath,
    songlistFilePath,
    setAudioFilePath,
    setArtworkFilePath,
    setSonglistFilePath,
    metadata,
    setMetadata,
  };

  return <FilePathsContext.Provider value={value}>{children}</FilePathsContext.Provider>;
}

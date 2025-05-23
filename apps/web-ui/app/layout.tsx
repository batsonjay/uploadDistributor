import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "./auth/AuthContext";
import { FilePathsProvider } from "./components/FileContext";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Upload Distributor",
  description: "Upload and distribute your mixes to multiple platforms",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <FilePathsProvider>
            {children}
          </FilePathsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

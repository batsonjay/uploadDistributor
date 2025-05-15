"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push("/upload");
      } else {
        router.push("/login");
      }
    }
  }, [user, isLoading, router]);

  // Show nothing while redirecting
  return null;
}

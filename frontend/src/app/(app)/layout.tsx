"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/hooks/useAuth";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import styles from "@/components/workspace/workspace.module.css";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isLoading, isError } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && isError) {
      router.push("/login");
    }
  }, [isLoading, isError, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="flex gap-2">
          <span className="w-3 h-3 bg-primary rounded-full animate-bounce"></span>
          <span className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
          <span className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
        </span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.shell}>
      <Navbar />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}

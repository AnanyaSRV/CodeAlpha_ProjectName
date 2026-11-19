
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import AuthGuard from "@/components/auth-guard";

export const metadata: Metadata = {
  title: "TaskFlow | Project Management",
  description:
    "A collaborative workspace to organize projects, manage tasks and work better together.",
};

function LoadingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb]">
      <div className="text-sm font-medium text-[#9694a6]">
        Loading TaskFlow...
      </div>
    </main>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<LoadingFallback />}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </body>
    </html>
  );
}

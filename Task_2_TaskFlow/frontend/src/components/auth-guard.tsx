
"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Command } from "lucide-react";
import api, { clearSession, TaskFlowUser } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import RealtimeNotifications from "@/components/realtime-notifications";

type AuthGuardProps = {
  children: ReactNode;
};

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f7f7fb]">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#a99cff] to-[#7768e5] text-white shadow-lg shadow-violet-200">
          <Command size={24} />
        </div>
        <p className="text-sm font-medium text-[#9694a6]">
          Preparing your workspace...
        </p>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-[#e9e6fa]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#8879ed]" />
        </div>
      </div>
    </div>
  );
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage =
    pathname === "/login" || pathname === "/register";

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<TaskFlowUser | null>(null);

  useEffect(() => {
    let active = true;

    async function validateSession() {
      const token = localStorage.getItem("taskflow_token");

      if (!token) {
        if (active) {
          setUser(null);
          setChecking(false);

          if (!isPublicPage) {
            router.replace("/login");
          }
        }
        return;
      }

      try {
        const response = await api.get("/auth/me");
        const authenticatedUser = response.data.user as TaskFlowUser;

        if (!authenticatedUser?.id) {
          throw new Error("Invalid session");
        }

        localStorage.setItem(
          "taskflow_user",
          JSON.stringify(authenticatedUser)
        );

        if (active) {
          setUser(authenticatedUser);
          setChecking(false);

          if (isPublicPage) {
            router.replace("/");
          }
        }
      } catch {
        clearSession();
        disconnectSocket();

        if (active) {
          setUser(null);
          setChecking(false);

          if (!isPublicPage) {
            router.replace("/login");
          }
        }
      }
    }

    setChecking(true);
    validateSession();

    return () => {
      active = false;
    };
  }, [pathname, isPublicPage, router]);

  function handleLogout() {
    clearSession();
    disconnectSocket();
    setUser(null);
    setChecking(true);
    router.replace("/login");
  }

  const shouldBlock =
    checking ||
    (!isPublicPage && !user) ||
    (isPublicPage && !!user);

  return (
    <>
      <div
        aria-hidden={shouldBlock}
        style={{
          visibility: shouldBlock ? "hidden" : "visible",
        }}
      >
        {children}
      </div>

      {shouldBlock && <LoadingScreen />}

      {!shouldBlock && user && !isPublicPage && (
        <>
          <RealtimeNotifications />

          <button
            type="button"
            onClick={handleLogout}
            title={`Sign out ${user.name}`}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-[#e8e5f3] bg-white px-4 py-3 text-xs font-bold text-[#777589] shadow-lg transition hover:-translate-y-1 hover:text-red-500"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </>
      )}
    </>
  );
}

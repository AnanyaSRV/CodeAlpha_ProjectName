
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  CircleAlert,
} from "lucide-react";
import api from "@/lib/api";

type Notification = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const router = useRouter();

  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/notifications");
      setItems(response.data.notifications || []);
    } catch {
      setError("Unable to load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openNotification(item: Notification) {
    if (openingId) return;

    setOpeningId(item.id);

    try {
      if (!item.isRead) {
        await api.patch(`/notifications/${item.id}/read`);

        setItems((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, isRead: true }
              : notification
          )
        );
      }

      const destination = item.link;

      if (
        destination &&
        destination.startsWith("/") &&
        !destination.startsWith("//")
      ) {
        router.push(destination);
      } else {
        setError(
          "This notification does not have a valid destination."
        );
      }
    } catch {
      setError("Unable to open this notification. Please try again.");
    } finally {
      setOpeningId(null);
    }
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);

      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isRead: true } : item
        )
      );
    } catch {
      setError("Unable to update this notification.");
    }
  }

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all");

      setItems((current) =>
        current.map((item) => ({ ...item, isRead: true }))
      );
    } catch {
      setError("Unable to mark all notifications as read.");
    }
  }

  const unread = items.filter((item) => !item.isRead).length;

  function getNotificationLabel(type?: string) {
    switch (type) {
      case "TASK_ASSIGNED":
        return "Task assigned";
      case "TASK_UPDATED":
        return "Task updated";
      case "COMMENT_ADDED":
        return "New comment";
      case "PROJECT_INVITATION":
        return "Project invitation";
      case "DEADLINE_REMINDER":
        return "Deadline reminder";
      case "MENTION":
        return "You were mentioned";
      default:
        return "Workspace update";
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-5 py-8 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.push("/")}
          className="mb-7 flex items-center gap-2 text-xs font-semibold text-[#9694a6] transition hover:text-[#7969df]"
        >
          <ArrowLeft size={15} />
          Back to dashboard
        </button>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[1.4px] text-[#8879ed]">
              <Bell size={14} />
              ACTIVITY CENTRE
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-[#29263e]">
              Notifications<span className="text-[#8879ed]">.</span>
            </h1>

            <p className="mt-2 text-xs text-[#9694a6]">
              Stay up to date with your team's activity.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              title="Refresh notifications"
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#eae9f0] bg-white text-[#9694a6] transition hover:text-[#8879ed]"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
            </button>

            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#8879ed] px-4 text-[10px] font-bold text-white transition hover:bg-[#7565dc] disabled:opacity-40"
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          </div>
        </div>

        <div className="mb-5 flex gap-3">
          <div className="rounded-xl border border-[#eeedf3] bg-white px-5 py-4">
            <p className="text-[10px] text-[#9694a6]">
              Total notifications
            </p>
            <strong className="mt-1 block text-2xl text-[#39374d]">
              {items.length}
            </strong>
          </div>

          <div className="rounded-xl border border-[#eeedf3] bg-white px-5 py-4">
            <p className="text-[10px] text-[#9694a6]">Unread</p>
            <strong className="mt-1 block text-2xl text-[#8879ed]">
              {unread}
            </strong>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
            <CircleAlert size={16} />
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#eeedf3] bg-white">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-xs text-[#9694a6]">
              <Loader2
                size={20}
                className="animate-spin text-[#8879ed]"
              />
              Loading notifications...
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <Bell size={30} className="mb-3 text-[#c4c1d0]" />

              <p className="text-sm font-bold text-[#514e64]">
                No notifications yet
              </p>

              <p className="mt-2 text-xs text-[#a09eae]">
                Project updates and team activity will appear here.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isOpening = openingId === item.id;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNotification(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openNotification(item);
                    }
                  }}
                  className={`group flex cursor-pointer items-start gap-4 border-b border-[#f1f0f5] p-5 text-left transition hover:bg-[#f2efff] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#8879ed] ${
                    item.isRead ? "bg-white" : "bg-[#f8f6ff]"
                  }`}
                >
                  <span
                    className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#8879ed]"
                    style={{ opacity: item.isRead ? 0.2 : 1 }}
                  />

                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#8879ed]">
                    <FolderOpen size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-extrabold text-[#514e64]">
                        {item.title || getNotificationLabel(item.type)}
                      </h3>

                      {!item.isRead && (
                        <span className="rounded-full bg-[#eeeaff] px-2 py-1 text-[8px] font-bold text-[#8879ed]">
                          NEW
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-[#9694a6]">
                      {item.message || "You have a new notification."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="text-[9px] text-[#aaa8b6]">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>

                      <span className="flex items-center gap-1 text-[9px] font-bold text-[#8879ed]">
                        {isOpening ? (
                          <>
                            <Loader2
                              size={11}
                              className="animate-spin"
                            />
                            Opening...
                          </>
                        ) : (
                          <>
                            Open notification
                            <ExternalLink size={11} />
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {!item.isRead && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        markRead(item.id);
                      }}
                      title="Mark as read"
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-[#e9e5ff] px-3 py-2 text-[9px] font-bold text-[#8879ed] transition hover:bg-white"
                    >
                      <Check size={12} />
                      Read
                    </button>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

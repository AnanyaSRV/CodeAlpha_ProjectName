
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X } from "lucide-react";
import api from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  content?: string;
  type?: string;
  isRead?: boolean;
  read?: boolean;
  createdAt?: string;
};

export default function RealtimeNotifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const response = await api.get("/notifications");
        if (!active) return;

        const data = response.data;
        const items = data.notifications || [];

        setNotifications(items);
        setUnread(
          typeof data.unreadCount === "number"
            ? data.unreadCount
            : items.filter(
                (item: NotificationItem) =>
                  !(item.isRead ?? item.read)
              ).length
        );
      } catch {
        // Notification loading should not block the rest of the app.
      }
    }

    const socket = connectSocket();

    loadNotifications();

    if (socket) {
      socket.on("notification", (notification: NotificationItem) => {
        if (!active) return;

        setNotifications((current) => [
          notification,
          ...current,
        ].slice(0, 30));

        setUnread((current) => current + 1);
        setToast(
          notification.message ||
            notification.title ||
            "You have a new notification."
        );

        loadNotifications();
      });

      socket.on("connect", () => {
        api.get("/projects")
          .then((response) => {
            const projects = response.data.projects || [];

            projects.forEach((project: { id: string }) => {
              socket.emit("project:join", {
                projectId: project.id,
              });
            });
          })
          .catch(() => {
            // Project rooms can be joined when the project list is available.
          });
      });

      const refreshEvents = [
        "task-created",
        "task-updated",
        "task-deleted",
        "comment-created",
        "project:member-added",
        "project:member-removed",
      ];

      refreshEvents.forEach((eventName) => {
        socket.on(eventName, (payload: unknown) => {
          window.dispatchEvent(
            new CustomEvent("taskflow:realtime-update", {
              detail: { eventName, payload },
            })
          );
        });
      });
    }

    return () => {
      active = false;

      if (socket) {
        socket.off("notification");
        socket.off("connect");

        [
          "task-created",
          "task-updated",
          "task-deleted",
          "comment-created",
          "project:member-added",
          "project:member-removed",
        ].forEach((eventName) => socket.off(eventName));
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(""), 4500);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all");

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          read: true,
        }))
      );

      setUnread(0);
    } catch {
      setToast("Unable to update notifications.");
    }
  }

  async function markRead(item: NotificationItem) {
    if (item.isRead || item.read) return;

    try {
      await api.patch(`/notifications/${item.id}/read`);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, isRead: true, read: true }
            : notification
        )
      );

      setUnread((current) => Math.max(0, current - 1));
    } catch {
      setToast("Unable to mark notification as read.");
    }
  }

  return (
    <>
      <div className="fixed right-5 top-[78px] z-40">
        <button
          onClick={() => setOpen(!open)}
          aria-label="Open notifications"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-[#e8e5f3] bg-white text-[#777589] shadow-lg transition hover:-translate-y-0.5 hover:text-[#8879ed]"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ed817f] px-1 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-14 w-[min(360px,calc(100vw-35px))] overflow-hidden rounded-2xl border border-[#eeedf3] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eeedf3] p-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#39374d]">
                  Notifications
                </h3>
                <p className="mt-1 text-[10px] text-[#a09eae]">
                  {unread} unread
                </p>
              </div>

              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] font-bold text-[#8879ed]"
              >
                <Check size={13} /> Mark all read
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-9 text-center">
                  <Bell size={25} className="mx-auto mb-3 text-[#c4c1d0]" />
                  <p className="text-xs font-bold text-[#777589]">
                    You're all caught up
                  </p>
                  <p className="mt-1 text-[10px] text-[#aaa8b6]">
                    New updates will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((item) => {
                  const isRead = item.isRead ?? item.read ?? false;

                  return (
                    <button
                      key={item.id}
                      onClick={() => markRead(item)}
                      className={`flex w-full gap-3 border-b border-[#f1f0f5] p-4 text-left transition hover:bg-[#faf9fd] ${
                        isRead ? "bg-white" : "bg-[#f7f5ff]"
                      }`}
                    >
                      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#8879ed]" style={{ opacity: isRead ? 0.15 : 1 }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-[#514e64]">
                          {item.title || item.type || "Workspace update"}
                        </span>
                        <span className="mt-1 block text-[10px] leading-5 text-[#9694a6]">
                          {item.message || item.content || "You have a new update."}
                        </span>
                        {item.createdAt && (
                          <span className="mt-1 block text-[9px] text-[#b0aebb]">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="w-full border-t border-[#eeedf3] p-3 text-center text-[10px] font-bold text-[#8879ed] hover:bg-[#faf9fd]"
            >
              View all notifications
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed right-5 top-24 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-[#e9e5ff] bg-white p-4 shadow-xl">
          <Bell size={17} className="mt-0.5 flex-shrink-0 text-[#8879ed]" />
          <p className="flex-1 text-xs leading-5 text-[#514e64]">{toast}</p>
          <button onClick={() => setToast("")} aria-label="Dismiss notification">
            <X size={15} className="text-[#aaa8b6]" />
          </button>
        </div>
      )}
    </>
  );
}


"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Command,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  Users,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import api, { clearSession } from "@/lib/api";

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  owner?: User;
  members?: { id: string; role: string; user: User }[];
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  createdAt: string;
  updatedAt?: string;
  projectId: string;
  assigneeId?: string | null;
  creatorId: string;
  assignee?: User | null;
  creator?: User;
  project?: {
    id: string;
    name: string;
    color?: string;
  };
};

type Notification = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
};

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; background: string }
> = {
  TODO: {
    label: "To do",
    color: "#9994aa",
    background: "#f1f0f5",
  },
  IN_PROGRESS: {
    label: "In progress",
    color: "#8879ed",
    background: "#f0edff",
  },
  IN_REVIEW: {
    label: "In review",
    color: "#d99550",
    background: "#fff4e8",
  },
  DONE: {
    label: "Completed",
    color: "#58a68d",
    background: "#eaf7f1",
  },
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-emerald-50 text-emerald-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-rose-50 text-rose-700",
  URGENT: "bg-red-100 text-red-700",
};

const CHART_COLORS = ["#8879ed", "#63a99b", "#e6a46d", "#b8b3ca"];

function initials(name?: string) {
  if (!name) return "?";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relativeTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const difference = Date.now() - date.getTime();
  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days} days ago`;

  return formatDate(value);
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "DONE") return false;

  const due = new Date(task.dueDate);
  const today = new Date();

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return due < today;
}

function Avatar({
  user,
  size = "normal",
}: {
  user?: User | null;
  size?: "normal" | "small";
}) {
  return (
    <div
      title={user?.name || "Team member"}
      className={`grid flex-shrink-0 place-items-center rounded-full bg-[#eeeaff] font-extrabold text-[#7868df] ${
        size === "small" ? "h-7 w-7 text-[8px]" : "h-10 w-10 text-[10px]"
      }`}
    >
      {initials(user?.name)}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const circumference = 264;

  return (
    <div className="relative mx-auto grid h-44 w-44 place-items-center">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#efedf5"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#8879ed"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>

      <div className="absolute text-center">
        <strong className="block text-3xl font-extrabold text-[#39374d]">
          {value}%
        </strong>
        <span className="text-[10px] text-[#a09eae]">completed</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("MEDIUM");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadDashboard = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    setError("");

    try {
      const [userResponse, projectResponse, myTaskResponse, notificationResponse] =
        await Promise.all([
          api.get("/auth/me"),
          api.get("/projects"),
          api.get("/tasks/my-tasks"),
          api.get("/notifications"),
        ]);

      const currentUser =
        userResponse.data.user || userResponse.data;

      const projectList: Project[] =
        projectResponse.data.projects || [];

      const assignedTasks: Task[] =
        myTaskResponse.data.tasks || [];

      const notificationList: Notification[] =
        notificationResponse.data.notifications || [];

      setUser(currentUser);
      setProjects(projectList);
      setMyTasks(assignedTasks);
      setNotifications(notificationList);
      setUnreadCount(
        notificationResponse.data.unreadCount ??
          notificationList.filter((item) => !item.isRead).length
      );

      setNewProject((current) =>
        current || projectList[0]?.id || ""
      );

      // Fetch tasks for every project to calculate real workspace statistics.
      const taskResponses = await Promise.all(
        projectList.map(async (project) => {
          try {
            const response = await api.get(
              `/tasks/project/${project.id}`
            );

            return response.data.tasks || [];
          } catch {
            return [];
          }
        })
      );

      const combinedTasks = taskResponses.flat() as Task[];

      // Include the logged-in user's assigned tasks if any are missing.
      const taskMap = new Map<string, Task>();

      [...combinedTasks, ...assignedTasks].forEach((task) => {
        taskMap.set(task.id, task);
      });

      setAllTasks(Array.from(taskMap.values()));
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err
          ? (
              err as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;

      setError(
        message ||
          (err instanceof Error
            ? err.message
            : "Unable to load your dashboard.")
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const completedCount = allTasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const inProgressCount = allTasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  const todoCount = allTasks.filter(
    (task) => task.status === "TODO"
  ).length;

  const reviewCount = allTasks.filter(
    (task) => task.status === "IN_REVIEW"
  ).length;

  const overdueCount = allTasks.filter(isOverdue).length;

  const completionPercentage =
    allTasks.length > 0
      ? Math.round((completedCount / allTasks.length) * 100)
      : 0;

  const chartData = [
    { name: "Completed", value: completedCount },
    { name: "In progress", value: inProgressCount },
    { name: "In review", value: reviewCount },
    { name: "To do", value: todoCount },
  ].filter((item) => item.value > 0);

  const visibleTasks = useMemo(() => {
    return myTasks
      .filter((task) => {
        const query = search.toLowerCase();

        const matchesSearch =
          task.title.toLowerCase().includes(query) ||
          (task.project?.name || "").toLowerCase().includes(query);

        const matchesFilter =
          filter === "All" ||
          (filter === "In progress" &&
            task.status === "IN_PROGRESS") ||
          (filter === "To do" && task.status === "TODO") ||
          (filter === "Completed" && task.status === "DONE") ||
          (filter === "Overdue" && isOverdue(task));

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const aDate = a.dueDate
          ? new Date(a.dueDate).getTime()
          : Infinity;
        const bDate = b.dueDate
          ? new Date(b.dueDate).getTime()
          : Infinity;

        return aDate - bDate;
      });
  }, [myTasks, search, filter]);

  const recentTasks = useMemo(() => {
    return [...allTasks]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      )
      .slice(0, 5);
  }, [allTasks]);

  const upcomingTasks = useMemo(() => {
    return [...myTasks]
      .filter(
        (task) =>
          task.dueDate &&
          task.status !== "DONE" &&
          !isOverdue(task)
      )
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() -
          new Date(b.dueDate!).getTime()
      )
      .slice(0, 4);
  }, [myTasks]);

  function openTask(task: Task) {
    router.push(
      `/projects/${task.projectId}?taskId=${encodeURIComponent(task.id)}`
    );
  }

  function openNotification(notification: Notification) {
    setShowNotifications(false);

    if (
      notification.link &&
      notification.link.startsWith("/") &&
      !notification.link.startsWith("//")
    ) {
      router.push(notification.link);
    } else {
      router.push("/notifications");
    }
  }

  async function changeTaskStatus(task: Task) {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      TODO: "IN_PROGRESS",
      IN_PROGRESS: "DONE",
      IN_REVIEW: "DONE",
      DONE: "TODO",
    };

    const previous = task.status;
    const status = nextStatus[previous];

    setMyTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status } : item
      )
    );

    setAllTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status } : item
      )
    );

    try {
      await api.patch(`/tasks/${task.id}`, { status });
    } catch {
      setError("Unable to update the task status.");

      setMyTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previous } : item
        )
      );

      setAllTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previous } : item
        )
      );
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newTitle.trim().length < 2) {
      setCreateError("Task title must contain at least 2 characters.");
      return;
    }

    if (!newProject) {
      setCreateError("Create or select a project first.");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      await api.post("/tasks", {
        projectId: newProject,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        dueDate: newDueDate
          ? new Date(`${newDueDate}T12:00:00`).toISOString()
          : undefined,
      });

      setShowTaskModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("MEDIUM");
      setNewDueDate("");

      await loadDashboard(false);
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err
          ? (
              err as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;

      setCreateError(message || "Unable to create the task.");
    } finally {
      setCreating(false);
    }
  }

  async function markNotificationRead(notification: Notification) {
    try {
      if (!notification.isRead) {
        await api.patch(
          `/notifications/${notification.id}/read`
        );

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, isRead: true }
              : item
          )
        );

        setUnreadCount((current) => Math.max(0, current - 1));
      }

      openNotification(notification);
    } catch {
      setError("Unable to open this notification.");
    }
  }

  function logout() {
    clearSession();
    router.push("/login");
  }

  const today = new Date();

  const greeting =
    today.getHours() < 12
      ? "Good morning"
      : today.getHours() < 17
        ? "Good afternoon"
        : "Good evening";

  const dateLabel = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb]">
        <div className="flex flex-col items-center gap-3 text-[#9694a6]">
          <Loader2
            size={30}
            className="animate-spin text-[#8879ed]"
          />
          <p className="text-xs font-medium">
            Preparing your workspace...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] text-[#39374d]">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[255px] flex-col border-r border-[#eeedf3] bg-white px-5 py-6 transition-transform lg:static lg:translate-x-0 ${
            mobileMenu ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-9 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#a294ff] to-[#7666df] text-white shadow-lg shadow-violet-200">
              <Command size={21} strokeWidth={2.5} />
            </div>

            <span className="text-xl font-extrabold tracking-tight text-[#302e43]">
              taskflow<span className="text-[#8879ed]">.</span>
            </span>

            <button
              onClick={() => setMobileMenu(false)}
              className="ml-auto rounded-lg p-2 text-[#9997a8] lg:hidden"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mb-8 flex items-center gap-3 rounded-xl border border-[#eeedf3] bg-[#faf9fd] p-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#eeeaff] text-sm font-extrabold text-[#7868df]">
              {initials(user?.name)}
            </div>

            <div className="min-w-0 flex-1">
              <strong className="block truncate text-xs text-[#514e64]">
                {user?.name || "My workspace"}
              </strong>
              <span className="text-[10px] text-[#aaa8b6]">
                Personal workspace
              </span>
            </div>
          </div>

          <p className="mb-3 px-2 text-[9px] font-extrabold tracking-[1.5px] text-[#aaa8b6]">
            WORKSPACE
          </p>

          <nav className="space-y-1">
            <button className="flex w-full items-center gap-3 rounded-lg bg-[#f0edff] px-3 py-3 text-left text-xs font-bold text-[#7969df]">
              <LayoutDashboard size={17} />
              Overview
            </button>

            <button
              onClick={() => router.push("/projects")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-semibold text-[#88869a] transition hover:bg-[#f8f7fc] hover:text-[#7969df]"
            >
              <FolderKanban size={17} />
              Projects
              <span className="ml-auto text-[10px]">
                {projects.length}
              </span>
            </button>

            <button
              onClick={() => router.push("/notifications")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-semibold text-[#88869a] transition hover:bg-[#f8f7fc] hover:text-[#7969df]"
            >
              <Bell size={17} />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-[#8879ed] px-2 py-0.5 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setFilter("All");
                document
                  .getElementById("my-tasks")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-semibold text-[#88869a] transition hover:bg-[#f8f7fc] hover:text-[#7969df]"
            >
              <ListTodo size={17} />
              My tasks
            </button>
          </nav>

          <p className="mb-3 mt-9 px-2 text-[9px] font-extrabold tracking-[1.5px] text-[#aaa8b6]">
            YOUR PROJECTS
          </p>

          <div className="space-y-1 overflow-y-auto">
            {projects.slice(0, 8).map((project) => (
              <button
                key={project.id}
                onClick={() =>
                  router.push(`/projects/${project.id}`)
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] font-medium text-[#88869a] hover:bg-[#f8f7fc] hover:text-[#7969df]"
              >
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{
                    background: project.color || "#8879ed",
                  }}
                />
                <span className="truncate">{project.name}</span>
              </button>
            ))}

            {projects.length === 0 && (
              <p className="px-3 py-2 text-[10px] text-[#aaa8b6]">
                No projects yet.
              </p>
            )}
          </div>

          <div className="mt-auto pt-6">
            <div className="mb-5 rounded-xl bg-gradient-to-br from-[#f2efff] to-[#f9f7ff] p-4">
              <Sparkles size={18} className="mb-3 text-[#8879ed]" />
              <strong className="text-xs text-[#514e64]">
                Make room for big ideas.
              </strong>
              <p className="mt-1 text-[10px] leading-5 text-[#9694a6]">
                Keep your team's work moving forward.
              </p>
            </div>

            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-semibold text-[#9997a8] transition hover:bg-red-50 hover:text-red-500"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#eeedf3] bg-white/90 px-5 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenu(true)}
                className="rounded-lg p-2 text-[#777589] lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>

              <div className="flex items-center gap-2 text-xs text-[#aaa8b6]">
                <span>Workspace</span>
                <span>/</span>
                <strong className="text-[#514e64]">Overview</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden h-10 items-center gap-2 rounded-lg border border-[#eeedf3] bg-[#faf9fd] px-3 sm:flex">
                <Search size={15} className="text-[#aaa8b6]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search your tasks..."
                  className="w-44 bg-transparent text-[11px] outline-none placeholder:text-[#aaa8b6]"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative grid h-10 w-10 place-items-center rounded-lg border border-[#eeedf3] text-[#777589] transition hover:bg-[#f8f7fc]"
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#ed7d94]" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-12 z-50 w-[320px] overflow-hidden rounded-xl border border-[#eeedf3] bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-[#f1f0f5] p-4">
                      <strong className="text-xs text-[#514e64]">
                        Notifications
                      </strong>
                      <span className="text-[10px] text-[#8879ed]">
                        {unreadCount} unread
                      </span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notifications.slice(0, 6).map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() =>
                            markNotificationRead(notification)
                          }
                          className={`block w-full border-b border-[#f3f2f6] p-4 text-left transition hover:bg-[#f8f6ff] ${
                            notification.isRead ? "bg-white" : "bg-[#faf9ff]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                                notification.isRead
                                  ? "bg-[#e5e2ed]"
                                  : "bg-[#8879ed]"
                              }`}
                            />
                            <div className="min-w-0">
                              <strong className="text-[11px] text-[#514e64]">
                                {notification.title}
                              </strong>
                              <p className="mt-1 text-[10px] leading-4 text-[#9997a8]">
                                {notification.message}
                              </p>
                              <span className="mt-2 block text-[9px] text-[#b0adba]">
                                {relativeTime(notification.createdAt)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}

                      {notifications.length === 0 && (
                        <p className="p-7 text-center text-xs text-[#aaa8b6]">
                          No notifications yet.
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => router.push("/notifications")}
                      className="w-full p-3 text-center text-[10px] font-bold text-[#8879ed] hover:bg-[#f8f6ff]"
                    >
                      View all notifications
                    </button>
                  </div>
                )}
              </div>

              <Avatar user={user} />
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
            {/* WELCOME */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex flex-wrap items-center justify-between gap-5"
            >
              <div>
                <div className="mb-3 flex items-center gap-2 text-[9px] font-extrabold tracking-[1.5px] text-[#8879ed]">
                  <span className="h-px w-6 bg-[#8879ed]" />
                  {dateLabel.toUpperCase()}
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-[#302e43] sm:text-3xl">
                  {greeting}, {user?.name?.split(" ")[0] || "there"}
                  <span className="text-[#8879ed]">.</span>
                </h1>

                <p className="mt-2 text-xs text-[#9997a8]">
                  Here's what's happening across your workspace today.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRefreshing(true);
                    loadDashboard(false);
                  }}
                  disabled={refreshing}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-[#eae9f0] bg-white text-[#9694a6] hover:text-[#8879ed]"
                  title="Refresh dashboard"
                >
                  <RefreshCw
                    size={15}
                    className={refreshing ? "animate-spin" : ""}
                  />
                </button>

                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[#9384f4] to-[#7868df] px-4 text-xs font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5"
                >
                  <Plus size={16} />
                  Create new task
                </button>
              </div>
            </motion.div>

            {error && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
                <span className="flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </span>
                <button
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* STATISTICS */}
            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total tasks",
                  value: allTasks.length,
                  subtitle: "Across your projects",
                  icon: ListTodo,
                  color: "#8879ed",
                  background: "#f0edff",
                },
                {
                  label: "In progress",
                  value: inProgressCount,
                  subtitle: "Currently being worked on",
                  icon: Activity,
                  color: "#5b9dc9",
                  background: "#edf6fc",
                },
                {
                  label: "Completed",
                  value: completedCount,
                  subtitle: "Successfully completed",
                  icon: CheckCircle2,
                  color: "#58a68d",
                  background: "#eaf7f1",
                },
                {
                  label: "Overdue",
                  value: overdueCount,
                  subtitle: "Needs your attention",
                  icon: Clock3,
                  color: "#d99550",
                  background: "#fff4e8",
                },
              ].map((stat, index) => {
                const Icon = stat.icon;

                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    whileHover={{ y: -3 }}
                    className="rounded-xl border border-[#eeedf3] bg-white p-5 shadow-[0_3px_15px_rgba(35,30,60,0.025)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-[#9997a8]">
                        {stat.label}
                      </span>

                      <span
                        className="grid h-9 w-9 place-items-center rounded-lg"
                        style={{
                          color: stat.color,
                          background: stat.background,
                        }}
                      >
                        <Icon size={17} />
                      </span>
                    </div>

                    <strong className="mt-4 block text-3xl font-extrabold tracking-tight text-[#39374d]">
                      {stat.value}
                    </strong>

                    <p className="mt-2 text-[10px] text-[#aaa8b6]">
                      {stat.subtitle}
                    </p>
                  </motion.div>
                );
              })}
            </section>

            {/* SMART INSIGHTS */}
            <section className="mb-6 overflow-hidden rounded-xl border border-[#e8e3fb] bg-gradient-to-br from-[#f8f6ff] via-white to-[#f1efff] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ece7ff] text-[#8879ed]">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-[#39374d]">
                    Smart Insights
                  </h2>
                  <p className="mt-1 text-[10px] text-[#9694a6]">
                    Automatically generated from your live task data
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-[#f0deda] bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#c87878]">
                    <AlertCircle size={14} />
                    Attention
                  </div>
                  <p className="text-xs leading-5 text-[#69667c]">
                    {overdueCount > 0
                      ? `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} need attention. Review deadlines and reassign work if necessary.`
                      : "No overdue tasks detected. Keep your project deadlines on track."}
                  </p>
                </div>

                <div className="rounded-lg border border-[#e0eafa] bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#6797c5]">
                    <Activity size={14} />
                    Momentum
                  </div>
                  <p className="text-xs leading-5 text-[#69667c]">
                    {inProgressCount > 0
                      ? `${inProgressCount} task${inProgressCount === 1 ? "" : "s"} currently in progress. Check for blockers and help keep work moving.`
                      : "No tasks are currently in progress. Consider starting the next priority task."}
                  </p>
                </div>

                <div className="rounded-lg border border-[#e1eee5] bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#65a18a]">
                    <CheckCircle2 size={14} />
                    Progress
                  </div>
                  <p className="text-xs leading-5 text-[#69667c]">
                    {allTasks.length > 0
                      ? `${completedCount} of ${allTasks.length} tasks completed (${Math.round((completedCount / allTasks.length) * 100)}%). ${completedCount === allTasks.length ? "All tasks are complete!" : "Keep completing tasks to improve overall progress."}`
                      : "Create your first tasks to start tracking project progress."}
                  </p>
                </div>
              </div>
            </section>
            {/* FOCUS NEXT */}
            {(() => {
              const priorityRank: Record<Priority, number> = {
                URGENT: 0,
                HIGH: 1,
                MEDIUM: 2,
                LOW: 3,
              };

              const focusTask = allTasks
                .filter((task) => task.status !== "DONE")
                .sort((a, b) => {
                  const overdueDifference =
                    Number(isOverdue(b)) - Number(isOverdue(a));

                  if (overdueDifference !== 0) return overdueDifference;

                  const priorityDifference =
                    priorityRank[a.priority] - priorityRank[b.priority];

                  if (priorityDifference !== 0) return priorityDifference;

                  const aDate = a.dueDate
                    ? new Date(a.dueDate).getTime()
                    : Infinity;
                  const bDate = b.dueDate
                    ? new Date(b.dueDate).getTime()
                    : Infinity;

                  return aDate - bDate;
                })[0];

              return (
                <section className="mb-6 overflow-hidden rounded-xl border border-[#e7e2fb] bg-gradient-to-r from-[#f7f4ff] via-white to-[#f1f4ff] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-[#ebe6ff] text-[#7868df]">
                        <Target size={19} />
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#8879ed]">
                          FOCUS NEXT
                        </span>
                        <h2 className="mt-1 text-sm font-extrabold text-[#39374d]">
                          Your next priority
                        </h2>
                        <p className="mt-1 text-[10px] text-[#aaa8b6]">
                          Based on urgency, priority, and deadline
                        </p>
                      </div>
                    </div>

                    {focusTask ? (
                      <button
                        onClick={() => openTask(focusTask)}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#9384f4] to-[#7868df] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5"
                      >
                        Open task <span>â†—</span>
                      </button>
                    ) : null}
                  </div>

                  {focusTask ? (
                    <div className="mt-5 rounded-xl border border-[#eeedf3] bg-white/90 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-[9px] font-bold ${
                            isOverdue(focusTask)
                              ? "bg-[#fff0ed] text-[#d16f65]"
                              : focusTask.priority === "URGENT"
                                ? "bg-[#fff0ed] text-[#d16f65]"
                                : focusTask.priority === "HIGH"
                                  ? "bg-[#fff4e8] text-[#d99550]"
                                  : "bg-[#f0edff] text-[#8879ed]"
                          }`}
                        >
                          {isOverdue(focusTask)
                            ? "OVERDUE"
                            : `${focusTask.priority} PRIORITY`}
                        </span>

                        {focusTask.dueDate ? (
                          <span className="text-[9px] text-[#aaa8b6]">
                            Due {formatDate(focusTask.dueDate)}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-3 text-base font-extrabold text-[#514e64]">
                        {focusTask.title}
                      </h3>

                      <p className="mt-1 text-[10px] text-[#aaa8b6]">
                        {focusTask.project?.name || "Project"}
                      </p>

                      <p className="mt-3 text-xs leading-5 text-[#777589]">
                        {isOverdue(focusTask)
                          ? "This task is past its deadline. Prioritize completing it or updating its deadline."
                          : focusTask.priority === "URGENT"
                            ? "This task has urgent priority. Focus on completing it before moving to lower-priority work."
                            : focusTask.priority === "HIGH"
                              ? "This task has high priority. Try to make progress on it next."
                              : "This is your recommended next task based on its priority and deadline."}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-[#e1eee5] bg-white/90 p-4">
                      <p className="text-xs font-bold text-[#65a18a]">
                        You're all caught up!
                      </p>
                      <p className="mt-1 text-[10px] text-[#aaa8b6]">
                        No unfinished tasks found. Create a new task when you're ready.
                      </p>
                    </div>
                  )}
                </section>
              );
            })()}
            {/* CHART AND COMPLETION */}
            <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-xl border border-[#eeedf3] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#39374d]">
                      Task distribution
                    </h2>
                    <p className="mt-1 text-[10px] text-[#aaa8b6]">
                      Current status of tasks across your projects
                    </p>
                  </div>

                  <span className="rounded-lg bg-[#f5f3ff] px-3 py-2 text-[9px] font-bold text-[#8879ed]">
                    LIVE DATA
                  </span>
                </div>

                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_1fr]">
                  <div className="h-[220px] min-w-0">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={57}
                            outerRadius={84}
                            paddingAngle={4}
                            stroke="none"
                          >
                            {chartData.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid #eeeef4",
                              fontSize: 11,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <FolderKanban
                          size={30}
                          className="mb-2 text-[#c7c2d6]"
                        />
                        <p className="text-[10px] text-[#aaa8b6]">
                          No task data available yet.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-5">
                    {[
                      {
                        label: "Completed",
                        value: completedCount,
                        color: "#8879ed",
                      },
                      {
                        label: "In progress",
                        value: inProgressCount,
                        color: "#63a99b",
                      },
                      {
                        label: "In review",
                        value: reviewCount,
                        color: "#e6a46d",
                      },
                      {
                        label: "To do",
                        value: todoCount,
                        color: "#b8b3ca",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: item.color }}
                          />
                          <span className="text-[10px] text-[#88869a]">
                            {item.label}
                          </span>
                        </div>

                        <strong className="text-xs text-[#514e64]">
                          {item.value}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#eeedf3] bg-white p-5 sm:p-6">
                <div className="mb-3">
                  <h2 className="text-sm font-extrabold text-[#39374d]">
                    Overall completion
                  </h2>
                  <p className="mt-1 text-[10px] text-[#aaa8b6]">
                    Based on actual project tasks
                  </p>
                </div>

                <ProgressRing value={completionPercentage} />

                <p className="mt-2 text-center text-xs font-bold text-[#514e64]">
                  {allTasks.length === 0
                    ? "Your workspace is ready!"
                    : completionPercentage === 100
                      ? "All tasks completed!"
                      : "Keep the momentum going!"}
                </p>

                <p className="mt-2 text-center text-[10px] text-[#aaa8b6]">
                  {completedCount} of {allTasks.length} tasks completed
                </p>
              </div>
            </section>

            {/* MY TASKS AND PROJECTS */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
              <div
                id="my-tasks"
                className="overflow-hidden rounded-xl border border-[#eeedf3] bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#39374d]">
                      My tasks
                    </h2>
                    <p className="mt-1 text-[10px] text-[#aaa8b6]">
                      Tasks assigned to you
                    </p>
                  </div>

                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#f0edff] px-3 py-2 text-[10px] font-bold text-[#8879ed] hover:bg-[#e8e3ff]"
                  >
                    <Plus size={14} />
                    Add task
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-[#f1f0f5] px-5 pb-4 sm:px-6">
                  {[
                    "All",
                    "In progress",
                    "To do",
                    "Completed",
                    "Overdue",
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-lg px-3 py-2 text-[9px] font-bold transition ${
                        filter === item
                          ? "bg-[#8879ed] text-white"
                          : "bg-[#f7f6fa] text-[#9997a8] hover:bg-[#efedfa]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="divide-y divide-[#f2f1f6]">
                  {visibleTasks.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
                      <ListTodo
                        size={28}
                        className="mb-3 text-[#c5c1d2]"
                      />
                      <p className="text-xs font-bold text-[#666378]">
                        {myTasks.length === 0
                          ? "No tasks assigned to you yet"
                          : "No tasks match this filter"}
                      </p>
                      <p className="mt-2 text-[10px] text-[#aaa8b6]">
                        Tasks assigned to your account will appear here.
                      </p>
                    </div>
                  ) : (
                    visibleTasks.slice(0, 8).map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#faf9fd] sm:px-6"
                      >
                        <button
                          onClick={() => changeTaskStatus(task)}
                          title="Change task status"
                          className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border transition ${
                            task.status === "DONE"
                              ? "border-[#63a99b] bg-[#63a99b] text-white"
                              : "border-[#d8d5e3] text-transparent hover:border-[#8879ed]"
                          }`}
                        >
                          {task.status === "DONE" && <Check size={12} />}
                        </button>

                        <button
                          onClick={() => openTask(task)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <strong
                            className={`block truncate text-[11px] font-bold ${
                              task.status === "DONE"
                                ? "text-[#aaa8b6] line-through"
                                : "text-[#514e64]"
                            }`}
                          >
                            {task.title}
                          </strong>

                          <span className="mt-1 block truncate text-[9px] text-[#aaa8b6]">
                            {task.project?.name || "Project"}
                          </span>
                        </button>

                        <span
                          className={`hidden rounded-md px-2 py-1 text-[8px] font-bold sm:inline-block ${
                            PRIORITY_STYLES[task.priority]
                          }`}
                        >
                          {task.priority}
                        </span>

                        <span
                          className={`hidden min-w-[75px] text-right text-[9px] sm:block ${
                            isOverdue(task)
                              ? "font-bold text-red-500"
                              : "text-[#aaa8b6]"
                          }`}
                        >
                          {isOverdue(task)
                            ? "Overdue"
                            : formatDate(task.dueDate)}
                        </span>

                        <button
                          onClick={() => openTask(task)}
                          aria-label="Open task"
                          className="rounded-lg p-2 text-[#c1becd] opacity-0 transition hover:bg-[#f0edff] hover:text-[#8879ed] group-hover:opacity-100"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {myTasks.length > 8 && (
                  <div className="border-t border-[#f1f0f5] p-4 text-center">
                    <button
                      onClick={() => router.push("/projects")}
                      className="text-[10px] font-bold text-[#8879ed]"
                    >
                      Browse project tasks
                      <ArrowRight size={12} className="ml-1 inline" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {/* PROJECTS */}
                <div className="rounded-xl border border-[#eeedf3] bg-white p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-extrabold text-[#39374d]">
                        Your projects
                      </h2>
                      <p className="mt-1 text-[10px] text-[#aaa8b6]">
                        {projects.length} collaborative projects
                      </p>
                    </div>

                    <button
                      onClick={() => router.push("/projects")}
                      className="rounded-lg p-2 text-[#8879ed] hover:bg-[#f5f3ff]"
                      aria-label="View all projects"
                    >
                      <ArrowRight size={17} />
                    </button>
                  </div>

                  {projects.length === 0 ? (
                    <div className="py-8 text-center">
                      <FolderKanban
                        size={28}
                        className="mx-auto mb-3 text-[#c5c1d2]"
                      />
                      <p className="text-xs font-bold text-[#666378]">
                        No projects yet
                      </p>
                      <button
                        onClick={() => router.push("/projects")}
                        className="mt-3 text-[10px] font-bold text-[#8879ed]"
                      >
                        Create your first project
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {projects.slice(0, 4).map((project) => {
                        const projectTasks = allTasks.filter(
                          (task) => task.projectId === project.id
                        );

                        const completed = projectTasks.filter(
                          (task) => task.status === "DONE"
                        ).length;

                        const percentage =
                          projectTasks.length > 0
                            ? Math.round(
                                (completed / projectTasks.length) * 100
                              )
                            : 0;

                        const color = project.color || "#8879ed";

                        return (
                          <button
                            key={project.id}
                            onClick={() =>
                              router.push(`/projects/${project.id}`)
                            }
                            className="block w-full text-left"
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                  style={{ background: color }}
                                />
                                <strong className="truncate text-[11px] font-bold text-[#514e64]">
                                  {project.name}
                                </strong>
                              </div>

                              <span className="text-[9px] font-bold text-[#8879ed]">
                                {percentage}%
                              </span>
                            </div>

                            <div className="h-1.5 overflow-hidden rounded-full bg-[#f0eff5]">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${percentage}%`,
                                  background: color,
                                }}
                              />
                            </div>

                            <div className="mt-2 flex justify-between text-[9px] text-[#aaa8b6]">
                              <span>
                                {completed}/{projectTasks.length} completed
                              </span>
                              <span>
                                {project.members?.length || 0} members
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* UPCOMING DEADLINES */}
                <div className="rounded-xl border border-[#eeedf3] bg-white p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <CalendarDays size={16} className="text-[#8879ed]" />
                    <div>
                      <h2 className="text-sm font-extrabold text-[#39374d]">
                        Upcoming deadlines
                      </h2>
                      <p className="mt-1 text-[10px] text-[#aaa8b6]">
                        Your pending assigned tasks
                      </p>
                    </div>
                  </div>

                  {upcomingTasks.length === 0 ? (
                    <p className="py-5 text-center text-[10px] text-[#aaa8b6]">
                      No upcoming deadlines.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {upcomingTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => openTask(task)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[#f0edff] text-[#8879ed]">
                            <CalendarDays size={15} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <strong className="block truncate text-[10px] text-[#514e64]">
                              {task.title}
                            </strong>
                            <span className="mt-1 block text-[9px] text-[#aaa8b6]">
                              {task.project?.name || "Project"}
                            </span>
                          </div>

                          <span className="text-[9px] font-bold text-[#8879ed]">
                            {formatDate(task.dueDate)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* RECENTLY UPDATED */}
            <section className="mt-6 rounded-xl border border-[#eeedf3] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-[#39374d]">
                    Recently updated tasks
                  </h2>
                  <p className="mt-1 text-[10px] text-[#aaa8b6]">
                    Latest task records across your projects
                  </p>
                </div>

                <Activity size={18} className="text-[#8879ed]" />
              </div>

              {recentTasks.length === 0 ? (
                <p className="py-6 text-center text-[10px] text-[#aaa8b6]">
                  Task activity will appear here when your team starts working.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recentTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => openTask(task)}
                      className="flex min-w-0 items-start gap-3 rounded-xl border border-[#f0eff5] p-4 text-left transition hover:border-[#dcd6ff] hover:bg-[#faf9ff]"
                    >
                      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[#f0edff] text-[#8879ed]">
                        <ListTodo size={16} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-[10px] text-[#514e64]">
                          {task.title}
                        </strong>

                        <span className="mt-1 block truncate text-[9px] text-[#aaa8b6]">
                          {task.project?.name || "Project"}
                        </span>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span
                            className="rounded-md px-2 py-1 text-[8px] font-bold"
                            style={{
                              background:
                                STATUS_CONFIG[task.status].background,
                              color: STATUS_CONFIG[task.status].color,
                            }}
                          >
                            {STATUS_CONFIG[task.status].label}
                          </span>

                          <span className="text-[8px] text-[#aaa8b6]">
                            {relativeTime(task.updatedAt || task.createdAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeedf3] pt-5 text-[9px] text-[#aaa8b6]">
              <span className="flex items-center gap-2">
                <Sparkles size={12} className="text-[#8879ed]" />
                Made for focused teams
              </span>

              <span>
                TaskFlow Â· Your data updates from your workspace
              </span>
            </footer>
          </div>
        </section>
      </div>

      {/* CREATE TASK MODAL */}
      {showTaskModal && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-[#201c35a6] p-4 backdrop-blur-sm"
          onClick={() => !creating && setShowTaskModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <span className="text-[9px] font-extrabold tracking-[1.4px] text-[#8879ed]">
                  QUICK ACTION
                </span>
                <h2 className="mt-1 text-xl font-extrabold text-[#302e43]">
                  Create a task
                </h2>
                <p className="mt-1 text-[10px] text-[#aaa8b6]">
                  This task will be saved to your database.
                </p>
              </div>

              <button
                onClick={() => setShowTaskModal(false)}
                disabled={creating}
                className="rounded-lg p-2 text-[#9997a8] hover:bg-[#f5f3ff]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label
                  htmlFor="dashboard-task-title"
                  className="mb-2 block text-xs font-bold text-[#555268]"
                >
                  Task name
                </label>
                <input
                  id="dashboard-task-title"
                  required
                  minLength={2}
                  maxLength={150}
                  autoFocus
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="What needs to get done?"
                  className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none focus:border-[#a69bf0]"
                />
              </div>

              <div>
                <label
                  htmlFor="dashboard-task-description"
                  className="mb-2 block text-xs font-bold text-[#555268]"
                >
                  Description
                </label>
                <textarea
                  id="dashboard-task-description"
                  rows={3}
                  maxLength={3000}
                  value={newDescription}
                  onChange={(event) =>
                    setNewDescription(event.target.value)
                  }
                  placeholder="Add more details..."
                  className="w-full resize-none rounded-lg border border-[#eae9f0] bg-[#fcfcfe] p-3 text-xs outline-none focus:border-[#a69bf0]"
                />
              </div>

              <div>
                <label
                  htmlFor="dashboard-task-project"
                  className="mb-2 block text-xs font-bold text-[#555268]"
                >
                  Project
                </label>
                <select
                  id="dashboard-task-project"
                  required
                  value={newProject}
                  onChange={(event) => setNewProject(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
                >
                  {projects.length === 0 && (
                    <option value="">No projects available</option>
                  )}

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="dashboard-task-priority"
                    className="mb-2 block text-xs font-bold text-[#555268]"
                  >
                    Priority
                  </label>
                  <select
                    id="dashboard-task-priority"
                    value={newPriority}
                    onChange={(event) =>
                      setNewPriority(event.target.value as Priority)
                    }
                    className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="dashboard-task-date"
                    className="mb-2 block text-xs font-bold text-[#555268]"
                  >
                    Due date
                  </label>
                  <input
                    id="dashboard-task-date"
                    type="date"
                    value={newDueDate}
                    onChange={(event) => setNewDueDate(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
                  />
                </div>
              </div>

              {createError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-xs text-red-600"
                >
                  {createError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowTaskModal(false)}
                  className="rounded-lg border border-[#eae9f0] px-4 py-2.5 text-xs font-bold text-[#777589]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    creating ||
                    newTitle.trim().length < 2 ||
                    projects.length === 0
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#8879ed] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {creating ? "Saving..." : "Create task"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </main>
  );
}




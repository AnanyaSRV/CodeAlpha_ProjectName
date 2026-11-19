"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GitBranch,
  Layers3,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type TaskUser = {
  id: string;
  name?: string;
  email?: string;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus | string;
  priority: Priority | string;
  dueDate?: string | null;
  createdAt: string;
  assignee?: TaskUser | null;
  assigneeId?: string | null;
};

type Dependency = {
  id: string;
  projectId?: string;
  taskId: string;
  dependsOnTaskId: string;
  task?: Task;
  dependsOn?: Task;
};

type Project = {
  id: string;
  name: string;
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  tasks?: T;
  dependencies?: Dependency[];
  blockedTasks?: unknown[];
  summary?: Record<string, unknown>;
  project?: Project;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  TODO: {
    label: "To Do",
    color: "text-slate-300",
    bg: "bg-slate-500/15",
    dot: "bg-slate-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-300",
    bg: "bg-blue-500/15",
    dot: "bg-blue-400",
  },
  DONE: {
    label: "Completed",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    dot: "bg-emerald-400",
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  LOW: {
    label: "Low",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
  },
  MEDIUM: {
    label: "Medium",
    color: "text-blue-300",
    bg: "bg-blue-500/10",
  },
  HIGH: {
    label: "High",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
  },
  URGENT: {
    label: "Urgent",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
  },
};

function safeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function daysBetween(a: Date, b: Date) {
  return Math.round(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000
  );
}

function formatDate(date?: string | null) {
  if (!date) return "No due date";
  const parsed = safeDate(date);
  if (!parsed) return "Invalid date";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function normalizeStatus(status: string): TaskStatus {
  const value = status.toUpperCase();
  if (value === "DONE" || value === "COMPLETED") return "DONE";
  if (value === "IN_PROGRESS" || value === "INPROGRESS") return "IN_PROGRESS";
  return "TODO";
}

function isCompleted(task: Task) {
  return normalizeStatus(task.status) === "DONE";
}

function getTaskInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function ProjectTimelinePage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState("ALL");
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedPrerequisiteId, setSelectedPrerequisiteId] = useState("");
  const [savingDependency, setSavingDependency] = useState(false);
  const [dependencyError, setDependencyError] = useState("");

  const [rangeOffset, setRangeOffset] = useState(0);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!projectId) return;

      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const [projectResult, taskResult, dependencyResult] =
          await Promise.all([
            api.get(`/projects/${projectId}`),
            api.get(`/tasks/project/${projectId}`),
            api.get(`/dependencies/project/${projectId}`),
          ]);

        const projectData = projectResult.data?.project;
        const taskData = taskResult.data?.tasks;
        const dependencyData = dependencyResult.data?.dependencies;

        setProject(projectData || null);
        setTasks(Array.isArray(taskData) ? taskData : []);
        setDependencies(
          Array.isArray(dependencyData) ? dependencyData : []
        );
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load project timeline."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const taskMap = useMemo(() => {
    return new Map(tasks.map((task) => [task.id, task]));
  }, [tasks]);

  const dependencyMap = useMemo(() => {
    const map = new Map<string, Dependency[]>();
    dependencies.forEach((dependency) => {
      const current = map.get(dependency.taskId) || [];
      current.push(dependency);
      map.set(dependency.taskId, current);
    });
    return map;
  }, [dependencies]);

  const blockedTaskIds = useMemo(() => {
    const blocked = new Set<string>();

    dependencies.forEach((dependency) => {
      const prerequisite = taskMap.get(dependency.dependsOnTaskId);
      const dependent = taskMap.get(dependency.taskId);

      if (prerequisite && dependent && !isCompleted(prerequisite)) {
        if (!isCompleted(dependent)) blocked.add(dependent.id);
      }
    });

    return blocked;
  }, [dependencies, taskMap]);

  const completedCount = tasks.filter(isCompleted).length;
  const blockedCount = blockedTaskIds.size;
  const overdueCount = tasks.filter((task) => {
    const due = safeDate(task.dueDate);
    if (!due || isCompleted(task)) return false;
    return startOfDay(due).getTime() < startOfDay(new Date()).getTime();
  }).length;

  const scheduledTasks = useMemo(() => {
    return tasks
      .filter((task) => safeDate(task.dueDate))
      .sort((a, b) => {
        return (
          (safeDate(a.dueDate)?.getTime() || 0) -
          (safeDate(b.dueDate)?.getTime() || 0)
        );
      });
  }, [tasks]);

  const unscheduledTasks = useMemo(() => {
    return tasks.filter((task) => !safeDate(task.dueDate));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "BLOCKED") {
      return scheduledTasks.filter((task) => blockedTaskIds.has(task.id));
    }
    if (filter === "OVERDUE") {
      return scheduledTasks.filter((task) => {
        const due = safeDate(task.dueDate);
        return (
          due &&
          !isCompleted(task) &&
          startOfDay(due).getTime() < startOfDay(new Date()).getTime()
        );
      });
    }
    if (filter === "ACTIVE") {
      return scheduledTasks.filter((task) => !isCompleted(task));
    }
    if (filter === "DONE") {
      return scheduledTasks.filter(isCompleted);
    }
    return scheduledTasks;
  }, [filter, scheduledTasks, blockedTaskIds]);

  const timelineRange = useMemo(() => {
    const dates = scheduledTasks
      .map((task) => safeDate(task.dueDate))
      .filter((date): date is Date => date !== null);

    const today = startOfDay(new Date());

    if (dates.length === 0) {
      return {
        start: addDays(today, -7 + rangeOffset * 28),
        end: addDays(today, 21 + rangeOffset * 28),
      };
    }

    const minDate = dates.reduce(
      (min, date) => (date < min ? date : min),
      dates[0]
    );

    const maxDate = dates.reduce(
      (max, date) => (date > max ? date : max),
      dates[0]
    );

    const rangeStart = addDays(startOfDay(minDate), -7 + rangeOffset * 28);
    const rangeEnd = addDays(startOfDay(maxDate), 14 + rangeOffset * 28);

    if (daysBetween(rangeStart, rangeEnd) < 21) {
      return {
        start: rangeStart,
        end: addDays(rangeStart, 27),
      };
    }

    return {
      start: rangeStart,
      end: rangeEnd,
    };
  }, [scheduledTasks, rangeOffset]);

  const totalDays = Math.max(
    1,
    daysBetween(timelineRange.start, timelineRange.end)
  );

  const timelineDays = useMemo(() => {
    const count = Math.min(totalDays + 1, 84);
    return Array.from({ length: count }, (_, index) =>
      addDays(timelineRange.start, index)
    );
  }, [timelineRange, totalDays]);

  const timelineWidth = timelineDays.length * 44;

  const todayOffset = daysBetween(timelineRange.start, startOfDay(new Date()));

  const todayVisible =
    todayOffset >= 0 && todayOffset < timelineDays.length;

  const taskPosition = (task: Task) => {
    const due = safeDate(task.dueDate);
    if (!due) return null;

    const offset = daysBetween(timelineRange.start, startOfDay(due));
    const clamped = Math.max(0, Math.min(timelineDays.length - 1, offset));
    return clamped;
  };

  const openDependencyModal = () => {
    setSelectedTaskId("");
    setSelectedPrerequisiteId("");
    setDependencyError("");
    setShowDependencyModal(true);
  };

  const createDependency = async () => {
    if (!selectedTaskId || !selectedPrerequisiteId) {
      setDependencyError("Select both tasks to create a dependency.");
      return;
    }

    if (selectedTaskId === selectedPrerequisiteId) {
      setDependencyError("A task cannot depend on itself.");
      return;
    }

    setSavingDependency(true);
    setDependencyError("");

    try {
      await api.post("/dependencies", {
        taskId: selectedTaskId,
        dependsOnTaskId: selectedPrerequisiteId,
      });

      setShowDependencyModal(false);
      await fetchData(true);
    } catch (err: any) {
      setDependencyError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to create dependency."
      );
    } finally {
      setSavingDependency(false);
    }
  };

  const removeDependency = async (dependencyId: string) => {
    try {
      await api.delete(`/dependencies/${dependencyId}`);
      await fetchData(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Unable to remove dependency."
      );
    }
  };

  const getDependenciesForTask = (taskId: string) =>
    dependencyMap.get(taskId) || [];

  const getDependencyNames = (taskId: string) =>
    getDependenciesForTask(taskId)
      .map((dependency) => {
        const prerequisite =
          taskMap.get(dependency.dependsOnTaskId) || dependency.dependsOn;
        return prerequisite?.title || "Unknown task";
      })
      .filter(Boolean);

  const taskIsBlocked = (taskId: string) => blockedTaskIds.has(taskId);

  const getTaskStatusConfig = (status: string) =>
    STATUS_CONFIG[normalizeStatus(status)] || STATUS_CONFIG.TODO;

  const getPriorityConfig = (priority: string) =>
    PRIORITY_CONFIG[priority?.toUpperCase()] || PRIORITY_CONFIG.MEDIUM;

  const timelineTask = (task: Task) => {
    const position = taskPosition(task);
    if (position === null) return null;

    const statusConfig = getTaskStatusConfig(task.status);
    const priorityConfig = getPriorityConfig(task.priority);
    const isBlocked = taskIsBlocked(task.id);
    const overdue =
      !!safeDate(task.dueDate) &&
      !isCompleted(task) &&
      startOfDay(safeDate(task.dueDate)!).getTime() <
        startOfDay(new Date()).getTime();

    return (
      <div
        key={task.id}
        className="group/task relative flex min-h-[62px] items-center border-b border-white/[0.035]"
      >
        <div className="sticky left-0 z-20 flex h-[62px] w-[310px] shrink-0 items-center gap-3 border-r border-white/[0.07] bg-[#0c0b18] px-4">
          <div
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusConfig.dot}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[13px] font-medium text-white/90">
                {task.title}
              </p>
              {isBlocked && (
                <ShieldAlert
                  size={13}
                  className="shrink-0 text-amber-400"
                />
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-[10px] ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
              {task.assignee?.name && (
                <span className="flex items-center gap-1 truncate text-[10px] text-white/35">
                  <UserRound size={10} />
                  {task.assignee.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="relative flex h-[62px] shrink-0 items-center"
          style={{ width: timelineWidth }}
        >
          {timelineDays.map((day, index) => {
            const isToday =
              day.toDateString() === new Date().toDateString();
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={`${task.id}-cell-${index}`}
                className={`h-full w-[44px] shrink-0 border-r border-white/[0.025] ${
                  isWeekend ? "bg-white/[0.012]" : ""
                } ${isToday ? "bg-violet-500/[0.025]" : ""}`}
              />
            );
          })}

          {todayVisible && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-[1] w-px bg-violet-400/30"
              style={{ left: todayOffset * 44 + 22 }}
            />
          )}

          <div
            className={`absolute z-[2] flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[10px] font-medium shadow-lg transition-all group-hover/task:h-8 ${
              isBlocked
                ? "border-amber-400/20 bg-amber-500/20 text-amber-200"
                : normalizeStatus(task.status) === "DONE"
                  ? "border-emerald-400/20 bg-emerald-500/25 text-emerald-200"
                  : normalizeStatus(task.status) === "IN_PROGRESS"
                    ? "border-blue-400/20 bg-blue-500/25 text-blue-200"
                    : "border-slate-400/10 bg-slate-400/20 text-slate-200"
            } ${overdue ? "ring-1 ring-rose-400/50" : ""}`}
            style={{
              left: position * 44 + 5,
              width: 34,
            }}
            title={`${task.title} — due ${formatDate(task.dueDate)}`}
          >
            <span className="truncate">
              {isBlocked ? "Blocked" : isCompleted(task) ? "Done" : "Task"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080710] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-violet-400" />
          <p className="text-sm text-white/50">Building your timeline...</p>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-[#080710] p-8 text-white">
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] p-6">
          <ShieldAlert className="mb-3 text-rose-400" size={24} />
          <h2 className="font-semibold">Couldn't load the timeline</h2>
          <p className="mt-2 text-sm text-white/50">{error}</p>
          <button
            onClick={() => fetchData()}
            className="mt-5 rounded-xl bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080710] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/[0.07] blur-[130px]" />
        <div className="absolute -left-40 top-[45%] h-[450px] w-[450px] rounded-full bg-blue-600/[0.045] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10">
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="mb-4 inline-flex items-center gap-2 text-xs text-white/40 transition hover:text-white/80"
            >
              <ArrowLeft size={14} />
              Back to project workspace
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10 text-violet-300">
                <CalendarDays size={19} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Timeline
                </h1>
                <p className="mt-1 text-sm text-white/40">
                  {project?.name || "Project"} · Schedule and dependencies
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white/65 transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              onClick={openDependencyModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-medium shadow-lg shadow-violet-900/20 transition hover:brightness-110"
            >
              <Plus size={14} />
              Add dependency
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            icon={<Layers3 size={16} />}
            label="Total tasks"
            value={tasks.length}
            accent="violet"
          />
          <MetricCard
            icon={<CheckCircle2 size={16} />}
            label="Completed"
            value={completedCount}
            accent="emerald"
            sub={`${tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}% complete`}
          />
          <MetricCard
            icon={<GitBranch size={16} />}
            label="Blocked tasks"
            value={blockedCount}
            accent="amber"
          />
          <MetricCard
            icon={<Clock3 size={16} />}
            label="Overdue"
            value={overdueCount}
            accent="rose"
          />
        </div>

        {/* Timeline */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0b18]/90 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Project schedule</h2>
              <p className="mt-1 text-xs text-white/35">
                Each marker represents a task due date
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRangeOffset((value) => value - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/55 transition hover:bg-white/[0.07]"
                title="Move timeline backward"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setRangeOffset(0)}
                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white/55 transition hover:bg-white/[0.07]"
              >
                Today
              </button>
              <button
                onClick={() => setRangeOffset((value) => value + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/55 transition hover:bg-white/[0.07]"
                title="Move timeline forward"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-5 py-3">
            {[
              { label: "To Do", dot: "bg-slate-400" },
              { label: "In Progress", dot: "bg-blue-400" },
              { label: "Completed", dot: "bg-emerald-400" },
              { label: "Blocked", dot: "bg-amber-400" },
              { label: "Overdue", dot: "bg-rose-400" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 text-[10px] text-white/45"
              >
                <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                {item.label}
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            {[
              ["ALL", "All scheduled"],
              ["ACTIVE", "Active"],
              ["DONE", "Completed"],
              ["BLOCKED", "Blocked"],
              ["OVERDUE", "Overdue"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-[11px] transition ${
                  filter === key
                    ? "border border-violet-400/20 bg-violet-500/15 text-violet-200"
                    : "border border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-white/30">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
              <CalendarDays size={25} className="mb-3 text-white/15" />
              <p className="text-sm text-white/60">
                {filter === "ALL"
                  ? "No tasks with due dates yet"
                  : "No tasks match this filter"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-white/30">
                Add due dates to your tasks to see them on the project timeline.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 310 + timelineWidth }}>
                {/* Timeline header */}
                <div className="sticky top-0 z-20 flex border-b border-white/[0.06] bg-[#0c0b18]">
                  <div className="sticky left-0 z-30 flex h-12 w-[310px] shrink-0 items-center border-r border-white/[0.07] bg-[#0c0b18] px-4">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      Task
                    </span>
                  </div>

                  <div
                    className="flex h-12"
                    style={{ width: timelineWidth }}
                  >
                    {timelineDays.map((day, index) => {
                      const isToday =
                        day.toDateString() === new Date().toDateString();

                      return (
                        <div
                          key={`header-${index}`}
                          className={`flex w-[44px] shrink-0 flex-col items-center justify-center border-r border-white/[0.04] ${
                            isToday ? "text-violet-300" : "text-white/35"
                          }`}
                        >
                          <span className="text-[9px]">
                            {day.toLocaleDateString(undefined, {
                              weekday: "short",
                            })}
                          </span>
                          <span
                            className={`text-[11px] font-medium ${
                              isToday
                                ? "flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-violet-200"
                                : ""
                            }`}
                          >
                            {day.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timeline task rows */}
                {filteredTasks.map((task) => timelineTask(task))}
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.04] px-5 py-3">
            <p className="text-[10px] text-white/25">
              Timeline markers show due dates, not estimated task durations.
            </p>
          </div>
        </section>

        {/* Dependency management */}
        <section className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0c0b18]/90 shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                <GitBranch size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Task dependencies</h2>
                <p className="mt-1 text-xs text-white/35">
                  Define what must be completed before another task can begin
                </p>
              </div>
            </div>

            <button
              onClick={openDependencyModal}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/15 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 transition hover:bg-violet-500/15"
            >
              <Plus size={13} />
              New dependency
            </button>
          </div>

          {dependencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02]">
                <Link2 size={18} className="text-white/20" />
              </div>
              <p className="text-sm text-white/55">No dependencies defined</p>
              <p className="mt-1 max-w-sm text-xs text-white/30">
                Connect tasks to establish their order and identify blocked work.
              </p>
              <button
                onClick={openDependencyModal}
                className="mt-4 text-xs text-violet-300 transition hover:text-violet-200"
              >
                + Create your first dependency
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.035]">
              {dependencies.map((dependency) => {
                const dependent =
                  taskMap.get(dependency.taskId) || dependency.task;
                const prerequisite =
                  taskMap.get(dependency.dependsOnTaskId) ||
                  dependency.dependsOn;

                const prerequisiteDone = prerequisite
                  ? isCompleted(prerequisite)
                  : false;

                return (
                  <div
                    key={dependency.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 transition hover:bg-white/[0.015]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              prerequisiteDone
                                ? "bg-emerald-400"
                                : "bg-amber-400"
                            }`}
                          />
                          <span className="truncate text-sm text-white/75">
                            {prerequisite?.title || "Unknown prerequisite"}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[10px] text-white/25">
                          <ChevronRight size={11} />
                          must finish before
                          <ChevronRight size={11} />
                        </span>

                        <span className="truncate text-sm text-white/75">
                          {dependent?.title || "Unknown task"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-[10px] ${
                            prerequisiteDone
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {prerequisiteDone
                            ? "Prerequisite completed"
                            : "Prerequisite pending"}
                        </span>

                        {dependent && taskIsBlocked(dependent.id) && (
                          <span className="rounded-md bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
                            Currently blocked
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeDependency(dependency.id)}
                      title="Remove dependency"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] text-white/30 transition hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Unscheduled */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0b18]/90 shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Unscheduled tasks</h2>
              <p className="mt-1 text-xs text-white/35">
                Tasks that haven't been assigned a due date
              </p>
            </div>
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-white/45">
              {unscheduledTasks.length}
            </span>
          </div>

          {unscheduledTasks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Check size={18} className="mx-auto mb-2 text-emerald-400/60" />
              <p className="text-xs text-white/40">
                All tasks have due dates.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {unscheduledTasks.map((task) => {
                const statusConfig = getTaskStatusConfig(task.status);
                const priorityConfig = getPriorityConfig(task.priority);

                return (
                  <div
                    key={task.id}
                    className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3.5 transition hover:border-white/[0.09] hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusConfig.dot}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-medium text-white/75">
                          {task.title}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] ${priorityConfig.bg} ${priorityConfig.color}`}
                          >
                            {priorityConfig.label}
                          </span>
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] ${statusConfig.bg} ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </div>
                        {taskIsBlocked(task.id) && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-300">
                            <ShieldAlert size={11} />
                            Blocked by prerequisite
                          </div>
                        )}
                        {getDependencyNames(task.id).length > 0 && (
                          <p className="mt-2 truncate text-[10px] text-white/25">
                            Depends on: {getDependencyNames(task.id).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Dependency modal */}
        {showDependencyModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!savingDependency) setShowDependencyModal(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#121020] p-5 shadow-2xl shadow-black/50"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold">
                    Create task dependency
                  </h3>
                  <p className="mt-1 text-xs text-white/40">
                    Set the prerequisite for a task
                  </p>
                </div>
                <button
                  onClick={() => setShowDependencyModal(false)}
                  disabled={savingDependency}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-white/55">
                    This task depends on
                  </label>
                  <select
                    value={selectedPrerequisiteId}
                    onChange={(event) =>
                      setSelectedPrerequisiteId(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0b0a16] px-3 py-3 text-sm text-white/80 outline-none transition focus:border-violet-400/40"
                  >
                    <option value="">Choose prerequisite task...</option>
                    {tasks
                      .filter((task) => task.id !== selectedTaskId)
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title} · {getTaskStatusConfig(task.status).label}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-violet-400/10 bg-violet-500/[0.04] p-3">
                  <GitBranch size={15} className="shrink-0 text-violet-300" />
                  <p className="text-xs leading-5 text-white/45">
                    The selected prerequisite must be completed before the
                    dependent task can proceed.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-white/55">
                    Dependent task
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(event) => setSelectedTaskId(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0b0a16] px-3 py-3 text-sm text-white/80 outline-none transition focus:border-violet-400/40"
                  >
                    <option value="">Choose dependent task...</option>
                    {tasks
                      .filter((task) => task.id !== selectedPrerequisiteId)
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title} · {getTaskStatusConfig(task.status).label}
                        </option>
                      ))}
                  </select>
                </div>

                {dependencyError && (
                  <div className="rounded-xl border border-rose-400/10 bg-rose-500/[0.05] p-3 text-xs text-rose-300">
                    {dependencyError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowDependencyModal(false)}
                    disabled={savingDependency}
                    className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs text-white/55 transition hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createDependency}
                    disabled={
                      savingDependency ||
                      !selectedTaskId ||
                      !selectedPrerequisiteId
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-xs font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingDependency ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        Create dependency
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed bottom-5 right-5 z-40 max-w-sm rounded-xl border border-rose-400/15 bg-[#17101b] px-4 py-3 text-xs text-rose-300 shadow-xl">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "violet" | "emerald" | "amber" | "rose";
  sub?: string;
}) {
  const accentConfig = {
    violet: {
      icon: "text-violet-300",
      iconBg: "bg-violet-500/10",
      value: "text-white",
    },
    emerald: {
      icon: "text-emerald-300",
      iconBg: "bg-emerald-500/10",
      value: "text-emerald-200",
    },
    amber: {
      icon: "text-amber-300",
      iconBg: "bg-amber-500/10",
      value: "text-amber-200",
    },
    rose: {
      icon: "text-rose-300",
      iconBg: "bg-rose-500/10",
      value: "text-rose-200",
    },
  }[accent];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0c0b18]/80 p-4 backdrop-blur-xl transition hover:border-white/[0.09] hover:bg-[#100e1d]">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentConfig.iconBg} ${accentConfig.icon}`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className={`text-2xl font-semibold tracking-tight ${accentConfig.value}`}>
          {value}
        </span>
        {sub && <span className="text-[10px] text-white/30">{sub}</span>}
      </div>
    </div>
  );
}
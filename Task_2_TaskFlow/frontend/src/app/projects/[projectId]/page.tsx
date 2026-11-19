
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileText,
  Flag,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  Users,
  X,
  GripVertical,
  FolderKanban,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type ProjectMember = {
  id: string;
  role: string;
  user: User;
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: User;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  position: number;
  projectId: string;
  assigneeId?: string | null;
  creatorId: string;
  assignee?: User | null;
  creator?: User;
  comments?: Comment[];
  _count?: {
    comments: number;
  };
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  owner: User;
  members: ProjectMember[];
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  project?: T;
  tasks?: T[];
  task?: T;
  comment?: Comment;
};

const columns: {
  id: TaskStatus;
  title: string;
  color: string;
  light: string;
}[] = [
  { id: "TODO", title: "To do", color: "#8d8aa1", light: "#f1f0f5" },
  { id: "IN_PROGRESS", title: "In progress", color: "#8879ed", light: "#f0edff" },
  { id: "IN_REVIEW", title: "In review", color: "#e2a05e", light: "#fff4e8" },
  { id: "DONE", title: "Done", color: "#65ae96", light: "#eaf7f1" },
];

const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const priorityStyles: Record<Priority, string> = {
  LOW: "bg-emerald-50 text-emerald-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-rose-50 text-rose-700",
  URGENT: "bg-red-100 text-red-700",
};

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
  });
}

function TaskCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      status: task.status,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      layout
      className="group rounded-xl border border-[#eeedf3] bg-white p-4 shadow-[0_2px_8px_rgba(35,30,60,0.025)] transition hover:border-[#dcd6ff] hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={`rounded-md px-2 py-1 text-[9px] font-bold ${priorityStyles[task.priority]}`}>
          {task.priority}
        </span>

        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag task"
          className="cursor-grab rounded-md p-1 text-[#c1becd] opacity-0 transition hover:bg-[#f4f2ff] hover:text-[#8879ed] group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={15} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="block w-full text-left"
      >
        <h3 className="text-xs font-extrabold leading-5 text-[#39374d]">
          {task.title}
        </h3>

        {task.description && (
          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-[#a09eae]">
            {task.description}
          </p>
        )}
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-[#f1f0f5] pt-3">
        <div className="flex items-center gap-1.5 text-[9px] text-[#a09eae]">
          <CalendarDays size={12} />
          {formatDate(task.dueDate)}
        </div>

        <div className="flex items-center gap-2">
          {(task._count?.comments || task.comments?.length || 0) > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-[#a09eae]">
              <MessageCircle size={12} />
              {task._count?.comments || task.comments?.length}
            </span>
          )}

          {task.assignee && (
            <span
              title={task.assignee.name}
              className="grid h-6 w-6 place-items-center rounded-full bg-[#eeeaff] text-[8px] font-extrabold text-[#7868df]"
            >
              {initials(task.assignee.name)}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function BoardColumn({
  column,
  tasks,
  onOpen,
  onAdd,
}: {
  column: (typeof columns)[number];
  tasks: Task[];
  onOpen: (task: Task) => void;
  onAdd: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      status: column.id,
    },
  });

  return (
    <section
      ref={setNodeRef}
      className={`min-w-[260px] flex-1 rounded-xl border p-3 transition ${
        isOver
          ? "border-[#b9adff] bg-[#f0edff]/70"
          : "border-[#eeedf3] bg-[#f8f8fb]"
      }`}
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: column.color }}
          />
          <h2 className="text-xs font-extrabold text-[#4c4a60]">
            {column.title}
          </h2>
          <span className="rounded-md bg-white px-2 py-0.5 text-[9px] font-bold text-[#9997a8]">
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAdd(column.id)}
          className="rounded-md p-1.5 text-[#a09eae] transition hover:bg-white hover:text-[#8879ed]"
          aria-label={`Add task to ${column.title}`}
        >
          <Plus size={15} />
        </button>
      </div>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[220px] flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} />
          ))}

          {tasks.length === 0 && (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-[#dedce8] text-center">
              <Circle size={19} className="mb-2 text-[#c4c1d0]" />
              <p className="text-[10px] text-[#aaa8b6]">Drop tasks here</p>
              <button
                type="button"
                onClick={() => onAdd(column.id)}
                className="mt-2 text-[10px] font-bold text-[#8879ed]"
              >
                + Add a task
              </button>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("TODO");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("MEDIUM");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [createError, setCreateError] = useState("");

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const loadWorkspace = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError("");

    try {
      const [projectResponse, taskResponse] = await Promise.all([
        api.get<ApiResponse<Project>>(`/projects/${projectId}`),
        api.get<ApiResponse<Task>>(`/tasks/project/${projectId}`),
      ]);

      if (!projectResponse.data.project) {
        throw new Error("Project details were not returned by the server.");
      }

      setProject(projectResponse.data.project);
      setTasks(taskResponse.data.tasks || []);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
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
            : "Unable to load this project.")
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  function openCreate(status: TaskStatus = "TODO") {
    setCreateStatus(status);
    setNewTitle("");
    setNewDescription("");
    setNewPriority("MEDIUM");
    setNewAssignee("");
    setNewDueDate("");
    setCreateError("");
    setShowCreate(true);
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) return;

    setSaving(true);
    setCreateError("");

    try {
      const response = await api.post<ApiResponse<Task>>("/tasks", {
        projectId,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        status: createStatus,
        assigneeId: newAssignee || undefined,
        dueDate: newDueDate
          ? new Date(`${newDueDate}T12:00:00`).toISOString()
          : undefined,
        position: tasks.filter((task) => task.status === createStatus).length,
      });

      if (!response.data.task) {
        throw new Error(response.data.message || "Task was not returned.");
      }

      setTasks((current) => [...current, response.data.task!]);
      setShowCreate(false);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;

      setCreateError(
        message || (err instanceof Error ? err.message : "Unable to create task.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeTaskStatus(task: Task, status: TaskStatus) {
    if (task.status === status) return;

    const oldStatus = task.status;

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status } : item
      )
    );

    setSelectedTask((current) =>
      current?.id === task.id ? { ...current, status } : current
    );

    try {
      await api.patch(`/tasks/${task.id}`, { status });
    } catch {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: oldStatus } : item
        )
      );
      setError("Task status could not be saved. Please try again.");
    }
  }

  function handleDragStart(_event: DragStartEvent) {
    // Drag interaction is handled by the sortable task cards.
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const draggedTask = tasks.find((task) => task.id === active.id);
    if (!draggedTask) return;

    const targetId = String(over.id);

    let targetStatus: TaskStatus | undefined;

    if (columns.some((column) => column.id === targetId)) {
      targetStatus = targetId as TaskStatus;
    } else {
      const targetTask = tasks.find((task) => task.id === targetId);
      targetStatus = targetTask?.status;
    }

    if (!targetStatus || targetStatus === draggedTask.status) return;

    await changeTaskStatus(draggedTask, targetStatus);
  }

  async function handleDeleteTask() {
    if (!selectedTask) return;

    const confirmed = window.confirm(
      `Delete "${selectedTask.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/tasks/${selectedTask.id}`);
      setTasks((current) =>
        current.filter((task) => task.id !== selectedTask.id)
      );
      setSelectedTask(null);
      setTaskMenuOpen(false);
    } catch {
      setError("Unable to delete this task.");
    }
  }

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !commentText.trim()) return;

    setCommentLoading(true);

    try {
      const response = await api.post<ApiResponse<Comment>>(
        `/tasks/${selectedTask.id}/comments`,
        { content: commentText.trim() }
      );

      if (response.data.comment) {
        const comment = response.data.comment;

        setTasks((current) =>
          current.map((task) =>
            task.id === selectedTask.id
              ? {
                  ...task,
                  comments: [...(task.comments || []), comment],
                  _count: {
                    comments: (task._count?.comments || 0) + 1,
                  },
                }
              : task
          )
        );

        setSelectedTask((current) =>
          current
            ? {
                ...current,
                comments: [...(current.comments || []), comment],
                _count: {
                  comments: (current._count?.comments || 0) + 1,
                },
              }
            : null
        );
      }

      setCommentText("");
    } catch {
      setError("Unable to post your comment.");
    } finally {
      setCommentLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb]">
        <div className="flex flex-col items-center gap-3 text-[#9694a6]">
          <Loader2 size={28} className="animate-spin text-[#8879ed]" />
          <span className="text-xs">Opening your project workspace...</span>
        </div>
      </main>
    );
  }

  if (error && !project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7fb] px-6 text-center">
        <FolderKanban size={35} className="mb-4 text-[#8879ed]" />
        <h1 className="text-lg font-bold text-[#39374d]">
          Couldn't open this project
        </h1>
        <p className="mt-2 text-xs text-[#9694a6]">{error}</p>
        <button
          onClick={() => router.push("/projects")}
          className="mt-5 rounded-lg bg-[#8879ed] px-4 py-2.5 text-xs font-bold text-white"
        >
          Back to projects
        </button>
      </main>
    );
  }

  const completed = tasks.filter((task) => task.status === "DONE").length;
  const progress =
    tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const groupedTasks = (status: TaskStatus) =>
    tasks
      .filter((task) => task.status === status)
      .sort((a, b) => a.position - b.position);

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-6 sm:px-7 lg:px-9">
      <div className="mx-auto max-w-[1650px]">
        <header className="mb-7">
          <button
            onClick={() => router.push("/projects")}
            className="mb-5 flex items-center gap-2 text-xs font-semibold text-[#9694a6] hover:text-[#7969df]"
          >
            <ArrowLeft size={15} /> All projects
          </button>

          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.4px] text-[#8879ed]">
                <FolderKanban size={14} /> PROJECT WORKSPACE
              </div>

              <h1 className="break-words font-[Manrope,sans-serif] text-2xl font-extrabold tracking-tight text-[#29263e] sm:text-3xl">
                {project?.name}
                <span className="text-[#8879ed]">.</span>
              </h1>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-[#9694a6]">
                {project?.description || "Your team's collaborative workspace."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-[#9694a6]">
                <span className="flex items-center gap-1.5">
                  <Users size={13} />
                  {project?.members?.length || 0} members
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  {completed} of {tasks.length} completed
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 size={13} />
                  {progress}% complete
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadWorkspace}
                title="Refresh workspace"
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#eae9f0] bg-white text-[#9694a6] hover:text-[#8879ed]"
              >
                <RefreshCw size={15} />
              </button>

              <button
                onClick={() => router.push(`/projects/${projectId}/ai`)}
                className="flex h-10 items-center gap-2 rounded-lg border border-[#e5defe] bg-[#f5f1ff] px-4 text-xs font-bold text-[#7868df] transition hover:bg-[#ece5ff]"
                title="Open Project AI Assistant"
              >
                <span className="text-base">âœ¦</span> Project AI
              </button>
              <button
                onClick={() => openCreate()}
                className="flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[#9384f4] to-[#7868df] px-4 text-xs font-bold text-white shadow-lg shadow-violet-200"
              >
                <Plus size={16} /> Add task
              </button>
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-xl border border-[#eeedf3] bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#777589]">
              PROJECT COMPLETION
            </span>
            <strong className="text-xs text-[#7868df]">{progress}%</strong>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-[#f0eff5]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-full bg-gradient-to-r from-[#a99cff] to-[#7768e5]"
            />
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-600">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#39374d]">
              Board view
            </h2>
            <p className="mt-1 text-[10px] text-[#a09eae]">
              Drag cards between columns to update their status.
            </p>
          </div>

          <div className="hidden items-center gap-2 text-[10px] text-[#a09eae] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#65ae96]" />
            {tasks.length} tasks
          </div>
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-5">
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={groupedTasks(column.id)}
                onOpen={setSelectedTask}
                onAdd={openCreate}
              />
            ))}
          </div>
        </DndContext>

        <section className="mt-3 rounded-xl border border-[#eeedf3] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-extrabold text-[#39374d]">
                Project members
              </h2>
              <p className="mt-1 text-[10px] text-[#a09eae]">
                People collaborating on this project
              </p>
            </div>
            <Users size={17} className="text-[#8879ed]" />
          </div>

          <div className="flex flex-wrap gap-3">
            {(project?.members || []).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 rounded-lg border border-[#f0eff5] px-3 py-2"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eeeaff] text-[9px] font-extrabold text-[#7868df]">
                  {initials(member.user?.name)}
                </span>
                <div>
                  <p className="text-[10px] font-bold text-[#514e64]">
                    {member.user?.name}
                  </p>
                  <p className="text-[9px] text-[#aaa8b6]">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#201c35a6] p-4 backdrop-blur-sm"
          onClick={() => !saving && setShowCreate(false)}
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
                  PROJECT TASK
                </span>
                <h2 className="mt-1 text-xl font-extrabold text-[#302e43]">
                  Create a task
                </h2>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                disabled={saving}
                className="rounded-lg p-2 text-[#9997a8] hover:bg-[#f5f3ff]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label htmlFor="task-title" className="mb-2 block text-xs font-bold text-[#555268]">
                  Task title
                </label>
                <input
                  id="task-title"
                  required
                  maxLength={120}
                  autoFocus
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="What needs to be done?"
                  className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none focus:border-[#a69bf0]"
                />
              </div>

              <div>
                <label htmlFor="task-description" className="mb-2 block text-xs font-bold text-[#555268]">
                  Description
                </label>
                <textarea
                  id="task-description"
                  rows={3}
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="Add more details..."
                  className="w-full resize-none rounded-lg border border-[#eae9f0] bg-[#fcfcfe] p-3 text-xs outline-none focus:border-[#a69bf0]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="task-status" className="mb-2 block text-xs font-bold text-[#555268]">
                    Status
                  </label>
                  <select
                    id="task-status"
                    value={createStatus}
                    onChange={(event) => setCreateStatus(event.target.value as TaskStatus)}
                    className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
                  >
                    {columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-priority" className="mb-2 block text-xs font-bold text-[#555268]">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={newPriority}
                    onChange={(event) => setNewPriority(event.target.value as Priority)}
                    className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="task-assignee" className="mb-2 block text-xs font-bold text-[#555268]">
                    Assign to
                  </label>
                  <select
                    id="task-assignee"
                    value={newAssignee}
                    onChange={(event) => setNewAssignee(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
                  >
                    <option value="">Unassigned</option>
                    {(project?.members || []).map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-due" className="mb-2 block text-xs font-bold text-[#555268]">
                    Due date
                  </label>
                  <input
                    id="task-due"
                    type="date"
                    value={newDueDate}
                    onChange={(event) => setNewDueDate(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
                  />
                </div>
              </div>

              {createError && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                  {createError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-[#eae9f0] px-4 py-2.5 text-xs font-bold text-[#777589]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newTitle.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[#8879ed] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? "Creating..." : "Create task"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#201c35a6] backdrop-blur-sm"
          onClick={() => {
            setSelectedTask(null);
            setTaskMenuOpen(false);
          }}
        >
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#eeedf3] p-5">
              <span className="text-[10px] font-extrabold uppercase tracking-[1.2px] text-[#8879ed]">
                Task details
              </span>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setTaskMenuOpen(!taskMenuOpen)}
                    className="rounded-lg p-2 text-[#9694a6] hover:bg-[#f5f3ff]"
                    aria-label="Task options"
                  >
                    <MoreHorizontal size={19} />
                  </button>
                  {taskMenuOpen && (
                    <div className="absolute right-0 top-10 z-10 w-40 rounded-lg border border-[#eeedf3] bg-white p-1 shadow-xl">
                      <button
                        onClick={handleDeleteTask}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Delete task
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="rounded-lg p-2 text-[#9694a6] hover:bg-[#f5f3ff]"
                  aria-label="Close task details"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6">
              <span className={`inline-block rounded-md px-2 py-1 text-[9px] font-bold ${priorityStyles[selectedTask.priority]}`}>
                <Flag size={10} className="mr-1 inline" />
                {selectedTask.priority} PRIORITY
              </span>

              <h2 className="mt-4 text-xl font-extrabold leading-7 text-[#302e43]">
                {selectedTask.title}
              </h2>

              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[#9694a6]">
                {selectedTask.description || "No description added."}
              </p>

              <div className="mt-7 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-[10px] font-bold text-[#9997a8]">
                    STATUS
                  </label>
                  <select
                    value={selectedTask.status}
                    onChange={(event) =>
                      changeTaskStatus(
                        selectedTask,
                        event.target.value as TaskStatus
                      )
                    }
                    className="h-10 w-full rounded-lg border border-[#eae9f0] bg-white px-2 text-[10px] font-semibold text-[#514e64] outline-none"
                  >
                    {columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold text-[#9997a8]">
                    PRIORITY
                  </label>
                  <select
                    value={selectedTask.priority}
                    onChange={async (event) => {
                      const priority = event.target.value as Priority;
                      const previous = selectedTask.priority;

                      setSelectedTask({ ...selectedTask, priority });
                      setTasks((current) =>
                        current.map((task) =>
                          task.id === selectedTask.id
                            ? { ...task, priority }
                            : task
                        )
                      );

                      try {
                        await api.patch(`/tasks/${selectedTask.id}`, {
                          priority,
                        });
                      } catch {
                        setSelectedTask((current) =>
                          current ? { ...current, priority: previous } : null
                        );
                        setTasks((current) =>
                          current.map((task) =>
                            task.id === selectedTask.id
                              ? { ...task, priority: previous }
                              : task
                          )
                        );
                        setError("Unable to update priority.");
                      }
                    }}
                    className="h-10 w-full rounded-lg border border-[#eae9f0] bg-white px-2 text-[10px] font-semibold text-[#514e64] outline-none"
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold text-[#9997a8]">
                    ASSIGNEE
                  </label>
                  <select
                    value={selectedTask.assigneeId || ""}
                    onChange={async (event) => {
                      const assigneeId = event.target.value || null;
                      const previous = selectedTask.assigneeId || null;
                      const selectedMember = project?.members.find(
                        (member) => member.user.id === assigneeId
                      );

                      setSelectedTask({
                        ...selectedTask,
                        assigneeId,
                        assignee: selectedMember?.user || null,
                      });

                      setTasks((current) =>
                        current.map((task) =>
                          task.id === selectedTask.id
                            ? {
                                ...task,
                                assigneeId,
                                assignee: selectedMember?.user || null,
                              }
                            : task
                        )
                      );

                      try {
                        await api.patch(`/tasks/${selectedTask.id}`, {
                          assigneeId,
                        });
                      } catch {
                        setSelectedTask((current) =>
                          current
                            ? {
                                ...current,
                                assigneeId: previous,
                                assignee:
                                  project?.members.find(
                                    (member) => member.user.id === previous
                                  )?.user || null,
                              }
                            : null
                        );
                        setError("Unable to update the assignee.");
                        loadWorkspace();
                      }
                    }}
                    className="h-10 w-full rounded-lg border border-[#eae9f0] bg-white px-2 text-[10px] text-[#514e64] outline-none"
                  >
                    <option value="">Unassigned</option>
                    {(project?.members || []).map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold text-[#9997a8]">
                    DUE DATE
                  </label>
                  <div className="flex h-10 items-center gap-2 rounded-lg border border-[#eae9f0] px-3 text-[10px] text-[#777589]">
                    <CalendarDays size={13} />
                    {formatDate(selectedTask.dueDate)}
                  </div>
                </div>
              </div>

              <div className="mt-9 border-t border-[#eeedf3] pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-[#39374d]">
                    Discussion
                  </h3>
                  <span className="text-[10px] text-[#a09eae]">
                    {selectedTask.comments?.length || 0} comments
                  </span>
                </div>

                <div className="space-y-4">
                  {(selectedTask.comments || []).map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[9px] font-extrabold text-[#7868df]">
                        {initials(comment.user?.name)}
                      </span>
                      <div className="min-w-0 flex-1 rounded-xl bg-[#f8f7fb] p-3">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-[10px] text-[#514e64]">
                            {comment.user?.name || "Team member"}
                          </strong>
                          <span className="text-[9px] text-[#aaa8b6]">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-[10px] leading-5 text-[#777589]">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}

                  {(selectedTask.comments || []).length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#e5e2ef] py-8 text-center">
                      <MessageCircle size={22} className="mx-auto mb-2 text-[#c4c1d0]" />
                      <p className="text-[10px] text-[#aaa8b6]">
                        No comments yet. Start the conversation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <form
              onSubmit={handleAddComment}
              className="sticky bottom-0 flex items-center gap-2 border-t border-[#eeedf3] bg-white p-4"
            >
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Write a comment..."
                maxLength={2000}
                className="h-11 min-w-0 flex-1 rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none focus:border-[#a69bf0]"
              />
              <button
                type="submit"
                disabled={commentLoading || !commentText.trim()}
                className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg bg-[#8879ed] text-white disabled:opacity-50"
                aria-label="Send comment"
              >
                {commentLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>
          </motion.aside>
        </div>
      )}
    </main>
  );
}


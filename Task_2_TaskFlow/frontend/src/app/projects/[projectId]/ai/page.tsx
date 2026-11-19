"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  AlertTriangle,
  ListTodo,
  RotateCcw,
  Zap,
  ShieldCheck,
  CalendarDays,
  Users,
} from "lucide-react";
import api from "@/lib/api";

type Project = {
  id: string;
  name: string;
  description?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  keyActions?: string[];
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  generatedLocally?: boolean;
  timestamp: Date;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
};

const SUGGESTED_PROMPTS = [
  {
    icon: Target,
    title: "What should we prioritize?",
    prompt: "What should we prioritize next in this project?",
  },
  {
    icon: AlertTriangle,
    title: "Find project risks",
    prompt: "Analyze this project and identify the biggest risks and potential delays.",
  },
  {
    icon: Users,
    title: "Analyze team workload",
    prompt: "Analyze the team workload and identify anyone who may be overloaded or underutilized.",
  },
  {
    icon: ListTodo,
    title: "Improve our plan",
    prompt: "Review our current tasks and suggest a more efficient project plan.",
  },
];

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRiskStyles(risk?: string) {
  switch (risk?.toUpperCase()) {
    case "CRITICAL":
      return {
        color: "text-red-300",
        background: "bg-red-500/10",
        border: "border-red-500/20",
      };
    case "HIGH":
      return {
        color: "text-orange-300",
        background: "bg-orange-500/10",
        border: "border-orange-500/20",
      };
    case "MEDIUM":
      return {
        color: "text-amber-300",
        background: "bg-amber-500/10",
        border: "border-amber-500/20",
      };
    default:
      return {
        color: "text-emerald-300",
        background: "bg-emerald-500/10",
        border: "border-emerald-500/20",
      };
  }
}

function renderFormattedText(text: string) {
  const lines = text.split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      return (
        <p key={index} className="mt-3 mb-1 font-semibold text-white">
          {trimmed.replace(/^#{1,3}\s/, "")}
        </p>
      );
    }

    if (/^[-*]\s/.test(trimmed)) {
      return (
        <div key={index} className="flex gap-2 pl-1 my-1">
          <span className="text-violet-400">•</span>
          <span>{trimmed.replace(/^[-*]\s/, "")}</span>
        </div>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <div key={index} className="flex gap-2 pl-1 my-1">
          <span className="text-violet-400 font-medium">
            {trimmed.match(/^\d+\./)?.[0]}
          </span>
          <span>{trimmed.replace(/^\d+\.\s/, "")}</span>
        </div>
      );
    }

    return <p key={index} className="my-1">{line}</p>;
  });
}

export default function ProjectAIPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showContext, setShowContext] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      setLoadingProject(true);

      try {
        const [projectResponse, taskResponse] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/tasks/project/${projectId}`),
        ]);

        if (cancelled) return;

        const projectData =
          projectResponse.data?.project ??
          projectResponse.data?.data?.project ??
          projectResponse.data?.data ??
          projectResponse.data;

        const taskData =
          taskResponse.data?.tasks ??
          taskResponse.data?.data?.tasks ??
          taskResponse.data?.data ??
          [];

        setProject(projectData);
        setTasks(Array.isArray(taskData) ? taskData : []);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load project context:", err);
        }
      } finally {
        if (!cancelled) {
          setLoadingProject(false);
        }
      }
    }

    if (projectId) {
      loadProject();
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const sendMessage = async (messageOverride?: string) => {
    const message = (messageOverride ?? input).trim();

    if (!message || sending) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);
    setError("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await api.post(`/ai/chat/${projectId}`, {
        message,
      });

      const payload =
        response.data?.data ??
        response.data?.result ??
        response.data;

      const answer =
        payload?.answer ??
        payload?.response ??
        payload?.message ??
        "I couldn't generate a response for that request.";

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content:
          typeof answer === "string"
            ? answer
            : JSON.stringify(answer, null, 2),
        keyActions: Array.isArray(payload?.keyActions)
          ? payload.keyActions
          : Array.isArray(payload?.actions)
            ? payload.actions
            : [],
        riskLevel: payload?.riskLevel ?? payload?.risk,
        generatedLocally: payload?.generatedLocally,
        timestamp: new Date(),
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Unable to connect to Project AI. Check whether the backend is running.";

      setError(errorMessage);

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: `I couldn't complete that request.\n\n${errorMessage}\n\nPlease try again in a moment.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setInput(event.target.value);

    const textarea = event.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  };

  const clearConversation = () => {
    setMessages([]);
    setError("");
    setInput("");
  };

  const completedTasks = tasks.filter(
    (task) => task.status === "DONE",
  ).length;

  const inProgressTasks = tasks.filter(
    (task) => task.status === "IN_PROGRESS",
  ).length;

  const todoTasks = tasks.filter(
    (task) => task.status === "TODO",
  ).length;

  const progress =
    tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0;

  const overdueTasks = tasks.filter((task) => {
    if (!task.dueDate || task.status === "DONE") return false;
    return new Date(task.dueDate).getTime() < Date.now();
  }).length;

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-fuchsia-600/5 blur-[130px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#08090d]/85 backdrop-blur-2xl">
          <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                title="Back to project"
              >
                <ArrowLeft size={17} />
              </button>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-blue-500/10 shadow-lg shadow-violet-900/10">
                <Brain size={19} className="text-violet-300" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
                    Project AI
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Context connected
                  </span>
                </div>

                <p className="truncate text-xs text-gray-500">
                  {loadingProject
                    ? "Loading project..."
                    : project?.name || "Project workspace"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setShowContext((current) => !current)}
                className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                  showContext
                    ? "border-violet-400/20 bg-violet-500/[0.08] text-violet-300"
                    : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:text-white"
                }`}
              >
                <Brain size={14} />
                Project context
              </button>

              <button
                onClick={clearConversation}
                disabled={messages.length === 0 || sending}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-gray-400 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="Clear conversation"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">New chat</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main workspace */}
        <main className="mx-auto flex w-full max-w-[1600px] flex-1 gap-0 px-0">
          <section className="flex min-w-0 flex-1 flex-col">
            {/* Chat heading */}
            <div className="mx-auto w-full max-w-4xl px-5 pt-8 sm:px-8 sm:pt-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-blue-500/10">
                  <Sparkles size={21} className="text-violet-300" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Your project intelligence
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Ask questions. Understand your project. Make better decisions.
                  </p>
                </div>
              </div>

              {messages.length === 0 && (
                <div className="mb-8 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.035] to-white/[0.015] p-5 sm:p-6">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-violet-300">
                    <Zap size={14} />
                    PROJECT-AWARE INTELLIGENCE
                  </div>

                  <h3 className="text-xl font-semibold leading-relaxed sm:text-2xl">
                    Think beyond the task list.
                    <span className="block bg-gradient-to-r from-violet-300 via-blue-300 to-fuchsia-300 bg-clip-text text-transparent">
                      Understand the entire project.
                    </span>
                  </h3>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                    Project AI understands your tasks, progress, priorities,
                    deadlines, dependencies, and team workload. Ask it anything
                    about the project you're working on.
                  </p>
                </div>
              )}

              {/* Suggestions */}
              {messages.length === 0 && (
                <div className="mb-8">
                  <div className="mb-3 text-xs font-medium text-gray-500">
                    START WITH SOMETHING
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {SUGGESTED_PROMPTS.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.title}
                          onClick={() => sendMessage(item.prompt)}
                          disabled={sending}
                          className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition duration-200 hover:border-violet-400/25 hover:bg-violet-500/[0.05]"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-gray-400 transition group-hover:border-violet-400/20 group-hover:bg-violet-500/10 group-hover:text-violet-300">
                            <Icon size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-200 transition group-hover:text-white">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              {item.prompt}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="space-y-6 pb-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/[0.09]">
                        <Bot size={15} className="text-violet-300" />
                      </div>
                    )}

                    <div
                      className={`min-w-0 max-w-[90%] sm:max-w-[85%] ${
                        message.role === "user" ? "order-first" : ""
                      }`}
                    >
                      <div
                        className={`rounded-2xl px-4 py-3.5 text-sm leading-6 ${
                          message.role === "user"
                            ? "border border-violet-400/15 bg-violet-500/[0.10] text-gray-100"
                            : "border border-white/[0.06] bg-white/[0.025] text-gray-300"
                        }`}
                      >
                        {renderFormattedText(message.content)}
                      </div>

                      {/* Risk indicator */}
                      {message.role === "assistant" && message.riskLevel && (
                        <div className="mt-3">
                          {(() => {
                            const styles = getRiskStyles(message.riskLevel);

                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${styles.color} ${styles.background} ${styles.border}`}
                              >
                                <ShieldCheck size={12} />
                                Risk level: {message.riskLevel}
                              </span>
                            );
                          })()}
                        </div>
                      )}

                      {/* Key actions */}
                      {message.keyActions && message.keyActions.length > 0 && (
                        <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3.5">
                          <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-violet-300">
                            <Target size={13} />
                            Suggested actions
                          </div>

                          <div className="space-y-2">
                            {message.keyActions.map((action, index) => (
                              <div
                                key={index}
                                className="flex items-start gap-2 text-xs leading-5 text-gray-300"
                              >
                                <CheckCircle2
                                  size={14}
                                  className="mt-0.5 shrink-0 text-violet-400"
                                />
                                <span>{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2 px-1 text-[10px] text-gray-600">
                        {message.generatedLocally && message.role === "assistant" && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/10 bg-amber-500/[0.04] px-1.5 py-0.5 text-amber-400/70">
                            <Zap size={10} />
                            Local intelligence
                          </span>
                        )}
                        <span>{formatTime(message.timestamp)}</span>
                      </div>
                    </div>

                    {message.role === "user" && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-xs font-medium text-gray-400">
                        You
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/[0.09]">
                      <Bot size={15} className="text-violet-300" />
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 size={14} className="animate-spin text-violet-400" />
                        <span>Analyzing your project...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Error */}
              {error && (
                <div className="mb-3 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-3 py-2.5 text-xs text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="sticky bottom-0 mt-auto border-t border-white/[0.05] bg-[#08090d]/90 px-4 py-4 backdrop-blur-2xl sm:px-6">
              <div className="mx-auto max-w-4xl">
                <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-2 transition focus-within:border-violet-400/30 focus-within:bg-white/[0.045]">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Ask anything about this project..."
                    disabled={sending}
                    className="max-h-[180px] min-h-[42px] w-full resize-none bg-transparent px-3 py-2 text-sm text-gray-200 outline-none placeholder:text-gray-600 disabled:opacity-50"
                  />

                  <div className="flex items-center justify-between gap-3 px-2 pb-1">
                    <div className="flex items-center gap-2 text-[10px] text-gray-600">
                      <Sparkles size={12} className="text-violet-400/60" />
                      <span>Project context enabled</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">Enter to send</span>
                    </div>

                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || sending}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-900/20 transition hover:from-violet-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Send message"
                    >
                      {sending ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <ArrowUp size={17} />
                      )}
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-center text-[10px] text-gray-600">
                  Project AI can make mistakes. Verify important project decisions.
                </p>
              </div>
            </div>
          </section>

          {/* Project context sidebar */}
          {showContext && (
            <aside className="hidden w-[300px] shrink-0 border-l border-white/[0.06] bg-white/[0.012] xl:block">
              <div className="sticky top-[72px] p-5">
                <div className="mb-5 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/[0.06]">
                    <Brain size={14} className="text-violet-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Project context</h3>
                    <p className="text-[10px] text-gray-600">Live project snapshot</p>
                  </div>
                </div>

                {/* Project card */}
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-violet-300">
                    <Target size={12} />
                    Current project
                  </div>

                  <h4 className="text-sm font-medium leading-5 text-gray-200">
                    {loadingProject
                      ? "Loading..."
                      : project?.name || "Project"}
                  </h4>

                  {project?.description && (
                    <p className="mt-2 line-clamp-4 text-xs leading-5 text-gray-500">
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Progress */}
                <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Progress</span>
                    <span className="text-sm font-semibold text-white">
                      {progress}%
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400 transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="mt-2 text-[10px] text-gray-600">
                    {completedTasks} of {tasks.length} tasks completed
                  </p>
                </div>

                {/* Metrics */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/[0.08]">
                        <ListTodo size={13} className="text-blue-300" />
                      </div>
                      <span className="text-xs text-gray-400">Total tasks</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-200">
                      {tasks.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/[0.08]">
                        <CheckCircle2 size={13} className="text-emerald-300" />
                      </div>
                      <span className="text-xs text-gray-400">Completed</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-200">
                      {completedTasks}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/[0.08]">
                        <Clock3 size={13} className="text-violet-300" />
                      </div>
                      <span className="text-xs text-gray-400">In progress</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-200">
                      {inProgressTasks}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/[0.08]">
                        <CalendarDays size={13} className="text-amber-300" />
                      </div>
                      <span className="text-xs text-gray-400">To do</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-200">
                      {todoTasks}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/[0.08]">
                        <AlertTriangle size={13} className="text-red-300" />
                      </div>
                      <span className="text-xs text-gray-400">Overdue</span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        overdueTasks > 0
                          ? "text-red-300"
                          : "text-gray-200"
                      }`}
                    >
                      {overdueTasks}
                    </span>
                  </div>
                </div>

                {/* AI capabilities */}
                <div className="mt-5 rounded-xl border border-violet-400/10 bg-violet-500/[0.025] p-3.5">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                    Intelligence capabilities
                  </div>

                  <div className="space-y-2.5">
                    {[
                      "Project progress analysis",
                      "Task prioritization",
                      "Deadline risk detection",
                      "Dependency analysis",
                      "Team workload insights",
                      "Action recommendations",
                    ].map((capability) => (
                      <div
                        key={capability}
                        className="flex items-center gap-2 text-xs text-gray-500"
                      >
                        <CheckCircle2
                          size={12}
                          className="shrink-0 text-violet-400/60"
                        />
                        {capability}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick links */}
                <div className="mt-5">
                  <p className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">
                    Project workspace
                  </p>

                  <button
                    onClick={() => router.push(`/projects/${projectId}/timeline`)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-gray-400 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarDays size={13} />
                      Timeline
                    </span>
                    <ArrowUp size={12} className="rotate-45" />
                  </button>

                  <button
                    onClick={() => router.push(`/projects/${projectId}/team`)}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-gray-400 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Users size={13} />
                      Team
                    </span>
                    <ArrowUp size={12} className="rotate-45" />
                  </button>

                  <button
                    onClick={() => router.push(`/projects/${projectId}`)}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-gray-400 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <ListTodo size={13} />
                      Project board
                    </span>
                    <ArrowUp size={12} className="rotate-45" />
                  </button>
                </div>
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}
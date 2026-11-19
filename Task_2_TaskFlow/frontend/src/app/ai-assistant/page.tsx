
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  FolderKanban,
  Layers3,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  WandSparkles,
  Zap,
} from "lucide-react";
import api from "@/lib/api";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
};

type PlanTask = {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  suggestedDay?: number;
  day?: number;
  dueDay?: number;
  [key: string]: unknown;
};

type PlanMilestone = {
  title?: string;
  name?: string;
  description?: string;
  day?: number;
  targetDay?: number;
  [key: string]: unknown;
};

type Plan = {
  overview?: string;
  recommendedApproach?: string;
  estimatedDuration?: string;
  milestones?: PlanMilestone[];
  tasks?: PlanTask[];
  risks?: (string | { title?: string; description?: string; mitigation?: string })[];
  [key: string]: unknown;
};

type Tab = "planner" | "breakdown" | "analysis";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#111326] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/10";

const labelClass =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.13em] text-slate-400";

const panelClass =
  "rounded-2xl border border-white/[0.08] bg-[#15172b]/80 shadow-[0_12px_50px_rgba(0,0,0,0.16)]";

function getErrorMessage(error: unknown, fallback: string) {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return value?.response?.data?.message || value?.message || fallback;
}

function formatPriority(priority?: string) {
  const value = (priority || "MEDIUM").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(value)) return value;
  return "MEDIUM";
}

function readable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

export default function AIAssistantPage() {
  const [activeTab, setActiveTab] = useState<Tab>("planner");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [teamSize, setTeamSize] = useState(4);

  const [objective, setObjective] = useState("");
  const [breakdownContext, setBreakdownContext] = useState("");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [breakdown, setBreakdown] = useState<unknown>(null);
  const [analysis, setAnalysis] = useState<unknown>(null);

  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [appliedCount, setAppliedCount] = useState(0);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await api.get("/projects");
      const list = response.data.projects || response.data.data || [];
      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load your projects."));
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const selectedProjectData = useMemo(
    () => projects.find((project) => project.id === selectedProject),
    [projects, selectedProject]
  );

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  async function generatePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setPlan(null);
    setAppliedCount(0);

    if (projectName.trim().length < 2 || description.trim().length < 20) {
      setError("Enter a project name and a description of at least 20 characters.");
      return;
    }

    setGenerating(true);

    try {
      const response = await api.post("/ai/plan", {
        projectName: projectName.trim(),
        description: description.trim(),
        durationDays,
        teamSize,
        ...(selectedProject ? { projectId: selectedProject } : {}),
      });

      const generatedPlan = response.data.plan;

      if (!generatedPlan) {
        throw new Error("The AI response did not contain a project plan.");
      }

      setPlan(generatedPlan);
      setSuccess("Your project plan has been generated.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to generate the project plan."));
    } finally {
      setGenerating(false);
    }
  }

  async function generateBreakdown(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setBreakdown(null);

    if (objective.trim().length < 5) {
      setError("Describe the objective you want to break down.");
      return;
    }

    setGenerating(true);

    try {
      const response = await api.post("/ai/breakdown", {
        objective: objective.trim(),
        context: breakdownContext.trim(),
        durationDays,
      });

      setBreakdown(response.data.breakdown || response.data);
      setSuccess("Your task breakdown is ready.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to break down this objective."));
    } finally {
      setGenerating(false);
    }
  }

  async function analyzeProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setAnalysis(null);

    if (!selectedProject) {
      setError("Select a project to analyse.");
      return;
    }

    setGenerating(true);

    try {
      const response = await api.post(`/ai/analyze/${selectedProject}`);
      setAnalysis({
        analysis: response.data.analysis,
        dataSnapshot: response.data.dataSnapshot,
      });
      setSuccess("Project intelligence report generated.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to analyse this project."));
    } finally {
      setGenerating(false);
    }
  }

  async function applyPlan() {
    if (!plan?.tasks?.length) {
      setError("There are no generated tasks to apply.");
      return;
    }

    if (!selectedProject) {
      setError("Select an existing project before applying generated tasks.");
      return;
    }

    const confirmed = window.confirm(
      `Apply ${plan.tasks.length} AI-generated tasks to "${selectedProjectData?.name || "your project"}"? This will create real tasks in your workspace.`
    );

    if (!confirmed) return;

    clearMessages();
    setApplying(true);
    setAppliedCount(0);

    let created = 0;

    try {
      for (const task of plan.tasks) {
        const title = String(task.title || "").trim();

        if (title.length < 2) continue;

        const suggestedDay = Number(
          task.suggestedDay ?? task.day ?? task.dueDay ?? 0
        );

        let dueDate: string | null = null;

        if (Number.isFinite(suggestedDay) && suggestedDay > 0) {
          const date = new Date();
          date.setDate(date.getDate() + Math.ceil(suggestedDay));
          dueDate = date.toISOString();
        }

        await api.post("/tasks", {
          projectId: selectedProject,
          title: title.slice(0, 150),
          description: String(task.description || "").slice(0, 3000),
          priority: formatPriority(task.priority),
          status: "TODO",
          dueDate,
        });

        created += 1;
        setAppliedCount(created);
      }

      setSuccess(
        `Successfully created ${created} tasks in ${selectedProjectData?.name || "your project"}.`
      );
      setPlan(null);
    } catch (err) {
      setError(
        `${getErrorMessage(err, "Unable to finish applying the plan.")} ${created} tasks were created before the error.`
      );
    } finally {
      setApplying(false);
    }
  }

  const tabs = [
    {
      id: "planner" as const,
      label: "Project planner",
      description: "Generate a complete project roadmap",
      icon: Rocket,
    },
    {
      id: "breakdown" as const,
      label: "Task breakdown",
      description: "Turn complex goals into clear tasks",
      icon: Layers3,
    },
    {
      id: "analysis" as const,
      label: "Project intelligence",
      description: "Understand progress, risks and workload",
      icon: Activity,
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b0c19] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/[0.12] blur-[130px]" />
        <div className="absolute -left-40 top-[45%] h-[420px] w-[420px] rounded-full bg-blue-600/[0.10] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-9"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="rounded-lg border border-violet-400/20 bg-violet-500/10 p-2 text-violet-300">
                <BrainCircuit size={19} />
              </span>
              TaskFlow <span className="text-slate-600">/</span>
              <span className="text-white">AI Workspace</span>
            </div>

            <button
              onClick={() => void loadProjects()}
              disabled={loadingProjects}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingProjects ? "animate-spin" : ""} />
              Refresh projects
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300">
                <Sparkles size={13} />
                TaskFlow Intelligence
                <span className="h-1 w-1 rounded-full bg-violet-300" />
                Powered by Gemini
              </div>

              <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Plan smarter.
                <span className="block bg-gradient-to-r from-violet-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                  Execute with intelligence.
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Your AI-powered project workspace. Generate roadmaps, break
                down objectives and discover what your team should focus on next.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 p-3 shadow-lg shadow-violet-950/40">
                <WandSparkles size={23} />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Assistant</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ready to generate
                </p>
              </div>
              <span className="ml-3 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            </div>
          </div>
        </motion.header>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/[0.08] p-4 text-sm text-red-300">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-300/70 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-4 text-sm text-emerald-300">
            <CheckCircle2 size={18} />
            {success}
            <button
              onClick={() => setSuccess("")}
              className="ml-auto text-emerald-300/70 hover:text-emerald-200"
            >
              ✕
            </button>
          </div>
        )}

        <section className="mb-7 grid gap-3 md:grid-cols-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  clearMessages();
                }}
                className={`group rounded-2xl border p-4 text-left transition duration-200 ${
                  active
                    ? "border-violet-400/40 bg-violet-500/[0.12] shadow-[0_0_30px_rgba(139,92,246,0.08)]"
                    : "border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`rounded-xl p-2.5 ${
                      active
                        ? "bg-violet-500/20 text-violet-300"
                        : "bg-white/[0.06] text-slate-400 group-hover:text-white"
                    }`}
                  >
                    <Icon size={20} />
                  </span>
                  {active ? (
                    <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-[10px] font-semibold text-violet-300">
                      ACTIVE
                    </span>
                  ) : (
                    <ArrowUpRight size={17} className="text-slate-600" />
                  )}
                </div>
                <p className="text-sm font-semibold">{tab.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {tab.description}
                </p>
              </button>
            );
          })}
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className={`${panelClass} p-5 sm:p-7`}>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300">
                {activeTab === "planner" && <Rocket size={21} />}
                {activeTab === "breakdown" && <Layers3 size={21} />}
                {activeTab === "analysis" && <Activity size={21} />}
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {activeTab === "planner" && "Create a project plan"}
                  {activeTab === "breakdown" && "Break down an objective"}
                  {activeTab === "analysis" && "Analyse your project"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {activeTab === "planner" &&
                    "Give the AI your vision. Get a structured roadmap."}
                  {activeTab === "breakdown" &&
                    "Convert a complex goal into manageable work."}
                  {activeTab === "analysis" &&
                    "Use your actual project data to generate insights."}
                </p>
              </div>
            </div>

            {activeTab === "planner" && (
              <form onSubmit={generatePlan} className="space-y-5">
                <div>
                  <label className={labelClass}>Project name</label>
                  <input
                    className={inputClass}
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="e.g. TaskFlow 2.0"
                    maxLength={120}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Project vision</label>
                  <textarea
                    className={`${inputClass} min-h-[130px] resize-y`}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what you want to build, the problem it solves, its major features and expected outcome..."
                    maxLength={5000}
                    minLength={20}
                    required
                  />
                  <p className="mt-1.5 text-right text-[10px] text-slate-600">
                    {description.length}/5000
                  </p>
                </div>

                <div>
                  <label className={labelClass}>
                    Link to an existing project (optional)
                  </label>
                  <div className="relative">
                    <select
                      className={`${inputClass} appearance-none pr-10`}
                      value={selectedProject}
                      onChange={(event) => setSelectedProject(event.target.value)}
                    >
                      <option value="">Generate a standalone plan</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-3.5 text-slate-500"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Choose a project if you want the AI to consider its existing context.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Duration (days)</label>
                    <input
                      type="number"
                      className={inputClass}
                      min={1}
                      max={365}
                      value={durationDays}
                      onChange={(event) =>
                        setDurationDays(Number(event.target.value))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Team size</label>
                    <input
                      type="number"
                      className={inputClass}
                      min={1}
                      max={100}
                      value={teamSize}
                      onChange={(event) => setTeamSize(Number(event.target.value))}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3.5 text-sm font-semibold shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Generating your roadmap...
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} />
                      Generate project plan
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}

            {activeTab === "breakdown" && (
              <form onSubmit={generateBreakdown} className="space-y-5">
                <div>
                  <label className={labelClass}>What do you want to achieve?</label>
                  <textarea
                    className={`${inputClass} min-h-[145px] resize-y`}
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    placeholder="e.g. Build a secure authentication system with email verification, password reset, role-based access and session management..."
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Additional context (optional)</label>
                  <textarea
                    className={`${inputClass} min-h-[105px] resize-y`}
                    value={breakdownContext}
                    onChange={(event) => setBreakdownContext(event.target.value)}
                    placeholder="Mention your tech stack, constraints, dependencies or team capabilities..."
                  />
                </div>

                <div>
                  <label className={labelClass}>Target duration (days)</label>
                  <input
                    type="number"
                    className={inputClass}
                    min={1}
                    max={365}
                    value={durationDays}
                    onChange={(event) =>
                      setDurationDays(Number(event.target.value))
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3.5 text-sm font-semibold shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:opacity-60"
                >
                  {generating ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Breaking down objective...
                    </>
                  ) : (
                    <>
                      <WandSparkles size={17} />
                      Generate task breakdown
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}

            {activeTab === "analysis" && (
              <form onSubmit={analyzeProject} className="space-y-5">
                <div>
                  <label className={labelClass}>Select project</label>
                  <div className="relative">
                    <select
                      className={`${inputClass} appearance-none pr-10`}
                      value={selectedProject}
                      onChange={(event) => setSelectedProject(event.target.value)}
                      required
                    >
                      <option value="">Choose a project...</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-3.5 text-slate-500"
                    />
                  </div>
                </div>

                {selectedProjectData && (
                  <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.07] p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
                      <FolderKanban size={17} />
                      {selectedProjectData.name}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {selectedProjectData.description ||
                        "Project data will be used to generate an intelligence report."}
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Target size={15} className="text-violet-300" />
                    The AI will examine
                  </p>
                  {[
                    "Task completion and project progress",
                    "Overdue work and potential bottlenecks",
                    "Team workload and priorities",
                    "Recommended next actions",
                  ].map((item) => (
                    <div
                      key={item}
                      className="mb-2 flex items-center gap-2 text-xs text-slate-400 last:mb-0"
                    >
                      <Check size={14} className="text-emerald-400" />
                      {item}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={generating || !selectedProject}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3.5 text-sm font-semibold shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Analysing project...
                    </>
                  ) : (
                    <>
                      <Activity size={17} />
                      Generate intelligence report
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}
          </section>

          <section className={`${panelClass} min-h-[500px] p-5 sm:p-7`}>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={17} className="text-violet-300" />
                  <h2 className="text-lg font-semibold">AI output</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Generated insights and recommendations appear here.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Live workspace
              </span>
            </div>

            {generating && (
              <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 animate-ping rounded-2xl bg-violet-500/20" />
                  <div className="relative rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5 text-violet-300">
                    <BrainCircuit size={35} />
                  </div>
                </div>
                <h3 className="text-base font-semibold">Thinking through your project</h3>
                <p className="mt-2 max-w-xs text-xs leading-6 text-slate-500">
                  Gemini is processing your input and preparing structured recommendations.
                </p>
                <div className="mt-6 flex gap-1.5">
                  {[0, 1, 2].map((item) => (
                    <span
                      key={item}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400"
                      style={{ animationDelay: `${item * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {!generating && activeTab === "planner" && !plan && (
              <EmptyOutput
                icon={<ClipboardList size={30} />}
                title="Your roadmap starts here"
                description="Describe your project and generate a roadmap with milestones, tasks, estimated timelines and potential risks."
              />
            )}

            {!generating && activeTab === "planner" && plan && (
              <div className="space-y-5">
                <div className="rounded-xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.10] to-blue-500/[0.06] p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">
                      Generated roadmap
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock3 size={13} />
                      {plan.estimatedDuration || `${durationDays} days`}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">
                    {projectName || "Your project plan"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {plan.overview || "Your project roadmap is ready."}
                  </p>
                </div>

                {plan.recommendedApproach && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <Zap size={14} className="text-amber-300" />
                      Recommended approach
                    </p>
                    <p className="text-sm leading-6 text-slate-400">
                      {plan.recommendedApproach}
                    </p>
                  </div>
                )}

                {!!plan.milestones?.length && (
                  <div>
                    <SectionHeading icon={<Target size={15} />} title="Milestones" count={plan.milestones.length} />
                    <div className="mt-3 space-y-2">
                      {plan.milestones.map((milestone, index) => (
                        <div
                          key={index}
                          className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-xs font-bold text-violet-300">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200">
                              {milestone.title || milestone.name || `Milestone ${index + 1}`}
                            </p>
                            {milestone.description && (
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {milestone.description}
                              </p>
                            )}
                            {(milestone.day || milestone.targetDay) && (
                              <p className="mt-1 text-[10px] text-violet-300">
                                Target: Day {milestone.day || milestone.targetDay}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!!plan.tasks?.length && (
                  <div>
                    <SectionHeading icon={<ClipboardList size={15} />} title="Generated tasks" count={plan.tasks.length} />
                    <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
                      {plan.tasks.map((task, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="mt-0.5 text-xs text-slate-600">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-200">
                                  {task.title || "Untitled task"}
                                </p>
                                {task.description && (
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 rounded-md border border-violet-400/15 bg-violet-500/10 px-2 py-1 text-[9px] font-semibold text-violet-300">
                              {formatPriority(task.priority)}
                            </span>
                          </div>
                          {(task.suggestedDay || task.day || task.dueDay) && (
                            <p className="ml-6 mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                              <CalendarDays size={11} />
                              Suggested day {task.suggestedDay || task.day || task.dueDay}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!!plan.risks?.length && (
                  <div>
                    <SectionHeading icon={<AlertTriangle size={15} />} title="Potential risks" count={plan.risks.length} />
                    <div className="mt-3 space-y-2">
                      {plan.risks.map((risk, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-amber-400/10 bg-amber-500/[0.045] p-3 text-xs leading-5 text-slate-400"
                        >
                          {typeof risk === "string"
                            ? risk
                            : (
                              <>
                                <p className="font-medium text-amber-200">
                                  {risk.title || `Risk ${index + 1}`}
                                </p>
                                {risk.description && <p className="mt-1">{risk.description}</p>}
                                {risk.mitigation && <p className="mt-1 text-emerald-300">Mitigation: {risk.mitigation}</p>}
                              </>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-white/[0.08] pt-5">
                  <label className={labelClass}>Apply tasks to a project</label>
                  <div className="relative mb-3">
                    <select
                      className={`${inputClass} appearance-none pr-10`}
                      value={selectedProject}
                      onChange={(event) => setSelectedProject(event.target.value)}
                    >
                      <option value="">Choose destination project...</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-3.5 text-slate-500"
                    />
                  </div>
                  <button
                    onClick={() => void applyPlan()}
                    disabled={applying || !selectedProject || !plan.tasks?.length}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-semibold shadow-lg shadow-emerald-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {applying ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        Applying tasks ({appliedCount}/{plan.tasks?.length ?? 0})
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={17} />
                        Apply plan and create tasks
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center text-[10px] text-slate-500">
                    Review the generated tasks before applying. This action creates real tasks.
                  </p>
                </div>
              </div>
            )}

            {!generating && activeTab === "breakdown" && breakdown !== null && (
              <StructuredOutput data={breakdown} title="Objective breakdown" />
            )}

            {!generating && activeTab === "analysis" && analysis !== null && (
              <StructuredOutput data={analysis} title="Project intelligence report" />
            )}
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] py-5 text-[11px] text-slate-600">
          <span className="flex items-center gap-2">
            <Sparkles size={13} className="text-violet-400" />
            TaskFlow Intelligence
          </span>
          <span>AI-generated recommendations should be reviewed before use.</span>
        </footer>
      </div>
    </main>
  );
}

function EmptyOutput({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center px-5 text-center">
      <div className="mb-5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] p-5 text-violet-300">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
        {description}
      </p>
      <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-600">
        <span className="h-px w-8 bg-white/10" />
        Awaiting input
        <span className="h-px w-8 bg-white/10" />
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <span className="text-violet-300">{icon}</span>
        {title}
      </h3>
      <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-slate-400">
        {count}
      </span>
    </div>
  );
}

function StructuredOutput({
  data,
  title,
}: {
  data: unknown;
  title: string;
}) {
  const [showRaw, setShowRaw] = useState(false);

  const object =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

  const analysisText =
    object?.analysis && typeof object.analysis === "object"
      ? object.analysis as Record<string, unknown>
      : object?.analysis;

  const snapshot = object?.dataSnapshot;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.10] to-blue-500/[0.06] p-5">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">
          <Sparkles size={13} />
          AI generated
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-xs leading-6 text-slate-400">
          Review the recommendations below and use them to guide your next actions.
        </p>
      </div>

      {snapshot !== undefined && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <h4 className="mb-3 text-xs font-semibold text-slate-300">
            Project data snapshot
          </h4>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-400">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      )}

      {analysisText !== undefined && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <h4 className="mb-3 text-xs font-semibold text-slate-300">
            Analysis and recommendations
          </h4>
          {typeof analysisText === "string" ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {analysisText}
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(analysisText as Record<string, unknown>).map(
                ([key, value]) => (
                  <div key={key}>
                    <p className="mb-1 text-xs font-semibold capitalize text-violet-300">
                      {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-400">
                      {typeof value === "string"
                        ? value
                        : JSON.stringify(value, null, 2)}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-2 text-xs text-slate-500 transition hover:text-violet-300"
      >
        <ChevronDown
          size={14}
          className={showRaw ? "rotate-180 transition" : "transition"}
        />
        {showRaw ? "Hide" : "Show"} complete AI response
      </button>

      {showRaw && (
        <pre className="max-h-[350px] overflow-auto rounded-xl border border-white/[0.08] bg-[#0b0c19] p-4 text-xs leading-6 text-slate-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

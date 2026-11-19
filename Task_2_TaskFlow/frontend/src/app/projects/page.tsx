
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FolderKanban,
  Loader2,
  Plus,
  Search,
  Users,
  X,
  CalendarDays,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";

type ProjectMember = {
  id: string;
  role?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  members?: ProjectMember[];
  _count?: {
    tasks?: number;
  };
  createdAt?: string;
};

type ProjectResponse = {
  success: boolean;
  projects?: Project[];
  project?: Project;
  message?: string;
};

const projectColors = [
  { name: "Violet", value: "#8879ed", background: "#f0edff" },
  { name: "Blue", value: "#65a6db", background: "#edf6ff" },
  { name: "Green", value: "#65ae96", background: "#eaf7f1" },
  { name: "Orange", value: "#e6a46d", background: "#fff4e8" },
  { name: "Pink", value: "#d17c9c", background: "#fff0f5" },
];

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(projectColors[0].value);
  const [createError, setCreateError] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<ProjectResponse>("/projects");
      const result = response.data.projects;

      setProjects(Array.isArray(result) ? result : []);
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

      setError(message || "Couldn't load your projects. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    if (!projectName.trim()) {
      setCreateError("Please enter a project name.");
      return;
    }

    setCreating(true);

    try {
      const response = await api.post<ProjectResponse>("/projects", {
        name: projectName.trim(),
        description: description.trim(),
      });

      const createdProject = response.data.project;

      if (createdProject?.id) {
        setProjects((current) => [createdProject, ...current]);
      } else {
        await loadProjects();
      }

      setProjectName("");
      setDescription("");
      setSelectedColor(projectColors[0].value);
      setShowCreate(false);
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

      setCreateError(message || "Unable to create this project.");
    } finally {
      setCreating(false);
    }
  }

  const filteredProjects = projects.filter((project) => {
    const query = search.toLowerCase();

    return (
      project.name.toLowerCase().includes(query) ||
      (project.description || "").toLowerCase().includes(query)
    );
  });

  function getMemberInitials(name?: string) {
    if (!name) return "?";

    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-5 py-7 sm:px-9 sm:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-5 flex items-center gap-2 text-xs font-semibold text-[#9694a6] transition hover:text-[#7969df]"
            >
              <ArrowLeft size={15} /> Back to dashboard
            </button>

            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[1.5px] text-[#8879ed]">
              <LayoutGrid size={14} /> Workspace
            </div>

            <h1 className="font-[Manrope,sans-serif] text-3xl font-extrabold tracking-tight text-[#29263e] sm:text-4xl">
              Your projects<span className="text-[#8879ed]">.</span>
            </h1>

            <p className="mt-2 text-sm text-[#9694a6]">
              Bring your team together and keep every project moving.
            </p>
          </div>

          <button
            onClick={() => {
              setCreateError("");
              setShowCreate(true);
            }}
            className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#9384f4] to-[#7868df] px-5 text-xs font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5"
          >
            <Plus size={17} /> New project
          </button>
        </header>

        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#eeedf3] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs text-[#9694a6]">
              Total projects
              <FolderKanban size={18} className="text-[#8879ed]" />
            </div>
            <strong className="text-3xl font-extrabold text-[#302e43]">
              {loading ? "—" : projects.length}
            </strong>
            <p className="mt-1 text-[10px] text-[#aaa8b6]">
              Projects you belong to
            </p>
          </div>

          <div className="rounded-2xl border border-[#eeedf3] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs text-[#9694a6]">
              Total tasks
              <Check size={18} className="text-[#65ae96]" />
            </div>
            <strong className="text-3xl font-extrabold text-[#302e43]">
              {loading
                ? "—"
                : projects.reduce(
                    (total, project) =>
                      total + (project._count?.tasks || 0),
                    0
                  )}
            </strong>
            <p className="mt-1 text-[10px] text-[#aaa8b6]">
              Tasks across your projects
            </p>
          </div>

          <div className="rounded-2xl border border-[#eeedf3] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs text-[#9694a6]">
              Collaborators
              <Users size={18} className="text-[#65a6db]" />
            </div>
            <strong className="text-3xl font-extrabold text-[#302e43]">
              {loading
                ? "—"
                : new Set(
                    projects.flatMap((project) =>
                      (project.members || []).map(
                        (member) => member.user?.id
                      )
                    )
                  ).size}
            </strong>
            <p className="mt-1 text-[10px] text-[#aaa8b6]">
              Unique project members
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#eeedf3] bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-[#302e43]">
                All projects
              </h2>
              <p className="mt-1 text-xs text-[#a09eae]">
                Your projects and collaborative workspaces
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-10 w-52 items-center gap-2 rounded-lg border border-[#eeedf3] bg-[#fcfcfe] px-3">
                <Search size={15} className="text-[#aaa8b6]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects..."
                  className="w-full bg-transparent text-xs text-[#454357] outline-none placeholder:text-[#b0aebb]"
                />
              </div>

              <button
                onClick={loadProjects}
                title="Refresh projects"
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#eeedf3] text-[#9694a6] transition hover:bg-[#f5f3ff] hover:text-[#7969df]"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-[#9694a6]">
              <Loader2 size={25} className="animate-spin text-[#8879ed]" />
              <p className="text-xs">Loading your projects...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <p className="mb-3 text-sm font-semibold text-red-500">{error}</p>
              <button
                onClick={loadProjects}
                className="rounded-lg bg-[#f0edff] px-4 py-2 text-xs font-bold text-[#7969df]"
              >
                Try again
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#f0edff] text-[#8879ed]">
                <FolderKanban size={28} />
              </div>
              <h3 className="text-base font-bold text-[#454357]">
                {search ? "No matching projects" : "Your workspace starts here"}
              </h3>
              <p className="mt-2 max-w-sm text-xs leading-6 text-[#a09eae]">
                {search
                  ? "Try another search term."
                  : "Create your first project and invite your teammates to collaborate."}
              </p>
              {!search && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-5 flex items-center gap-2 rounded-lg bg-[#8879ed] px-4 py-2.5 text-xs font-bold text-white"
                >
                  <Plus size={15} /> Create your first project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((project, index) => {
                const color = projectColors[index % projectColors.length];

                return (
                  <motion.button
                    key={project.id}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    onClick={() =>
                      router.push(`/projects/${project.id}`)
                    }
                    className="group rounded-xl border border-[#eeedf3] bg-white p-5 text-left transition hover:-translate-y-1 hover:border-[#d9d2ff] hover:shadow-lg hover:shadow-violet-100/50"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div
                        className="grid h-11 w-11 place-items-center rounded-xl"
                        style={{
                          background: color.background,
                          color: color.value,
                        }}
                      >
                        <FolderKanban size={21} />
                      </div>

                      <ArrowUpRight
                        size={17}
                        className="text-[#c0bdcc] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#8879ed]"
                      />
                    </div>

                    <h3 className="truncate text-sm font-extrabold text-[#39374d]">
                      {project.name}
                    </h3>

                    <p className="mt-2 min-h-10 line-clamp-2 text-xs leading-5 text-[#a09eae]">
                      {project.description || "No project description yet."}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-[#f1f0f5] pt-4">
                      <div className="flex items-center gap-2 text-[10px] text-[#9694a6]">
                        <Users size={13} />
                        {project.members?.length || 0} members
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-[#9694a6]">
                        <Check size={13} />
                        {project._count?.tasks || 0} tasks
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[10px] text-[#aaa8b6]">
                        Owner: {project.owner?.name || "Project owner"}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: color.value }}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-6 flex items-center justify-between text-[10px] text-[#aaa8b6]">
          <span>TaskFlow · Collaborative workspace</span>
          <span>{projects.length} projects loaded</span>
        </footer>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#201c35a6] p-4 backdrop-blur-sm"
          onClick={() => !creating && setShowCreate(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#eeedf3] bg-white p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <span className="text-[9px] font-extrabold tracking-[1.4px] text-[#8879ed]">
                  NEW WORKSPACE
                </span>
                <h2 className="mt-1 text-xl font-extrabold text-[#302e43]">
                  Create a project
                </h2>
                <p className="mt-1 text-xs text-[#a09eae]">
                  Give your team a place to collaborate.
                </p>
              </div>

              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="rounded-lg p-2 text-[#9997a8] hover:bg-[#f5f3ff]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <label
                htmlFor="project-name"
                className="mb-2 block text-xs font-bold text-[#555268]"
              >
                Project name
              </label>

              <input
                id="project-name"
                autoFocus
                required
                maxLength={80}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. Website redesign"
                className="h-11 w-full rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs text-[#454357] outline-none focus:border-[#a69bf0]"
              />

              <label
                htmlFor="project-description"
                className="mb-2 mt-5 block text-xs font-bold text-[#555268]"
              >
                Description
              </label>

              <textarea
                id="project-description"
                rows={3}
                maxLength={300}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this project about?"
                className="w-full resize-none rounded-lg border border-[#eae9f0] bg-[#fcfcfe] p-3 text-xs text-[#454357] outline-none focus:border-[#a69bf0]"
              />

              <div className="mb-2 mt-5 text-xs font-bold text-[#555268]">
                Project colour
              </div>

              <div className="mb-5 flex items-center gap-3">
                {projectColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={`${color.name} project colour`}
                    onClick={() => setSelectedColor(color.value)}
                    className="grid h-8 w-8 place-items-center rounded-full transition hover:scale-110"
                    style={{ background: color.value }}
                  >
                    {selectedColor === color.value && (
                      <Check size={15} className="text-white" />
                    )}
                  </button>
                ))}
              </div>

              {createError && (
                <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                  {createError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-[#eae9f0] px-4 py-2.5 text-xs font-bold text-[#777589]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating || !projectName.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[#8879ed] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Create project
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </main>
  );
}

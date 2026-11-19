
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import api from "@/lib/api";

type Member = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Project = {
  id: string;
  name: string;
  members: Member[];
};

export default function ProjectTeamPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/projects/${projectId}`);
      setProject(response.data.project);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;

      setError(message || "Unable to load project members.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setInviting(true);

    try {
      const response = await api.post(
        `/projects/${projectId}/members`,
        {
          email: email.trim().toLowerCase(),
          role,
        }
      );

      setSuccess(response.data.message || "Member added successfully.");
      setEmail("");
      await loadProject();
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;

      setError(message || "Unable to add this member.");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(member: Member) {
    const confirmed = window.confirm(
      `Remove ${member.user.name} from this project?`
    );

    if (!confirmed) return;

    setRemoving(member.user.id);
    setError("");
    setSuccess("");

    try {
      const response = await api.delete(
        `/projects/${projectId}/members/${member.user.id}`
      );

      setSuccess(response.data.message || "Member removed.");
      await loadProject();
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;

      setError(message || "Unable to remove this member.");
    } finally {
      setRemoving(null);
    }
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-5 py-8 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="mb-7 flex items-center gap-2 text-xs font-semibold text-[#9694a6] hover:text-[#7969df]"
        >
          <ArrowLeft size={15} /> Back to project
        </button>

        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[1.4px] text-[#8879ed]">
            <Users size={14} /> TEAM MANAGEMENT
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#29263e]">
            Project team<span className="text-[#8879ed]">.</span>
          </h1>
          <p className="mt-2 text-xs text-[#9694a6]">
            {project?.name || "Manage members and collaboration access."}
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-[#eeedf3] bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-sm font-extrabold text-[#39374d]">
              Invite a teammate
            </h2>
            <p className="mt-1 text-[10px] leading-5 text-[#a09eae]">
              Add an existing TaskFlow user by their registered email address.
            </p>
          </div>

          <form onSubmit={inviteMember} className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
            <div className="flex h-11 items-center gap-2 rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3">
              <Mail size={15} className="text-[#a09eae]" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>

            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="h-11 rounded-lg border border-[#eae9f0] bg-[#fcfcfe] px-3 text-xs outline-none"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>

            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#8879ed] px-5 text-xs font-bold text-white disabled:opacity-50"
            >
              {inviting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              {inviting ? "Adding..." : "Add member"}
            </button>
          </form>

          <p className="mt-3 text-[9px] text-[#aaa8b6]">
            The invited person must already have a TaskFlow account. This adds
            them directly to the project.
          </p>

          {success && (
            <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
              {success}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
              {error}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#eeedf3] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#eeedf3] p-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#39374d]">
                Members
              </h2>
              <p className="mt-1 text-[10px] text-[#a09eae]">
                {project?.members.length || 0} project members
              </p>
            </div>

            <button
              onClick={loadProject}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#eae9f0] text-[#9694a6] hover:text-[#8879ed]"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-44 items-center justify-center gap-3 text-xs text-[#9694a6]">
              <Loader2 size={19} className="animate-spin text-[#8879ed]" />
              Loading team...
            </div>
          ) : (
            <div>
              {(project?.members || []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 border-b border-[#f1f0f5] p-5 last:border-0"
                >
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[10px] font-extrabold text-[#7868df]">
                    {initials(member.user.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xs font-bold text-[#514e64]">
                      {member.user.name}
                    </h3>
                    <p className="mt-1 truncate text-[10px] text-[#a09eae]">
                      {member.user.email}
                    </p>
                  </div>

                  <span className="flex items-center gap-1 rounded-md bg-[#f4f2ff] px-2.5 py-1.5 text-[9px] font-bold text-[#7969df]">
                    <Shield size={11} /> {member.role}
                  </span>

                  <button
                    onClick={() => removeMember(member)}
                    disabled={
                      removing === member.user.id ||
                      member.role === "OWNER"
                    }
                    title={
                      member.role === "OWNER"
                        ? "Project owner cannot be removed"
                        : "Remove member"
                    }
                    className="grid h-8 w-8 place-items-center rounded-lg text-[#b3afbe] transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {removing === member.user.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              ))}

              {(project?.members || []).length === 0 && (
                <div className="p-10 text-center text-xs text-[#a09eae]">
                  No members found.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

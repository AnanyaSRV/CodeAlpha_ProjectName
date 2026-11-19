
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import api, { AuthResponse, saveSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post<AuthResponse>("/auth/login", {
        email,
        password,
      });

      if (!response.data.success || !response.data.token) {
        throw new Error(response.data.message || "Unable to sign in.");
      }

      saveSession(response.data);
      router.replace("/");
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
        };
        setError(
          axiosError.response?.data?.message ||
            "Login failed. Check your details and try again."
        );
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] flex items-center justify-center p-5">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[440px] rounded-3xl border border-[#eeedf3] bg-white p-8 shadow-[0_20px_70px_rgba(40,35,80,0.08)] sm:p-10"
      >
        <Link href="/" className="mb-10 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#a99cff] to-[#7768e5] text-xl font-bold text-white shadow-lg shadow-violet-200">
            ⌘
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-[#29263e]">
            taskflow<span className="text-[#8879ed]">.</span>
          </span>
        </Link>

        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[1.5px] text-[#8879ed]">
            <Sparkles size={14} /> Welcome back
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#29263e]">
            Sign in to TaskFlow
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#9694a6]">
            Pick up where you left off. Your team is waiting.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-bold text-[#555268]">
              Email address
            </label>
            <div className="flex h-12 items-center gap-3 rounded-xl border border-[#eae9f0] bg-[#fcfcfe] px-4 focus-within:border-[#a69bf0]">
              <Mail size={17} className="text-[#a09eae]" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-full w-full bg-transparent text-sm text-[#454357] outline-none placeholder:text-[#b0aebb]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-bold text-[#555268]">
              Password
            </label>
            <div className="flex h-12 items-center gap-3 rounded-xl border border-[#eae9f0] bg-[#fcfcfe] px-4 focus-within:border-[#a69bf0]">
              <LockKeyhole size={17} className="text-[#a09eae]" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-full w-full bg-transparent text-sm text-[#454357] outline-none placeholder:text-[#b0aebb]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#a09eae] hover:text-[#7768dc]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9384f4] to-[#7868df] text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[#9694a6]">
          New to TaskFlow?{" "}
          <Link href="/register" className="font-bold text-[#7969df] hover:underline">
            Create an account
          </Link>
        </p>

        <p className="mt-8 text-center text-[10px] text-[#b0aebb]">
          Secure workspace access · TaskFlow
        </p>
      </motion.div>
    </main>
  );
}


import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("taskflow_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      error.response?.status === 401 &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/register")
    ) {
      localStorage.removeItem("taskflow_token");
      localStorage.removeItem("taskflow_user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export type TaskFlowUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: TaskFlowUser;
};

export function saveSession(data: AuthResponse) {
  localStorage.setItem("taskflow_token", data.token);
  localStorage.setItem("taskflow_user", JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem("taskflow_token");
  localStorage.removeItem("taskflow_user");
}

export function getSavedUser(): TaskFlowUser | null {
  if (typeof window === "undefined") return null;

  const savedUser = localStorage.getItem("taskflow_user");

  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser) as TaskFlowUser;
  } catch {
    localStorage.removeItem("taskflow_user");
    return null;
  }
}

export default api;

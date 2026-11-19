
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("taskflow_token");

  if (!token) return null;

  if (socket?.connected) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
    {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    }
  );

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

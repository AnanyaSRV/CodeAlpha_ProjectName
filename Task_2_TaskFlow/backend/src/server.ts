import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";

import { prisma } from "./config/database";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import notificationRoutes from "./routes/notifications";
import aiRoutes from "./routes/ai";
import projectAiRoutes from "./routes/project-ai";
import workloadRoutes from "./routes/workload";
import dependencyRoutes from "./routes/dependencies";
import { verifyToken } from "./utils/tokens";

const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:3000";

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);

app.use(helmet());

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// HEALTH CHECK
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "TaskFlow API is running",
    timestamp: new Date().toISOString(),
  });
});

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai", projectAiRoutes);
app.use("/api/workload", workloadRoutes);
app.use("/api/dependencies", dependencyRoutes);

// SOCKET AUTHENTICATION
io.use(async (socket, next) =>  {
  try {
    const token = socket.handshake.auth?.token;

    if (typeof token !== "string") {
      return next(new Error("Authentication required"));
    }

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    if (!user) {
      return next(new Error("User account not found"));
    }

    socket.data.userId = user.id;
    next();
  } catch {
    next(new Error("Invalid authentication token"));
  }
});

// SOCKET CONNECTION
io.on("connection", (socket) => {
  const userId = socket.data.userId as string;

  console.log(`User connected: ${userId}`);

  // Private notification room
  socket.join(`user:${userId}`);

  socket.on("project:join", async (projectId: string) => {
    try {
      if (
        typeof projectId !== "string" ||
        !projectId ||
        projectId.length > 100
      ) {
        return;
      }

      const membership = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      });

      if (!membership) {
        socket.emit("socket:error", {
          message: "You are not a member of this project",
        });
        return;
      }

      socket.join(`project:${projectId}`);

      socket.emit("project:joined", { projectId });

      socket.to(`project:${projectId}`).emit("member:online", {
        userId,
      });
    } catch (error) {
      console.error("Project socket error:", error);
    }
  });

  socket.on("project:leave", (projectId: string) => {
    if (typeof projectId === "string") {
      socket.leave(`project:${projectId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId}`);
  });
});

// 404 HANDLER
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// SERVER START
async function startServer() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected successfully");

    if (!process.env.GEMINI_API_KEY) {
      console.warn(
        "WARNING: GEMINI_API_KEY is missing. AI endpoints will not work."
      );
    } else {
      console.log("Gemini AI configuration detected");
    }

    httpServer.listen(PORT, () => {
      console.log(`TaskFlow API running at http://localhost:${PORT}`);
      console.log("Socket.IO server ready");
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();

// GRACEFUL SHUTDOWN
async function shutdown() {
  console.log("Shutting down TaskFlow...");

  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
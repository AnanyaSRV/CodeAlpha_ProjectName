
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

async function getMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });
}

const dependencySchema = z.object({
  taskId: z.string().min(1),
  dependsOnTaskId: z.string().min(1),
});

function hasPath(
  graph: Map<string, string[]>,
  start: string,
  target: string
): boolean {
  const visited = new Set<string>();
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current === target) return true;
    if (visited.has(current)) continue;

    visited.add(current);

    for (const next of graph.get(current) || []) {
      if (!visited.has(next)) stack.push(next);
    }
  }

  return false;
}

// GET PROJECT DEPENDENCIES + BLOCKED TASKS
router.get("/project/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;

    const membership = await getMembership(projectId, req.user!.id);

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project.",
      });
    }

    const [tasks, dependencies] = await Promise.all([
      prisma.task.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          assignee: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.taskDependency.findMany({
        where: { projectId },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
            },
          },
          dependsOn: {
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    const blockedTasks = tasks
      .filter((task) => task.status !== "DONE")
      .map((task) => {
        const blockers = dependencies
          .filter(
            (dependency) =>
              dependency.taskId === task.id &&
              dependency.dependsOn.status !== "DONE"
          )
          .map((dependency) => dependency.dependsOn);

        return {
          taskId: task.id,
          title: task.title,
          blocked: blockers.length > 0,
          blockers,
        };
      })
      .filter((item) => item.blocked);

    const dependencySummary = dependencies.map((dependency) => ({
      ...dependency,
      blocked:
        dependency.task.status !== "DONE" &&
        dependency.dependsOn.status !== "DONE",
    }));

    return res.json({
      success: true,
      projectId,
      tasks,
      dependencies: dependencySummary,
      blockedTasks,
      summary: {
        totalTasks: tasks.length,
        totalDependencies: dependencies.length,
        blockedTasks: blockedTasks.length,
        completedTasks: tasks.filter((task) => task.status === "DONE").length,
      },
    });
  } catch (error) {
    console.error("Get dependencies error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve task dependencies.",
    });
  }
});

// CREATE DEPENDENCY
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = dependencySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid dependency details.",
        errors: parsed.error.flatten(),
      });
    }

    const { taskId, dependsOnTaskId } = parsed.data;

    if (taskId === dependsOnTaskId) {
      return res.status(400).json({
        success: false,
        message: "A task cannot depend on itself.",
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, title: true },
    });

    const prerequisite = await prisma.task.findUnique({
      where: { id: dependsOnTaskId },
      select: { id: true, projectId: true, title: true },
    });

    if (!task || !prerequisite) {
      return res.status(404).json({
        success: false,
        message: "One or both tasks could not be found.",
      });
    }

    if (task.projectId !== prerequisite.projectId) {
      return res.status(400).json({
        success: false,
        message: "Dependencies must belong to the same project.",
      });
    }

    const membership = await getMembership(task.projectId, req.user!.id);

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project.",
      });
    }

    const existing = await prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnTaskId: {
          taskId,
          dependsOnTaskId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This dependency already exists.",
      });
    }

    // Graph direction: task -> prerequisite.
    // Adding task -> prerequisite is invalid if prerequisite can already reach task.
    const allEdges = await prisma.taskDependency.findMany({
      where: { projectId: task.projectId },
      select: { taskId: true, dependsOnTaskId: true },
    });

    const graph = new Map<string, string[]>();

    for (const edge of allEdges) {
      const current = graph.get(edge.taskId) || [];
      current.push(edge.dependsOnTaskId);
      graph.set(edge.taskId, current);
    }

    if (hasPath(graph, dependsOnTaskId, taskId)) {
      return res.status(400).json({
        success: false,
        message:
          "This dependency would create a circular chain. Choose a different prerequisite.",
      });
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        projectId: task.projectId,
        taskId,
        dependsOnTaskId,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
          },
        },
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    await prisma.activity.create({
      data: {
        projectId: task.projectId,
        userId: req.user!.id,
        action: "created a task dependency",
        details: `${task.title} depends on ${prerequisite.title}`,
      },
    });

    const io = req.app.get("io");

    io?.to(`project:${task.projectId}`).emit("dependency:created", {
      dependency,
    });

    return res.status(201).json({
      success: true,
      message: "Dependency created successfully.",
      dependency,
    });
  } catch (error) {
    console.error("Create dependency error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create dependency.",
    });
  }
});

// DELETE DEPENDENCY
router.delete("/:dependencyId", async (req: Request, res: Response) => {
  try {
    const dependencyId = req.params.dependencyId;

    const dependency = await prisma.taskDependency.findUnique({
      where: { id: dependencyId },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        dependsOnTaskId: true,
      },
    });

    if (!dependency) {
      return res.status(404).json({
        success: false,
        message: "Dependency not found.",
      });
    }

    const membership = await getMembership(
      dependency.projectId,
      req.user!.id
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project.",
      });
    }

    await prisma.taskDependency.delete({
      where: { id: dependencyId },
    });

    await prisma.activity.create({
      data: {
        projectId: dependency.projectId,
        userId: req.user!.id,
        action: "removed a task dependency",
        details: dependency.id,
      },
    });

    const io = req.app.get("io");

    io?.to(`project:${dependency.projectId}`).emit("dependency:deleted", {
      dependencyId,
    });

    return res.json({
      success: true,
      message: "Dependency removed successfully.",
    });
  } catch (error) {
    console.error("Delete dependency error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to remove dependency.",
    });
  }
});

export default router;

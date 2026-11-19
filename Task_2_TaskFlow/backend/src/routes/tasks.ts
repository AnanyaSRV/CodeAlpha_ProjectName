
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

async function getMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
  });
}

async function getTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) return null;

  const membership = await getMembership(task.projectId, userId);

  return membership ? task : null;
}

const taskSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().max(3000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  position: z.number().optional(),
});

// GET TASKS IN A PROJECT
router.get("/project/:projectId", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const membership = await getMembership(projectId, req.user!.id);

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, avatar: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });

    return res.json({ success: true, tasks });
  } catch (error) {
    console.error("Get tasks error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve tasks",
    });
  }
});

// GET MY TASKS
router.get("/my-tasks", async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: req.user!.id,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return res.json({ success: true, tasks });
  } catch (error) {
    console.error("My tasks error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your tasks",
    });
  }
});

// CREATE TASK
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = taskSchema.extend({
      projectId: z.string().min(1),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid task details",
        errors: parsed.error.flatten(),
      });
    }

    const {
      projectId,
      title,
      description,
      priority,
      status,
      assigneeId,
      dueDate,
      position,
    } = parsed.data;

    const membership = await getMembership(projectId, req.user!.id);

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    if (assigneeId) {
      const assigneeMembership = await getMembership(projectId, assigneeId);

      if (!assigneeMembership) {
        return res.status(400).json({
          success: false,
          message: "Assignee must be a member of this project",
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        priority,
        status,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null,
        position,
        creatorId: req.user!.id,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    await prisma.activity.create({
      data: {
        projectId,
        userId: req.user!.id,
        action: "created a task",
        details: title,
      },
    });

    const io = req.app.get("io");

    io?.to(`project:${projectId}`).emit("task:created", { task });

    if (assigneeId && assigneeId !== req.user!.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          title: "New task assigned",
          message: `You have been assigned "${title}"`,
          link: `/projects/${projectId}?taskId=${task.id}`,
        },
      });

      io?.to(`user:${assigneeId}`).emit("notification:new", {
        notification,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create task",
    });
  }
});

// UPDATE TASK
router.patch("/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const parsed = taskSchema.partial().safeParse(req.body);

    if (
      !parsed.success ||
      Object.keys(parsed.data || {}).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid task updates",
      });
    }

    const taskAccess = await getTaskAccess(taskId, req.user!.id);

    if (!taskAccess) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied",
      });
    }

    const updates = parsed.data;

    if (updates.assigneeId) {
      const assigneeMembership = await getMembership(
        taskAccess.projectId,
        updates.assigneeId
      );

      if (!assigneeMembership) {
        return res.status(400).json({
          success: false,
          message: "Assignee must be a project member",
        });
      }
    }

    const oldTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!oldTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...updates,
        dueDate:
          updates.dueDate === undefined
            ? undefined
            : updates.dueDate
              ? new Date(updates.dueDate)
              : null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true },
        },
        _count: { select: { comments: true } },
      },
    });

    await prisma.activity.create({
      data: {
        projectId: taskAccess.projectId,
        userId: req.user!.id,
        action: "updated a task",
        details: task.title,
      },
    });

    const io = req.app.get("io");

    io?.to(`project:${taskAccess.projectId}`).emit("task:updated", {
      task,
    });

    if (
      task.assigneeId &&
      task.assigneeId !== req.user!.id &&
      task.assigneeId !== oldTask.assigneeId
    ) {
      const notification = await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: "TASK_ASSIGNED",
          title: "Task assigned to you",
          message: `You have been assigned "${task.title}"`,
          link: `/projects/${task.projectId}?taskId=${task.id}`,
        },
      });

      io?.to(`user:${task.assigneeId}`).emit("notification:new", {
        notification,
      });
    }

    return res.json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update task",
    });
  }
});

// DELETE TASK
router.delete("/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const taskAccess = await getTaskAccess(taskId, req.user!.id);

    if (!taskAccess) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied",
      });
    }

    await prisma.task.delete({ where: { id: taskId } });

    const io = req.app.get("io");

    io?.to(`project:${taskAccess.projectId}`).emit("task:deleted", {
      taskId,
    });

    return res.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete task",
    });
  }
});

// ADD COMMENT
router.post("/:taskId/comments", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const parsed = z.object({
      content: z.string().trim().min(1).max(2000),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    const taskAccess = await getTaskAccess(taskId, req.user!.id);

    if (!taskAccess) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied",
      });
    }

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId: req.user!.id,
        content: parsed.data.content,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true, assigneeId: true, creatorId: true },
    });

    const io = req.app.get("io");

    io?.to(`project:${taskAccess.projectId}`).emit("comment:created", {
      taskId,
      comment,
    });

    const recipients = new Set(
      [task?.assigneeId, task?.creatorId].filter(
        (id): id is string =>
          Boolean(id) && id !== req.user!.id
      )
    );

    for (const userId of recipients) {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: "COMMENT_ADDED",
          title: "New task comment",
          message: `New comment on "${task?.title}"`,
          link: `/projects/${taskAccess.projectId}?taskId=${taskId}`,
        },
      });

      io?.to(`user:${userId}`).emit("notification:new", {
        notification,
      });
    }

    await prisma.activity.create({
      data: {
        projectId: taskAccess.projectId,
        userId: req.user!.id,
        action: "commented on a task",
        details: task?.title,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("Comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add comment",
    });
  }
});

export default router;

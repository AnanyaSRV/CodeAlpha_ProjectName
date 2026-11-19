
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

async function getMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
  });
}

// GET ALL USER PROJECTS
router.get("/", async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: { userId: req.user!.id },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ success: true, projects });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve projects",
    });
  }
});

// CREATE PROJECT
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = projectSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid project details",
        errors: parsed.error.flatten(),
      });
    }

    const { name, description, color } = parsed.data;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        color,
        ownerId: req.user!.id,
        members: {
          create: {
            userId: req.user!.id,
            role: "OWNER",
          },
        },
        activities: {
          create: {
            userId: req.user!.id,
            action: "created the project",
            details: name,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create project",
    });
  }
});

// GET PROJECT DETAILS
router.get("/:projectId", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const membership = await getMembership(projectId, req.user!.id);

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, avatar: true },
            },
            creator: {
              select: { id: true, name: true },
            },
            _count: { select: { comments: true } },
          },
          orderBy: { position: "asc" },
        },
        activities: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    return res.json({ success: true, project });
  } catch (error) {
    console.error("Project details error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve project",
    });
  }
});

// UPDATE PROJECT
router.patch("/:projectId", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const parsed = projectSchema.partial().safeParse(req.body);

    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide valid project details",
      });
    }

    const membership = await getMembership(projectId, req.user!.id);

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: "Only project owners and admins can update this project",
      });
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: parsed.data,
    });

    return res.json({
      success: true,
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    console.error("Update project error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update project",
    });
  }
});

// DELETE PROJECT
router.delete("/:projectId", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const membership = await getMembership(projectId, req.user!.id);

    if (membership?.role !== "OWNER") {
      return res.status(403).json({
        success: false,
        message: "Only the project owner can delete this project",
      });
    }

    await prisma.project.delete({ where: { id: projectId } });

    return res.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Delete project error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete project",
    });
  }
});

// ADD PROJECT MEMBER BY EMAIL
router.post("/:projectId/members", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const parsed = z.object({
      email: z.string().trim().email().transform(v => v.toLowerCase()),
      role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    const membership = await getMembership(projectId, req.user!.id);

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: "You cannot invite members to this project",
      });
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, name: true, email: true },
    });

    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: "No registered user found with this email",
      });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const existing = await getMembership(projectId, invitedUser.id);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "User is already a project member",
      });
    }

    const [newMember] = await prisma.$transaction([
      prisma.projectMember.create({
        data: {
          projectId,
          userId: invitedUser.id,
          role: parsed.data.role,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      }),
      prisma.notification.create({
        data: {
          userId: invitedUser.id,
          type: "PROJECT_INVITATION",
          title: "Added to a project",
          message: `You have been added to ${project.name}`,
          link: `/projects/${projectId}`,
        },
      }),
      prisma.activity.create({
        data: {
          projectId,
          userId: req.user!.id,
          action: "added a team member",
          details: invitedUser.name,
        },
      }),
    ]);

    const io = req.app.get("io");
    io?.to(`user:${invitedUser.id}`).emit("notification:new", {
      type: "PROJECT_INVITATION",
      title: "Added to a project",
      message: `You have been added to ${project.name}`,
      link: `/projects/${projectId}`,
    });

    io?.to(`project:${projectId}`).emit("project:member-added", {
      projectId,
      member: newMember,
    });

    return res.status(201).json({
      success: true,
      message: "Member added successfully",
      member: newMember,
    });
  } catch (error) {
    console.error("Add member error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add project member",
    });
  }
});

// REMOVE PROJECT MEMBER
router.delete("/:projectId/members/:userId", async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.params;

    const actor = await getMembership(projectId, req.user!.id);
    const target = await getMembership(projectId, userId);

    if (!actor || !target) {
      return res.status(404).json({
        success: false,
        message: "Project membership not found",
      });
    }

    if (target.role === "OWNER") {
      return res.status(400).json({
        success: false,
        message: "The project owner cannot be removed",
      });
    }

    if (
      actor.role !== "OWNER" &&
      !(actor.role === "ADMIN" && target.role === "MEMBER")
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot remove this member",
      });
    }

    await prisma.projectMember.delete({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    const io = req.app.get("io");

// Remove only the deleted member's active sockets from this project.
io?.in(`user:${userId}`).socketsLeave(`project:${projectId}`);

io?.to(`project:${projectId}`).emit("project:member-removed", {
  projectId,
  userId,
});

    return res.json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Remove member error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to remove member",
    });
  }
});

export default router;

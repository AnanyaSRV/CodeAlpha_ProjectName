
import { Router, Request, Response } from "express";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// GET NOTIFICATIONS
router.get("/", async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        isRead: false,
      },
    });

    return res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve notifications",
    });
  }
});

// MARK NOTIFICATION AS READ
router.patch("/:notificationId/read", async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: req.user!.id,
      },
      data: { isRead: true },
    });

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update notification",
    });
  }
});

// MARK ALL AS READ
router.patch("/read-all", async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update notifications",
    });
  }
});

export default router;

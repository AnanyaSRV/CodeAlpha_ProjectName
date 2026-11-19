
import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../config/database";

const router = Router();

router.use(authenticate);

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

function getLoadStatus(
  activeTasks: number,
  averageTasks: number
): "LIGHT" | "BALANCED" | "BUSY" | "OVERLOADED" {
  if (activeTasks === 0) return "LIGHT";
  if (averageTasks === 0) return "BALANCED";

  if (activeTasks >= Math.max(5, Math.ceil(averageTasks * 1.6))) {
    return "OVERLOADED";
  }

  if (activeTasks >= Math.max(3, Math.ceil(averageTasks * 1.2))) {
    return "BUSY";
  }

  if (activeTasks < averageTasks * 0.65) {
    return "LIGHT";
  }

  return "BALANCED";
}

router.get(
  "/:projectId",
  async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId;

      if (
        typeof projectId !== "string" ||
        !projectId ||
        projectId.length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID.",
        });
      }

      const userId = req.user!.id;

      const membership = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this project.",
        });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          members: {
            select: {
              role: true,
              user: {
                select: {
                  id: true,
                  name: true,
                                  email: true,
                },
              },
            },
          },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
              updatedAt: true,
              assigneeId: true,
              assignee: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            take: 500,
          },
        },
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found.",
        });
      }

      const now = new Date();

      const activeTasks = project.tasks.filter(
        (task) => task.status !== "DONE"
      );

      const completedTasks = project.tasks.filter(
        (task) => task.status === "DONE"
      );

      const overdueTasks = activeTasks.filter(
        (task) =>
          task.dueDate !== null &&
          task.dueDate.getTime() < now.getTime()
      );

      const urgentTasks = activeTasks.filter(
        (task) => task.priority === "URGENT"
      );

      const highPriorityTasks = activeTasks.filter(
        (task) =>
          task.priority === "HIGH" ||
          task.priority === "URGENT"
      );

      const unassignedTasks = activeTasks.filter(
        (task) => !task.assigneeId
      );

      const memberMap = new Map<
        string,
        {
          id: string;
          name: string;
          email: string;
          role: string;
          totalAssigned: number;
          activeTasks: number;
          completedTasks: number;
          overdueTasks: number;
          urgentTasks: number;
          highPriorityTasks: number;
          inProgressTasks: number;
          todoTasks: number;
          inReviewTasks: number;
          tasks: typeof project.tasks;
        }
      >();

      for (const member of project.members) {
        memberMap.set(member.user.id, {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          role: member.role,
          totalAssigned: 0,
          activeTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          urgentTasks: 0,
          highPriorityTasks: 0,
          inProgressTasks: 0,
          todoTasks: 0,
          inReviewTasks: 0,
          tasks: [],
        });
      }

      for (const task of project.tasks) {
        if (!task.assigneeId) continue;

        const member = memberMap.get(task.assigneeId);
        if (!member) continue;

        member.totalAssigned += 1;
        member.tasks.push(task);

        if (task.status === "DONE") {
          member.completedTasks += 1;
          continue;
        }

        member.activeTasks += 1;

        if (task.status === "IN_PROGRESS") {
          member.inProgressTasks += 1;
        }

        if (task.status === "TODO") {
          member.todoTasks += 1;
        }

        if (task.status === "IN_REVIEW") {
          member.inReviewTasks += 1;
        }

        if (
          task.dueDate &&
          task.dueDate.getTime() < now.getTime()
        ) {
          member.overdueTasks += 1;
        }

        if (task.priority === "URGENT") {
          member.urgentTasks += 1;
        }

        if (
          task.priority === "HIGH" ||
          task.priority === "URGENT"
        ) {
          member.highPriorityTasks += 1;
        }
      }

      const members = Array.from(memberMap.values());

      const averageActiveTasks =
        members.length === 0
          ? 0
          : activeTasks.length / members.length;

      const memberWorkload = members
        .map((member) => {
          const loadStatus = getLoadStatus(
            member.activeTasks,
            averageActiveTasks
          );

          const completionRate =
            member.totalAssigned === 0
              ? 0
              : Math.round(
                  (member.completedTasks / member.totalAssigned) * 100
                );

          const loadScore =
            averageActiveTasks === 0
              ? 0
              : Math.round(
                  (member.activeTasks / averageActiveTasks) * 100
                );

          return {
            id: member.id,
            name: member.name,
            role: member.role,
            totalAssigned: member.totalAssigned,
            activeTasks: member.activeTasks,
            completedTasks: member.completedTasks,
            completionRate,
            overdueTasks: member.overdueTasks,
            urgentTasks: member.urgentTasks,
            highPriorityTasks: member.highPriorityTasks,
            inProgressTasks: member.inProgressTasks,
            todoTasks: member.todoTasks,
            inReviewTasks: member.inReviewTasks,
            loadScore,
            loadStatus,
            tasks: member.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
            })),
          };
        })
        .sort((a, b) => b.activeTasks - a.activeTasks);

      const overloadedMembers = memberWorkload.filter(
        (member) => member.loadStatus === "OVERLOADED"
      );

      const busyMembers = memberWorkload.filter(
        (member) => member.loadStatus === "BUSY"
      );

      const lightMembers = memberWorkload.filter(
        (member) =>
          member.loadStatus === "LIGHT" &&
          member.activeTasks === 0
      );

      const redistributionSuggestions: Array<{
        fromMember: string;
        fromMemberId: string;
        toMember: string;
        toMemberId: string;
        reason: string;
        suggestedTaskIds: string[];
        suggestedTaskTitles: string[];
      }> = [];

      const overloadedSorted = [...overloadedMembers].sort(
        (a, b) => b.activeTasks - a.activeTasks
      );

      const availableSorted = [...memberWorkload]
        .filter(
          (member) =>
            member.loadStatus === "LIGHT" ||
            member.activeTasks < averageActiveTasks
        )
        .sort((a, b) => a.activeTasks - b.activeTasks);

      for (const overloaded of overloadedSorted) {
        const candidates = availableSorted.filter(
          (member) => member.id !== overloaded.id
        );

        if (candidates.length === 0) continue;

        const candidate = candidates[0];

        const transferableTasks = overloaded.tasks
          .filter(
            (task) =>
              task.status === "TODO" &&
              task.priority !== "URGENT"
          )
          .sort((a, b) => {
            const priorityRank: Record<Priority, number> = {
              LOW: 1,
              MEDIUM: 2,
              HIGH: 3,
              URGENT: 4,
            };

            return priorityRank[a.priority] - priorityRank[b.priority];
          })
          .slice(0, Math.max(1, Math.floor(
            (overloaded.activeTasks - candidate.activeTasks) / 2
          )));

        if (transferableTasks.length > 0) {
          redistributionSuggestions.push({
            fromMember: overloaded.name,
            fromMemberId: overloaded.id,
            toMember: candidate.name,
            toMemberId: candidate.id,
            reason:
              `${overloaded.name} has ${overloaded.activeTasks} active tasks, ` +
              `while ${candidate.name} has ${candidate.activeTasks}. ` +
              "Consider transferring unstarted, non-urgent work.",
            suggestedTaskIds: transferableTasks.map(
              (task) => task.id
            ),
            suggestedTaskTitles: transferableTasks.map(
              (task) => task.title
            ),
          });
        }
      }

      const workloadAlerts: Array<{
        type: "OVERLOAD" | "OVERDUE" | "URGENT" | "UNASSIGNED" | "IMBALANCE";
        severity: "HIGH" | "MEDIUM" | "LOW";
        title: string;
        description: string;
      }> = [];

      for (const member of overloadedMembers) {
        workloadAlerts.push({
          type: "OVERLOAD",
          severity: "HIGH",
          title: `${member.name} may be overloaded`,
          description:
            `${member.name} has ${member.activeTasks} active tasks, ` +
            `which is significantly above the team average of ` +
            `${averageActiveTasks.toFixed(1)}.`,
        });
      }

      for (const member of memberWorkload) {
        if (member.overdueTasks > 0) {
          workloadAlerts.push({
            type: "OVERDUE",
            severity:
              member.overdueTasks >= 3 ? "HIGH" : "MEDIUM",
            title: `${member.name} has overdue tasks`,
            description:
              `${member.name} has ${member.overdueTasks} overdue unfinished task(s).`,
          });
        }

        if (member.urgentTasks > 0) {
          workloadAlerts.push({
            type: "URGENT",
            severity: "HIGH",
            title: `${member.name} has urgent work`,
            description:
              `${member.name} has ${member.urgentTasks} urgent unfinished task(s).`,
          });
        }
      }

      if (unassignedTasks.length > 0) {
        workloadAlerts.push({
          type: "UNASSIGNED",
          severity:
            unassignedTasks.length >= 4 ? "HIGH" : "MEDIUM",
          title: "Unassigned work needs attention",
          description:
            `${unassignedTasks.length} active task(s) do not have an owner.`,
        });
      }

      if (
        overloadedMembers.length > 0 &&
        lightMembers.length > 0
      ) {
        workloadAlerts.push({
          type: "IMBALANCE",
          severity: "MEDIUM",
          title: "Team workload imbalance detected",
          description:
            "Some team members are overloaded while others have no active tasks.",
        });
      }

      const completionPercentage =
        project.tasks.length === 0
          ? 0
          : Math.round(
              (completedTasks.length / project.tasks.length) * 100
            );

      const workloadDistribution = memberWorkload.map(
        (member) => ({
          name: member.name,
          active: member.activeTasks,
          completed: member.completedTasks,
          overdue: member.overdueTasks,
          highPriority: member.highPriorityTasks,
          loadScore: member.loadScore,
          status: member.loadStatus,
        })
      );

      return res.json({
        success: true,
        message: "Workload intelligence generated successfully.",
        workload: {
          projectId: project.id,
          projectName: project.name,
          generatedAt: now.toISOString(),

          summary: {
            totalTasks: project.tasks.length,
            activeTasks: activeTasks.length,
            completedTasks: completedTasks.length,
            completionPercentage,
            totalMembers: members.length,
            averageActiveTasks:
              Number(averageActiveTasks.toFixed(2)),
            overdueTasks: overdueTasks.length,
            urgentTasks: urgentTasks.length,
            highPriorityTasks: highPriorityTasks.length,
            unassignedTasks: unassignedTasks.length,
            overloadedMembers: overloadedMembers.length,
            busyMembers: busyMembers.length,
            lightMembers: lightMembers.length,
          },

          members: memberWorkload,
          distribution: workloadDistribution,

          alerts: workloadAlerts,

          redistributionSuggestions,

          unassigned: unassignedTasks.map((task) => ({
            id: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate,
          })),

          overdue: overdueTasks.map((task) => ({
            id: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate,
            assignee: task.assignee?.name || "Unassigned",
          })),
        },
      });
    } catch (error) {
      console.error("Workload intelligence error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to generate workload intelligence.",
      });
    }
  }
);

export default router;

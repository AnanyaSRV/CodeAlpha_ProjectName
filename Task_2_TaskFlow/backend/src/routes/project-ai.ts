import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { prisma } from "../config/database";
import { generateGeminiJSON } from "../services/gemini";

const router = Router();

router.use(authenticate);

const chatSchema = z.object({
  message: z.string().trim().min(2).max(3000),
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected AI service error occurred.";
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "No deadline";
  return new Date(date).toLocaleDateString("en-IN");
}

function buildLocalAnswer(
  question: string,
  project: any,
  tasks: any[],
  members: any[],
  dependencies: any[],
  now: Date
) {
  const total = tasks.length;

  const completed = tasks.filter(
    (task) => task.status === "DONE"
  );

  const active = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  );

  const inReview = tasks.filter(
    (task) => task.status === "IN_REVIEW"
  );

  const todo = tasks.filter(
    (task) => task.status === "TODO"
  );

  const unfinished = tasks.filter(
    (task) => task.status !== "DONE"
  );

  const overdue = unfinished.filter(
    (task) => task.dueDate && new Date(task.dueDate) < now
  );

  const urgent = unfinished.filter(
    (task) => task.priority === "URGENT"
  );

  const highPriority = unfinished.filter(
    (task) =>
      task.priority === "HIGH" ||
      task.priority === "URGENT"
  );

  const unassigned = unfinished.filter(
    (task) => !task.assignee
  );

  const blocked = tasks.filter((task) => {
    return dependencies.some((dependency) => {
      if (dependency.taskId !== task.id) return false;

      const prerequisite = tasks.find(
        (candidate) => candidate.id === dependency.dependsOnTaskId
      );

      return prerequisite && prerequisite.status !== "DONE";
    });
  });

  const completion =
    total === 0
      ? 0
      : Math.round((completed.length / total) * 100);

  const workload = new Map<string, number>();

  for (const task of unfinished) {
    const owner = task.assignee?.name || "Unassigned";
    workload.set(owner, (workload.get(owner) || 0) + 1);
  }

  const workloadEntries = Array.from(workload.entries())
    .sort((a, b) => b[1] - a[1]);

  const questionLower = question.toLowerCase();

  let answer = "";

  if (
    questionLower.includes("progress") ||
    questionLower.includes("complete") ||
    questionLower.includes("status") ||
    questionLower.includes("summary") ||
    questionLower.includes("summar")
  ) {
    answer =
      `## Project Progress\n\n` +
      `**${project.name}** is currently **${completion}% complete**. ` +
      `${completed.length} of ${total} tasks are completed.\n\n` +
      `- In progress: ${active.length}\n` +
      `- In review: ${inReview.length}\n` +
      `- To do: ${todo.length}\n` +
      `- Overdue: ${overdue.length}\n` +
      `- Blocked: ${blocked.length}\n\n`;

    if (total === 0) {
      answer += "There are no tasks in this project yet. Start by creating a task backlog.";
    } else if (completion === 100) {
      answer += "All currently tracked tasks are complete. Review deliverables and consider closing the project.";
    } else {
      answer += "Focus on completing active work and resolving blockers to maintain progress.";
    }
  } else if (
    questionLower.includes("delay") ||
    questionLower.includes("behind") ||
    questionLower.includes("risk") ||
    questionLower.includes("late") ||
    questionLower.includes("deadline")
  ) {
    answer = `## Schedule Risk Review\n\n`;

    if (overdue.length === 0 && blocked.length === 0) {
      answer += "There are no currently detected overdue or dependency-blocked tasks based on the available data.\n\n";
    } else {
      answer += `I found **${overdue.length} overdue task(s)** and **${blocked.length} blocked task(s)**.\n\n`;
    }

    if (overdue.length > 0) {
      answer += "**Overdue tasks:**\n";
      for (const task of overdue.slice(0, 8)) {
        answer += `- ${task.title} — due ${formatDate(task.dueDate)} — ${task.status}\n`;
      }
      answer += "\n";
    }

    if (blocked.length > 0) {
      answer += "**Blocked tasks:**\n";
      for (const task of blocked.slice(0, 8)) {
        answer += `- ${task.title}\n`;
      }
      answer += "\n";
    }

    answer += "**Recommended action:** Review overdue work first, then unblock tasks with dependencies before starting additional lower-priority work.";
  } else if (
    questionLower.includes("priorit") ||
    questionLower.includes("next") ||
    questionLower.includes("what should") ||
    questionLower.includes("focus")
  ) {
    answer = "## Recommended Priorities\n\n";

    const priorityTasks = [
      ...urgent,
      ...highPriority.filter(
        (task) => !urgent.some((urgentTask) => urgentTask.id === task.id)
      ),
    ];

    if (priorityTasks.length > 0) {
      answer += "**High-impact unfinished work:**\n";

      for (const task of priorityTasks.slice(0, 8)) {
        answer +=
          `- **${task.title}** — ${task.status}, ` +
          `${task.assignee?.name || "Unassigned"}, ` +
          `due ${formatDate(task.dueDate)}\n`;
      }

      answer += "\n";
    }

    if (overdue.length > 0) {
      answer += `There are also **${overdue.length} overdue tasks** that should be reviewed immediately.\n\n`;
    }

    if (blocked.length > 0) {
      answer += `Resolve the prerequisites of **${blocked.length} blocked tasks** before expecting them to progress.\n\n`;
    }

    if (priorityTasks.length === 0 && overdue.length === 0 && blocked.length === 0) {
      answer += "No urgent, overdue, or blocked work is detected. Continue with the next open task in the project backlog.\n\n";
    }

    answer += "**Suggested order:** unblock critical work → address overdue tasks → complete urgent/high-priority tasks → continue the remaining backlog.";
  } else if (
    questionLower.includes("workload") ||
    questionLower.includes("overload") ||
    questionLower.includes("team") ||
    questionLower.includes("member") ||
    questionLower.includes("assign") ||
    questionLower.includes("distribut")
  ) {
    answer = "## Team Workload\n\n";

    if (workloadEntries.length === 0) {
      answer += "There is no unfinished work currently assigned or tracked.";
    } else {
      answer += "**Open task count by owner:**\n";

      for (const [name, count] of workloadEntries) {
        answer += `- ${name}: ${count} unfinished task(s)\n`;
      }

      answer += "\n";

      if (workloadEntries.length > 1) {
        const busiest = workloadEntries[0];
        const leastBusy = workloadEntries[workloadEntries.length - 1];

        if (busiest[1] - leastBusy[1] >= 2) {
          answer +=
            `The distribution appears uneven: **${busiest[0]}** has ${busiest[1]} open tasks, ` +
            `while **${leastBusy[0]}** has ${leastBusy[1]}. Consider reviewing capacity before redistributing.\n\n`;
        } else {
          answer += "Task counts appear relatively balanced, although task complexity and availability are not included in this calculation.\n\n";
        }
      }
    }

    answer += `Team members in this project: ${members.length}. Task counts alone do not measure effort or complexity.`;
  } else if (
    questionLower.includes("block") ||
    questionLower.includes("depend")
  ) {
    answer = "## Dependency Analysis\n\n";

    if (blocked.length === 0) {
      answer += "No tasks are currently identified as blocked by unfinished prerequisites.";
    } else {
      answer += `**${blocked.length} task(s) are blocked:**\n`;

      for (const task of blocked.slice(0, 10)) {
        const prereqs = dependencies
          .filter((dependency) => dependency.taskId === task.id)
          .map((dependency) =>
            tasks.find((candidate) => candidate.id === dependency.dependsOnTaskId)
          )
          .filter(Boolean);

        answer += `- **${task.title}**\n`;

        for (const prerequisite of prereqs) {
          answer += `  - Waiting for: ${prerequisite.title} (${prerequisite.status})\n`;
        }
      }
    }

    answer += "\n**Recommendation:** Complete or reassess unfinished prerequisites first.";
  } else {
    answer = `## ${project.name}\n\n`;

    answer += `I can provide a project snapshot using the currently tracked data:\n\n`;
    answer += `- Completion: ${completion}%\n`;
    answer += `- Tasks: ${total}\n`;
    answer += `- Completed: ${completed.length}\n`;
    answer += `- In progress: ${active.length}\n`;
    answer += `- In review: ${inReview.length}\n`;
    answer += `- Overdue: ${overdue.length}\n`;
    answer += `- Urgent: ${urgent.length}\n`;
    answer += `- Blocked: ${blocked.length}\n`;
    answer += `- Unassigned: ${unassigned.length}\n`;
    answer += `- Team members: ${members.length}\n\n`;

    answer += "I am currently using the local analysis fallback. Try asking specifically about progress, deadlines, priorities, blockers, or workload for a more focused report.";
  }

  return {
    answer,
    generatedLocally: true,
    projectSnapshot: {
      projectName: project.name,
      totalTasks: total,
      completed: completed.length,
      inProgress: active.length,
      inReview: inReview.length,
      todo: todo.length,
      overdue: overdue.length,
      urgent: urgent.length,
      blocked: blocked.length,
      unassigned: unassigned.length,
      completionPercentage: completion,
      teamMembers: members.length,
    },
  };
}

/* =========================================================
   POST /api/ai/chat/:projectId
   Project-aware AI chat
========================================================= */

router.post(
  "/chat/:projectId",
  async (req: Request, res: Response) => {
    try {
      const validation = chatSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid message.",
          errors: validation.error.flatten(),
        });
      }

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
          role: true,
        },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this project.",
        });
      }

      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
        include: {
          members: {
            include: {
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
            include: {
              assignee: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 200,
          },
        },
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found.",
        });
      }

      const dependencies = await prisma.taskDependency.findMany({
        where: {
          projectId,
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          dependsOn: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      });

      const now = new Date();

      const members = project.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      }));

      const tasks = project.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        assignee: task.assignee
          ? {
              id: task.assignee.id,
              name: task.assignee.name,
            }
          : null,
      }));

      const dependencyContext = dependencies.map((dependency) => ({
        taskId: dependency.taskId,
        taskTitle: dependency.task.title,
        dependsOnTaskId: dependency.dependsOnTaskId,
        dependsOnTitle: dependency.dependsOn.title,
        prerequisiteStatus: dependency.dependsOn.status,
      }));

      const projectContext = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
        },
        team: members,
        tasks,
        dependencies: dependencyContext,
        generatedAt: now.toISOString(),
      };

      const question = validation.data.message;

      const systemInstruction = `
You are TaskFlow Project Intelligence, an AI project manager embedded inside a collaborative project management application.

You have been provided with the real project data in the user's current project.

IMPORTANT RULES:
- Answer based on the supplied project context.
- Never invent task names, team members, dates, task statuses, assignments, dependencies, or metrics.
- If data is missing, explicitly say it is not available.
- Distinguish facts from your recommendations.
- Use task statuses exactly as provided when relevant.
- Analyze project progress, priorities, overdue work, dependencies, blockers, workload, risks, and planning.
- Provide actionable recommendations, not generic advice.
- Be concise but useful.
- Respond in readable Markdown.
- When asked what to do next, prioritize blocked tasks, overdue tasks, urgent/high priority work, then remaining work.
- When discussing workload, use unfinished task counts but acknowledge task effort and availability are not measured.
- Do not claim you modified tasks, assigned users, or changed project data. You are advisory only.
- Return valid JSON only with the following structure:
  {
    "answer": "Markdown response",
    "keyActions": ["action 1", "action 2", "action 3"],
    "riskLevel": "LOW | MEDIUM | HIGH",
    "generatedLocally": false
  }
`;

      const prompt = `
CURRENT PROJECT CONTEXT:

${JSON.stringify(projectContext, null, 2)}

USER QUESTION:
${question}

Analyze the actual project data and provide a grounded, project-specific response.

Return JSON with:
- answer: your Markdown answer
- keyActions: up to 5 actionable next steps
- riskLevel: LOW, MEDIUM, or HIGH based on current evidence
- generatedLocally: false
`;

      try {
        const aiResponse = await generateGeminiJSON<{
          answer: string;
          keyActions?: string[];
          riskLevel?: "LOW" | "MEDIUM" | "HIGH";
          generatedLocally?: boolean;
        }>(systemInstruction, prompt);

        return res.json({
          success: true,
          message: "Project-aware AI response generated.",
          response: {
            answer: aiResponse.answer,
            keyActions: aiResponse.keyActions || [],
            riskLevel: aiResponse.riskLevel || "MEDIUM",
            generatedLocally: false,
          },
          projectSnapshot: {
            projectName: project.name,
            taskCount: tasks.length,
            memberCount: members.length,
            dependencyCount: dependencies.length,
          },
        });
      } catch (aiError) {
        console.warn(
          "Project-aware Gemini chat unavailable. Using local contextual analysis.",
          getErrorMessage(aiError)
        );

        const localResponse = buildLocalAnswer(
          question,
          project,
          tasks,
          members,
          dependencies,
          now
        );

        return res.json({
          success: true,
          message: "Project-aware response generated using local analysis.",
          response: {
            ...localResponse,
            keyActions: [],
            riskLevel:
              localResponse.projectSnapshot.overdue >= 3 ||
              localResponse.projectSnapshot.blocked >= 3
                ? "HIGH"
                : localResponse.projectSnapshot.overdue > 0 ||
                    localResponse.projectSnapshot.blocked > 0
                  ? "MEDIUM"
                  : "LOW",
          },
          projectSnapshot: {
            projectName: project.name,
            taskCount: tasks.length,
            memberCount: members.length,
            dependencyCount: dependencies.length,
          },
        });
      }
    } catch (error) {
      console.error("Project-aware AI chat error:", error);

      return res.status(500).json({
        success: false,
        message: getErrorMessage(error),
      });
    }
  }
);

export default router;
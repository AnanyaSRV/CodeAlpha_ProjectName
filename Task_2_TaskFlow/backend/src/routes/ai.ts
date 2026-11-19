import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { prisma } from "../config/database";
import { generateGeminiJSON } from "../services/gemini";

const router = Router();

router.use(authenticate);

/* =========================================================
   SCHEMAS
========================================================= */

const plannerSchema = z.object({
  projectName: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(5000),
  durationDays: z.number().int().min(1).max(365).default(30),
  teamSize: z.number().int().min(1).max(100).default(3),
});

const breakdownSchema = z.object({
  objective: z.string().trim().min(10).max(3000),
  context: z.string().trim().max(3000).optional(),
  durationDays: z.number().int().min(1).max(180).default(14),
});

async function verifyProjectMembership(
  projectId: string,
  userId: string
) {
  return prisma.projectMember.findUnique({
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
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected AI service error occurred.";
}

/* =========================================================
   LOCAL FALLBACK UTILITIES
========================================================= */

function clampDay(day: number, duration: number): number {
  return Math.max(1, Math.min(day, duration));
}

function distributeDay(
  index: number,
  total: number,
  duration: number
): number {
  if (total <= 1) return 1;

  return clampDay(
    Math.ceil((index / total) * duration),
    duration
  );
}

function createLocalPlan(
  projectName: string,
  description: string,
  durationDays: number,
  teamSize: number
) {
  const now = new Date();

  const milestones = [
    {
      title: "Planning & Foundation",
      description:
        "Establish the project scope, architecture, requirements, and development foundation.",
      targetDay: clampDay(
        Math.ceil(durationDays * 0.2),
        durationDays
      ),
      successCriteria:
        "Requirements documented, architecture defined, and project foundation ready.",
    },
    {
      title: "Core Development",
      description:
        "Build the core functionality and complete the primary implementation.",
      targetDay: clampDay(
        Math.ceil(durationDays * 0.55),
        durationDays
      ),
      successCriteria:
        "Core features implemented and working end-to-end.",
    },
    {
      title: "Integration & Testing",
      description:
        "Integrate components, validate functionality, and fix major defects.",
      targetDay: clampDay(
        Math.ceil(durationDays * 0.8),
        durationDays
      ),
      successCriteria:
        "Major workflows pass testing and integration is stable.",
    },
    {
      title: "Final Delivery",
      description:
        "Complete final improvements, documentation, and project delivery.",
      targetDay: durationDays,
      successCriteria:
        "Project is reviewed, documented, and ready for delivery.",
    },
  ];

  const taskTemplates = [
    {
      title: "Define project scope and requirements",
      description:
        "Document objectives, deliverables, constraints, requirements, and measurable success criteria.",
      priority: "HIGH",
      hours: 4,
      role: "Project Manager",
      day: 1,
      deps: [],
    },
    {
      title: "Research and finalize technical approach",
      description:
        "Evaluate the available tools, technologies, dependencies, and implementation approach.",
      priority: "HIGH",
      hours: 5,
      role: "Technical Lead",
      day: 2,
      deps: ["task-1"],
    },
    {
      title: "Set up project structure and development environment",
      description:
        "Create the project structure, development configuration, tooling, and shared conventions.",
      priority: "HIGH",
      hours: 4,
      role: "Developer",
      day: 2,
      deps: ["task-1"],
    },
    {
      title: "Design core architecture and data models",
      description:
        "Define the main components, data structures, interfaces, and system interactions.",
      priority: "HIGH",
      hours: 6,
      role: "Technical Lead",
      day: 3,
      deps: ["task-2", "task-3"],
    },
    {
      title: "Implement core functionality",
      description:
        "Build the essential functionality required to deliver the project's primary objectives.",
      priority: "HIGH",
      hours: 12,
      role: "Developer",
      day: 4,
      deps: ["task-4"],
    },
    {
      title: "Implement supporting functionality",
      description:
        "Build supporting workflows, secondary features, and supporting components.",
      priority: "MEDIUM",
      hours: 8,
      role: "Developer",
      day: 5,
      deps: ["task-5"],
    },
    {
      title: "Build user interface and interaction workflows",
      description:
        "Implement user-facing screens, navigation, interaction states, and responsive layouts where applicable.",
      priority: "HIGH",
      hours: 10,
      role: "Frontend Developer",
      day: 5,
      deps: ["task-4"],
    },
    {
      title: "Integrate components and services",
      description:
        "Connect the application components, services, APIs, and data flows.",
      priority: "HIGH",
      hours: 8,
      role: "Full Stack Developer",
      day: 7,
      deps: ["task-5", "task-6", "task-7"],
    },
    {
      title: "Validate functionality and test workflows",
      description:
        "Test important workflows, expected behavior, edge cases, and failure conditions.",
      priority: "HIGH",
      hours: 8,
      role: "QA Engineer",
      day: 8,
      deps: ["task-8"],
    },
    {
      title: "Resolve defects and improve reliability",
      description:
        "Fix discovered defects, improve reliability, and address integration issues.",
      priority: "HIGH",
      hours: 6,
      role: "Developer",
      day: 9,
      deps: ["task-9"],
    },
    {
      title: "Review performance and usability",
      description:
        "Review performance, usability, accessibility, and overall experience. Implement improvements.",
      priority: "MEDIUM",
      hours: 5,
      role: "Product Designer",
      day: 10,
      deps: ["task-10"],
    },
    {
      title: "Prepare documentation and deployment",
      description:
        "Finalize documentation, setup instructions, release configuration, and delivery requirements.",
      priority: "MEDIUM",
      hours: 5,
      role: "Developer",
      day: 11,
      deps: ["task-10"],
    },
  ];

  const tasks = taskTemplates.map((task, index) => ({
    temporaryId: `task-${index + 1}`,
    title: task.title,
    description: task.description,
    priority: task.priority,
    suggestedDay: distributeDay(
      task.day,
      12,
      durationDays
    ),
    estimatedHours: task.hours,
    suggestedRole: task.role,
    dependencies: task.deps,
  }));

  const risks = [
    {
      risk: "Requirements may change during development.",
      impact: "HIGH",
      mitigation:
        "Agree on scope early and track changes before incorporating them into the schedule.",
    },
    {
      risk: "Integration issues between components may delay delivery.",
      impact: "MEDIUM",
      mitigation:
        "Define interfaces early and integrate components incrementally.",
    },
    {
      risk: "Testing may reveal defects later than expected.",
      impact: "MEDIUM",
      mitigation:
        "Test continuously during implementation rather than leaving testing until the end.",
    },
    {
      risk: "Team capacity may be insufficient for the planned workload.",
      impact: "MEDIUM",
      mitigation:
        "Review ownership and workload regularly and prioritize essential deliverables.",
    },
  ];

  return {
    overview:
      `A ${durationDays}-day project plan for "${projectName}" with ${teamSize} team member(s). ` +
      "This plan was generated using TaskFlow's local planning engine because the AI service was unavailable. " +
      "It provides a structured starting point that can be customized to your project.",

    recommendedApproach:
      "Use an iterative delivery approach. Establish requirements and architecture first, " +
      "implement the core functionality, integrate components early, validate workflows, " +
      "and finish with reliability improvements and delivery preparation.",

    estimatedDuration: `${durationDays} days`,

    milestones,

    tasks,

    risks,

    generatedLocally: true,

    generatedAt: now.toISOString(),

    projectDescription: description,
  };
}

/* =========================================================
   LOCAL TASK BREAKDOWN
========================================================= */

function createLocalBreakdown(
  objective: string,
  context: string | undefined,
  durationDays: number
) {
  const cleanedObjective = objective.trim();

  const words = cleanedObjective
    .split(/\s+/)
    .filter(Boolean);

  const shortObjective =
    words.length > 12
      ? `${words.slice(0, 12).join(" ")}...`
      : cleanedObjective;

  const taskTemplates = [
    {
      title: "Clarify objective and success criteria",
      description:
        `Define the expected outcome of "${shortObjective}", ` +
        "scope, constraints, and measurable completion criteria.",
      priority: "HIGH",
      hours: 2,
      day: 1,
      dependencies: [],
    },
    {
      title: "Research and gather required resources",
      description:
        "Identify the required resources, tools, information, and dependencies.",
      priority: "HIGH",
      hours: 3,
      day: 1,
      dependencies: ["task-1"],
    },
    {
      title: "Create implementation plan",
      description:
        "Break the objective into phases and determine the execution order.",
      priority: "HIGH",
      hours: 3,
      day: 2,
      dependencies: ["task-1", "task-2"],
    },
    {
      title: "Complete the first implementation phase",
      description:
        "Implement the initial foundation and validate the approach.",
      priority: "HIGH",
      hours: 5,
      day: 3,
      dependencies: ["task-3"],
    },
    {
      title: "Complete the primary deliverables",
      description:
        "Implement or complete the core work needed to achieve the objective.",
      priority: "HIGH",
      hours: 8,
      day: 5,
      dependencies: ["task-4"],
    },
    {
      title: "Complete supporting work",
      description:
        "Finish supporting requirements, secondary deliverables, and remaining components.",
      priority: "MEDIUM",
      hours: 5,
      day: 7,
      dependencies: ["task-5"],
    },
    {
      title: "Review and integrate completed work",
      description:
        "Review all deliverables and integrate individual components into the complete result.",
      priority: "HIGH",
      hours: 4,
      day: 9,
      dependencies: ["task-5", "task-6"],
    },
    {
      title: "Test and validate the result",
      description:
        "Validate the completed work against the original objective and success criteria.",
      priority: "HIGH",
      hours: 4,
      day: 10,
      dependencies: ["task-7"],
    },
    {
      title: "Resolve issues and finalize",
      description:
        "Address review feedback, fix remaining issues, and finalize deliverables.",
      priority: "MEDIUM",
      hours: 4,
      day: 12,
      dependencies: ["task-8"],
    },
    {
      title: "Document and deliver",
      description:
        "Prepare final documentation, summarize the outcome, and deliver the completed work.",
      priority: "MEDIUM",
      hours: 2,
      day: 14,
      dependencies: ["task-9"],
    },
  ];

  const tasks = taskTemplates.map((task, index) => ({
    temporaryId: `task-${index + 1}`,
    title: task.title,
    description: task.description,
    priority: task.priority,
    estimatedHours: task.hours,
    suggestedDay: distributeDay(
      task.day,
      taskTemplates.length,
      durationDays
    ),
    dependencies: task.dependencies,
  }));

  return {
    summary:
      `Local task breakdown for: ${cleanedObjective}. ` +
      "The objective has been organized into sequential execution phases.",

    recommendedSequence:
      "Start by clarifying the objective and gathering resources. Establish the plan, " +
      "complete the core work, integrate supporting work, validate the result, " +
      "resolve issues, and finalize delivery.",

    tasks,

    generatedLocally: true,

    context: context || "",
  };
}

/* =========================================================
   LOCAL PROJECT INTELLIGENCE
========================================================= */

function createLocalProjectAnalysis(
  project: any,
  now: Date
) {
  const tasks = project.tasks;

  const total = tasks.length;

  const completed = tasks.filter(
    (task: any) => task.status === "DONE"
  ).length;

  const inProgress = tasks.filter(
    (task: any) => task.status === "IN_PROGRESS"
  ).length;

  const inReview = tasks.filter(
    (task: any) => task.status === "IN_REVIEW"
  ).length;

  const todo = tasks.filter(
    (task: any) => task.status === "TODO"
  ).length;

  const overdueTasks = tasks.filter(
    (task: any) =>
      task.dueDate !== null &&
      task.dueDate < now &&
      task.status !== "DONE"
  );

  const urgentTasks = tasks.filter(
    (task: any) =>
      task.priority === "URGENT" &&
      task.status !== "DONE"
  );

  const highPriorityTasks = tasks.filter(
    (task: any) =>
      (task.priority === "HIGH" ||
        task.priority === "URGENT") &&
      task.status !== "DONE"
  );

  const unassignedTasks = tasks.filter(
    (task: any) =>
      !task.assignee &&
      task.status !== "DONE"
  );

  const completionPercentage =
    total === 0
      ? 0
      : Math.round((completed / total) * 100);

  const activeTasks = tasks.filter(
    (task: any) => task.status !== "DONE"
  );

  const workloadMap = new Map<string, number>();

  for (const task of activeTasks) {
    const name = task.assignee?.name || "Unassigned";

    workloadMap.set(
      name,
      (workloadMap.get(name) || 0) + 1
    );
  }

  const workload = Array.from(
    workloadMap.entries()
  ).map(([name, count]) => ({
    name,
    count,
  }));

  workload.sort((a, b) => b.count - a.count);

  const bottlenecks: Array<{
    issue: string;
    impact: string;
    recommendation: string;
  }> = [];

  const keyFindings: Array<{
    title: string;
    description: string;
    severity: string;
  }> = [];

  const recommendations: Array<{
    title: string;
    description: string;
    priority: string;
  }> = [];

  const nextActions: string[] = [];

  /* No tasks */

  if (total === 0) {
    keyFindings.push({
      title: "No project tasks yet",
      description:
        "This project has no tasks, so progress and workload cannot yet be evaluated.",
      severity: "MEDIUM",
    });

    recommendations.push({
      title: "Create the initial project backlog",
      description:
        "Add milestones, define deliverables, and create tasks with priorities and owners.",
      priority: "HIGH",
    });

    nextActions.push(
      "Create the first tasks and define project milestones."
    );
  }

  /* Overdue tasks */

  if (overdueTasks.length > 0) {
    keyFindings.push({
      title: `${overdueTasks.length} overdue task(s)`,
      description:
        `${overdueTasks.length} unfinished task(s) have due dates in the past. ` +
        "These may affect the project schedule.",
      severity:
        overdueTasks.length >= 3 ? "HIGH" : "MEDIUM",
    });

    bottlenecks.push({
      issue: `${overdueTasks.length} overdue tasks`,
      impact:
        "Delayed tasks can affect dependent work and overall project delivery.",
      recommendation:
        "Review overdue tasks, update their deadlines, and prioritize blockers.",
    });

    recommendations.push({
      title: "Resolve overdue tasks",
      description:
        "Review the overdue backlog and identify what needs to be completed, reassigned, or rescheduled.",
      priority: "HIGH",
    });

    nextActions.push(
      `Review and prioritize ${overdueTasks.length} overdue task(s).`
    );
  }

  /* Urgent tasks */

  if (urgentTasks.length > 0) {
    keyFindings.push({
      title: `${urgentTasks.length} urgent unfinished task(s)`,
      description:
        "Urgent tasks remain incomplete and should be reviewed to ensure they are actively progressing.",
      severity: "HIGH",
    });

    recommendations.push({
      title: "Focus on urgent tasks",
      description:
        "Confirm ownership and prioritize urgent work before starting lower-priority tasks.",
      priority: "HIGH",
    });

    nextActions.push(
      `Review the ${urgentTasks.length} urgent unfinished task(s).`
    );
  }

  /* Unassigned work */

  if (unassignedTasks.length > 0) {
    keyFindings.push({
      title: `${unassignedTasks.length} unassigned task(s)`,
      description:
        "Some unfinished tasks do not have an assigned owner.",
      severity:
        unassignedTasks.length >= 4 ? "HIGH" : "MEDIUM",
    });

    bottlenecks.push({
      issue: "Tasks without assigned owners",
      impact:
        "Unowned work may be overlooked and can delay project execution.",
      recommendation:
        "Assign a responsible team member to every important task.",
    });

    recommendations.push({
      title: "Assign unowned tasks",
      description:
        "Distribute unassigned work based on skill, availability, and current workload.",
      priority: "HIGH",
    });

    nextActions.push(
      `Assign owners to ${unassignedTasks.length} unassigned task(s).`
    );
  }

  /* Workload */

  if (workload.length >= 2) {
    const busiest = workload[0];
    const leastBusy = workload[workload.length - 1];

    if (
      busiest.count >= 3 &&
      busiest.count - leastBusy.count >= 2
    ) {
      keyFindings.push({
        title: "Workload imbalance detected",
        description:
          `${busiest.name} has ${busiest.count} active task(s), ` +
          `while ${leastBusy.name} has ${leastBusy.count}.`,
        severity: "MEDIUM",
      });

      bottlenecks.push({
        issue: "Uneven task distribution",
        impact:
          "Uneven workloads may create bottlenecks and slow project progress.",
        recommendation:
          "Review team capacity and redistribute tasks where appropriate.",
      });

      recommendations.push({
        title: "Balance team workloads",
        description:
          "Review task distribution and consider moving work from overloaded members to available members.",
        priority: "MEDIUM",
      });

      nextActions.push(
        "Review team workload distribution and rebalance if needed."
      );
    }
  }

  /* Progress */

  if (total > 0) {
    keyFindings.push({
      title: `${completionPercentage}% project completion`,
      description:
        `${completed} of ${total} task(s) are completed. ` +
        `${inProgress} are in progress, ${inReview} are in review, and ${todo} remain to be started.`,
      severity: "LOW",
    });
  }

  /* Health */

  let health: "ON_TRACK" | "AT_RISK" | "CRITICAL" =
    "ON_TRACK";

  if (
    overdueTasks.length >= 3 ||
    (total > 0 &&
      overdueTasks.length / total >= 0.3) ||
    (urgentTasks.length >= 5 &&
      completionPercentage < 30)
  ) {
    health = "CRITICAL";
  } else if (
    overdueTasks.length > 0 ||
    urgentTasks.length > 0 ||
    unassignedTasks.length >= 3 ||
    (total >= 5 && completionPercentage < 20)
  ) {
    health = "AT_RISK";
  }

  if (health === "CRITICAL") {
    nextActions.unshift(
      "The project requires immediate attention. Review overdue work, urgent tasks, and blockers."
    );
  } else if (health === "AT_RISK") {
    nextActions.unshift(
      "Review project risks and address the highest-priority unfinished work."
    );
  } else if (total > 0) {
    nextActions.unshift(
      "Continue progressing through the backlog and monitor upcoming deadlines."
    );
  }

  /* General recommendations */

  if (
    total > 0 &&
    completed === total
  ) {
    keyFindings.push({
      title: "All tasks completed",
      description:
        "All tasks currently tracked in this project are marked as completed.",
      severity: "LOW",
    });

    nextActions.unshift(
      "Review the project deliverables and formally close the project."
    );
  }

  if (recommendations.length === 0 && total > 0) {
    recommendations.push({
      title: "Maintain steady progress",
      description:
        "Keep task statuses updated, review upcoming deadlines, and maintain clear task ownership.",
      priority: "LOW",
    });
  }

  if (nextActions.length === 0) {
    nextActions.push(
      "Review project progress and update task statuses."
    );
  }

  const executiveSummary =
    total === 0
      ? `Project "${project.name}" has no tracked tasks yet. Create a backlog to begin tracking progress.`
      : `Project "${project.name}" is ${completionPercentage}% complete with ${total} tracked tasks. ` +
        `${overdueTasks.length} overdue, ${urgentTasks.length} urgent unfinished, and ${unassignedTasks.length} unassigned task(s). ` +
        `Current assessment: ${health.replace("_", " ")}.`;

  return {
    executiveSummary,
    health,
    completionPercentage,
    keyFindings,
    bottlenecks,
    recommendations,
    nextActions,

    workload,

    generatedLocally: true,

    generatedAt: now.toISOString(),
  };
}

/* =========================================================
   POST /api/ai/plan
   Generate a project plan.
   Gemini first; local fallback when unavailable.
========================================================= */

router.post(
  "/plan",
  async (req: Request, res: Response) => {
    try {
      const validation = plannerSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid project planning input.",
          errors: validation.error.flatten(),
        });
      }

      const {
        projectName,
        description,
        durationDays,
        teamSize,
      } = validation.data;

      const userId = req.user!.id;

      let existingProjectContext = "";

      if (req.body.projectId !== undefined) {
        const projectIdSchema = z.string().min(1).max(100);

        const parsedProjectId = projectIdSchema.safeParse(
          req.body.projectId
        );

        if (!parsedProjectId.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid project ID.",
          });
        }

        const membership = await verifyProjectMembership(
          parsedProjectId.data,
          userId
        );

        if (!membership) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this project.",
          });
        }

        const project = await prisma.project.findUnique({
          where: { id: parsedProjectId.data },
          select: {
            name: true,
            description: true,
            tasks: {
              select: {
                title: true,
                status: true,
                priority: true,
              },
              take: 100,
            },
          },
        });

        if (project) {
          existingProjectContext = JSON.stringify(project);
        }
      }

      const systemInstruction = `
You are TaskFlow AI, an expert project manager and software delivery planner.

Generate realistic, actionable project plans.

Rules:
- Return valid JSON only.
- Do not include Markdown code fences.
- Do not invent team member identities.
- Use ISO date strings in YYYY-MM-DD format.
- Use only these priorities: LOW, MEDIUM, HIGH, URGENT.
- Use only these task statuses: TODO, IN_PROGRESS, IN_REVIEW, DONE.
- Keep task titles concise and descriptions practical.
- Assign suggested owners by role, not by invented names.
- Respect the requested project duration.
- Include dependencies using the IDs of other generated tasks.
- Include measurable milestones.
- Avoid unrealistic schedules.
`;

      const prompt = `
Create a detailed project plan using the following information.

Project name: ${projectName}

Project description:
${description}

Duration: ${durationDays} days

Team size: ${teamSize}

Existing project context, if supplied:
${existingProjectContext || "This is a new project."}

Requirements:
1. Create 3 to 6 milestones.
2. Generate between 8 and 20 actionable tasks.
3. Give every task a unique temporaryId.
4. Suggested days must be between 1 and ${durationDays}.
5. Estimate task effort in hours.
6. Identify dependencies using temporaryId values.
7. Suggest roles instead of assigning real people.
8. Identify practical project risks.
9. Do not repeat existing tasks unnecessarily.

Return JSON containing:
overview, recommendedApproach, estimatedDuration,
milestones, tasks, and risks.
`;

      try {
        const result = await generateGeminiJSON<unknown>(
          systemInstruction,
          prompt
        );

        return res.json({
          success: true,
          message: "AI project plan generated successfully.",
          plan: result,
          generatedLocally: false,
        });
      } catch (aiError) {
        console.warn(
          "Gemini planner unavailable. Using local planner.",
          getErrorMessage(aiError)
        );

        const localPlan = createLocalPlan(
          projectName,
          description,
          durationDays,
          teamSize
        );

        return res.json({
          success: true,
          message:
            "Project plan generated using TaskFlow's local planning engine.",
          plan: localPlan,
          generatedLocally: true,
        });
      }
    } catch (error) {
      console.error("AI project planning error:", error);

      return res.status(500).json({
        success: false,
        message: getErrorMessage(error),
      });
    }
  }
);

/* =========================================================
   POST /api/ai/breakdown
   Break an objective into actionable tasks.
   Gemini first; local fallback when unavailable.
========================================================= */

router.post(
  "/breakdown",
  async (req: Request, res: Response) => {
    try {
      const validation = breakdownSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid task breakdown input.",
          errors: validation.error.flatten(),
        });
      }

      const {
        objective,
        context,
        durationDays,
      } = validation.data;

      const systemInstruction = `
You are TaskFlow AI, an expert at breaking complex objectives into manageable tasks.

Return valid JSON only. No Markdown.

Generate:
- A concise objective summary.
- Actionable tasks.
- Priority for every task.
- Estimated hours.
- Suggested completion day.
- Dependencies between tasks.
- A short explanation of the recommended sequence.

Use only LOW, MEDIUM, HIGH, URGENT priorities.
Use temporary task IDs for dependencies.
Do not invent team members.
`;

      const prompt = `
Break down this objective into actionable tasks.

Objective:
${objective}

Additional context:
${context || "No additional context supplied."}

Available duration:
${durationDays} days.

Generate 5 to 15 useful tasks.

Return JSON with:
summary, recommendedSequence, and tasks.

Each task should contain:
temporaryId, title, description, priority,
estimatedHours, suggestedDay, dependencies.
`;

      try {
        const result = await generateGeminiJSON<unknown>(
          systemInstruction,
          prompt
        );

        return res.json({
          success: true,
          message: "Objective broken down successfully.",
          breakdown: result,
          generatedLocally: false,
        });
      } catch (aiError) {
        console.warn(
          "Gemini breakdown unavailable. Using local breakdown.",
          getErrorMessage(aiError)
        );

        const localBreakdown = createLocalBreakdown(
          objective,
          context,
          durationDays
        );

        return res.json({
          success: true,
          message:
            "Objective broken down using TaskFlow's local task engine.",
          breakdown: localBreakdown,
          generatedLocally: true,
        });
      }
    } catch (error) {
      console.error("AI task breakdown error:", error);

      return res.status(500).json({
        success: false,
        message: getErrorMessage(error),
      });
    }
  }
);

/* =========================================================
   POST /api/ai/analyze/:projectId
   Analyze actual project data locally.
   Does not depend on Gemini.
========================================================= */

router.post(
  "/analyze/:projectId",
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

      const membership = await verifyProjectMembership(
        projectId,
        userId
      );

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
          description: true,
          createdAt: true,

          members: {
            select: {
              role: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },

          tasks: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
              updatedAt: true,

              assignee: {
                select: {
                  name: true,
                },
              },
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

      const now = new Date();

      const taskSummary = {
        total: project.tasks.length,

        completed: project.tasks.filter(
          (task) => task.status === "DONE"
        ).length,

        inProgress: project.tasks.filter(
          (task) => task.status === "IN_PROGRESS"
        ).length,

        inReview: project.tasks.filter(
          (task) => task.status === "IN_REVIEW"
        ).length,

        todo: project.tasks.filter(
          (task) => task.status === "TODO"
        ).length,

        overdue: project.tasks.filter(
          (task) =>
            task.dueDate !== null &&
            task.dueDate < now &&
            task.status !== "DONE"
        ).length,

        urgent: project.tasks.filter(
          (task) =>
            task.priority === "URGENT" &&
            task.status !== "DONE"
        ).length,
      };

      const projectData = {
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,

        members: project.members.map((member) => ({
          name: member.user.name,
          role: member.role,
        })),

        taskSummary,

        tasks: project.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          assignee: task.assignee?.name || "Unassigned",
          updatedAt: task.updatedAt,
        })),
      };

      const analysis = createLocalProjectAnalysis(
        projectData,
        now
      );

      return res.json({
        success: true,
        message:
          "Project intelligence generated from actual project data.",
        analysis,

        dataSnapshot: {
          projectId: project.id,
          projectName: project.name,
          generatedAt: now.toISOString(),
          taskSummary,
        },
      });
    } catch (error) {
      console.error("AI project analysis error:", error);

      return res.status(500).json({
        success: false,
        message: getErrorMessage(error),
      });
    }
  }
);

export default router;
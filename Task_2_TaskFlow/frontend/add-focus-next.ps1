$ErrorActionPreference = "Stop"

$path = "src\app\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "ERROR: Dashboard page not found." -ForegroundColor Red
    exit 1
}

$content = Get-Content -LiteralPath $path -Raw

if ($content.Contains("FOCUS NEXT")) {
    Write-Host "Focus Next already exists. No changes made." -ForegroundColor Yellow
    exit 0
}

$marker = "            {/* CHART AND COMPLETION */}"

if (-not $content.Contains($marker)) {
    Write-Host "ERROR: Insertion marker not found. No changes made." -ForegroundColor Red
    exit 1
}

$backup = "$path.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $path -Destination $backup

$panel = @'
            {/* FOCUS NEXT */}
            {(() => {
              const priorityRank: Record<Priority, number> = {
                URGENT: 0,
                HIGH: 1,
                MEDIUM: 2,
                LOW: 3,
              };

              const focusTask = allTasks
                .filter((task) => task.status !== "DONE")
                .sort((a, b) => {
                  const overdueDifference =
                    Number(isOverdue(b)) - Number(isOverdue(a));

                  if (overdueDifference !== 0) return overdueDifference;

                  const priorityDifference =
                    priorityRank[a.priority] - priorityRank[b.priority];

                  if (priorityDifference !== 0) return priorityDifference;

                  const aDate = a.dueDate
                    ? new Date(a.dueDate).getTime()
                    : Infinity;
                  const bDate = b.dueDate
                    ? new Date(b.dueDate).getTime()
                    : Infinity;

                  return aDate - bDate;
                })[0];

              return (
                <section className="mb-6 overflow-hidden rounded-xl border border-[#e7e2fb] bg-gradient-to-r from-[#f7f4ff] via-white to-[#f1f4ff] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-[#ebe6ff] text-[#7868df]">
                        <Target size={19} />
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#8879ed]">
                          FOCUS NEXT
                        </span>
                        <h2 className="mt-1 text-sm font-extrabold text-[#39374d]">
                          Your next priority
                        </h2>
                        <p className="mt-1 text-[10px] text-[#aaa8b6]">
                          Based on urgency, priority, and deadline
                        </p>
                      </div>
                    </div>

                    {focusTask ? (
                      <button
                        onClick={() => openTask(focusTask)}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#9384f4] to-[#7868df] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5"
                      >
                        Open task <span>↗</span>
                      </button>
                    ) : null}
                  </div>

                  {focusTask ? (
                    <div className="mt-5 rounded-xl border border-[#eeedf3] bg-white/90 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-[9px] font-bold ${
                            isOverdue(focusTask)
                              ? "bg-[#fff0ed] text-[#d16f65]"
                              : focusTask.priority === "URGENT"
                                ? "bg-[#fff0ed] text-[#d16f65]"
                                : focusTask.priority === "HIGH"
                                  ? "bg-[#fff4e8] text-[#d99550]"
                                  : "bg-[#f0edff] text-[#8879ed]"
                          }`}
                        >
                          {isOverdue(focusTask)
                            ? "OVERDUE"
                            : `${focusTask.priority} PRIORITY`}
                        </span>

                        {focusTask.dueDate ? (
                          <span className="text-[9px] text-[#aaa8b6]">
                            Due {formatDate(focusTask.dueDate)}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-3 text-base font-extrabold text-[#514e64]">
                        {focusTask.title}
                      </h3>

                      <p className="mt-1 text-[10px] text-[#aaa8b6]">
                        {focusTask.project?.name || "Project"}
                      </p>

                      <p className="mt-3 text-xs leading-5 text-[#777589]">
                        {isOverdue(focusTask)
                          ? "This task is past its deadline. Prioritize completing it or updating its deadline."
                          : focusTask.priority === "URGENT"
                            ? "This task has urgent priority. Focus on completing it before moving to lower-priority work."
                            : focusTask.priority === "HIGH"
                              ? "This task has high priority. Try to make progress on it next."
                              : "This is your recommended next task based on its priority and deadline."}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-[#e1eee5] bg-white/90 p-4">
                      <p className="text-xs font-bold text-[#65a18a]">
                        You're all caught up!
                      </p>
                      <p className="mt-1 text-[10px] text-[#aaa8b6]">
                        No unfinished tasks found. Create a new task when you're ready.
                      </p>
                    </div>
                  )}
                </section>
              );
            })()}

'@

$content = $content.Replace($marker, $panel + $marker)

Set-Content -LiteralPath $path -Value $content -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Focus Next panel added!" -ForegroundColor Green
Write-Host "Backup created: $backup" -ForegroundColor Cyan
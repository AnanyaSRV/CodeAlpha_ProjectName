$ErrorActionPreference = "Stop"

$path = "src\app\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "ERROR: Dashboard page not found." -ForegroundColor Red
    exit 1
}

$content = Get-Content -LiteralPath $path -Raw

if ($content.Contains("SMART INSIGHTS")) {
    Write-Host "Smart Insights already exists. No changes made." -ForegroundColor Yellow
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
            {/* SMART INSIGHTS */}
            <section className="mb-6 overflow-hidden rounded-xl border border-[#e8e3fb] bg-gradient-to-br from-[#f8f6ff] via-white to-[#f1efff] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ece7ff] text-[#8879ed]">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-[#39374d]">
                    Smart Insights
                  </h2>
                  <p className="mt-1 text-[10px] text-[#9694a6]">
                    Automatically generated from your live task data
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-[#f0deda] bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#c87878]">
                    <AlertCircle size={14} />
                    Attention
                  </div>
                  <p className="text-xs leading-5 text-[#69667c]">
                    {overdueCount > 0
                      ? `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} need attention. Review deadlines and reassign work if necessary.`
                      : "No overdue tasks detected. Keep your project deadlines on track."}
                  </p>
                </div>

                <div className="rounded-lg border border-[#e0eafa] bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#6797c5]">
                    <Activity size={14} />
                    Momentum
                  </div>
                  <p className="text-xs leading-5 text-[#69667c]">
                    {inProgressCount > 0
                      ? `${inProgressCount} task${inProgressCount === 1 ? "" : "s"} currently in progress. Check for blockers and help keep work moving.`
                      : "No tasks are currently in progress. Consider starting the next priority task."}
                  </p>
                </div>

                <div className="rounded-lg border border-[#e1eee5] bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#65a18a]">
                    <CheckCircle2 size={14} />
                    Progress
                  </div>
                  <p className="text-xs leading-5 text-[#69667c]">
                    {allTasks.length > 0
                      ? `${completedCount} of ${allTasks.length} tasks completed (${Math.round((completedCount / allTasks.length) * 100)}%). ${completedCount === allTasks.length ? "All tasks are complete!" : "Keep completing tasks to improve overall progress."}`
                      : "Create your first tasks to start tracking project progress."}
                  </p>
                </div>
              </div>
            </section>

'@

$content = $content.Replace($marker, $panel + $marker)

Set-Content -LiteralPath $path -Value $content -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Smart Insights panel added!" -ForegroundColor Green
Write-Host "Backup created: $backup" -ForegroundColor Cyan
$ErrorActionPreference = "Stop"

$path = "src\app\projects\[projectId]\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "ERROR: Project workspace page not found." -ForegroundColor Red
    exit 1
}

$content = Get-Content -LiteralPath $path -Raw

$marker = @'
              <button
                onClick={() => openCreate()}
'@

if ($content.Contains("Project AI")) {
    Write-Host "Project AI button already exists. No changes made." -ForegroundColor Yellow
    exit 0
}

if (-not $content.Contains($marker)) {
    Write-Host "ERROR: Exact insertion point not found. No changes made." -ForegroundColor Red
    exit 1
}

$backup = "$path.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $path -Destination $backup

$newButton = @'
              <button
                onClick={() => router.push(`/projects/${projectId}/ai`)}
                className="flex h-10 items-center gap-2 rounded-lg border border-[#e5defe] bg-[#f5f1ff] px-4 text-xs font-bold text-[#7868df] transition hover:bg-[#ece5ff]"
                title="Open Project AI Assistant"
              >
                <span className="text-base">✦</span> Project AI
              </button>

'@

$content = $content.Replace($marker, $newButton + $marker)

Set-Content -LiteralPath $path -Value $content -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Project AI button added!" -ForegroundColor Green
Write-Host "Backup created: $backup" -ForegroundColor Cyan
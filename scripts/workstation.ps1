param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Install','Shadcn','Check','PrepareEnv','EnvStatus','EnvDiagnose','DockerDiagnose','InspectMinioTool','RestoreInstructions','PreviewLogin','Audit','Compose','Migrate','Seed','Dev','Test','Build','CommitSkeleton','CommitAuth','CommitFinal','Push','Inspect')]
  [string]$Step
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
function Confirm-Exit { if ($LASTEXITCODE -ne 0) { throw "命令失败，退出码：$LASTEXITCODE" } }
switch ($Step) {
  'PrepareEnv' { if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }; git check-ignore .env .env.local; Confirm-Exit }
  'EnvStatus' { node scripts/check-env.mjs; Confirm-Exit }
  'EnvDiagnose' { node scripts/env-diagnose.mjs; Confirm-Exit }
  'DockerDiagnose' { docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}'; $proxySettings = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; [pscustomobject]@{ ProxyEnable=$proxySettings.ProxyEnable; ProxyServer=$proxySettings.ProxyServer }; Resolve-DnsName registry-1.docker.io -ErrorAction Continue | Select-Object Name,IPAddress; Test-NetConnection public.ecr.aws -Port 443 -InformationLevel Quiet; Test-NetConnection quay.io -Port 443 -InformationLevel Quiet }
  'InspectMinioTool' { docker run --rm --pull never --entrypoint /bin/sh quay.io/minio/minio:latest -c 'command -v mc || true'; Confirm-Exit; docker ps --format '{{.Names}} {{.Ports}}' }
  'RestoreInstructions' { git diff --stat -- AGENTS.md; git restore --source=c305fe9 -- AGENTS.md; Confirm-Exit; git diff --exit-code c305fe9 -- AGENTS.md; Confirm-Exit }
  'PreviewLogin' { node scripts/check-login.mjs; Confirm-Exit }
  'Audit' { node scripts/audit-project.mjs; Confirm-Exit; git diff --exit-code c305fe9 -- AGENTS.md; Confirm-Exit; git status --short; docker compose ps -a; Confirm-Exit; docker image inspect postgres:16-alpine quay.io/minio/minio:latest --format '{{.RepoTags}} {{json .RepoDigests}}' }
  'Install' { npm.cmd install; Confirm-Exit }
  'Shadcn' { npx.cmd --yes shadcn@latest init --defaults --yes; Confirm-Exit; npx.cmd --yes shadcn@latest add button input label card badge separator --yes; Confirm-Exit }
  'Check' { npm.cmd run lint; Confirm-Exit; npm.cmd run typecheck; Confirm-Exit; npx.cmd prisma validate; Confirm-Exit }
  'Compose' { docker compose up -d; Confirm-Exit; node scripts/check-infra.mjs; Confirm-Exit; docker compose ps -a; Confirm-Exit }
  'Migrate' { npx.cmd prisma migrate dev --name init; Confirm-Exit; npx.cmd prisma generate; Confirm-Exit }
  'Seed' { npm.cmd run seed; Confirm-Exit }
  'Dev' { npm.cmd run dev; Confirm-Exit }
  'Test' { npm.cmd run test:e2e; Confirm-Exit }
  'Build' { npm.cmd run build; Confirm-Exit }
  'CommitSkeleton' { git add .gitignore .env.example README.md components.json docker-compose.yml eslint.config.mjs next-env.d.ts next.config.ts package.json package-lock.json prisma.config.ts prisma/schema.prisma scripts public src/components/ui src/lib/utils.ts src/app/globals.css src/app/layout.tsx tsconfig.json; Confirm-Exit; git commit -m '搭建项目骨架与数据库模型'; Confirm-Exit }
  'CommitAuth' { git add .; Confirm-Exit; git commit -m '实现账号登录与管理员用户管理'; Confirm-Exit }
  'CommitFinal' { git diff --check; Confirm-Exit; git add .; Confirm-Exit; git commit -m '完善启动文档并通过登录权限验收'; Confirm-Exit }
  'Push' { git push; Confirm-Exit; & 'C:\Program Files\GitHub CLI\gh.exe' repo view --json url,isPrivate; Confirm-Exit; git diff --exit-code c305fe9 -- AGENTS.md; Confirm-Exit; $currentRevision = git rev-parse HEAD; $remoteRevision = git rev-parse origin/main; if ($currentRevision -ne $remoteRevision) { throw '本地与远程提交不一致' }; if (git status --porcelain) { throw '工作区仍有未提交变更' }; git log -4 --oneline; Write-Output '远程提交已同步，工作区干净，AGENTS.md 原文一致' }
  'Inspect' { git status --short; git log -4 --oneline; git ls-files '.env*'; Get-Content package.json; Get-Content src/app/layout.tsx; Get-Content src/app/globals.css; Get-Content src/components/ui/button.tsx; Get-Content src/components/ui/badge.tsx; Get-Content eslint.config.mjs; Get-Content next.config.ts }
}

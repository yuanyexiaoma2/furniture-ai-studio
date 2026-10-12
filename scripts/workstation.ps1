param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Install','Shadcn','Check','Compose','Migrate','Seed','Dev','Test','Build','CommitSkeleton','CommitAuth','CommitFinal','Push','Inspect')]
  [string]$Step
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
function Confirm-Exit { if ($LASTEXITCODE -ne 0) { throw "命令失败，退出码：$LASTEXITCODE" } }
switch ($Step) {
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
  'CommitFinal' { git add .; Confirm-Exit; git commit -m '完善启动文档并通过登录权限验收'; Confirm-Exit }
  'Push' { git push; Confirm-Exit; & 'C:\Program Files\GitHub CLI\gh.exe' repo view --json url,isPrivate; Confirm-Exit }
  'Inspect' { git status --short; git log -4 --oneline; git ls-files '.env*'; Get-Content package.json; Get-Content src/app/layout.tsx; Get-Content src/app/globals.css; Get-Content src/components/ui/button.tsx; Get-Content src/components/ui/badge.tsx; Get-Content eslint.config.mjs; Get-Content next.config.ts }
}

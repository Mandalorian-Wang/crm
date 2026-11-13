# 本地开发 SOP

## 1. 建立独立开发目录

当前常用发布目录的 `.env` 连接线上 Neon。不要直接在这个目录启动开发服务、运行 seed 或测试套件。
创建独立 checkout 或 worktree，使用自己的根目录 `.env`。

```sh
git clone --branch main https://github.com/Mandalorian-Wang/crm.git boxlite_crm-dev
cd boxlite_crm-dev
git switch -c feat/your-task
git remote -v
```

已有克隆可从 `origin/main` 创建 worktree；不要从上游默认的 `release` 开始。

工具基线：Node.js 22+、Bun、Git、Docker Compose。项目声明 Bun 1.4.0，现有 sandbox 安装 Bun 1.4.4。
依赖安装使用 Bun；`npm run build` 只负责执行构建，不代表应使用 npm 安装整个 monorepo。

```sh
node --version
bun --version
bun install --frozen-lockfile
cp .env.example .env
chmod 600 .env
docker compose up -d postgres
```

`cp` 仅用于新 checkout。已有 `.env` 时先检查，不覆盖已有配置。
Docker Compose 提供本机 PostgreSQL 17；线上 PostgreSQL 18 的兼容验证使用隔离 Neon 分支。

## 2. 配置本地环境

在本地编辑器或秘密管理工具中填写 `.env`，不要将秘密值放入 shell 参数、聊天或提交。

| 变量 | 本地用途 |
| --- | --- |
| `DATABASE_URL` | 本机 `crm` 数据库，或隔离 Neon 开发分支 |
| `DATABASE_URL_UNPOOLED` | 使用 Neon 时填写同一开发分支的直连地址 |
| `TEST_DATABASE_URL` | 独立测试数据库，数据库名必须以 `_test` 结尾 |
| `BETTER_AUTH_SECRET` | 为本地环境单独生成，不复用线上 session secret |
| `APP_URL` | `http://localhost:3000` |
| `API_URL` | `http://localhost:3001` |
| `INTERNAL_API_URL` | `http://127.0.0.1:3001` |
| `ALLOWED_SIGN_IN` | `polygala.ai` |
| `CRM_PASSWORD_LOGIN` | 本地管理员验证时设为 `true` |
| `CRM_ADMIN_USERNAME` / `CRM_ADMIN_PASSWORD` | 本地测试管理员；密码至少 12 位 |
| `CRM_RESEARCH_OPTIONAL` | `true`，避免依赖可选 enrichment 配置 |
| `CRM_LINEAR_ONLY` | 验证 Linear 限制时设为 `true` |
| `GITHUB_SYNC_ENABLED` | 保持 `false` |

本地仅修改 UI 时，不启动同步进程，不接入真实 Backoffice 或 Linear 写入凭证。
验证 Linear OAuth 时，使用获准的应用配置，并在 Linear 添加本地回调；不要删除线上回调。
新变量同步更新 `.env.example`、必要的 API env validation 和 `turbo.json` 的透传配置。

## 3. 初始化数据库和登录

以下命令仅对隔离开发数据库执行：

```sh
bun run --filter=@crm/db db:generate
bun run --filter=@crm/db db:deploy
bun run --filter=@crm/sync bootstrap
```

`bootstrap` 创建 BoxLite workspace、管理员和来源字段。不要用随机 demo seed 代替它。
重复运行会比较管理员密码；密码变化会更新哈希并撤销该管理员会话。日常发布不运行它。

## 4. 启动核心应用

两个终端均位于开发 checkout 根目录：

```sh
bun run --filter=api dev
```

```sh
bun run --filter=app dev
```

访问 `http://localhost:3000/sign-in`，展开 **Admin sign-in**，使用本地管理员登录。
API 默认监听 `3001`。修改 `packages/` 中的服务端代码后手动重启 API；watch 不保证监听跨包文件。
根目录 `bun run dev` 会启动更多 workspace 服务；仅验证 CRM 时用上面的核心服务命令。

同步开发只在隔离数据库和获准的数据源上执行：

```sh
bun run --filter=@crm/sync sync
```

该命令执行一轮；同小时成功记录会跳过。`start` 是常驻 worker，`sync --force` 会跳过去重检查。
不要用强制全量同步验证无关的 UI 修改。

## 5. 修改代码

| 修改范围 | 必须配套处理 |
| --- | --- |
| API 路由或 contract | 输入校验、登录/角色检查、重新生成 tRPC 类型 |
| Prisma schema | 增加版本化 migration，先在隔离数据库执行 |
| UI | 复用 `packages/ui`；处理加载、失败、空状态和保存状态 |
| 数据修改 | 通过 `useCrmCache()` 失效对应列表及详情缓存 |
| 同步字段 | 明确来源字段和人工字段的所有权，不覆盖手工信息 |
| 凭证或登录 | 使用私密配置；测试正确与错误凭证及普通成员权限 |

```sh
bun run --filter=api trpc:generate
bun run --filter=@crm/db db:generate
```

提交 `apps/api/src/generated/server.ts`。不要手改生成的路由类型。
本地 schema 修改用 `bun run db:migrate` 生成 migration；线上只运行 `db:deploy`。
禁止对线上执行 `db:push`、`db:reset` 或测试套件。

## 6. 验证和提交

按修改范围执行检查，再做完整构建：

```sh
bun run --filter=api check-types
bun run --filter=app check-types
bun run --filter=@crm/sync check-types
npm run build -- --force
git diff --check
```

对改动文件运行 Biome，并执行相关测试。完整发布门禁按仓库规定执行：

```sh
bun run db:test
bun run audit
bun run check-types
bun run lint
bun run lint:slop
bun run test
```

这些测试必须使用隔离的 `TEST_DATABASE_URL`。测试失败要记录原因；禁止把“跳过”写成“通过”。
`build:all` 还构建可选 Agent，依赖 microsandbox；当前 CRM 发布使用默认 `build` 范围。

UI 验收使用浏览器实际操作。至少覆盖新增、修改、刷新后持久化、失败提示、权限和测试数据清理。
修改源数据同步时，确认新增去重、重复执行、来源失败及人工字段保留。

```sh
git status --short
git diff --check
git add path/to/changed-file
git diff --cached
git commit -m "feat: describe the user-visible change"
git push origin HEAD:main
```

`path/to/changed-file` 是待替换的路径。只推送 `Mandalorian-Wang/crm` 的 main；不要 force push。
遇到远端更新，先 fetch、整合冲突并重做受影响检查。
pre-push 默认执行门禁。只有记录了跳过原因和已执行检查时才使用 `CRM_SKIP_HOOKS=1`，不能作为常规捷径。

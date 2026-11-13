# BoxLite dev 线上发布 SOP

本流程发布现有 sandbox，使用现有 Neon 数据库。当前流程有维护窗口，不承诺零停机。
下列命令从专用发布 checkout 根目录执行。每一步失败即停止，不继续启动未经验证的版本。

## 1. 确认发布版本和目标

```sh
git remote -v
git fetch origin main
git status --short
```

确认 origin 是 `Mandalorian-Wang/crm`，工作区无未提交内容，目标 commit 已推送 fork main。
保留当前 commit SHA，记录待发布 SHA。不要覆盖尚未提交的用户改动。

```sh
CRM_RELEASE_SHA=$(git rev-parse origin/main)
git switch --detach "$CRM_RELEASE_SHA"
git rev-parse HEAD
```

开发和发布使用不同 checkout。发布目录的 `.env` 保持线上配置；不得从开发 checkout 直接复制。
核对 `deploy/boxlite/.local/deployment.json` 中的 sandbox，以及数据库主机和分支。只输出主机等非秘密标识。

## 2. 准备部署工具

在仓库外建立专用 Python 环境。以下 SDK 版本来自现有部署手册：

```sh
python3 -m venv ../boxlite-crm-deploy-venv
. ../boxlite-crm-deploy-venv/bin/activate
python -m pip install 'boxlite==0.11.0'
export BOXLITE_REST_URL=https://api.dev.boxlite.ai
```

从秘密管理工具向进程注入 `BOXLITE_API_KEY`。`manage.py` 不自动读取 shell 中其他别名。
原维护机使用过 `boxlite_dev_api_key`，不能认为它与 SDK 的大写变量自动等价。

```sh
python deploy/boxlite/manage.py status
```

必须确认 API 可访问、凭证所属组织正确、sandbox 存在。
本机曾使用临时代理/DNS 适配。那些聊天工作目录脚本不是发布依赖；先修复网络或使用可正常连接的平台维护终端。
不要复制历史硬编码 IP 作为长期配置。

## 3. 备份与发布前验证

```sh
python deploy/boxlite/manage.py backup
```

该命令从线上当前配置的 Neon 导出，而不是从本地 PostgreSQL 导出。
`deploy/boxlite/.local/crm.dump` 会被下一次备份覆盖，立即另存本次快照：

```sh
CRM_RELEASE_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p deploy/boxlite/.local/releases
cp deploy/boxlite/.local/crm.dump "deploy/boxlite/.local/releases/${CRM_RELEASE_STAMP}-before.dump"
cp .env "deploy/boxlite/.local/releases/${CRM_RELEASE_STAMP}.env"
chmod 600 deploy/boxlite/.local/releases/*
```

上述 `.env` 快照是本地发布配置。若存在配置漂移，还须由平台文件下载能力保存 `/app/crm/.env`，不能把本地副本当成线上副本。
数据库迁移先在隔离 Neon 分支验证。导出和恢复使用直连 URL、匹配服务器版本的 PostgreSQL 客户端。

```sh
bun install --frozen-lockfile
npm run build -- --force
git diff --check
```

开发阶段测试、类型检查和人工验收记录随发布单保存。备份和构建失败时不进入维护窗口。

## 4. 停写、上传、迁移、构建

```sh
python deploy/boxlite/manage.py run 'supervisorctl -c /app/crm/deploy/boxlite/supervisord.conf stop sync api web'
python deploy/boxlite/manage.py upload
```

`upload` 只归档已提交的 `HEAD`，不上传工作区修改、`.env`、依赖或私密文件；限制为 16 MiB。
它在 `/app/crm` 原地解压，并非原子发布，也不自动删除旧版本遗留文件。
删除或重命名路由时，核对并删除该版本明确废弃的路径，不能清空整个应用目录。

仅在配置确实变化且已核对线上值时执行：

```sh
python deploy/boxlite/manage.py upload-env
```

不要因为普通代码发布而覆盖线上配置。

```sh
python deploy/boxlite/manage.py run 'set -eu
cd /app/crm
bun install --frozen-lockfile --registry https://registry.npmjs.org
bun run --filter=@crm/db db:deploy
bun run --filter=@crm/db db:generate
NEXT_TELEMETRY_DISABLED=1 bun run --filter=app build > /root/crm-release-build.log 2>&1'
```

API 由 Supervisor 直接运行 Bun TypeScript，不需要上传本地 macOS 构建产物。
Next.js 必须在 Linux sandbox 构建。修改 `APP_URL` / `API_URL` 后也要重新构建网页。
构建失败时读取 `/root/crm-release-build.log`，保持维护状态或执行明确的代码回退。

## 5. 恢复服务并验收

```sh
python deploy/boxlite/manage.py run 'supervisorctl -c /app/crm/deploy/boxlite/supervisord.conf start api web sync'
python deploy/boxlite/manage.py status
curl -fsS https://internal-crm.dev.boxliteapp.com/healthz
curl -fsS -o /dev/null -w '%{http_code}\n' https://internal-crm.dev.boxliteapp.com/sign-in
```

预期：`api/web/sync/nginx` 均 RUNNING，健康检查返回数据库可用，登录页 HTTP 200。
Supervisor RUNNING 不等于业务验证通过。

| 验收项 | 通过标准 |
| --- | --- |
| 登录 | 管理员密码登录成功；错误密码被拒绝 |
| Linear SSO | 涉及认证或域名变更时，完成真实授权回跳；仅发起 OAuth 不算全链路通过 |
| 数据读取 | Organizations、Inbound users 和组织详情正常加载 |
| 数据写入 | 临时记录完成新增、修改、刷新读取和清理；写入位于当前 Neon |
| 新功能 | 按发布需求操作；例如字典新增、类型分配、筛选、停用历史值保留 |
| 权限 | 普通成员不能执行管理员专属修改 |
| 同步 | 新任务记录存在，状态推进；RUNNING 不得报告为 SUCCEEDED |

只清理本次创建的测试记录和会话，不能删除原有客户数据。
记录远端实际部署 SHA；本流程不会自动写入版本标记，可在成功后写入非秘密标记：

```sh
python deploy/boxlite/manage.py run "printf '%s\n' '$CRM_RELEASE_SHA' > /app/crm/.deployed-commit"
```

确认变量是本次 `git rev-parse` 输出，不接收任意外部文本。
完成 [发布记录](release-record-template.md)，再报告上线成功。

## 6. 代码回退

1. 记录失败点，停止 API、网页和同步，保留日志。
2. 确认上一版本代码能兼容当前 schema；添加字段通常兼容，删除/重命名字段须单独检查。
3. 在干净发布 checkout 切换到发布记录中的上一 SHA。
4. 重新 `upload`、安装依赖、生成 Prisma client、构建网页、启动服务并验收。
5. 不自动反向执行数据库迁移；不要从旧版本运行 `db:reset` 或 `db:push`。

旧归档不能删除新版本文件；回退新增路由时，显式处理新版本遗留路径。
数据库回退与代码回退不同，见 [运维与恢复](operations.md)。

# 运维与恢复 SOP

## 1. 服务和日志

先使用发布 SOP 配置 Python 环境、平台 API 和密钥，再运行：

```sh
python deploy/boxlite/manage.py status
python deploy/boxlite/manage.py run 'tail -n 40 /var/log/crm-api-error.log'
python deploy/boxlite/manage.py run 'tail -n 40 /var/log/crm-web-error.log'
python deploy/boxlite/manage.py run 'tail -n 40 /var/log/crm-sync.log'
python deploy/boxlite/manage.py run 'tail -n 40 /var/log/crm-sync-error.log'
```

只收集必要日志。分享前去除 token、请求正文、个人信息和连接串。
`manage.py run` 会检查远端退出码；不能只凭本地网络请求成功判断命令成功。
普通进程故障用 Supervisor 重启，不删除 sandbox。

```sh
python deploy/boxlite/manage.py run 'supervisorctl -c /app/crm/deploy/boxlite/supervisord.conf restart api web'
```

修改共享数据库或同步配置时，另行重启 `sync`。启动脚本在使用 Neon 时跳过本地数据库启动。

## 2. 每小时同步

worker 每分钟检查，按小时去重，依次执行 overview、GitHub（当前关闭）、Cloud、billing。
失败源等待 15 分钟重试。每个源有 PostgreSQL advisory lock，避免重复并发。
长任务完成后才继续后续任务；当前没有独立并行的四个 cron。

在 Neon SQL Editor 或受控数据库连接中执行只读查询：

```sql
SELECT source, "scheduledDay", status, processed,
       "startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai' AS started_shanghai,
       "finishedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai' AS finished_shanghai
FROM "importRun"
ORDER BY "startedAt" DESC
LIMIT 20;
```

`scheduledDay` 为历史列名，现在存储 UTC 小时字符串。`processed` 是处理量，不等于新增人数。
按来源检查最新成功时间、当前任务进度和失败原因，不能只看 worker 是否 RUNNING。
Cloud 有按组织、按小时的成员检查点；同小时重试能跳过已成功组织。
跨小时重新刷新来源状态。归档和已删除的映射记录不会被自动创建回来。

仅在需要补跑时执行：

```sh
python deploy/boxlite/manage.py run 'cd /app/crm && bun run --filter=@crm/sync sync --force'
```

`--force` 不绕过 advisory lock，也不重新启用 GitHub。需要人工排他补跑时，先停止常驻 sync，补跑后恢复。
同步检查期间保留人工备注、组织类型、owner、收藏和 Linear 绑定。

## 3. 登录与集成排查

| 现象 | 检查位置 |
| --- | --- |
| Linear 回调失败 | OAuth 应用是否允许 `https://internal-crm.dev.boxliteapp.com/api/auth/callback/linear` |
| 邮箱或 workspace 被拒绝 | `ALLOWED_SIGN_IN=polygala.ai`、`LINEAR_WORKSPACE_ID`、实际 Linear 身份 |
| Admin sign-in 不显示 | `CRM_PASSWORD_LOGIN`、`CRM_ADMIN_USERNAME` 和网页运行配置 |
| 管理员密码被拒绝 | 指定账号、credential 哈希、CRM owner/admin 角色、登录限流 |
| Linear customer / issue 读写失败 | `LINEAR_API_KEY` 的 workspace 和对应权限 |
| Backoffice 401/403 | `BACKOFFICE_API_KEY` 及当前接口 scope |
| 本机失败、sandbox 正常 | DNS、代理、网络链路；从实际部署环境重复必要验证 |

密码变更需要明确执行 `bootstrap`；它会撤销该管理员已有会话。
不要把更新 `.env` 文件等同于数据库密码哈希已变化。
Linear OAuth 凭证、Linear API key 和 Backoffice key 是不同用途，不能互换。

## 4. 数据库备份和迁移

日常备份入口：`python deploy/boxlite/manage.py backup`。
使用 PostgreSQL 18 工具；sandbox 内路径为 `/usr/lib/postgresql/18/bin/pg_dump` 和 `pg_restore`。
默认 shell 的同名命令可能仍指向旧版本。

迁移到新实例的固定顺序：

1. 备份当前 `.env`、Neon 关联、部署状态和源数据库。
2. 核对目标项目、分支和已有数据，不覆盖无关数据库。
3. 用直连地址导出、试恢复，并验证 schema、Prisma 读写和构建。
4. 停止 API、web、sync，取最终快照，恢复到目标。
5. 比较所有业务表的记录数和内容哈希；不只比较 organizations 数量。
6. 仅替换数据库和 Neon 分支配置，保留认证及其他集成凭证。
7. 启动服务，完成登录、真实 CRUD、同步验证，保留旧实例和离线备份。

使用 `pg_restore --no-owner --no-acl --single-transaction --exit-on-error`。
连接秘密通过进程环境或受控配置传入，不写入命令参数。
具体迁移记录见 [NEON.md](../../deploy/boxlite/NEON.md)。

目标已经接收新写入后，不能直接切回旧库。先停止写入、保留两侧快照，再明确新写入的合并方案。
当前仓库没有配置独立的定时离线备份服务。手动 dump、Neon 的恢复能力和额外离线备份是不同机制。

## 5. Sandbox 被删除或重置

Neon 数据独立于 sandbox。先确认原 Neon 仍存在；不要重新 seed 或全量重建数据库。

1. 恢复私密 `.env` 和部署状态备份，核对当前平台密钥所属组织。
2. 确认旧 sandbox 确实不存在；不要把 API 401 当成资源已删除。
3. 在确认需要新建后保存旧 `deployment.json`，使用 `manage.py create` 创建新实例。
4. 上传已提交的源代码和现有 Neon 配置，再安装运行环境。
5. 安装依赖、执行已有 migrations、生成 Prisma client、构建网页。
6. 安装 Nginx 配置及 `/opt/crm-start` 启动入口，验证 Supervisor。
7. 将持有的稳定域名绑定到新 sandbox 的 8080，再执行完整验收。

新实例参考命令：

```sh
python deploy/boxlite/manage.py create
python deploy/boxlite/manage.py upload
python deploy/boxlite/manage.py upload-env
python deploy/boxlite/manage.py run 'sh /app/crm/deploy/boxlite/provision.sh'
```

`provision.sh` 为 Debian 12 x86_64 编写，会安装并启动本地 PostgreSQL 15。
Neon 模式不使用它，运行环境安装后停止这个本地实例：

```sh
python deploy/boxlite/manage.py run 'pg_ctlcluster 15 main stop'
```

**不要运行 `init_database.py`，也不要对已有 Neon 运行 seed。**
复用 [发布 SOP](release.md) 的安装、迁移和构建命令；现有账号不需要 bootstrap。
首次启动入口按 [部署说明](../../deploy/boxlite/README.md) 中 “Activate the gateway and startup script” 安装。

域名操作以当前平台 CLI/API 文档为准：持有域名的组织必须能访问目标 sandbox。
当前稳定域名是 `internal-crm.dev.boxliteapp.com`；生成的 proxy 域名包含 sandbox ID，不能假设可恢复。
保留稳定域名时 OAuth 回调不变。更换域名时同步更新应用 URL、网页构建和 Linear 回调白名单。

## 6. 交接与关闭事件

保存恢复时间、应用 commit、当前数据库项目/分支、域名绑定、验证结果和仍未完成的事项。
删除本次临时验证分支及测试数据。不要删除旧生产数据库或他人资源作为清理动作。
所有凭证、dump 和客户截图留在私密目录，不进入本内部文档目录。

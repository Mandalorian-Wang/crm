# 2026-11-18 CRM 使用体验发布

## 版本和环境

- 仓库：Mandalorian-Wang/crm，远端 main。
- 原版本：b029e69。
- 功能提交：3987ff1；个人纪要保留修正：273c5f4。
- Sandbox：uTE4Z8Pj1LM7。
- 入口：https://internal-crm.dev.boxliteapp.com。
- Neon：steep-frost-79122866 / production。
- 发布日期：2026-11-18，Asia/Shanghai。

## 行为

- Organization 隐藏 Deals、Follow-up 详情标签，不删除其数据。
- Inbound user 保留独立 Notes 标签，读取原 Activity 中的笔记、电话、邮件记录、会议纪要。
- 旧 `tab=activity` 链接继续进入 Notes。Deals、Agent 标签隐藏。
- Daily note 支持粘贴、拖放、选择图片；最多 3 张，每张 2 MB。
- 图片保存在 Neon，与文字共用版本冲突和跨日冻结规则。
- Linear 客户连接使用弹窗，查找、新建、粘贴链接分别显示，绑定后展示 issue 列表。
- 所有 CRM 团队成员可以维护 Organization type 字典和颜色。
- 新增销售使用的 HTTP MCP 服务，沿用 CRM API key、用户身份和字段校验。
- API key 创建弹窗可下载私密配置文件并复制不含密钥的 Codex 接入提示词。

## 数据与配置

- Migration：20261117090000_daily_note_images，仅新增 images JSONB 列，默认空数组。
- 新增运行依赖：@modelcontextprotocol/sdk、express；锁定现有兼容版本。
- 没有更换凭证或数据库。
- nginx 新增 /api/mcp/crm、/rest/、/openapi.json 的 API 转发。
- 备份：deploy/boxlite/.local/20261117-before-usability.dump，Git 忽略。
- 本次未执行备份恢复演练。旧应用版本兼容新增列，代码回退无需删除图片数据。

## 验证

- API 和 App TypeScript 检查通过；变更文件 Biome 检查通过。
- npm run build 通过；sandbox Linux Next.js 构建通过。
- 隔离 Neon 分支迁移成功，分支测试 5 pass / 0 fail，26 assertions。
- 分支测试包含普通成员真实 API key、MCP SDK 客户端、客户增改查、归档恢复、类型管理、图片持久化、冻结、错误 key 与撤销。
- 线上 MCP 测试 1 pass / 0 fail，15 assertions；额外覆盖自定义字段创建、修改、归档恢复、当前用户身份与来源只读字段拒绝。
- 线上 MCP activities.create / activities.timeline 均通过，个人纪要在 Notes 中可见。
- 浏览器验证图片粘贴、保存、刷新后加载，图片 naturalWidth=640。
- 浏览器验证个人旧会议纪要、MCP 新纪要、UI 新纪要均在刷新后保留。
- 浏览器验证 API key 配置文件下载、复制提示词成功，下载文件包含正确 endpoint 和 key；测试 key 已撤销。
- 浏览器验证 Linear 查找、新建、粘贴链接模式互斥；临时组织绑定已有客户后，默认只显示客户和 issue 区域。
- 测试组织、测试 Inbound user、附属笔记、临时类型/字段、API keys 和会话均已清理；隔离 Neon 分支已删除。
- 线上 healthz 返回 status=ok、database=up；api/web/sync/nginx 均 RUNNING。
- 同步恢复后 overview 的 2026-11-17T16:00:00Z 运行成功。
- 执行范围为本次功能相关检查；未运行仓库全部测试和全部 pre-push 检查。

## 接入说明

参见 [销售 Codex 接入](../sales-codex.md)。MCP 协议已通过真实 SDK 验证。
销售本人设备上的首次 Codex 配置，仍由该设备执行复制的提示词完成。

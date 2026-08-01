# 楚河棋局

一个可自行部署的浏览器双人中国象棋应用。玩家通过六位对局码进入同一棋局，服务端负责身份会话、规则校验、实时同步、结果判定和棋谱持久化。

## 主要功能

- 游客昵称直接开局，也可注册账号归档当前设备上的游客棋谱。
- Socket.IO 房间实时同步，刷新或短暂断线后可按会话恢复席位和局面。
- Fairy-Stockfish `ffish` 在服务端生成并校验合法着法。
- 支持将死、困毙、认输、规则和棋及双方协议和棋。
- PostgreSQL 保存完整着法、落子后 FEN 和可分享的复盘记录。
- React 响应式 SVG 棋盘，兼容桌面端和移动端浏览器。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Web | React 19、Vite、Zustand、TanStack Query、Socket.IO Client |
| API | NestJS 11、Socket.IO、Prisma、Zod |
| 规则引擎 | Fairy-Stockfish / `ffish` |
| 数据库 | PostgreSQL 17 |
| 工程化 | TypeScript、pnpm workspace、Vitest、Playwright |
| 部署 | Docker Compose、Caddy |

## 项目结构

```text
apps/web                 React + Vite 前端
apps/api                 NestJS + Socket.IO + Prisma 后端
packages/contracts       前后端共享的 Zod schema 和 TypeScript 类型
e2e                      Playwright 双浏览器对局测试
docker-compose.yml       单机容器部署编排
```

## 本地开发

### 环境要求

- Node.js 24
- pnpm 11
- PostgreSQL

### 启动步骤

```powershell
pnpm install
Copy-Item .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

启动前请确保 `.env` 中的 `DATABASE_URL` 指向可用的 PostgreSQL 数据库，并将 `SESSION_SECRET` 替换为至少 32 字符的随机值。

- Web：`http://localhost:5173`
- API：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`

Vite 开发服务器会将 `/api` 和 `/socket.io` 请求代理到 API 服务。

## 环境变量

| 变量 | 用途 | 开发默认值 |
| --- | --- | --- |
| `PORT` | API 监听端口 | `3000` |
| `APP_ORIGIN` | 允许访问 API/WebSocket 的前端来源 | `http://localhost:5173` |
| `DATABASE_URL` | Prisma 使用的 PostgreSQL 连接串 | 见 `.env.example` |
| `SESSION_SECRET` | 会话令牌 HMAC 密钥 | 必须替换 |
| `COOKIE_SECURE` | 是否只通过 HTTPS 发送会话 Cookie | `false` |

## Docker 部署

复制生产环境示例并填写域名、数据库密码和会话密钥：

```bash
cp .env.production.example .env
docker compose up -d --build
docker compose ps
curl http://your-domain.example:8080/api/health
```

Caddy 代理 HTTP 与 WebSocket；默认配置 `http://` 不启用 TLS（见 `.env.production.example` 的端口说明）。应用容器启动时会执行 `prisma migrate deploy`。

> 注意：`app` 容器只应通过 Caddy 对外暴露。若直接暴露 3000 端口，客户端可伪造 `X-Forwarded-For` 绕过按 IP 的登录限流。
默认配置通过 Caddy 在 `HTTP_PORT=8080` 提供 HTTP 与 WebSocket 反向代理，不会自动启用 TLS。若要公开部署到互联网，请修改 `Caddyfile` 使用 HTTPS，并将应用容器的 `COOKIE_SECURE` 设置为 `true`。

应用容器启动时会自动执行 `prisma migrate deploy`。

### 备份与恢复

```bash
docker compose exec -T db pg_dump -U xiangqi -d xiangqi -Fc > xiangqi.dump
docker compose exec -T db pg_restore -U xiangqi -d xiangqi --clean --if-exists < xiangqi.dump
```

## 质量检查

```powershell
pnpm typecheck
pnpm test
pnpm build
```

运行端到端测试：

```powershell
pnpm exec playwright install chromium
$env:E2E_BASE_URL="http://localhost:5173"
pnpm test:e2e
```

端到端测试会创建真实游客对局并写入目标数据库，请勿将其指向生产环境。

## 分支

- `main`：稳定基线和项目文档。
- `dev`：正在集成和验证的最新改动。

## 安全与许可证说明

- 会话使用随机 HttpOnly Cookie，数据库只保存 HMAC 摘要；Cookie 同时设置 SameSite=Lax。默认部署在 HTTP 上，`COOKIE_SECURE=false`；若通过 HTTPS 对外提供服务，请在 `.env` 中设置 `COOKIE_SECURE=true` 强制 Secure。
- 密码使用 Argon2id 哈希，所有 Socket 落子都重新校验身份、回合、棋步序号和规则。
- `ffish` / Fairy-Stockfish 使用 GPL-3.0。自托管服务可以使用；若分发闭源软件或容器镜像，请先评估相应许可证义务。

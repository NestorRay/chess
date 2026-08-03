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
| 部署 | Docker Compose、宿主机 nginx/Caddy 反向代理 |

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

安装 Docker Engine 和 Compose 插件，将 `.env.production.example` 复制为 `.env`，将 `APP_ORIGIN` 改为实际 HTTPS 域名，并填写数据库密码和至少 32 字符的会话密钥，然后运行：

```bash
cp .env.production.example .env
docker compose up -d --build
docker compose ps
curl https://your-domain.example/api/health
```

项目只监听本机回环端口 `127.0.0.1:${HTTP_PORT}`（默认 8080），同一端口提供前端静态资源、API 与 Socket.IO；HTTPS 由同一台机器上的外部反代（nginx 或 Caddy）转发并终止。

外部反代示例（nginx，指向同一台机器的 8080 端口）：

```nginx
server {
  listen 443 ssl;
  server_name chess.example.com;
  # ssl_certificate / ssl_certificate_key ...

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";  # WebSocket（/socket.io）
  }
}
```

> 注意：`HTTP_PORT` 只绑定 `127.0.0.1`，仅供本机反代访问。不要改成 `0.0.0.0` 直接暴露公网，否则客户端可伪造 `X-Forwarded-For` 绕过按 IP 的登录限流。

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

- 会话使用随机 HttpOnly Cookie，数据库只保存 HMAC 摘要；Cookie 同时设置 SameSite=Lax。生产环境经外部反代以 HTTPS 对外访问，`.env.production.example` 中 `COOKIE_SECURE=true` 强制 Cookie 携带 Secure；本地纯 HTTP 直连测试时需改回 `false` 并同步调整 `APP_ORIGIN`。
- 密码使用 Argon2id 哈希，所有 Socket 落子都重新校验身份、回合、棋步序号和规则。
- `ffish` / Fairy-Stockfish 使用 GPL-3.0。自托管服务可以使用；若分发闭源软件或容器镜像，请先评估相应许可证义务。

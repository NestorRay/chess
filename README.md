# 楚河棋局

一个面向浏览器的双人在线中国象棋程序。两名玩家输入同一六位对局码即可实时对弈，服务端负责中国象棋规则校验、将死判定、对局持久化和逐手复盘。

## 功能

- 游客昵称直接对局，也可注册账号并归档当前设备的游客棋谱。
- Socket.IO 房间实时同步；刷新或短暂断线后按会话恢复席位和局面。
- Fairy-Stockfish `ffish` 在服务端生成合法着法，客户端不能绕过规则提交棋步。
- 支持将死、困毙、认输、规则和棋和双方协议和棋。
- PostgreSQL 保存每一步及落子后 FEN，复盘页可跳转到任意棋步。
- React 响应式 SVG 棋盘，适配桌面和手机浏览器。

## 项目结构

```text
apps/web                 React + Vite 前端
apps/api                 NestJS + Socket.IO + Prisma 后端
packages/contracts       前后端共享的 Zod schema 和 TypeScript 类型
e2e                      Playwright 双浏览器对局测试
docker-compose.yml       Ubuntu 单机生产部署
```

## 本地开发

需要 Node.js 24、pnpm 11 和 PostgreSQL。

```powershell
pnpm install
Copy-Item .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

默认前端地址为 `http://localhost:5173`，API 为 `http://localhost:3000`。Vite 会代理 `/api` 和 `/socket.io`。

## Ubuntu 部署

安装 Docker Engine 和 Compose 插件，将 `.env.production.example` 复制为 `.env`，填写域名、数据库密码和至少 32 字符的会话密钥，然后运行：

```bash
docker compose up -d --build
docker compose ps
curl https://your-domain.example/api/health
```

Caddy 代理 HTTP 与 WebSocket；默认配置 `http://` 不启用 TLS（见 `.env.production.example` 的端口说明）。应用容器启动时会执行 `prisma migrate deploy`。

备份与恢复：

```bash
docker compose exec -T db pg_dump -U xiangqi -d xiangqi -Fc > xiangqi.dump
docker compose exec -T db pg_restore -U xiangqi -d xiangqi --clean --if-exists < xiangqi.dump
```

## 验证

```powershell
pnpm typecheck
pnpm test
$env:E2E_BASE_URL="https://your-test-domain.example"
pnpm test:e2e
```

首次运行 Playwright 前执行 `pnpm exec playwright install chromium`。端到端测试会创建真实游客对局并写入测试数据库，不应指向生产环境。

## 安全与许可证

- 会话使用随机 HttpOnly Cookie，数据库只保存 HMAC 摘要；Cookie 同时设置 SameSite=Lax。默认部署在 HTTP 上，`COOKIE_SECURE=false`；若通过 HTTPS 对外提供服务，请在 `.env` 中设置 `COOKIE_SECURE=true` 强制 Secure。
- 密码使用 Argon2id 哈希，所有 Socket 落子都重新校验身份、回合、棋步序号和规则。
- `ffish` / Fairy-Stockfish 使用 GPL-3.0。自托管服务可以使用；若分发闭源软件或容器镜像，请先评估相应许可证义务。

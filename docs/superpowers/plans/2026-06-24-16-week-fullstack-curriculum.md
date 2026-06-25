# 16 周多人协作任务管理系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 16 周、每天 3–4 小时完成一个可测试、可容器化、可部署的多人协作任务管理系统，同时补齐 SQL、PostgreSQL、认证、安全、测试和 Docker 基础。

**Architecture:** 使用 pnpm Workspace 管理 Next.js Web、NestJS API 和共享契约包。API 采用模块化单体架构，数据存储使用 PostgreSQL，Prisma 负责迁移和常规数据访问，Redis 用于 Session、缓存与限流；所有业务通过 REST/OpenAPI 暴露。

**Tech Stack:** TypeScript、Node.js 24 LTS、Next.js App Router、NestJS、PostgreSQL、Prisma、Redis、Jest、Supertest、Playwright、Docker Compose、GitHub Actions。

---

## 0. 执行规则

### 每天固定节奏

- [ ] 45–60 分钟：阅读当天列出的概念和官方文档，写 5–10 条笔记。
- [ ] 45–60 分钟：在 `examples/` 完成独立案例，不复制主项目代码。
- [ ] 90–120 分钟：在主项目实现当天功能。
- [ ] 15–30 分钟：运行验证命令，记录错误原因，提交当天代码。

### 每天完成定义

- [ ] 代码能够在全新终端中通过明确命令运行。
- [ ] 正常路径和至少一个失败路径经过验证。
- [ ] `docs/learning/week-XX.md` 记录当天结论和问题。
- [ ] 创建一个小而明确的 Git 提交；禁止把一周内容堆成一个提交。

### 每周第 7 天固定动作

- [ ] 从空环境重跑本周功能。
- [ ] 修复本周遗留问题，不增加新需求。
- [ ] 用自己的话回答本周复盘题。
- [ ] 更新 README、接口文档或架构文档。
- [ ] 打标签：`git tag week-XX`。

## 1. 目标目录结构

```text
codex-full-stack/
├─ apps/
│  ├─ web/                         # Next.js App Router
│  └─ api/                         # NestJS 模块化单体
├─ packages/
│  └─ contracts/                   # API DTO、枚举和共享类型
├─ examples/
│  ├─ node-http/
│  ├─ async-runtime/
│  ├─ sql/
│  ├─ security/
│  └─ docker/
├─ e2e/                            # Playwright 跨应用测试
├─ infra/
│  ├─ compose/
│  ├─ nginx/
│  └─ scripts/
├─ docs/
│  ├─ learning/
│  ├─ architecture/
│  └─ api/
├─ docker-compose.yml
├─ pnpm-workspace.yaml
├─ package.json
└─ .env.example
```

## 2. 环境基线

安装并确认：

```powershell
node --version
corepack enable
pnpm --version
git --version
docker version
docker compose version
```

预期：

- Node.js 为 `v24.x` LTS。
- pnpm、Git、Docker 和 Docker Compose 均能输出版本。
- Docker Desktop 使用 WSL2 后端。

推荐官方资料：

- Node.js Learn：<https://nodejs.org/en/learn>
- TypeScript Handbook：<https://www.typescriptlang.org/docs/handbook/intro.html>
- Next.js App Router：<https://nextjs.org/docs/app>
- NestJS：<https://docs.nestjs.com/>
- PostgreSQL Tutorial：<https://www.postgresql.org/docs/current/tutorial.html>
- Prisma ORM：<https://www.prisma.io/docs/orm>
- Docker Get Started：<https://docs.docker.com/get-started/>
- Playwright：<https://playwright.dev/docs/intro>
- GitHub Actions：<https://docs.github.com/en/actions>
- OWASP Top 10：<https://owasp.org/www-project-top-ten/>

---

# 第一阶段：语言、运行时与 HTTP

## 第 1 周：TypeScript、Node.js 运行时与原生 HTTP

**周目标：** 不依赖框架写出一个具备路由、JSON 解析、错误处理和优雅退出的 HTTP 服务。

**本周产物：**

- `examples/async-runtime/`
- `examples/node-http/`
- 根目录 Workspace 骨架
- `GET /health`、`GET /tasks`、`POST /tasks` 原生接口

### Day 1：环境、Git 与 Workspace

- [ ] 学习：Node.js LTS、ESM/CommonJS、`package.json`、Semantic Versioning、lockfile。
- [ ] 初始化 Git：`git init`，创建 `.gitignore`，忽略 `node_modules/`、`.env`、`.next/`、`dist/`、`coverage/`。
- [ ] 执行 `corepack use pnpm@latest-10`，确认根 `package.json` 设置 `"private": true` 并记录 Corepack 解析出的精确 pnpm 版本。
- [ ] 创建 `pnpm-workspace.yaml`，包含 `apps/*`、`packages/*`、`examples/*`。
- [ ] 验证：`pnpm install` 后生成 `pnpm-lock.yaml`。

### Day 2：TypeScript 严格模式

- [ ] 学习：原始类型、联合类型、接口、类型别名、泛型、类型收窄、`unknown` 与 `never`。
- [ ] 创建 `examples/typescript-basics/src/task.ts`，定义 `TaskStatus`、`Task`、`createTask()`。
- [ ] 为非法状态、缺失标题和正确创建分别编写测试。
- [ ] 开启 `strict`、`noUncheckedIndexedAccess` 和 `exactOptionalPropertyTypes`。
- [ ] 验证：`pnpm --filter typescript-basics test`。

关键案例：

```ts
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
}

export function createTask(title: string): Task {
  const normalized = title.trim();
  if (!normalized) throw new Error('TITLE_REQUIRED');
  return { id: crypto.randomUUID(), title: normalized, status: 'TODO' };
}
```

### Day 3：异步编程与事件循环

- [ ] 学习：调用栈、微任务、计时器、Promise、`async/await`、并发与串行。
- [ ] 在 `examples/async-runtime/src/event-loop.ts` 写一段包含同步代码、Promise 和 `setTimeout()` 的程序，先预测后运行。
- [ ] 实现 `runSequential()` 和 `runConcurrent()`，比较三个模拟请求的耗时。
- [ ] 使用 `Promise.allSettled()` 处理部分失败。
- [ ] 验证：记录两种执行方式的实际耗时和顺序。

### Day 4：Node.js 核心模块与错误处理

- [ ] 学习：`node:fs/promises`、`node:path`、`node:url`、进程信号和环境变量。
- [ ] 创建 `examples/async-runtime/src/file-store.ts`，读写 JSON 任务文件。
- [ ] 区分编程错误、业务错误和外部系统错误。
- [ ] 为文件不存在和 JSON 损坏编写失败案例。
- [ ] 验证：程序失败时返回非零退出码且不吞掉错误。

### Day 5：原生 HTTP 服务

- [ ] 学习：请求方法、URL、Header、Body、状态码、Content-Type。
- [ ] 创建 `examples/node-http/src/server.ts`，实现 `GET /health`。
- [ ] 创建纯函数 `routeRequest(method, pathname)`，先写路由测试再实现。
- [ ] 为未知路由返回 `404 application/json`。
- [ ] 使用 `curl.exe -i http://localhost:3001/health` 验证。

关键案例：

```ts
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ code: 'NOT_FOUND' }));
});

server.listen(3001);
```

### Day 6：内存任务 API

- [ ] 实现请求体读取函数，设置 1 MB 上限并处理非法 JSON。
- [ ] 先写测试，再实现 `GET /tasks` 和 `POST /tasks`。
- [ ] 对空标题返回 `400`，成功创建返回 `201`。
- [ ] 监听 `SIGINT` 和 `SIGTERM`，调用 `server.close()`。
- [ ] 编写 `examples/node-http/README.md`，列出 curl 示例。

### Day 7：复盘与验收

- [ ] 删除 `node_modules` 后执行 `pnpm install`，确认案例可重建。
- [ ] 运行 `pnpm --filter node-http test` 和手工 curl 验证。
- [ ] 回答：事件循环为什么不等于多线程？`unknown` 为什么比 `any` 安全？
- [ ] 回答：什么时候返回 400、404、409、500？
- [ ] 周提交建议：`feat: build native node task api`。

**周验收：**

```powershell
pnpm --filter node-http test
pnpm --filter node-http dev
curl.exe -i http://localhost:3001/health
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"Learn HTTP\"}"
```

---

## 第 2 周：NestJS、分层与 HTTP 工程化

**周目标：** 创建 NestJS API，理解 Module、Controller、Provider、依赖注入、Pipe 和 Exception Filter。

### Day 1：创建 API 应用

- [ ] 使用 `pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git` 创建应用。
- [ ] 阅读 `main.ts`、`app.module.ts`、Controller 和 Service 的依赖关系。
- [ ] 删除示例 Hello World，创建 `HealthModule`。
- [ ] 实现 `GET /api/health`，返回版本、时间和状态。
- [ ] 验证：`pnpm --filter api start:dev`。

### Day 2：依赖注入与模块边界

- [ ] 学习 Provider token、构造器注入、模块导入与导出。
- [ ] 创建 `TasksModule`、`TasksController`、`TasksService`。
- [ ] 使用内存数组实现 `findAll()`，Controller 只处理 HTTP。
- [ ] 编写 Service 单元测试，禁止在 Controller 中直接访问数组。
- [ ] 验证：`GET /api/tasks` 返回 JSON 数组。

### Day 3：DTO 与验证

- [ ] 安装并配置 `class-validator`、`class-transformer` 和全局 `ValidationPipe`。
- [ ] 创建 `CreateTaskDto`，标题长度为 1–120。
- [ ] 开启 `whitelist`、`forbidNonWhitelisted` 和 `transform`。
- [ ] 为无标题和额外字段写 API 测试。
- [ ] 验证错误响应包含稳定的 `code`、`message` 和 `details`。

### Day 4：统一异常

- [ ] 学习 NestJS Exception Filter 与 HTTP 异常。
- [ ] 创建 `DomainError` 和全局 `HttpExceptionFilter`。
- [ ] 把 `TASK_NOT_FOUND` 映射为 404，把重复资源映射为 409。
- [ ] 为未知错误返回通用消息，并记录内部堆栈。
- [ ] 验证响应不泄漏文件路径或堆栈。

关键响应结构：

```ts
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  requestId: string;
}
```

### Day 5：中间件、拦截器和请求 ID

- [ ] 学习 Middleware、Guard、Interceptor、Pipe、Filter 的执行顺序。
- [ ] 创建请求 ID 中间件，接受或生成 `x-request-id`。
- [ ] 创建日志拦截器，记录方法、路径、状态码和耗时。
- [ ] 为响应 Header 中的 `x-request-id` 编写测试。
- [ ] 验证一次 200 和一次 404 请求日志。

### Day 6：配置与 OpenAPI

- [ ] 安装 `@nestjs/config` 和 `@nestjs/swagger`。
- [ ] 创建环境变量验证，缺少 `PORT` 或非法端口时启动失败。
- [ ] 配置 Swagger UI 到 `/docs`，JSON 到 `/docs-json`。
- [ ] 为 Health 和 Task DTO 添加 API Schema。
- [ ] 创建 `.env.example`，不提交真实 `.env`。

### Day 7：复盘与验收

- [ ] 从原生 HTTP 案例画出到 NestJS Middleware/Pipe/Guard/Controller/Service/Filter 的映射。
- [ ] 运行 API 单元和集成测试。
- [ ] 回答：依赖注入解决什么问题？为什么 DTO 不等于数据库模型？
- [ ] 检查 Controller 是否只负责协议转换和调用 Service。
- [ ] 周提交建议：`feat: establish nest api foundation`。

**周验收：**

```powershell
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
```

---

# 第二阶段：SQL、PostgreSQL 与数据建模

## 第 3 周：PostgreSQL 与手写 SQL

**周目标：** 不使用 ORM 完成建表、约束、连接查询、聚合、事务和索引练习。

### Day 1：启动 PostgreSQL 与基础命令

- [ ] 用 Docker 启动独立 PostgreSQL：`docker run --name task-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=taskdb -p 5432:5432 -d postgres:17`。
- [ ] 学习数据库、Schema、表、行、列和数据类型。
- [ ] 使用 `docker exec -it task-pg psql -U postgres -d taskdb` 进入 psql。
- [ ] 练习 `\l`、`\dt`、`\d`、`\q`。
- [ ] 创建 `examples/sql/01-basics.sql`。

### Day 2：DDL 与约束

- [ ] 学习主键、外键、唯一约束、非空约束和检查约束。
- [ ] 手写 `users`、`teams`、`team_members` 三张表。
- [ ] 验证重复邮箱失败、无效角色失败、孤立成员失败。
- [ ] 学习 `ON DELETE RESTRICT` 与 `ON DELETE CASCADE` 的区别。
- [ ] 保存验证语句到 `examples/sql/02-constraints.sql`。

关键 SQL：

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(320) NOT NULL UNIQUE,
  display_name varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE team_members (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'VIEWER')),
  PRIMARY KEY (team_id, user_id)
);
```

### Day 3：增删改查与参数化

- [ ] 练习 `INSERT ... RETURNING`、`SELECT`、`UPDATE`、`DELETE`。
- [ ] 练习 `WHERE`、`ORDER BY`、`LIMIT`、`OFFSET`。
- [ ] 学习 SQL 注入成因，禁止字符串拼接用户输入。
- [ ] 使用 Node `pg` 包执行参数化查询 `$1`。
- [ ] 创建 `examples/sql/src/parameterized-query.ts`。

### Day 4：JOIN 与聚合

- [ ] 练习 `INNER JOIN`、`LEFT JOIN`、`GROUP BY`、`COUNT` 和 `HAVING`。
- [ ] 查询每个团队的成员数量。
- [ ] 查询没有任务的项目。
- [ ] 查询每个成员完成任务数。
- [ ] 使用表格写清楚连接前后的行数变化。

### Day 5：事务与并发

- [ ] 学习 ACID、事务边界、提交和回滚。
- [ ] 用事务实现“创建团队，同时把创建人加入管理员”。
- [ ] 故意让第二条语句失败，验证第一条语句被回滚。
- [ ] 开两个 psql 会话观察行锁。
- [ ] 记录脏读、不可重复读和幻读的定义。

### Day 6：索引与执行计划

- [ ] 学习 B-tree、复合索引、选择性和最左前缀。
- [ ] 生成至少 10,000 条任务测试数据。
- [ ] 对比有无索引时 `EXPLAIN (ANALYZE, BUFFERS)`。
- [ ] 为 `(project_id, status, created_at DESC)` 创建复合索引。
- [ ] 删除无用索引，记录“索引提高读、增加写成本”的证据。

### Day 7：复盘与验收

- [ ] 从空数据库顺序执行所有 SQL 文件。
- [ ] 手写一个包含 JOIN、聚合、筛选和排序的查询。
- [ ] 回答：为什么不能给每列都建索引？事务边界应该由谁决定？
- [ ] 导出 Schema：`pg_dump --schema-only`。
- [ ] 周提交建议：`learn: complete postgres sql exercises`。

**周验收：**

```powershell
docker exec -i task-pg psql -U postgres -d taskdb -v ON_ERROR_STOP=1 < examples/sql/01-basics.sql
docker exec -i task-pg psql -U postgres -d taskdb -v ON_ERROR_STOP=1 < examples/sql/02-constraints.sql
```

PowerShell 对输入重定向兼容不一致时，使用：

```powershell
Get-Content -Raw examples/sql/02-constraints.sql | docker exec -i task-pg psql -U postgres -d taskdb -v ON_ERROR_STOP=1
```

---

## 第 4 周：领域建模、Prisma 与 Migration

**周目标：** 把手写关系模型转换为 Prisma Schema，并理解 Migration 而不是只会 `db push`。

### Day 1：完成 ER 模型

- [ ] 画出 User、Team、TeamMember、Project、ProjectMember、Task、Comment 的关系。
- [ ] 明确每张表的主键、唯一约束、外键和删除策略。
- [ ] 写 `docs/architecture/data-model.md`。
- [ ] 为邮箱、成员关系和项目 slug 定义唯一性。
- [ ] 用三个业务场景检查模型是否支持查询。

### Day 2：接入 Prisma

- [ ] 在 API 安装 Prisma CLI 和 Client。
- [ ] 执行 `pnpm --filter api exec prisma init --datasource-provider postgresql`。
- [ ] 配置 `DATABASE_URL`，创建 `PrismaModule` 和 `PrismaService`。
- [ ] 仅在基础设施层依赖 Prisma Client。
- [ ] 验证 API 启动时能执行 `SELECT 1`。

### Day 3：Schema 与第一次 Migration

- [ ] 在 `apps/api/prisma/schema.prisma` 定义 User、Team 和 TeamMember。
- [ ] 用枚举定义 `TeamRole`。
- [ ] 执行命名 Migration：`prisma migrate dev --name create_users_and_teams`。
- [ ] 阅读生成 SQL，逐行对应第 3 周手写约束。
- [ ] 禁止修改已应用 Migration；需要变化时创建新 Migration。

关键模型：

```prisma
enum TeamRole {
  ADMIN
  MEMBER
  VIEWER
}

model TeamMember {
  teamId   String   @db.Uuid
  userId   String   @db.Uuid
  role     TeamRole
  team     Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([teamId, userId])
}
```

### Day 4：Project 与 Task 模型

- [ ] 添加 Project、ProjectMember、Task、Comment。
- [ ] 定义 `TaskStatus` 和 `TaskPriority` 枚举。
- [ ] Task 包含创建人、负责人、截止时间和软删除时间。
- [ ] 创建适合任务列表查询的复合索引。
- [ ] 创建并检查第二个 Migration。

### Day 5：种子数据

- [ ] 创建 `apps/api/prisma/seed.ts`。
- [ ] 生成 3 个用户、2 个团队、3 个项目和不少于 30 个任务。
- [ ] 使用固定标识和 upsert，保证重复运行不会无限新增。
- [ ] 添加 `db:seed` 脚本。
- [ ] 验证种子运行两次后的记录数量一致。

### Day 6：Repository 边界与事务

- [ ] 定义 `UserRepository` 和 `TeamRepository` 接口。
- [ ] 创建 Prisma 实现，Service 不返回 Prisma 生成的复杂类型。
- [ ] 用 Prisma Transaction 实现团队创建和管理员成员写入。
- [ ] 为回滚路径编写集成测试。
- [ ] 记录何时适合直接用 Prisma、何时需要 Repository。

### Day 7：复盘与验收

- [ ] 删除本地开发数据库并从 Migration 重建。
- [ ] 运行种子并用 SQL 检查数据。
- [ ] 回答：Migration 与 `db push` 有什么区别？复合主键为什么适合成员表？
- [ ] 用 `prisma studio` 检查关系，但不能用它代替 SQL 验证。
- [ ] 周提交建议：`feat: model collaboration domain with prisma`。

**周验收：**

```powershell
pnpm --filter api exec prisma validate
pnpm --filter api exec prisma migrate reset --force
pnpm --filter api db:seed
pnpm --filter api test:integration
```

---

# 第三阶段：后端业务与安全

## 第 5 周：用户、团队和项目 API

**周目标：** 完成第一批真实数据库 CRUD，并保持 Controller、Service、Repository 边界清晰。

### Day 1：用户模块

- [ ] 先写 `UsersService.findById()` 不存在时的失败测试。
- [ ] 实现用户查询和邮箱查询。
- [ ] 对外响应排除密码字段。
- [ ] 创建 `GET /api/users/:id`，验证 UUID。
- [ ] 为 200、400、404 编写 API 测试。

### Day 2：团队创建

- [ ] 先写创建团队事务测试。
- [ ] 实现 `POST /api/teams`。
- [ ] 团队创建者自动成为 ADMIN。
- [ ] 对名称进行 trim 和长度验证。
- [ ] 验证团队和成员记录要么同时成功，要么同时失败。

### Day 3：团队列表与详情

- [ ] 实现“查询当前用户参与的团队”。
- [ ] 实现团队详情并包含当前用户角色。
- [ ] 防止不属于团队的用户读取详情。
- [ ] 使用明确的 select，避免不必要字段和 N+1。
- [ ] 编写成员和非成员测试。

### Day 4：团队成员

- [ ] 实现添加成员、修改角色和移除成员。
- [ ] 禁止移除最后一个管理员。
- [ ] 重复添加成员返回 409。
- [ ] 被移除用户之后不能访问团队。
- [ ] 编写角色变化和边界测试。

### Day 5：项目模块

- [ ] 实现项目创建、列表、详情和修改。
- [ ] 项目必须属于团队。
- [ ] 项目 slug 在团队内唯一。
- [ ] 团队 VIEWER 不能创建项目。
- [ ] 生成 OpenAPI 示例。

### Day 6：契约包

- [ ] 创建 `packages/contracts`。
- [ ] 共享枚举、分页响应和公开 DTO 类型，禁止共享数据库实体。
- [ ] Web 和 API 分别引用 Workspace 包。
- [ ] 构建契约包并检查导出。
- [ ] 写 `docs/api/error-contract.md`。

### Day 7：复盘与验收

- [ ] 使用 API 客户端完整执行用户→团队→成员→项目流程。
- [ ] 检查所有失败响应是否符合统一结构。
- [ ] 回答：为什么公开 DTO 和数据库模型必须分离？
- [ ] 检查每个 Service 方法是否只有一个明确业务目的。
- [ ] 周提交建议：`feat: add team and project management api`。

---

## 第 6 周：任务 CRUD、分页、筛选和搜索

**周目标：** 完成项目核心任务 API，并掌握可扩展查询设计。

### Day 1：任务创建

- [ ] 定义任务标题、描述、优先级、状态、负责人和截止时间规则。
- [ ] 先写失败测试：项目不存在、负责人不属于项目、截止日期非法。
- [ ] 实现 `POST /api/projects/:projectId/tasks`。
- [ ] 默认状态为 `TODO`，默认优先级为 `MEDIUM`。
- [ ] 返回 201 和公开 Task DTO。

### Day 2：任务详情与更新

- [ ] 实现详情查询。
- [ ] 使用 PATCH DTO，区分缺失字段和显式 `null`。
- [ ] 禁止修改任务所属项目。
- [ ] 校验负责人仍属于项目。
- [ ] 为乐观并发增加 `updatedAt` 条件或版本字段并记录取舍。

### Day 3：软删除

- [ ] 实现 `deletedAt` 软删除。
- [ ] 默认查询排除已删除任务。
- [ ] 重复删除返回 404 或幂等 204，选择一种并写入 API 文档。
- [ ] 管理员恢复任务作为可选管理接口，但不做永久删除 UI。
- [ ] 编写软删除后的列表和详情测试。

### Day 4：Offset 分页

- [ ] 定义 `page`、`pageSize`，限制 `pageSize <= 100`。
- [ ] 返回 `items`、`page`、`pageSize`、`total`、`totalPages`。
- [ ] 在事务中执行 count 和列表查询。
- [ ] 为第一页、末页和空页编写测试。
- [ ] 使用种子任务观察大 offset 查询。

### Day 5：筛选、排序和搜索

- [ ] 支持 status、priority、assigneeId、dueBefore、dueAfter。
- [ ] 允许按 createdAt、updatedAt、dueDate 排序。
- [ ] 标题搜索使用 PostgreSQL `ILIKE`。
- [ ] 对非法排序字段返回 400，禁止动态拼接任意 SQL。
- [ ] 检查查询是否使用第 4 周索引。

关键查询 DTO：

```ts
export interface TaskQuery {
  page: number;
  pageSize: number;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assigneeId?: string;
  search?: string;
  sortBy: 'createdAt' | 'updatedAt' | 'dueDate';
  sortOrder: 'asc' | 'desc';
}
```

### Day 6：API 契约与性能

- [ ] 给任务端点补齐 Swagger 参数和响应。
- [ ] 生成并保存 `docs/api/openapi.json`。
- [ ] 对列表接口记录 SQL 数量和耗时。
- [ ] 修复明显 N+1 查询。
- [ ] 写一个包含 1,000 条任务的性能烟雾脚本。

### Day 7：复盘与验收

- [ ] 用 API 客户端覆盖 CRUD、分页、筛选和搜索。
- [ ] 使用 `EXPLAIN ANALYZE` 检查一个真实列表查询。
- [ ] 回答：Offset 和 Cursor 分页的优缺点是什么？
- [ ] 检查输入验证是否发生在进入 Service 之前。
- [ ] 周提交建议：`feat: implement task lifecycle and queries`。

---

## 第 7 周：评论、审计日志、通知与事务

**周目标：** 实现跨表业务流程，掌握事务、幂等性和副作用边界。

### Day 1：任务评论

- [ ] 实现评论创建和分页列表。
- [ ] 评论作者必须是项目成员。
- [ ] 评论内容 trim 后长度为 1–2,000。
- [ ] 评论删除仅允许作者或管理员。
- [ ] 为权限边界编写测试。

### Day 2：审计日志模型

- [ ] 创建 AuditLog 模型，字段包含 actor、action、entityType、entityId、metadata、createdAt。
- [ ] 记录任务创建、状态变更、负责人变更和删除。
- [ ] 审计记录与业务写入处于同一事务。
- [ ] metadata 只记录必要字段，不保存密码、Session 或完整请求。
- [ ] 实现管理员审计查询接口。

### Day 3：站内通知模型

- [ ] 创建 Notification 模型。
- [ ] 指派任务时给负责人创建通知。
- [ ] 评论中提及用户的功能暂不实现，避免扩大解析范围。
- [ ] 实现通知列表和标记已读。
- [ ] 保证创建者给自己指派任务时不重复通知。

### Day 4：事务用例

- [ ] 把“修改负责人→写审计→创建通知”放入单个应用服务事务。
- [ ] 故意使通知写入失败，验证任务修改回滚。
- [ ] 记录强一致与最终一致的区别。
- [ ] 说明未来使用消息队列时事务边界如何变化。
- [ ] 不在本阶段引入消息队列。

### Day 5：幂等性

- [ ] 学习安全方法、幂等方法和重复请求问题。
- [ ] 为关键创建接口设计 `Idempotency-Key` 案例。
- [ ] 在 `examples/security/idempotency.ts` 实现内存幂等缓存。
- [ ] 主项目只给一个高风险接口实现数据库幂等记录，控制范围。
- [ ] 测试相同 key 重复请求只产生一个结果。

### Day 6：任务附件上传

- [ ] 创建 `Attachment` 模型，记录任务、上传者、原始文件名、MIME、大小和存储 key。
- [ ] 定义 `FileStorage` 接口并实现受控文件系统适配器；容器环境将上传目录挂载到独立命名卷。
- [ ] 限制允许类型和最大文件大小，使用服务端生成的 key，禁止直接信任原始文件名。
- [ ] 实现上传、下载和删除接口；下载前再次校验项目成员权限。
- [ ] 测试超大文件、伪造 MIME、路径穿越文件名和无权限下载。

### Day 7：复盘与验收

- [ ] 演示任务变更同时生成审计和通知。
- [ ] 演示事务失败后三个结果全部不落库。
- [ ] 检查 Tasks、Comments、Attachments、Notifications、Audit 的依赖方向，消除循环注入并更新模块图。
- [ ] 回答：哪些副作用必须强一致？哪些可以最终一致？
- [ ] 检查审计日志是否泄漏敏感信息。
- [ ] 周提交建议：`feat: add comments audit and notifications`。

---

## 第 8 周：Session 认证、RBAC 与 Web 安全

**周目标：** 完成可用于浏览器的认证授权系统，并验证主要 Web 安全边界。

### Day 1：密码存储与注册

- [ ] 学习密码哈希、salt、Argon2id 和暴力破解风险。
- [ ] 安装 Argon2 库，创建 `PasswordHasher` 抽象。
- [ ] 实现注册接口；邮箱标准化并保证唯一。
- [ ] 响应中永不返回 passwordHash。
- [ ] 为重复邮箱和弱密码写测试。

### Day 2：登录与 Session

- [ ] 使用 Redis 存储服务器端 Session。
- [ ] Cookie 设置 `HttpOnly`、`SameSite=Lax`，生产环境启用 `Secure`。
- [ ] 登录成功后轮换 Session ID，防止 Session Fixation。
- [ ] 实现 `POST /auth/login` 和 `GET /auth/me`。
- [ ] 登录失败统一返回相同消息，避免枚举账号。

### Day 3：退出与 Session 生命周期

- [ ] 实现退出并删除 Redis Session。
- [ ] 设置空 Cookie 和立即过期时间。
- [ ] 定义空闲过期和绝对过期时间。
- [ ] 测试退出后旧 Cookie 无法访问受保护接口。
- [ ] 记录多设备登录策略。

### Day 4：认证 Guard

- [ ] 创建 `SessionAuthGuard`。
- [ ] 使用自定义装饰器标记公开端点。
- [ ] 把当前用户放入类型安全的 Request 上下文。
- [ ] 健康检查和登录注册公开，其余默认受保护。
- [ ] 测试匿名请求返回 401。

### Day 5：RBAC 与资源授权

- [ ] 定义 ADMIN、MEMBER、VIEWER 能力矩阵。
- [ ] 创建团队和项目资源授权服务。
- [ ] Guard 做粗粒度认证，Service 做资源级授权。
- [ ] 防止仅通过修改 URL 访问其他团队项目。
- [ ] 为每个角色写允许和拒绝测试。

关键权限矩阵：

| 动作 | ADMIN | MEMBER | VIEWER |
|---|---:|---:|---:|
| 查看项目和任务 | 是 | 是 | 是 |
| 创建和修改任务 | 是 | 是 | 否 |
| 管理成员 | 是 | 否 | 否 |
| 删除项目 | 是 | 否 | 否 |

### Day 6：CORS、CSRF、限流与安全 Header

- [ ] 明确 Web 与 API 的开发和生产 Origin。
- [ ] CORS 只允许明确 Origin，并启用 credentials。
- [ ] 学习 SameSite 与 CSRF 的关系，给状态修改请求增加 CSRF Token 防护。
- [ ] 对登录、注册和密码相关端点增加 Redis 限流。
- [ ] 配置 Helmet，并验证安全 Header。

### Day 7：安全验收

- [ ] 完成注册→登录→受保护请求→退出流程。
- [ ] 尝试跨团队越权、伪造角色、重复登录、爆破登录和 CSRF 请求。
- [ ] 回答：401 与 403 的区别？认证与授权的区别？
- [ ] 根据 OWASP Top 10 写 `docs/architecture/security.md`。
- [ ] 周提交建议：`feat: secure api with session auth and rbac`。

---

# 第四阶段：Next.js 与联调

## 第 9 周：Next.js 应用骨架、认证页面与数据获取

**周目标：** 完成 Web 应用骨架、登录注册、受保护布局和统一 API 客户端。

### Day 1：创建 Next.js 应用

- [ ] 执行 `pnpm create next-app@latest apps/web --ts --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm`。
- [ ] 学习 App Router、Layout、Page、Server Component 和 Client Component。
- [ ] 创建公开布局和应用布局。
- [ ] 设置 `NEXT_PUBLIC_API_URL` 与服务器端 `API_URL`。
- [ ] 验证开发构建和生产构建。

### Day 2：API 客户端

- [ ] 创建 `apps/web/src/lib/api/server.ts` 和 `client.ts`。
- [ ] 服务端请求转发 Cookie，客户端请求启用 credentials。
- [ ] 统一解析 `ApiError`。
- [ ] 对 401、403、404 提供不同处理。
- [ ] 禁止把敏感服务器环境变量暴露为 `NEXT_PUBLIC_*`。

### Day 3：登录页面

- [ ] 使用语义化 HTML 完成登录表单。
- [ ] 实现客户端字段验证和服务端错误展示。
- [ ] 登录成功重定向到 `/app`。
- [ ] 处理提交中状态和重复提交。
- [ ] 用键盘完成全部操作。

### Day 4：注册与退出

- [ ] 完成注册页面和密码规则提示。
- [ ] 服务端仍执行最终验证。
- [ ] 实现退出按钮并清理界面状态。
- [ ] 登录和注册错误不暴露内部细节。
- [ ] 为表单编写组件测试或浏览器冒烟测试。

### Day 5：受保护布局

- [ ] 在服务器端读取当前用户。
- [ ] 未登录访问 `/app/*` 时跳转登录页。
- [ ] 创建导航栏、用户菜单和团队切换入口。
- [ ] 不只依赖 Middleware 做权限判断。
- [ ] 处理 Session 过期。

### Day 6：加载、错误与空状态

- [ ] 创建 `loading.tsx`、`error.tsx` 和 `not-found.tsx`。
- [ ] 为请求失败提供重试操作。
- [ ] 区分“没有数据”和“加载失败”。
- [ ] 检查移动端基础布局。
- [ ] 使用浏览器 Network 面板分析 Cookie 和请求。

### Day 7：复盘与验收

- [ ] 从无 Cookie 状态执行注册、登录、刷新、退出。
- [ ] 关闭 API，验证 Web 显示可理解的错误。
- [ ] 回答：Server Component 和 Client Component 的边界怎么选？
- [ ] 回答：为什么 HttpOnly Cookie 不能由前端读取？
- [ ] 周提交建议：`feat: add next auth experience`。

---

## 第 10 周：团队、项目、任务看板与表单

**周目标：** 完成主要业务界面和可用的端到端操作流程。

### Day 1：团队与项目列表

- [ ] 服务端获取团队和项目列表。
- [ ] 创建空状态和新建团队入口。
- [ ] URL 中保存当前团队和项目标识。
- [ ] 非成员访问项目页面显示 404 或 403。
- [ ] 检查列表是否产生重复请求。

### Day 2：创建和编辑表单

- [ ] 选择 React Hook Form 与 Zod 处理客户端表单。
- [ ] 契约包共享字段规则，但服务端独立验证最终输入。
- [ ] 创建团队和项目表单。
- [ ] 实现字段级错误和表单级错误。
- [ ] 成功后刷新正确缓存或重新获取数据。

### Day 3：任务列表

- [ ] 创建任务表格，显示标题、状态、优先级、负责人和截止时间。
- [ ] 把分页、筛选、排序写入 URL Search Params。
- [ ] 刷新页面后保持查询状态。
- [ ] 使用 debounce 处理搜索框。
- [ ] 为无障碍表格添加标题和可访问标签。

### Day 4：任务看板

- [ ] 创建 TODO、IN_PROGRESS、DONE 三列。
- [ ] 第一版使用明确的“移动到”菜单，不立即引入拖拽库。
- [ ] 状态更新失败时恢复界面并显示错误。
- [ ] 检查 VIEWER 看得到但不能修改。
- [ ] 记录之后增加拖拽的必要条件。

### Day 5：任务详情与评论

- [ ] 创建任务详情页或侧边面板。
- [ ] 支持编辑标题、描述、负责人、优先级和截止日期。
- [ ] 创建评论列表和发表评论表单。
- [ ] 提交成功后只更新必要数据。
- [ ] 处理被其他用户删除后的 404。

### Day 6：成员、通知与权限 UI

- [ ] 创建团队成员管理页面。
- [ ] 只有 ADMIN 显示成员管理操作，但后端仍必须拒绝越权。
- [ ] 创建通知列表和标记已读。
- [ ] 显示未读数量。
- [ ] 使用两个不同角色账户验证界面。

### Day 7：复盘与验收

- [ ] 演示：登录→建团队→建项目→建任务→改状态→评论→查看通知。
- [ ] 使用慢速网络检查加载状态。
- [ ] 使用键盘完成核心流程。
- [ ] 记录三个前端与 API 契约不一致的问题并修复。
- [ ] 周提交建议：`feat: deliver collaborative task interface`。

---

# 第五阶段：自动化测试

## 第 11 周：单元测试与 API 集成测试

**周目标：** 建立分层测试策略，优先覆盖权限、事务和核心业务规则。

### Day 1：测试策略

- [ ] 写 `docs/architecture/testing.md`。
- [ ] 区分单元、集成、API E2E 和浏览器 E2E。
- [ ] 建立测试命名规则：行为、场景、期望。
- [ ] 列出核心风险：越权、重复成员、事务失败、Session 失效。
- [ ] 不追求无意义的 100% 覆盖率。

### Day 2：Service 单元测试

- [ ] 为 `TasksService` 创建 Repository fake。
- [ ] 测试创建任务成功。
- [ ] 测试负责人不属于项目。
- [ ] 测试 VIEWER 不能修改任务。
- [ ] 测试不存在任务的错误映射。

关键案例：

```ts
it('rejects a viewer updating a task', async () => {
  membership.findRole.mockResolvedValue('VIEWER');

  await expect(
    service.updateTask({ actorId: viewerId, taskId, patch: { title: 'Changed' } }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
```

### Day 3：数据库集成测试

- [ ] 准备独立测试数据库，禁止使用开发数据库。
- [ ] 每个测试套件执行 Migration。
- [ ] 使用事务回滚或清理顺序保证测试隔离。
- [ ] 测试唯一约束、外键和事务回滚。
- [ ] 测试代码不能依赖执行顺序。

### Day 4：认证 API 测试

- [ ] 使用 Supertest Agent 保存 Cookie。
- [ ] 测试注册、登录、`/auth/me`、退出。
- [ ] 测试错误密码和不存在账户返回一致。
- [ ] 测试 Session 过期。
- [ ] 测试 Cookie 标志。

### Day 5：RBAC API 测试

- [ ] 建立 ADMIN、MEMBER、VIEWER 三个测试用户。
- [ ] 用表驱动方式测试权限矩阵。
- [ ] 测试跨团队资源 ID 越权。
- [ ] 测试最后管理员不能被移除。
- [ ] 测试被移除成员立即失去权限。

### Day 6：覆盖率与稳定性

- [ ] 运行覆盖率报告。
- [ ] 优先补业务分支而不是简单 getter。
- [ ] 查找使用真实时间、随机值和共享状态造成的不稳定测试。
- [ ] 固定测试时钟和 ID 生成器。
- [ ] 连续运行测试三次。

### Day 7：复盘与验收

- [ ] 在新数据库上运行全部 API 测试。
- [ ] 故意破坏一个权限判断，确认测试会失败。
- [ ] 回答：Mock 太多为什么会让测试失真？
- [ ] 记录测试耗时并标记最慢的五个测试。
- [ ] 周提交建议：`test: cover domain auth and database behavior`。

**周验收：**

```powershell
pnpm --filter api test
pnpm --filter api test:integration
pnpm --filter api test:e2e
pnpm --filter api test:cov
```

---

## 第 12 周：Playwright 端到端测试与质量门禁

**周目标：** 覆盖真实浏览器核心流程，并形成统一的本地质量命令。

### Day 1：安装 Playwright

- [ ] 在根目录初始化 Playwright。
- [ ] 配置启动 Web 和 API 的 `webServer`。
- [ ] 设置测试数据库和固定种子。
- [ ] 创建登录辅助函数或 storage state。
- [ ] 运行默认 Chromium 测试。

### Day 2：认证流程

- [ ] 编写注册和登录 E2E。
- [ ] 验证错误密码提示。
- [ ] 验证刷新后仍登录。
- [ ] 验证退出后受保护页面重定向。
- [ ] 优先使用 role、label 和可见文本定位元素。

### Day 3：核心业务流程

- [ ] 编写创建团队和项目测试。
- [ ] 编写创建任务、修改状态和发表评论测试。
- [ ] 验证通知出现。
- [ ] 测试之间不共享业务数据。
- [ ] 截图仅用于失败诊断，不用截图断言代替行为断言。

### Day 4：权限 E2E

- [ ] 创建管理员和访客两个浏览器上下文。
- [ ] 验证 VIEWER 看不到修改入口。
- [ ] 直接调用修改操作，验证 API 仍返回 403。
- [ ] 验证管理员可管理成员。
- [ ] 验证跨团队 URL 被拒绝。

### Day 5：可访问性和响应式冒烟

- [ ] 用键盘完成登录、创建任务和修改状态。
- [ ] 检查表单 label、焦点和错误提示关联。
- [ ] 在桌面和移动 viewport 运行核心页面。
- [ ] 修复明显溢出和不可点击问题。
- [ ] 记录尚未覆盖的 WCAG 风险。

### Day 6：统一质量脚本

- [ ] 根 `package.json` 增加 `lint`、`typecheck`、`test`、`test:e2e`、`build`。
- [ ] 增加 `check` 顺序执行静态检查、测试和构建。
- [ ] 确保失败立即返回非零状态。
- [ ] 编写 `CONTRIBUTING.md` 的本地验证部分。
- [ ] 从空依赖执行一次完整检查。

### Day 7：复盘与验收

- [ ] 运行完整质量门禁。
- [ ] 打开 Playwright HTML 报告并分析失败证据。
- [ ] 回答：哪些测试应放到浏览器层，哪些不应该？
- [ ] 删除重复且价值低的 E2E。
- [ ] 周提交建议：`test: protect critical user journeys with playwright`。

**周验收：**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

---

# 第六阶段：Docker、部署与运维

## 第 13 周：Docker 基础与应用镜像

**周目标：** 理解镜像、容器、网络、卷和构建缓存，独立写出 Web/API 多阶段 Dockerfile。

### Day 1：Docker 原理案例

- [ ] 学习 image、container、layer、registry、network、volume。
- [ ] 完成官方 Getting Started 容器练习。
- [ ] 在 `examples/docker/` 写一个最小 Node 镜像。
- [ ] 对比容器删除前后 bind mount 与 volume 数据。
- [ ] 用 `docker inspect` 查看环境变量和网络。

### Day 2：API Dockerfile

- [ ] 创建 `apps/api/Dockerfile`。
- [ ] 使用多阶段构建：deps、build、runner。
- [ ] runner 使用非 root 用户。
- [ ] 只复制运行时需要的文件。
- [ ] 构建并运行 API 镜像。

示例结构：

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter api build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
CMD ["node", "dist/main.js"]
```

执行时需要根据 Prisma 当前生成目录补充运行时文件，并用容器启动验证而不是只看构建成功。

### Day 3：Web Dockerfile

- [ ] 开启 Next.js standalone 输出。
- [ ] 创建多阶段 Web Dockerfile。
- [ ] 区分构建时变量和运行时变量。
- [ ] 使用非 root 用户运行。
- [ ] 验证服务器端 API URL 在容器网络中可用。

### Day 4：构建上下文与缓存

- [ ] 创建 `.dockerignore`。
- [ ] 避免把 `.git`、`.env`、测试报告和本地构建复制进镜像。
- [ ] 调整 COPY 顺序提高依赖缓存命中。
- [ ] 对比首次和第二次构建耗时。
- [ ] 用 `docker history` 查看镜像层。

### Day 5：容器健康与信号

- [ ] 给 API 和 Web 添加健康检查端点或命令。
- [ ] 验证容器接收 SIGTERM 后优雅退出。
- [ ] 设置合理的启动和停止超时。
- [ ] 检查日志写 stdout/stderr，而不是只写容器文件。
- [ ] 模拟 API 崩溃并观察退出码。

### Day 6：镜像安全

- [ ] 扫描镜像依赖漏洞。
- [ ] 确认容器不是 root。
- [ ] 不在镜像层写入密钥或 `.env`。
- [ ] 固定基础镜像主版本并定期更新 lockfile。
- [ ] 写 `docs/architecture/container-security.md`。

### Day 7：复盘与验收

- [ ] 从干净构建缓存构建两个镜像。
- [ ] 运行容器并访问健康检查。
- [ ] 回答：镜像与容器的区别？COPY 顺序为什么影响缓存？
- [ ] 比较本地 Node 运行和容器运行的差异。
- [ ] 周提交建议：`build: containerize web and api`。

---

## 第 14 周：Docker Compose、反向代理、HTTPS、备份与恢复

**周目标：** 一条命令启动完整系统，并完成数据库持久化、备份和恢复演练。

### Day 1：Compose 基础

- [ ] 创建 `docker-compose.yml`，包含 web、api、postgres、redis，并为 API 上传目录配置独立命名卷。
- [ ] 服务通过内部 DNS 名访问，不使用容器 IP。
- [ ] PostgreSQL 和 Redis 不在生产配置公开端口。
- [ ] 配置命名卷保存数据库数据。
- [ ] 使用健康检查和依赖条件控制启动顺序。

关键 Compose 片段：

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: taskdb
      POSTGRES_USER: taskapp
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U taskapp -d taskdb"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres_data:
```

### Day 2：环境变量和密钥

- [ ] 创建 `.env.example`，列出变量名和安全示例。
- [ ] 开发、测试、生产使用不同数据库和 Session Secret。
- [ ] Compose 使用变量替换，不把密钥写入 YAML。
- [ ] 启动时验证所有必需变量。
- [ ] 检查日志不输出完整连接字符串。

### Day 3：Migration 与启动流程

- [ ] 创建一次性 migration 服务或部署脚本。
- [ ] Migration 成功后再启动应用流量。
- [ ] 禁止每个 API 副本同时执行开发 Migration。
- [ ] 用空卷执行一次完整启动。
- [ ] 用已有卷重启，验证数据仍存在。

### Day 4：反向代理

- [ ] 配置 Nginx 或 Caddy，把 `/api` 转发到 API，其余转发到 Web。
- [ ] 转发 Host、真实 IP、协议和请求 ID。
- [ ] 配置合理请求体大小和超时。
- [ ] 只暴露代理的 80/443。
- [ ] 验证 Cookie Domain、Path 和 Secure 策略。

### Day 5：HTTPS

- [ ] 学习 TLS 证书、私钥、证书链和自动续期。
- [ ] 本地可使用受信任开发证书，线上使用 ACME。
- [ ] HTTP 重定向 HTTPS。
- [ ] 检查 HSTS 只在确认 HTTPS 全覆盖后启用。
- [ ] 验证浏览器无混合内容。

### Day 6：备份和恢复

- [ ] 创建 `infra/scripts/backup-db.ps1`，使用 `pg_dump` 生成自定义格式备份。
- [ ] 创建 `infra/scripts/restore-db.ps1`，恢复到新的空数据库。
- [ ] 给备份文件添加时间戳。
- [ ] 实际恢复并检查用户、团队和任务数量。
- [ ] 写明 RPO、RTO 和备份保留策略。

### Day 7：复盘与验收

- [ ] 执行 `docker compose down` 后重新启动，确认命名卷数据存在。
- [ ] 执行 `docker compose down -v` 后从 Migration 和备份恢复。
- [ ] 回答：容器可删除为什么数据不丢？健康检查为什么不等于就绪检查？
- [ ] 更新部署拓扑图。
- [ ] 周提交建议：`ops: run full stack with compose and recovery`。

**周验收：**

```powershell
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail 100 api
```

---

# 第七阶段：CI/CD、可观测性与最终交付

## 第 15 周：GitHub Actions 与部署流水线

**周目标：** 每次提交自动执行质量检查，主分支可受控构建和部署。

### Day 1：CI 基础

- [ ] 学习 Workflow、Event、Job、Step、Runner、Artifact 和 Cache。
- [ ] 创建 `.github/workflows/ci.yml`。
- [ ] 在 pull request 和 main push 触发。
- [ ] 安装固定 Node.js 24 与 pnpm。
- [ ] 使用 `pnpm install --frozen-lockfile`。

### Day 2：静态检查和单元测试

- [ ] 创建 lint、typecheck、unit-test jobs。
- [ ] jobs 可并行执行。
- [ ] 上传覆盖率报告作为 Artifact。
- [ ] 失败时保留清晰日志。
- [ ] 本地命令与 CI 命令保持一致。

关键 CI 片段：

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

### Day 3：数据库和 API 集成测试

- [ ] 使用 GitHub Actions service container 启动 PostgreSQL 和 Redis。
- [ ] 等待健康检查。
- [ ] 执行 Migration 后运行集成和 API 测试。
- [ ] 使用专用测试凭据。
- [ ] 测试失败时输出应用日志但不输出密钥。

### Day 4：Playwright CI

- [ ] 使用官方 Playwright 镜像或安装浏览器依赖。
- [ ] 启动 Web/API 测试环境。
- [ ] 上传 HTML 报告、trace 和失败截图。
- [ ] 设置合理超时。
- [ ] 不用无上限重试掩盖不稳定测试。

### Day 5：镜像构建

- [ ] 在质量检查通过后构建 Web 和 API 镜像。
- [ ] 使用 commit SHA 标记镜像。
- [ ] 同时维护明确的环境标签。
- [ ] 使用 BuildKit 缓存。
- [ ] 扫描镜像并保存报告。

### Day 6：受控部署

- [ ] 创建 staging 环境。
- [ ] 主分支构建后部署到 staging。
- [ ] 生产部署使用 GitHub Environment 审批。
- [ ] 部署后运行健康检查和一个业务烟雾测试。
- [ ] 失败时停止流程并保留上一版本回滚方式。

### Day 7：复盘与验收

- [ ] 创建测试 PR，观察每个 Job。
- [ ] 故意制造 lint 和测试失败，确认流水线阻止通过。
- [ ] 回答：CI、Continuous Delivery、Continuous Deployment 的区别？
- [ ] 写 `docs/architecture/deployment.md`。
- [ ] 周提交建议：`ci: automate checks images and staging deployment`。

---

## 第 16 周：日志、监控、性能、文档与最终验收

**周目标：** 把项目从“能运行”提升到“可维护、可诊断、可交付”。

### Day 1：结构化日志

- [ ] 统一 JSON 日志字段：timestamp、level、requestId、method、path、status、duration。
- [ ] 用户字段仅记录不可逆或内部 ID，不记录密码、Cookie、Token。
- [ ] 错误日志包含错误 code 和内部 stack。
- [ ] 前后端请求 ID 能关联。
- [ ] 验证 2xx、4xx 和 5xx 日志。

### Day 2：错误监控

- [ ] 接入 Sentry 或同类服务的 API 和 Web SDK。
- [ ] 设置 environment 和 release。
- [ ] 上传前端 source map，但不公开 source map。
- [ ] 过滤敏感字段。
- [ ] 主动触发一个受控错误，确认事件到达。

### Day 3：指标和健康检查

- [ ] 区分 liveness 和 readiness。
- [ ] readiness 检查 PostgreSQL 与 Redis。
- [ ] 添加请求数量、错误率和延迟的基础指标。
- [ ] 定义至少三个告警条件。
- [ ] 写运行手册：API 5xx 升高时如何排查。

### Day 4：性能检查

- [ ] 使用浏览器 Performance 和 Network 检查 Web。
- [ ] 使用数据库慢查询和 `EXPLAIN ANALYZE` 检查 API。
- [ ] 找出最慢的三个端点。
- [ ] 给一个读多写少且已测出瓶颈的接口增加 Redis Cache-Aside 缓存，设置 TTL，并在写操作后失效对应 key。
- [ ] 对其他问题只在有证据时增加索引或减少请求。
- [ ] 比较优化前后的数字。

### Day 5：README 与架构文档

- [ ] README 包含产品说明、截图、技术栈、环境要求和启动命令。
- [ ] 提供 `.env.example` 字段说明。
- [ ] 写本地开发、测试、Docker、部署和备份恢复步骤。
- [ ] 更新 ER 图、模块图、部署图和安全说明。
- [ ] 记录五个关键技术取舍。

### Day 6：最终演练

- [ ] 克隆到新目录或使用全新机器环境。
- [ ] 从空数据库执行 Migration 和种子。
- [ ] 启动完整系统。
- [ ] 执行注册、团队、项目、任务、评论、通知和权限演示。
- [ ] 运行全部质量命令并记录耗时。

### Day 7：最终验收与回顾

- [ ] Docker Compose 一条命令启动完整系统。
- [ ] 完成一次备份和恢复。
- [ ] 展示 CI/CD、staging 和错误监控。
- [ ] 解释一次请求从浏览器到数据库再返回的完整路径。
- [ ] 写 `docs/learning/final-retrospective.md`，列出下一阶段学习方向。
- [ ] 周提交建议：`docs: complete production readiness handoff`。

**最终验收命令：**

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

---

## 3. 每周复盘问题模板

将以下内容复制到 `docs/learning/week-XX.md`：

```markdown
# Week XX Review

## 本周交付

## 我能独立解释的概念

## 我仍然依赖复制的部分

## 本周三个错误及根因

## 一条性能或安全证据

## 下周最大风险

## 验证命令与结果
```

## 4. 16 周完成标准

- [ ] 能不用脚手架解释并实现基础 HTTP 请求处理。
- [ ] 能手写 SQL 建模、JOIN、事务、索引和执行计划分析。
- [ ] 能解释 Prisma Migration 生成的 SQL。
- [ ] 能实现 Session、Cookie、CSRF、CORS、限流和 RBAC。
- [ ] 能实现 Next.js Server/Client Component 的合理边界。
- [ ] 能设计单元、集成、API 和浏览器测试。
- [ ] 能从零写 Dockerfile 和 Compose，而不是只复制模板。
- [ ] 能完成备份恢复、CI/CD、日志和生产故障基本定位。
- [ ] 项目可由陌生开发者根据 README 在新环境运行。

## 5. 课程范围控制

16 周内不加入微服务、Kubernetes、Kafka、GraphQL、Event Sourcing、复杂 DDD 和多云架构。若提前完成，优先增加测试质量、SQL 分析、无障碍、备份恢复和故障演练，而不是扩张技术栈。

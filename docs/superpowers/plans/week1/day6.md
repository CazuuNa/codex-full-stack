# Day 6：内存任务 API

> 基于 `2026-06-24-16-week-fullstack-curriculum.md` 中 Week 1 / Day 6 的要求展开：实现请求体读取函数，设置 1 MB 上限并处理非法 JSON；先写测试，再实现 `GET /tasks` 和 `POST /tasks`；对空标题返回 `400`，成功创建返回 `201`；监听 `SIGINT` 和 `SIGTERM`，调用 `server.close()`；编写 `examples/node-http/README.md`，列出 curl 示例。

## 1. 今日目标

Day 6 是从“能返回健康检查”升级到“能处理真实业务请求”的关键一天。完成后，你应该能解释并实现：

- 原生 Node.js 中为什么没有 `req.body`。
- 如何从 `IncomingMessage` 流中读取请求体。
- 为什么必须限制请求体大小。
- 如何处理非法 JSON、空 Body、错误 Content-Type。
- 如何用内存数组实现 `GET /tasks` 和 `POST /tasks`。
- 为什么空标题返回 `400`，创建成功返回 `201`。
- 如何用测试驱动路由和业务规则。
- 如何监听 `SIGINT` / `SIGTERM` 并调用 `server.close()` 优雅退出。
- 如何写 README，把 API 的 curl 示例交付给别人使用。

建议目录：

```text
examples/node-http/
  package.json
  tsconfig.json
  README.md
  src/
    body.ts
    errors.ts
    response.ts
    task-store.ts
    router.ts
    server.ts
    router.test.ts
    body.test.ts
```

## 2. 模块一：原生 Node.js 请求体读取

### 知识点解释

在 Express、NestJS 中你经常写：

```ts
req.body.title
```

但原生 Node.js 的 `IncomingMessage` 没有 `body` 属性。它是一个可读流，请求体会分多段 chunk 到达。你必须自己读取这些 chunk，然后拼接成完整字符串，再解析 JSON。

为什么请求体是流？

- 请求体可能很大，不能默认一次性放进内存。
- 网络传输本来就是分段到达。
- 流让服务端可以边收边处理，也可以在超出限制时提前中断。

Day 6 的要求是实现一个请求体读取函数，并设置 1 MB 上限。

### 学习案例：读取 Raw Body

```ts
// src/body.ts
import type { IncomingMessage } from 'node:http';
import { PayloadTooLargeError } from './errors.js';

export const ONE_MB = 1024 * 1024;

export async function readRawBody(
  req: IncomingMessage,
  maxBytes = ONE_MB,
): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;

    if (totalBytes > maxBytes) {
      throw new PayloadTooLargeError(maxBytes);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}
```

### 扩展理解

这里的关键不是“把代码写出来”，而是理解三个边界：

1. **大小边界**：没有上限会导致内存被大请求拖垮。
2. **编码边界**：HTTP 传输的是字节，解析成字符串时要按编码处理。
3. **异步边界**：请求体不是同步可用的，必须 `await`。

生产级服务还会处理请求中断、连接关闭、压缩体、上传文件等情况。本课程 Day 6 只需要可靠处理 JSON API。

## 3. 模块二：JSON 解析与错误分类

### 知识点解释

读取到 raw body 后，还不能直接相信它是 JSON。

常见失败场景：

- Body 为空。
- Body 不是合法 JSON，例如 `{ title: }`。
- Body 是合法 JSON，但不是对象，例如 `"abc"`、`[]`、`null`。
- Body 是对象，但字段类型不对，例如 `{ "title": 123 }`。
- Body 太大。

这些都属于客户端请求错误，通常返回 `400` 或 `413`：

- 非法 JSON：`400 Bad Request`。
- 请求体过大：`413 Payload Too Large`。
- 字段校验失败：`400 Bad Request`。

### 学习案例：解析 JSON Body

```ts
// src/body.ts 继续
import {
  InvalidJsonError,
  UnsupportedMediaTypeError,
} from './errors.js';

export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = ONE_MB,
): Promise<unknown> {
  assertJsonContentType(req.headers['content-type']);

  const raw = await readRawBody(req, maxBytes);
  if (!raw.trim()) {
    throw new InvalidJsonError('Request body must not be empty.');
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new InvalidJsonError('Request body must be valid JSON.', error);
  }
}

function assertJsonContentType(value: string | string[] | undefined): void {
  if (value === undefined) return;

  const contentType = Array.isArray(value) ? value[0] : value;
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new UnsupportedMediaTypeError('Only application/json is supported.');
  }
}
```

### 扩展理解

为什么 `content-type` 不存在时没有直接拒绝？这是一个教学取舍。严格 API 可以要求 `POST /tasks` 必须带 `Content-Type: application/json`，缺失返回 `415` 或 `400`。但 curl 初学阶段很容易忘记 Header，所以这里允许缺失，只拒绝明确错误的类型，例如 `text/plain`。

如果团队需要更严格规则，可以改成：

```ts
if (value === undefined) {
  throw new UnsupportedMediaTypeError('Content-Type must be application/json.');
}
```

## 4. 模块三：统一错误类型

### 知识点解释

Day 6 开始，HTTP 服务要面对更多失败路径。不要在每个分支随便返回字符串，建议建立稳定错误类型，再统一映射成 HTTP 响应。

本日错误类型：

| 错误 | HTTP 状态码 | 说明 |
|---|---:|---|
| `InvalidJsonError` | `400` | JSON 为空或语法非法 |
| `ValidationError` | `400` | 字段不符合业务规则 |
| `PayloadTooLargeError` | `413` | 请求体超过 1 MB |
| `UnsupportedMediaTypeError` | `415` | 请求体格式不支持 |
| 未知错误 | `500` | 服务端未预期错误 |

### 学习案例：错误定义

```ts
// src/errors.ts
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class InvalidJsonError extends HttpError {
  constructor(message = 'Invalid JSON body.', cause?: unknown) {
    super(400, 'INVALID_JSON', message, cause);
  }
}

export class ValidationError extends HttpError {
  constructor(code: string, message: string) {
    super(400, code, message);
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(maxBytes: number) {
    super(
      413,
      'PAYLOAD_TOO_LARGE',
      `Request body must not exceed ${maxBytes} bytes.`,
    );
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor(message = 'Unsupported media type.') {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  console.error(error);
  return new HttpError(500, 'INTERNAL_ERROR', 'Unexpected server error.', error);
}
```

### 扩展理解

这个设计的核心是：**内部保留 cause，对外返回稳定 code/message**。客户端不应该依赖你的堆栈、文件路径或具体异常类。客户端应该依赖稳定的错误码，例如 `TITLE_REQUIRED`。

## 5. 模块四：任务模型与内存存储

### 知识点解释

Day 6 只要求内存任务 API，不接数据库。内存存储的特点：

- 数据保存在进程内存中。
- 服务重启后数据丢失。
- 多进程或多副本之间数据不共享。
- 实现简单，适合学习 HTTP 和路由。

这不是生产方案，但非常适合第一周理解 API 行为。后续会迁移到 PostgreSQL 和 Prisma。

### 学习案例：任务类型与 Store

```ts
// src/task-store.ts
import { randomUUID } from 'node:crypto';
import { ValidationError } from './errors.js';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
}

export class TaskStore {
  private readonly tasks: Task[] = [];

  findAll(): Task[] {
    return [...this.tasks];
  }

  create(input: CreateTaskInput): Task {
    const title = input.title.trim();
    if (!title) {
      throw new ValidationError('TITLE_REQUIRED', 'Task title is required.');
    }

    const task: Task = {
      id: randomUUID(),
      title,
      status: 'TODO',
      createdAt: new Date().toISOString(),
    };

    this.tasks.push(task);
    return task;
  }

  clear(): void {
    this.tasks.length = 0;
  }
}
```

### 扩展理解

`findAll()` 返回 `[...this.tasks]`，而不是直接返回内部数组，是为了避免外部代码拿到数组引用后随意修改内部状态：

```ts
const tasks = store.findAll();
tasks.length = 0; // 不应该清空 store 内部数组
```

但这只是浅拷贝。如果 `Task` 对象本身可变，外部仍能修改对象字段。更严格可以返回深拷贝，或者把对象设计成只读。

## 6. 模块五：请求 DTO 校验

### 知识点解释

DTO 是 Data Transfer Object，用于描述接口输入输出。Day 6 的 `POST /tasks` 请求体可以定义为：

```json
{
  "title": "Learn HTTP"
}
```

但是 TypeScript 类型不会自动校验运行时输入。客户端传来的 JSON 是 `unknown`，必须手动收窄。

### 学习案例：把 unknown 解析成 CreateTaskInput

```ts
// src/task-store.ts 继续
export function parseCreateTaskInput(value: unknown): CreateTaskInput {
  if (!isRecord(value)) {
    throw new ValidationError('BODY_MUST_BE_OBJECT', 'Request body must be an object.');
  }

  if (typeof value.title !== 'string') {
    throw new ValidationError('TITLE_REQUIRED', 'Task title is required.');
  }

  return {
    title: value.title,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

### 扩展理解

为什么不用 `value as CreateTaskInput`？

```ts
const input = value as CreateTaskInput;
```

这是类型断言，只会让 TypeScript 编译器相信你，不会在运行时检查数据。如果客户端传 `{ "title": 123 }`，断言不会阻止错误。API 边界必须做运行时校验。

## 7. 模块六：响应工具函数

### 知识点解释

HTTP 响应应该保持一致结构。成功响应返回数据，错误响应返回稳定错误码。

建议错误格式：

```json
{
  "code": "TITLE_REQUIRED",
  "message": "Task title is required."
}
```

不要返回：

```json
{
  "stack": "...",
  "file": "C:\\app\\src\\server.ts"
}
```

### 学习案例：统一 JSON 响应

```ts
// src/response.ts
import type { ServerResponse } from 'node:http';
import { toHttpError } from './errors.js';

export interface JsonResponse {
  statusCode: number;
  body: unknown;
}

export function ok(body: unknown): JsonResponse {
  return { statusCode: 200, body };
}

export function created(body: unknown): JsonResponse {
  return { statusCode: 201, body };
}

export function jsonError(error: unknown): JsonResponse {
  const httpError = toHttpError(error);
  return {
    statusCode: httpError.statusCode,
    body: {
      code: httpError.code,
      message: httpError.message,
    },
  };
}

export function sendJson(res: ServerResponse, response: JsonResponse): void {
  res.writeHead(response.statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(`${JSON.stringify(response.body)}\n`);
}
```

### 扩展理解

统一响应函数的收益：

- 每个接口不用重复写 `content-type`。
- 成功和失败都稳定返回 JSON。
- 后续添加 `requestId`、耗时、日志更容易。
- 测试可以只关心 `statusCode` 和 `body`。

## 8. 模块七：实现 `GET /tasks` 和 `POST /tasks`

### 知识点解释

路由层要做三件事：

1. 根据 `method + pathname` 判断进入哪个接口。
2. 对需要 Body 的接口读取并解析 JSON。
3. 调用业务层或存储层，返回 HTTP 响应。

`GET /tasks`：

- 不需要请求 Body。
- 返回当前所有任务。
- 状态码 `200`。

`POST /tasks`：

- 读取 JSON Body。
- 校验 `title`。
- 空标题返回 `400`。
- 创建成功返回 `201`。

### 学习案例：异步路由函数

```ts
// src/router.ts
import type { IncomingMessage } from 'node:http';
import { readJsonBody } from './body.js';
import { HttpError } from './errors.js';
import { created, jsonError, ok, type JsonResponse } from './response.js';
import { parseCreateTaskInput, type TaskStore } from './task-store.js';

export interface RouterContext {
  store: TaskStore;
}

export async function routeRequest(
  req: IncomingMessage,
  pathname: string,
  context: RouterContext,
): Promise<JsonResponse> {
  try {
    if (req.method === 'GET' && pathname === '/health') {
      return ok({ status: 'ok' });
    }

    if (req.method === 'GET' && pathname === '/tasks') {
      return ok({ items: context.store.findAll() });
    }

    if (req.method === 'POST' && pathname === '/tasks') {
      const body = await readJsonBody(req);
      const input = parseCreateTaskInput(body);
      const task = context.store.create(input);
      return created(task);
    }

    return jsonError(new HttpError(404, 'NOT_FOUND', 'Route not found.'));
  } catch (error) {
    return jsonError(error);
  }
}
```

### 扩展理解

Day 5 的 `routeRequest(method, pathname)` 是同步纯函数。Day 6 因为 `POST /tasks` 需要异步读取 Body，所以路由函数变成 `async`。这很正常，但要尽量保持边界清晰：

- `server.ts` 负责把真实 HTTP 请求接进来。
- `router.ts` 负责路由和请求解析。
- `task-store.ts` 负责业务数据。
- `response.ts` 负责统一响应格式。

## 9. 模块八：HTTP Server 与优雅退出

### 知识点解释

`server.close()` 的作用是停止接受新连接，并等待已有连接处理完成后关闭。它不是强制杀进程。

为什么要监听信号？

- 本地按 Ctrl+C 会触发 `SIGINT`。
- Docker 停容器通常发送 `SIGTERM`。
- 部署平台滚动发布时也会先发终止信号。

如果不优雅退出，请求可能处理到一半就被中断。

### 学习案例：完整 `server.ts`

```ts
// src/server.ts
import { createServer } from 'node:http';
import { routeRequest } from './router.js';
import { sendJson } from './response.js';
import { TaskStore } from './task-store.js';

const port = parsePort(process.env.PORT ?? '3001');
const store = new TaskStore();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const response = await routeRequest(req, url.pathname, { store });
  sendJson(res, response);
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}. Closing server...`);

  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }

    console.log('Server closed.');
    process.exitCode = 0;
  });
}

function parsePort(input: string): number {
  const port = Number(input);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${input}`);
  }

  return port;
}
```

### 扩展理解

如果服务里还有数据库连接，`server.close()` 后还要关闭数据库连接。后续 NestJS 和 Prisma 阶段会遇到类似逻辑：

```ts
await prisma.$disconnect();
```

生产系统通常还会设置超时兜底，比如 10 秒后仍未关闭就强制退出。

## 10. 模块九：先写测试

### 知识点解释

Day 6 的测试至少覆盖：

- 初始 `GET /tasks` 返回空数组。
- `POST /tasks` 成功创建任务，返回 `201`。
- 创建后再次 `GET /tasks` 能看到任务。
- 空标题返回 `400 TITLE_REQUIRED`。
- 非法 JSON 返回 `400 INVALID_JSON`。
- 请求体超过 1 MB 返回 `413 PAYLOAD_TOO_LARGE`。

测试可以分两层：

1. 测 `TaskStore` 和 DTO 校验，不需要 HTTP。
2. 测真实 HTTP 请求，验证端到端行为。

注意：Day 6 应保留 Day 5 的 `GET /health`，所以路由测试也可以继续覆盖健康检查，避免新增任务接口时破坏已有端点。

### 学习案例：测试 Store 与 DTO

```ts
// src/task-store.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationError } from './errors.js';
import { parseCreateTaskInput, TaskStore } from './task-store.js';

test('TaskStore creates task with TODO status', () => {
  const store = new TaskStore();

  const task = store.create({ title: ' Learn HTTP ' });

  assert.equal(task.title, 'Learn HTTP');
  assert.equal(task.status, 'TODO');
  assert.equal(store.findAll().length, 1);
});

test('TaskStore rejects empty title', () => {
  const store = new TaskStore();

  assert.throws(
    () => store.create({ title: '   ' }),
    (error) => error instanceof ValidationError && error.code === 'TITLE_REQUIRED',
  );
});

test('parseCreateTaskInput rejects non-object body', () => {
  assert.throws(
    () => parseCreateTaskInput(null),
    (error) => error instanceof ValidationError && error.code === 'BODY_MUST_BE_OBJECT',
  );
});
```

### 学习案例：测试真实 HTTP API

```ts
// src/router.test.ts
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { routeRequest } from './router.js';
import { sendJson } from './response.js';
import { TaskStore } from './task-store.js';

test('GET /health returns ok', async () => {
  const app = await createTestServer();
  try {
    const response = await fetch(`${app.url}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok' });
  } finally {
    await app.close();
  }
});

test('GET /tasks returns empty items by default', async () => {
  const app = await createTestServer();
  try {
    const response = await fetch(`${app.url}/tasks`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { items: [] });
  } finally {
    await app.close();
  }
});

test('POST /tasks creates task and returns 201', async () => {
  const app = await createTestServer();
  try {
    const response = await fetch(`${app.url}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Learn native HTTP' }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.title, 'Learn native HTTP');
    assert.equal(body.status, 'TODO');
    assert.equal(typeof body.id, 'string');
  } finally {
    await app.close();
  }
});

test('POST /tasks rejects empty title', async () => {
  const app = await createTestServer();
  try {
    const response = await fetch(`${app.url}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      code: 'TITLE_REQUIRED',
      message: 'Task title is required.',
    });
  } finally {
    await app.close();
  }
});

test('POST /tasks rejects invalid JSON', async () => {
  const app = await createTestServer();
  try {
    const response = await fetch(`${app.url}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ bad json',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, 'INVALID_JSON');
  } finally {
    await app.close();
  }
});

async function createTestServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const store = new TaskStore();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const response = await routeRequest(req, url.pathname, { store });
    sendJson(res, response);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected TCP server address.');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
```

### 扩展理解

测试里使用 `server.listen(0)`，表示让操作系统随机分配可用端口，避免测试固定占用 `3001` 导致冲突。

测试里用 Node 18+ 内置的 `fetch()` 发真实 HTTP 请求。课程目标是 Node.js 24 LTS，因此可以直接使用。

## 11. 模块十：README curl 示例

### 知识点解释

README 是接口的最小交付物。别人不用读源码，也应该能知道怎么启动、怎么调用、成功和失败长什么样。

Day 6 的 README 至少包含：

- 启动命令。
- 健康检查。
- 查看任务列表。
- 创建任务。
- 空标题失败。
- 非法 JSON 失败。

### 学习案例：`examples/node-http/README.md`

````md
# Native Node HTTP Task API

## Start

```powershell
pnpm --filter node-http dev
```

Server listens on `http://localhost:3001` by default.

## Health

```powershell
curl.exe -i http://localhost:3001/health
```

## List tasks

```powershell
curl.exe -i http://localhost:3001/tasks
```

Expected:

```json
{
  "items": []
}
```

## Create task

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"Learn HTTP\"}"
```

Expected status: `201 Created`.

## Empty title

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"   \"}"
```

Expected status: `400 Bad Request`.

## Invalid JSON

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{bad json"
```

Expected status: `400 Bad Request`.
````

### 扩展理解

Windows PowerShell 中 curl 常常是别名，课程中明确使用 `curl.exe`，可以避免调用到 PowerShell 的 `Invoke-WebRequest`。

## 12. 推荐实现顺序

1. 写 `TaskStore` 和 `parseCreateTaskInput()`。
2. 写 `task-store.test.ts`，覆盖成功创建和空标题。
3. 写 `response.ts` 和 `errors.ts`。
4. 写 `body.ts`，处理 1 MB、非法 JSON 和 Content-Type。
5. 写 `router.ts`，实现 `GET /tasks` 和 `POST /tasks`。
6. 写真实 HTTP 测试，覆盖 `200`、`201`、`400`、`413`。
7. 写 `server.ts`，接入信号监听和 `server.close()`。
8. 写 README curl 示例。
9. 手工运行 curl 验证正常路径和失败路径。

## 13. 手工验收命令

启动：

```powershell
pnpm --filter node-http dev
```

健康检查：

```powershell
curl.exe -i http://localhost:3001/health
```

列表：

```powershell
curl.exe -i http://localhost:3001/tasks
```

创建：

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"Learn HTTP\"}"
```

空标题：

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"   \"}"
```

非法 JSON：

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{bad json"
```

运行测试：

```powershell
pnpm --filter node-http test
```

## 14. 经典面试题详解

### 题 1：为什么原生 Node.js 没有 `req.body`？

答题要点：

原生 Node.js 的 `IncomingMessage` 是可读流，请求体数据会随着网络传输分 chunk 到达。Node 不会默认把所有 Body 放进内存并解析，因为请求体可能很大，也可能不是 JSON。Express 或 NestJS 中的 `req.body` 是框架或中间件提前读取并解析后的结果。

扩展：

这也是为什么上传文件、JSON API、表单提交需要不同的解析逻辑。框架隐藏了复杂度，但底层仍是流。

### 题 2：为什么读取请求体必须设置大小上限？

答题要点：

如果没有大小上限，恶意客户端可以发送超大 Body，导致服务端内存持续增长，最终触发 OOM 或严重性能下降。JSON API 应设置合理上限，比如 1 MB。超过上限应尽早返回 `413 Payload Too Large`。

扩展：

除了应用层限制，反向代理如 Nginx、Caddy 也应设置请求体大小限制，形成多层保护。

### 题 3：非法 JSON 应该返回什么状态码？

答题要点：

通常返回 `400 Bad Request`。因为服务端收到的请求体语法不合法，属于客户端请求错误。响应体应包含稳定错误码，例如 `INVALID_JSON`，而不是把 `SyntaxError` 堆栈返回给客户端。

扩展：

如果 `Content-Type` 明确不是 JSON，例如 `text/plain`，更准确可以返回 `415 Unsupported Media Type`。

### 题 4：空标题为什么返回 `400`，而不是 `500`？

答题要点：

空标题是客户端提交的数据不满足业务规则，属于请求错误，所以返回 `400 Bad Request`。`500` 表示服务端出现未预期错误。把校验错误返回 `500` 会误导监控和调用方。

扩展：

如果标题重复并且业务要求唯一，通常可以返回 `409 Conflict`。Day 6 暂时没有唯一性要求。

### 题 5：创建成功为什么返回 `201`，而不是 `200`？

答题要点：

`201 Created` 表示请求已成功，并且服务端创建了新资源。`POST /tasks` 创建了新任务，所以比 `200 OK` 更准确。响应体通常返回新创建资源，也可以设置 `Location` Header 指向新资源 URL。

扩展：

例如：

```http
Location: /tasks/550e8400-e29b-41d4-a716-446655440000
```

Day 6 还没有 `GET /tasks/:id`，所以可以先不加 `Location`。

### 题 6：内存存储有什么问题？

答题要点：

内存存储的数据在进程重启后会丢失；多个 Node 进程之间不共享；无法支持持久化、查询、事务、并发一致性等生产需求。它适合教学和原型，不适合作为生产数据源。

扩展：

后续迁移到 PostgreSQL 后，任务数据会持久化，多个 API 实例可以共享数据库。

### 题 7：`unknown` 为什么适合表示 JSON 请求体？

答题要点：

客户端传来的 JSON 在运行时什么都可能是：对象、数组、字符串、数字、`null`。用 `unknown` 能迫使开发者先做类型检查，再访问字段。用 `any` 会绕过 TypeScript 检查，容易把错误延后到运行时。

扩展：

API 边界、外部系统输入、`JSON.parse()` 结果都适合先用 `unknown` 表示。

### 题 8：为什么不要用类型断言代替运行时校验？

答题要点：

类型断言只影响编译器，不会改变运行时数据。`value as CreateTaskInput` 不会检查 `title` 是否存在、是否字符串。接口输入来自外部，必须运行时校验。

扩展：

后续可以使用 `class-validator`、Zod、Valibot 等库做系统化校验。本阶段手写校验是为了理解原理。

### 题 9：`server.close()` 做了什么？

答题要点：

`server.close()` 会停止接收新连接，并在已有连接关闭后调用回调。它不是立刻杀进程。优雅退出时通常在 `SIGINT` 或 `SIGTERM` 中调用它，避免请求处理到一半被中断。

扩展：

如果已有连接长期不结束，服务可能迟迟无法退出。生产中通常会加超时兜底。

### 题 10：`SIGINT` 和 `SIGTERM` 有什么区别？

答题要点：

`SIGINT` 通常来自用户中断，例如 Ctrl+C。`SIGTERM` 通常来自进程管理器、Docker 或部署平台，表示请求进程终止。服务端程序应该监听两者，并执行同样的优雅关闭逻辑。

扩展：

Windows 对 POSIX 信号支持和 Linux 不完全相同，但 Node.js 在常见开发场景下仍可以监听这些事件。

### 题 11：为什么测试里使用 `server.listen(0)`？

答题要点：

`listen(0)` 会让操作系统自动分配一个可用端口，避免测试固定占用 `3001` 导致并发测试冲突或本地端口被占用。测试启动后可以通过 `server.address()` 获取实际端口。

扩展：

这是集成测试常用技巧。生产服务不能用随机端口，生产需要明确配置端口。

### 题 12：`400`、`404`、`409`、`413`、`415`、`500` 分别什么时候用？

答题要点：

- `400`：请求格式或字段校验失败，例如空标题、非法 JSON。
- `404`：路由或资源不存在。
- `409`：资源状态冲突，例如重复创建唯一资源。
- `413`：请求体过大。
- `415`：请求体媒体类型不支持。
- `500`：服务端未预期错误。

扩展：

状态码不是装饰，它会影响客户端重试策略、监控告警和错误归因。

### 题 13：为什么错误响应也要返回 JSON？

答题要点：

如果成功响应是 JSON，错误响应却是纯文本，客户端就需要写两套解析逻辑。统一 JSON 错误结构可以让前端、测试和日志更稳定，例如都读取 `code` 和 `message`。

扩展：

后续可以统一增加 `requestId`，便于从用户反馈定位服务端日志。

### 题 14：`POST /tasks` 是否幂等？

答题要点：

通常不幂等。同样的 `POST /tasks` 请求执行两次，会创建两个不同任务，服务端状态不同。`PUT /tasks/:id` 更常被设计为幂等，因为多次替换同一资源，最终状态一致。

扩展：

如果业务需要让创建请求幂等，可以引入 `Idempotency-Key`，这会在后续安全和幂等性阶段展开。

### 题 15：请求体超过 1 MB 时，应该继续读完还是直接失败？

答题要点：

应用层一旦发现超过上限，应停止正常解析并返回 `413`。教学代码中抛出 `PayloadTooLargeError` 即可。更底层的生产优化可以销毁请求流或让代理在进入 Node 前拒绝超大请求。

扩展：

即使应用层限制了 1 MB，也建议反向代理和负载均衡层设置同类限制，避免超大请求进入应用。

## 15. Day 6 自测清单

- [ ] 我能解释原生 Node 为什么没有 `req.body`。
- [ ] 我能用 `for await...of` 读取 `IncomingMessage`。
- [ ] 我能实现 1 MB 请求体上限。
- [ ] 我能把非法 JSON 映射为 `400 INVALID_JSON`。
- [ ] 我能把空标题映射为 `400 TITLE_REQUIRED`。
- [ ] 我能让 `POST /tasks` 成功返回 `201`。
- [ ] 我能解释内存存储为什么不适合生产。
- [ ] 我能写测试覆盖正常路径和失败路径。
- [ ] 我能监听 `SIGINT` 和 `SIGTERM` 并调用 `server.close()`。
- [ ] 我能用 README 中的 curl 示例完成手工验收。

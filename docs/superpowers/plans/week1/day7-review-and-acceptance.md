# Day 7：复盘与验收

> 基于 `2026-06-24-16-week-fullstack-curriculum.md` 中 Week 1 / Day 7 的要求展开：删除 `node_modules` 后执行 `pnpm install`，确认案例可重建；运行 `pnpm --filter node-http test` 和手工 curl 验证；回答“事件循环为什么不等于多线程？”、“`unknown` 为什么比 `any` 安全？”、“什么时候返回 400、404、409、500？”；周提交建议为 `feat: build native node task api`。

## 1. 今日目标

Day 7 不是继续堆功能，而是验证第一周的学习成果是否真正可交付。完成后，你应该能做到：

- 从干净依赖状态重新安装并运行项目。
- 用自动测试验证 `node-http` 行为。
- 用 curl 手工验证核心 API。
- 解释第一周核心概念：事件循环、类型安全、HTTP 状态码、原生 HTTP 边界。
- 写出 `docs/learning/week-01.md` 复盘。
- 准备一个小而明确的 Git 提交。

Day 7 的核心判断标准：**不是“我写过代码”，而是“别人能按命令重新跑起来，并且正常路径和失败路径都有证据”。**

## 2. 原始任务拆解

课程原始要求可以拆成五个模块：

| 模块 | 目标 | 验收证据 |
|---|---|---|
| 干净重建 | 删除依赖后重新安装 | `pnpm install` 成功，lockfile 可复现 |
| 自动测试 | 跑 `node-http` 测试 | `pnpm --filter node-http test` 通过 |
| 手工 curl | 验证真实 HTTP 请求 | `/health` 和 `POST /tasks` 返回预期 |
| 概念复盘 | 回答关键问题 | 写进 `docs/learning/week-01.md` |
| 提交收口 | 小提交 | `feat: build native node task api` |

## 3. 模块一：干净重建

### 知识点解释

干净重建是验证项目可复现性的最基本动作。它回答这些问题：

- 项目是否依赖本机残留状态？
- `package.json` 和 `pnpm-lock.yaml` 是否足够描述依赖？
- 新终端、新机器、CI 环境是否能重建？
- 是否有人忘记提交必要配置文件？

本周还是早期项目，干净重建不需要跑完整 CI，但至少要证明依赖能重新安装、测试能跑、服务能启动。

### PowerShell 验收命令

在仓库根目录执行：

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force examples/node-http/node_modules -ErrorAction SilentlyContinue
pnpm install
pnpm --filter node-http test
```

如果是 pnpm workspace，通常根目录 `node_modules` 和 lockfile 是主要依赖入口。是否存在 `examples/node-http/node_modules` 取决于 pnpm 的链接方式，命令里加 `-ErrorAction SilentlyContinue` 是为了目录不存在时不报错。

### 更保守的检查脚本

```powershell
# scripts/week01-clean-rebuild.ps1
$ErrorActionPreference = "Stop"

Write-Host "Removing workspace dependencies..."
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "examples/node-http/node_modules" -ErrorAction SilentlyContinue

Write-Host "Installing dependencies..."
pnpm install

Write-Host "Running node-http tests..."
pnpm --filter node-http test

Write-Host "Week 1 clean rebuild check completed."
```

### 扩展理解

不要把干净重建和“删除所有未跟踪文件”混为一谈。`git clean -xdf` 很危险，会删除所有未跟踪文件，包括你可能还没保存的学习笔记、`.env`、本地数据。Day 7 只需要验证依赖重建，优先精确删除 `node_modules`。

## 4. 模块二：自动测试验收

### 知识点解释

自动测试用于验证可重复的行为。Day 5 和 Day 6 已经有：

- `GET /health`
- `GET /tasks`
- `POST /tasks`
- 空标题失败
- 非法 JSON 失败
- 未知路由失败
- 请求体过大失败

Day 7 要做的是补齐测试边界，然后运行统一命令。

### 推荐最终测试清单

```text
GET /health
  -> 200 { status: "ok" }

GET /tasks
  -> 200 { items: [] }

POST /tasks with valid title
  -> 201 task

POST /tasks with empty title
  -> 400 TITLE_REQUIRED

POST /tasks with invalid JSON
  -> 400 INVALID_JSON

POST /tasks with body > 1 MB
  -> 413 PAYLOAD_TOO_LARGE

GET /missing
  -> 404 NOT_FOUND
```

### 示例测试代码

```ts
// src/api.test.ts
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { routeRequest } from './router.js';
import { sendJson } from './response.js';
import { TaskStore } from './task-store.js';

test('GET /health returns service health', async () => {
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

test('GET /tasks returns empty task list initially', async () => {
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

test('POST /tasks creates a task', async () => {
  const app = await createTestServer();
  try {
    const response = await fetch(`${app.url}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Learn HTTP' }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.title, 'Learn HTTP');
    assert.equal(body.status, 'TODO');
    assert.equal(typeof body.id, 'string');
    assert.equal(typeof body.createdAt, 'string');
  } finally {
    await app.close();
  }
});

test('created tasks are visible from GET /tasks', async () => {
  const app = await createTestServer();
  try {
    await fetch(`${app.url}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Learn HTTP' }),
    });

    const response = await fetch(`${app.url}/tasks`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].title, 'Learn HTTP');
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
    assert.equal(body.code, 'TITLE_REQUIRED');
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

test('unknown route returns JSON 404', async () => {
  const app = await createTestServer();
  try {
    const response = await fetch(`${app.url}/missing`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.code, 'NOT_FOUND');
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

测试不是为了覆盖每一行代码，而是保护关键行为。第一周最值得保护的是：

- 请求能进入服务。
- 路由能找到正确处理器。
- JSON 响应格式稳定。
- 成功和失败状态码正确。
- 输入校验不会漏掉明显错误。

## 5. 模块三：手工 curl 验证

### 知识点解释

自动测试证明代码路径，curl 验证真实进程和真实端口。二者不是互相替代关系。

自动测试可能绕过以下问题：

- 服务启动脚本写错。
- 端口配置不对。
- `server.listen()` 没有执行。
- PowerShell 下 curl 命令转义不正确。
- README 示例不能直接复制运行。

### 周验收命令

启动服务：

```powershell
pnpm --filter node-http dev
```

健康检查：

```powershell
curl.exe -i http://localhost:3001/health
```

期望重点：

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{"status":"ok"}
```

创建任务：

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"Learn HTTP\"}"
```

期望重点：

```http
HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{"id":"...","title":"Learn HTTP","status":"TODO","createdAt":"..."}
```

查看任务：

```powershell
curl.exe -i http://localhost:3001/tasks
```

期望重点：

```json
{
  "items": [
    {
      "title": "Learn HTTP",
      "status": "TODO"
    }
  ]
}
```

失败路径：

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"   \"}"
curl.exe -i http://localhost:3001/not-found
```

期望分别返回：

- `400` + `TITLE_REQUIRED`
- `404` + `NOT_FOUND`

### 扩展理解

`curl.exe -i` 的 `-i` 很重要。它会显示响应头，否则你只能看到 body，看不到状态码和 `Content-Type`。

PowerShell 中建议明确写 `curl.exe`，因为 `curl` 在某些环境中可能是 `Invoke-WebRequest` 的别名。

## 6. 模块四：可自动化的冒烟验收脚本

### 知识点解释

手工 curl 很适合学习和调试，但每次都手动敲容易漏步骤。Day 7 可以准备一个冒烟脚本，验证服务从启动到核心接口调用的完整路径。

冒烟测试和单元测试不同：

- 单元测试验证函数级行为。
- API 测试验证接口级行为。
- 冒烟测试验证应用能否作为一个进程跑起来。

### Node.js 冒烟脚本示例

```js
// scripts/smoke-node-http.mjs
import { spawn } from 'node:child_process';

const server = spawn('pnpm', ['--filter', 'node-http', 'dev'], {
  shell: process.platform === 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', (chunk) => {
  process.stdout.write(`[server] ${chunk}`);
});

server.stderr.on('data', (chunk) => {
  process.stderr.write(`[server] ${chunk}`);
});

try {
  await waitForHealth('http://localhost:3001/health');
  await assertJson('http://localhost:3001/health', { status: 200 });

  const createResponse = await fetch('http://localhost:3001/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Learn HTTP' }),
  });
  assertStatus(createResponse, 201);

  const listResponse = await fetch('http://localhost:3001/tasks');
  assertStatus(listResponse, 200);
  const listBody = await listResponse.json();
  if (!Array.isArray(listBody.items) || listBody.items.length < 1) {
    throw new Error('Expected at least one task after creation.');
  }

  const badResponse = await fetch('http://localhost:3001/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '   ' }),
  });
  assertStatus(badResponse, 400);

  console.log('Smoke check passed.');
} finally {
  server.kill('SIGTERM');
}

async function waitForHealth(url, timeoutMs = 10_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function assertJson(url, expected) {
  const response = await fetch(url);
  assertStatus(response, expected.status);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response from ${url}, got ${contentType}`);
  }
}

function assertStatus(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, got ${response.status}`);
  }
}
```

运行：

```powershell
node scripts/smoke-node-http.mjs
```

### 扩展理解

这个脚本不是 Day 7 强制要求，但它体现了工程思维：把“我手工验证过”变成“以后可以一条命令验证”。后续 CI/CD 阶段会大量使用这种思路。

## 7. 模块五：复盘文档

### 知识点解释

复盘不是写流水账，而是把学习结果转换成可检索的知识资产。Day 7 的复盘应该回答：

- 本周交付了什么。
- 哪些概念能独立解释。
- 哪些地方仍依赖复制。
- 遇到的错误、根因和修正方式。
- 下一周最大的风险。

### `docs/learning/week-01.md` 模板

````md
# Week 01 Review

## 本周交付

- 建立 Node.js / TypeScript / pnpm workspace 基础。
- 完成异步运行时练习。
- 完成原生 HTTP 服务。
- 实现内存任务 API：`GET /health`、`GET /tasks`、`POST /tasks`。
- 为正常路径和失败路径补充测试。

## 我能独立解释的概念

- 事件循环、调用栈、微任务、计时器的关系。
- `async/await` 与 Promise rejection 的错误处理。
- `unknown` 与 `any` 的区别。
- 原生 Node HTTP 的 `IncomingMessage` 和 `ServerResponse`。
- `Content-Type`、状态码和 JSON 错误响应。
- 为什么请求体需要大小上限。

## 我仍然依赖复制的部分

- `for await...of` 读取请求流的细节。
- `server.listen(0)` 测试动态端口写法。
- Windows PowerShell 下复杂 curl JSON 转义。

## 本周三个错误及根因

1. 错误：直接用 `req.url === "/health"` 判断路由。
   根因：忽略 query string。
   修正：使用 `new URL(req.url ?? "/", "http://localhost").pathname`。

2. 错误：失败响应没有设置 `Content-Type`。
   根因：只关注成功路径。
   修正：统一使用 `sendJson()`。

3. 错误：读取 JSON Body 时没有大小上限。
   根因：没有把外部输入视为风险。
   修正：实现 1 MB 限制，超过返回 `413`。

## 一条性能或安全证据

- 请求体读取设置 1 MB 上限，避免超大请求体无限占用内存。

## 下一周最大风险

- 进入 NestJS 后容易只会照着框架写，不理解 Middleware、Pipe、Controller、Service、Filter 分别替代了原生 HTTP 中哪一层职责。

## 验证命令与结果

```powershell
pnpm install
pnpm --filter node-http test
pnpm --filter node-http dev
curl.exe -i http://localhost:3001/health
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"Learn HTTP\"}"
```

记录结果：

- `pnpm install`：通过 / 未通过
- `pnpm --filter node-http test`：通过 / 未通过
- `GET /health`：返回 `200`
- `POST /tasks`：返回 `201`
````

### 扩展理解

复盘文档最有价值的部分通常不是“我完成了什么”，而是“我犯了什么错、为什么错、下次怎么避免”。这会直接提高第二周学习 NestJS 的质量。

## 8. 模块六：事件循环为什么不等于多线程

### 知识点解释

事件循环是 JavaScript 运行时调度异步回调的机制。它让 Node.js 能够在单个主线程上处理大量 I/O 回调，但这不等于 JavaScript 代码本身在多个线程并行执行。

关键点：

- JavaScript 主线程一次只能执行一段同步代码。
- 异步 I/O 可以交给操作系统或 libuv 线程池处理。
- I/O 完成后，回调被放回事件循环队列。
- 事件循环负责在调用栈清空后取出回调继续执行。

### 示例代码

```ts
console.log('A');

setTimeout(() => {
  console.log('B timeout');
}, 0);

Promise.resolve().then(() => {
  console.log('C promise');
});

console.log('D');
```

典型输出：

```text
A
D
C promise
B timeout
```

解释：

1. 同步代码先执行：`A`、`D`。
2. Promise 微任务优先于 timer 回调：`C promise`。
3. `setTimeout` 回调最后执行：`B timeout`。

### 扩展理解

Node.js 确实可能使用额外线程，例如：

- libuv 线程池处理部分文件系统、DNS、加密任务。
- Worker Threads 可以显式创建 JS 工作线程。

但这不改变核心事实：默认情况下，你写的大多数 JavaScript 业务代码仍在主线程上执行。CPU 密集任务会阻塞事件循环。

## 9. 模块七：`unknown` 为什么比 `any` 安全

### 知识点解释

`any` 会关闭类型检查，`unknown` 会迫使你先检查类型再使用。外部输入，例如 `JSON.parse()`、HTTP Body、第三方 API 响应，都应该优先用 `unknown`。

错误示例：

```ts
function createTaskFromBody(body: any) {
  return {
    title: body.title.trim(),
  };
}

createTaskFromBody({ title: 123 }); // 运行时崩溃
```

安全示例：

```ts
function createTaskFromBody(body: unknown) {
  if (!isRecord(body) || typeof body.title !== 'string') {
    throw new Error('TITLE_REQUIRED');
  }

  return {
    title: body.title.trim(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

### 扩展理解

`unknown` 不是麻烦，它是在提醒你：这个值来自边界之外，不可信。API 输入、文件内容、环境变量、用户参数都属于边界输入。

## 10. 模块八：什么时候返回 400、404、409、500

### 知识点解释

状态码要表达错误归属。第一周最重要的是不要把所有错误都返回 `500`。

| 状态码 | 含义 | 本周例子 |
|---:|---|---|
| `400` | 请求格式或字段错误 | 空标题、非法 JSON |
| `404` | 路由或资源不存在 | `/not-found` |
| `409` | 当前资源状态冲突 | 重复创建唯一资源，或状态冲突 |
| `500` | 服务端未预期错误 | 代码 bug、未捕获异常 |

### 示例映射代码

```ts
export function mapErrorToStatus(code: string): number {
  switch (code) {
    case 'INVALID_JSON':
    case 'TITLE_REQUIRED':
    case 'BODY_MUST_BE_OBJECT':
      return 400;

    case 'NOT_FOUND':
      return 404;

    case 'TASK_ALREADY_EXISTS':
    case 'TASK_STATUS_CONFLICT':
      return 409;

    default:
      return 500;
  }
}
```

### 扩展理解

`409 Conflict` 在 Day 6 未必用得上，因为内存任务 API 没有唯一标题、版本号或状态流转冲突。但你需要知道它适合什么场景：

- 注册邮箱已存在。
- 创建团队 slug 已存在。
- 删除最后一个管理员。
- 更新任务时版本号已过期。

## 11. 模块九：提交前检查

### 知识点解释

提交不是把所有东西一次性塞进去，而是把一个可解释的工作单元记录下来。第一周建议提交：

```text
feat: build native node task api
```

这个提交应该包含：

- workspace 基础配置。
- TypeScript 配置。
- async runtime 示例。
- node-http 服务。
- 测试。
- README 或学习笔记。

### 提交前命令

```powershell
git status --short
pnpm --filter node-http test
```

查看具体差异：

```powershell
git diff -- examples/node-http
git diff -- docs/learning/week-01.md
```

提交：

```powershell
git add package.json pnpm-lock.yaml pnpm-workspace.yaml examples docs
git commit -m "feat: build native node task api"
```

### 扩展理解

提交信息里的 `feat` 表示新增功能。这里的功能不是“生产级任务系统”，而是“原生 Node 任务 API 基础”。提交信息要准确描述真实范围。

## 12. Day 7 最终验收清单

- [ ] 删除 `node_modules` 后可以重新 `pnpm install`。
- [ ] `pnpm --filter node-http test` 通过。
- [ ] `pnpm --filter node-http dev` 能启动服务。
- [ ] `curl.exe -i http://localhost:3001/health` 返回 `200`。
- [ ] `POST /tasks` 正常标题返回 `201`。
- [ ] 空标题返回 `400 TITLE_REQUIRED`。
- [ ] 未知路由返回 `404 NOT_FOUND`。
- [ ] 我能解释事件循环为什么不等于多线程。
- [ ] 我能解释 `unknown` 为什么比 `any` 安全。
- [ ] 我能解释 400、404、409、500 的使用场景。
- [ ] `docs/learning/week-01.md` 有本周复盘。
- [ ] 准备小提交：`feat: build native node task api`。

## 13. 经典面试题详解

### 题 1：事件循环为什么不等于多线程？

答题要点：

事件循环是异步任务调度机制，不是让 JavaScript 同时在多个线程执行。Node.js 主线程一次只能执行一个 JavaScript 调用栈。异步 I/O 完成后，回调进入队列，等待调用栈清空后被事件循环取出执行。Node 底层可能使用操作系统异步能力或 libuv 线程池，但这不等于你的业务 JS 默认多线程并行。

扩展：

CPU 密集任务会阻塞事件循环。要处理 CPU 密集任务，可以使用 Worker Threads、子进程或把任务交给专门服务。

### 题 2：微任务和宏任务有什么区别？

答题要点：

微任务通常包括 Promise reaction、`queueMicrotask()` 等；宏任务包括 timer、I/O 回调等。一次同步调用栈执行完后，运行时会优先清空微任务队列，再进入下一轮事件循环处理 timer 或 I/O 回调。

扩展：

如果不断递归创建微任务，可能导致 timer 长时间得不到执行。

### 题 3：`unknown` 和 `any` 的区别是什么？

答题要点：

`any` 会跳过类型检查，你可以对它做任何操作；`unknown` 表示类型未知，使用前必须先收窄类型。外部输入适合用 `unknown`，因为它强制你做运行时校验。

扩展：

`unknown` 是类型安全的边界类型，`any` 是类型系统的逃生门。项目里应尽量缩小 `any` 的范围。

### 题 4：为什么 `JSON.parse()` 的结果不应该直接断言为 DTO？

答题要点：

`JSON.parse()` 返回运行时数据，它可能是任何合法 JSON 值。`as CreateTaskDto` 只会让 TypeScript 编译器相信你，不会在运行时校验字段。正确做法是先用 `unknown` 接住，再检查是否对象、字段是否存在、类型是否正确。

扩展：

后续可以使用 Zod、class-validator 或手写 type guard 做校验。

### 题 5：什么时候返回 `400 Bad Request`？

答题要点：

当客户端请求格式错误或字段校验失败时返回 `400`。例如非法 JSON、空标题、字段类型错误、缺少必填字段。它表示客户端修改请求后可以重试。

扩展：

不要把业务校验错误返回 `500`，否则监控会误判服务端故障。

### 题 6：什么时候返回 `404 Not Found`？

答题要点：

路由不存在或资源不存在时返回 `404`。例如 `GET /missing`，或者未来 `GET /tasks/:id` 查询不到任务。为了安全，有些系统也会对无权限资源返回 `404`，避免暴露资源是否存在。

扩展：

`404` 不等于数据库错误，它是正常可预期的客户端请求结果。

### 题 7：什么时候返回 `409 Conflict`？

答题要点：

当请求本身格式正确，但与当前资源状态冲突时返回 `409`。例如邮箱已存在、slug 已存在、版本号冲突、试图删除最后一个管理员、任务状态不允许从 DONE 回到 TODO。

扩展：

`409` 比 `400` 更能表达“请求语法没错，但当前状态不允许”。

### 题 8：什么时候返回 `500 Internal Server Error`？

答题要点：

服务端出现未预期错误时返回 `500`，例如代码 bug、未捕获异常、依赖服务异常但未能映射为更具体错误。对外响应应该是通用消息，对内日志记录 stack 和 cause。

扩展：

不要把内部堆栈、文件路径、数据库连接信息返回给客户端。

### 题 9：自动测试和手工 curl 验证有什么区别？

答题要点：

自动测试可重复、速度快，适合验证函数和接口行为。curl 验证真实启动命令、端口、HTTP 响应头和 README 示例是否可用。两者覆盖的风险不同，Day 7 都需要。

扩展：

后续 CI 会偏向自动化，但关键发布前仍常保留少量手工或冒烟验证。

### 题 10：为什么要做干净重建？

答题要点：

干净重建验证项目是否可复现。它能暴露未声明依赖、缺失配置、lockfile 不一致、本地残留状态等问题。一个只能在作者机器上运行的项目不可交付。

扩展：

CI 本质上就是一种持续的干净环境验证。

### 题 11：pnpm lockfile 的价值是什么？

答题要点：

`pnpm-lock.yaml` 锁定依赖解析结果，保证不同机器安装到一致的依赖版本。没有 lockfile，间接依赖可能发生变化，导致“昨天能跑，今天不能跑”。

扩展：

应用项目通常提交 lockfile；库项目是否提交取决于仓库策略，但 workspace 应用开发一般应提交。

### 题 12：为什么测试里常用 `listen(0)`？

答题要点：

`listen(0)` 让操作系统分配随机可用端口，避免测试固定端口导致冲突。测试拿到 `server.address().port` 后再发请求。

扩展：

本地开发服务使用固定端口便于访问；自动测试使用随机端口更稳。

### 题 13：为什么错误响应也应该是 JSON？

答题要点：

如果成功响应是 JSON，错误响应也使用 JSON，客户端就能统一解析 `code` 和 `message`。否则前端需要区分文本错误和 JSON 错误，逻辑复杂且容易漏处理。

扩展：

统一错误结构是后续 NestJS Exception Filter 的基础。

### 题 14：为什么要记录失败路径？

答题要点：

只验证成功路径无法证明 API 稳定。真实系统大量问题来自无效输入、未知路由、异常状态。失败路径测试能保证服务以可预期方式失败，而不是崩溃、超时或泄漏内部信息。

扩展：

好的错误处理不是“永不出错”，而是“出错时可诊断、可恢复、可沟通”。

### 题 15：如何判断第一周任务已经可以提交？

答题要点：

至少满足：依赖可重建、测试通过、服务可启动、核心 curl 成功、失败路径有验证、复盘文档完整、提交范围清晰。提交前看 `git diff`，确认没有无关文件或本地敏感配置。

扩展：

小而明确的提交比“大杂烩提交”更容易 review、回滚和理解。

## 14. 建议学习顺序

1. 先运行 `pnpm --filter node-http test`，确认当前状态。
2. 补齐缺失测试，尤其是失败路径。
3. 执行干净重建。
4. 启动服务并完成 curl 验收。
5. 写 `docs/learning/week-01.md`。
6. 用自己的话回答 Day 7 三组概念题。
7. 检查 `git diff`，准备提交。

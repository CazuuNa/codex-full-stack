# Day 5：原生 HTTP 服务

> 基于 `2026-06-24-16-week-fullstack-curriculum.md` 中 Week 1 / Day 5 的要求展开：学习请求方法、URL、Header、Body、状态码、Content-Type；创建 `examples/node-http/src/server.ts`，实现 `GET /health`；创建纯函数 `routeRequest(method, pathname)`，先写路由测试再实现；为未知路由返回 `404 application/json`；使用 `curl.exe -i http://localhost:3001/health` 验证。

## 1. 今日目标

Day 5 的核心不是“写一个完整 Web 框架”，而是看清 HTTP 服务最底层的组成：

- Node.js 如何用 `node:http` 创建服务。
- HTTP 请求由方法、URL、Header、Body 组成。
- HTTP 响应用状态码、Header、Body 表达结果。
- `Content-Type` 为什么决定客户端如何理解响应体。
- 为什么路由逻辑应该先写成纯函数，再接入真实网络服务。
- 如何用 `curl.exe -i` 验证状态行、响应头和响应体。

建议目录：

```text
examples/node-http/
  package.json
  tsconfig.json
  src/
    response.ts
    router.ts
    server.ts
    server.test.ts
```

## 2. 核心模块一：HTTP 请求方法

### 知识点解释

HTTP 方法描述“客户端想对资源做什么”。常见方法：

| 方法 | 典型含义 | 是否安全 | 是否幂等 |
|---|---|---:|---:|
| `GET` | 获取资源 | 是 | 是 |
| `POST` | 创建资源或提交命令 | 否 | 否 |
| `PUT` | 整体替换资源 | 否 | 是 |
| `PATCH` | 部分修改资源 | 否 | 通常不保证 |
| `DELETE` | 删除资源 | 否 | 是 |
| `HEAD` | 只获取响应头，不要响应体 | 是 | 是 |
| `OPTIONS` | 查询服务支持的通信选项 | 是 | 是 |

“安全”指不应该改变服务端状态，不代表没有认证要求。“幂等”指同一个请求执行一次和执行多次，服务端最终状态应该一致。

### 学习案例：定义支持的方法类型

```ts
// src/router.ts
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export function normalizeMethod(method: string | undefined): HttpMethod | undefined {
  if (
    method === 'GET' ||
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE' ||
    method === 'HEAD' ||
    method === 'OPTIONS'
  ) {
    return method;
  }

  return undefined;
}
```

### 扩展理解

Node.js 的 `req.method` 类型是 `string | undefined`，不会自动帮你收窄成 `'GET' | 'POST'`。在 TypeScript 严格模式下，应先规范化，再进入路由逻辑。

面试中经常会追问：`GET` 能不能有 Body？HTTP 规范并没有把它定义成常规语义，很多服务、代理、缓存不会可靠处理 `GET` Body。实际业务里不要依赖 `GET` Body，查询条件放 query string。

## 3. 核心模块二：URL 与路径

### 知识点解释

HTTP URL 包含多部分：

```text
http://localhost:3001/tasks?status=TODO&page=1
|---- protocol ----|host|port|path|------ query ------|
```

Node 原生 `req.url` 通常只包含 path 和 query，例如：

```text
/tasks?status=TODO&page=1
```

它不是完整 URL，因此解析时要提供一个 base：

```ts
const url = new URL(req.url ?? '/', 'http://localhost');
```

常用字段：

- `url.pathname`：路径，例如 `/tasks`。
- `url.searchParams`：查询参数，例如 `status=TODO`。
- `url.search`：完整 query string，例如 `?status=TODO&page=1`。

### 学习案例：安全解析请求 URL

```ts
// src/server.ts 片段
function parseRequestUrl(input: string | undefined): URL {
  return new URL(input ?? '/', 'http://localhost');
}

const url = parseRequestUrl('/health?verbose=true');
console.log(url.pathname); // /health
console.log(url.searchParams.get('verbose')); // true
```

### 扩展理解

路由判断通常应该用 `pathname`，不要直接用 `req.url`。如果你写：

```ts
req.url === '/health'
```

那么 `/health?verbose=true` 会匹配失败。更稳妥的方式：

```ts
const url = new URL(req.url ?? '/', 'http://localhost');
url.pathname === '/health'
```

## 4. 核心模块三：Header

### 知识点解释

Header 是 HTTP 元数据。请求 Header 告诉服务端客户端的能力和请求描述；响应 Header 告诉客户端如何解释响应。

常见请求 Header：

- `accept`：客户端希望接收什么类型的响应。
- `content-type`：请求体是什么格式。
- `content-length`：请求体字节长度。
- `authorization`：认证信息。
- `user-agent`：客户端信息。

常见响应 Header：

- `content-type`：响应体格式。
- `content-length`：响应体字节长度。
- `cache-control`：缓存策略。
- `location`：重定向或创建资源位置。

Node.js 中 `req.headers` 的 key 通常是小写：

```ts
const contentType = req.headers['content-type'];
```

### 学习案例：统一 JSON 响应头

```ts
// src/response.ts
export const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
} as const;
```

### 扩展理解

HTTP Header 名称大小写不敏感，但 Node.js 为了统一访问，通常会把请求头 key 变成小写。你应该用 `content-type`，不要写 `Content-Type` 去访问 `req.headers`。

响应时可以写 `Content-Type`，也可以写 `content-type`；为了统一，课程里建议全部用小写。

## 5. 核心模块四：Body

### 知识点解释

Body 是请求或响应的主体内容。Day 5 只需要理解 Body；Day 6 才会完整实现请求体读取函数。

重要区别：

- `GET /health` 一般没有请求 Body。
- `POST /tasks` 通常有 JSON 请求 Body。
- Node 原生请求对象 `IncomingMessage` 是可读流，请求 Body 不是一次性字符串。
- 响应体由 `res.end()` 或 `res.write()` 写出。

### 学习案例：响应 JSON Body

```ts
// src/response.ts
export interface JsonResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export function jsonResponse(statusCode: number, body: unknown): JsonResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body,
  };
}

export function serializeJsonBody(body: unknown): string {
  return `${JSON.stringify(body)}\n`;
}
```

### 扩展理解

`JSON.stringify()` 返回字符串，但 HTTP 传输的是字节。加上 `charset=utf-8` 能明确告诉客户端按 UTF-8 解码。中文、表情符号等非 ASCII 内容尤其依赖正确编码。

Day 6 读取请求 Body 时还要处理：

- 请求体大小限制，例如 1 MB。
- 非法 JSON。
- 请求中途断开。
- `content-type` 不匹配。

## 6. 核心模块五：状态码

### 知识点解释

状态码是服务端对请求结果的标准化表达。

常见分类：

- `2xx`：成功。
- `3xx`：重定向。
- `4xx`：客户端请求有问题。
- `5xx`：服务端处理失败。

Day 5 必须掌握：

| 状态码 | 场景 |
|---:|---|
| `200 OK` | 请求成功，例如 `GET /health` |
| `404 Not Found` | 路由不存在 |
| `405 Method Not Allowed` | 路径存在，但方法不支持，作为扩展掌握 |
| `500 Internal Server Error` | 未预期服务端错误 |

### 学习案例：路由返回状态码

```ts
// src/router.ts
import { jsonResponse, type JsonResponse } from './response.js';

export function routeRequest(method: string | undefined, pathname: string): JsonResponse {
  if (method === 'GET' && pathname === '/health') {
    return jsonResponse(200, { status: 'ok' });
  }

  return jsonResponse(404, { code: 'NOT_FOUND', message: 'Route not found.' });
}
```

### 扩展理解

`404` 和 `405` 的区别：

- `/unknown` 不存在，返回 `404`。
- `/health` 存在，但你用 `POST /health`，更严谨可以返回 `405`。

课程 Day 5 原要求只强制未知路由返回 `404 application/json`。你可以先实现最小版，等路由数量增加后再引入 `405`。

## 7. 核心模块六：Content-Type

### 知识点解释

`Content-Type` 告诉对方 Body 的格式。没有正确的 `Content-Type`，客户端可能无法正确解析响应。

常见值：

- `application/json; charset=utf-8`  // JSON 格式
- `text/plain; charset=utf-8`  // 文本格式
- `text/html; charset=utf-8`  // HTML 格式
- `application/octet-stream`  // 二进制数据
- `multipart/form-data`  // 表单数据（包含文件）

Day 5 的目标是：成功和失败都返回 JSON，并且响应头都设置：

```http
content-type: application/json; charset=utf-8
```

### 学习案例：发送 JSON 响应

```ts
// src/server.ts 片段
import type { ServerResponse } from 'node:http';
import { serializeJsonBody, type JsonResponse } from './response.js';

function sendJson(res: ServerResponse, response: JsonResponse): void {
  res.writeHead(response.statusCode, response.headers);
  res.end(serializeJsonBody(response.body));
}
```

### 扩展理解

不要只在成功时返回 JSON，错误也应该返回 JSON。否则前端调用时会出现：成功响应可以 `await response.json()`，失败响应却只能读文本，客户端逻辑会变得混乱。

## 8. 完整案例一：`GET /health`

### 最小可运行版本

```ts
// src/server.ts
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

server.listen(3001, () => {
  console.log('Server listening on http://localhost:3001');
});
```

验证：

```powershell
pnpm --filter node-http dev
curl.exe -i http://localhost:3001/health
```

期望响应：

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{"status":"ok"}
```

未知路由：

```powershell
curl.exe -i http://localhost:3001/unknown
```

期望响应：

```http
HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{"code":"NOT_FOUND"}
```

### 扩展理解

这个最小版本故意把路由判断写在 `createServer()` 回调里，便于理解。但是继续写下去会很快变乱，所以课程要求下一步抽出纯函数 `routeRequest(method, pathname)`。

## 9. 完整案例二：抽出纯函数路由

### `response.ts`

```ts
// src/response.ts
export interface JsonResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export function jsonResponse(statusCode: number, body: unknown): JsonResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body,
  };
}

export function serializeJsonBody(body: unknown): string {
  return `${JSON.stringify(body)}\n`;
}
```

### `router.ts`

```ts
// src/router.ts
import { jsonResponse, type JsonResponse } from './response.js';

export function routeRequest(method: string | undefined, pathname: string): JsonResponse {
  if (method === 'GET' && pathname === '/health') {
    return jsonResponse(200, {
      status: 'ok',
      service: 'node-http',
    });
  }

  return jsonResponse(404, {
    code: 'NOT_FOUND',
    message: 'Route not found.',
  });
}
```

### `server.ts`

```ts
// src/server.ts
import { createServer, type ServerResponse } from 'node:http';
import { routeRequest } from './router.js';
import { serializeJsonBody, type JsonResponse } from './response.js';

const port = parsePort(process.env.PORT ?? '3001');

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const response = routeRequest(req.method, url.pathname);
    sendJson(res, response);
  } catch (error) {
    console.error(error);
    sendJson(res, {
      statusCode: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error.',
      },
    });
  }
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

function sendJson(res: ServerResponse, response: JsonResponse): void {
  res.writeHead(response.statusCode, response.headers);
  res.end(serializeJsonBody(response.body));
}

function parsePort(input: string): number {
  const port = Number(input);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${input}`);
  }

  return port;
}
```

### 为什么这样拆

`routeRequest()` 是纯函数：输入 `method` 和 `pathname`，输出响应对象。它不依赖网络、不读文件、不改全局状态，因此可以直接单元测试。

`server.ts` 只负责 HTTP 适配：

- 从 `req` 里拿 `method` 和 `url`。
- 把 URL 解析成 `pathname`。
- 调用路由函数。
- 把路由结果写入 `res`。

这就是后续 NestJS Controller 的底层思想：协议层做协议转换，业务或路由逻辑尽量可测试。

## 10. 完整案例三：先写路由测试

Day 5 可以先使用 Node.js 内置测试模块 `node:test`，不必马上引入 Jest。

### `server.test.ts`

```ts
// src/server.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { routeRequest } from './router.js';

test('GET /health returns 200 JSON response', () => {
  const response = routeRequest('GET', '/health');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(response.body, {
    status: 'ok',
    service: 'node-http',
  });
});

test('unknown route returns 404 JSON response', () => {
  const response = routeRequest('GET', '/missing');

  assert.equal(response.statusCode, 404);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(response.body, {
    code: 'NOT_FOUND',
    message: 'Route not found.',
  });
});

test('query string should not affect pathname routing', () => {
  const url = new URL('/health?verbose=true', 'http://localhost');
  const response = routeRequest('GET', url.pathname);

  assert.equal(response.statusCode, 200);
});
```

### `package.json` 示例

```json
{
  "name": "node-http",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/server.ts",
    "test": "tsx --test src/**/*.test.ts",
    "typecheck": "tsc --noEmit" // 检查类型，不生成输出
  },
  "devDependencies": {
    "tsx": "^4.20.0",
    "typescript": "^5.8.0"
  }
}
```

### 扩展理解

先测 `routeRequest()`，不是先测真实 HTTP 请求，是为了把问题分层：

- 如果路由测试失败，说明纯逻辑错了。
- 如果路由测试通过但 curl 失败，说明 HTTP 适配层、端口、启动命令或网络调用有问题。

这种分层能显著降低排错成本。

## 11. 完整案例四：curl 验证

### 启动服务

```powershell
pnpm --filter node-http dev
```

### 验证健康检查

```powershell
curl.exe -i http://localhost:3001/health
```

重点看三部分：

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{"status":"ok","service":"node-http"}
```

### 验证未知路由

```powershell
curl.exe -i http://localhost:3001/not-found
```

期望：

```http
HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{"code":"NOT_FOUND","message":"Route not found."}
```

### 扩展：验证 query string

```powershell
curl.exe -i "http://localhost:3001/health?verbose=true"
```

如果你用 `url.pathname` 路由，应该仍然返回 `200`。如果你直接判断 `req.url === '/health'`，这个请求会错误地返回 `404`。

## 12. Day 5 常见错误

### 错误 1：直接用 `req.url` 判断路由

```ts
if (req.url === '/health') {
  // /health?verbose=true 会失败
}
```

更稳妥：

```ts
const url = new URL(req.url ?? '/', 'http://localhost');
if (url.pathname === '/health') {
  // query string 不影响路由
}
```

### 错误 2：404 返回纯文本

```ts
res.writeHead(404);
res.end('not found');
```

更稳妥：

```ts
res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
res.end(JSON.stringify({ code: 'NOT_FOUND', message: 'Route not found.' }));
```

### 错误 3：忘记 `return`

```ts
if (req.method === 'GET' && req.url === '/health') {
  res.end(JSON.stringify({ status: 'ok' }));
}

res.end(JSON.stringify({ code: 'NOT_FOUND' }));
```

这可能导致 `Cannot write headers after they are sent to the client`。写完响应后要 `return`，或者使用清晰的 `if/else`。

### 错误 4：异常时直接泄漏堆栈

```ts
res.end(JSON.stringify({ error: String(error), stack: error.stack }));
```

更稳妥：

```ts
console.error(error);
res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
res.end(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Unexpected server error.' }));
```

## 13. 经典面试题详解

### 题 1：Node.js 原生 HTTP 服务的基本流程是什么？

答题要点：

使用 `createServer()` 创建服务，传入请求回调。每次客户端请求进来，Node 会给回调传入 `IncomingMessage` 和 `ServerResponse`。前者代表请求，包含 `method`、`url`、`headers` 和请求体流；后者代表响应，可以设置状态码、响应头并写出响应体。最后调用 `server.listen(port)` 监听端口。

扩展：

框架如 Express、NestJS 底层仍然建立在 HTTP server 或平台适配器上。学习原生 HTTP 是为了理解框架帮你隐藏了什么。

### 题 2：为什么不建议直接用 `req.url === '/health'` 做路由？

答题要点：

`req.url` 可能包含 query string，例如 `/health?verbose=true`。直接字符串比较会导致路径正确但带查询参数的请求匹配失败。应该用 `new URL(req.url ?? '/', 'http://localhost')` 解析，然后用 `url.pathname` 路由。

扩展：

真实服务还要考虑路径尾斜杠、URL 编码、大小写策略等。早期保持规则简单更重要。

### 题 3：HTTP Header 名称是否区分大小写？Node 中如何读取？

答题要点：

HTTP Header 名称大小写不敏感。Node.js 通常把请求头 key 规范化成小写，因此读取时使用 `req.headers['content-type']`。响应头设置时大小写都可以，但项目内应保持统一。

扩展：

Header 值可能是 `string | string[] | undefined`，不要假设一定是字符串。

### 题 4：`Content-Type` 和 `Accept` 有什么区别？

答题要点：

`Content-Type` 描述当前请求体或响应体的格式。`Accept` 描述客户端希望服务端返回什么格式。比如客户端发送 JSON 时会带 `Content-Type: application/json`；希望收到 JSON 时会带 `Accept: application/json`。

扩展：

Day 5 可以固定返回 JSON。复杂 API 可根据 `Accept` 做内容协商，但多数业务 API 会统一 JSON。

### 题 5：`404`、`405`、`500` 分别应该什么时候返回？

答题要点：

`404` 表示资源或路由不存在；`405` 表示路径存在但 HTTP 方法不支持；`500` 表示服务端出现未预期错误。比如 `GET /missing` 是 `404`，`POST /health` 可以是 `405`，代码抛出未处理异常时是 `500`。

扩展：

不要把所有错误都返回 `500`。客户端错误用 `4xx`，服务端错误用 `5xx`，这样监控和调用方都能正确判断问题归属。

### 题 6：为什么路由函数设计成纯函数更容易测试？

答题要点：

纯函数只依赖输入，不依赖网络、文件、数据库或全局状态。测试 `routeRequest('GET', '/health')` 不需要启动端口，也不受网络环境影响。这样可以快速验证路由规则，并把 HTTP 适配层和业务逻辑分开。

扩展：

后续 Controller、Service 分层也是这个思想：协议转换和业务规则分离。

### 题 7：Node 原生请求 Body 为什么不能直接从 `req.body` 读取？

答题要点：

Node 原生 `IncomingMessage` 是可读流，没有内置 `req.body`。请求体数据会以 chunk 形式到达，需要监听流事件或用异步迭代读取。Express/NestJS 中的 `req.body` 是中间件或框架提前读取并解析后的结果。

扩展：

读取 Body 时必须设置大小上限，否则恶意客户端可以发送超大请求体耗尽内存。这个内容会在 Day 6 重点实现。

### 题 8：为什么写完响应后要 `return`？

答题要点：

`res.end()` 表示响应结束，但不会自动阻止后续 JavaScript 代码继续执行。如果后续代码再次写响应，就会出现重复写头或重复结束响应的问题。常见错误是 `Cannot write headers after they are sent to the client`。

扩展：

可以通过 `return`、`if/else`、统一 `sendJson()` 出口等方式避免重复响应。

### 题 9：`res.writeHead()` 和 `res.end()` 分别做什么？

答题要点：

`res.writeHead(statusCode, headers)` 设置响应状态码和响应头。`res.end(body)` 写出最后一段响应体并结束响应。简单响应可以只用 `res.end()`，但实际 API 应明确设置状态码和 `Content-Type`。

扩展：

如果先调用了 `res.write()` 或 `res.end()`，响应头可能已经隐式发送，此后再改 Header 就可能失败。

### 题 10：`curl.exe -i` 中 `-i` 的作用是什么？

答题要点：

`-i` 会把响应头也输出出来。没有 `-i` 时通常只看到响应体，看不到状态码和 Header。Day 5 要验证 `200/404` 和 `content-type`，所以必须用 `-i`。

扩展：

调试 POST 请求时常用：

```powershell
curl.exe -i -X POST http://localhost:3001/tasks -H "Content-Type: application/json" -d "{\"title\":\"Learn HTTP\"}"
```

这个会在 Day 6 用到。

### 题 11：HTTP 是无状态的是什么意思？

答题要点：

无状态指协议本身不会记住上一次请求。每个请求都应该包含服务端处理它所需的信息，例如 Cookie、Authorization Header、请求参数等。服务端可以通过数据库、Session、缓存保存状态，但这不是 HTTP 协议自动提供的。

扩展：

无状态协议让服务更容易横向扩展，但登录态、权限、幂等性需要应用层显式设计。

### 题 12：原生 HTTP 服务和 Express/NestJS 的区别是什么？

答题要点：

原生 HTTP 只提供最底层的请求和响应对象。Express 提供路由、中间件、请求体解析等便利能力。NestJS 在此基础上提供模块、依赖注入、Controller、Pipe、Guard、Filter 等工程化结构。原生 HTTP 更接近底层，适合学习协议；大型项目通常使用框架提升可维护性。

扩展：

理解原生 HTTP 后，更容易理解框架里的 Middleware、Interceptor、Exception Filter 本质上是在请求进入和响应返回过程中插入处理逻辑。

## 14. Day 5 自测清单

- [ ] 我能解释 `GET`、`POST`、`PUT`、`PATCH`、`DELETE` 的语义差异。
- [ ] 我能解释安全方法和幂等方法的区别。
- [ ] 我能用 `new URL(req.url ?? '/', 'http://localhost')` 解析路径。
- [ ] 我知道 Header 名称大小写不敏感，但 Node 读取时通常用小写 key。
- [ ] 我知道原生 Node 没有 `req.body`，请求体是流。
- [ ] 我能返回 `200 application/json` 的 `GET /health`。
- [ ] 我能为未知路由返回 `404 application/json`。
- [ ] 我能把路由逻辑写成可测试的纯函数。
- [ ] 我能用 `curl.exe -i` 验证状态码、Header 和 Body。
- [ ] 我能解释为什么不要在错误响应中泄漏堆栈。


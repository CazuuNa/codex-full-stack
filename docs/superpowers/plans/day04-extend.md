# Day 4：Node.js 核心模块与错误处理

> 基于 `2026-06-24-16-week-fullstack-curriculum.md` 中 Week 1 / Day 4 的要求展开：学习 `node:fs/promises`、`node:path`、`node:url`、进程信号和环境变量；创建 `examples/async-runtime/src/file-store.ts` 读写 JSON 任务文件；区分编程错误、业务错误和外部系统错误；为文件不存在和 JSON 损坏编写失败案例；验证程序失败时返回非零退出码且不吞掉错误。

## 1. 今日目标

完成 Day 4 后，你应该能独立回答并实现这些事情：

- 用 Node.js 内置模块读写本地 JSON 文件，不依赖第三方库。
- 正确处理跨平台路径，避免用字符串拼接路径。
- 区分文件路径、URL、运行目录和模块目录。
- 从环境变量读取配置，并在启动阶段做校验。
- 捕获 `SIGINT` / `SIGTERM`，让程序优雅退出。
- 区分三类错误：编程错误、业务错误、外部系统错误。
- 失败时既不吞掉错误，也不把内部路径、堆栈直接泄漏给用户。
- 通过退出码证明程序真的失败了。

建议目录：

```text
examples/async-runtime/
  package.json
  tsconfig.json
  src/
    errors.ts
    file-store.ts
    index.ts
    failure-cases.ts
```

## 2. 核心模块一：`node:fs/promises`

### 知识点解释

`node:fs/promises` 是 Node.js 文件系统模块的 Promise API。相比回调版 `node:fs`，它更适合和 `async/await` 配合，错误会以 Promise rejection 的形式抛出，能用 `try/catch` 统一处理。

常用 API：

- `readFile(path, encoding)`：读取文件内容。
- `writeFile(path, data, encoding)`：写入文件内容。
- `mkdir(path, { recursive: true })`：递归创建目录。
- `rename(oldPath, newPath)`：移动或重命名文件，常用于原子写入。

注意点：

- `fs/promises` 不会阻塞 JavaScript 主线程，但文件 I/O 背后仍然占用系统资源，不能无限并发。
- 文件不存在、权限不足、磁盘满、路径是目录等都属于外部系统错误，不是业务错误。
- JSON 文件写入建议先写临时文件，再 `rename` 覆盖目标文件，降低写到一半进程崩溃导致文件损坏的概率。

### 学习案例：读写任务 JSON 文件

```ts
// src/file-store.ts
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import {
  BusinessError,
  DataCorruptionError,
  ExternalSystemError,
  isNodeError,
} from './errors.js';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
}

export interface FileStoreOptions {
  filePath: string;
  allowMissing?: boolean;
}

export async function readTasks(options: FileStoreOptions): Promise<Task[]> {
  const filePath = resolve(options.filePath);

  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return parseTaskArray(parsed);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      if (options.allowMissing) return [];

      throw new ExternalSystemError(
        'TASK_FILE_NOT_FOUND',
        'Task data file does not exist.',
        { cause: error, safeDetails: { fileName: basename(filePath) } },
      );
    }

    if (error instanceof SyntaxError) {
      throw new DataCorruptionError(
        'TASK_FILE_CORRUPTED',
        'Task data file is not valid JSON.',
        { cause: error },
      );
    }

    if (error instanceof DataCorruptionError) {
      throw error;
    }

    throw new ExternalSystemError(
      'TASK_FILE_READ_FAILED',
      'Failed to read task data file.',
      { cause: error },
    );
  }
}

export async function writeTasks(filePathInput: string, tasks: Task[]): Promise<void> {
  const filePath = resolve(filePathInput);
  const directory = dirname(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(tmpPath, `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
    await rename(tmpPath, filePath);
  } catch (error) {
    throw new ExternalSystemError(
      'TASK_FILE_WRITE_FAILED',
      'Failed to write task data file.',
      { cause: error },
    );
  }
}

export async function addTask(filePath: string, title: string): Promise<Task> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new BusinessError('TITLE_REQUIRED', 'Task title is required.');
  }

  const tasks = await readTasks({ filePath, allowMissing: true });
  const task: Task = {
    id: randomUUID(),
    title: normalizedTitle,
    status: 'TODO',
    createdAt: new Date().toISOString(),
  };

  await writeTasks(filePath, [...tasks, task]);
  return task;
}

function parseTaskArray(value: unknown): Task[] {
  if (!Array.isArray(value)) {
    throw new DataCorruptionError(
      'TASK_FILE_SHAPE_INVALID',
      'Task data file must contain an array.',
    );
  }

  return value.map((item, index) => parseTask(item, index));
}

function parseTask(value: unknown, index: number): Task {
  if (!isRecord(value)) {
    throw new DataCorruptionError(
      'TASK_ITEM_INVALID',
      `Task item at index ${index} must be an object.`,
    );
  }

  const { id, title, status, createdAt } = value;
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    !isTaskStatus(status) ||
    typeof createdAt !== 'string'
  ) {
    throw new DataCorruptionError(
      'TASK_ITEM_INVALID',
      `Task item at index ${index} has invalid fields.`,
    );
  }

  return { id, title, status, createdAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'TODO' || value === 'IN_PROGRESS' || value === 'DONE';
}
```

### 扩展理解

这个例子有三个重点：

1. `readTasks()` 把底层文件错误转换成应用能理解的错误码。
2. `writeTasks()` 使用临时文件加 `rename()`，避免半截 JSON 留在目标文件里。
3. `parseTaskArray()` 不相信文件内容一定正确，因为本地文件可能被人手改坏。

## 3. 核心模块二：`node:path`

### 知识点解释

`node:path` 用于处理文件系统路径。路径不是普通字符串，Windows 和 Linux/macOS 的分隔符不同：

- Windows：`C:\app\data\tasks.json`
- POSIX：`/app/data/tasks.json`

常用 API：

- `resolve(...parts)`：把路径解析成绝对路径。
- `join(...parts)`：拼接路径片段。
- `dirname(path)`：取父目录。
- `basename(path)`：取文件名。
- `extname(path)`：取扩展名。

`join()` 和 `resolve()` 的区别：

- `join('data', 'tasks.json')` 只是拼接并规范化。
- `resolve('data', 'tasks.json')` 会基于当前工作目录生成绝对路径。
- 如果 `resolve()` 遇到绝对路径，前面的片段会被丢弃。

### 学习案例：从环境变量得到数据文件路径

```ts
// src/index.ts 片段
import { resolve } from 'node:path';

function getTaskFilePath(): string {
  const input = process.env.TASK_STORE_FILE ?? 'data/tasks.json';
  return resolve(process.cwd(), input);
}
```

### 扩展理解

`process.cwd()` 是启动命令所在目录，不一定是当前模块所在目录。比如你在仓库根目录执行：

```powershell
pnpm --filter async-runtime dev:file-store
```

此时 `process.cwd()` 通常是仓库根目录或包目录，取决于脚本如何被启动。不要假设它永远等于源代码文件所在目录。

如果你想拿当前模块所在目录，ESM 中要用 `import.meta.url` 配合 `fileURLToPath()`：

```ts
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
```

## 4. 核心模块三：`node:url`

### 知识点解释

`node:url` 用于 URL 和文件路径之间的转换，也能解析 HTTP 请求 URL。Day 4 重点不是 HTTP，但理解 URL 对后续 Day 5 原生 HTTP 服务很关键。

常用 API：

- `new URL(input, base?)`：解析 URL。
- `URLSearchParams`：处理 query string。
- `fileURLToPath(url)`：把 `file://` URL 转成文件路径。
- `pathToFileURL(path)`：把文件路径转成 `file://` URL。

### 学习案例：解析 CLI 传入的文件 URL

```ts
import { fileURLToPath } from 'node:url';

function normalizeInputPath(input: string): string {
  if (input.startsWith('file://')) {
    return fileURLToPath(input);
  }

  return input;
}

console.log(normalizeInputPath('file:///C:/app/data/tasks.json'));
console.log(normalizeInputPath('./data/tasks.json'));
```

### 扩展理解

文件路径和 URL 不是一回事：

- 路径服务于本地文件系统。
- URL 服务于统一资源定位，包括 `http://`、`https://`、`file://` 等。

在 ESM 里，`import.meta.url` 是 URL 字符串，不是路径。如果直接拿它给 `readFile()`，在复杂场景下很容易出问题，应该先转换：

```ts
const filePath = fileURLToPath(import.meta.url);
```

## 5. 核心模块四：环境变量

### 知识点解释

`process.env` 是 Node.js 暴露的进程环境变量对象。它适合放运行时配置，比如端口、数据库连接字符串、数据文件路径。

注意点：

- `process.env.X` 的类型永远是 `string | undefined`。
- 不要在业务逻辑深处到处读取环境变量。
- 推荐在程序启动时集中读取、校验、转成明确类型。
- 环境变量不是安全边界，不要把敏感值打印到日志。

### 学习案例：启动时校验配置

```ts
// src/config.ts 可选拆分
import { resolve } from 'node:path';

export interface AppConfig {
  taskStoreFile: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): AppConfig {
  const logLevel = process.env.LOG_LEVEL ?? 'info';
  if (!isLogLevel(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}`);
  }

  return {
    taskStoreFile: resolve(process.cwd(), process.env.TASK_STORE_FILE ?? 'data/tasks.json'),
    logLevel,
  };
}

function isLogLevel(value: string): value is AppConfig['logLevel'] {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}
```

### 扩展理解

配置错误通常应该在启动阶段失败，而不是等到用户请求进来后才失败。比如 `DATABASE_URL` 缺失、端口不是数字、文件路径不可写，越早失败越容易定位。

## 6. 核心模块五：进程信号

### 知识点解释

进程信号是操作系统通知进程发生某些事件的机制。Node.js 可以通过 `process.on()` 监听。

常见信号：

- `SIGINT`：通常来自 Ctrl+C。
- `SIGTERM`：通常来自进程管理器、Docker、Kubernetes 发出的终止请求。

优雅退出通常包括：

1. 停止接受新任务。
2. 等正在执行的任务完成或超时。
3. 关闭文件、数据库、HTTP 服务等资源。
4. 设置退出码。

### 学习案例：监听信号并安全退出

```ts
// src/index.ts
import { addTask, readTasks } from './file-store.js';
import { formatErrorForCli, isTrustedAppError } from './errors.js';

let shuttingDown = false;

process.on('SIGINT', () => {
  requestShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  requestShutdown('SIGTERM');
});

function requestShutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(JSON.stringify({ level: 'warn', message: 'shutdown_requested', signal }));
  process.exitCode = 130;
}

async function main(): Promise<void> {
  const filePath = process.env.TASK_STORE_FILE ?? 'data/tasks.json';
  const command = process.argv[2];

  if (command === 'add') {
    const title = process.argv.slice(3).join(' ');
    const task = await addTask(filePath, title);
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  if (command === 'list') {
    const tasks = await readTasks({ filePath, allowMissing: true });
    console.log(JSON.stringify(tasks, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command ?? '<empty>'}`);
}

main().catch((error: unknown) => {
  const formatted = formatErrorForCli(error);
  console.error(JSON.stringify(formatted, null, 2));

  // 可信应用错误：返回非零退出码，但不泄漏内部堆栈。
  if (isTrustedAppError(error)) {
    process.exitCode = 1;
    return;
  }

  // 未知错误大概率是编程错误：仍然非零退出，并额外输出堆栈给本地开发者。
  if (error instanceof Error) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
```

### 扩展理解

优先设置 `process.exitCode`，而不是马上调用 `process.exit(1)`。`process.exit()` 会强制退出，可能导致 stdout/stderr 还没写完、异步清理没做完。只有在超时兜底时才考虑强制退出。

## 7. 错误分类：编程错误、业务错误、外部系统错误

### 知识点解释

错误分类决定了处理方式。

| 类型 | 例子 | 是否预期内 | 处理方式 |
|---|---|---:|---|
| 编程错误 | `TypeError`、空对象访问属性、违反不变量 | 否 | 修代码，通常应该失败并暴露给开发者 |
| 业务错误 | 标题为空、任务不存在、重复创建 | 是 | 返回稳定错误码，给用户可理解提示 |
| 外部系统错误 | 文件不存在、JSON 损坏、权限不足、磁盘满、数据库断开 | 部分可预期 | 包装错误，记录 cause，返回安全消息 |

### 学习案例：定义错误类型

```ts
// src/errors.ts
export type ErrorKind = 'business' | 'external' | 'data-corruption';

export interface AppErrorOptions {
  cause?: unknown;
  safeDetails?: Record<string, string>;
}

export class AppError extends Error {
  readonly code: string;
  readonly kind: ErrorKind;
  readonly safeDetails?: Record<string, string>;

  constructor(kind: ErrorKind, code: string, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.kind = kind;
    this.code = code;
    this.safeDetails = options.safeDetails;
  }
}

export class BusinessError extends AppError {
  constructor(code: string, message: string, options?: AppErrorOptions) {
    super('business', code, message, options);
  }
}

export class ExternalSystemError extends AppError {
  constructor(code: string, message: string, options?: AppErrorOptions) {
    super('external', code, message, options);
  }
}

export class DataCorruptionError extends AppError {
  constructor(code: string, message: string, options?: AppErrorOptions) {
    super('data-corruption', code, message, options);
  }
}

export function isTrustedAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function formatErrorForCli(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      kind: error.kind,
      details: error.safeDetails,
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Unexpected internal error.',
    };
  }

  return {
    ok: false,
    code: 'UNKNOWN_THROWN_VALUE',
    message: 'A non-Error value was thrown.',
  };
}
```

### 扩展理解

`cause` 用来保留底层错误，方便日志和排查；`safeDetails` 只放可以展示给用户的信息。生产接口里不要直接把 `error.stack`、绝对路径、数据库连接串返回给用户。

业务错误不是异常事故，它是业务规则的一部分。比如标题为空，代码可以继续运行，只需要返回 `TITLE_REQUIRED`。但编程错误表示程序状态已经不可信，比如某个本该存在的对象是 `undefined`，这类错误不应该被伪装成正常业务失败。

## 8. 失败案例：文件不存在

### 学习案例

```ts
// src/failure-cases.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readTasks } from './file-store.js';
import { formatErrorForCli } from './errors.js';

const caseName = process.argv[2];

async function main(): Promise<void> {
  if (caseName === 'missing') {
    await readTasks({
      filePath: resolve('tmp/not-exists/tasks.json'),
      allowMissing: false,
    });
    return;
  }

  if (caseName === 'corrupted') {
    const filePath = resolve('tmp/corrupted/tasks.json');
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{ bad json', 'utf8');
    await readTasks({ filePath, allowMissing: false });
    return;
  }

  throw new Error(`Unknown failure case: ${caseName ?? '<empty>'}`);
}

main().catch((error: unknown) => {
  console.error(JSON.stringify(formatErrorForCli(error), null, 2));
  process.exitCode = 1;
});
```

这个案例先创建目录，再写入损坏 JSON，因此失败点会稳定落在 `JSON.parse()`，便于观察 `SyntaxError` 如何被转换成 `TASK_FILE_CORRUPTED`。

### 运行与验证

```powershell
pnpm --filter async-runtime exec tsx src/failure-cases.ts missing
$LASTEXITCODE
```

期望：

- 控制台输出结构化错误。
- 错误码类似 `TASK_FILE_NOT_FOUND`。
- `$LASTEXITCODE` 为 `1`。

## 9. 失败案例：JSON 损坏

### 学习重点

损坏 JSON 常见来源：

- 手动编辑时少了引号或逗号。
- 写文件过程中进程崩溃。
- 多个进程同时写同一个文件。
- 文件内容不是预期结构，例如对象而不是数组。

### 运行与验证

```powershell
pnpm --filter async-runtime exec tsx src/failure-cases.ts corrupted
$LASTEXITCODE
```

期望：

- 控制台输出 `TASK_FILE_CORRUPTED` 或写入阶段的外部系统错误。
- 程序没有空 `catch`。
- 程序返回非零退出码。

扩展练习：把文件内容改成合法 JSON 但结构错误：

```json
{
  "items": []
}
```

这不是 `SyntaxError`，但仍然应该被识别为 `TASK_FILE_SHAPE_INVALID`。

## 10. 不吞错误与退出码

### 知识点解释

“不吞错误”不是说所有错误都直接抛给用户，而是：

- 不写空 `catch`。
- 不只打印一句 `failed` 就当作成功。
- 不在失败后返回退出码 `0`。
- 包装错误时保留 `cause`。
- 对外显示安全消息，对内保留排查信息。

错误示例：

```ts
try {
  await readTasks({ filePath: 'missing.json' });
} catch {
  // 错误被吞了，调用方以为成功。
}
```

正确示例：

```ts
try {
  await readTasks({ filePath: 'missing.json' });
} catch (error) {
  console.error(formatErrorForCli(error));
  process.exitCode = 1;
}
```

退出码约定：

- `0`：成功。
- `1`：通用失败。
- `130`：常见于 Ctrl+C 终止。

在 PowerShell 中查看上一个命令退出码：

```powershell
$LASTEXITCODE
```

## 11. 推荐练习顺序

1. 先实现 `errors.ts`，让错误有统一结构。
2. 实现 `file-store.ts` 的 `readTasks()`，只处理正常 JSON。
3. 增加文件不存在案例，确认 `ENOENT` 被转换为应用错误。
4. 增加 JSON 损坏案例，确认 `SyntaxError` 被转换为数据损坏错误。
5. 实现 `writeTasks()` 和 `addTask()`。
6. 加 `index.ts`，通过命令行执行 `add` 和 `list`。
7. 验证失败时 `$LASTEXITCODE` 非零。

## 12. 经典面试题详解

### 题 1：为什么建议用 `node:fs/promises`，而不是同步 `fs.readFileSync()`？

答题要点：

同步 I/O 会阻塞 Node.js 的主线程。在服务端程序里，如果一个请求使用 `readFileSync()` 读取大文件，其他请求的 JavaScript 回调也会被卡住。`fs/promises` 使用 Promise API，更适合 `async/await`，不会阻塞 JS 主线程。但它不等于无限性能，底层仍受系统 I/O 和 libuv 线程池限制。

扩展：

脚本类工具偶尔用同步 I/O 可以接受，比如启动阶段读取一次配置；HTTP 服务请求路径里应优先避免同步 I/O。

### 题 2：`path.join()` 和 `path.resolve()` 有什么区别？

答题要点：

`join()` 负责拼接路径片段并规范化；`resolve()` 会生成绝对路径，并从右向左处理，遇到绝对路径后停止继续向左解析。`resolve('a', '/b', 'c')` 的结果会基于 `/b/c`，前面的 `a` 被忽略。

扩展：

不要用 `'/'` 或 `'\\'` 手动拼路径，跨平台会出问题。涉及安全边界时，`normalize()` 也不能单独防目录穿越，还要校验最终路径是否仍在允许目录下。

### 题 3：`process.cwd()` 和 `import.meta.url` 的区别是什么？

答题要点：

`process.cwd()` 是进程启动时的当前工作目录，受执行命令位置影响。`import.meta.url` 是当前模块文件的 URL，跟从哪里启动无关。ESM 没有 CommonJS 的 `__dirname`，需要用 `fileURLToPath(import.meta.url)` 转换。

扩展：

配置文件、用户数据通常适合基于 `process.cwd()`；模块旁边的模板文件、测试 fixture 更适合基于 `import.meta.url` 定位。

### 题 4：为什么 `process.env.PORT` 不能直接当数字用？

答题要点：

`process.env` 的值都是字符串或 `undefined`。即使写了 `PORT=3000`，读出来也是 `'3000'`。应该启动时显式解析和校验：

```ts
const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error('Invalid PORT');
}
```

扩展：

环境变量校验应该集中做，避免业务代码各处重复读取，导致默认值不一致。

### 题 5：什么是优雅退出？为什么 Docker/Kubernetes 场景尤其重要？

答题要点：

优雅退出是指进程收到终止信号后，不是立刻崩掉，而是停止接受新请求，等待正在处理的请求结束，关闭数据库连接、文件句柄、HTTP server，并在合理超时后退出。Docker 停容器通常先发 `SIGTERM`，超时后才强杀。如果不处理，可能导致请求中断、日志丢失、数据写一半。

扩展：

Node HTTP 服务后续可以在 `SIGTERM` 中调用 `server.close()`，数据库客户端调用 `$disconnect()` 或 `end()`。

### 题 6：编程错误、业务错误、外部系统错误怎么区分？

答题要点：

编程错误是代码 bug，例如 `TypeError`、不可能分支、空指针；业务错误是用户行为或业务规则导致的预期失败，例如标题为空、资源不存在；外部系统错误来自文件系统、数据库、网络、权限等外部依赖。三者处理方式不同：编程错误应暴露给开发者并修复；业务错误应返回稳定错误码；外部系统错误应记录底层原因，对外返回安全消息。

扩展：

不要把所有错误都变成 `500`，也不要把所有错误都吞掉后返回成功。

### 题 7：为什么不要直接把 `error.stack` 返回给用户？

答题要点：

堆栈可能包含绝对路径、内部文件名、部署结构、依赖版本、甚至敏感参数。返回给用户会增加安全风险。正确做法是对外返回稳定错误码和安全消息，对内日志记录 stack 和 cause。

扩展：

API 响应可以包含 `requestId`，让用户反馈问题时，开发者能用 `requestId` 去日志系统定位内部堆栈。

### 题 8：`try/catch` 能捕获所有异步错误吗？

答题要点：

只能捕获当前 `await` 链上的 rejection。下面可以捕获：

```ts
try {
  await readTasks({ filePath: 'missing.json' });
} catch (error) {
  console.error(error);
}
```

但如果你创建 Promise 后不 `await`，当前 `try/catch` 捕不到：

```ts
try {
  readTasks({ filePath: 'missing.json' });
} catch (error) {
  // 捕不到
}
```

扩展：

未处理的 Promise rejection 在现代 Node.js 中应视为严重问题。服务端代码要么 `await`，要么显式 `.catch()`。

### 题 9：`process.exit(1)` 和 `process.exitCode = 1` 有什么区别？

答题要点：

`process.exit(1)` 会立即要求进程退出，可能导致还没写完的日志、stdout/stderr 或异步清理被中断。`process.exitCode = 1` 是告诉 Node.js：事件循环自然结束时用这个退出码。CLI 程序和服务优雅退出一般优先设置 `exitCode`。

扩展：

如果清理过程卡死，可以用超时兜底，在超时后再强制 `process.exit(1)`。

### 题 10：如何验证程序失败时没有被吞错？

答题要点：

从三个层面验证：

1. 终端输出有结构化错误信息，比如 `code`、`message`。
2. 退出码非零，PowerShell 用 `$LASTEXITCODE` 查看。
3. 测试或脚本能稳定复现失败场景，例如文件不存在、JSON 损坏。

扩展：

CI 依赖退出码判断命令是否成功。如果程序失败却返回 `0`，CI 会误判通过。

## 13. Day 4 自测清单

- [ ] 我能解释为什么用 `node:` 前缀导入内置模块。
- [ ] 我能用 `fs/promises` 读取、写入 JSON 文件。
- [ ] 我能解释 `join()`、`resolve()`、`cwd()`、`import.meta.url` 的区别。
- [ ] 我能把环境变量从字符串转换成明确类型并校验。
- [ ] 我能监听 `SIGINT` 和 `SIGTERM`。
- [ ] 我能区分编程错误、业务错误和外部系统错误。
- [ ] 我能写出文件不存在和 JSON 损坏两个失败案例。
- [ ] 我能验证失败命令返回非零退出码。
- [ ] 我没有写空 `catch`，也没有把堆栈直接返回给用户。

# Node.js 核心模块与错误处理

## node:fs/promises

文件系统模块的 Promise API ，相比回调版 node:fs 更适合和 async/await 配合，错误会以 Promise reject 的方式抛出。能用 try/catch 处理错误。
node: 表示 Node.js 核心模块，不需要安装。

API：

- readFile(path,encoding) 读取文件内容
- writeFile(path,data,encoding) 写入文件内容
- mkdir(path,{recursive:true,mode}) 递归创建目录
- rename(oldPath,newPath) 移动或重命名文件夹，常用于原子写入

注意点：

- fs/promises 不会阻塞 Javascript 主线程，但是文件 I/O 背后仍然占用系统资源，不能无限并发。
- 文件不存在、权限不足、磁盘满、路径是目录等属于外部系统错误，不是业务错误。
- JSON 文件写入建议先写临时文件，在 rename 覆盖目标文件，降低写到一半进程崩溃导致文件损坏的风险。


## node:path

`node:path` 用于处理文件系统路径。路径不是普通字符串，Windows 和 Linux/macOS 的分隔符不同：

- Windows：`C:\app\data\tasks.json`
- POSIX：`/app/data/tasks.json`

API

- `resolve(...parts)`：把路径解析成绝对路径。
- `join(...parts)`：拼接路径片段。
- `dirname(path)`：取父目录。
- `basename(path)`：取文件名。
- `extname(path)`：取扩展名。

`join()` 和 `resolve()` 的区别：

- `join('data', 'tasks.json')` 只是拼接并规范化。
- `resolve('data', 'tasks.json')` 会基于当前工作目录生成绝对路径。
- 如果 `resolve()` 遇到绝对路径，前面的片段会被丢弃。

## node:url

`node:url` 用于 URL 和文件路径之间的转换，也能解析 HTTP 请求 URL。

API：

- `new URL(input, base?)`：解析 URL。
- `URLSearchParams`：处理 query string。
- `fileURLToPath(url)`：把 `file://` URL 转成文件路径。
- `pathToFileURL(path)`：把文件路径转成 `file://` URL。

文件路径和 URL 不是直接对应的，需要通过转换函数。

- 路径服务于本地文件系统
- URL 服务于统一资源定位，如 HTTP、HTTPS、FTP、file:// 等。

在 ESM 中， import.meta.url 是 URL 字符串，不是路径。需要 `fileURLToPath()` 转成文件路径。

## 环境变量 process.env

`process.env` 是 Node.js 暴露的进程环境变量对象。它适合放运行时配置，比如端口、数据库连接字符串、数据文件路径。

注意点：

- `process.env.X` 的类型永远是 `string | undefined`。
- 不要在业务逻辑深处到处读取环境变量。
- 推荐在程序启动时集中读取、校验、转成明确类型。
- 环境变量不是安全边界，不要把敏感值打印到日志。

配置错误通常在启动阶段失败。比如 DATABASE_URL 为空、端口不是数字、文件路径不可写，越早失败越容易定位。

## 进程信号 process.on

进程信号是操作系统通知进程发生某些事件的机制。Node.js 可以通过 `process.on()` 监听。

常见信号：

- `SIGINT`：通常来自 Ctrl+C。
- `SIGTERM`：通常来自进程管理器、Docker、Kubernetes 发出的终止请求。

优雅退出通常包括：

1. 停止接受新任务。
2. 等正在执行的任务完成或超时。
3. 关闭文件、数据库、HTTP 服务等资源。
4. 设置退出码。
-优先设置 `process.exitCode`，而不是马上调用 `process.exit(1)`。`process.exit()` 会强制退出，可能导致 stdout/stderr 还没写完、异步清理没做完。只有在超时兜底时才考虑强制退出。

错误分类：编程错误、业务错误、外部系统错误

错误分类决定了处理方式。

| 类型 | 例子 | 是否预期内 | 处理方式 |
|---|---|---:|---|
| 编程错误 | `TypeError`、空对象访问属性、违反不变量 | 否 | 修代码，通常应该失败并暴露给开发者 |
| 业务错误 | 标题为空、任务不存在、重复创建 | 是 | 返回稳定错误码，给用户可理解提示 |
| 外部系统错误 | 文件不存在、JSON 损坏、权限不足、磁盘满、数据库断开 | 部分可预期 | 包装错误，记录 cause，返回安全消息 |

`cause` 用来保留底层错误，方便日志和排查；`safeDetails` 只放可以展示给用户的信息。生产接口里不要直接把 `error.stack`、绝对路径、数据库连接串返回给用户。

业务错误不是异常事故，它是业务规则的一部分。比如标题为空，代码可以继续运行，只需要返回 `TITLE_REQUIRED`。但编程错误表示程序状态已经不可信，比如某个本该存在的对象是 `undefined`，这类错误不应该被伪装成正常业务失败。
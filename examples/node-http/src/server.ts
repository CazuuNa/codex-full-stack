// import { createServer } from 'node:http';
// import { URL } from 'node:url';

// import { routeRequest } from './router.js';

// const port = Number(process.env['PORT']) || 3011;

// if (!Number.isInteger(port) || port <= 0 || port > 65535) {
//     throw new Error('PORT must be an integer between 1 and 65535');
// } // 确保端口号在有效范围内

// // 创建 HTTP 服务器
// const server = createServer((req, res) => { // 每次请求都会走这里
//     const host = req.headers.host ?? `localhost:${port}`; // 获取主机名，默认使用 localhost:端口号
//     const url = new URL(req.url ?? '/', `http://${host}`); // 解析 URL

//     // 调用路由函数处理请求
//     const result = routeRequest(req.method, url.pathname); // 处理请求
//     const responseBody = JSON.stringify(result.body); // 转换为 JSON 字符串
//     res.writeHead(result.statusCode, { 'Content-Type': 'application/json' }); // 设置响应头
//     res.end(responseBody); // 发送响应体
// });

// server.listen(port, () => {
//   console.log(`server listening on http://localhost:${port}`);
// })

// process.on("SIGINT", () => {
//   console.log("");
//   console.log("SIGINT received, closing server...");

//   server.close(() => {
//     console.log("server closed");
//     process.exitCode = 0;
//   });
// });

// process.on("SIGTERM", () => {
//   console.log("SIGTERM received, closing server...");

//   server.close(() => {
//     console.log("server closed");
//     process.exitCode = 0;
//   });
// });

import { createServer } from "node:http";
import { URL } from "node:url";

import { HttpError, isHttpError } from "./errors.js";
import {
  getStringField,
  readJsonBody,
  sendJson,
} from "./http-utils.js";
import {
  createTask,
  listTasks,
} from "./task-store.js";

const port = Number(process.env["PORT"] ?? "3001");

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `localhost:${port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        status: "ok",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/tasks") {
      sendJson(res, 200, {
        tasks: listTasks(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/tasks") {
      const body = await readJsonBody(req);
      const title = getStringField(body, "title");

      if (title === undefined || !title.trim()) {
        throw new HttpError(
          400,
          "TITLE_REQUIRED",
          "Task title is required",
        );
      }

      const task = createTask(title);

      sendJson(res, 201, {
        task,
      });
      return;
    }

    sendJson(res, 404, {
      code: "NOT_FOUND",
      message: "Route not found",
    });
  } catch (error) {
    if (isHttpError(error)) {
      sendJson(res, error.statusCode, {
        code: error.code,
        message: error.message,
      });
      return;
    }

    console.error(error);

    sendJson(res, 500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
  }
});

server.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});

process.on("SIGINT", () => {
  console.log("");
  console.log("SIGINT received, closing server...");

  server.close(() => {
    console.log("server closed");
    process.exitCode = 0;
  });
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");

  server.close(() => {
    console.log("server closed");
    process.exitCode = 0;
  });
});
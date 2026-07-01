import type { IncomingMessage, ServerResponse } from 'node:http'; // 导入 HTTP 相关类型

import {HttpError} from './error.js';

const MAX_BODY_SIZE_BYTES = 1024 * 1024; // 1MB

export type JsonValue = string | number | boolean | null | JsonValue[] | {[key: string]: JsonValue}; // 定义 JSON 值的类型

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: JsonValue,
): void {
  const responseBody = JSON.stringify(body);

  res.writeHead(statusCode, {'Content-Type': 'application/json'});
  res.end(responseBody);
}

export async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let totalSize = 0

  for await (const chunk of req) {
    const buffer= Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    totalSize += buffer.byteLength

    if (totalSize > MAX_BODY_SIZE_BYTES) {
      throw new HttpError(
        413,
        "BODY_TOO_LARGE",
        "Request body must not exceed 1 MB",
      );
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('ascii');
}

export async function readJsonRequestBody(req: IncomingMessage): Promise<unknown> {
  const body = await readRequestBody(req);

  if(!body.trim()) {
    throw new HttpError(400, "EMPTY_BODY", "Request body is required");
  }

  try {
    return JSON.parse(body) as unknown;
  }catch {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON",
    );
  }
}

export function getStringField(
  value: unknown,
  fieldName: string,
): string | undefined {
  if(typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const fieldValue = record[fieldName];

  return typeof fieldValue === "string" ? fieldValue : undefined;

}

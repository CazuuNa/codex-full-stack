export type JsonBody = Record<string, unknown>; // 定义 JSON 请求体的类型 ，允许任意键值对

export interface RouteResult {
  statusCode: number;
  body: JsonBody;
} // 定义路由结果的类型 ，包含状态码和 JSON体

export function routeRequest(method: string | undefined,pathname: string): RouteResult {
  if (method === 'GET' && pathname === '/health') {
    return {
      statusCode: 200,
      body: {
        status: 'ok'
      }
    }
  }
  return {
    statusCode: 404,
    body: {
      code: 'Not Found',
      message: 'The resource you requested was not found on this server.'
    }
  }
}
import test from "node:test";
import assert from "node:assert/strict";
import { logStudioReadError } from "../../src/lib/server-read-error";

test("读取失败只记录路径、类型/代码和栈帧，隐藏正文、查询参数、凭据与图片", t => {
  const original = process.env.ZENMUX_API_KEY;
  process.env.ZENMUX_API_KEY = "test-diagnostic-private-key";
  try {
    const messages: string[] = [];
    t.mock.method(console, "error", (message: string) => messages.push(message));
    const error = Object.assign(new Error("密钥=test-diagnostic-private-key 图片=data:image/png;base64,PRIVATE_IMAGE"), { name: "PrismaClientKnownRequestError", code: "P2002", meta: { image: "PRIVATE_IMAGE" } });
    error.stack = error.message + "\n参数 PRIVATE_IMAGE\n    at studioSnapshot (C:/app/studio-main.ts:19:10)\n    at GET (https://example.invalid/route.ts?token=test-diagnostic-private-key:13:1)\n    at read (C:/test-diagnostic-private-key/read.ts:3:2)\n    at image (data:image/png;base64,PRIVATE_IMAGE:4:2)";
    logStudioReadError(new Request("http://localhost:3000/api/studio/sku/canvas?token=PRIVATE_QUERY"), error);
    assert.equal(messages.length, 1);
    const record = JSON.parse(messages[0]);
    assert.equal(record.path, "/api/studio/sku/canvas");
    assert.equal(record.errorType, "PrismaClientKnownRequestError");
    assert.equal(record.errorCode, "P2002");
    assert(record.stack.includes("at studioSnapshot (C:/app/studio-main.ts:19:10)"));
    for (const secret of ["test-diagnostic-private-key", "PRIVATE_IMAGE", "PRIVATE_QUERY", "data:image", "?token=", "参数"]) assert(!messages[0].includes(secret));
  } finally {
    if (original === undefined) delete process.env.ZENMUX_API_KEY;
    else process.env.ZENMUX_API_KEY = original;
  }
});

test("非Error异常不序列化其内容，也能留下接口位置", t => {
  const messages: string[] = [];
  t.mock.method(console, "error", (message: string) => messages.push(message));
  logStudioReadError(new Request("http://localhost/api/studio/sku"), { image: "PRIVATE_IMAGE", secret: "PRIVATE_KEY" });
  assert.deepEqual(JSON.parse(messages[0]), { event: "studio_read_error", method: "GET", path: "/api/studio/sku", errorType: "UnknownError", errorCode: "UNKNOWN", stack: [] });
});

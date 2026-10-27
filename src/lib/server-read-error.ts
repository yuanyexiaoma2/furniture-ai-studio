import "server-only";

function safeField(value: unknown, fallback: string) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value) ? value : fallback;
}

function safeStack(error: Error): string[] {
  // Error.stack 的首行和 Prisma 的多行错误正文可能包含参数；仅记录调用栈帧。
  const secrets = Object.entries(process.env)
    .filter(([key, value]) => /KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL/i.test(key) && value && value.length >= 4)
    .flatMap(([, value]) => [value!, encodeURIComponent(value!)]);
  return (error.stack ?? "").split(/\r?\n/)
    .filter(line => /^\s+at\s/.test(line) && /:\d+:\d+\)?$/.test(line.trim()))
    .slice(0, 30)
    .map(line => {
      let frame = line.trim().replace(/data:[^\s)]+/gi, "[内容已隐藏]");
      frame = frame.replace(/https?:\/\/[^\s)]+/gi, value => {
        try { const url = new URL(value); url.username = ""; url.password = ""; url.search = ""; url.hash = ""; return url.href; }
        catch { return "[地址已隐藏]"; }
      });
      for (const secret of secrets) frame = frame.split(secret).join("[凭据已隐藏]");
      return frame.slice(0, 1200);
    });
}

export function logStudioReadError(request: Request, error: unknown) {
  const detail = error instanceof Error ? error as Error & {code?: unknown} : null;
  // 不序列化Error、cause、meta、message或请求头/正文，避免输出SQL参数、密钥及图片内容。
  console.error(JSON.stringify({
    event: "studio_read_error",
    method: request.method,
    path: new URL(request.url).pathname,
    errorType: safeField(detail?.name, "UnknownError"),
    errorCode: safeField(detail?.code, "UNKNOWN"),
    stack: detail ? safeStack(detail) : [],
  }));
}

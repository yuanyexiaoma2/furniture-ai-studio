import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function privateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127;
  }
  return address === "::1" || address === "::" || /^(fc|fd|fe[89ab])/i.test(address) || address.toLowerCase().startsWith("::ffff:");
}

export async function downloadResultImage(address: string) {
  for (let hop = 0; hop < 4; hop++) {
    const url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") throw new Error("结果图地址无效");
    const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
    if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw new Error("结果图地址不可访问");
    const response = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: "manual" });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      address = new URL(response.headers.get("location")!, url).href;
      continue;
    }
    if (!response.ok || !response.body) throw new Error("KIE 结果图下载失败，请检查账户任务记录");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 30 * 1024 * 1024) { await reader.cancel(); throw new Error("结果图超过 30MB，无法转存"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("结果图重定向次数过多，无法下载");
}

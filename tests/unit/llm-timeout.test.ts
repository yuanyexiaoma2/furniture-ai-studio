import "dotenv/config";
import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import OpenAI from "openai";
import {ZenMuxLLMProvider} from "../../src/lib/zenmux-llm-provider";
import {GatewayError} from "../../src/lib/gateway-error";

test("产品识别等待超过25秒的响应仍能完成，且不会自动重发", {timeout:40000}, async()=>{
 const original={key:process.env.ZENMUX_API_KEY,url:process.env.ZENMUX_BASE_URL};
 let requests=0,requestBody="";
 const server=createServer(async(request,response)=>{
  requests++;
  const chunks:Buffer[]=[];
  for await(const chunk of request)chunks.push(Buffer.from(chunk));
  requestBody=Buffer.concat(chunks).toString();
  // 本地模拟模型分析图片超过旧25秒限制，不访问任何上游。
  await new Promise(resolve=>setTimeout(resolve,26000));
  response.writeHead(200,{"Content-Type":"application/json"});
  response.end(JSON.stringify({id:"local-slow-vision",choices:[{message:{content:"识别完成"}}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}}));
 });
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 const address=server.address();assert.ok(address&&typeof address!=="string");
 process.env.ZENMUX_API_KEY="local-test-not-real";
 process.env.ZENMUX_BASE_URL="http://127.0.0.1:"+address.port+"/v1";
 try{
  const provider=new ZenMuxLLMProvider(undefined,undefined,async()=>({bytes:Buffer.from("photo"),mime:"image/png"}));
  const result=await provider.chat({messages:[{role:"user",content:"识别产品"}],images:[{id:"photo"}],maxOutputTokens:2400});
  assert.equal(result.text,"识别完成");assert.equal(requests,1);
  assert.equal(JSON.parse(requestBody).messages[0].content[1].image_url.url,"data:image/png;base64,cGhvdG8=");
 }finally{
  if(original.key===undefined)delete process.env.ZENMUX_API_KEY;else process.env.ZENMUX_API_KEY=original.key;
  if(original.url===undefined)delete process.env.ZENMUX_BASE_URL;else process.env.ZENMUX_BASE_URL=original.url;
  server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});

test("SDK等待超时明确提示等待上限，并保留扣费状态未确定标记",async()=>{
 const key=process.env.ZENMUX_API_KEY;process.env.ZENMUX_API_KEY="local-test-not-real";
 try{
  const provider=new ZenMuxLLMProvider(undefined,async()=>{throw new OpenAI.APIConnectionTimeoutError();});
  await assert.rejects(provider.chat({messages:[{role:"user",content:"识别产品"}]}),error=>{
   assert.ok(error instanceof GatewayError);assert.equal(error.status,504);assert.equal(error.uncertain,true);assert.match(error.message,/180秒.*上游处理状态未确定/);return true;
  });
 }finally{if(key===undefined)delete process.env.ZENMUX_API_KEY;else process.env.ZENMUX_API_KEY=key;}
});

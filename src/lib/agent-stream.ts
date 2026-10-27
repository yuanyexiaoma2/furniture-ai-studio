import type {AgentEvent} from "./planning-agent";

// 处理跨网络分块与CRLF，刷新状态由数据库快照恢复，不重发收费请求。
export async function consumeAgentStream(body:ReadableStream<Uint8Array>,onEvent:(event:AgentEvent)=>void){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer="";
 const dispatch=(record:string)=>{const data=record.split("\n").filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trimStart()).join("\n");if(data)onEvent(JSON.parse(data));};
 try{for(;;){const chunk=await reader.read();buffer+=decoder.decode(chunk.value,{stream:!chunk.done});buffer=buffer.replace(/\r\n/g,"\n");let index;while((index=buffer.indexOf("\n\n"))>=0){dispatch(buffer.slice(0,index));buffer=buffer.slice(index+2);}if(chunk.done){if(buffer.trim())dispatch(buffer);break;}}}finally{reader.releaseLock();}
}

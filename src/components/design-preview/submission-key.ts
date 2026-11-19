type Submission={signature:string;key:string};
const memory=new Map<string,Submission>();
const storageKey=(scope:string)=>"furniture-studio-request:"+scope;
export function submissionKey(scope:string,signature:string){
 let previous=memory.get(scope);
 try{const saved=sessionStorage.getItem(storageKey(scope));if(saved)previous=JSON.parse(saved) as Submission;}catch{/* 存储不可用时仍保留本页的提交编号。 */}
 if(previous?.signature===signature&&typeof previous.key==="string")return previous.key;
 const next={signature,key:crypto.randomUUID()};memory.set(scope,next);
 try{sessionStorage.setItem(storageKey(scope),JSON.stringify(next));}catch{/* 隐私模式不影响本次提交。 */}
 return next.key;
}
export function forgetSubmission(scope:string,key:string){
 if(memory.get(scope)?.key===key)memory.delete(scope);
 try{const saved=sessionStorage.getItem(storageKey(scope));if(saved&&(JSON.parse(saved) as Submission).key===key)sessionStorage.removeItem(storageKey(scope));}catch{/* 不覆盖其他提交的状态。 */}
}
export async function clientSubmissionSignature(fields:unknown,files:File[]){
 const parts:unknown[]=[fields];
 for(const file of files){const hash=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());parts.push([file.name,file.type,file.size,Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,"0")).join("")]);}
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(parts)));
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");
}

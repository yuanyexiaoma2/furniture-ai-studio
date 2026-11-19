export type StudioFetchError=Error&{status?:number;requestState?:"running"|"failed"|"mismatch"};
export async function studioFetch<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,options);const data=await response.json();
 if(!response.ok){
  if(response.status===401&&typeof window!=="undefined")window.location.replace(new URL("/login?callbackUrl="+encodeURIComponent(window.location.pathname+window.location.search),window.location.origin));
  throw Object.assign(Error(data.error??"请求未完成，请稍后重试"),{status:response.status,requestState:data.requestState}) as StudioFetchError;
 }
 return data;
}

import {studioUser,studioError,StudioError} from "@/lib/studio-api";
import {renderLiveReview} from "@/lib/visual-review";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{productId:string}>}){
 try{const user=await studioUser(request),param=new URL(request.url).searchParams.get("round");if(param!==null&&!/^[1-9]\d*$/.test(param))throw new StudioError("评分轮次无效",400);return new Response(await renderLiveReview((await context.params).productId,param?Number(param):undefined,user.role==="viewer"),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store"}});}
 catch(e){return studioError(e,"读取评审页失败，请确认产品与轮次存在");}
}

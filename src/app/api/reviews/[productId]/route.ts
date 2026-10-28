import {NextResponse} from "next/server";
import {studioUser,studioError} from "@/lib/studio-api";
import {applyReviewAction} from "@/lib/review-rounds";
import {writeProductReviewSafely} from "@/lib/visual-review";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{productId:string}>}){
 try{const user=await studioUser(request,true),productId=(await context.params).productId,round=await applyReviewAction(productId,user,await request.json());
 const file=await writeProductReviewSafely(productId);
 return NextResponse.json({url:"/reviews/"+encodeURIComponent(productId)+"?round="+round.number,...(!file?{warning:"评分已保存，但本地评审文件更新失败；实时汇总仍可查看。"}:{})});
 }catch(e){return studioError(e,"评分未保存，请稍后重试");}
}

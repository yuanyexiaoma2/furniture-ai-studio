import {studioUser,studioError} from "@/lib/studio-api";
import {reviewSummaryRows} from "@/lib/review-rounds";
import {writeReviewSummary} from "@/lib/visual-review";
import {renderReviewSummary} from "@/lib/review-scoring-html";
export const runtime="nodejs";
export async function GET(request:Request){try{await studioUser(request);await writeReviewSummary();return new Response(renderReviewSummary(await reviewSummaryRows(),true),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store"}});}catch(e){return studioError(e,"读取评分汇总失败");}}

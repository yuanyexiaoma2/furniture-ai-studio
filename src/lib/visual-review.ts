import "server-only";
import {mkdir,writeFile,rename,stat} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {StudioError} from "./studio-error";
import {readObject} from "./storage";
import {type VisualPlan} from "./visual-plan-rules";
import {renderVisualReview} from "./visual-review-html";
import {readReviewSource} from "./review-source";
import {reviewRounds,roundView,reviewSummaryRows} from "./review-rounds";
import {reviewSnapshotSchema,type ReviewControls} from "./review-scoring-rules";
import {renderReviewSummary} from "./review-scoring-html";
export function reviewRoot(){return process.env.VISUAL_REVIEW_TEST_MODE==="true"?path.join(process.cwd(),".local","runtime","reviews"):path.join(process.cwd(),"docs","review");}
async function atomicHtml(filename:string,html:string){const root=reviewRoot();await mkdir(root,{recursive:true});const temp=path.join(root,"."+randomUUID()+".html");await writeFile(temp,html,"utf8");await rename(temp,path.join(root,filename));}
async function reviewView(productId:string,override?:VisualPlan,number?:number,readOnly=false){
 const source=await readReviewSource(productId,override),rows=await reviewRounds(productId);
 const selected=number?rows.find(r=>r.number===number):rows.findLast(r=>r.planVersion===source.planVersion);
 if(number&&!selected)throw new StudioError("评分轮次不存在",404);
 const snapshot=selected?reviewSnapshotSchema.parse(selected.snapshot):source;
 const controls:ReviewControls={productId,planVersion:source.planVersion,libraryEntryCount:source.libraryEntryCount,libraryEligibleCount:source.libraryEligibleCount,rounds:rows.map(roundView),activeRound:selected?roundView(selected):null,nextRound:(rows.at(-1)?.number??0)+1,liveUrl:(process.env.AUTH_URL??"http://localhost:3000").replace(/\/$/,"")+"/reviews/"+encodeURIComponent(productId),readOnly};
 return {source,rows,snapshot,controls};
}
export async function renderLiveReview(productId:string,number?:number,readOnly=false){
 const v=await reviewView(productId,undefined,number,readOnly);
 return renderVisualReview({...v.snapshot,images:v.snapshot.images.map(i=>({...i,src:"/api/assets/"+encodeURIComponent(i.id)})),review:v.controls});
}
export async function writeReviewSummary(){await atomicHtml("summary.html",renderReviewSummary(await reviewSummaryRows()));}
export async function writeProductReview(productId:string,override?:VisualPlan){
 const v=await reviewView(productId,override),source=v.source,root=reviewRoot();
 await mkdir(path.join(root,source.folder),{recursive:true});
 for(const image of source.images){const asset=source.assets.find(a=>a.id===image.id)!;const target=path.join(root,image.src);if(!(await stat(target).catch(()=>null)))await writeFile(target,(await readObject(asset.storageKey)).bytes);}
 await atomicHtml(source.file,renderVisualReview({...v.snapshot,review:v.controls}));
 for(const round of v.rows){const snapshot=reviewSnapshotSchema.parse(round.snapshot);await atomicHtml(source.file.replace(/\.html$/,"-round-"+round.number+".html"),renderVisualReview({...snapshot,review:{...v.controls,activeRound:roundView(round)}}));}
 await writeReviewSummary();
 return path.join(root,source.file);
}
export async function writeProductReviewSafely(productId:string,plan?:VisualPlan){try{return await writeProductReview(productId,plan);}catch(e){console.error("[visual-review]",{productId,error:e instanceof Error?e.stack:String(e)});return null;}}

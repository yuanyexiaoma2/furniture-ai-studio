import {NextResponse} from "next/server";
import {studioUser,studioError} from "@/lib/studio-api";
import {db} from "@/lib/db";
import {patternSchema} from "@/lib/visual-plan-rules";
export async function GET(request:Request){
 try{await studioUser(request);const rows=await db.studioLibraryEntry.findMany({orderBy:{id:"asc"}});return NextResponse.json(rows.flatMap(r=>{const p=patternSchema.safeParse(r.data);return p.success&&!p.data.is_sample?[p.data]:[];}));}
 catch(error){return studioError(error,"读取品类经验失败");}
}

import "dotenv/config";
import {readFile} from "node:fs/promises";
import {db} from "../src/lib/db";
import {adaptCategoryPatterns} from "../src/lib/category-pattern-seed";
import {json} from "../src/lib/agent-state";
import {seedCategories,seedScenes,seedProps,seedPropSets} from "../src/design-preview/mock/library";
const entries=adaptCategoryPatterns(JSON.parse(await readFile("docs/seeds/shoe-rack-vertical.json","utf8")));
const sampleIds=new Set([...seedCategories,...seedScenes,...seedProps,...seedPropSets].map(e=>e.id));
await db.$transaction(async tx=>{
 for(const row of await tx.studioLibraryEntry.findMany())if(sampleIds.has(row.id))await tx.studioLibraryEntry.update({where:{id:row.id},data:{data:json({...row.data as object,is_sample:true,source:"Codex 生成的示例"})}});
 for(const entry of entries)await tx.studioLibraryEntry.upsert({where:{id:entry.id},create:{id:entry.id,kind:entry.type,name:entry.name,data:json(entry)},update:{kind:entry.type,name:entry.name,data:json(entry)}});
});
console.log(JSON.stringify({patterns:entries.filter(e=>e.status==="ready").length,pendingCases:entries.filter(e=>e.status==="pending_images").length}));
await db.$disconnect();

import type {Actor,Category,EntryBase,GenerationRecipe,LibraryEntry,Product,ShootingMode,ShotAngle} from "./types";
export function canView(entry:Pick<EntryBase,"visibility"|"owner">,actor:Actor){return entry.visibility==="public"||entry.owner===actor.id||actor.role==="admin"||actor.role==="template_editor";}
export function canReview(actor:Actor){return actor.role==="admin"||actor.role==="template_editor";}
export function coverage(product:Product,category:Category){
 const present=new Set(product.photos.map(p=>p.angle));const required=category.strictChecklist.filter(r=>r.required);
 return {total:required.length,present:required.filter(r=>present.has(r.angle)).length,missing:required.filter(r=>!present.has(r.angle)),photoCount:product.photos.length};
}
export function shootingNotice(product:Product,category:Category,mode:ShootingMode,alreadyShown=false){
 const result=coverage(product,category);
 if(!result.photoCount)return {kind:"empty" as const,text:"先放入一张产品实拍，就能开始。",blocks:true};
 if(result.photoCount===1)return{kind:"single" as const,text:"只有 1 张实拍，产品还原度可能不稳定",blocks:false};
 if(mode==="quick")return{kind:"quick" as const,text:alreadyShown?"":category.quickHint,blocks:false};
 return{kind:"strict" as const,text:result.missing.length?"还缺"+result.missing.map(r=>r.angle).join("、"):"拍摄资料已齐全",blocks:false};
}
export function matchEntry(entry:LibraryEntry,query:string,filters:string[]=[]){
 const tags=[...entry.tags,entry.name,entry.kind==="prop"?entry.keywordsEn:entry.kind==="snippet"?entry.text:""].map(s=>s.normalize("NFKC").toLowerCase());
 return [...query.normalize("NFKC").trim().toLowerCase().split(/\s+/).filter(Boolean),...filters].every(token=>tags.some(tag=>tag.includes(token.toLowerCase())));
}
export function recentRecipes(recipes:GenerationRecipe[],sku:string,categoryId:string,now:Date){
 const since=now.getTime()-30*86400000;
 return recipes.filter(r=>r.sku===sku||(r.categoryId===categoryId&&Date.parse(r.createdAt)>=since&&Date.parse(r.createdAt)<=now.getTime()));
}
export function guessMockAngle(name:string,index:number):ShotAngle{
 if(/back|背面/i.test(name))return"back";if(/hardware|五金/i.test(name))return"hardware";if(/detail|材质/i.test(name))return"material";if(/side|正侧/i.test(name))return"side";if(/top|俯视/i.test(name))return"top";if(/45|quarter|侧面/i.test(name))return"quarter";if(/front|正面/i.test(name))return"front";return(["front","quarter","side","top","material"] as ShotAngle[])[index%5];
}
export const normalizeDescription=(text:string)=>text.normalize("NFKC").trim().replace(/\s+/g," ").replace(/[。.!！]+$/,"").toLowerCase();

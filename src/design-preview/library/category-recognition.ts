import type {Category,ProductPhoto} from "./types";
/** 静态原型：用文字/文件名匹配品类；无文字线索的图片使用边桌样例，不调用视觉模型。 */
export function recognizeMockCategory(categories:Category[],text:string,photos:ProductPhoto[]){
 const match=(value:string)=>[...categories].sort((a,b)=>b.name.length-a.name.length).find(c=>value.includes(c.name));
 const fromText=match(text);if(fromText)return{categoryId:fromText.id,source:"text" as const};
 const fromNames=match(photos.map(p=>p.name).join(" "));if(fromNames)return{categoryId:fromNames.id,source:"image" as const};
 if(photos.length)return{categoryId:categories.find(c=>c.name==="边桌")?.id??categories[0].id,source:"image" as const};
 return{categoryId:null,source:"unknown" as const};
}

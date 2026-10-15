import type {BrandStyle,FinalPack,Glossary,ProductVariant,Site} from "./types";
export const sites:{id:Site;language:string}[]=[{id:"US",language:"英语（美国）"},{id:"UK",language:"英语（英国）"},{id:"DE",language:"德语"},{id:"FR",language:"法语"},{id:"JP",language:"日语"}];
export function swatchReference(color:string){return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="'+color+'"/><path d="M0 60H320M0 120H320M0 180H320M80 0V240M160 0V240M240 0V240" stroke="white" opacity=".12"/></svg>');}
export const seedBrands:BrandStyle[]=[
{id:"B01",name:"MORI · 栖木",logo:"M",primaryColor:"#B69772",lighting:"自然窗光",style:"自然简约",tone:"暖白与原木",defaultSceneTemplateIds:["S10","S01"],negativeElements:["不出现宠物","不用深色背景","不出现第三方 Logo"]},
{id:"B02",name:"LINEA · 序间",logo:"L",primaryColor:"#76877D",lighting:"均匀漫射光",style:"现代、干净",tone:"浅灰与低饱和绿",defaultSceneTemplateIds:["S04","S03"],negativeElements:["不用花纹地毯","不堆叠杂物"]},
{id:"B03",name:"SAND · 留白",logo:"S",primaryColor:"#CBBBA3",lighting:"午后侧光",style:"温暖、细腻质感",tone:"沙色与奶油色",defaultSceneTemplateIds:["S01","S10"],negativeElements:["不用高饱和色","不出现宠物"]}];
export const presetVariants:ProductVariant[]=[["米白","#E8DECC","亚麻混纺"],["雾灰","#919D9A","亚麻混纺"],["焦糖","#B37F58","磨砂绒面"]].map(([name,color,material],i)=>({id:"V0"+i,name,color,material,referenceImage:swatchReference(color),referenceSource:"swatch"}));
export const seedGlossaries:Glossary[]=[{id:"G01",name:"家具 · 材质与功能",visibility:"public",terms:[
{source:"天然亚麻",translations:{US:"Natural linen",UK:"Natural linen",DE:"Natürliches Leinen",FR:"Lin naturel",JP:"天然リネン"}},
{source:"隐藏收纳",translations:{US:"Hidden storage",UK:"Hidden storage",DE:"Verdeckter Stauraum für ein aufgeräumtes Zuhause",FR:"Rangement dissimulé",JP:"隠し収納"}},
{source:"尺寸说明",translations:{US:"Dimensions",UK:"Dimensions",DE:"Abmessungen",FR:"Dimensions",JP:"サイズ"}},
{source:"可调层板",translations:{US:"Adjustable shelves",UK:"Adjustable shelves",DE:"Verstellbare Einlegeböden",FR:"Étagères réglables",JP:"可動棚"}}
]}];
function pack(sku:string,name:string):FinalPack{return{id:sku,sku,name,product:{id:"P"+sku,name,sku,owner:"U01",visibility:"private",tags:["沙发"],categoryIds:["C04"],categoryId:"C04",shootingMode:"quick",createdAt:"2026-10-15",stats:{used:0,liked:0},photos:[{id:"O9A",image:"/design-preview/sofa.webp",name:"正面实拍",angle:"front",original:true,angleSource:"mock",source:"fixture"},{id:"O9B",image:"/design-preview/r3-16.webp",name:"侧面实拍",angle:"quarter",original:true,angleSource:"mock",source:"fixture"}],features:[{key:"颜色",value:"暖灰",locked:true},{key:"材质",value:"亚麻混纺",locked:true},{key:"扶手",value:"保留圆弧轮廓",locked:true}],dimensions:{width:220,depth:92,height:78,unit:"cm"}},images:[
{id:sku+"-M",slot:"主图",image:"/design-preview/sofa.webp",white:false,occupancy:88,width:2048,height:2048},
{id:sku+"-S",slot:"卖点图",image:"/design-preview/r3-16.webp",copy:{text:"隐藏收纳",fontSize:16,maxCharacters:25},white:false,occupancy:76,width:2048,height:2048,ipWarning:"装饰文字可能包含第三方品牌，需人工核对"},
{id:sku+"-D",slot:"尺寸图",image:"/design-preview/sofa.webp",copy:{text:"尺寸说明",fontSize:16,maxCharacters:25},white:false,occupancy:80,width:2048,height:2048}]};}
export const seedPacks=[pack("SF-2401","云屿 · 三人布艺沙发"),pack("SF-2408","暖境 · 模块沙发")];

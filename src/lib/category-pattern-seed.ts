import {z} from "zod";
import {patternSchema,type VisualPattern} from "./visual-plan-rules";
const rawSchema=z.object({scene_global_rules:z.array(z.string()),variables:z.record(z.string(),z.array(z.string())),scene_templates:z.array(z.object({key:z.string(),name:z.string(),props:z.array(z.string()),placement_rule:z.string(),defaults:z.record(z.string(),z.string()),locked_vars:z.array(z.string()),no_shoes:z.boolean().optional(),shelf_items:z.array(z.string()).optional()})),slots:z.array(z.object({no:z.number(),key:z.string(),overlay:z.string().optional()}))});
// 用户素材中产品专有身份整个丢弃；陈列经验改为“经实拍验证能力后才使用”。
export function adaptCategoryPatterns(raw:unknown):VisualPattern[]{
 const seed=rawSchema.parse(raw),category="鞋架",entries:VisualPattern[]=[];
 const add=(id:string,type:VisualPattern["type"],name:string,content:Record<string,unknown>,sellingPoints:string[]=[],status:VisualPattern["status"]="ready")=>entries.push(patternSchema.parse({id:"shoe-experience-"+id,type,name,categories:[category],is_sample:false,source:"用户提供",sellingPoints,content,status}));
 for(const s of seed.scene_templates){
  const poolId="shoe-experience-props-"+s.key;
  const display=s.no_shoes?"不陈列鞋；小型生活配饰由轻到重、由小到大排列，收纳筐放低处":"只在真实可用的层面陈列，每组物件适合实际空间；轻便鞋置高处，较高鞋靴置低处，不凭经验添加层板、挂钩或托盘";
  add("props-"+s.key,"prop_pool",s.name+"环境配饰",{scenes:[s.name],props:s.props,displayItems:s.shelf_items??[],placement_rule:display,no_shoes:s.no_shoes??false,variables:seed.variables,defaults:s.defaults,locked_vars:s.locked_vars,capabilityGuard:"挂钩、台面、托盘和可拆层板仅在本次 identityLock 确认存在时使用"});
  add("scene-"+s.key,"scene_pattern",s.name,{roomType:s.name,environmentPropPoolIds:[poolId],light:"柔和侧窗自然光，可有淡淡树叶影",palette:"环境采用柔和中性色，仅一处低饱和点缀；不得改变产品原色",composition:"竖向收纳产品完整入画，靠墙或墙角；边缘裁切一件环境家具交代空间，前景可有织物",sceneTemplate:s.key,placement_rule:display,no_shoes:s.no_shoes??false,variables:seed.variables,defaults:s.defaults,locked_vars:s.locked_vars},s.no_shoes?["一物多用"]:["窄空间","收纳"]);
 }
 const points=[
  ["adjustable","可调层高","左右对比局部取景；左为完整结构的常规层高，右仅在本产品已确认允许拆卸时展示取下一块层板的长靴空间。不得改变真实立柱、背板、托盘和底板，不能添加不存在的零件。","双图局部对比",true],
  ["multiuse","一物多用","选择非鞋陈列的生活场景；功能必须有实拍或资料依据","单幅生活场景",false],
  ["waterproof","防水","只在有防水资料依据时展示手持软布清洁表面，不虚构性能","真实材质局部特写",true],
  ["antitip","防倾倒","只展示本产品真实存在且已确认的墙固部件","真实安装位置特写",true],
  ["capacity","大容量","用真实可用层面和比例合适的物件表达收纳能力","完整产品与有序陈列",false],
  ["narrow","窄空间","通过墙角和环境家具表达空间利用","完整产品环境场景",false],
 ] as const;
 for(const [key,name,expression,layout,post] of points)add("selling-"+key,"selling_point_pattern",name,{expression,layout,needs_post:post,overlay:post?"尺寸、说明、图标、线稿均后期叠加；摄影只生成干净底图":"",detachedShelf:"默认不显示被拆层板或半透明部件，需本产品方案明确确认后才可表达"},[name]);
 add("sequence","slot_sequence","竖向鞋架常见图位",{slots:seed.slots.map(s=>({key:s.key,no:s.no,needs_post:Boolean(s.overlay)||[3,8,9].includes(s.no),overlay:[3,8,9].includes(s.no)?"尺寸、文字、数字、说明和线稿全部后期叠加":s.overlay??"",fullProduct:![8,9].includes(s.no)})),note:"作为常见顺序参考，Agent 按本产品卖点增减；不强制任何产品功能或层数"});
 for(const s of seed.slots)add("case-"+s.no,"case","待上传参考图 "+s.no,{originalImageRef:null,uploadLabel:s.no+"-"+s.key,sourceSlot:s.key,decomposition:"仅保留画面用途索引，原图待用户上传后拆解；不推断图片内容"},[],"pending_images");
 return entries;
}

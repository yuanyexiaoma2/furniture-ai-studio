export const progressLabels:Record<string,string>={inspect_canvas:"读取画布",read_product_materials:"读取产品资料",view_images:"查看引用图片",update_profile_draft:"更新产品理解",ask_user:"准备核对问题",request_profile_confirmation:"准备档案确认",propose_image_pack:"规划图包",generate_slot:"核算图位费用",generate_batch:"核算整套费用",edit_image:"核算调整费用",set_final:"准备终稿确认",web_search:"查找外部资料",inspect_product:"识别实拍与产品资料",plan_image_pack:"规划图包方案"};
export function progressLabel(name:string){return progressLabels[name]??"处理创作任务";}
export function progressSummary(result:unknown){
 const r=result&&typeof result==="object"?result as Record<string,unknown>:{};
 if(typeof r.error==="string")return r.error.slice(0,500);
 if(r.waitForUser)return "结果已准备好，等待你确认";
 if(typeof r.analysis==="string")return r.analysis.slice(0,600);
 if(typeof r.elementCount==="number")return "已读取 "+r.elementCount+" 个画布元素";
 if(Array.isArray(r.images))return "已查看 "+r.images.length+" 张图片";
 if(r.batchId||r.jobId)return "任务已提交，生成结果会自动加入画布";
 return "处理完成，结果已保存";
}

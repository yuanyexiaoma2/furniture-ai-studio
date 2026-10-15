import type {WorkflowKind} from "../workflows/types";
export const taskCatalog:{id:WorkflowKind;title:string;description:string;concept:"pack"|"variants"|"edit"|"translate"|"check"}[]=[
{id:"pack",title:"做一套图包",description:"拖入实拍，生成主图、场景、卖点、尺寸",concept:"pack"},
{id:"variants",title:"批量换色",description:"一套定稿图，扩展出多个颜色版本",concept:"variants"},
{id:"translate",title:"多语言版本",description:"保留字体和排版，生成目标站点版本",concept:"translate"},
{id:"edit",title:"改一张图",description:"换背景、去杂物、局部修改",concept:"edit"},
{id:"check",title:"导出前检查",description:"检查 IP 风险和平台规范，再导出图包",concept:"check"}];

// 第二阶段接入时使用此边界，当前仅由本地模拟器消费。
export type ImageAction = "excellent"|"final"|"paint"|"erase"|"expand"|"cutout"|"background"|"regenerate"|"download"|"recolor"|"reference"|"prop";
export type ActionRequest = {
  action:ImageAction; imageId:string; originalImage:string;
  originalPhotoReferences:string[]; productReferences:string[]; mask?:Blob; instruction?:string;
  expansion?:{width:number;height:number;offsetX:number;offsetY:number};
  parameters?:{count:number;ratio:string;quality:"标准"|"精细"};
  editCount:number;
};
export type OnImageAction = (request:ActionRequest)=>void|false|Promise<void|false>;
export interface MaskExportHandle { exportMask:()=>Promise<Blob>; }

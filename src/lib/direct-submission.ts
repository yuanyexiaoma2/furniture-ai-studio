export type EditSelection={assetId:string;instruction:string;maskAssetId?:string;expansion?:{width:number;height:number;offsetX:number;offsetY:number}};
export type EditEstimate={estimatedCostUsd:number;fingerprint:string;warning:string|null};
/** 费用只展示；选区已经由编辑器提交，此处报价后直接执行，不增加确认步骤。 */
export async function submitEditImmediately<T>(selection:EditSelection,requestKey:string,io:{quote:(selection:EditSelection)=>Promise<EditEstimate>;submit:(input:EditSelection&{requestKey:string;fingerprint:string})=>Promise<T>}){
 const quote=await io.quote(selection);
 const result=await io.submit({...selection,requestKey,fingerprint:quote.fingerprint});
 return {result,quote};
}

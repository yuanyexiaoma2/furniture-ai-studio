// 只清理旧版自动费用前缀；保留同一条消息中的参考、省略等提醒和原始审计。
export function workspaceMessageText(role:string,text:string){
 return role==="system"?text.replace(/^本次修改预计\s*\$[\d,.]+（估），提交后开始。\s*/,"").trim():text;
}

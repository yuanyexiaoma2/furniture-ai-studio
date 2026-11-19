"use client";
import {useRef,useState} from "react";
import {toast} from "sonner";
import {Trash2,MoreHorizontal} from "@/components/icons/concept-icons";
import {studioFetch} from "./live-store";
import {Button} from "./ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "./ui/dialog";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from "./ui/dropdown-menu";
import {Tooltip,TooltipContent,TooltipTrigger} from "./ui/tooltip";

export function SkuDeleteButton({product,onDeleted,onRestored}:{product:{id:string;name:string;sku:string};onDeleted:()=>void;onRestored:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[menuOpen,setMenuOpen]=useState(false),[busy,setBusy]=useState(false),submitting=useRef(false);
 async function restore(){
  try{await studioFetch("/api/products/"+product.id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"restore"})});await onRestored();toast.success("项目已恢复");}
  catch(error){toast.error(error instanceof Error?error.message:"恢复失败，请重试");}
 }
 async function remove(){
  if(submitting.current)return;submitting.current=true;setBusy(true);
  try{
   await studioFetch("/api/products/"+product.id,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({sku:product.sku})});
   setOpen(false);onDeleted();toast.success("已删除项目“"+product.name+"”",{duration:15000,action:{label:"撤销",onClick:()=>void restore()}});
  }catch(error){toast.error(error instanceof Error?error.message:"项目删除失败，请重试");}
  finally{submitting.current=false;setBusy(false);}
 }
 return <><DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="p-sku-menu-trigger" aria-label={"项目操作 "+product.name}><MoreHorizontal size="sm"/></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent className="p-portal" side="top">项目操作</TooltipContent></Tooltip><DropdownMenuContent className="p-portal p-sku-actions-menu" align="end" sideOffset={6} onCloseAutoFocus={event=>{if(open)event.preventDefault();}}><DropdownMenuItem className="p-sku-delete-item" onSelect={()=>{setMenuOpen(false);setOpen(true);}}><Trash2 size="sm"/>删除项目</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="p-portal p-sku-delete-dialog"><DialogHeader><DialogTitle>删除这个项目？</DialogTitle><DialogDescription className="p-sku-delete-description">项目将从列表移除，历史图片和费用记录会保留。删除后可在提示中点击“撤销”。</DialogDescription></DialogHeader><div className="p-sku-delete-target"><strong>{product.name}</strong><span>{product.sku}</span></div><div className="p-sku-delete-footer"><Button variant="ghost" disabled={busy} onClick={()=>setOpen(false)}>取消</Button><Button variant="destructive" disabled={busy} onClick={()=>void remove()}>{busy?"正在删除…":"确认删除"}</Button></div></DialogContent></Dialog></>;
}

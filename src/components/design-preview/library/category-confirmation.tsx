"use client";
import {useState} from "react";
import {Check,ChevronDown,Shapes,Camera} from "@/components/icons/concept-icons";
import {Button} from "../ui/button";
import {Popover,PopoverContent,PopoverTrigger} from "../ui/popover";
import {Command,CommandInput,CommandList,CommandEmpty,CommandGroup,CommandItem} from "../ui/command";
import {useLibraryStore} from "./library-store";
export function CategoryPicker({label="换一个",header=false}:{label?:string;header?:boolean}){
 const [open,setOpen]=useState(false),state=useLibraryStore(),task=state.task;
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className={header?"r4-product-category":""} aria-label={header?"修改产品品类":"换一个品类"}>{header&&<Shapes size={16}/>} {label}{header&&<ChevronDown size={16}/>}</Button></PopoverTrigger><PopoverContent className="p-portal r4-category-picker" align="start" sideOffset={8}><Command label="选择产品品类"><CommandInput placeholder="搜索品类…" aria-label="搜索产品品类"/><CommandList><CommandEmpty>没有找到这个品类</CommandEmpty><CommandGroup heading="产品品类">{state.data.categories.map(c=><CommandItem key={c.id} value={c.name} onSelect={()=>{state.confirmCategory(c.id);setOpen(false);}}><span>{c.name}</span>{task?.categoryConfirmed!==false&&task?.product.categoryId===c.id&&<Check size={16}/>}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
export function CategoryConfirmation(){
 const state=useLibraryStore(),task=state.task;if(!task)return null;
 const category=state.data.categories.find(c=>c.id===task.categorySuggestionId);
 if(task.categoryConfirmed===false)return <div className="r4-category-confirm l-shooting-card"><span className="l-card-eyebrow"><span className="concept-icon-box"><Shapes size={20}/></span>确认产品</span><h3>{category?(category.name==="边桌"?"看起来是一张边桌，对吗？":"看起来是"+category.name+"，对吗？"):"还没看出产品品类，可以确认一下吗？"}</h3><p>{category?"确认后，我会按这个品类整理产品资料。":"告诉我产品名称，或从列表里选一个就好。"}</p><div>{category&&<Button onClick={()=>state.confirmCategory(category.id)}>是</Button>}<CategoryPicker label={category?"换一个":"选择品类"}/></div></div>;
 if(task.shootingChoicePending)return <div className="r4-shooting-choice l-shooting-card"><span className="l-card-eyebrow"><span className="concept-icon-box"><Camera size={20}/></span>拍摄建议</span><h3>{state.data.categories.find(c=>c.id===task.product.categoryId)?.name}默认采用严格拍摄标准。</h3><p>按严格清单核对资料，还是这次先快速开始？</p><div><Button onClick={()=>state.chooseShootingMode("strict")}>按严格来</Button><Button variant="outline" onClick={()=>state.chooseShootingMode("quick")}>这次先快速</Button></div></div>;
 return null;
}

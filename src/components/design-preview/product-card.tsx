"use client";
import {useLibraryStore} from "./library/library-store";
import {TaskProductCard} from "./library/shooting";

import {useState} from "react";
import {ChevronLeft,ChevronRight,Check,LockKeyhole,Pencil} from "@/components/icons/concept-icons";
import {motion} from "motion/react";
import {toast} from "sonner";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "./ui/sheet";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Switch} from "./ui/switch";
import {imagePath} from "./store";
const facts=[{name:"颜色",value:"苔绿色织物，保留原有色调",pending:false},{name:"材质",value:"细密织物，木质支脚",pending:false},{name:"扶手",value:"圆润扶手，轮廓与比例保持不变",pending:false},{name:"腿型",value:"木质斜脚，数量与位置需要核对",pending:true},{name:"尺寸",value:"宽 210 × 深 92 × 高 82 cm，待核实",pending:true}];
function LegacyProductCard({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const [slide,setSlide]=useState(0),[values,setValues]=useState(facts.map(f=>f.value)),[pending,setPending]=useState(facts.map(f=>f.pending)),[locked,setLocked]=useState([true,true,true,false,false]),[editing,setEditing]=useState<number|null>(null);
 const count=pending.filter(Boolean).length;
 return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="p-portal p-product-sheet"><SheetHeader className="p-product-header"><SheetTitle>云屿 · 产品卡</SheetTitle><SheetDescription>让每次创作，都记住同一个产品。</SheetDescription><div className="p-product-understanding"><div className="p-understanding-ring"><span>{count===0?'100':'71'}%</span></div><div><strong>{count?`还有 ${count} 项需要你确认`:'关键特征已确认'}</strong><p className="p-subtle">锁定的特征，会在每张新图中保留</p></div></div></SheetHeader><div className="p-product-content"><div className="p-product-carousel"><motion.img key={slide} initial={{opacity:.5}} animate={{opacity:1}} transition={{duration:.18}} src={imagePath('sofa')} style={{objectPosition:['20% 50%','50% 50%','80% 50%'][slide]}} alt={`产品实拍 ${slide+1}`}/><div className="p-carousel-controls"><Button variant="ghost" size="icon" className="p-icon-button" aria-label="上一张实拍" onClick={()=>setSlide(v=>(v+2)%3)}><ChevronLeft size="md"/></Button><span>实拍 {slide+1} / 3</span><Button variant="ghost" size="icon" className="p-icon-button" aria-label="下一张实拍" onClick={()=>setSlide(v=>(v+1)%3)}><ChevronRight size="md"/></Button></div></div>{facts.map((f,i)=><div className="p-feature" key={f.name}><div><strong>{pending[i]&&<i className="p-dot p-dot-warning"/>}{f.name}</strong><label className="p-feature-lock"><LockKeyhole size="sm"/>锁定<Switch aria-label={`锁定${f.name}`} checked={locked[i]} onCheckedChange={v=>setLocked(s=>s.map((n,j)=>i===j?v:n))}/></label></div>{editing===i?<div className="p-feature-input"><Input aria-label={`修改${f.name}`} value={values[i]} onChange={e=>setValues(s=>s.map((v,j)=>j===i?e.target.value:v))}/><Button variant="outline" onClick={()=>{setEditing(null);toast.success('特征已在设计原型中修改');}}>保存</Button></div>:<p>{values[i]}</p>}<div className="p-feature-actions">{pending[i]&&<Button variant="outline" onClick={()=>{setPending(s=>s.map((v,j)=>j===i?false:v));setLocked(s=>s.map((v,j)=>j===i?true:v));toast.success(`已确认${f.name}，仅修改本地样例`);}}><Check size="sm"/>确认</Button>}<Button variant="ghost" onClick={()=>setEditing(i)}><Pencil size="sm"/>修改</Button></div></div>)}</div><div className="p-sheet-footer"><p className="p-subtle">只调整创作环境，保持产品颜色、结构和部件。</p></div></SheetContent></Sheet>;
}

export function ProductCard(props:{open:boolean;onOpenChange:(v:boolean)=>void}){const task=useLibraryStore(s=>s.task);return task?<TaskProductCard {...props}/>:<LegacyProductCard {...props}/>;}

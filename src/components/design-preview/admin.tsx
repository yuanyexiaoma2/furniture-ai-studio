"use client";
import {SHOW_UNCONNECTED_FEATURES} from "@/lib/ui-features";
import Link from "next/link";
import {useState} from "react";
import {Clock3,Plus,Settings2,ShieldCheck,SlidersHorizontal,Sparkles,Trash2,Users} from "@/components/icons/concept-icons";
import {toast} from "sonner";
import {Button} from "./ui/button";
import {Input} from "./ui/input";

import {Checkbox} from "./ui/checkbox";
import {Table,TableHeader,TableHead,TableBody,TableRow,TableCell} from "./ui/table";
import {Sheet,SheetContent,SheetTitle,SheetDescription,SheetHeader} from "./ui/sheet";
import {Pick} from "./app";


import {CategorySettings,PendingReviews} from "./library/admin-library";
import {BrandAdmin} from "./batch/brand";
import {RealModelAdmin} from "./live-model-admin";

const userData=[{name:"林悦",email:"linyue@example.com",role:"美工",cost:"12.45",quota:"50.00"},{name:"陈一",email:"chenyi@example.com",role:"美工",cost:"8.20",quota:"50.00"},{name:"许宁",email:"xuning@example.com",role:"模板编辑",cost:"6.75",quota:"30.00"},{name:"周明",email:"zhouming@example.com",role:"管理员",cost:"3.10",quota:"100.00"},{name:"李可",email:"like@example.com",role:"仅查看",cost:"0.00",quota:"0.00"}];
export function Admin(){const [section,setSection]=useState('模型管理'),[search,setSearch]=useState(''),[edit,setEdit]=useState<number|null>(null),[role,setRole]=useState('美工');
 return <div className="p-admin"><aside className="p-admin-nav"><h2>团队管理</h2>{[{name:'品牌管理',Icon:Sparkles},{name:'品类设置',Icon:Settings2},{name:'待审核条目',Icon:ShieldCheck},{name:'用户管理',Icon:Users},{name:'模型管理',Icon:Sparkles},{name:'网关管理',Icon:SlidersHorizontal},{name:'用量与账单',Icon:Clock3}].filter(s=>SHOW_UNCONNECTED_FEATURES||s.name==='模型管理').map(s=><Button variant="ghost" className={section===s.name?'active':''} key={s.name} onClick={()=>{setSection(s.name);setSearch('');}}><s.Icon size="md"/>{s.name}</Button>)}<Button variant="ghost" asChild><Link href="/admin/users">用户管理</Link></Button><Button variant="ghost" asChild><Link href="/admin/gateways">网关管理</Link></Button>{SHOW_UNCONNECTED_FEATURES&&<Button variant="ghost" onClick={()=>toast.info('清理入口仅演示，没有删除任何数据')}><Trash2 size="sm"/>清理测试数据</Button>}</aside><main className="p-admin-main"><div className="p-admin-heading"><div><h1>{section}</h1><p>{section==='品牌管理'?'统一项目视觉偏好，让每个 SKU 延续品牌气质。':section==='模型管理'?'为团队选择合适的创作搭档。开启可见后，模型会出现在美工选择器中。':section==='用户管理'?'管理成员权限与月度额度。':'团队运行概览，仅展示样例。'}</p></div>{SHOW_UNCONNECTED_FEATURES&&section!=='品牌管理'&&<Button onClick={()=>toast.info('添加操作仅演示，本原型不写入后台')}><Plus size="sm"/>新增{section==='用户管理'?'用户':'配置'}</Button>}</div>{section!=='品牌管理'&&<div className="p-admin-toolbar"><Input placeholder={section==='用户管理'?'搜索成员姓名':'搜索模型名称'} aria-label="后台搜索" value={search} onChange={e=>setSearch(e.target.value)}/>{SHOW_UNCONNECTED_FEATURES&&<span className="p-subtle">最近 7 天 · 示例统计</span>}</div>}
 {section==='品牌管理'&&<BrandAdmin/>}{section==='品类设置'&&<CategorySettings/>}{section==='待审核条目'&&<PendingReviews/>}
 {section==='模型管理'&&<RealModelAdmin search={search}/>}
 {section==='用户管理'&&<div className="p-admin-table"><Table><TableHeader><TableRow><TableHead><Checkbox aria-label="全选成员"/></TableHead><TableHead>团队成员</TableHead><TableHead>角色</TableHead><TableHead>月度花费 / 额度</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{userData.map((u,i)=>({...u,i})).filter(u=>u.name.includes(search)).map(u=><TableRow key={u.name}><TableCell><Checkbox aria-label={`选择${u.name}`}/></TableCell><TableCell><strong>{u.name}</strong><small>{u.email}</small></TableCell><TableCell>{u.role}</TableCell><TableCell>${u.cost} / ${u.quota}</TableCell><TableCell><Button variant="outline" onClick={()=>{setEdit(u.i);setRole(u.role);}}><Settings2 size="sm"/>编辑</Button></TableCell></TableRow>)}</TableBody></Table></div>}
 {section==='网关管理'&&<div className="p-admin-table"><Table><TableHeader><TableRow><TableHead>连接</TableHead><TableHead>状态</TableHead><TableHead>可用能力</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{['主要连接','备用连接'].map(n=><TableRow key={n}><TableCell>{n}</TableCell><TableCell><i className="p-dot p-dot-success"/> 已配置</TableCell><TableCell>产品理解、出图与调整</TableCell><TableCell><Button variant="outline" onClick={()=>toast.info('已模拟连接检查，没有发送网络请求')}>检查连接</Button></TableCell></TableRow>)}</TableBody></Table></div>}
 {section==='用量与账单'&&<><div className="p-admin-stat-row">{[{label:'本月花费',value:'$30.50'},{label:'生成图片',value:'218 张'},{label:'平均每张',value:'$0.04'}].map(s=><div key={s.label}><span className="p-subtle">{s.label}</span><strong>{s.value}</strong></div>)}</div><div className="p-admin-table"><Table><TableHeader><TableRow><TableHead>成员</TableHead><TableHead>本月花费</TableHead><TableHead>月度额度</TableHead></TableRow></TableHeader><TableBody>{userData.map(u=><TableRow key={u.name}><TableCell>{u.name}</TableCell><TableCell>${u.cost}</TableCell><TableCell>${u.quota}</TableCell></TableRow>)}</TableBody></Table></div></>}
 {SHOW_UNCONNECTED_FEATURES&&<div className="p-admin-footer"><ShieldCheck size="sm"/>成员、模型和统计均为假数据；修改只保留在本地预览。</div>}</main><Sheet open={edit!==null} onOpenChange={v=>!v&&setEdit(null)}><SheetContent className="p-portal"><SheetHeader><SheetTitle>编辑成员 · {edit!==null&&userData[edit].name}</SheetTitle><SheetDescription>本阶段只演示编辑流程，不保存到后台。</SheetDescription></SheetHeader><div className="p-settings"><label>角色</label><Pick label="成员角色" value={role} values={['美工','模板编辑','管理员','仅查看']} onChange={setRole}/><label>每月额度（美元）</label><Input type="number" min="0" step="0.01" defaultValue={edit!==null?userData[edit].quota:'50.00'} aria-label="每月额度"/><Button onClick={()=>{setEdit(null);toast.success('已完成成员编辑预览');}}>保存预览</Button></div></SheetContent></Sheet></div>;
}

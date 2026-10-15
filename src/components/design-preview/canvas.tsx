/* eslint-disable @next/next/no-img-element -- 使用预生成缩略图及本地 Blob，避免图片接口请求。 */
"use client";
import {createContext,useContext,memo,useCallback,useEffect,useRef,useState} from "react";
import dynamic from "next/dynamic";
import {useTheme} from "next-themes";
import {ReactFlow,ReactFlowProvider,Background,BackgroundVariant,Controls,MiniMap,Panel,NodeToolbar,Position,SelectionMode,useReactFlow,useViewport,type NodeProps} from "@xyflow/react";
import {useDropzone} from "react-dropzone";
import {AnimatePresence,motion} from "motion/react";
import {Bookmark,Brush,Check,Columns2,Download,Eraser,Expand,Hand,History,ImagePlus,Layers3,MoreHorizontal,MousePointer2,PanelLeftOpen,Plus,ScanLine,StickyNote,Trash2} from "lucide-react";
import {toast} from "sonner";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "./ui/dialog";
import {TipButton,source,downloadImages} from "./app";
import {usePreviewStore,type StudioNode} from "./store";
import {WorkflowChat,CanvasStarters,launchWorkflow} from "./batch/workflow";
import {useWorkflowStore} from "./batch/workflow-store";
import {syncFrames} from "./batch/actions";
import {LibraryChat} from "./library/workflow";
import {PropCapture} from "./library/capture";
import {originalPhotoReferences,useLibraryStore} from "./library/library-store";
import {Popover,PopoverContent,PopoverTrigger} from "./ui/popover";
import {demoSession,estimateCost,useModelStore} from "./model-store";
import type {ActionRequest,ImageAction,OnImageAction,MaskExportHandle} from "./contracts";
const MaskEditor=dynamic(()=>import('./mask-editor'),{ssr:false});
const ExpandEditor=dynamic(()=>import('./expand-editor'),{ssr:false});
const ActionContext=createContext<OnImageAction|undefined>(undefined);
// 保持初始适应参数稳定，避免编辑时覆盖 React Flow 正在执行的局部放大。
const initialFitOptions={padding:"80px" as const};

const FrameNode=memo(function FrameNode({data}:NodeProps<StudioNode>){const {zoom}=useViewport();return <div className={`p-frame ${data.effect==='empty'?'p-frame-empty':''}`}><div className="p-frame-title" style={{transform:`scale(${1/zoom})`,transformOrigin:"left bottom",width:`${zoom*100}%`}}><span>{data.label}</span><i className={`p-dot ${data.loading?'p-dot-busy':data.effect==='empty'?'':data.final?'p-dot-success':'p-dot-warning'}`}/><span>{data.effect==='empty'?'':`${data.candidateCount??5} 张候选`}</span></div>{data.effect==='empty'&&<p style={{fontSize:14/zoom}}>{data.loading?'正在准备候选…':'确认方案后生成'}</p>}</div>;});
const PictureNode=memo(function PictureNode({id,data,selected}:NodeProps<StudioNode>){
 const editor=usePreviewStore(s=>s.editor),simulate=usePreviewStore(s=>s.simulate),setEditor=usePreviewStore(s=>s.setEditor);const mask=useRef<MaskExportHandle>(null);
 const [previewMask,setPreviewMask]=useState<string|null>(null);const {zoom}=useViewport();const labelStyle={transform:`scale(${1/zoom})`,transformOrigin:"left bottom"};
 const onAction=useContext(ActionContext);
 return <motion.div whileHover={{y:-2}} transition={{duration:.2,ease:"easeOut"}} className={`p-image-node ${data.final?'is-final':''} ${data.highlight?'p-highlight':''}`} data-picture={id}>
  <img loading="lazy" decoding="async" src={source(data.image)} alt={`${data.slot} · ${data.label}`} className={`p-effect-${data.effect??''}`}/>
  {data.variantColor&&<span className="w-variant-overlay" style={{background:data.variantColor}}/>}{data.copy&&<span className="w-copy-overlay" style={{fontSize:data.copy.fontSize}}>{data.copy.text}</span>}
  {data.effect==="dimensions"&&<span className="p-dimension-overlay" style={{fontSize:12/zoom}} aria-label="尺寸标注示意"/>}
  <span className="p-image-tag" style={labelStyle}>{data.label}</span>{data.final&&<span className="p-final-tag" style={{transform:`scale(${1/zoom})`,transformOrigin:"left top"}}><i className="p-dot p-dot-success"/>终稿</span>}
  <button className="p-image-more nodrag" aria-label="图片更多操作" onClick={()=>usePreviewStore.getState().select([id])} style={{transform:`scale(${1/zoom})`,transformOrigin:"right top"}}><MoreHorizontal size={16}/></button>{data.loading&&<div className="p-loading" role="status" aria-label="正在生成候选"><motion.div className="p-shimmer" animate={{x:["-120%","120%"]}} transition={{duration:1.2,repeat:Infinity,ease:"linear"}}/></div>}
  {editor?.id===id&&['paint','erase'].includes(editor.action)&&selected&&<MaskEditor ref={mask} action={editor.action} onCancel={()=>setEditor(null)} onConfirm={async(blob)=>{setPreviewMask(URL.createObjectURL(blob));await simulate(id,editor.action,onAction,blob);toast.success('新候选已加入画布，原图保留');}}/>}
  <Dialog open={!!previewMask} onOpenChange={open=>{if(!open&&previewMask){URL.revokeObjectURL(previewMask);setPreviewMask(null);}}}><DialogContent className="p-portal"><DialogHeader><DialogTitle>蒙版已准备好</DialogTitle><DialogDescription>白色是需要调整的区域，黑色是保留区域。本次只在浏览器中演示。</DialogDescription></DialogHeader>{previewMask&&<img src={previewMask} alt="已导出的 PNG 蒙版" className="p-mask-preview"/>}<Button onClick={()=>{if(previewMask){const a=document.createElement('a');a.href=previewMask;a.download='局部调整蒙版.png';a.click();}}}><Download size={15}/>下载蒙版</Button></DialogContent></Dialog>
  {data.highlight&&<span className="sr-only">已定位这张图</span>}
 </motion.div>;
});
const NoteNode=memo(function NoteNode({id,data}:NodeProps<StudioNode>){const {zoom}=useViewport();const update=usePreviewStore(s=>s.update);return <div className="p-note-node"><Textarea style={{fontSize:14/zoom}} className="nodrag" aria-label="画布便签" value={data.label} onChange={e=>update(id,{label:e.target.value})}/></div>;});
const nodeTypes={frame:FrameNode,picture:PictureNode,note:NoteNode};
const tools:{action:ImageAction;label:string;Icon:typeof Check}[]=[{action:'final',label:'设为终稿',Icon:Check},{action:'paint',label:'局部重绘',Icon:Brush},{action:'erase',label:'消除',Icon:Eraser},{action:'expand',label:'扩图',Icon:Expand},{action:'cutout',label:'抠图',Icon:ScanLine},{action:'background',label:'换背景',Icon:ImagePlus},{action:'regenerate',label:'再来一张',Icon:Plus},{action:'download',label:'下载',Icon:Download}];
export function ImageToolbar({onAction}:{onAction:(action:ImageAction)=>void}){return <motion.div className="p-toolbar" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.16}}>{tools.map((t,i)=><Button className={i===1||i===6?"p-tool-separator":""} key={t.action} variant="ghost" onClick={()=>onAction(t.action)}><t.Icon size={15}/>{t.label}</Button>)}<Popover><PopoverTrigger asChild><Button variant="ghost"><Bookmark size={15}/>收藏与换色</Button></PopoverTrigger><PopoverContent className="p-portal l-toolbar-menu">{([{action:'reference',label:'存为参考图'},{action:'prop',label:'存为道具'},{action:'recolor',label:'换色'}] as const).map(item=><Button key={item.action} variant="ghost" onClick={()=>onAction(item.action)}>{item.label}</Button>)}</PopoverContent></Popover></motion.div>;}
export function Workspace({onAction}:{onAction?:OnImageAction}) {return <ActionContext.Provider value={onAction}><ReactFlowProvider><CanvasWorkspace onAction={onAction}/></ReactFlowProvider></ActionContext.Provider>;}
function CanvasWorkspace({onAction}:{onAction?:OnImageAction}) {
 const flow=useReactFlow<StudioNode>();const {zoom}=useViewport();const {resolvedTheme}=useTheme();
 const nodes=usePreviewStore(s=>s.nodes),selected=usePreviewStore(s=>s.selected),tool=usePreviewStore(s=>s.tool),editor=usePreviewStore(s=>s.editor),referencePicking=usePreviewStore(s=>s.referencePicking),pending=usePreviewStore(s=>s.pending);
 const changeNodes=usePreviewStore(s=>s.changeNodes),select=usePreviewStore(s=>s.select),setTool=usePreviewStore(s=>s.setTool),setEditor=usePreviewStore(s=>s.setEditor),simulate=usePreviewStore(s=>s.simulate);
 const editQuote=estimateCost(useModelStore(),demoSession,1);
 const [capture,setCapture]=useState<{id:string;image:string}|null>(null);
 const task=useLibraryStore(s=>s.task),workflow=useWorkflowStore();
 useEffect(()=>{const s=useWorkflowStore.getState();if(s.pack&&s.pack.sku===useLibraryStore.getState().task?.product.sku&&s.outputs.length&&!usePreviewStore.getState().nodes.some(n=>n.id===s.outputs[0].id)){syncFrames(s.pack,s.outputs);setTimeout(()=>flow.fitView({padding:"80px",duration:0}),90);}},[flow]);
 const isEmpty=!nodes.some(n=>n.type==="picture");
 const [collapsed,setCollapsed]=useState(false),[panel,setPanel]=useState<'layers'|'history'|null>(null),[compare,setCompare]=useState(false),[effect,setEffect]=useState<{id:string;action:ImageAction}|null>(null);
 useEffect(()=>{if(task?.stage!=="generated"||(useWorkflowStore.getState().outputs.length&&useWorkflowStore.getState().pack?.sku===task.product.sku))return;const recipes=useLibraryStore.getState().data.recipes.filter(r=>task.recipeIds.includes(r.id));if(!recipes.length||usePreviewStore.getState().nodes.some(n=>n.id===recipes[0].imageId))return;usePreviewStore.getState().restoreTask(recipes.map(r=>({id:r.imageId,image:r.image})));const timer=setTimeout(()=>flow.fitView({padding:"80px",duration:0}),60);return()=>clearTimeout(timer);},[task?.id,task?.stage,task?.recipeIds,task?.product.sku,flow]);
 const pictures=selected.filter(id=>nodes.find(n=>n.id===id)?.type==='picture');const current=nodes.find(n=>n.id===pictures[0]);
 const internal=current?flow.getInternalNode(current.id):undefined,screen=internal?flow.flowToScreenPosition(internal.internals.positionAbsolute):undefined;
 const screenWidth=typeof window==="undefined"?1600:window.innerWidth,centerX=(screen?.x??screenWidth/2)+112*zoom;
 const toolbarAlign=centerX<(collapsed?0:440)+420?"start":centerX>screenWidth-420?"end":"center";
 const onSelection=useCallback(({nodes:selection}:{nodes:StudioNode[]})=>select(selection.map(n=>n.id)),[select]);
 const drop=useDropzone({noClick:true,noKeyboard:true,accept:{'image/*':['.jpg','.jpeg','.png','.webp']},onDropAccepted:(files,event)=>{const e=event as unknown as {clientX:number;clientY:number};const point=flow.screenToFlowPosition({x:e.clientX??500,y:e.clientY??300});files.forEach((f,i)=>usePreviewStore.getState().addImage(URL.createObjectURL(f),{x:point.x+i*240,y:point.y}));toast.success('参考图已放入画布，没有上传到服务器');}});
 const openFiles=drop.open;
 useEffect(()=>{function keys(e:KeyboardEvent){if((e.target as HTMLElement).closest('input,textarea,[contenteditable=true]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();openFiles();return;}if(e.key.toLowerCase()==='n')usePreviewStore.getState().addNote();if(e.key.toLowerCase()==='v')setTool('select');if(e.key.toLowerCase()==='h')setTool('pan');}window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);},[setTool,openFiles]);
 function focus(id:string){flow.fitView({nodes:[{id}],padding:.6,minZoom:1.1,maxZoom:1.1,duration:180});usePreviewStore.getState().update(id,{highlight:true});setTimeout(()=>usePreviewStore.getState().update(id,{highlight:false}),1000);select([id]);changeNodes(nodes.map(n=>({id:n.id,type:'select' as const,selected:n.id===id})));}
 async function perform(action:ImageAction){if(!current)return;const request:ActionRequest={action,imageId:current.id,originalImage:source(current.data.image),originalPhotoReferences:originalPhotoReferences(),productReferences:[...originalPhotoReferences(),...usePreviewStore.getState().references.map(id=>source(nodes.find(n=>n.id===id)?.data.image??id))],editCount:current.data.editCount??0};
  if(action==='final'){usePreviewStore.getState().setFinal(current.id);useLibraryStore.getState().suggestScene(current.id,source(current.data.image));await onAction?.(request);toast.success('这张图已设为终稿');}
  else if(action==='reference'){useLibraryStore.getState().suggestCapture('reference',current.id,source(current.data.image));toast.success('参考图收藏建议已放入对话');}
  else if(action==='prop'){setCapture({id:current.id,image:source(current.data.image)});}
  else if(action==='download'){downloadImages([{src:source(current.data.image),name:`${current.data.slot}-${current.data.label}`}]);await onAction?.(request);}
  else if(['paint','erase'].includes(action)){setEditor({id:current.id,action});flow.fitView({nodes:[{id:current.id}],padding:.5,minZoom:1.8,maxZoom:1.8,duration:180});}
  else if(action==='expand')setEditor({id:current.id,action});
  else if(['cutout','background','recolor'].includes(action)){setEffect({id:current.id,action});}
  else {await simulate(current.id,action,onAction);toast.success('新的候选已加入画布，原图保留');}
 }
 const editorNode=nodes.find(n=>n.id===editor?.id),effectNode=nodes.find(n=>n.id===effect?.id);
 return <div className="p-workspace">{capture&&<PropCapture imageId={capture.id} image={capture.image} onClose={()=>setCapture(null)}/>}{!collapsed&&(task&&!workflow.active&&task.messages.length?<LibraryChat onCollapse={()=>setCollapsed(true)} onFocus={focus}/>:<WorkflowChat onCollapse={()=>setCollapsed(true)}/>)}<div {...drop.getRootProps()} className={`p-canvas-wrap ${drop.isDragActive?'p-drop-active':''}`}><input {...drop.getInputProps()} aria-label="画布上传参考图"/>
 <ReactFlow<StudioNode> nodes={isEmpty?[]:nodes} edges={[]} nodeTypes={nodeTypes} onNodesChange={changeNodes} onSelectionChange={onSelection} fitView fitViewOptions={initialFitOptions} defaultViewport={{x:45,y:80,zoom:.72}} minZoom={.15} maxZoom={2.5} selectionOnDrag={tool==='select'&&!editor} selectionMode={SelectionMode.Partial} panOnDrag={tool==='pan'?[0,1,2]:[1,2]} panActivationKeyCode="Space" zoomActivationKeyCode={['Meta','Control']} zoomOnScroll={false} panOnScroll zoomOnPinch multiSelectionKeyCode={['Meta','Control','Shift']} deleteKeyCode={['Backspace','Delete']} nodesDraggable={!editor&&tool==='select'} elementsSelectable={!editor&&tool==='select'} nodesConnectable={false} onlyRenderVisibleElements proOptions={{hideAttribution:true}} colorMode={resolvedTheme==='dark'?'dark':'light'} onNodeClick={(_,node)=>{if(referencePicking&&node.type==='picture'){usePreviewStore.getState().addReference(node.id);toast.success('已添加这张参考图');}}} ariaLabelConfig={{'node.a11yDescription.default':'按方向键移动图片，删除键移除选中项','controls.zoomIn.ariaLabel':'放大画布','controls.zoomOut.ariaLabel':'缩小画布','controls.fitView.ariaLabel':'适应屏幕','minimap.ariaLabel':'画布导航'}}>
  <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--p-dot)"/>
  <Panel position="top-left"><div className="p-canvas-tools">{collapsed&&<TipButton label="展开对话" onClick={()=>setCollapsed(false)}><PanelLeftOpen size={18}/></TipButton>}<TipButton label="选择（V）" className={tool==='select'?'active':''} onClick={()=>setTool('select')}><MousePointer2 size={18}/></TipButton><TipButton label="平移（H）" className={tool==='pan'?'active':''} onClick={()=>setTool('pan')}><Hand size={18}/></TipButton><TipButton label="添加参考图（Ctrl + O）" onClick={drop.open}><ImagePlus size={20}/></TipButton><TipButton label="添加便签（N）" onClick={()=>{usePreviewStore.getState().addNote();const note=usePreviewStore.getState().nodes.at(-1);if(note)flow.fitView({nodes:[{id:note.id}],maxZoom:1,duration:180});toast.success('已在画布上方添加便签');}}><StickyNote size={18}/></TipButton></div></Panel>
  <Panel position="top-right"><div className="p-canvas-guide">{referencePicking?'请点击一张图片作为参考':pending?'正在创作新候选…':'空格拖动画布 · Ctrl / ⌘ 滚轮缩放'}</div></Panel>
  <NodeToolbar nodeId={pictures} isVisible={pictures.length===1&&!editor} align={toolbarAlign} position={Position.Top} offset={18}><ImageToolbar onAction={perform}/></NodeToolbar>
  <NodeToolbar nodeId={selected} isVisible={selected.some(id=>nodes.find(n=>n.id===id)?.type==="frame")} position={Position.Top} offset={24}><div className="p-toolbar"><Button variant="ghost" onClick={()=>launchWorkflow("variants")}>批量换色·换变体</Button><Button variant="ghost" onClick={()=>launchWorkflow("translate")}>多语言版本</Button><Button variant="ghost" onClick={()=>launchWorkflow("check")}>导出前检查</Button></div></NodeToolbar>
  <NodeToolbar nodeId={pictures} isVisible={pictures.length>1&&!editor} position={Position.Top} offset={18}><motion.div className="p-toolbar" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.18}}><Button variant="ghost" onClick={()=>setCompare(true)}><Columns2 size={16}/>对比</Button><Button variant="ghost" onClick={()=>{downloadImages(nodes.filter(n=>pictures.includes(n.id)).map(n=>({src:source(n.data.image),name:n.data.label})));toast.success('已下载选中的样图');}}><Download size={16}/>批量下载</Button><Button variant="ghost" onClick={()=>{usePreviewStore.getState().removeSelected();toast.success('已从本地画布移除选中图片');}}><Trash2 size={16}/>删除</Button></motion.div></NodeToolbar>
  <Panel position="bottom-left"><div className="p-bottom-tools"><Button variant="ghost" onClick={()=>setPanel(v=>v==='layers'?null:'layers')}><Layers3 size={16}/>图层</Button><Button variant="ghost" onClick={()=>setPanel(v=>v==='history'?null:'history')}><History size={16}/>历史</Button></div></Panel>
  <MiniMap nodeColor={n=>n.type==='frame'?'var(--border)':'var(--p-subtle)'} maskColor="var(--p-overlay)" pannable zoomable/>
  <Controls showInteractive={false} orientation="horizontal" fitViewOptions={{padding:.1}}><span className="p-zoom-label">{Math.round(zoom*100)}%</span></Controls>
 </ReactFlow>{isEmpty&&<CanvasStarters/>}
 <AnimatePresence>{panel&&<motion.div className="p-layer-panel" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.18}}><h3>{panel==='layers'?'图位与参考图':'创作历史'}</h3>{panel==='layers'?nodes.filter(n=>n.type==='frame'||!n.parentId&&n.type==='picture').map(n=><Button key={n.id} variant="ghost" onClick={()=>focus(n.id)}>{n.type==='frame'?<Layers3 size={14}/>:<ImagePlus size={14}/>} {n.data.label}</Button>):usePreviewStore.getState().history.map((h,i)=><Button key={`${h}-${i}`} variant="ghost" onClick={()=>{focus('image-1-1');toast.info('已定位这次调整对应的图片');}}><History size={14}/>{h}</Button>)}</motion.div>}</AnimatePresence>
 {editor?.action==='expand'&&editorNode&&<ExpandEditor src={source(editorNode.data.image)} onCancel={()=>setEditor(null)} onConfirm={async extent=>{await onAction?.({action:'expand',imageId:editorNode.id,originalImage:source(editorNode.data.image),originalPhotoReferences:originalPhotoReferences(),productReferences:[...originalPhotoReferences(),...usePreviewStore.getState().references.map(id=>source(nodes.find(n=>n.id===id)?.data.image??id))],editCount:editorNode.data.editCount??0,expansion:extent});await simulate(editorNode.id,'expand');toast.success('扩图效果已模拟完成，新候选已加入画布');}}/>}
 </div><Dialog open={compare||!!effect} onOpenChange={v=>{if(!v){setCompare(false);setEffect(null);}}}><DialogContent className="p-portal p-template-dialog"><DialogHeader><DialogTitle>{effect?effect.action==='cutout'?'抠图前后对比':effect.action==='recolor'?'换色前后对比':'换背景前后对比':'对比选中的图片'}</DialogTitle><DialogDescription>{effect?'演示视觉效果，原图保留。点击确认后 1.5 秒生成一个假候选。':'放在一起，选择更适合产品的画面。'}</DialogDescription></DialogHeader><div className="p-compare-grid">{effectNode?<><div><img src={source(effectNode.data.image)} alt="调整前"/><p className="p-subtle">调整前</p></div><div className={`p-fake-effect p-fake-${effect?.action}`}><img src={source(effectNode.data.image)} alt="调整后示例"/><p className="p-subtle">调整后 · 假效果</p></div></>:nodes.filter(n=>pictures.includes(n.id)).map(n=><div key={n.id}><img src={source(n.data.image)} alt={n.data.label}/><p className="p-subtle">{n.data.slot} · {n.data.label}</p></div>)}</div>{effect&&effectNode&&<Button onClick={async()=>{const copy=effect;setEffect(null);await simulate(copy.id,copy.action,onAction);toast.success('效果已模拟完成，新图已加入画布');}}>确认 · 约 ${editQuote.toFixed(3)}</Button>}</DialogContent></Dialog></div>;
}

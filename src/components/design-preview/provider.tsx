"use client";
import { useEffect,useState } from "react";
import { ThemeProvider } from "next-themes";
import {SessionProvider} from "next-auth/react";
import { TooltipProvider } from "./ui/tooltip";
import { Toaster } from "sonner";
import {Check,X,CircleHelp,Sparkles} from "@/components/icons/concept-icons";
import {useWorkflowStore} from "./batch/workflow-store";
import {studioFetch} from "./live-store";
import type {MockModel} from "@/design-preview/mock/models";
import {useModelStore} from "./model-store";
import {useLibraryStore} from "./library/library-store";
export function PreviewProvider({children}:{children:React.ReactNode}) {
  const [ready,setReady]=useState(false);
  // 先恢复持久状态，再挂载会初始化会话的子组件，避免默认值覆盖已存选择。
  useEffect(()=>{let active=true;Promise.all([useModelStore.persist.rehydrate(),useLibraryStore.persist.rehydrate(),useWorkflowStore.persist.rehydrate()]).then(()=>{if(active){useModelStore.getState().setCatalog([]);studioFetch<{models:MockModel[]}>("/api/studio/models").then(r=>{if(active)useModelStore.getState().setCatalog(r.models);}).catch(()=>{});setReady(true);}});return()=>{active=false;};},[]);
  // 离开预览时恢复业务页面原有的主题环境。
  useEffect(()=>()=>{document.documentElement.classList.remove("dark","light");document.documentElement.style.removeProperty('color-scheme');},[]);
  return <SessionProvider refetchOnWindowFocus={false}><ThemeProvider attribute="class" storageKey="furniture-preview-theme" defaultTheme="system" enableSystem disableTransitionOnChange><TooltipProvider delayDuration={250}>{ready?children:<div role="status" className="p-preview-loading">正在打开创作空间…</div>}<Toaster icons={{success:<Check size={16}/>,error:<X size={16}/>,info:<CircleHelp size={16}/>,warning:<CircleHelp size={16}/>,loading:<Sparkles size={16}/>}} className="p-portal" position="bottom-right" toastOptions={{className:"p-toast"}} /></TooltipProvider></ThemeProvider></SessionProvider>;
}

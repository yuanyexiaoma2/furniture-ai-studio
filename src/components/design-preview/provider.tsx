"use client";
import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "./ui/tooltip";
import { Toaster } from "sonner";
import {useModelStore} from "./model-store";
export function PreviewProvider({children}:{children:React.ReactNode}) {
  useEffect(()=>{void useModelStore.persist.rehydrate();},[]);
  // 离开预览时恢复业务页面原有的主题环境。
  useEffect(()=>()=>{document.documentElement.classList.remove("dark","light");document.documentElement.style.removeProperty('color-scheme');},[]);
  return <ThemeProvider attribute="class" storageKey="furniture-preview-theme" defaultTheme="system" enableSystem disableTransitionOnChange><TooltipProvider delayDuration={250}>{children}<Toaster className="p-portal" position="bottom-right" toastOptions={{className:"p-toast"}} /></TooltipProvider></ThemeProvider>;
}

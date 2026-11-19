import {notFound} from "next/navigation";
import {PreviewApp} from "@/components/design-preview/app";
import type {ImageTool} from "@/components/design-preview/image-tool-page";

export default async function Page({params}:{params:Promise<{tool:string}>}){
 const {tool}=await params;
 if(!["recolor","expand","cutout","direct"].includes(tool))notFound();
 return <PreviewApp page="tools" tool={tool as ImageTool}/>;
}

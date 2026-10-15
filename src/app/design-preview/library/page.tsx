import {Suspense} from "react";
import {PreviewApp} from "@/components/design-preview/app";
export default function LibraryPage(){return <Suspense fallback={<p>正在整理创作资料…</p>}><PreviewApp page="library"/></Suspense>;}

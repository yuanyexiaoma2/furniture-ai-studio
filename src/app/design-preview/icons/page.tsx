import {PreviewApp} from "@/components/design-preview/app";
import {notFound} from "next/navigation";
import {SHOW_UNCONNECTED_FEATURES} from "@/lib/ui-features";
export default function Page(){if(!SHOW_UNCONNECTED_FEATURES)notFound();return <PreviewApp page="icons"/>;}

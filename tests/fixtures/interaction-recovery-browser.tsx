import React from "react";
import {createRoot} from "react-dom/client";
import {usePathname} from "next/navigation";
import {PreviewProvider} from "../../src/components/design-preview/provider";
import {PreviewApp} from "../../src/components/design-preview/app";
import {GatewayManager} from "../../src/components/gateway-manager";
const gateway={configured:true,open:false,calls:0,successRate:null,averageMs:null,totals:{},rawCredits:0,imageCalls:0,llmCalls:0,active:0,pendingBills:0,unresolvedBills:0,lastError:null};
const gatewayData={preference:"kie",gateways:[{...gateway,provider:"kie"},{...gateway,provider:"zenmux"}],routes:[]};
function Fixture(){
 const pathname=usePathname();
 const mode=pathname.startsWith("/tools/")?"tools":pathname.startsWith("/gateway")?"gateway":pathname.startsWith("/library")?"library":pathname.startsWith("/workspace")?"workspace":"home";
 return <PreviewProvider>{mode==="gateway"?<div className="studio-shell"><GatewayManager initial={gatewayData as never}/></div>:<PreviewApp page={mode} tool={pathname.split("/")[2] as import("../../src/components/design-preview/image-tool-page").ImageTool}/>}</PreviewProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);

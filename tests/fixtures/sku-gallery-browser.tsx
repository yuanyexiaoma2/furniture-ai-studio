import React from "react";
import {createRoot} from "react-dom/client";
import {PreviewProvider} from "../../src/components/design-preview/provider";
import {RealSkuGallery} from "../../src/components/design-preview/live-workspace";
createRoot(document.getElementById("root")!).render(<PreviewProvider><div className="p-app"><RealSkuGallery/></div></PreviewProvider>);

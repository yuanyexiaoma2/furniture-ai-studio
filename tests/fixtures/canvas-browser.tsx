import React from "react";
import {createRoot} from "react-dom/client";
import {PreviewProvider} from "../../src/components/design-preview/provider";
import {PreviewApp} from "../../src/components/design-preview/app";

// 仅测试入口：实际工作台组件，接口由 Playwright 完整拦截。
createRoot(document.getElementById("root")!).render(<PreviewProvider><PreviewApp page="workspace"/></PreviewProvider>);

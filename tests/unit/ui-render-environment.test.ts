import test from "node:test";
import assert from "node:assert/strict";
import {assertRenderEnvironment,type RenderEnvironment} from "../../scripts/ui-render-environment";
const original:RenderEnvironment={schemaVersion:1,chromeVersion:"156.0",os:{platform:"win32",release:"10",version:"Windows",arch:"x64"},fonts:[{family:"Segoe UI",installed:true,files:[{path:"C:/Windows/Fonts/segoeui.ttf",sha256:"original"}]},{family:"PingFang SC",installed:false,files:[]}]};
test("截图环境一致才允许比较",()=>assert.doesNotThrow(()=>assertRenderEnvironment(original,structuredClone(original))));
test("缺少历史字体指纹时必须先重拍原版",()=>assert.throws(()=>assertRenderEnvironment(undefined,original),/重拍基线/));
for(const change of ["browser","os","fontHash","fontPath","fontInstalled"]){
 test(`截图环境变化会中止比较：${change}`,()=>{const changed=structuredClone(original);if(change==="browser")changed.chromeVersion="157";if(change==="os")changed.os.release="11";if(change==="fontHash")changed.fonts[0].files[0].sha256="updated";if(change==="fontPath")changed.fonts[0].files[0].path="C:/Other.ttf";if(change==="fontInstalled")changed.fonts[1].installed=true;assert.throws(()=>assertRenderEnvironment(original,changed),/重拍原版提交/);});
}

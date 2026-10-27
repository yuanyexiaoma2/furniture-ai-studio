import test from "node:test";
import assert from "node:assert/strict";
import {loginDestination,DEFAULT_STUDIO_PATH} from "../../src/lib/login-destination";

test("默认登录和旧首页进入新版工作台，站内具体工作页保留回跳",()=>{
 for (const path of [undefined,null,"/","/?old=1","/login","/login?callbackUrl=/login"]) assert.equal(loginDestination(path),DEFAULT_STUDIO_PATH);
 for (const path of ["/design-preview","/design-preview/workspace?sku=example","/design-preview/admin","/products/example"]) assert.equal(loginDestination(path),path);
});
test("拒绝外站、反斜杠、控制字符及认证接口回跳",()=>{
 for (const path of ["https://evil.invalid","//evil.invalid","/\\evil.invalid","/\nevil.invalid","/api/auth/signin",["/admin"],"/a/../login"]) assert.equal(loginDestination(path),DEFAULT_STUDIO_PATH);
});

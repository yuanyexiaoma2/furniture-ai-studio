import test from "node:test";
import assert from "node:assert/strict";
import {loginDestination,DEFAULT_STUDIO_PATH} from "../../src/lib/login-destination";

test("默认登录进入正式首页，旧入口回跳映射到正式路径并保留参数",()=>{
 for (const path of [undefined,null,"/","/login","/login?callbackUrl=/login"]) assert.equal(loginDestination(path),DEFAULT_STUDIO_PATH);
 for (const path of ["/?old=1","/workspace?sku=example","/admin/models","/products/example"]) assert.equal(loginDestination(path),path);
 for (const [from,to] of [["/design-preview","/"],["/design-preview/skus","/skus"],["/design-preview/workspace?sku=example&export=1","/workspace?sku=example&export=1"],["/design-preview/library?tab=scene","/library?tab=scene"],["/design-preview/admin","/admin/models"]]) assert.equal(loginDestination(from),to);
});
test("拒绝外站、反斜杠、控制字符及认证接口回跳",()=>{
 for (const path of ["https://evil.invalid","//evil.invalid","/\\evil.invalid","/\nevil.invalid","/api/auth/signin",["/admin"],"/a/../login"]) assert.equal(loginDestination(path),DEFAULT_STUDIO_PATH);
});

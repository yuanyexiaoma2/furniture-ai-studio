import "dotenv/config";
import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {rm,readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";
import bcrypt from "bcrypt";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../src/generated/prisma/client";
import {fixture} from "./fixtures/visual-plan";
test("盲测评分：三档与原因、轮次冻结、历史留存、两轮汇总、登录权限和离线预览（零模型调用）",async({page,browser,baseURL})=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("仅允许本地测试");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),run=randomUUID(),password=randomUUID(),sku="REVIEW-UI-"+run,origin=baseURL!;
 let userId="",viewerId="",productId="",libId="";const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 try{
 const user=await db.user.create({data:{name:"盲测美工",email:run+"@example.invalid",passwordHash:await bcrypt.hash(password,12),monthlyQuota:0}});userId=user.id;
 const viewer=await db.user.create({data:{name:"只读评分员",email:"viewer-"+run+"@example.invalid",passwordHash:await bcrypt.hash(password,12),role:"viewer",monthlyQuota:0}});viewerId=viewer.id;
 const product=await db.product.create({data:{sku,name:"浏览器评分测试产品",category:"测试",dimensions:[],colors:[],materials:"未知",sellingPoints:[],createdById:userId}});productId=product.id;
 const session=await db.agentSession.create({data:{productId,createdById:userId}});
 const plan={...fixture,productId,slots:[...fixture.slots,{...fixture.slots[0],key:"b",name:"场景B"},{...fixture.slots[0],key:"c",name:"细节C"}]};
 const card=await db.agentCard.create({data:{sessionId:session.id,kind:"pack",data:JSON.parse(JSON.stringify({visualPlan:plan}))}});
 await page.goto("/reviews/"+productId);await expect(page).toHaveURL(/\/login\?/);await page.getByLabel("公司邮箱").fill(user.email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();await expect(page).toHaveURL(new RegExp("/reviews/"+productId+"$"));
 await expect(page.getByRole("button",{name:"开始第 1 轮评分"})).toBeVisible();await page.getByRole("button",{name:"开始第 1 轮评分"}).click();await expect(page.getByRole("heading",{name:"第 1 轮评分"})).toBeVisible();
 const first=await db.reviewRound.findFirstOrThrow({where:{productId}});
 for(const [i,key] of ["entry","b","c"].entries()){const form=page.locator('[data-slot="'+key+'"]');await form.getByRole("radio",{name:["采用","小改","重做"][i],exact:true}).check();await form.getByLabel("评分原因").fill("第一轮意见"+i);await form.getByRole("button",{name:"保存此图位评分"}).click();await expect(form).toContainText("已保存");}
 const edit=page.locator('[data-slot="entry"]');await edit.getByRole("radio",{name:"小改",exact:true}).check();await edit.getByLabel("评分原因").fill("补充评估后需要小改");await edit.getByRole("button",{name:"保存此图位评分"}).click();await expect(edit).toContainText("已保存：小改");expect(await db.reviewRating.count({where:{roundId:first.id}})).toBe(4);
 await db.agentCard.update({where:{id:card.id},data:{data:JSON.parse(JSON.stringify({visualPlan:{...plan,reason:"第二轮新版方案"}}))}});
 libId="review-ui-lib-"+run;await db.studioLibraryEntry.create({data:{id:libId,kind:"test",name:"计数测试",data:{}}});
 await page.goto("/reviews/"+productId);await page.getByRole("button",{name:"开始第 2 轮评分"}).click();await expect(page.getByRole("heading",{name:"第 2 轮评分"})).toBeVisible();
 for(const [i,key] of ["entry","b","c"].entries()){const form=page.locator('[data-slot="'+key+'"]');await form.getByRole("radio",{name:i<2?"采用":"小改",exact:true}).check();await form.getByLabel("评分原因").fill("第二轮意见"+i);await form.getByRole("button",{name:"保存此图位评分"}).click();await expect(form).toContainText("已保存");}
 const second=await db.reviewRound.findFirstOrThrow({where:{productId,number:2}});expect(second.libraryEntryCount).toBe(first.libraryEntryCount+1);expect(second.planVersion).not.toBe(first.planVersion);
 await page.getByRole("link",{name:"查看评分汇总与两轮对比 →"}).click();await expect(page.getByRole("heading",{name:"评分汇总 · 第一轮与第二轮"})).toBeVisible();await expect(page.getByText("采用：0 → 2（+2）",{exact:true})).toBeVisible();await expect(page.getByText("重做：1 → 0（-1）",{exact:true})).toBeVisible();await expect(page.locator("tbody tr").filter({hasText:sku})).toHaveCount(2);
 const viewerContext=await browser.newContext(),vp=await viewerContext.newPage();try{
 await vp.goto(origin+"/login");await vp.getByLabel("公司邮箱").fill(viewer.email);await vp.getByLabel("密码",{exact:true}).fill(password);await vp.getByRole("button",{name:"进入工作台"}).click();await vp.waitForURL(url=>url.pathname==="/");await vp.goto(origin+"/reviews/"+productId+"?round=1");await expect(vp.getByRole("button",{name:"开始第 3 轮评分"})).toBeDisabled();expect((await viewerContext.request.post(origin+"/api/reviews/"+productId,{headers:{Origin:origin},data:{action:"score",roundId:first.id,slotKey:"entry",decision:"adopt",reason:"越权"}})).status()).toBe(403);
 }finally{await viewerContext.close();}
 const cross=await page.request.post("/api/reviews/"+productId,{headers:{Origin:"https://example.invalid"},data:{action:"start",nextRound:3,planVersion:second.planVersion}});expect(cross.status()).toBe(403);
 const forged=await page.request.post("/api/reviews/"+productId,{headers:{Origin:origin},data:{action:"score",roundId:first.id,slotKey:"entry",decision:"adopt",reason:"伪造",reviewerName:"其他人"}});expect(forged.status()).toBe(400);
 const file=path.resolve("docs/review/"+sku+".html");expect(await readFile(file,"utf8")).toContain("图位评分");await page.goto(pathToFileURL(file).href);await expect(page.getByRole("status")).toContainText("这是离线预览");await expect(page.getByRole("button",{name:"开始第 3 轮评分"})).toBeDisabled();expect(errors).toEqual([]);expect(await db.llmCall.count({where:{createdById:userId}})).toBe(0);
 }finally{
 if(productId)await db.product.delete({where:{id:productId}});if(libId)await db.studioLibraryEntry.deleteMany({where:{id:libId}});
 try{await page.request.get(origin+"/reviews/summary");}catch{}
 if(userId)await db.user.delete({where:{id:userId}});if(viewerId)await db.user.delete({where:{id:viewerId}});await db.$disconnect();
 const root=path.resolve("docs/review"),stem=path.resolve(root,sku);if(stem.startsWith(root+path.sep)){for(const suffix of [".html","-round-1.html","-round-2.html","-assets"])await rm(stem+suffix,{force:true,recursive:true});}
 }
});

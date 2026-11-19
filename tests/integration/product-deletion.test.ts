import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../../src/lib/db";
import {assertProductActive,deletedProductIds,setProductDeleted,DELETED_PRODUCT_KIND} from "../../src/lib/product-deletion";

test("项目删除：确认、权限、进行中任务拦截、幂等撤销与历史图片费用保留（仅隔离数据）",async()=>{
 assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
 const run=randomUUID(),users:string[]=[],products:string[]=[];
 try{
  for(let i=0;i<2;i++)users.push((await db.user.create({data:{email:`delete-${run}-${i}@example.invalid`,name:"项目删除隔离验证",passwordHash:"not-a-login-account"}})).id);
  const owner={id:users[0],role:"designer"},other={id:users[1],role:"designer"};
  const product=await db.product.create({data:{sku:"DELETE-"+run,name:"删除验证项目",category:"柜",dimensions:"未知",materials:"木",colors:"棕",sellingPoints:[],createdById:owner.id}});products.push(product.id);
  const asset=await db.asset.create({data:{productId:product.id,type:"generated",createdById:owner.id,storageKey:"verification/delete/"+run,width:512,height:512}});
  const call=await db.llmCall.create({data:{productId:product.id,createdById:owner.id,logicalModel:"llm-vision",provider:"simulation",model:"local",status:"success",reservedUsd:0,costUsd:.01,costEstimated:false}});
  await assert.rejects(setProductDeleted(product.id,{...owner,role:"viewer"},true,product.sku),/只读/);
  await assert.rejects(setProductDeleted(product.id,other,true,product.sku),/自己创建/);
  await assert.rejects(setProductDeleted(product.id,owner,true,"other-sku"),/信息已变化/);
  const job=await db.generationJob.create({data:{productId:product.id,createdById:owner.id,logicalModel:"scene-main",status:"pending",input:{}}});
  await assert.rejects(setProductDeleted(product.id,owner,true,product.sku),/等待完成/);
  await db.generationJob.update({where:{id:job.id},data:{status:"success",costUsd:.03,reservedUsd:0,resultAssetIds:[asset.id]}});
  await db.llmCall.update({where:{id:call.id},data:{status:"running"}});await assert.rejects(setProductDeleted(product.id,owner,true,product.sku),/等待完成/);
  await db.llmCall.update({where:{id:call.id},data:{status:"success"}});
  await setProductDeleted(product.id,owner,true,product.sku);await setProductDeleted(product.id,owner,true,product.sku);
  assert((await deletedProductIds()).includes(product.id));await assert.rejects(assertProductActive(db,product.id),/已删除/);
  assert.equal(await db.product.count({where:{id:product.id}}),1);assert.equal(await db.asset.count({where:{id:asset.id,deletedAt:null}}),1);assert.equal(Number((await db.llmCall.findUniqueOrThrow({where:{id:call.id}})).costUsd),.01);assert.equal(Number((await db.generationJob.findUniqueOrThrow({where:{id:job.id}})).costUsd),.03);
  await assert.rejects(setProductDeleted(product.id,other,false),/自己创建/);
  await setProductDeleted(product.id,{...other,role:"admin"},false);await setProductDeleted(product.id,owner,false);
  assert(!(await deletedProductIds()).includes(product.id));await assertProductActive(db,product.id);
 }finally{
  await db.studioLibraryEntry.deleteMany({where:{kind:DELETED_PRODUCT_KIND,id:{in:products.map(id=>"deleted-product:"+id)}}});
  await db.generationJob.deleteMany({where:{productId:{in:products}}});await db.llmCall.deleteMany({where:{productId:{in:products}}});await db.asset.deleteMany({where:{productId:{in:products}}});await db.product.deleteMany({where:{id:{in:products}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
 }
});

from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,zipfile
BASE="http://localhost:3001";OUT=Path("docs/task-10");CHK=Path(".local/task10-e2e-checkpoint.json")
def save(d):CHK.write_text(json.dumps(d),encoding="utf-8")
with sync_playwright() as p:
 b=p.chromium.launch(channel="chrome",headless=True)
 c=b.new_context(storage_state=".local/task8a-storage.json",viewport={"width":1600,"height":1100},accept_downloads=True,record_video_dir="docs/task-10/recordings",record_video_size={"width":1600,"height":1100})
 page=c.new_page();errors=[];api_errors=[];page.on("pageerror",lambda e:errors.append(str(e)));page.on("dialog",lambda d:d.accept());page.on("response",lambda r:api_errors.append({"status":r.status,"url":r.url}) if "/api/" in r.url and r.status>=400 else None)
 checkpoint=json.loads(CHK.read_text(encoding="utf-8")) if CHK.exists() else {}
 try:
  if not checkpoint.get("productId"):
   page.goto(BASE+"/design-preview");page.wait_for_load_state("networkidle")
   page.get_by_role("button",name="亮色主题",exact=True).click()
   page.locator('input[aria-label="首页上传实拍"]').set_input_files([".local/task10-refs/photo-1.png",".local/task10-refs/photo-2.png"])
   page.get_by_role("textbox",name="首页创作要求").fill("SKU: NL27TS01-T10。按这款原木藤编门马桶架的实拍制作一套图包。保留拱顶、藤编双门及门上的金色五金把手，不能改成无把手。不知道的尺寸不写。")
   page.screenshot(path=str(OUT/"screens/home-upload-light.png"))
   page.get_by_role("button",name="发送并进入工作台",exact=True).click()
   page.wait_for_url("**/design-preview/workspace?sku=**",timeout=30000)
   productId=page.url.split("sku=")[1].split("&")[0];checkpoint={"productId":productId,"startedAt":time.time()};save(checkpoint)
   print("CREATED",productId,flush=True)
  else:
   productId=checkpoint["productId"];page.goto(BASE+"/design-preview/workspace?sku="+productId);page.wait_for_load_state("networkidle")
  def snap():return c.request.get(BASE+"/api/studio/"+productId).json()
  def wait_state(check,timeout=240):
   deadline=time.time()+timeout
   while time.time()<deadline:
    state=snap()
    if check(state):return state
    page.wait_for_timeout(500)
   raise AssertionError("状态未按预期更新")
  def wait_button(name,timeout=240000):
   button=page.get_by_role("button",name=name,exact=True);button.wait_for(state="visible",timeout=timeout);button.click(timeout=timeout)
  state=snap()
  if not state["settings"].get("categoryConfirmed"):
   wait_button("是");wait_state(lambda s:s["settings"].get("categoryConfirmed"));print("CATEGORY confirmed",flush=True)
  state=wait_state(lambda s:s["settings"].get("categoryConfirmed"))
  if any(x["kind"]=="shooting" and x["status"]=="pending" for x in state["agent"]["cards"]):
   wait_button("这次先快速");wait_state(lambda s:not any(x["kind"]=="shooting" and x["status"]=="pending" for x in s["agent"]["cards"]))
  state=snap()
  if not state["agent"]["session"]["confirmedProfileId"]:
   if not any(x["kind"]=="profile" and x["status"]=="pending" for x in state["agent"]["cards"]):wait_button("核对产品档案")
   page.get_by_role("button",name="确认并保存档案",exact=True).wait_for(timeout=30000)
   page.screenshot(path=str(OUT/"screens/profile-confirm-light.png"))
   # 保留图中可见身份信息；不把缺失尺寸编造为测量值。
   print("PROFILE",json.dumps(snap()["agent"]["profile"],ensure_ascii=False),flush=True)
   wait_button("确认并保存档案");wait_state(lambda s:bool(s["agent"]["session"]["confirmedProfileId"]));print("PROFILE saved",flush=True)
  state=snap()
  if not state["agent"]["session"]["confirmedPack"]:
   if not any(x["kind"]=="pack" and x["status"]=="pending" for x in state["agent"]["cards"]):wait_button("规划图包")
   wait_button("确认图包方案");wait_state(lambda s:s["agent"]["session"]["confirmedPack"]);print("PLAN confirmed",flush=True)
  state=snap()
  if not any(slot["jobs"] for slot in state["pack"]["slots"]):
   wait_button("生成候选 · 先查看费用");wait_button("确认并生成")
   print("GENERATION submitted",flush=True)
  deadline=time.time()+660
  while time.time()<deadline:
   state=snap();jobs=[j for s in state["pack"]["slots"] for j in s["jobs"]]
   if jobs and all(j["status"] not in ["pending","running"] for j in jobs):break
   page.wait_for_timeout(2000)
  print("JOBS",[(j["status"],j["error"]) for j in jobs],flush=True)
  assert len([j for j in jobs if j["status"]=="success"])>=4
  # 逐张点选浮动工具条，真实保存四个图位终稿。
  for slot in state["pack"]["slots"]:
   if slot["finalAssetId"]:continue
   asset=next(a for j in slot["jobs"] if j["status"]=="success" for a in j["assets"])
   node=page.locator('[data-picture="'+asset["id"]+'"]')
   node.scroll_into_view_if_needed();node.click(force=True)
   page.get_by_role("button",name="设为终稿",exact=True).click()
   page.wait_for_timeout(700)
  page.screenshot(path=str(OUT/"screens/finals-light.png"))
  state=snap()
  if not any(j["input"].get("sourceAssetId") for slot in state["pack"]["slots"] for j in slot["jobs"]):
   asset=state["pack"]["slots"][0]["finalAssetId"];node=page.locator('[data-picture="'+asset+'"]')
   node.click(force=True);page.get_by_role("button",name="局部重绘",exact=True).click()
   page.wait_for_timeout(500)
   canvases=page.locator(".konvajs-content canvas")
   print("MASK CANVASES",canvases.count(),flush=True)
   box=canvases.first.bounding_box();assert box
   page.mouse.move(box["x"]+box["width"]*.65,box["y"]+box["height"]*.3);page.mouse.down();page.mouse.move(box["x"]+box["width"]*.7,box["y"]+box["height"]*.35,steps=15);page.mouse.up()
   page.screenshot(path=str(OUT/"screens/inpaint-light.png"))
   print("MASK BUTTONS",page.get_by_role("button").all_text_contents()[-20:],flush=True)
   # 真实提交按钮由已渲染的蒙版编辑器提供。
   page.get_by_role("button",name="确认 · 约",exact=False).click()
   wait_state(lambda s:any(j["input"].get("sourceAssetId") for slot in s["pack"]["slots"] for j in slot["jobs"]))
   checkpoint["editSubmitted"]=True;save(checkpoint)
  state=wait_state(lambda s:any(j["input"].get("sourceAssetId") and j["status"]=="success" for slot in s["pack"]["slots"] for j in slot["jobs"]),timeout=660)
  edited=next(j for slot in state["pack"]["slots"] for j in slot["jobs"] if j["input"].get("sourceAssetId") and j["status"]=="success")
  assert edited["input"].get("maskAssetId") and len(edited["input"]["referenceAssetIds"])>=4
  node=page.locator('[data-picture="'+edited["assets"][0]["id"]+'"]');node.wait_for(timeout=15000);node.click(force=True);page.get_by_role("button",name="设为终稿",exact=True).click()
  wait_state(lambda s:any(slot["finalAssetId"]==edited["assets"][0]["id"] for slot in s["pack"]["slots"]))
  assert not api_errors and not errors,(api_errors,errors)
  print("EDIT VERIFIED",flush=True)
  page.get_by_role("button",name="暗色主题",exact=True).click();page.screenshot(path=str(OUT/"screens/finals-dark.png"))
  wait_button("导出图包")
  with page.expect_download(timeout=60000) as download:
   wait_button("下载 ZIP")
  path=OUT/"NL27TS01-T10-finals.zip";download.value.save_as(path)
  with zipfile.ZipFile(path) as archive:
   manifest=json.loads(archive.read("manifest.json"));assert len(manifest["images"])==4;assert all(i["width"]>=2000 or i["height"]>=2000 for i in manifest["images"])
  state=snap();costs=state["agent"]["costs"]
  checkpoint.update({"completedAt":time.time(),"durationSeconds":time.time()-checkpoint["startedAt"],"costs":costs,"totalUsd":costs["llmUsd"]+costs["imagesUsd"]+costs["searchUsd"],"errors":errors,"apiErrors":api_errors,"editedAssetId":edited["assets"][0]["id"],"zip":str(path)})
  save(checkpoint);(OUT/"sku-validation.json").write_text(json.dumps(checkpoint,ensure_ascii=False,indent=2),encoding="utf-8")
  print("E2E PASS",flush=True)
 except Exception as e:
  page.screenshot(path=str(OUT/"screens/e2e-stopped.png"));(OUT/"e2e-stopped.txt").write_text(str(e),encoding="utf-8");raise
 finally:
  c.close();b.close()

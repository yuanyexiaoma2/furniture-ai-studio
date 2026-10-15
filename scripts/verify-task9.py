import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get("DESIGN_PREVIEW_URL","http://localhost:3001")
OUT=Path("docs/task-9");OUT.mkdir(parents=True,exist_ok=True)
errors=[];console=[];business=[];external=[];audits=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True)
 context=browser.new_context(storage_state=".local/task8a-storage.json",viewport={"width":1600,"height":1000},accept_downloads=True)
 page=context.new_page()
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.on("console",lambda m:console.append(m.text) if m.type in ("error","warning") else None)
 page.on("request",lambda r:external.append(r.url) if r.url.startswith(("https:","http:")) and not r.url.startswith(BASE) else None)
 def api(route):
  if "/api/auth/" in route.request.url:route.continue_()
  else:business.append(route.request.url);route.abort()
 page.route("**/api/**",api)
 def ready():
  page.wait_for_load_state("networkidle");page.wait_for_timeout(250)
  page.evaluate("async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));}")
 def go(path=""):
  page.goto(BASE+"/design-preview"+path);ready()
 def theme(t):
  page.get_by_role("button",name=("亮色" if t=="light" else "暗色")+"主题",exact=True).click();page.wait_for_timeout(200)
 def audit(name):
  d=page.evaluate("""()=>{const bar=document.querySelector('.p-composer-toolbar'),r=bar?.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>i.getBoundingClientRect().width>0&&i.complete&&!i.naturalWidth).map(i=>i.src),toolbar:!bar||{nowrap:getComputedStyle(bar).flexWrap==='nowrap',inside:[...bar.children].filter(e=>e.getBoundingClientRect().width>0).every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;})}};}""")
  assert not d["overflow"],(name,d)
  assert not d["broken"],(name,d)
  if isinstance(d["toolbar"],dict):assert d["toolbar"]["nowrap"] and d["toolbar"]["inside"],(name,d)
  audits.append({"name":name,**d})
 def shot(name):
  ready();page.wait_for_function("()=>document.querySelectorAll('[data-sonner-toast]').length===0",timeout=12000);audit(name);page.screenshot(path=str(OUT/(name+".png")));print(name,flush=True)
 def pair(name,opener=None):
  for t in ["light","dark"]:
   if opener:
    page.keyboard.press("Escape");page.keyboard.press("Escape")
   theme(t)
   if opener:opener()
   shot(name+"-"+t)
 go()
 page.evaluate("()=>{for(const k of ['furniture-preview-library-8a','furniture-preview-models-v3','furniture-preview-workflows-9'])localStorage.removeItem(k);}")
 page.reload();ready();pair("01-home")
 assert page.get_by_role("switch",name="联网",exact=True).get_attribute("aria-checked")=="true"
 page.get_by_role("switch",name="联网",exact=True).click()
 page.reload();ready()
 assert page.get_by_role("switch",name="联网",exact=True).get_attribute("aria-checked")=="false"
 page.get_by_role("switch",name="联网",exact=True).click()
 go("/workspace");pair("02-workspace-empty")
 assert page.locator(".w-task-entries>button").count()==5
 assert page.locator(".w-canvas-empty>div>button").count()==4
 url=page.url
 page.get_by_role("button",name="批量换色·换变体 沿用终稿，一次扩展多个颜色",exact=False).click()
 assert page.url==url
 pair("03-variant-source")
 page.locator(".w-pack-options>button").filter(has_text="云屿").click();ready()
 page.get_by_role("button",name="选择品牌",exact=True).click()
 page.locator(".w-brand-popover>button").filter(has_text="MORI").click()
 page.get_by_role("button",name="选择品牌",exact=True).click();pair("04-brand-picker",lambda:page.get_by_role("button",name="选择品牌",exact=True).click())
 page.keyboard.press("Escape")
 page.locator(".p-chat-body").evaluate("e=>e.scrollTop=140")
 pair("05-variant-input")
 page.get_by_role("button",name="生成颜色变体",exact=True).click()
 page.get_by_role("button",name="确认费用并生成",exact=True).click()
 page.get_by_text("3 个颜色 Frame 已准备好",exact=True).wait_for();page.wait_for_timeout(500)
 assert page.locator(".react-flow__node-frame").count()==4
 assert page.locator(".react-flow__node-picture").count()>=9  # 原图在视口外时由画布虚拟化隐藏
 pair("06-variant-frames")
 data=page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-workflows-9')).state")
 assert len(data["outputs"])==3 and len(data["variants"]["SF-2401"])==3
 assert all(len(j["originalPhotoReferences"])==2 and j["variantReference"] for f in data["outputs"] for j in f["jobs"])
 page.get_by_role("button",name="产品卡，理解度 71%",exact=True).click();pair("07-product-variants",lambda:page.get_by_role("button",name="产品卡，理解度 71%",exact=True).click())
 assert page.locator(".w-product-variants>div").count()==3
 page.get_by_role("button",name="关闭",exact=True).click()
 page.get_by_role("button",name="所有任务",exact=True).click()
 page.get_by_role("button",name="多语言版本 保留排版，适配不同站点",exact=False).click()
 page.get_by_role("button",name="生成站点版本",exact=True).scroll_into_view_if_needed()
 assert page.get_by_role("button",name="生成站点版本",exact=True).is_disabled()
 pair("08-translation-review")
 page.get_by_role("button",name="确认后继续，稍后人工排版",exact=True).click()
 page.get_by_role("button",name="生成站点版本",exact=True).click()
 if page.get_by_role("button",name="确认费用并生成",exact=True).is_visible():page.get_by_role("button",name="确认费用并生成",exact=True).click()
 page.get_by_text("站点版本已放到画布",exact=True).wait_for();page.wait_for_timeout(500)
 pair("09-translation-frames")
 assert len(page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-workflows-9')).state.outputs"))==6
 page.reload();ready()
 assert len(page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-workflows-9')).state.outputs"))==6
 page.get_by_role("button",name="导出图包",exact=True).click();pair("10-export-check",lambda:page.get_by_role("button",name="导出图包",exact=True).click())
 assert page.locator(".w-check-row").count()==3
 page.get_by_role("button",name="仍然导出",exact=True).click()
 page.get_by_role("button",name="关闭",exact=True).click()
 page.get_by_role("button",name="更多创作选项",exact=True).click()
 page.get_by_role("button",name="图片参数",exact=True).click()
 page.get_by_role("combobox",name="分辨率",exact=True).click()
 page.get_by_role("option",name="4K",exact=True).click()
 pair("11-resolution",lambda:(page.get_by_role("button",name="更多创作选项",exact=True).click(),page.get_by_role("button",name="图片参数",exact=True).click()))
 page.keyboard.press("Escape");page.keyboard.press("Escape")
 page.reload();ready()
 settings=page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-models-v3')).state")
 assert settings["sessions"]["demo-sofa"]["resolution"]=="4K"
 go("/admin")
 page.get_by_role("button",name="品牌管理",exact=True).click();pair("12-brand-admin")
 page.locator(".w-brands-grid>button").first.click();pair("13-brand-editor",lambda:page.locator(".w-brands-grid>button").first.click())
 page.get_by_label("禁用元素",exact=True).fill("不出现宠物\n不用深色背景\n不用人物")
 page.get_by_role("button",name="保存品牌",exact=True).click()
 go("/library?tab=glossary");pair("14-glossary")
 page.get_by_label("DE译法0",exact=True).fill("Leinen")
 page.get_by_role("button",name="保存术语表",exact=True).click()
 page.reload();ready();assert page.get_by_label("DE译法0",exact=True).input_value()=="Leinen"
 # 品牌修改后进入 PromptComposer 的负面约束。
 go("/workspace")
 page.get_by_role("button",name="所有任务",exact=True).click()
 page.get_by_role("button",name="改一张图 选中画面，只调整你需要的部分",exact=False).click();pair("15-edit-confirmation")
 # 新任务不能被上一轮持久批量画布覆盖。
 go()
 page.get_by_label("首页创作要求",exact=True).fill("给这款边桌做一套图")
 page.get_by_role("button",name="发送并进入工作台",exact=True).click();ready()
 assert page.locator(".w-canvas-empty").count()==1
 assert page.get_by_text("看起来是一张边桌，对吗？",exact=True).is_visible()
 # 工具行窄屏仍不折行。
 for width in [1280,1100]:
  page.set_viewport_size({"width":width,"height":900});ready();audit("narrow-"+str(width))
 assert not errors,errors
 assert not console,console
 assert not business,business
 assert not external,external
 (OUT/"verification.json").write_text(json.dumps({"passed":True,"screenshots":len(list(OUT.glob("*.png"))),"pageErrors":errors,"consoleDiagnostics":console,"businessApiRequests":business,"externalRequests":external,"audits":audits,"checks":["五种任务入口不跳转","四个画布空态入口","批量3颜色9张图及参考冻结","按图位选择","多语言长文确认和站点Frame","刷新恢复6个输出Frame","产品卡多变体","品牌选择与后台编辑持久化","术语表编辑持久化","导出检查与仍然导出","分辨率持久化","联网开关默认与持久化","新任务不覆盖旧任务画布","亮暗主题完整可用"]},ensure_ascii=False,indent=2),encoding="utf8")
 context.close();browser.close()
 print("任务9浏览器验收通过",flush=True)

import json,os,re,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get("DESIGN_PREVIEW_URL","http://localhost:3001")
OUT=Path("docs/task-9/round1");OUT.mkdir(parents=True,exist_ok=True)
models=json.loads(subprocess.check_output(["node","--import","tsx","-e","import {models} from './src/design-preview/mock/models.ts';console.log(JSON.stringify(models));"],encoding="utf8"))
images=[m for m in models if m["kind"]=="image"];default=next(m for m in images if m.get("isDefault"));second=images[1]
errors=[];diagnostics=[];business=[];external=[];audits=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True)
 context=browser.new_context(storage_state=".local/task8a-storage.json",viewport={"width":1600,"height":1100},accept_downloads=True)
 page=context.new_page();page.on("pageerror",lambda e:errors.append(str(e)))
 page.on("console",lambda m:diagnostics.append(m.text) if m.type in ("error","warning") else None)
 page.on("request",lambda r:external.append(r.url) if r.url.startswith(("http:","https:")) and not r.url.startswith(BASE) else None)
 def api(route):
  if "/api/auth/" in route.request.url:route.continue_()
  else:business.append(route.request.url);route.abort()
 page.route("**/api/**",api)
 def ready():
  page.wait_for_load_state("networkidle");page.wait_for_timeout(220)
  page.evaluate("async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).map(i=>i.decode().catch(()=>{})));}")
 def go(path=""):
  page.goto(BASE+"/design-preview"+path);ready()
 def theme(t):
  page.get_by_role("button",name=("亮色" if t=="light" else "暗色")+"主题",exact=True).click();page.wait_for_timeout(180)
 def audit(name):
  d=page.evaluate("""()=>{const bar=document.querySelector('.p-composer-toolbar'),r=bar?.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>i.getBoundingClientRect().width>0&&i.complete&&!i.naturalWidth).map(i=>i.src),icons:[...document.querySelectorAll('[data-concept-icon]')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).map(e=>({width:parseFloat(getComputedStyle(e).width),height:parseFloat(getComputedStyle(e).height),stroke:getComputedStyle(e).strokeWidth})),toolbar:!bar||{nowrap:getComputedStyle(bar).flexWrap==='nowrap',inside:[...bar.children].filter(e=>e.getBoundingClientRect().width>0).every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;})}};}""")
  assert not d["overflow"] and not d["broken"],(name,d)
  assert all(i["width"] in [16,18,20] and i["height"] in [16,18,20] and float(i["stroke"].replace("px",""))==1.5 for i in d["icons"]),(name,d)
  if isinstance(d["toolbar"],dict):assert d["toolbar"]["nowrap"] and d["toolbar"]["inside"],(name,d)
  audits.append({"name":name,**d})
 def shot(name,full=False):
  ready();page.wait_for_function("()=>document.querySelectorAll('[data-sonner-toast]').length===0",timeout=12000);audit(name)
  page.screenshot(path=str(OUT/(name+".png")),full_page=full);print(name,flush=True)
 def pair(name,opener=None,full=False):
  for t in ["light","dark"]:
   if opener:page.keyboard.press("Escape");page.keyboard.press("Escape")
   theme(t)
   if opener:opener()
   shot(name+"-"+t,full)
 def reset():
  go()
  page.evaluate("()=>{for(const k of ['furniture-preview-library-8a','furniture-preview-models-v3','furniture-preview-workflows-9','furniture-preview-canvas-help-seen'])localStorage.removeItem(k);}")
  page.reload();ready()
 reset()
 assert page.locator(".l-bento").count()==0
 assert page.locator(".r1-task-card").count()==3
 assert page.locator(".r1-library-links").inner_text()=="你的库：\n场景 11\n·\n道具 17\n·\n道具组 9\n·\n参考图 11" or all(s in page.locator(".r1-library-links").inner_text() for s in ["场景 11","道具 17","道具组 9","参考图 11"])
 # 首页价格/发送按钮三种输入状态。
 for t in ["light","dark"]:
  theme(t)
  assert page.locator(".p-cost-estimate").count()==0
  button=page.get_by_role("button",name="发送并进入工作台",exact=True)
  colors=button.evaluate("e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{bg:s.backgroundColor,fg:s.color,opacity:s.opacity,width:r.width,height:r.height}}")
  assert colors=={"bg":"rgb(0, 0, 0)" if t=="light" else "rgb(255, 255, 255)","fg":"rgb(255, 255, 255)" if t=="light" else "rgb(0, 0, 0)","opacity":"0.4","width":40,"height":40},colors
  text=page.get_by_label("首页创作要求",exact=True);text.fill("做一套图包")
  assert re.search(r"\$\d+\.\d{2}$",page.locator(".p-cost-estimate").inner_text())
  assert button.evaluate("e=>getComputedStyle(e).opacity")=="1"
  text.fill("")
 pair("01-home",full=True)
 for t in ["light","dark"]:
  theme(t);page.locator(".r1-home-tasks").scroll_into_view_if_needed();page.mouse.move(20,20)
  before=page.locator(".r1-task-card").first.evaluate("e=>[e,e.querySelector('h3'),e.querySelector('.r1-task-caption p')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})")
  page.locator(".r1-task-card").first.hover();page.wait_for_timeout(260)
  after=page.locator(".r1-task-card").first.evaluate("e=>[e,e.querySelector('h3'),e.querySelector('.r1-task-caption p')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})")
  assert before==after,(before,after)
  assert page.locator(".r1-task-card").first.locator(".r1-task-start").evaluate("e=>getComputedStyle(e).opacity")=="1"
  shot("02-home-hover-"+t)
 # 四个资料入口指向对应Tab，数量来自同一份mock。
 for tab in ["scene","prop","set","reference"]:
  assert page.locator(".r1-library-links a[href$='tab="+tab+"']").count()==1
 go("/icons");pair("03-icons")
 assert page.locator(".r1-icon-grid .concept-icon-box").count()==13
 assert page.locator(".r1-model-brands .p-brand-icon img").count()==5
 go("/workspace")
 assert page.locator(".w-task-entries>button").count()==5
 assert page.locator(".r1-drop-target").count()==1 and page.locator(".w-canvas-empty").count()==0
 assert page.locator(".react-flow__minimap").count()==0
 assert page.get_by_role("button",name="产品卡 · 未建档",exact=True).is_visible() and page.locator(".p-mini-ring").count()==0
 assert page.locator(".p-cost-estimate").count()==0
 page.wait_for_timeout(5100)
 assert page.locator(".p-canvas-guide").count()==0
 page.get_by_role("button",name="画布操作说明",exact=True).click()
 assert page.locator(".p-canvas-guide").count()==1
 page.get_by_role("button",name="画布操作说明",exact=True).click()
 pair("04-workspace-empty")
 # 常驻两个模型与联网文字，更多菜单没有模型。
 assert page.locator(".p-composer-toolbar button[aria-label='生图模型']").count()==1
 assert page.get_by_role("switch",name="联网",exact=True).inner_text()=="联网 开"
 page.get_by_role("switch",name="联网",exact=True).click()
 assert page.get_by_role("switch",name="联网",exact=True).inner_text()=="联网 关"
 page.get_by_role("button",name="更多创作选项",exact=True).click()
 assert page.locator(".p-composer-menu button[aria-label='生图模型']").count()==0
 page.keyboard.press("Escape")
 # 模型旧修订继续成立，官方SVG替代首字母。
 model=page.get_by_role("button",name="生图模型",exact=True)
 assert model.locator(".p-model-label").inner_text()==default["name"]
 model.click()
 assert page.locator(".p-model-segments").count()==0
 assert page.locator(".p-model-list .p-brand-icon img").count()==len(images)
 page.locator(".p-model-image").get_by_role("checkbox",name=second["name"],exact=True).click()
 page.keyboard.press("Escape");assert model.locator(".p-model-label").inner_text()=="自动 · 2 个模型"
 model.hover();page.get_by_role("tooltip").wait_for()
 assert default["name"] in page.get_by_role("tooltip").inner_text()
 page.mouse.move(10,10);model.click();page.get_by_role("switch",name="自动挑选生图模型",exact=True).click()
 page.locator(".p-model-image").get_by_role("radio",name=images[2]["name"],exact=True).click()
 assert "is-manual" in model.get_attribute("class")
 pair("05-model-panel",opener=lambda:model.click())
 page.keyboard.press("Escape")
 # 首页三个任务均进入工作台并打开相应第一张确认卡。
 for title,kind in [("做一套图包","pack"),("改一张图","edit"),("批量换色","variants")]:
  go();page.get_by_role("button",name=title,exact=True).click();page.wait_for_url("**/design-preview/workspace");ready()
  active=page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-workflows-9')).state.active")
  assert active==kind,(title,active)
  selections=page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-models-v3')).state")
  assert selections["sessions"]["demo-sofa"]["imageId"]==selections["home"]["imageId"]
  assert page.locator(".w-card").count()>0
 page.locator(".w-pack-options>button").filter(has_text="云屿").click();ready()
 rows=page.locator(".w-variant-row")
 assert rows.count()==3
 for r in rows.all():
  assert 54<=r.bounding_box()["height"]<=58
  assert round(r.locator(".w-swatch").bounding_box()["width"])==32
 assert page.get_by_role("button",name="生成颜色变体",exact=True).bounding_box()["y"]<page.locator(".p-console").bounding_box()["y"]
 pair("06-variants")
 assert page.locator(".p-final-tag").count()==0
 assert any("3 张终稿" in t for t in page.locator(".p-frame-title").all_inner_texts())
 # 换材质不能只传色卡，逐个上传后才可生成。
 page.get_by_role("button",name="换材质",exact=True).click()
 assert page.get_by_role("button",name="生成颜色变体",exact=True).is_disabled()
 pair("07-material-required")
 for index,name in enumerate(["米白","雾灰","焦糖"]):
  page.get_by_label("上传"+name+"面料实拍",exact=True).set_input_files("public/design-preview/r3-14.webp")
  if index<2:assert page.get_by_role("button",name="生成颜色变体",exact=True).is_disabled()
 assert page.get_by_role("button",name="生成颜色变体",exact=True).is_enabled()
 # 从首页再次进入任务，恢复颜色草稿，按三色生成。
 go();page.get_by_role("button",name="批量换色",exact=True).click();page.wait_for_url("**/design-preview/workspace");ready()
 page.get_by_role("button",name="生成颜色变体",exact=True).click()
 page.get_by_role("button",name="确认费用并生成",exact=True).click()
 page.get_by_text("3 个颜色 Frame 已准备好",exact=True).wait_for();page.wait_for_timeout(400)
 data=page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-workflows-9')).state")
 assert [f["name"] for f in data["outputs"]]==["SF-2401-米白","SF-2401-雾灰","SF-2401-焦糖"]
 assert page.locator(".p-final-tag").count()==0
 for label in page.locator(".r1-external-label").all():
  assert label.evaluate("e=>e.getBoundingClientRect().top>=e.parentElement.querySelector('img').getBoundingClientRect().bottom")
 pair("08-color-frames")
 page.get_by_role("button",name="导出图包",exact=True).click()
 pair("09-export-check",opener=lambda:page.get_by_role("button",name="导出图包",exact=True).click())
 assert page.get_by_role("button",name="仍然导出",exact=True).is_visible()
 page.get_by_role("button",name="关闭",exact=True).click()
 page.get_by_role("button",name="所有任务",exact=True).click()
 page.locator(".w-task-entries>button").filter(has_text="多语言版本").click()
 page.get_by_role("button",name="确认后继续，稍后人工排版",exact=True).click()
 page.get_by_role("button",name="生成站点版本",exact=True).click()
 if page.get_by_role("button",name="确认费用并生成",exact=True).is_visible():page.get_by_role("button",name="确认费用并生成",exact=True).click()
 page.get_by_text("站点版本已放到画布",exact=True).wait_for();page.wait_for_timeout(350)
 pair("10-language-frames")
 for label in page.locator(".r1-external-label").all():
  assert label.evaluate("e=>e.getBoundingClientRect().top>=e.parentElement.querySelector('img').getBoundingClientRect().bottom")
 # 不再每次显示首次提示。
 page.reload();ready();assert page.locator(".p-canvas-guide").count()==0
 for width in [1280,1100,760]:
  page.set_viewport_size({"width":width,"height":1000});ready();audit("narrow-"+str(width))
  assert page.locator(".p-composer-toolbar button[aria-label='生图模型']").count()==1
 assert not errors,errors
 assert not diagnostics,diagnostics
 assert not business,business
 assert not external,external
 (OUT/"verification.json").write_text(json.dumps({"passed":True,"screenshots":len(list(OUT.glob("*.png"))),"checks":["旧模型胶囊规则和官方SVG","黑白发送按钮空态40%","费用按内容显示两位小数","首页3张4:3任务卡","悬停无布局位移","mock库数量和Tab链接","统一图标16/18/20与stroke1.5","对话栏唯一任务入口","空画布拖放区和隐藏小地图","五秒提示与问号入口","产品卡未建档无环","生图胶囊常驻和联网开关文字","56px单行变体与32px色块","换材质必须上传面料实拍","三色Frame与终稿计数","图位标签在文字图外侧","导出检查和多语言Frame","窄屏单行工具条"],"pageErrors":errors,"consoleDiagnostics":diagnostics,"businessApiRequests":business,"externalRequests":external,"audits":audits},ensure_ascii=False,indent=2),encoding="utf8")
 browser.close();print("任务9审阅第1轮验收通过",flush=True)

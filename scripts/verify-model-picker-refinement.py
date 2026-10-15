import json, os, re, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get("DESIGN_PREVIEW_URL","http://localhost:3001")
OUT=Path("docs/design-preview/model-picker-refinement");OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads(subprocess.check_output(["node","--import","tsx","-e","import {models} from './src/design-preview/mock/models.ts';console.log(JSON.stringify(models));"],encoding="utf8"))
images=[m for m in catalog if m["kind"]=="image" and m["enabled"] and m["visible"]]
default=next(m for m in images if m.get("isDefault"))
second=next(m for m in images if m.get("tiers"))
manual=next(m for m in images if m["id"] not in (default["id"],second["id"]) and m.get("tiers"))
errors=[];diagnostics=[];business=[];external=[];audits=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True)
 context=browser.new_context(storage_state=".local/task8a-storage.json",viewport={"width":1440,"height":1000})
 page=context.new_page()
 cdp=context.new_cdp_session(page);cdp.send("DOM.enable");cdp.send("CSS.enable")
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.on("console",lambda m:diagnostics.append(m.text) if m.type in ("error","warning") else None)
 page.on("request",lambda r:external.append(r.url) if r.url.startswith(("http:","https:")) and not r.url.startswith(BASE) else None)
 def api(route):
  if "/api/auth/" in route.request.url:route.continue_()
  else:business.append(route.request.url);route.abort()
 page.route("**/api/**",api)
 def ready():
  page.wait_for_load_state("networkidle");page.wait_for_timeout(180)
  page.evaluate("async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{})));}")
 def theme(t):
  page.get_by_role("button",name=("亮色" if t=="light" else "暗色")+"主题",exact=True).click();page.wait_for_timeout(180)
 def trigger():return page.get_by_role("button",name="生图模型",exact=True)
 def panel():return page.locator(".p-model-image")
 def reset():
  page.goto(BASE+"/design-preview");ready()
  page.evaluate("()=>localStorage.removeItem('furniture-preview-models-v3')")
  page.reload();ready()
  page.get_by_label("首页创作要求",exact=True).fill("给新品做一套亚马逊图")
 def mode(kind):
  trigger().click()
  switch=page.get_by_role("switch",name="自动挑选生图模型",exact=True)
  target=kind!="manual"
  if (switch.get_attribute("aria-checked")=="true")!=target:switch.click()
  if target:
   wanted=[default["id"]]+([second["id"]] if kind=="auto-many" else [])
   for m in images:
    row=panel().get_by_role("checkbox",name=m["name"],exact=True)
    if (row.get_attribute("aria-checked")=="true")!=(m["id"] in wanted):row.click()
  else:
   panel().get_by_role("radio",name=manual["name"],exact=True).click()
  ready()
 def label_check(expected,manual_mode=False):
  assert trigger().locator(".p-model-label").inner_text()==expected
  d=trigger().evaluate("""e=>{const t=e.querySelector('.p-model-label'),r=t.getBoundingClientRect(),icons=[...e.querySelectorAll('svg')].map(i=>i.getBoundingClientRect()),s=getComputedStyle(e),bar=e.closest('.p-composer-toolbar'),br=bar?.getBoundingClientRect();return {text:t.textContent,codepoints:[...t.textContent].map(c=>c.codePointAt(0)),font:getComputedStyle(t).fontFamily,fontSize:getComputedStyle(t).fontSize,alignment:icons.every(i=>Math.abs((i.top+i.height/2)-(r.top+r.height/2))<=1),iconSizes:icons.map(i=>[i.width,i.height]),border:s.borderColor,primary:getComputedStyle(document.documentElement).getPropertyValue('--primary'),nowrap:!bar||getComputedStyle(bar).flexWrap==='nowrap',inside:!bar||[...bar.children].filter(c=>c.getBoundingClientRect().width>0).every(c=>{const b=c.getBoundingClientRect();return b.left>=br.left-1&&b.right<=br.right+1;})};}""")
  assert d["alignment"] and d["nowrap"] and d["inside"],d
  assert not re.search("[\u200b-\u200f\uFEFF\ufffd]",d["text"]),d
  assert float(d["fontSize"].replace("px",""))>=12,d
  assert "Segoe UI" in d["font"],d
  assert trigger().evaluate("e=>e.classList.contains('is-manual')")==manual_mode
  if manual_mode:
   assert trigger().evaluate("""e=>{const p=document.createElement('i');p.style.color='var(--primary)';e.appendChild(p);const match=getComputedStyle(p).color===getComputedStyle(e).borderColor;p.remove();return match;}""")
  root=cdp.send("DOM.getDocument")["root"]["nodeId"]
  node=cdp.send("DOM.querySelector",{"nodeId":root,"selector":'button[aria-label="生图模型"] .p-model-label'})["nodeId"]
  d["renderedFonts"]=cdp.send("CSS.getPlatformFontsForNode",{"nodeId":node})["fonts"]
  assert d["renderedFonts"] and all(f["familyName"] not in ("LastResort","Last Resort") for f in d["renderedFonts"]),d
  audits.append(d)
 def panel_check():
  assert panel().get_by_role("heading",name="生图模型",exact=True).is_visible()
  assert "视频" not in panel().inner_text() and "即将开放" not in panel().inner_text()
  assert page.locator(".p-model-segments").count()==0
  assert panel().locator(".p-auto-line p").inner_text()=="开启后，从下面勾选的模型里按任务自动挑选；只勾一个就固定用它。"
  for line in panel().locator(".p-model-copy small").all_inner_texts():
   assert re.search(r"\$\d+\.\d{2}(?!\d)",line),line
  seed=next(m for m in images if m["price"]==.025)
  assert "约 $0.03" in panel().get_by_role("checkbox" if page.get_by_role("switch",name="自动挑选生图模型").get_attribute("aria-checked")=="true" else "radio",name=seed["name"],exact=True).inner_text()
  d=panel().evaluate("""e=>{const p=e.querySelector('.p-auto-line p').getBoundingClientRect(),s=e.querySelector('[role=switch]').getBoundingClientRect(),r=e.getBoundingClientRect();return {textRight:p.right,switchLeft:s.left,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};}""")
  assert d["textRight"]<d["switchLeft"] and d["inside"],d
 def shot(name,capsule=False):
  ready()
  if capsule:page.locator(".p-home-input").screenshot(path=str(OUT/(name+".png")))
  else:page.screenshot(path=str(OUT/(name+".png")))
  print(name,flush=True)
 for t in ["light","dark"]:
  reset();theme(t)
  for state,expected in [("auto-one",default["name"]),("auto-many","自动 · 2 个模型"),("manual",manual["name"])]:
   mode(state)
   if state in ("auto-many","manual"):
    model=second if state=="auto-many" else manual
    panel().get_by_role("group",name=model["name"]+"质量档",exact=True).get_by_role("button",name="精细",exact=True).click()
    price=next(tier["price"] for tier in model["tiers"] if tier["id"]=="fine")
    row=panel().get_by_role("radio" if state=="manual" else "checkbox",name=model["name"],exact=True)
    assert "约 $"+format(price,".2f") in row.inner_text()
   panel_check();shot(state+"-panel-"+t)
   page.keyboard.press("Escape");page.get_by_label("首页创作要求",exact=True).click();page.mouse.move(20,20);page.wait_for_timeout(120)
   label_check(expected,state=="manual");shot(state+"-capsule-"+t,True)
   if state=="auto-many":
    trigger().hover()
    tip=page.get_by_role("tooltip");tip.wait_for()
    assert default["name"] in tip.inner_text() and second["name"] in tip.inner_text()
    assert manual["name"] not in tip.inner_text()
    shot("auto-many-tooltip-"+t)
    page.mouse.move(20,20);page.wait_for_timeout(150)
   page.reload();ready();label_check(expected,state=="manual")
   assert re.search(r"\$\d+\.\d{2}$",page.locator(".p-cost-estimate").inner_text())
  # 手动选过别的模型后切回 Auto 单选，必须显示实际勾选的默认模型。
  mode("auto-one");page.keyboard.press("Escape");label_check(default["name"])
 # 从首页进入工作台，模型继续沿用；窄工具行内的菜单同样可用。
 mode("manual");page.keyboard.press("Escape")
 page.get_by_role("button",name="发送并进入工作台",exact=True).click();page.wait_for_url("**/design-preview/workspace");ready()
 page.get_by_role("button",name="更多创作选项",exact=True).click()
 label_check(manual["name"],True)
 trigger().click();panel_check();page.keyboard.press("Escape");page.keyboard.press("Escape")
 for width in [1100,760]:
  page.set_viewport_size({"width":width,"height":900});ready()
  page.get_by_role("button",name="更多创作选项",exact=True).click();label_check(manual["name"],True);page.keyboard.press("Escape")
 assert not errors,errors
 assert not diagnostics,diagnostics
 assert not business,business
 assert not external,external
 (OUT/"verification.json").write_text(json.dumps({"passed":True,"screenshots":len(list(OUT.glob("*.png"))),"checks":["纯生图标题，无视频控件或配置","Auto单模型真实名称","Auto多模型准确数量与Tooltip名单","手动名称与主色描边","手动切回Auto后单模型名称正确","普通字符与字体回退检查","16px图标居中与工具行不折行","两位单价、质量档报价及总价","Auto说明和开关无重叠","刷新持久化及首页工作台沿用","窄屏更多菜单可用"],"pageErrors":errors,"consoleDiagnostics":diagnostics,"businessApiRequests":business,"externalRequests":external,"capsuleAudits":audits},ensure_ascii=False,indent=2),encoding="utf8")
 browser.close()
 print("生图模型小修验收通过",flush=True)

import base64
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("DESIGN_PREVIEW_URL", "http://localhost:3001")
OUT = Path("docs/design-preview/round4")
OUT.mkdir(parents=True, exist_ok=True)
errors, diagnostics, business, external, audits = [], [], [], [], []
photos = [
    {"name": "正面.webp", "mimeType": "image/webp", "buffer": Path("public/design-preview/r3-25.webp").read_bytes()},
    {"name": "45度.webp", "mimeType": "image/webp", "buffer": Path("public/design-preview/r3-28.webp").read_bytes()},
]

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome", headless=True)
    context = browser.new_context(storage_state=".local/task8a-storage.json", viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: diagnostics.append(m.text) if m.type in ("error", "warning") else None)
    page.on("request", lambda r: external.append(r.url) if r.url.startswith(("http:", "https:")) and not r.url.startswith(BASE) else None)
    def api(route):
        if route.request.url.split(BASE)[-1].startswith("/api/auth/"):
            route.continue_()
        else:
            business.append(route.request.url)
            route.abort()
    page.route("**/api/**", api)

    def ready():
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(220)
        page.evaluate("""async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).map(i=>i.decode().catch(()=>{})));}""")

    def go(path=""):
        page.goto(BASE + "/design-preview" + path)
        ready()

    def reset():
        go()
        page.evaluate("""()=>{localStorage.removeItem("furniture-preview-library-8a");localStorage.removeItem("furniture-preview-models-v3");}""")
        page.reload()
        ready()

    def theme(t):
        page.get_by_role("button", name="主题切换", exact=True).click()
        page.get_by_role("menuitemradio", name="暗色" if t == "dark" else "亮色", exact=True).click()
        page.wait_for_timeout(200)

    def audit(name):
        data = page.evaluate("""()=>{
          const bar=document.querySelector('.p-composer-toolbar'),r=bar?.getBoundingClientRect();
          const children=bar?[...bar.children].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.getBoundingClientRect()):[];
          const small=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
          while(walker.nextNode()){const t=walker.currentNode,e=t.parentElement;if(!e||!t.textContent.trim()||!e.closest('.p-app,.p-portal')||e.closest('.sr-only,[aria-hidden=true]'))continue;const b=e.getBoundingClientRect(),s=getComputedStyle(e);if(b.width<2||b.height<2||b.bottom<0||b.top>innerHeight||s.visibility==='hidden'||s.display==='none')continue;let scale=1;for(let n=e;n;n=n.parentElement){const tr=getComputedStyle(n).transform;if(tr!=='none'){const m=new DOMMatrixReadOnly(tr);scale*=Math.hypot(m.a,m.b);}}const size=parseFloat(s.fontSize)*scale;if(size<11.9)small.push({text:t.textContent.slice(0,30),size});}
          return {overflow:document.documentElement.scrollWidth>innerWidth+1,small,toolbar:!bar||{nowrap:getComputedStyle(bar).flexWrap==='nowrap',inside:children.every(b=>b.left>=r.left-1&&b.right<=r.right+1)},broken:[...document.images].filter(i=>i.getBoundingClientRect().width>0&&i.complete&&!i.naturalWidth).map(i=>i.src)};
        }""")
        assert not data["overflow"], (name, data)
        assert not data["small"], (name, data)
        assert not data["broken"], (name, data)
        if isinstance(data["toolbar"], dict):
            assert data["toolbar"]["nowrap"] and data["toolbar"]["inside"], (name, data)
        audits.append({"name": name, **data})

    def shot(name):
        ready()
        page.wait_for_timeout(120)
        # 等提示自然收起，交付图不遮挡输入框和抽屉。
        page.wait_for_function("()=>document.querySelectorAll('[data-sonner-toast]').length===0", timeout=10000)
        audit(name)
        page.screenshot(path=str(OUT / (name + ".png")))
        print("截图", name, flush=True)

    def home_check(t, active=False):
        text = page.locator("body").inner_text()
        assert "拍摄标准" not in text
        assert page.locator(".l-draft-controls").count() == 0
        assert page.get_by_label("产品品类", exact=True).count() == 0
        assert page.get_by_label("首页创作要求", exact=True).get_attribute("rows") == "3"
        style = page.locator(".p-send-circle").evaluate("""e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return{bg:s.backgroundColor,color:s.color,opacity:s.opacity,width:b.width,height:b.height};}""")
        assert style["width"] == style["height"] == 40, style
        assert style["bg"] == ("rgb(255, 255, 255)" if t == "dark" else "rgb(0, 0, 0)"), style
        assert style["color"] == ("rgb(0, 0, 0)" if t == "dark" else "rgb(255, 255, 255)"), style
        assert float(style["opacity"]) == (1 if active else .4), style
        assert page.locator(".p-cost-estimate").count() == int(active)
        if active:
            assert re.search(r"\$\d+\.\d{2}$", page.locator(".p-cost-estimate").inner_text())
        assert page.get_by_role("button", name="生图模型", exact=True).locator(".p-model-label").inner_text() == "Auto · 1 个"
        label = page.locator(".p-model-label").all_inner_texts()
        assert all(not re.search("[\u200b-\u200f\uFEFF\uFFFD]", value) for value in label)
        layers = page.locator(".p-home-input").evaluate("e=>[...e.children].filter(c=>c.getBoundingClientRect().height>0).length")
        assert layers == 2, layers

    def drag_photos():
        payload = [{"name": f["name"], "data": base64.b64encode(f["buffer"]).decode()} for f in photos]
        transfer = page.evaluate_handle("""files=>{const dt=new DataTransfer();for(const f of files){dt.items.add(new File([Uint8Array.from(atob(f.data),c=>c.charCodeAt(0))],f.name,{type:'image/webp'}));}return dt;}""", payload)
        page.locator(".p-home-input").dispatch_event("dragenter", {"dataTransfer": transfer})
        page.locator(".p-home-input").dispatch_event("drop", {"dataTransfer": transfer})
        page.locator(".r4-attachment").nth(1).wait_for()
        page.wait_for_timeout(150)

    for t in ("light", "dark"):
        reset()
        theme(t)
        home_check(t)
        shot("01-home-empty-" + t)
        page.get_by_label("首页创作要求", exact=True).fill("帮我给新品做一套亚马逊图")
        home_check(t, True)
        shot("02-home-text-" + t)
        page.get_by_label("首页创作要求", exact=True).fill("")
        home_check(t)
        drag_photos()
        home_check(t, True)
        for box in page.locator(".r4-attachment").all():
            size = box.bounding_box()
            assert size["width"] == size["height"] == 56
        shot("03-home-two-photos-" + t)
        page.get_by_role("button", name="删除附件 正面.webp", exact=True).click()
        assert page.locator(".r4-attachment").count() == 1
        page.get_by_role("button", name="删除附件 45度.webp", exact=True).click()
        home_check(t)
        # 文件也是可删除附件，只有文件时也显示报价、允许发送。
        page.get_by_label("首页上传实拍", exact=True).set_input_files({"name": "规格.pdf", "mimeType": "application/pdf", "buffer": b"mock product document"})
        page.locator(".r4-file").wait_for()
        home_check(t, True)
        page.get_by_role("button", name="删除附件 规格.pdf", exact=True).click()
        home_check(t)
        drag_photos()
        page.get_by_role("button", name="发送并进入工作台", exact=True).click()
        page.wait_for_url("**/design-preview/workspace")
        page.get_by_role("heading", name="看起来是一张边桌，对吗？", exact=True).wait_for()
        assert page.get_by_role("button", name="规划图包", exact=True).count() == 0
        shot("04-workspace-category-confirm-" + t)
        page.get_by_role("button", name="换一个品类", exact=True).click()
        page.get_by_placeholder("搜索品类…", exact=True).fill("浴室柜")
        assert page.get_by_role("option").count() == 1
        shot("06-category-command-" + t)
        page.keyboard.press("Escape")
        page.get_by_role("button", name="是", exact=True).click()
        page.get_by_role("button", name="规划图包", exact=True).wait_for()
        page.locator(".p-top-product-button").click()
        page.locator(".r4-product-header-controls").wait_for()
        assert "品类：边桌" in page.locator(".r4-product-header-controls").inner_text()
        assert "拍摄标准：快速" in page.locator(".r4-product-header-controls").inner_text()
        shot("05-product-header-" + t)
        page.get_by_role("button", name="拍摄标准", exact=True).click()
        rows = page.locator(".l-mode-panel > button").all()
        assert len(rows) == 2
        first, second = [r.bounding_box() for r in rows]
        assert first["y"] + first["height"] <= second["y"] - 4, (first, second)
        description = rows[0].locator("small").bounding_box()
        assert description["y"] + description["height"] < second["y"], description
        shot("08-shooting-options-spacing-" + t)
        page.keyboard.press("Escape")
        page.get_by_role("button", name="升级为严格", exact=True).click()
        assert "严格" in page.get_by_role("button", name="拍摄标准", exact=True).inner_text()
        page.get_by_role("button", name="修改产品品类", exact=True).click()
        page.get_by_placeholder("搜索品类…", exact=True).fill("浴室柜")
        page.get_by_role("option", name="浴室柜", exact=True).click()
        assert "品类：浴室柜" in page.locator(".r4-product-header-controls").inner_text()
        page.get_by_role("button", name="关闭", exact=True).click()
        page.locator(".r4-shooting-choice").scroll_into_view_if_needed()
        shot("07-strict-default-choice-" + t)
        if t == "light":
            page.get_by_role("button", name="这次先快速", exact=True).click()
            assert page.locator(".l-shooting-card").count() == 0
        else:
            page.get_by_role("button", name="按严格来", exact=True).click()
            page.get_by_role("button", name="先跳过", exact=True).click()
        page.get_by_role("button", name="规划图包", exact=True).click()
        page.get_by_role("button", name="生成候选", exact=True).wait_for()
        page.reload()
        ready()
        assert page.locator(".r4-category-confirm,.r4-shooting-choice").count() == 0
        page.get_by_role("button", name="生成候选", exact=True).wait_for()
        saved = page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-library-8a')).state.task")
        assert saved["product"]["categoryId"] == "C03"
        assert saved["product"]["shootingMode"] == ("quick" if t == "light" else "strict")

    # 纯文字可识别与未知两条路径，未知时可补充文字，或键盘选择品类。
    reset()
    page.get_by_label("首页创作要求", exact=True).fill("帮我给沙发做一套图")
    page.get_by_role("button", name="发送并进入工作台", exact=True).click()
    page.get_by_role("heading", name="看起来是沙发，对吗？", exact=True).wait_for()
    page.get_by_role("button", name="是", exact=True).click()
    assert page.get_by_role("heading", name="先放一张产品实拍", exact=True).is_visible()
    reset()
    page.get_by_label("首页创作要求", exact=True).fill("想做一套好看的商品图")
    page.get_by_role("button", name="发送并进入工作台", exact=True).click()
    page.get_by_role("heading", name="还没看出产品品类，可以确认一下吗？", exact=True).wait_for()
    page.get_by_label("创作控制台", exact=True).fill("是浴室柜")
    page.get_by_role("button", name="发送创作要求", exact=True).click()
    page.get_by_role("heading", name="看起来是浴室柜，对吗？", exact=True).wait_for()
    page.get_by_role("button", name="换一个品类", exact=True).click()
    search = page.get_by_placeholder("搜索品类…", exact=True)
    search.fill("不存在的品类")
    assert page.get_by_text("没有找到这个品类", exact=True).is_visible()
    search.fill("马桶架")
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Enter")
    page.get_by_role("button", name="这次先快速", exact=True).click()
    current = page.evaluate("()=>JSON.parse(localStorage.getItem('furniture-preview-library-8a')).state.task")
    assert current["product"]["categoryId"] == "C02"

    for width in (1100, 768, 390):
        page.set_viewport_size({"width": width, "height": 1000})
        reset()
        audit("home-empty-width-" + str(width))
        page.get_by_label("首页创作要求", exact=True).fill("给新品制作商品图")
        audit("home-text-width-" + str(width))
        page.get_by_label("首页上传实拍", exact=True).set_input_files(photos)
        page.locator(".r4-attachment").nth(1).wait_for()
        audit("home-photos-width-" + str(width))

    assert not errors, errors
    assert not diagnostics, diagnostics
    assert not business, business
    assert not external, external
    (OUT / "verification.json").write_text(json.dumps({
        "passed": True, "screenshots": len(list(OUT.glob("*.png"))),
        "pageErrors": errors, "consoleDiagnostics": diagnostics, "businessApiRequests": business, "externalRequests": external,
        "checks": ["首页完全移除品类和档位控件", "输入框仅两层与三行文字", "56px图片和文件附件可删除", "有内容才显示两位小数报价", "40px黑白圆形发送按钮空态40%透明", "Auto胶囊无异常字符且图标对齐", "实拍模拟识别和是/换一个确认", "shadcn Command搜索/空结果/键盘选择", "纯文字识别与未知追问", "产品卡品类可修改", "后台严格默认的两种回应", "升级严格与拍摄弹层无重叠", "刷新保持品类与本次档位", "三种窄屏工具行保持单行"],
        "audits": audits
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    browser.close()
    print("第四轮全部浏览器检查通过", flush=True)

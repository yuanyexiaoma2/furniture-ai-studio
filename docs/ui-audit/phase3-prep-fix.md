# 阶段3准备修正 · ui(phase3-prep-fix)

本轮将两条补充要求合并成一个准备修正提交；先列本组变化，再列3a状态。未推送，不调用付费模型，不修改费用、预留、账本、队列或双网关。鉴权协议、会话和退出逻辑未改。

## 一、本组修正变化

### A. 暗色、首页输入和任务卡

- 暗色背景/画布141416，面板/卡片1b1b1e，浮层/弹层222226；主文字ececee，辅助文字仍a1a1aa。新旧页面共用这组层级，暗色主按钮仍白色，不改为绿色。
- 装饰分隔border改为白8%；创作顶栏底边透明，改用面板/页面层级区分。暗色首页和对话输入底色222226、静止细线白10%，聚焦为2px实线ring（6c907d）；静止线是用户明确授权的装饰例外，不套用输入外框3:1，但文字与实际聚焦描边仍严格检查。该例外只匹配暗色p-home-input/p-chat-input，不豁免登录、模板库或蒙版输入。
- 首页输入与任务区共同采用min(100%,clamp(720px,52vw,960px))：1440下748.80px，2560下960px，390下354px。textarea最低120px、文字/placeholder16px、内边距20px 24px。Tab角标删除，Tab补全键盘功能保留；快捷意图标签按用户批准提前移除，其余3c未做。下方提示只留一行。
- 首页去掉米黄径向渐变及噪点层，背景与SKU页相同。去掉最底部孤立分隔线。
- 任务卡删除矩形文案底衬与局部黑标签底色，只留一层铺满卡片的透明→黑72%渐变（38%位置达到72%，保证上排小字可读）。实际两张任务卡以两列铺满共同内容轴。小标签提升到遮罩上方，改图前/后标签移至遮罩可读区域。整套图包卡使用已有实拍作底图，替代下方空白灰底；没有新增图片或改动原图。暗色图片brightness(.88)，悬停恢复1。
- 1440×900静止首屏：标题区顶部162px（18vh），输入框到选择任务64.80px，任务卡顶部661.09px，露出87.42%，超过上半张要求。2560×1440标题区顶部259.19px，输入与任务区左边缘均800px。

### B. 全局、SKU、模板库和登录页追加

- 新增content-max-list=1200px，SKU和模板库共用；content-max-home=960px，首页输入/任务共用。安全边距桌面24px、手机18px。登录两列保留原结构，手机表单边缘也改为18px；坐标逐项见下表。
- 亮色input改8b8b94，白底及现有输入表面保持≥3:1；普通暗色输入仍71717a。首页复合区、模板库和登录均有实测2px ring聚焦描边。
- SKU封面4:3、10px圆角、图片块级绝对定位；场景cover，四角确认白底的图片contain，余白为muted纯色，无CSS棋盘、模糊或马赛克。悬停只缩放图片1.02，卡片坐标/尺寸不变；各行封面顶部与标题首行基线按像素取整一致，原始小数最大差约0.016px，未用整体上移制造悬停。
- 封面优先使用当前图包中美工已选main图；没有主图时用sortOrder/createdAt排序后的首张实拍。为此只读GET /api/studio补充slotType并固定照片顺序；没有改生成提交或数据库数据。未裁剪或覆写商品原图。
- 模板库原input仍是multiple+webkitdirectory，仅隐藏浏览器原生外观，用“选择文件夹”按钮触发；文件名在旁显示，溢出截断且title可看全名。原input没有accept属性（实测null），继续保留这一事实及原服务端限制，没有自行新增或放宽文件类型。上传/解析/审核行为沿用原逻辑。
- 所有经验库summary使用统一ChevronRight，展开90°；仍为原生details/summary，Enter/Space可开合。标题eyebrow到h1间距4px、h1到说明8px，导入卡片padding24px；h1原有20px/500字号字重保留，不额外放大。
- 登录左右主标题600/foreground；删除“工作台·第一阶段”，移除art-plinth/art-floor斜线元素，插画置于左文案下方并左对齐。名称和Logo未改。
- 登录按钮源码原本仅pending时禁用，并未按空字段禁用。本轮明确保持空字段下主色、opacity1且可点击，提交空/非法邮箱只显示行内提示并聚焦首个问题字段，不发凭证请求；合法字段仍走原signIn调用。pending禁用用muted底/辅助文字，不用低透明度伪装主色。

### 内容区左边缘坐标（CSS px）

首页输入和任务区同轴；SKU与模板库同轴。登录是双栏，不强行改成列表布局，因此分别记录左右内容。

| 页面/区域 | 宽度 | 主题 | 修改前x | 修改后x |
| --- | ---: | --- | ---: | ---: |
| 首页输入框 | 1440 | light | 340.00 | 345.59 |
| 首页任务区 | 1440 | light | 120.00 | 345.59 |
| SKU内容区 | 1440 | light | 78.00 | 120.00 |
| 模板库标题区 | 1440 | light | 176.00 | 120.00 |
| 登录左侧文案 | 1440 | light | 55.00 | 24.00 |
| 登录右侧表单 | 1440 | light | 911.27 | 911.27 |
| 首页输入框 | 1440 | dark | 340.00 | 345.59 |
| 首页任务区 | 1440 | dark | 120.00 | 345.59 |
| SKU内容区 | 1440 | dark | 78.00 | 120.00 |
| 模板库标题区 | 1440 | dark | 176.00 | 120.00 |
| 登录左侧文案 | 1440 | dark | 55.00 | 24.00 |
| 登录右侧表单 | 1440 | dark | 911.27 | 911.27 |
| 首页输入框 | 2560 | light | 900.00 | 800.00 |
| 首页任务区 | 2560 | light | 680.00 | 800.00 |
| SKU内容区 | 2560 | light | 638.00 | 680.00 |
| 模板库标题区 | 2560 | light | 736.00 | 680.00 |
| 登录左侧文案 | 2560 | light | 55.00 | 24.00 |
| 登录右侧表单 | 2560 | light | 1758.11 | 1758.11 |
| 首页输入框 | 2560 | dark | 900.00 | 800.00 |
| 首页任务区 | 2560 | dark | 680.00 | 800.00 |
| SKU内容区 | 2560 | dark | 638.00 | 680.00 |
| 模板库标题区 | 2560 | dark | 736.00 | 680.00 |
| 登录左侧文案 | 2560 | dark | 55.00 | 24.00 |
| 登录右侧表单 | 2560 | dark | 1758.11 | 1758.11 |
| 首页输入框 | 390 | light | 18.00 | 18.00 |
| 首页任务区 | 390 | light | 18.00 | 18.00 |
| SKU内容区 | 390 | light | 18.00 | 18.00 |
| 模板库标题区 | 390 | light | 32.00 | 18.00 |
| 登录左侧文案 | 390 | light | 28.00 | 18.00 |
| 登录右侧表单 | 390 | light | 26.00 | 18.00 |
| 首页输入框 | 390 | dark | 18.00 | 18.00 |
| 首页任务区 | 390 | dark | 18.00 | 18.00 |
| SKU内容区 | 390 | dark | 18.00 | 18.00 |
| 模板库标题区 | 390 | dark | 32.00 | 18.00 |
| 登录左侧文案 | 390 | dark | 28.00 | 18.00 |
| 登录右侧表单 | 390 | dark | 26.00 | 18.00 |

### 原图、白边与拼贴排查

[只读原图检查](phase3-prep-fix-asset-inspection.json)记录当前前三张实拍均为1600×1600 JPEG、3通道、无Alpha。两张马桶架原图直接包含上下拼贴与白色间隔线，属于原图内容，不是页面拼接、模糊背景或透明占位。当前首张鞋架白底图未复现独立棋盘填充；其JPEG白底有轻微图像纹理，现有代码也没有SKU棋盘样式。仅凭当前图片不能确定用户此前所见每一处方格的历史来源，不能把它断言成透明PNG。现在UI留白明确使用纯色muted，原图内容不涂抹。

已改用用户以前选定的两张单幅主图，旧拼贴不再当封面。鞋架无已选主图，展示原实拍全图。下表是原始实拍检查与最终封面来源，未新建或绑定SKU：

| 产品 | 原实拍ID | 最终封面ID | 显示 |
| --- | --- | --- | --- |
| 竖向鞋架 · Task 11-B 验收 | cmvqffv520002bcv8ocnfwnuj | cmvqffv520002bcv8ocnfwnuj | contain |
| 原木色拱形储物马桶架 | cmv61cvbd000cb8v8gmvihdxb | cmv6deevh0009wkv8xgq0j0vo | cover |
| 原木色拱顶藤编双门马桶架 | cmv9b8fri0002o4v8ujwfyz1r | cmv9bhnp90007k4v8pvlby8k0 | cover |

### 产品名与两种Logo位置（本轮未统一）

| 名称/图形 | 实现位置 | 可见位置 |
| --- | --- | --- |
| 家具工作台（标题） | src/app/layout.tsx:5 | 根metadata；登录及未覆盖标题的旧页浏览器标签 |
| 家具工作台 + F图形 | src/app/login/page.tsx:8 | 登录左上wordmark |
| 家具工作台首页 + F图形 | src/components/navigation.tsx:14 | 旧页header：产品资料、Agent、templates、admin、用户、网关及forbidden；文字分为“家具”/“工作台”span |
| 家具创作室 + Layers叠层图形 | src/components/design-preview/app.tsx:46 | creative首页、SKU、模板库及混合后台；工作台状态用返回SKU按钮代替该Logo |
| 家具创作室（标题） | src/app/(creative)/layout.tsx:13 | creative路由浏览器标签；混合/admin/models的根metadata仍为家具工作台 |
| F图形外观 | src/app/globals.css 的.brand-symbol | 35px方形、F字与不对称圆角；本轮未改形状或名称 |
| Layers图形外观 | concept-icons.ts的Layers及.p-logo | 现有线性叠层图标；未替换。供应商的小品牌图标不属于这两种产品Logo |

以上命名/图形等待用户选择后再统一，本轮没有擅自决定。

## 二、3a变化

尚未执行3a；未改跟随工具条、多选操作、底部工具栏、自然尺寸角标、失败节点或重试流程。只按本轮明确授权提前移除了3c的快捷意图标签。

## 三、截图与对比度验收

32张指定截图：[修改前](phase3-prep-fix-before/manifest.json)、[修改后](phase3-prep-fix/manifest.json)。首页/SKU/库/登录各亮暗×1440/2560/390=24张；空画布/有图各亮暗×1440/390=8张。1440视口高900，2560高1440，手机高844，DPR1。每个manifest保留Chrome/OS/字体指纹，比较前核对。

| 指标 | 实测最低 | 门槛 |
| --- | ---: | ---: |
| 32状态可见文字（含图片文字） | 4.51 | 4.5 |
| 首页任务卡/小标签栅格采样 | 5.77 | 4.5 |
| 暗色主文字，含最亮浮层 | 13.44 | 12 |
| 暗色辅助文字，浮层 | 6.18 | 4.5 |
| 实际聚焦描边，对页面/输入表面 | 4.47 | 3 |
| 完整axe serious/critical | 0 | 0 |

axe全部违规数也是0；未决项仍保留原JSON，用实际DOM合成与栅格采样复核，不把incomplete当自动通过。32状态无页面横向溢出；工作台模型胶囊/手机画布标题原有截断记录保留，未扩大本轮去重做画布结构。贴边的对话输入区采用outline-offset:-2px内收描边，六组聚焦边界均实测位于视口内，避免外描边在屏幕边缘被裁切；首页仍用外侧描边，不影响静止截图或布局。

每张图片的严格差异如下；暗色全局背景变化会影响几乎整幅图，首页高度也有变化，严格率按联合画布计算，不改阈值或用对齐率掩盖它们。

| 截图 | 严格差异% | 本组变化 |
| --- | ---: | --- |
| [home-light-1440](phase3-prep-fix/home-light-1440.png) | 67.54 | 纯色首页背景、clamp输入/任务共同轴、120px/16px输入、移除Tab角标与快捷标签、单层遮罩 |
| [skus-light-1440](phase3-prep-fix/skus-light-1440.png) | 26.84 | 1200px共同内容轴、4:3/10px封面、改取既有主图、白底contain |
| [workspace-empty-light-1440](phase3-prep-fix/workspace-empty-light-1440.png) | 0.67 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改 |
| [workspace-images-light-1440](phase3-prep-fix/workspace-images-light-1440.png) | 0.73 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改 |
| [library-light-1440](phase3-prep-fix/library-light-1440.png) | 9.35 | 1200px内容轴、24px导入内边距、原生文件按钮与ChevronRight |
| [login-light-1440](phase3-prep-fix/login-light-1440.png) | 3.70 | 600字重、去阶段标语与斜线、左对齐插画、安全边距和输入边框 |
| [home-dark-1440](phase3-prep-fix/home-dark-1440.png) | 99.58 | 纯色首页背景、clamp输入/任务共同轴、120px/16px输入、移除Tab角标与快捷标签、单层遮罩；已授权的新全局暗色层级与主文字色 |
| [skus-dark-1440](phase3-prep-fix/skus-dark-1440.png) | 97.94 | 1200px共同内容轴、4:3/10px封面、改取既有主图、白底contain；已授权的新全局暗色层级与主文字色 |
| [workspace-empty-dark-1440](phase3-prep-fix/workspace-empty-dark-1440.png) | 98.40 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改；已授权的新全局暗色层级与主文字色 |
| [workspace-images-dark-1440](phase3-prep-fix/workspace-images-dark-1440.png) | 93.78 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改；已授权的新全局暗色层级与主文字色 |
| [library-dark-1440](phase3-prep-fix/library-dark-1440.png) | 99.91 | 1200px内容轴、24px导入内边距、原生文件按钮与ChevronRight；已授权的新全局暗色层级与主文字色 |
| [login-dark-1440](phase3-prep-fix/login-dark-1440.png) | 50.91 | 600字重、去阶段标语与斜线、左对齐插画、安全边距和输入边框；已授权的新全局暗色层级与主文字色 |
| [home-light-2560](phase3-prep-fix/home-light-2560.png) | 55.78 | 纯色首页背景、clamp输入/任务共同轴、120px/16px输入、移除Tab角标与快捷标签、单层遮罩 |
| [skus-light-2560](phase3-prep-fix/skus-light-2560.png) | 9.44 | 1200px共同内容轴、4:3/10px封面、改取既有主图、白底contain |
| [library-light-2560](phase3-prep-fix/library-light-2560.png) | 3.29 | 1200px内容轴、24px导入内边距、原生文件按钮与ChevronRight |
| [login-light-2560](phase3-prep-fix/login-light-2560.png) | 1.34 | 600字重、去阶段标语与斜线、左对齐插画、安全边距和输入边框 |
| [home-dark-2560](phase3-prep-fix/home-dark-2560.png) | 99.96 | 纯色首页背景、clamp输入/任务共同轴、120px/16px输入、移除Tab角标与快捷标签、单层遮罩；已授权的新全局暗色层级与主文字色 |
| [skus-dark-2560](phase3-prep-fix/skus-dark-2560.png) | 99.28 | 1200px共同内容轴、4:3/10px封面、改取既有主图、白底contain；已授权的新全局暗色层级与主文字色 |
| [library-dark-2560](phase3-prep-fix/library-dark-2560.png) | 99.97 | 1200px内容轴、24px导入内边距、原生文件按钮与ChevronRight；已授权的新全局暗色层级与主文字色 |
| [login-dark-2560](phase3-prep-fix/login-dark-2560.png) | 49.60 | 600字重、去阶段标语与斜线、左对齐插画、安全边距和输入边框；已授权的新全局暗色层级与主文字色 |
| [home-light-390](phase3-prep-fix/home-light-390.png) | 75.32 | 纯色首页背景、clamp输入/任务共同轴、120px/16px输入、移除Tab角标与快捷标签、单层遮罩 |
| [skus-light-390](phase3-prep-fix/skus-light-390.png) | 23.19 | 1200px共同内容轴、4:3/10px封面、改取既有主图、白底contain |
| [workspace-empty-light-390](phase3-prep-fix/workspace-empty-light-390.png) | 0.11 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改 |
| [workspace-images-light-390](phase3-prep-fix/workspace-images-light-390.png) | 0.09 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改 |
| [library-light-390](phase3-prep-fix/library-light-390.png) | 24.42 | 1200px内容轴、24px导入内边距、原生文件按钮与ChevronRight |
| [login-light-390](phase3-prep-fix/login-light-390.png) | 7.06 | 600字重、去阶段标语与斜线、左对齐插画、安全边距和输入边框 |
| [home-dark-390](phase3-prep-fix/home-dark-390.png) | 99.87 | 纯色首页背景、clamp输入/任务共同轴、120px/16px输入、移除Tab角标与快捷标签、单层遮罩；已授权的新全局暗色层级与主文字色 |
| [skus-dark-390](phase3-prep-fix/skus-dark-390.png) | 97.90 | 1200px共同内容轴、4:3/10px封面、改取既有主图、白底contain；已授权的新全局暗色层级与主文字色 |
| [workspace-empty-dark-390](phase3-prep-fix/workspace-empty-dark-390.png) | 98.17 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改；已授权的新全局暗色层级与主文字色 |
| [workspace-images-dark-390](phase3-prep-fix/workspace-images-dark-390.png) | 97.26 | 对话输入表面/静止装饰线与2px聚焦；画布结构未改；已授权的新全局暗色层级与主文字色 |
| [library-dark-390](phase3-prep-fix/library-dark-390.png) | 99.82 | 1200px内容轴、24px导入内边距、原生文件按钮与ChevronRight；已授权的新全局暗色层级与主文字色 |
| [login-dark-390](phase3-prep-fix/login-dark-390.png) | 65.25 | 600字重、去阶段标语与斜线、左对齐插画、安全边距和输入边框；已授权的新全局暗色层级与主文字色 |

另保留原44个creative状态对baseline-phase3：[完整44状态](phase3-prep-fix-creative/manifest.json)，以及旧36状态对上一准备结果：[旧页36状态](phase3-prep-fix-studio/manifest.json)。本轮已授权调整全局暗色、亮色input与登录，因此旧页存在相应颜色变化，不宣称为0%或噪声。源码中其余旧页结构没有改。

## 四、验证与交付

- lint:ui/lint/typecheck/build通过；UI白名单仍6项数据色，0新增违规。
- 106既有单元+7环境指纹单元、5数据库集成通过；test:generation通过，KI-001未复现，费用断言未变。
- 常规e2e最终10通过、2项按设计另跑；Agent专用2通过。KI-002/003测试等待及原断言保留，未宣称会话竞态已修复。
- [交互证据](phase3-prep-fix-interactions/checks.json)：24组实际聚焦/Tab补全/details键盘/空字段提示/模拟选文件验证，另6组真实图库比例、同排对齐、contain/cover与悬停布局验证，全通过。目录上传仅拦截响应，不调用Agent或写经验库。
- 源码改动限于相关UI组件/样式、只读SKU目录返回字段与排序、审计脚本；没有改商品身份、生成流程或费用相关实现。

本地日志在.local/verification/ui-phase3-prep-fix/。单独提交ui(phase3-prep-fix)，不推送；停在准备修正，等待审阅。

# 任务 7 · 第一阶段 · 第 4 轮：首页输入框减负

完成后停在静态原型审阅阶段。预览：[首页](http://localhost:3001/design-preview) / [工作台](http://localhost:3001/design-preview/workspace)。

## 本轮调整

- 首页完全移除品类下拉和拍摄标准，保持通用轮播占位示例。
- 输入框仅两层：附件与三行文字 / 单行工具行。图片、文件均为 56px 缩略块，可逐项删除。
- 有文字或附件时才显示预计费用，首页保留两位小数。发送按钮为 40px 黑白圆形，空态仅降低为 40% 透明度。
- Auto 标签使用标准中点“·”，固定图标尺寸与行高。
- 新任务先由 Agent 给出品类确认卡；“换一个”使用 shadcn Command，可搜索、键盘选择，支持无结果状态。
- 只有文字时匹配品类；没有线索时询问品类，可补充文字或直接选择。工作台产品卡头部可修改品类，保留已有实拍、SKU 与锁定特征。
- 新任务初始快速档。确认到后台默认严格的品类后，只提供一次“按严格来 / 这次先快速”；本次选择不修改品类后台默认值。
- 拍摄标准入口只留在产品卡；支持升级严格。弹层选项采用独立标题/说明、正常换行和足够行距，修复重叠。

仍不接后端。实拍识别使用本地示例：先匹配文字、文件名中的品类，没有文字线索的实拍使用“边桌”样例；真正的视觉识别留待后续接入。已有任务兼容保留，新任务走本轮确认流程。

## 截图

要求的 10 张主状态图：

| 状态 | 亮色 | 暗色 |
| --- | --- | --- |
| 首页空态 | [查看](01-home-empty-light.png) | [查看](01-home-empty-dark.png) |
| 首页输入文字 | [查看](02-home-text-light.png) | [查看](02-home-text-dark.png) |
| 首页拖入 2 张图片 | [查看](03-home-two-photos-light.png) | [查看](03-home-two-photos-dark.png) |
| 工作台品类确认卡 | [查看](04-workspace-category-confirm-light.png) | [查看](04-workspace-category-confirm-dark.png) |
| 产品卡头部品类与档位 | [查看](05-product-header-light.png) | [查看](05-product-header-dark.png) |

补充 6 张截图：[品类搜索亮色](06-category-command-light.png) / [暗色](06-category-command-dark.png)、[严格默认建议亮色](07-strict-default-choice-light.png) / [暗色](07-strict-default-choice-dark.png)、[拍摄选项间距亮色](08-shooting-options-spacing-light.png) / [暗色](08-shooting-options-spacing-dark.png)。

## 验证与运行

沿用 `npm run dev -- --port 3001`，或 `npm run build` 后 `npm run start -- --hostname 127.0.0.1 --port 3001`。

- `npm run test:prompt-composer`：22 项规则测试通过，包含品类确认、默认严格的两种响应与品类修改保留资料。
- `npm run lint`、`npm run typecheck`、`npm run build` 通过。
- `python scripts/verify-design-preview-round4.py`：Python 环境需安装 Playwright，使用系统 Chrome，复用 `.local/task8a-storage.json` 现有登录态。当前机器可用 `.local/round4-test-env/Scripts/python.exe`。
- [浏览器验收明细](verification.json)：16 张截图、3 种窄屏；页面错误、控制台诊断、业务 API 和外部资源请求均为 0。包含实际拖拽两张、删除图片/文件、费用显隐和两位小数、黑白按钮、Command 搜索/键盘、纯文字识别/未知追问、严格分支、升级及刷新保持。

品类选择器采用 [shadcn Command](https://ui.shadcn.com/docs/components/command) 的 cmdk 组合，样式复用现有预览主题。仅新增 cmdk 依赖，未修改业务 API、数据库或既有模型配置。

## 自查

- [x] 首页没有品类或拍摄标准控件
- [x] 通用占位轮播，输入框仅两层、工具行不折行
- [x] 图片/文件 56px，可删除；费用按内容显隐并保留两位
- [x] 40px 黑白发送按钮，空态透明度 40%
- [x] Auto 文本无异常字符，图标尺寸和基线一致
- [x] 品类确认、可搜索更换、文本未知追问与产品卡修改
- [x] 默认快速，后台严格需本次确认，产品卡可升级
- [x] 拍摄弹层无文字重叠，亮暗两套均已截图与检查

完成后等待审阅，不进入下一阶段。历史第三轮和任务 8A 的截图、录屏保留；本轮 UI 验收以第四轮脚本和截图为准。

# 生图模型胶囊与面板小修

已完成，等待审阅；仍为本地静态原型，未接真实接口。

运行 `npm run dev -- --port 3001`，登录后访问 `/design-preview`。首页与工作台共用同一个选择器，保留此前所有页面和任务进度。

## 状态与截图

[打开亮暗截图画廊](index.html)。共 14 张：三种状态的胶囊及面板各 2 套主题，另含多模型 Tooltip 的亮暗截图。

| 状态 | 胶囊规则 | 亮色胶囊 / 面板 | 暗色胶囊 / 面板 |
| --- | --- | --- | --- |
| Auto 开，仅 1 个模型 | 显示已勾选的真实模型名，不出现 Auto | [胶囊](auto-one-capsule-light.png) / [面板](auto-one-panel-light.png) | [胶囊](auto-one-capsule-dark.png) / [面板](auto-one-panel-dark.png) |
| Auto 开，2 个及以上 | 自动 · N 个模型；悬停列出已勾选名称 | [胶囊](auto-many-capsule-light.png) / [面板](auto-many-panel-light.png) | [胶囊](auto-many-capsule-dark.png) / [面板](auto-many-panel-dark.png) |
| Auto 关 | 显示手动选择的模型名，主色描边 | [胶囊](manual-capsule-light.png) / [面板](manual-panel-light.png) | [胶囊](manual-capsule-dark.png) / [面板](manual-panel-dark.png) |

Tooltip：[亮色](auto-many-tooltip-light.png) / [暗色](auto-many-tooltip-dark.png)。

## 改动

- 生图面板直接显示“生图模型”，移除图片/视频分段及其无用样式。模型配置原本仅有 agent/image 两类，继续保持。
- Auto 说明固定为“开启后，从下面勾选的模型里按任务自动挑选；只勾一个就固定用它。”
- 胶囊显示基于实际可用、已勾选的模型。手动选过其他模型后切回 Auto 单选，也会显示真正勾选的那个模型。
- 数量字符串使用普通空格与中点，不插入不可见字符。沿用 Segoe UI / Microsoft YaHei UI 字体回退；图标与文字垂直居中，保留 16px 图标和单行工具条。
- 所有前端预览的单价、质量档价格、预计总价、费用确认和后台模型参考价格统一显示两位小数；$0.025 显示 $0.03。配置原始数值、费用计算精度和确认阈值保持原值。
- 模型名称继续全部来自 `src/design-preview/mock/models.ts`，选择组件没有硬编码模型名。

## 验证

`npm run lint`、`npm run typecheck`、`npm run build` 通过。原生 Python Playwright 验收脚本：

```powershell
.local/round4-test-env/Scripts/python.exe scripts/verify-model-picker-refinement.py
```

脚本从 models.ts 读取目录，用现有本地登录态、系统 Chrome 验证三种状态、Tooltip 内容、质量档实时价格、四舍五入、说明与开关不重叠、刷新持久化、首页进入工作台沿用、窄屏更多菜单。使用 CDP 检查实际渲染字体，记录字符串码点、图标中心位置和手动边框颜色。

结果见 [verification.json](verification.json)：14 张截图；页面/控制台错误、业务 API 请求和外部网络请求均为 0。完成后停下，等待审阅。

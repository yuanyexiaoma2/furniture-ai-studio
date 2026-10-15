# 任务 7 · 第一阶段 · 第三轮修订

状态：已完成静态原型，等待负责人审阅。正式入口：<http://localhost:3001/design-preview>。五页结构沿用第二轮，界面数据、模型参数和费用均为演示值。

## 查看与运行

在项目根目录：

```powershell
npm run build
$env:AUTH_URL = "http://localhost:3001"
npm run start -- --hostname 127.0.0.1 --port 3001
```

使用已有账号登录，访问 `/design-preview`；首页顶部提供首页、SKU、素材库，头像菜单可进入管理后台，SKU 卡片可进入工作台，工作台的产品卡按钮打开右侧抽屉。根路径 `/` 继续是原业务首页。

预览沿用原有登录保护；不需要启动 worker，不需要调用模型接口。本轮没有新增依赖、业务 API、数据库模型或后端接入。

## 20 张截图

| 内容 | 亮色 | 暗色 |
| --- | --- | --- |
| 首页 | [首页](01-home-light.png) | [首页](01-home-dark.png) |
| SKU 列表 | [SKU](02-skus-light.png) | [SKU](02-skus-dark.png) |
| 无限画布工作台 | [工作台](03-workspace-light.png) | [工作台](03-workspace-dark.png) |
| 产品卡抽屉 | [产品卡](04-product-light.png) | [产品卡](04-product-dark.png) |
| 管理后台 | [后台](05-admin-light.png) | [后台](05-admin-dark.png) |
| 智能体面板 | [智能体](06-agent-panel-light.png) | [智能体](06-agent-panel-dark.png) |
| 生图面板 · Auto 开 | [Auto](07-image-auto-light.png) | [Auto](07-image-auto-dark.png) |
| 生图面板 · Auto 关 | [手动指定](08-image-manual-light.png) | [手动指定](08-image-manual-dark.png) |
| 画布浮动工具条 | [工具条](09-canvas-toolbar-light.png) | [工具条](09-canvas-toolbar-dark.png) |
| 局部重绘涂抹 | [涂抹](10-paint-state-light.png) | [涂抹](10-paint-state-dark.png) |

## 操作录屏

[播放第三轮操作录屏（WebM，约 24 秒）](round3-demo.webm)

内容依次为：首页选择智能体与生图模型 → 发送 → 工作台沿用选择 → 选中图片与完整工具条 → 180% 放大进行真实 Konva 涂抹 → 编辑状态下切换暗色。

录屏由浏览器实际操作帧编码，保留鼠标位置；没有替换成另一套界面。实际回放时长、画面尺寸与可解码检查见 [playback-qa.json](playback-qa.json)，采集过程见 [recording.json](recording.json)。

## models.ts 的数据结构

唯一模型目录：`src/design-preview/mock/models.ts`。所有组件按 `id` 关联、从目录读取展示名称，不在组件中写模型名。

| 字段 | 类型与用途 |
| --- | --- |
| `id` | 稳定的前端选项标识，用于保存选择；不是 API 模型 ID |
| `kind` | `agent / image`，后台显示为智能体 / 生图 |
| `name` | 管理员允许展示的真实模型名称 |
| `initial / color` | 24px 圆形品牌占位图标 |
| `description / tag` | 擅长点与短标签 |
| `seconds / price` | 演示的单次耗时和美元参考价 |
| `failureRate` | 演示的失败率，超过 3% 用黄色进度条 |
| `enabled / visible / isDefault` | 初始启用、对美工可见、同类型默认选项 |
| `tiers` | 可选质量档，含 `id: auto / standard / fine`、中文名称、对应耗时和价格 |

`model-store.ts` 使用 zustand persist，保存到 `furniture-preview-models-v3`。目录本身提供初始值，后台修改的可见性与启用状态保存在 `availability`，同类型默认选项保存在 `defaults`。首页使用 `home` 选择；工作台按会话键保存在 `sessions` 中，独立修改不改写首页选择。首页发送时复制当前选择到演示会话；刷新后仍保留模型选择。

Auto 开启时，默认可用生图模型强制加入勾选范围；其他可用模型可自由多选。Auto 关闭时只使用手动指定的一个模型。隐藏或停用已选模型后，面板立即移除它，选择器回落到同类型可用默认项；没有可用模型时禁用发送。

参考费用 = 智能体单次参考价 + 张数 × 生图参考单价。Auto 多选取已选质量档中的最高单价作保守估算；手动指定取所选模型和质量档单价。页面实时显示三位小数，防止小额模型切换没有可见变化；这不是实际账单。

## 以后替换成后台接口

1. 在目录与组件之间增加模型目录适配层，将后端返回值映射到上述 `MockModel` 展示结构；让选择器与管理表格共同读取该目录，替换当前静态 `models` 导入。
2. 将本地 `availability / defaults` 改为后台配置接口返回的数据；保存成功后刷新共享目录，维持首页与工作台即时联动。
3. 将 `home / sessions` 的选择标识随会话配置保存；客户端只提交选项 ID、Auto 范围、质量档、比例和数量。目录更新或模型失效时继续做可用性回落。
4. 报价改用服务端返回值，实际生成仍须走既有方案确认、配额检查和任务队列。模型网关、供应商、API 地址和密钥只留在服务端，不加入美工用的展示 DTO。

本轮没有实现这些后台步骤。

## 视觉与交互

首页采用 60vh 创作首屏、40px 主标题、760px 输入框、浅暖径向渐变与 3% 噪点；暗色保留原色值并使用 25% 墨绿光晕。模板图片为 4:3，卡片与图像由 motion 驱动悬停反馈。模型胶囊高 32px，发送按钮是 40px 黑 / 白圆形；空间不足时，生图与工作台参数进入“⋯”。

画布进入时以 80px 留白适应屏幕。30 个初始图片节点使用 30 张不同来源的本地家具照片；主图、场景、细节与尺寸示意分开。照片用于版式，不表示它们来自同一个真实 SKU；尺寸标注也是演示值。样图来源保存在 [image-sources.json](image-sources.json)，沿用 [Unsplash License](https://unsplash.com/license)。

Frame 标题和候选标签按画布缩放反向补偿，保证实际文字不小于 12px；终稿是左上实心角标和主色描边。选图时真实显示分组工具条，生成使用 motion 闪光骨架。弹窗、Popover 和抽屉通过 motion 淡入与 4px 位移，160ms；卡片悬停为 200ms ease-out。

## 验证

```powershell
npm run lint
npm run typecheck
npm run build
node scripts/verify-design-preview-round3.mjs
node scripts/record-design-preview-round3.mjs
```

[完整验证结果](verification.json)覆盖 20 张截图、1600 / 1100 / 768 / 390px 工具行、实际文字尺寸、模型共享配置、Auto 锁定、手动质量档、费用变化、持久化、会话独立、后台可见 / 启用 / 默认联动、30 个样图 URL 和文件哈希，以及真实工具条和涂抹。页面错误、控制台诊断、业务 API 请求和外部资源请求均为 0。

自查逐项见 [self-check.md](self-check.md)。完成后停在第一阶段，等待审阅。

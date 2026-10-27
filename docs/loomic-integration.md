# Loomic 首批融合 · 2026-10-27

本次按用户确认实施画布理解、选图引用、执行进度卡和布局保存。沿用既定新版UI、React Flow、现有LLM/生图网关、Prisma和pg-boss。品牌库、对话排版、技能市场及视频不在本次范围。

## 如何体验

打开 http://localhost:3000/design-preview/skus ，进入已有SKU，或在首页上传实拍创建创作。

1. 画布左侧会显示原始实拍，图位保留已有候选。点选图片后，输入框上方显示本次引用；可多选，最多6张，也可逐个取消。
2. 发送消息时服务器校验当前SKU归属，将选中图片作为视觉输入，并附带画布元素ID、C短编号、全局坐标、图位及便签摘要。Agent可调用inspect_canvas按元素或区域核对。便签属于素材数据，不能改变确认和费用规则。
3. 左侧创作进度显示工具执行和图像任务状态，可展开结果；刷新后读取数据库记录。底部历史按钮也展示真实执行记录。
4. 移动图位/图片、添加和修改便签、缩放平移后，布局在后台自动保存，正常状态不显示常驻提示。返回SKU会先保存。移除图片只隐藏当前用户布局，不删除原图、候选记录或终稿。

布局按用户和SKU隔离。生成完成后自动把占位图的位置和隐藏状态迁移到正式图片，保留便签及视口；同商品的失效元素自动清理，相同内容的重复保存自动接受。仅多个窗口保存了不同布局时保留服务器版本并提示处理；不会静默覆盖当前未保存修改。画布恢复完成前禁用便签编辑，避免加载结果覆盖刚输入的内容。只读用户可浏览，不能保存布局。

## 如何运行

沿用现有.env及Docker中的PostgreSQL、MinIO。升级此版本先执行：

```powershell
npx prisma generate
npx prisma migrate deploy
npm run dev -- --hostname 127.0.0.1 --port 3000
```

worker在另一终端运行npm run worker，已有服务不要重复启动。数据库新增AgentSession.canvasLayout/canvasRevision以及AgentToolCall.completedAt，为增量迁移，无删除或重置。本机迁移已经应用，网页已重启加载新客户端。

## 验证

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:task10:units
npm run test:canvas
npx playwright test tests/canvas.spec.ts tests/navigation.spec.ts tests/auth.spec.ts tests/gateways.spec.ts tests/packs.spec.ts tests/product.spec.ts
```

验证覆盖布局版本、用户隔离、跨SKU引用拒绝、上下文与视觉输入、执行事件和刷新、消息幂等、布局/便签/缩放恢复、键盘删除保留原图、离页保存、并发冲突，以及原登录/权限/网关/图包/商品回归。临时账号、SKU和模拟图片在测试后清理。未调用真实付费模型；真实模型的理解效果及真实修图仍由用户体验确认。

本地截图位于.local/verification/canvas-ready.png及canvas-integration.png，不纳入Git。截图使用模拟图片，不能作为真实产品保真验收。

参考Loomic版本21206c30054572291b9df000d84568aeca97aeda，授权与版权声明见根目录THIRD_PARTY_NOTICES.md。

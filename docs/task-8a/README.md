# 任务 8A · 结构化创作资料库与双档拍摄

当前仅前端静态原型。沿用任务 7 第三轮界面、共享模型选择器和双主题；真实模型、联网检索、视觉识别、文件解析、工具执行与生产数据库迁移均未接入。8B 需审阅通过后另行实施。

## 预览和复现

已有账号登录后访问：

- 首页：http://localhost:3001/design-preview
- 模板库：http://localhost:3001/design-preview/library
- 工作台：http://localhost:3001/design-preview/workspace
- 后台：http://localhost:3001/design-preview/admin → 品类设置 / 待审核条目

开发：`npm run dev -- --port 3001`。生产预览：`npm run build` 后执行 `npm run start -- --hostname 127.0.0.1 --port 3001`。不需要启动 worker 或运行迁移。原业务页面和 API 保留。

演示路径：选择“边桌 / 快速” → 拖入正面、45° 两张实拍 → 发送 → 规划图包 → 生成候选 → 点击“看看这次的候选” → 设为终稿 → 修改收藏名称并“存” → 去库里看看 → 搜“边桌 卧室”。首页 Bento 的“产品卡”沿用当前任务；无任务时载入五张样例资料。补齐到五个角度后，升级为严格显示 5/7，关闭抽屉后在对话中选择“先跳过”。

## 数据结构

源码：

| 文件 | 用途 |
| --- | --- |
| [types.ts](../../src/design-preview/library/types.ts) | TypeScript 领域类型、可见性、拍摄档位与角度枚举 |
| [mock/library.ts](../../src/design-preview/mock/library.ts) | 全部库数据、品类、产品与历史配方样例 |
| [prompt-composer.ts](../../src/design-preview/library/prompt-composer.ts) | 确定性拼装、原始参考约束、配方去重 |
| [rules.ts](../../src/design-preview/library/rules.ts) | 权限、拍摄覆盖、交集搜索、30 天规则 |
| [tool-contracts.ts](../../src/design-preview/library/tool-contracts.ts) | 20 个 function calling 参数草案及短码解析边界 |
| [library-store.ts](../../src/components/design-preview/library/library-store.ts) | 原型任务、资料库、沉淀与审核本地状态 |
| [migration-draft.sql](migration-draft.sql) | 独立 SQL 迁移讨论稿；不在生产迁移目录，未执行 |

所有库实体共用 id/name/owner/visibility/tags/categoryIds/createdAt/stats，visibility 为 private/pending/public。Category 以 defaultShootingMode、quickHint、strictChecklist 定义品类标准。Product 含 SKU、拍摄档位、带角度标签的原始 photos、可锁定 features、dimensions。SceneTemplate 存 skeleton、fixed、variables.options、默认道具组与封面；Prop 存英文关键词、形状、颜色、材质、尺寸、标签与参考图；PropSet 存 propIds 和 maxPick。ReferenceImage 存来源、空间/风格/光线、评分与使用记录；PromptSnippet 存文本与使用次数。

GenerationRecipe 每张成图独立记录 templateId、propIds、variables、refIds、model、finalPrompt、combinationKey、originalPhotoIds、imageId。额外冻结 productSnapshot 和 templateSnapshot；手动修改产生新配方并关联 parentRecipeId。模板后来修改不会改变历史配方。

种子数据实际数量：品类 10、产品 12、场景 12、道具 20、道具组 10、参考图 12、关键词片段 12、历史配方 12。覆盖边桌、马桶架、浴室柜；包含边桌·卧室、边桌·客厅、马桶架·浴室、浴室柜·浴室、洗手池·台面等组。样图复用已有本地家具图库，不代表真正根据该产品生成的结果。

## 确定性拼装与去重

`PromptComposer.compose({template, product, propSets, props, variables, references, actor})` 先校验模板品类、条目权限、占位符、变量白名单和 maxPick，然后按照稳定顺序替换占位符，追加固定约束、锁定产品特征及原始参考编号。参考图通过 referenceInputs 独立传递，区分 original 与 style，不能把图片 URL 当正文注入。

相同输入产生相同 finalPrompt；不修改输入对象。未知变量、未知道具、跨品类选择和缺少原始实拍直接拒绝。LLM 将来只能选择已验证 ID 和变量选项，不直接改写最终提示词。

`chooseFreshRecipe` 排除本 SKU 全部历史，以及同品类最近 30 天（不含未来时间）的组合。组合键由模板、排序后的道具、变量、参考组成，与 SKU、模型无关，能避免用换模型绕过内容去重。批量候选逐张预留键；最多搜索 1000 组，耗尽时请换模板/搭配，不发起质检修复循环。

手动修图使用 `PromptComposer.edit`：用户明确的修改要求 + 当前产品原始实拍 + 锁定约束 + 上一轮成图。上一轮成图只是编辑底图，不能代替原始实拍。局部重绘/消除保留真实浏览器蒙版导出，换色、抠图、换背景与扩图为本地效果演示；不会自动主动修图。

## 拍摄标准与沉淀

- 快速：两张实拍直接开始，不在对话里追问补拍。产品卡灰字建议每任务只显示一次。任务全程可补资料。
- 严格：品类清单实时计算覆盖率，缺项用一句话询问并提供“先跳过”；不阻塞规划。五张样例对应 5/7，缺背面和五金。
- 一张：显示“只有 1 张实拍，产品还原度可能不稳定”，仍可生成。零张时先提供添加资料入口。
- 上传角度按文件名和序号模拟标注，可在产品卡手动修改；文档仅记录文件名，未读取正文。后续真实视觉标注不能被当作本期已实现。
- 终稿保存：使用当前成图冻结的骨架做反推演示，不把 finalPrompt 中的产品描述复制进模板。建议名称/标签来自配方元数据，可修改名称。
- 道具保存：浮动工具条“收藏与换色” → 存为道具 → 真实框选裁切 → 样例识别字段 → 手动确认字段 → 对话中一张小建议卡 → 存。
- 参考图：同菜单“存为参考图” → 对话小卡确认。描述归一化后第二次出现时提示片段收藏。
- 新条目默认 private；所有者可推荐为 pending；管理员或模板编辑审核后 public，退回恢复 private。每类建议可单独“不再提示这类”。
- 生成前显示实时假费用，超过单次 $0.20 显式确认；手动修图也显示所选模型费用。没有实际扣费。

## 交互和权限边界

前台用“整理资料 / 规划 / 生成 / 保存”等文字，不展示工具函数名、供应商或网关。工具契约包含用户列出的全部 20 项；参数使用短码，解析器校验可见性。未来服务端还须按当前任务、产品、团队、资源类型验证短码，不能信任模型提交的原始 ID。修图类 schema 要求 orig 非空、ask 非空、consent=true；保存接口仅接收 private，公开必须单独审核。

本期权限和审核使用 mock Actor，在浏览器内演示，不是安全边界。8B 应复用现有认证角色与数据库事务；禁止将这里的 mock 角色切换器用于生产授权。SQL 草案保留现有 Product/Template，新增统一 LibraryEntry 及分类明细/关系表，配方与原始 Asset 通过外键关联，并提供原始 photo 校验、延迟配方参考检查、检索和去重索引。配方与关系只增不改，实际数据库角色权限、RLS、软删除引用保护和费用幂等在 8B 落实。

## 将来接后台接口

1. 审阅本类型和 SQL 草案，按现有 Prisma/PostgreSQL 体系补充非破坏迁移与回填计划；不要直接运行本草案。
2. 用统一 repository 替换 seedLibrary 初始化和 zustand 内的数组修改，返回同型 DTO；筛选语义维持 AND，服务端强制 ACL。前台组件不内嵌模型和库条目。
3. 模型仍来自 [models.ts](../../src/design-preview/mock/models.ts) 的单一配置。用后台 DTO 替换数据来源，维持模型管理与选择器的同一 store 边界。
4. 上传使用既有私有 Asset 存储，返回原始实拍 ID；真实 ingest/视觉分类只更新档案，不自行发起修改。
5. Agent 仅输出类型化选择，服务端重新读取档案、权限、模型可用性、价格和原始实拍，再运行同一 PromptComposer。生成/编辑使用既有费用账本与任务队列；配方在提交前冻结。
6. reverse_prompt 返回骨架草稿，移除产品描述并验证占位符/变量后才允许保存；公共库推荐、审核和审计以事务处理。无自动质检或修复步骤。

本地状态键为 `furniture-preview-library-8a`；模型键保持任务 7 的 `furniture-preview-models-v3`。上传 Data URL 只适合小型原型资料，不用于正式素材存储。

## 验证与交付

```powershell
npm run test:prompt-composer
npm run lint
npm run typecheck
npm run build
node scripts/verify-task8a.mjs
node scripts/record-task8a.mjs
```

浏览器脚本使用已有登录态 `.local/round3-storage.json`；会阻断并统计非认证业务 API，自动测试不调用付费工具。

- [双主题截图目录](screens/)：第 8、9 节全部新增页面/状态，另含响应式检查。
- [演示录屏](task8a-demo.webm)：真实拖拽两张实拍、规划生成、终稿、沉淀、搜索命中、严格档缺项与跳过。
- [浏览器验收明细](verification.json)、[录屏元数据](recording.json)。
- 单元测试覆盖确定性、权限、原始参考、去重、拍摄标准和三类沉淀；生产构建、lint、typecheck 一并检查。

本轮到 8A 为止，等待审阅；没有进入 8B。

## 自查清单

- [x] 类型、SQL 迁移草案与每类不少于 10 条 mock；道具组 10 组，覆盖指定三品类。
- [x] PromptComposer 确定性拼装、变量/道具校验、同 SKU 与同品类 30 天组合去重。
- [x] 19 项单元测试通过；连续两轮修图每轮都包含原始实拍，禁止无原始实拍编辑。
- [x] 快速两张直接规划；产品卡补拍建议每任务一次；一张提示但允许开始。
- [x] 严格 5/7 缺失清单、先跳过、补拍角度更新和任务中升级。
- [x] 三种沉淀触发、个人默认、推荐待审、管理员/模板编辑审核、同类建议关闭。
- [x] 五类库 AND 搜索与标签交集、场景变量、道具详情与关键词复制。
- [x] Bento 入口、16:10 横向场景卡、24px 白色叠图标题及末张半露。
- [x] 保留上一轮模型选择器、费用联动、双主题与画布工具；没有质检修复流程。
- [x] 胶囊不折行、实际文字不小于 12px、没有灰绿色禁用发送按钮，产品导航没有预览切换器。
- [x] 40 张双主题页面/状态截图 + 6 张响应式检查图，实际录屏 约 20 秒并通过播放验证。
- [x] lint / typecheck / build 与浏览器检查通过；页面错误、业务 API、外部资源请求均为 0。
- [x] 只完成 8A，未执行数据库迁移、未接入真实模型，等待审阅。

恢复状态先于界面挂载，避免页面初始化覆盖已保存的会话模型；浏览器专测包含手动指定模型后直接刷新工作台并继续换色，核对实际模型、父配方与原始实拍。画布工具条按边缘位置调整对齐，避免被对话栏或屏幕边缘遮挡。

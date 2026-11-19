# 全项目交互逻辑审查 · 2026-11-13

用户随后要求“优化他们”，下列9项已于同日完成修复。本文保留初审时的复现记录，原因、表现和源码行号描述的是修复前状态；当前状态以此处修复表和正式回归为准。没有提交或推送，没有调用真实/付费模型、制作截图或改动现有用户资料。

## 修复与验收

| 项目 | 已实现的行为 | 验证 |
| --- | --- | --- |
| 1. 刷新重复识别 | 消费后移除init参数，服务端会话持久记录首次识别认领；兼容已有inspect_product记录。失败后保留人工识别入口 | 浏览器刷新不新增识别；数据库并发认领仅一次，历史失败也不自动重发 |
| 2. 项目状态串写 | 活动产品与进入代次双重校验，旧请求不能刷新全局快照、清除新页面忙碌状态或把引用带入另一项目；修改报价后提交也重新核对归属 | 单元覆盖A→B和A→B→A迟到响应；原画布闭环通过 |
| 3. Listing重复拆解 | 同次导入带稳定请求编号；服务端记录指纹和结果；拆解成功先显示待审草稿，后续列表失败只提供重读 | 浏览器列表失败、重读和重选同一文件夹；数据库同编号分析仅一次 |
| 4. 创建重复项目 | 创建请求编号随内容与文件摘要保留；丢失响应后同编号找回原项目；参数变化拒绝冒用；已创建但资料未完成时返回保留项目且不自动识别 | 浏览器重试编号相同；数据库返回同产品、不同用户隔离、改变内容拒绝 |
| 5. 设置刷新丢失 | 模型、联网、分辨率等改动按顺序自动保存，失败留当前用户/产品的会话草稿并显示重试；发送前等待保存，退出前也刷新设置 | 浏览器保存后刷新、离线草稿刷新恢复；单元顺序、失败恢复和隔离；数据库保存不覆盖会话元数据 |
| 6. 历史设置缺项 | imageIds缺项或undefined补丁使用合法默认值，webEnabled=false独立恢复 | 浏览器旧会话打开无异常；单元断言默认值和false保留 |
| 7. 遗漏修改报价小字 | edit_quote只返回报价，不再写自动价格消息；历史系统报价前缀仅在展示时去除，保留后续警告、用户文字与实际费用记录 | 单元文本边界、浏览器历史消息与警告；原报价与生图账务回归通过 |
| 8. 只读入口误导 | 首页、对话、模型设置、上传、单张生图、方案确认及库导入/审核等写操作按账号权限禁用，保留查看历史和图片 | 浏览器只读关键入口禁用且无写请求；原服务端权限检查保留 |
| 9. 网关结果误标 | 连通性测试标签使用响应的实际provider，KIE卡片的LLM测试显示ZenMux | 浏览器模拟ZenMux返回并核对标签 |

正式回归位于 `tests/interaction-recovery-isolated.spec.ts`、`tests/unit/interaction-recovery.test.ts` 和 `tests/integration/interaction-recovery.test.ts`。验证结果：lint、typecheck、214项单元、9项本地数据库/存储集成、build及11项隔离浏览器回归全部通过。修正conversation-references的旧断言，显式指定已约定的prompt_only用途模式。

防重复记录复用现有StudioLibraryEntry的studio_request类型，不修改数据库结构、队列、费用公式、预留或账本。已知失败不自动重试模型；未知处理中返回可重试读取的状态，创建中断且已有项目检查点时可找回保留项目。所有测试仅使用本地替身或隔离数据，真实模型地址在集成子进程中指向不可用的本机端口。

## 范围与方法

仓库盘点包含14个页面文件、27个API路由。检查重点是入口是否能走到真实业务、状态归属、刷新和失败恢复、重复提交、权限反馈，以及原先已确认的产品约定。没有声称穷尽所有参数与并发组合。

| 范围 | 本轮检查方式 |
| --- | --- |
| 登录、回跳、角色与重置密码 | 检查登录表单、回跳规则、Auth.js会话版本及管理员API；相关单元回归 |
| 首页上传、创建与项目列表 | 真实组件隔离浏览器；创建响应异常重试；项目删除/恢复集成及浏览器回归 |
| 工作台初始化、模型、联网、逐张/整套 | 源码追踪；刷新、旧设置、只读场景的浏览器复现；异步状态竞态复现 |
| 对话引用、产品档案、参考适配、方案冻结 | 服务端与卡片检查；数据库集成回归及单元测试 |
| 生成、单张生图、修改、换色、蒙版、扩图与重试 | 提交链路、报价和幂等检查；相关单元/集成和工作台浏览器回归 |
| 画布布局、隐藏找回、版本、收起展开 | 现有隔离浏览器与布局集成回归 |
| 收藏保存与复用、Listing导入审核 | 源码与单元/集成；导入后列表刷新失败的浏览器复现 |
| 终稿、下载与ZIP导出 | 检查选中终稿、部分导出、缩放说明和审计文件路径；原ZIP/文件名单元回归 |
| 模型管理、用户管理、网关管理 | 当前入口及API检查；网关结果标签浏览器复现 |
| 旧产品资料页、旧图包页、占位页面 | 静态检查与当前调用链核对，未逐一做所有表单组合的浏览器操作 |

所有浏览器复现都拦截业务API。集成测试仅在本地数据库/存储创建并清理各自的临时数据，使用模拟模型；执行时额外关闭联网并把模型端点设为不通的本机端口，防止意外调用真实模型。没有截图或真实出图效果验收。

## 初审问题清单（修复前）

### 1. [P1] 刷新页面会再次触发失败的识别

- 触发：从首页进入带`init=1`的工作台，首次识别失败且尚未产生卡片，然后直接刷新。
- 结果：只刷新一次就出现第二次`inspect`请求，没有点击“重试”。如果上游已经处理、只是响应未确认，可能再次调用模型并产生费用。
- 原因：初始化标记仅在组件内存中；每次重新进入都根据URL的`init=1`和卡片数量决定是否识别，没有复用识别尝试编号或失败状态。
- 证据：隔离浏览器观察到`inspectPosts=2`、`explicitRetryClicks=0`。
- 位置：[工作台初始化](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/live-workspace.tsx:51)。
- 建议：首次初始化消费后清除参数，并以已记录的识别尝试去重；失败后提供明确的人工重试路径。

### 2. [P1] 切换项目后，旧请求会把全局工作台状态写回旧项目

- 触发：A项目操作尚未返回时，进入B项目；随后A操作完成。
- 结果：URL和画布会话仍属于B，全局`snapshot`却被改成A。随后快速发送消息或操作图片可能指向错误项目。
- 原因：`act`完成后无条件调用`load(id)`；`loadVersion`只对请求先后排序，不校验请求是否属于当前活动项目。旧操作完成后新发出的A读取反而获得最新序号。旧对话请求的收尾加载也有同类风险。
- 证据：对真实store做延迟响应复现，切换后先显示B，释放A响应后显示A，而`canvasSession.productId`仍为B。没有对用户项目执行写操作。
- 位置：[操作完成后的加载](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/live-store.ts:33)、[全局快照写入](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/live-store.ts:24)。
- 建议：按活动项目和请求代次校验所有异步回写，包括`finally`里的刷新；离开项目后丢弃它的UI回写。

### 3. [P1] Listing导入成功后的列表刷新失败，会引导用户重复提交模型拆解

- 触发：导入POST成功，紧接着刷新经验库列表失败；用户重选同一文件夹重试。
- 结果：再次发起导入。服务端每次生成新导入ID并再次执行分析，可能重复消费模型调用。
- 原因：上传与后续读取处于同一个错误处理范围，没有保存已成功的导入结果；请求也没有可复用的提交编号。
- 证据：隔离浏览器模拟“导入已成功，列表读取503”，重选后`importPosts=2`。重复分析的实际调用位置通过源码确认，本轮未调用付费模型。
- 位置：[导入与列表刷新](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/listing-import.tsx:15)、[新建导入ID](/C:/Users/Administrator/Projects/furniture-ai-studio/src/lib/listing-import.ts:19)、[模型分析](/C:/Users/Administrator/Projects/furniture-ai-studio/src/lib/listing-import.ts:22)。
- 建议：区分“导入成功、列表未刷新”和“导入未确认”，成功后只重试读取；同次未确认提交复用编号。

### 4. [P2] 首页创建项目在响应丢失后重试，可能重复创建

- 触发：服务端已经创建项目，但响应未被客户端确认，用户再次发送。
- 结果：重新POST整个创建表单；默认SKU每次重新生成，可能留下两个项目。指定相同SKU时则可能只能收到冲突错误，无法从重试结果恢复已创建项目。
- 证据：隔离浏览器重试发送了两次创建POST，均无`requestKey`；服务端创建路径无提交去重。
- 位置：[首页创建请求](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/live-store.ts:23)、[每次新建产品](/C:/Users/Administrator/Projects/furniture-ai-studio/src/lib/studio-main.ts:44)。
- 建议：为一次创建意图生成稳定编号，响应不确定时沿用，并能返回已创建的项目。

### 5. [P2] 模型、联网或分辨率调整后，刷新会恢复服务端旧值

- 触发：在工作台修改设置，尚未发送消息或执行生成等动作时刷新。
- 结果：刚改的设置丢失。联网开关已用真实组件复现；同一保存路径也覆盖模型和分辨率。
- 原因：控件只更新本地共享模型store；重新进入会重建`demoSession`并套回服务端设置。界面没有显示设置待保存，也没有独立保存动作。
- 证据：联网从关改为开，刷新后恢复关；期间设置POST为0。
- 位置：[联网控件](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/model-picker.tsx:45)、[进入页面恢复旧设置](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/live-workspace.tsx:51)。
- 建议：按项目保存设置变更，或明确展示尚未应用的状态，并避免进入页面时静默覆盖它。

### 6. [P2] 不完整的历史模型设置可能让工作台前端崩溃

- 触发：会话存在`agentId`，但没有`imageIds`。服务端的`StudioSettings`允许这些字段缺省。
- 结果：初始化把`imageIds:undefined`写入前端选择，随后`raw.imageIds.filter(...)`抛异常。
- 证据：隔离浏览器收到`Cannot read properties of undefined (reading 'filter')`。
- 当前数据边界：只读检查了本地6个现有会话，未发现这类缺项；这是已复现的兼容性缺陷，不表示当前6个会话都已受影响。
- 位置：[恢复设置](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/live-workspace.tsx:51)、[直接读取数组](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/model-store.ts:28)。
- 建议：只覆盖实际存在的字段，并在进入前端store前补齐默认值。

### 7. [P2] 上次移除预估费用仍漏了服务端自动消息

- 触发：图片修改先调用`edit_quote`，随后工作台刷新。
- 结果：服务端仍会写入“本次修改预计 $…（估），提交后开始。”，对话组件会显示这条系统消息；所以前端费用标签移除后，价格仍可能再次出现。
- 证据：报价分支明确执行`db.chatMessage.create`；当前消息渲染只排除特定系统文本，没有排除此类费用消息。这是本轮静态检查确认的遗漏，没有为了复现而提交真实修改。
- 位置：[报价时写费用消息](/C:/Users/Administrator/Projects/furniture-ai-studio/src/app/api/studio/[id]/route.ts:49)。
- 建议：停止创建新的操作预估消息，保留后台报价和账本；旧消息的展示另作兼容处理，不删除审计记录。

### 8. [P2] 只读账号仍能进入注定被拒绝的识别等操作

- 触发：只读成员打开工作台，点击“识别实拍与产品资料”。
- 结果：按钮可点，之后才收到403。角色限制也没有统一进入聊天和部分阶段操作的禁用条件。
- 证据：隔离浏览器中，画布API已返回`canWrite:false`，识别按钮仍启用，点击后产生1次被拒绝的POST。
- 安全边界：服务端权限校验正常，本项是交互反馈问题，不是已证实的越权。
- 位置：[识别按钮](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/design-preview/live-workspace.tsx:114)。
- 建议：统一使用真实账号/画布写权限控制需要写入或调用模型的入口，并显示只读原因。

### 9. [P2] KIE卡片的LLM测试结果会被错误标记为KIE

- 触发：在KIE网关卡片点击“连通性测试 · LLM（ZenMux）”。
- 结果：后端按既定规则实际测试ZenMux并返回`provider:zenmux`，前端却使用请求中原来的`provider:kie`拼结果提示，显示“KIE：…”。
- 证据：隔离浏览器实际得到提示“KIE：模拟ZenMux结果”。本轮测试的是显示逻辑，没有发送真实模型请求。
- 位置：[前端结果提示](/C:/Users/Administrator/Projects/furniture-ai-studio/src/components/gateway-manager.tsx:16)、[服务端实际线路](/C:/Users/Administrator/Projects/furniture-ai-studio/src/app/api/admin/gateways/test/route.ts:16)。
- 建议：按返回的实际provider显示结果，避免管理员据此误判线路可用性。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过 |
| `npm run test:units` | 207项通过 |
| 本地数据库/存储集成 | 8项中7项通过、1项失败，见下文 |
| 现有工作台与项目删除隔离浏览器回归 | 2项通过 |
| 本轮新增异常场景探针 | 7项浏览器复现成功，加1项store竞态复现成功；“成功”表示触发并确认了问题，不是问题已修复 |

集成失败位于[conversation-references.test.ts](/C:/Users/Administrator/Projects/furniture-ai-studio/tests/integration/conversation-references.test.ts:41)：旧断言期望参考数组没有`mode`，实际多出`mode:"prompt_only"`。实际值符合11月9日起新对话参考的既定规则，这条断言需要更新；不能据此退回产品行为，也不能把本轮集成测试写成全部通过。

本轮临时复现脚本保存在`.local/review-interactions.spec.ts`、`.local/review-playwright.config.ts`和`.local/review-store-race.ts`，均为忽略的本地审查资料。其余日志为`.local/review-units.log`和`.local/review-integrations.log`。后续修复时应把相应探针转为验证正确行为的正式回归测试。

## 修复顺序建议

先处理1、2、3，控制重复模型请求和跨项目状态回写；随后处理4、5、7的提交恢复及当前界面约定；6作为旧数据兼容收口，8、9修正权限反馈和后台排障信息。真实模型联网、真实生图效果及所有旧页面组合未做实测，不以本地模拟代替这些验收。

# UI 验收已知基线问题

## KI-001（偶发）：生成测试的排队超时预留断言失败

- 确认基线：`a1e3f51`（阶段 0 审计基于 `7378acd`），用户于阶段 1 明确接受此项为已知失败。
- 复现命令：`npm run test:generation`。需要本地 PostgreSQL、MinIO；脚本创建随机隔离数据库、使用本地模拟网关并清理测试数据，不调用付费模型。
- 现象：`scripts/verify-generation.ts:145` 检查排队超时任务 `expiredQueued.reservedUsd`，实际 `$0.03`、预期 `$0`，触发 `ERR_ASSERTION`，命令 exit 1。该断言之后的测试尚未执行，不能计为通过。
- 相关位置：`scripts/verify-generation.ts:137–146` 的超时夹具和断言；`src/lib/generation-queue.ts` 的 `expireOverdueJobs`；`src/lib/scene-generation.ts` 的 `createSceneJob` / `enqueueImageJob`；`src/lib/image-router.ts` 的提交标记与预留处理。
- 边界：涉及计费、配额预留和队列，不属于 UI 任务。本轮不修改实现、测试预期或费用逻辑，也不跳过此测试。
- 后续 UI 阶段验收：按用户2a修订，作为偶发问题，不要求复现失败，只要求没有新的失败类型。如再次出现，记录时间、命令、断言和值及日志路径；不修改计费或队列。每次实测通过/失败如实报告，不据偶尔通过宣称已修复。
- 阶段 1 实测补充：原样复跑两次均 exit 0，完整模拟验收通过，未复现该断言。`scripts/verify-generation.ts`、费用、队列与提交标记代码均无改动。因此本轮无法证明失败每次都可复现，也不把这两次通过视为问题已修复；继续保留 KI-001，后续仍按原命令复查。阶段 0 的失败证据见 `phase0.md`，阶段 1 结果见 `phase1.md`。
- 阶段2a原样模拟验收exit0，未复现。日志：`.local/verification/ui-phase2a/generation.log`，结果汇总见phase2a.md；不宣称修复。

- 阶段2b：2026-10-29原样test:generation通过，未复现KI-001；日志`.local/verification/ui-phase2b/generation.log`。费用、队列实现及断言未修改。

## KI-002：视觉方案浏览器用例的初始化竞态

- 位置：`tests/visual-plan.spec.ts`，竞品参考链接输入步骤。
- 现象：页面初始 GET 在测试填值之后返回，受控输入恢复服务器初始状态，覆盖刚填入的链接，提交时得到空链接数组。阶段 2a 完整回归中曾出现一次。
- 已做改动：在页面标题出现后、填写竞品链接前增加 `await page.waitForLoadState("networkidle")`，等待初始化读取结束。未修改业务组件或 API。
- 没有削弱断言：保存后的链接和上传结果仍按原断言检查；完整回归重跑 10 项通过，2 项专用 Agent 按设计另跑。
- 复现/复查：`npm run test:e2e -- tests/visual-plan.spec.ts`；日志见 `.local/verification/ui-phase2a/e2e-final.log` 与 `e2e-acceptance.log`。

## KI-003：模板导航后立即退出的会话读取竞态（待独立排查）

- 位置：`tests/auth.spec.ts` 的 `loginAfterLogout`；生产会话读取与退出链路待另开任务定位。
- 现象：导航到模板页后立即退出，偶发没有停留在登录页，而落回首页；可能有尚未完成的会话读取/导航竞态，尚未确认根因。
- 阶段2b测试改动仅在模板导航后增加 `await page.waitForLoadState("networkidle")`，等待读取结束；退出、重新登录和角色断言均保留。鉴权逻辑没有修改，也不宣称竞态已修复。
- 复查命令：`npm run test:e2e -- tests/auth.spec.ts`；阶段2b日志：`.local/verification/ui-phase2b/e2e-review-build.log`。需另开业务任务排查，阶段3准备不修改鉴权。

## CR-001：SKU封面只读目录接口改动（用户已追认）

- 来源：`8ee08e2` 的 `ui(phase3-prep-fix)`。为封面显示美工已选主图，修改了 `src/app/api/studio/route.ts` 的 `GET /api/studio`。
- 内容：当前图包图位增加 `slotType` 字段并按 `order` 排序；实拍按 `sortOrder`、`createdAt` 排序后取首张。没有修改POST、数据库数据、生成、费用、预留或队列。
- 影响：SKU图库封面优先读取已选 `main`，无主图时回退首张实拍；响应增加字段，原客户端字段保留。界面在 `live-workspace.tsx` 消费。
- 超出原定“不改API”边界，用户在本轮明确追认。**后续任何接口改动都必须先停下询问，不能自行扩展。** 本轮fix2与3a仅复用现有接口。
- 验证：上轮106单元、7环境检查、5数据库集成、常规浏览器10通过/2专用跳过、专用Agent2通过；另6组真实图库比例、主图来源、contain/cover、悬停不移位验证通过。证据：`phase3-prep-fix.md` 及 `phase3-prep-fix-interactions/checks.json`。

## 其他基线说明

- `npm run test:e2e` 中 `tests/agent.spec.ts` 的两项用例原本就要求通过 `npm run test:agent:browser` 在隔离数据库与本地 mock 网关下单独运行；常规回归显示 2 skipped 是设计行为。
- 阶段 0 的专用 Agent 浏览器回归首次被本地 Next.js 安全升级提醒中断，原命令重跑后 2/2 通过。终端仍提示当前 Next.js 版本存在已知安全问题；本次 UI 任务不更改依赖。
- 阶段 0 和阶段 1 截图可见的窄屏蒙版工具条/底部输入区域裁切属于原有布局；阶段 1 仅保持原视觉，交互布局留待阶段 3。

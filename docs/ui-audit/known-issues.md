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

## KI-002：视觉方案浏览器用例的初始化竞态

- 位置：`tests/visual-plan.spec.ts`，竞品参考链接输入步骤。
- 现象：页面初始 GET 在测试填值之后返回，受控输入恢复服务器初始状态，覆盖刚填入的链接，提交时得到空链接数组。阶段 2a 完整回归中曾出现一次。
- 已做改动：在页面标题出现后、填写竞品链接前增加 `await page.waitForLoadState("networkidle")`，等待初始化读取结束。未修改业务组件或 API。
- 没有削弱断言：保存后的链接和上传结果仍按原断言检查；完整回归重跑 10 项通过，2 项专用 Agent 按设计另跑。
- 复现/复查：`npm run test:e2e -- tests/visual-plan.spec.ts`；日志见 `.local/verification/ui-phase2a/e2e-final.log` 与 `e2e-acceptance.log`。

## 其他基线说明

- `npm run test:e2e` 中 `tests/agent.spec.ts` 的两项用例原本就要求通过 `npm run test:agent:browser` 在隔离数据库与本地 mock 网关下单独运行；常规回归显示 2 skipped 是设计行为。
- 阶段 0 的专用 Agent 浏览器回归首次被本地 Next.js 安全升级提醒中断，原命令重跑后 2/2 通过。终端仍提示当前 Next.js 版本存在已知安全问题；本次 UI 任务不更改依赖。
- 阶段 0 和阶段 1 截图可见的窄屏蒙版工具条/底部输入区域裁切属于原有布局；阶段 1 仅保持原视觉，交互布局留待阶段 3。

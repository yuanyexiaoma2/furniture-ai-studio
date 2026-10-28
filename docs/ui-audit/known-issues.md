# UI 验收已知基线问题

## KI-001：生成测试的排队超时预留断言失败

- 确认基线：`a1e3f51`（阶段 0 审计基于 `7378acd`），用户于阶段 1 明确接受此项为已知失败。
- 复现命令：`npm run test:generation`。需要本地 PostgreSQL、MinIO；脚本创建随机隔离数据库、使用本地模拟网关并清理测试数据，不调用付费模型。
- 现象：`scripts/verify-generation.ts:145` 检查排队超时任务 `expiredQueued.reservedUsd`，实际 `$0.03`、预期 `$0`，触发 `ERR_ASSERTION`，命令 exit 1。该断言之后的测试尚未执行，不能计为通过。
- 相关位置：`scripts/verify-generation.ts:137–146` 的超时夹具和断言；`src/lib/generation-queue.ts` 的 `expireOverdueJobs`；`src/lib/scene-generation.ts` 的 `createSceneJob` / `enqueueImageJob`；`src/lib/image-router.ts` 的提交标记与预留处理。
- 边界：涉及计费、配额预留和队列，不属于 UI 任务。本轮不修改实现、测试预期或费用逻辑，也不跳过此测试。
- 后续 UI 阶段验收：复跑该命令，确认仍是同一断言、相同实际值与预期值；其余检查不得新增失败。此项不得报告为测试通过。根因和修复需另行安排。
- 阶段 1 实测补充：原样复跑两次均 exit 0，完整模拟验收通过，未复现该断言。`scripts/verify-generation.ts`、费用、队列与提交标记代码均无改动。因此本轮无法证明失败每次都可复现，也不把这两次通过视为问题已修复；继续保留 KI-001，后续仍按原命令复查。阶段 0 的失败证据见 `phase0.md`，阶段 1 结果见 `phase1.md`。

## 其他基线说明

- `npm run test:e2e` 中 `tests/agent.spec.ts` 的两项用例原本就要求通过 `npm run test:agent:browser` 在隔离数据库与本地 mock 网关下单独运行；常规回归显示 2 skipped 是设计行为。
- 阶段 0 的专用 Agent 浏览器回归首次被本地 Next.js 安全升级提醒中断，原命令重跑后 2/2 通过。终端仍提示当前 Next.js 版本存在已知安全问题；本次 UI 任务不更改依赖。
- 阶段 0 和阶段 1 截图可见的窄屏蒙版工具条/底部输入区域裁切属于原有布局；阶段 1 仅保持原视觉，交互布局留待阶段 3。

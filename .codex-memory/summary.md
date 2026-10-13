# 项目记忆

任务 2 已于 2026-10-13 恢复。生成 API / UI、月度积分原子预留、pg-boss 事务入队、持久记录与候选图下载已实现。lint、typecheck、build、登录权限及商品页浏览器测试、隔离生成测试通过；尚未进行真实 KIE 家具生图或 push。

继续前阅读 [任务 2 续作记录](../docs/task-2-progress.md)。缺少 TEST-001 的 2～3 张同一家具不同角度实拍图片路径和身份特征，用户问题已发出。模拟验收不能替代真实图，最终必须记录真实 taskId / 耗时 / MinIO key。

网页与 KIE worker 已后台启动，PostgreSQL / MinIO 运行正常。日志位于 .local/；不要等待常驻进程退出，不要重复启动服务。常规 Windows 沙箱失败时本机可用已获自动审批的 escalated exec。Python 命令是 WindowsApps 占位入口，实际未安装；记忆维护用 Node UTF-8 文件读写，测试用已有 Playwright / TypeScript。

积分 cost 按北京时间自然月记录；明确未提交 / 被拒绝释放预留，已提交或扣费不确定保留，需人工核对。后台页面 403 使用 Next.js forbidden()，experimental.authInterrupts 已开启并通过权限回归。

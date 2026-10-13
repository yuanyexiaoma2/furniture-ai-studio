# 图片工作流升级（2026-10-13）

用户已上传真实产品完成生成测试，要求改善实拍上传与管理、扩展分辨率和比例，并增加不满意结果的二次编辑。当前仅使用 KIE Nano Banana 2.1，API 模型与字段没有变化。

## 当前行为

- 本地图片拖入参考区域即上传；选择文件也自动上传。保留 JPEG / PNG / WEBP、单张 30MB、每件商品 3 张上限。
- 删除实拍只移出当前参考列表，释放上传名额；保留 Asset / 文件供旧任务的快照使用。生成结果和旧任务不删除。
- 图片可拖动排序，提供左右按钮用于手机及键盘操作；排序立即写入数据库，刷新后保留，后续任务按此顺序上传并提交。
- 2K 默认 6 积分，4K 为 9 积分，场景与编辑共用参数配置和服务端配额校验。全部 15 个官方比例均可选择，包含 auto。
- 已完成的图片有“二次编辑”按钮，面板显示选中原图、文字修改要求、分辨率和比例。编辑创建独立 GenerationJob，logicalModel 为 edit，input 保存 sourceJobId / sourceAssetId / editIntent。
- 服务端核对原图为当前商品成功任务的 generated Asset，使用“原图第一、当前实拍随后”的顺序，加上产品身份特征约束。新版本可再编辑，原图与来源链保留。
- viewer 不可上传、删除、排序或编辑；写入需同源且已登录，源图不能通过客户端 ID 绕过商品与状态检查。

## 数据与接口

- 增量迁移：20261013020000_reference_management，仅给 Asset 新增 sortOrder / deletedAt 并回填原实拍顺序，不重置数据库。
- 上传：POST /api/products/[id]/photos。
- 排序：PATCH /api/products/[id]/photos，提交完整、不重复的 photoIds 列表；并发素材变更返回 409。
- 删除：DELETE /api/products/[id]/photos/[assetId]。
- 场景：POST /api/products/[id]/generations，新增 resolution；未填写时仍默认 2K。
- 编辑：POST /api/products/[id]/edits，提交来源任务与 Asset ID、修改要求、比例及分辨率。价格、提示词和参考 ID 均由服务端确定，不接收客户端成本或任意参考 URL。
- 上传、删除、排序与任务参考快照使用同一商品事务锁，配额继续使用用户行锁和 pg-boss 同事务入队。

## 验收

- lint、typecheck、生产构建通过。
- 扩展 test:generation 通过：15 比例、4K 定价及额度不足、排序快照、拒绝重复排序和错误源图、删除后旧排队任务仍可执行、原图不变、新编辑版本及连续编辑。
- 扩展商品浏览器测试通过：文件拖入即上传、原生拖动排序、刷新顺序留存、左右按钮、删除后再次上传、分辨率和动态费用、4K / 21:9 场景提交参数、选中原图 4K / auto 编辑参数、viewer 限制。
- UI 最终提交在浏览器层拦截，KIE 任务在随机隔离数据库与本地模拟服务验证，自动验收未消耗真实积分。实际二次编辑效果待用户使用时判断。
- 桌面与 390px 手机截图已检查，样式断言保证拖放区与分辨率控件正确显示。开发服务一度保留旧 CSS，重启网页后确认最新规则加载；没有阻塞等待常驻服务退出。
- 升级前已有真实产品与素材在 .local/product-before-upgrade.json 记录 ID；升级后只读核对确认 1 个产品、3 个文件和成功生成记录全部保留，MinIO HEAD 检查通过。临时测试商品、素材和数据库已清理。

## 运行

已有网页和 worker 在后台运行，刷新 http://localhost:3000 即可使用。新环境运行 prisma migrate deploy、prisma generate 后启动网页与 worker。不要重复启动正在运行的常驻服务。

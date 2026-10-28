# Task 11-C：收口与盲测准备

日期：2026-10-28（北京时间）

## 已接通的流程

- 产品资料入口沿用正式工作台产品卡 → 产品资料；保留参数、卖点、身份全文、主图与不同角度实拍的排序/替换/删除。新增补充图和参数文件列表、竞品截图与链接输入；不创建或绑定额外SKU。
- 场景候选优先来自场景经验，Agent可提出有依据的新方向进入本次场景池；道具池来自可检索的prop_pool，无经验时由Agent提出本次通用品类道具池。美工从池中点选。没有添加图像细节质检或自动修复循环。
- 组合去重范围为本SKU全部历史 + 同品类按创建时间最近的5个其它SKU；确认快照保留排除组合，不因随后编辑或报价而丢失去重依据。
- 关键图位4–7、8提供2–3个方向，各含一句理由及完整画面描述；未选方向不能确认。确认后所有画面字段、身份与来源冻结，继续由原报价/提交/生成链读取。
- AgentCard.data保留originalVisualPlan、confirmedVisualPlan、planDiff、确认人和时间。按意见重写保留首次原案，旧卡保留取消状态；不自动把美工修改灌入公共经验库。
- 竞品截图最多10张（建议5–10张）；Agent按图片顺序逐张拆解空间、道具、陈列、卖点讲法、机位，再归纳常见套路、同质化与机会。图片引用作为方案依据。直链或网页og:image可读时尝试看图，失败明确提示补截图，不臆测页面视觉。
- 没有可用参考图，方案顶部显示“未提供竞品参考，方案仅基于经验库”。联网只提供低权重文字补充。
- /library支持选择单个历史Listing文件夹：1–30张JPEG/PNG/WebP，加可选TXT/JSON参数，总计100MB以内。上传顺序按文件名排序；原图转存后Agent拆解为场景/道具池/卖点表达/图位顺序，父case先为draft。美工查看原图、编辑条目并审核后才写入ready经验；保留原拆解与审核内容，重复审核不重复入库。
- 使用现有StudioLibraryEntry和Product.visualResearch JSON存储；本轮无Prisma迁移、无数据删除。

## 本地评审页

每次提出或重写方案、确认方案、成功保存样图后更新docs/review/<sku>.html。方案卡片、方向理由、后期要求、依据、样图与修改版本、确认差异同页展示；图片复制到同名-assets目录，离线可读。HTML转义，文件名限制在评审目录；导出失败仅记录本地服务端错误，不把已经成功的图片任务改为失败。

当前评审页： [NEW-MVQFFV1P](review/NEW-MVQFFV1P.html)。

该页展示11-B已有的真实9图方案及6个真实生成/修改版本，属于历史基线，不冒充11-C新规划或新出图。11-C多方向和导入审核通过模拟Agent与真实浏览器/数据库验证；没有为此新增付费生图。

## Google Search最小验证

- 官方协议：[ZenMux Web Search](https://zenmux.ai/docs/guide/advanced/web-search.html)，OpenAI兼容Chat Completions使用web_search_options，读取message.annotations中的url_citation；不信任模型正文自行列出的链接作为grounding证据。
- 已删除当前业务对Tavily的依赖。既有SearchCall账单和历史搜索记录保留；新的可选搜索通过原chatWithGateway作为LLM调用审计、配额检查及账单回填，不增加搜索单价或修改费用算法。
- 一次最小模型请求尝试使用当前配置的ZenMux Gemini 3.8 Flash，搜索一个鞋收纳关键词和官方来源；本机连接失败，未获得带来源的结果，不能据此断言模型不支持。详见 [验证记录](review/grounding-verification.json)。
- GOOGLE_SEARCH_ENABLED默认false；本轮保持关闭。失败或无annotations来源都不阻塞参考图/经验库规划。不绕开网关、不自动替换模型、不增设另一家搜索服务。

## 验证范围

- 最终lint、typecheck、生产build通过。构建工具曾提示现有Next版本安全升级；本轮未升级框架，原构建命令最终成功。
- 原94项纯单元 + 8项11-C单元：方向选择、池子、历史组合、确认差异、竞品引用、导入审核、HTML评审页与Google Search协议。
- 新增真实PostgreSQL/MinIO集成验证：同品类最近5个SKU、方向未选拒绝/点选冻结/原案差异、缓存更新、单文件夹模拟Agent拆解→待审→审核→可检索，未调用付费模型。
- 原3项数据库集成、模拟生成全链路和Agent全链路；更新隔离浏览器Agent测试，先选择方向再确认。
- 浏览器覆盖产品资料、竞品上传与链接保存、多方向卡片、场景/道具池、版本回退、画布蒙版、文件夹待审与审核；导入的Agent回复在浏览器测试中模拟，真实存储/审核由集成测试覆盖。
- 截图、录像、GIF均未制作。真实外部出图请求为0。

## Docker恢复

启动失败日志定位到两组无法被Windows重命名的残留Unix socket。完全停止Desktop后，同时可恢复重命名Docker/run和docker-secrets-engine的临时socket目录，再启动Desktop。未恢复出厂、未重建容器卷、未清空数据库。

恢复后Postgres健康、MinIO readiness为200，3个产品/41个素材/31条生成/60条库记录可读，历史生成图片可完整读取。Docker、网页和worker恢复后再做回归。

## 保持不变

gateway-cost、quota、quota-math、generation-queue、image-router、gateway-router、KIE和ZenMux生图Provider均不修改。save-generation-result只在原成功事务完成后导出评审页；原费用汇总、预留释放和账本事务保留。

## 当前限制

- Google Search联网支持性因连接失败未确认，默认关闭。
- 受限页面、无og:image的商品链接可能读不到图，需要截图；最多分析10张参考图。
- 未额外执行真实规划/历史Listing语义质量盲测或新出图；现有样图按要求只粗检结构和场景，细节留待重生成/局部修改。


最终回归：102项纯单元、4项数据库集成、常规浏览器9项通过（2项按隔离设计跳过），另行运行的隔离Agent浏览器2项通过；模拟生成/Agent全链路通过。隔离3105服务已清理，主库数据数量保持不变。

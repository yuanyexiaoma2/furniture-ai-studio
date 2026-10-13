# KIE 官方文档核实（2026-10-12）

2026-10-13 续作及升级复核：官方 [产品页](https://kie.ai/zh-CN/nano-banana-2-1) 与 [API 示例](https://docs.kie.ai/market/google/nanobanana-2-1) 确认 `nano-banana-2-1`、`image_input`、2K 6 积分、4K 9 积分及小写 `png`，未发现字段差异。用户随后自主完成真实产品测试，数据库有成功记录与转存文件；交互升级自动验收没有额外调用付费 API。

## 1. 模型上线、价格与输入输出

- Nano Banana 2.1 已在 KIE 产品页上线。本项目使用该版本，不使用预计 2026-10-29 下线的旧版。来源：[产品页](https://kie.ai/zh-CN/nano-banana-2-1)。
- 价格：1K 4 积分（$0.02），2K 6 积分（$0.03），4K 9 积分（$0.045）。来源：[产品页](https://kie.ai/zh-CN/nano-banana-2-1)。
- 参考图：JPEG / PNG / WEBP，单张不超过 30 MB，最多 10 张；本任务的商品实拍图限定 2～3 张。来源：[产品页](https://kie.ai/zh-CN/nano-banana-2-1)、[API 文档](https://docs.kie.ai/market/google/nanobanana-2-1)。
- 支持比例：1:1、2:3、3:2、1:4、4:1、3:4、4:3、4:5、5:4、1:8、8:1、9:16、16:9、21:9、auto。输出分辨率：1K / 2K / 4K；格式：jpg / png（小写）。2026-10-13 按用户反馈，UI 已提供全部比例和 2K / 4K，默认 2K / png。来源：[产品页字段列表](https://kie.ai/zh-CN/nano-banana-2-1)、[API 文档](https://docs.kie.ai/market/google/nanobanana-2-1)。

## 2. 创建任务：已核实的准确模型 ID

- 官方 API 文档请求示例明确写出 `model: "nano-banana-2-1"`。这是 API 模型值，未由产品页 URL 推测。来源：[英文 API 文档](https://docs.kie.ai/market/google/nanobanana-2-1)、[中文 API 文档](https://docs.kie.ai/cn/market/google/nanobanana-2-1)。
- `POST https://api.kie.ai/api/v1/jobs/createTask`，使用 `Authorization: Bearer <KIE_API_KEY>`。响应包含 `code`、`msg`、`data.taskId`。来源：[API 文档](https://docs.kie.ai/market/google/nanobanana-2-1)。
- 请求字段为顶层 `model`、可选 `callBackUrl` 和 `input`；输入字段为 `prompt`、`image_input`（上传后的 URL 数组）、`aspect_ratio`、`resolution`、`output_format`。提示词上限 20000 字符。与用户指定字段一致，无字段名差异；本地不发送 `callBackUrl`。来源：[API 文档](https://docs.kie.ai/market/google/nanobanana-2-1)。

```json
{
  "model": "nano-banana-2-1",
  "input": {
    "prompt": "完整场景提示词",
    "image_input": ["https://上传服务返回的公开URL"],
    "aspect_ratio": "1:1",
    "resolution": "2K",
    "output_format": "png"
  }
}
```

## 3. 查询状态与结果

- `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<taskId>`，同样使用 Bearer 认证。响应为 `{ code, msg, data }`。来源：[获取任务详情](https://docs.kie.ai/market/common/get-task-detail)。
- `data.state`：waiting / queuing / generating 映射为 pending；success 映射为 success；fail 映射为 failed。成功时 `data.resultJson` 是 JSON 字符串，解析后的 `resultUrls` 是结果 URL 数组。失败信息为 `failCode` / `failMsg`；还可能返回 `costTime`、`createTime`、`completeTime`、`progress`、`creditsConsumed`。来源：[获取任务详情](https://docs.kie.ai/market/common/get-task-detail)。
- 即使 HTTP 200 也可能业务失败，必须检查 `code`；401 为无效/缺失密钥，422 为任务缺失或不属于当前账户。来源：[获取任务详情](https://docs.kie.ai/market/common/get-task-detail)。
- 生成结果仅保留 14 天，成功后立刻下载并保存至私有 MinIO `assets`，页面通过已登录的本站接口读取。来源：[获取任务详情](https://docs.kie.ai/market/common/get-task-detail)。
- 本地按任务要求每 5 秒轮询，10 分钟停止并记录中文失败原因。生产回调字段 `callBackUrl` 保留配置，本任务不实现回调接收。官方建议生产使用回调。来源：[获取任务详情](https://docs.kie.ai/market/common/get-task-detail)、[模型 API 文档](https://docs.kie.ai/market/google/nanobanana-2-1)。

## 4. 本地 / MinIO 文件上传

- 文件服务与生图 API 使用不同域名：`https://kieai.redpandaai.co`；使用同一 KIE Bearer 密钥。来源：[上传 Quickstart](https://docs.kie.ai/file-upload-api/quickstart)。
- 读取私有 MinIO 对象后调用 `POST https://kieai.redpandaai.co/api/file-stream-upload`，multipart 字段为 `file`、`uploadPath`、可选 `fileName`。响应检查 `success === true`、`code === 200`，参考图 URL 取自 `data.downloadUrl`。不能把 localhost MinIO 地址提交给 KIE。来源：[上传 Quickstart](https://docs.kie.ai/file-upload-api/quickstart)。
- 上传免费，但上传文件在 24 小时后删除：同一文件在有效期内复用缓存；缓存到期后必须刷新，不能永久只上传一次。本项目保留 1 小时安全余量，并用内容哈希与账户指纹缓存，避免重复上传。此处是对永久缓存要求的必要有效期处理。来源：[上传 Quickstart](https://docs.kie.ai/file-upload-api/quickstart)。

## 访问与核实说明

按要求依次核实产品页、模型 API、查询 API、上传 Quickstart。`/market` 索引未能直接读取，因此通过官方站内模型文档及查询页 Google 导航链接定位 2.1 API；模型页和上传 Quickstart 均另行读取官方 HTML 原文，模型 ID 来自可见请求示例。没有用搜索摘要替代 API 原文核实。

本阶段仅启用 KIE；ZenMux 尚未开通，不接入、不调用。

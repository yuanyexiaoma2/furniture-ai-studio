# 生图模型与默认网关 · 2026-10-27

智能体缺省为ZenMux的Gemini 3.8 Flash；生图和编辑的缺省网关为KIE。保留原来的默认Nano Banana 2.1，新增四个可手动选择的模型。现有明确保存的会话选择保留，手动指定模型后生成任务冻结对应candidate，不依靠模型名称猜网关。

体验入口：刷新工作台，点击“生图模型”。如需固定使用某一个模型，先关闭Auto再单选；当前Auto沿用原默认模型选择逻辑。

| 界面名称 | KIE模型ID | 参考图字段 | 分辨率 | 预估积分/张 |
| --- | --- | --- | --- | --- |
| Nano Banana 2.1（默认） | `nano-banana-2-1` | `image_input` | 1K/2K/4K | 4/6/9 |
| GPT Image 2.5 | `gpt-image-2-5-sunburst-image-to-image` | `input_urls` | 1K/2K/4K | 6/10/16 |
| Nano Banana 2 | `nano-banana-2` | `image_input` | 1K/2K/4K | 8/12/18 |
| Nano Banana Pro | `nano-banana-pro` | `image_input` | 1K/2K/4K | 18/18/24 |
| Qwen3 | `qwen3/image-to-image` | `image_urls` | 1K/2K | 输出4.8，输入参考图另加0.5/张 |

每积分按$0.005预估，实际账单回填沿用现有规则。Qwen3三张参考图的2K预估为6.3积分，即$0.0315；菜单按最多三张参考图显示约价，确认费用时按实际引用数计算，不把未返回的实际费用伪造为实耗。

GPT Image 2.5先接入偏重画质的Sunburst图生图版，使用`background: opaque`，不发送Nano Banana专属字段。Flare是官方另一个型号，本次没有额外增加选项。产品流程需要实拍参考，因此这里提供图生图接口。

Qwen3对应Qwen Image 3.0标准图生图模型，最多3张参考图、每张10MB、完整提示词最多5000字符，比例使用`image_size`，JPEG使用`jpeg`。关闭自动改写提示词，保留已确认产品特征。切换到Qwen3时原4K设置调整为2K，参数面板只显示1K/2K；服务端报价与提交前再次验证，不静默截断提示词或切换比例。修图按源图、蒙版、原始实拍的优先顺序取参考图：普通修图最多源图加2张实拍，带蒙版时保留源图、蒙版和1张实拍。其他模型保留全部现有引用。

Nano Banana 2最多10张、Pro最多8张、GPT Image 2.5最多16张参考图，均按官方30MB单图限制检查。新模型共用原有KIE限流、任务轮询/回调、立即转存S3、配额预留和GenerationJob/Attempt费用记录。模型选择不绕过方案及费用确认。

## 官方依据

- [GPT Image 2.5模型、参数和价格](https://kie.ai/gpt-image-2-5)，[Sunburst图生图API](https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-image-to-image)
- [Nano Banana 2模型和价格](https://kie.ai/nano-banana-2)，[API](https://docs.kie.ai/market/google/nanobanana2)
- [Nano Banana Pro模型和价格](https://kie.ai/nano-banana-pro)，[API](https://docs.kie.ai/market/google/pro-image-to-image)
- [Qwen3标准版价格卡](https://kie.ai/qwen-image-3?model=qwen3%2Fimage-to-image)，[API](https://docs.kie.ai/market/qwen3/image-to-image)。已在官方页面切换“Image To Image”标签核实标准版价格，不能套用默认打开的Pro价格。
- 原默认Nano Banana 2.1来源及价格见[既有KIE记录](kie-notes.md)。

## 运行与验证

```powershell
npm run configure:models
npm run dev -- --hostname 127.0.0.1 --port 3000
# 另开终端，已有worker需重启加载新适配器
npm run worker
npm run test:image-models
npx playwright test tests/models.spec.ts tests/canvas.spec.ts tests/packs.spec.ts
```

无需数据库迁移。登记命令只更新用户要求的模型目录，保留历史探测与调用记录，不做真实生图。新增模型尚未执行真实付费验证，生成效果由用户体验确认。

本次验证：lint、typecheck、生产build通过；原65项单测与新增3项适配单测通过；真实数据库集成覆盖五模型场景/修图预估、源图/蒙版优先及Qwen4K拒绝，未入队；3项浏览器回归覆盖真实模型菜单、默认网关、Qwen参数与刷新、画布及图包/终稿/导出。图包验证修正了旧断言：KIE实耗预估在现有界面显示“积分”，ZenMux折算才显示“KIE等值积分”。当前目录已登记，worker已重启并核对心跳健康（PID36120），没有真实生图任务被中断，也未提交付费请求。

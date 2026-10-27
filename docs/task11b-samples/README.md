# Task 11-B 真实验收样例

[完整视觉方案](plan.md) · [冻结JSON](plan.json) · [实际模型与费用记录](manifest.json)

输入：[原始1-主图](input-main.jpg)，来源为 F:/鞋架-WN81XJ01G2-马计委/1-主图.jpg。按用户本轮明确授权建立新产品任务并验收，未将JSON产品身份绑定到已有SKU；9条案例图引用仍待上传。

## 图位4–7

|图位|真实输出|最终提交提示词|
|---|---|---|
|4 门厅|[slot-4.png](slot-4.png)|[slot-4-prompt.txt](slot-4-prompt.txt)|
|5 楼梯口|[slot-5.png](slot-5.png)|[slot-5-prompt.txt](slot-5-prompt.txt)|
|6 衣帽间|[slot-6.png](slot-6.png)|[slot-6-prompt.txt](slot-6-prompt.txt)|
|7 客厅|[slot-7.png](slot-7.png)|[slot-7-prompt.txt](slot-7-prompt.txt)|

均为 KIE Nano Banana 2.1、2048×2048，各1张。实际任务ID、模型和文件哈希见 manifest.json。提示词保留实际提交原文，没有事后改写样例提示词。

## 对话修改

[修改前](conversation-before.png) → [修改后](conversation-after.png) · [最终提示词](conversation-edit-prompt.txt)

实际发送对话给默认ZenMux Agent，由 edit_image 工具判断整图范围，确认费用后通过原队列生成新版本。调整整图日光为中性早晨光线，并去掉布袋上的疑似字母痕迹；没有覆盖原图。调光变化较轻微，不能把它描述为大幅改色。

## 画布局部修改

[修改前](canvas-before.png) → [修改后](canvas-after.png) · [实际画布导出蒙版](canvas-mask.png) · [最终提示词](canvas-edit-prompt.txt)

在实际工作台选择图位6，打开局部重绘，使用矩形框选左侧斗柜台面的香水瓶区域，输入替换为无字无标签陶瓷摆件，上传蒙版并经原费用确认提交。未用脚本伪造蒙版代替画布操作。

[逐像素校验](canvas-pixel-check.json)：蒙版外4,081,891个像素全部保持一致；选区112,413个像素中111,703个有变化。基于原图像素与实际生成结果合成，不假称KIE提供原生mask参数。

## 费用与质量记录

- 6项真实图片任务全部成功，账本图片费用合计 $0.150000；LLM记录合计 $0.112922，其中含连接失败时保留的预估，不等同全为最终实扣。详细分项见manifest。
- 竞品研究因为未配置Tavily明确跳过，没有虚构来源或研究结果。
- 只有一张主图；材质是模型的视觉推测，未得到产品资料独立确认。
- 候选存在模型遵循性问题：楼梯装饰画细字、香水标签、客厅书脊/蜡烛文字和电子钟数字仍出现。示例没有自动设为终稿或标为优秀。对话与局部编辑演示修掉部分目标区域。
- 统一最终约束已补充配饰素面、书脊无字和时钟屏幕留白；四张样图没有额外付费重跑，不把新提示规则冒充本次已验证效果。
- 无浏览器截图、录屏或GIF。

工作台：[本机查看](http://localhost:3000/workspace?sku=cmvqffv200000bcv8bnmu03xt)。

# 首页玄关桌卡片素材

最新状态：用户进一步明确指定自己的API与Banana 2.1制作功能效果封面。当前首页使用`public/design-preview/home-banana`中的新素材，真实模型调用记录与提示词见`home-banana-generation-2026-11-17.json`。下面是已被替换的早期内置生图方案历史。

当前状态：用户否定下述生成素材中的产品变形与繁杂标注，首页已停止使用entryway-wide、console-cutout及entryway-black，仅引用三个用户原图的等比WebP副本。卡片仅保留图片及功能名称；以下生成记录保留追溯，不作为当前页面视觉说明。

用户授权使用其提供的玄关桌照片制作首页功能封面，并可调用生成工具，以视觉效果为重点。本轮使用内置 image_gen，生成两张横向场景与一张透明产品素材；未通过业务队列生成，也未改动产品、任务或费用记录。

## 素材与使用位置

项目素材目录：`public/design-preview/home-console/`。原始文件保持不变，部署素材使用 WebP 压缩及等比缩小。

| 文件 | 来源 | 使用 |
| --- | --- | --- |
| console-rustic.webp | 用户 BF189XG01 的 1-主图.jpg | 套图主图、材质细节、木色对比 |
| console-black.webp | 用户 BB189XG01 的 1-主图.jpg | 黑色款对比 |
| entryway-original.webp | 用户 BF189XG01 的 4-入户门.jpg | 套图场景、精修背景 |
| entryway-wide.webp | image_gen，原场景及木色主图作为参考 | 扩图示意 |
| console-cutout.webp | image_gen，木色主图作为编辑来源 | 抠图展示；保留真实 alpha 通道 |
| entryway-black.webp | image_gen，黑色主图作为参考 | 单张生图示意 |

各封面分别使用拼版、细节放大、双配色、扩展框、透明网格与完整场景。装饰标签与原功能标题区分，窄屏隐藏次要图片标注，功能按钮与跳转不变。生成素材是首页示例，不代表对业务抠图透明输出或生产级产品一致性的验收。

## 生成提示词

### entryway-wide.webp

参考顺序：用户场景图、木色主图。透明背景关闭。

> Create ONE premium photorealistic furniture editorial photograph for a website feature thumbnail, landscape 16:10. Image 1 is the existing styled entryway scene to extend/recompose as a wider landscape photograph. Image 2 is the exact product identity reference. Preserve this precise rustic brown console table: very long narrow top with visible center seam, dark rustic brown wood texture, black rectangular metal legs with small diagonal brackets beneath the top, single low long brown shelf. No drawers, no extra shelves, no product redesign, no changed color. Preserve lamp, round mirror, books and natural ceramic vase with muted eucalyptus from image 1, but make a refined airy landscape composition with entire table including feet comfortably visible, product occupying 70% of width. Warm ivory wall panels, soft morning daylight from right, honey oak floor, subtle warm shadows, restrained styling with wicker basket and one ceramic vessel on bottom shelf. Extend the room horizontally with simple wall and doorway. High-end interiors magazine, believable material, crisp but soft natural light, quiet warm palette. Do not add text, labels, UI, borders, collage or watermarks. This is a scene illustration asset, not a webpage.

### console-cutout.webp

编辑来源：用户木色主图。透明背景开启。

> Background extraction only. Produce a clean catalog cutout of the EXACT console table from the attached product photograph with a genuinely transparent alpha background, including all open spaces between legs and shelf. Preserve the table's original camera angle, proportions, long narrow rustic brown wooden tabletop with center seam, brown bottom shelf, black metal legs, small diagonal support braces and visible screws. Do not redesign, recolor, straighten perspective, alter the wood grain or remove structural parts. Full table visible with modest transparent padding all around, fine clean edges. No floor, no shadow plane, no props, no checkerboard baked into the pixels, no text or frame. This is a reusable product cutout image for a website feature card.

### entryway-black.webp

参考：用户黑色主图。透明背景关闭。

> Create a premium furniture lifestyle photograph, landscape 16:10, for a small website feature card. Use the exact black console table from the reference as the clear hero, preserve its very long narrow black wooden tabletop with center seam, delicate visible black wood grain, black rectangular metal legs and small diagonal brackets, one low black wood shelf, no drawers or new parts. Entire product and all feet visible, fills approximately 74% of frame width, three-quarter frontal view with straight verticals. Warm minimalist entryway interior: light sand limestone textured wall, pale oak floor, a large round mirror above the console, warm directional late morning sunlight from the left making graceful soft leaf shadows. Restrained styling: one sculptural off-white ceramic vase with two olive branches on the far right of tabletop and a small shallow stone tray left of center; a short stack of ivory books on the lower shelf. Sophisticated calm editorial interior photography, warm greige palette contrasting the rich matte black console, tactility and beautiful negative space, photoreal. Do not add text, lettering, labels, UI, collage, logos or borders. The product must keep its original construction and color.

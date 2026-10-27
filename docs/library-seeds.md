# StudioLibraryEntry 种子数据导出

导出日期：2026-10-27（Asia/Shanghai）。来源为当前本地数据库的 StudioLibraryEntry，使用 REPEATABLE READ / READ ONLY 事务查询；没有运行种子导入、没有修改数据库或业务代码。下面的骨架、fixed、变量、选项、maxPick 和拍摄提示均按数据库原值导出，不作润色或补充。

## 数量与来源

| 类型 | 条数 |
| --- | ---: |
| 品类 category | 3 |
| 场景模板 scene | 8 |
| 道具组 set | 5 |
| 道具 prop | 20 |
| 合计 | 36 |

**这36条是我为原型编写并程序化展开的示例数据，不是从你提供的实拍、规格表、商品说明书或 NL27TS01 身份特征中提取的数据，也不代表已经由你逐条确认的正式模板。** 品类方向服务于原型需求，骨架英文、固定规则、变量选项、道具描述和拍摄要求的具体内容均来自示例配置。

来源链：

1. 任务8A原型提交 `cd27676` 添加了 [src/design-preview/mock/library.ts](../src/design-preview/mock/library.ts)，用数组、map 和示例条目生成这些内容。[任务8A说明](task-8a/README.md) 明确标注“仅前端静态原型”、样图不代表真实产品生成。原型全库有10个品类、12个场景、10个道具组和20个道具等，比本次数据库范围大。
2. [scripts/import-task10-seeds.ts](../scripts/import-task10-seeds.ts) 从该文件选取 C01/C02/C03 三个品类、适用它们的8个场景和5个道具组，以及全部20个道具，统一将 visibility 设为 public 后 upsert 到 StudioLibraryEntry。默认导入路径不读取你的商品资料；脚本另有显式 `--file=` CSV 导入方式。任务10提交 `3889706` 保存了这条导入链。
3. 本次把数据库JSON与当前种子按上述筛选和public转换逐条比对：**36/36 完全一致，字段差异0**。这证明当前内容仍与示例导入结果一致；数据库没有逐条来源审计，不能仅凭一致性反推每次执行导入命令的参数或操作人。

数据库中沿用的 owner（U01/U02）、stats.used/liked 和 data.createdAt 也是原型示例值，不是实际成员、真实使用次数或可靠业务时间。本表没有导入原型产品、历史配方、参考图库或关键词片段；商品实拍与产品身份版本属于其他表，不能混为这36条库种子。本文不导出图片内容。

## 单元测试数量说明

| 命令/集合 | 任务11-A的80项口径 | 推送前67项口径 |
| --- | ---: | ---: |
| `npm run test:gateways` | 40 | 42（新增2项读取错误日志测试） |
| `npm run test:prompt-composer` | 25 | 25 |
| `test:canvas`中的纯单元部分 | 4 | 本次未运行 |
| `test:image-models`中的纯单元部分 | 3 | 本次未运行 |
| `node --import tsx --test tests/unit/workflow-prototype.test.ts` | 8 | 本次未运行 |
| 合计 | 80 | 67 |

`npm run test:task10:units`只串联 gateways 和 prompt-composer，所以最近得到42+25=67。此前的80是40+25+4+3+8，覆盖范围更大。差额公式为 **80－15（这次没跑的3组）＋2（新增日志测试）＝67**。没有删除或减少这15项测试；按当前代码运行此前相同完整纯单元集合，应为82项。

计数依据：[package.json](../package.json)、任务11-A提交 `04882f0` 的脚本和上一轮实际执行结果，新增日志测试位于 [server-read-error.test.ts](../tests/unit/server-read-error.test.ts)。此处是在核对历史口径，不声称本次文档导出重新跑过82项。

另行统计：`test:canvas`、`test:image-models`各含1项数据库集成测试，合计2项，未计入80/67；浏览器的8项通过及2项专用Agent跳过也不计入单元数量。

## 按品类列出的场景与道具组

道具允许跨品类复用。当前20个道具的categoryIds全部含C01、C02、C03；为避免同一条记录重复计数，每个品类列出适用ID，完整道具字段集中在后面的“共用道具明细”。少数道具还引用未导入的品类ID，原样保留并标注，不把它们算成已存在的品类。

### C01 · 边桌

场景 4 个；道具组 3 个；适用道具 20 个（共用，非新增记录）。

适用道具ID：P01、P02、P03、P04、P05、P06、P07、P08、P09、P10、P11、P12、P13、P14、P15、P16、P17、P18、P19、P20。各道具名称和规格见下方完整明细。

#### 场景模板

##### S01 · 卧室·床头边桌·晨光

- 适用品类：C01 · 边桌
- 默认道具组：G01 · 边桌·卧室

骨架原文：

```text
Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

##### S02 · 客厅·沙发边桌·午后

- 适用品类：C01 · 边桌
- 默认道具组：G02 · 边桌·客厅

骨架原文：

```text
Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

##### S05 · 卧室·边桌·安静阅读

- 适用品类：C01 · 边桌
- 默认道具组：G10 · 边桌·阅读角

骨架原文：

```text
Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

##### S06 · 客厅·边桌·原木留白

- 适用品类：C01 · 边桌
- 默认道具组：G02 · 边桌·客厅

骨架原文：

```text
Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

#### 道具组

| ID | 名称 | 适用品类 | 包含的道具（原顺序） | maxPick |
| --- | --- | --- | --- | ---: |
| G01 | 边桌·卧室 | C01 · 边桌 | P01 · 陶瓷杯、P02 · 亚麻书册、P03 · 橄榄枝花瓶、P09 · 台灯 | 3 |
| G02 | 边桌·客厅 | C01 · 边桌 | P08 · 托盘、P10 · 盆栽、P17 · 抽象画、P13 · 香氛蜡烛 | 3 |
| G10 | 边桌·阅读角 | C01 · 边桌 | P02 · 亚麻书册、P09 · 台灯、P18 · 软织毯 | 2 |

### C02 · 马桶架

场景 2 个；道具组 1 个；适用道具 20 个（共用，非新增记录）。

适用道具ID：P01、P02、P03、P04、P05、P06、P07、P08、P09、P10、P11、P12、P13、P14、P15、P16、P17、P18、P19、P20。各道具名称和规格见下方完整明细。

#### 场景模板

##### S03 · 浴室·马桶架·清爽收纳

- 适用品类：C02 · 马桶架
- 默认道具组：G03 · 马桶架·浴室

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

##### S07 · 浴室·马桶架·小空间

- 适用品类：C02 · 马桶架
- 默认道具组：G03 · 马桶架·浴室

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

#### 道具组

| ID | 名称 | 适用品类 | 包含的道具（原顺序） | maxPick |
| --- | --- | --- | --- | ---: |
| G03 | 马桶架·浴室 | C02 · 马桶架 | P04 · 棉质毛巾、P06 · 藤编收纳篮、P12 · 浴盐罐、P16 · 浴巾 | 3 |

### C03 · 浴室柜

场景 2 个；道具组 1 个；适用道具 20 个（共用，非新增记录）。

适用道具ID：P01、P02、P03、P04、P05、P06、P07、P08、P09、P10、P11、P12、P13、P14、P15、P16、P17、P18、P19、P20。各道具名称和规格见下方完整明细。

#### 场景模板

##### S04 · 浴室·浴室柜·自然光

- 适用品类：C03 · 浴室柜
- 默认道具组：G04 · 浴室柜·浴室

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

##### S08 · 浴室·浴室柜·酒店氛围

- 适用品类：C03 · 浴室柜
- 默认道具组：G04 · 浴室柜·浴室

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed 规则原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（保留原始顺序和选项值）：

| 变量 key | 标签 | 选项标签 | 选项值原文 |
| --- | --- | --- | --- |
| lighting | 光线 | 柔和晨光 | soft morning window light |
| lighting | 光线 | 午后侧光 | warm afternoon side light |
| lighting | 光线 | 阴天漫射光 | overcast diffused daylight |
| camera | 机位 | 平视 45° | eye-level three-quarter view, 50mm |
| camera | 机位 | 正面平视 | front view, 70mm, straight verticals |
| camera | 机位 | 轻俯视 | slightly elevated view, 50mm |
| palette | 配色 | 暖白原木 | warm ivory and natural oak |
| palette | 配色 | 浅灰苔绿 | soft grey with muted green accents |
| palette | 配色 | 沙色胡桃 | sand beige and walnut brown |

#### 道具组

| ID | 名称 | 适用品类 | 包含的道具（原顺序） | maxPick |
| --- | --- | --- | --- | ---: |
| G04 | 浴室柜·浴室 | C03 · 浴室柜 | P07 · 皂液瓶、P15 · 木梳、P20 · 洗漱杯、P05 · 玻璃香薰 | 3 |

## 共用道具明细

每个道具一行；尺寸“小/中”为原始分类，不是经测量的物理尺寸。适用品类取categoryIds原值；categoryTags是另一个标签字段，不用它替换适用品类。

| ID | 名称 | 英文关键词 keywordsEn | 形状 shape | 颜色 color | 材质 material | 尺寸 size | 适用品类 categoryIds |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | 陶瓷杯 | ceramic coffee mug | 圆柱 | 奶油白 | 陶瓷 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C10（未导入品类） |
| P02 | 亚麻书册 | linen covered book | 长方体 | 米灰 | 纸张与布面 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C04（未导入品类）、C10（未导入品类）、C05（未导入品类） |
| P03 | 橄榄枝花瓶 | olive branch in stoneware vase | 椭圆 | 苔绿 | 石器与植物 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P04 | 棉质毛巾 | folded cotton towel | 折叠方形 | 暖白 | 棉 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P05 | 玻璃香薰 | amber glass diffuser | 圆柱 | 琥珀 | 玻璃 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P06 | 藤编收纳篮 | woven rattan storage basket | 圆筒 | 原木 | 藤编 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P07 | 皂液瓶 | minimal soap dispenser | 圆柱 | 哑光白 | 陶瓷 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C09（未导入品类） |
| P08 | 托盘 | oval wooden tray | 椭圆 | 胡桃棕 | 木材 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C07（未导入品类） |
| P09 | 台灯 | compact dome table lamp | 半球 | 沙色 | 金属 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C10（未导入品类） |
| P10 | 盆栽 | small potted fern | 自然叶形 | 绿色 | 植物与陶土 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C05（未导入品类） |
| P11 | 棉麻抱枕 | linen accent cushion | 方形 | 浅灰 | 亚麻 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C04（未导入品类） |
| P12 | 浴盐罐 | clear glass bath salt jar | 圆柱 | 透明 | 玻璃 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P13 | 香氛蜡烛 | unscented pillar candle | 圆柱 | 象牙白 | 植物蜡 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C07（未导入品类） |
| P14 | 手工碗 | handmade stoneware bowl | 浅圆碗 | 灰褐 | 石器 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C09（未导入品类） |
| P15 | 木梳 | natural wooden comb | 长条 | 浅木 | 木材 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P16 | 浴巾 | rolled bath towel | 卷筒 | 米白 | 棉 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P17 | 抽象画 | small framed abstract print | 长方形 | 黑白 | 纸与木框 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C05（未导入品类） |
| P18 | 软织毯 | soft woven throw | 矩形折叠 | 燕麦色 | 羊毛 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C04（未导入品类） |
| P19 | 玻璃水壶 | clear glass carafe | 圆锥 | 透明 | 玻璃 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C07（未导入品类） |
| P20 | 洗漱杯 | simple bathroom tumbler | 圆柱 | 浅灰 | 陶瓷 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C09（未导入品类） |

未导入但被道具引用的品类ID：C04、C05、C07、C09、C10。本次没有补建这些品类，也没有修改引用。

## 品类清单与快速/严格拍摄要求

| ID | 名称 | 默认拍摄档位 defaultShootingMode | 快速档提示 quickHint 原文 | 严格档必需项 |
| --- | --- | --- | --- | ---: |
| C01 | 边桌 | quick（快速） | 补拍背面和细节，场景图会更准 | 7 / 7 |
| C02 | 马桶架 | strict（严格） | 补拍背面和细节，场景图会更准 | 7 / 7 |
| C03 | 浴室柜 | strict（严格） | 补拍背面和细节，场景图会更准 | 7 / 7 |

### C01 · 边桌 拍摄要求

- 默认档位：quick。
- 快速档：数据库只有quickHint，原文为“补拍背面和细节，场景图会更准”；没有单独的快速档最低张数或角度清单字段，不能把程序行为补写成数据库要求。
- 严格档：按strictChecklist原始顺序列出，required值原样保留。

| 顺序 | 角度 angle | 中文名 | required | 拍摄提示 hint 原文 |
| ---: | --- | --- | --- | --- |
| 1 | front | 正面 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 2 | quarter | 45° | true | 产品完整入镜，使用自然光，避免遮挡 |
| 3 | side | 正侧 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 4 | top | 俯视 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 5 | material | 细节-材质 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 6 | back | 背面 | true | 完整拍到背面结构 |
| 7 | hardware | 细节-五金 | true | 对焦五金和连接位置 |

### C02 · 马桶架 拍摄要求

- 默认档位：strict。
- 快速档：数据库只有quickHint，原文为“补拍背面和细节，场景图会更准”；没有单独的快速档最低张数或角度清单字段，不能把程序行为补写成数据库要求。
- 严格档：按strictChecklist原始顺序列出，required值原样保留。

| 顺序 | 角度 angle | 中文名 | required | 拍摄提示 hint 原文 |
| ---: | --- | --- | --- | --- |
| 1 | front | 正面 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 2 | quarter | 45° | true | 产品完整入镜，使用自然光，避免遮挡 |
| 3 | side | 正侧 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 4 | top | 俯视 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 5 | material | 细节-材质 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 6 | back | 背面 | true | 完整拍到背面结构 |
| 7 | hardware | 细节-五金 | true | 对焦五金和连接位置 |

### C03 · 浴室柜 拍摄要求

- 默认档位：strict。
- 快速档：数据库只有quickHint，原文为“补拍背面和细节，场景图会更准”；没有单独的快速档最低张数或角度清单字段，不能把程序行为补写成数据库要求。
- 严格档：按strictChecklist原始顺序列出，required值原样保留。

| 顺序 | 角度 angle | 中文名 | required | 拍摄提示 hint 原文 |
| ---: | --- | --- | --- | --- |
| 1 | front | 正面 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 2 | quarter | 45° | true | 产品完整入镜，使用自然光，避免遮挡 |
| 3 | side | 正侧 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 4 | top | 俯视 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 5 | material | 细节-材质 | true | 产品完整入镜，使用自然光，避免遮挡 |
| 6 | back | 背面 | true | 完整拍到背面结构 |
| 7 | hardware | 细节-五金 | true | 对焦五金和连接位置 |

三类的严格清单目前完全相同，都是7项必需角度。这是示例配置，不表示已经针对每个品类验证过拍摄标准。应用中的“快速可先用现有实拍、严格缺项可以先跳过”等行为由工作台代码控制，不是本表额外储存的要求。

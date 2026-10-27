# Task 11-B：模板库完整只读导出

日期：2026-10-27（Asia/Shanghai）。本次用 PostgreSQL REPEATABLE READ / READ ONLY 事务读取实际数据库，同时加载种子模块的初始化后结果。未执行迁移、种子导入、付费模型或数据删除，未修改业务代码。数据只导出为文档，图片保留路径字符串，不包含图片字节。

## 范围、数量和来源判定

| 集合 | 当前数据库条数 | 种子条数 |
| --- | ---: | ---: |
| categories / category | 3 | 10 |
| scenes / scene | 8 | 12 |
| props / prop | 20 | 20 |
| propSets / set | 5 | 10 |
| references / reference | 0 | 12 |
| snippets / snippet | 0 | 12 |
| recipes / recipe | 0 | 12 |
| products / product | 0 | 12 |

数据库 StudioLibraryEntry 合计 **36** 条；种子 seedLibrary 合计 **100** 个对象。其核心模板配置为10品类、12场景、10道具组、20道具，共52个对象；另外保留12参考图元数据、12关键词片段、12示例产品和12历史配方，避免把相关原型数据漏掉。旧 Template 表当前 **0** 条。本次SQL确认草案 LibraryEntry/LibraryRecipe 等表尚未落库。

每条记录都注明来源类别：**Codex 生成的示例 / 用户提供 / 不确定**。当前36条数据库JSON均与种子经过导入脚本的public转换后完全一致，因此列为“Codex 生成的示例”；种子仅存条目同样如此。没有条目能判定为“用户提供”。如果数据库存在不匹配的自定义记录，来源会标为“不确定”，不会推测为用户提供。图片路径的文字配置由Codex编写，但照片著作来源不凭这些数据确认；参考图source字段虽写Unsplash，其照片归属本次标为不确定，未联网核实。

证据：[mock/library.ts](../src/design-preview/mock/library.ts)（原型提交cd27676）、[导入脚本](../scripts/import-task10-seeds.ts)（任务10提交3889706）、[任务8A说明](task-8a/README.md)。4份CSV共36条也已与本次数据库快照逐条核对，无字段差异。原型数据不由用户实拍、规格表或NL27TS01身份特征抽取；owner U01/U02、stats和createdAt也是示例值。public导入覆盖种子visibility，文末同时保留数据库和种子原值。

## 按品类列出的场景、变量与道具组

每个变量跟随其场景模板，不存在独立的数据库变量表。共用道具只导出一份完整明细；每个品类列出其适用ID，不重复计数。C06鞋架、C08餐桌等没有模板/道具组时明确留空，不补编。

### C01 · 边桌

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 场景：4；道具组：3；适用道具：P01、P02、P03、P04、P05、P06、P07、P08、P09、P10、P11、P12、P13、P14、P15、P16、P17、P18、P19、P20。

#### S01 · 卧室·床头边桌·晨光

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C01 · 边桌。
- 默认道具组：G01 · 边桌·卧室。

骨架原文：

```text
Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

#### S02 · 客厅·沙发边桌·午后

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C01 · 边桌。
- 默认道具组：G02 · 边桌·客厅。

骨架原文：

```text
Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

#### S05 · 卧室·边桌·安静阅读

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C01 · 边桌。
- 默认道具组：G10 · 边桌·阅读角。

骨架原文：

```text
Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

#### S06 · 客厅·边桌·原木留白

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C01 · 边桌。
- 默认道具组：G02 · 边桌·客厅。

骨架原文：

```text
Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G01 | 边桌·卧室 | Codex 生成的示例 | 数据库 + 种子 | P01 · 陶瓷杯、P02 · 亚麻书册、P03 · 橄榄枝花瓶、P09 · 台灯 | 3 |
| G02 | 边桌·客厅 | Codex 生成的示例 | 数据库 + 种子 | P08 · 托盘、P10 · 盆栽、P17 · 抽象画、P13 · 香氛蜡烛 | 3 |
| G10 | 边桌·阅读角 | Codex 生成的示例 | 数据库 + 种子 | P02 · 亚麻书册、P09 · 台灯、P18 · 软织毯 | 2 |

### C02 · 马桶架

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 场景：2；道具组：1；适用道具：P01、P02、P03、P04、P05、P06、P07、P08、P09、P10、P11、P12、P13、P14、P15、P16、P17、P18、P19、P20。

#### S03 · 浴室·马桶架·清爽收纳

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C02 · 马桶架。
- 默认道具组：G03 · 马桶架·浴室。

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

#### S07 · 浴室·马桶架·小空间

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C02 · 马桶架。
- 默认道具组：G03 · 马桶架·浴室。

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G03 | 马桶架·浴室 | Codex 生成的示例 | 数据库 + 种子 | P04 · 棉质毛巾、P06 · 藤编收纳篮、P12 · 浴盐罐、P16 · 浴巾 | 3 |

### C03 · 浴室柜

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 场景：2；道具组：1；适用道具：P01、P02、P03、P04、P05、P06、P07、P08、P09、P10、P11、P12、P13、P14、P15、P16、P17、P18、P19、P20。

#### S04 · 浴室·浴室柜·自然光

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C03 · 浴室柜。
- 默认道具组：G04 · 浴室柜·浴室。

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

#### S08 · 浴室·浴室柜·酒店氛围

- 来源：Codex 生成的示例；位置：数据库 + 种子。
- 适用品类：C03 · 浴室柜。
- 默认道具组：G04 · 浴室柜·浴室。

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G04 | 浴室柜·浴室 | Codex 生成的示例 | 数据库 + 种子 | P07 · 皂液瓶、P15 · 木梳、P20 · 洗漱杯、P05 · 玻璃香薰 | 3 |

### C04 · 沙发

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 场景：1；道具组：1；适用道具：P02、P11、P18。

#### S10 · 客厅·沙发·轻松周末

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 适用品类：C04 · 沙发。
- 默认道具组：G06 · 沙发·客厅。

骨架原文：

```text
Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G06 | 沙发·客厅 | Codex 生成的示例 | 仅种子，未导入数据库 | P11 · 棉麻抱枕、P18 · 软织毯、P02 · 亚麻书册 | 2 |

### C05 · 书架

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 场景：1；道具组：1；适用道具：P02、P10、P17。

#### S11 · 书房·书架·午后阅读

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 适用品类：C05 · 书架。
- 默认道具组：G09 · 书架·书房。

骨架原文：

```text
Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G09 | 书架·书房 | Codex 生成的示例 | 仅种子，未导入数据库 | P02 · 亚麻书册、P17 · 抽象画、P10 · 盆栽 | 3 |

### C06 · 鞋架

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 场景：0；道具组：0；适用道具：无。

场景模板：无。

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| — | 无 | — | — | — | — |

### C07 · 茶几

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 场景：0；道具组：1；适用道具：P08、P13、P19。

场景模板：无。

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G08 | 茶几·客厅 | Codex 生成的示例 | 仅种子，未导入数据库 | P08 · 托盘、P19 · 玻璃水壶、P13 · 香氛蜡烛 | 3 |

### C08 · 餐桌

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 场景：0；道具组：0；适用道具：无。

场景模板：无。

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| — | 无 | — | — | — | — |

### C09 · 洗手池

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 场景：1；道具组：1；适用道具：P07、P14、P20。

#### S09 · 浴室·洗手池·台面秩序

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 适用品类：C09 · 洗手池。
- 默认道具组：G05 · 洗手池·台面。

骨架原文：

```text
Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G05 | 洗手池·台面 | Codex 生成的示例 | 仅种子，未导入数据库 | P07 · 皂液瓶、P20 · 洗漱杯、P14 · 手工碗 | 2 |

### C10 · 床头柜

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 场景：1；道具组：1；适用道具：P01、P02、P09。

#### S12 · 卧室·床头柜·柔和灯光

- 来源：Codex 生成的示例；位置：仅种子，未导入数据库。
- 适用品类：C10 · 床头柜。
- 默认道具组：G07 · 床头柜·卧室。

骨架原文：

```text
Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.
```

fixed原文：

```text
Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.
Props support the scene and must not cover the product silhouette or alter its proportions.
```

变量与选项（每一行来源均为“Codex 生成的示例”，继承所属模板的数据位置）：

| 变量key | 标签 | 选项标签 | 值原文 |
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

道具组：

| ID | 名称 | 来源 | 位置 | 包含道具（原顺序） | maxPick |
| --- | --- | --- | --- | --- | ---: |
| G07 | 床头柜·卧室 | Codex 生成的示例 | 仅种子，未导入数据库 | P09 · 台灯、P01 · 陶瓷杯、P02 · 亚麻书册 | 2 |

## 道具完整明细

size是“小/中”的示例分类，不是已测量尺寸；categoryIds原样保留，不用categoryTags替代。

| ID | 名称 | 来源 | 位置 | 英文关键词 | 形状 | 颜色 | 材质 | 尺寸 | 适用品类 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | 陶瓷杯 | Codex 生成的示例 | 数据库 + 种子 | ceramic coffee mug | 圆柱 | 奶油白 | 陶瓷 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C10 · 床头柜 |
| P02 | 亚麻书册 | Codex 生成的示例 | 数据库 + 种子 | linen covered book | 长方体 | 米灰 | 纸张与布面 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C04 · 沙发、C10 · 床头柜、C05 · 书架 |
| P03 | 橄榄枝花瓶 | Codex 生成的示例 | 数据库 + 种子 | olive branch in stoneware vase | 椭圆 | 苔绿 | 石器与植物 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P04 | 棉质毛巾 | Codex 生成的示例 | 数据库 + 种子 | folded cotton towel | 折叠方形 | 暖白 | 棉 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P05 | 玻璃香薰 | Codex 生成的示例 | 数据库 + 种子 | amber glass diffuser | 圆柱 | 琥珀 | 玻璃 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P06 | 藤编收纳篮 | Codex 生成的示例 | 数据库 + 种子 | woven rattan storage basket | 圆筒 | 原木 | 藤编 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P07 | 皂液瓶 | Codex 生成的示例 | 数据库 + 种子 | minimal soap dispenser | 圆柱 | 哑光白 | 陶瓷 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C09 · 洗手池 |
| P08 | 托盘 | Codex 生成的示例 | 数据库 + 种子 | oval wooden tray | 椭圆 | 胡桃棕 | 木材 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C07 · 茶几 |
| P09 | 台灯 | Codex 生成的示例 | 数据库 + 种子 | compact dome table lamp | 半球 | 沙色 | 金属 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C10 · 床头柜 |
| P10 | 盆栽 | Codex 生成的示例 | 数据库 + 种子 | small potted fern | 自然叶形 | 绿色 | 植物与陶土 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C05 · 书架 |
| P11 | 棉麻抱枕 | Codex 生成的示例 | 数据库 + 种子 | linen accent cushion | 方形 | 浅灰 | 亚麻 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C04 · 沙发 |
| P12 | 浴盐罐 | Codex 生成的示例 | 数据库 + 种子 | clear glass bath salt jar | 圆柱 | 透明 | 玻璃 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P13 | 香氛蜡烛 | Codex 生成的示例 | 数据库 + 种子 | unscented pillar candle | 圆柱 | 象牙白 | 植物蜡 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C07 · 茶几 |
| P14 | 手工碗 | Codex 生成的示例 | 数据库 + 种子 | handmade stoneware bowl | 浅圆碗 | 灰褐 | 石器 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C09 · 洗手池 |
| P15 | 木梳 | Codex 生成的示例 | 数据库 + 种子 | natural wooden comb | 长条 | 浅木 | 木材 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P16 | 浴巾 | Codex 生成的示例 | 数据库 + 种子 | rolled bath towel | 卷筒 | 米白 | 棉 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| P17 | 抽象画 | Codex 生成的示例 | 数据库 + 种子 | small framed abstract print | 长方形 | 黑白 | 纸与木框 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C05 · 书架 |
| P18 | 软织毯 | Codex 生成的示例 | 数据库 + 种子 | soft woven throw | 矩形折叠 | 燕麦色 | 羊毛 | 中 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C04 · 沙发 |
| P19 | 玻璃水壶 | Codex 生成的示例 | 数据库 + 种子 | clear glass carafe | 圆锥 | 透明 | 玻璃 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C07 · 茶几 |
| P20 | 洗漱杯 | Codex 生成的示例 | 数据库 + 种子 | simple bathroom tumbler | 圆柱 | 浅灰 | 陶瓷 | 小 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜、C09 · 洗手池 |

## 组合与变量规则完整盘点

以下来自当前实现，未修改。规则属于Codex编写的原型组合实现，不表示用户逐条确认过其产品适用性。相关函数见[PromptComposer](../src/design-preview/library/prompt-composer.ts)和[rules.ts](../src/design-preview/library/rules.ts)。

| 编号 | 来源 | 当前规则 |
| --- | --- | --- |
| R01 | Codex 生成的示例（组合实现） | 可见性：public、拥有者、admin或template_editor可用；模板categoryIds必须包含产品categoryId。 |
| R02 | Codex 生成的示例（组合实现） | 原始实拍至少1张；每张必须original=true且有image。 |
| R03 | Codex 生成的示例（组合实现） | 骨架占位符只允许product、props和模板声明变量；product、props必须同时存在。 |
| R04 | Codex 生成的示例（组合实现） | 传入变量不能出现未声明key；缺省值取该变量options第一项；传入值必须逐字命中options.value。 |
| R05 | Codex 生成的示例（组合实现） | 道具组按id排序，每组必须可见、品类匹配，maxPick必须为正整数。 |
| R06 | Codex 生成的示例（组合实现） | 未指定selectedPropIds时，各组propIds按字符串排序，取前maxPick个，再合并去重排序；不是随机挑选。 |
| R07 | Codex 生成的示例（组合实现） | 显式选择道具时，每个道具必须属于至少一个已选组，各组重叠成员计数不能超过各自maxPick；道具本身必须存在、可见、品类匹配。 |
| R08 | Codex 生成的示例（组合实现） | 环境参考按id排序，逐条校验可见性；不覆盖产品原始实拍身份来源。 |
| R09 | Codex 生成的示例（组合实现） | 产品特征按中文key排序；dimensionsUnknown=false时三维数值必须有限且大于0；未知时写dimensions unknown; do not add measurement claims。 |
| R10 | Codex 生成的示例（组合实现） | 产品描述包含产品名、全部特征和值及尺寸（不是只拼locked=true的特征）；后续另追加Locked product features段。 |
| R11 | Codex 生成的示例（组合实现） | 道具描述格式为keywordsEn (shape, color, material, size)，用分号连接；没有道具时写no additional props。 |
| R12 | Codex 生成的示例（组合实现） | finalPrompt顺序：替换变量后的skeleton → fixed原顺序 → 可选brandConstraints → 锁定特征 → 原始实拍ID → 可选环境参考ID。 |
| R13 | Codex 生成的示例（组合实现） | 原图referenceInputs按id排序放前面，环境参考放后面；PromptComposer.edit需非空用户指令，追加局部修改要求并把previous图作为附加参考。 |
| R14 | Codex 生成的示例（组合实现） | combinationKey是JSON.stringify对象，包含templateId、去重排序propIds、按key排序variables、去重排序refIds；不是散列，未包含category/slot/模板版本、SKU/产品、模型、尺寸或文本策略。 |
| R15 | Codex 生成的示例（组合实现） | 历史范围recentRecipes：本SKU全部历史，加同品类过去30天（不含未来）的记录。 |
| R16 | Codex 生成的示例（组合实现） | chooseFreshRecipe只枚举变量选项组合，优先尝试用户值，每次最多1000个叶子；不随机枚举道具子集，全部用过则报NO_FRESH_COMBINATION。当前只在本地原型library-store的规划中使用，真实planStudioTask只调用compose，不调用它。 |
| R17 | Codex 生成的示例（组合实现） | 真实planStudioTask要求choose_recipe工具选择一个templateId、最多2个propSetIds和变量；按品类筛库。默认道具组并未强制自动套用，模型可以返回空组。 |
| R18 | Codex 生成的示例（组合实现） | 真实规划把一个选定模板展开为4个硬编码图位：产品主图、场景图、材质细节、卖点图；主图临时覆盖骨架，另外3个复用相同composed.finalPrompt再追加图位意图。它与defaultSlots的7图位配置不是同一套定义。 |
| R19 | Codex 生成的示例（组合实现） | 批量生成同一图位的多张候选，复用该图位prepareSceneInput的同一份prepared.input；目前没有每候选重新组合变量和真实配方去重。 |

combinationKey实现原文：

```typescript
export function combinationKey(templateId:string,propIds:string[],variables:Record<string,string>,refIds:string[]){return JSON.stringify({templateId,propIds:unique(propIds),variables:Object.fromEntries(Object.entries(variables).sort(([a],[b])=>a.localeCompare(b,"en"))),refIds:unique(refIds)});}
```

## 组合规则实现原文

### src/design-preview/library/prompt-composer.ts

来源：Codex 生成的示例（原型实现）；只读抄录，不代表本次执行或修改。

```typescript
import type {Actor,GenerationRecipe,Product,Prop,PropSet,ReferenceImage,SceneTemplate} from "./types";
import {canView,recentRecipes} from "./rules";
import type {BrandStyle} from "../workflows/types";
import {brandConstraints} from "../workflows/rules";
export type ComposeInput={dimensionsUnknown?:boolean;brand?:BrandStyle;template:SceneTemplate;product:Product;propSets:PropSet[];props:Prop[];variables:Record<string,string>;references?:ReferenceImage[];selectedPropIds?:string[];actor:Actor};
export type ComposedPrompt={finalPrompt:string;propIds:string[];variables:Record<string,string>;refIds:string[];originalPhotoIds:string[];referenceInputs:{id:string;image:string;kind:"original"|"style"|"previous"}[];combinationKey:string};
export class PromptError extends Error{constructor(public code:string,message:string){super(message);this.name="PromptError";}}
function fail(code:string,message:string):never{throw new PromptError(code,message);}
const unique=(ids:string[])=>[...new Set(ids)].sort();
export function combinationKey(templateId:string,propIds:string[],variables:Record<string,string>,refIds:string[]){return JSON.stringify({templateId,propIds:unique(propIds),variables:Object.fromEntries(Object.entries(variables).sort(([a],[b])=>a.localeCompare(b,"en"))),refIds:unique(refIds)});}
export class PromptComposer {
 static compose(input:ComposeInput):ComposedPrompt {
  const {template,product,actor}=input;
  if(!canView(template,actor))fail("FORBIDDEN","无权使用该模板");
  if(!template.categoryIds.includes(product.categoryId))fail("CATEGORY_MISMATCH","场景与产品品类不匹配");
  if(!product.photos.length||product.photos.some(p=>p.original!==true||!p.image))fail("ORIGINAL_REQUIRED","至少需要一张原始实拍");
  const reserved=["product","props"],allowed=new Set([...reserved,...template.variables.map(v=>v.key)]),slots=[...template.skeleton.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]);
  if(slots.some(k=>!allowed.has(k))||!reserved.every(k=>slots.includes(k)))fail("INVALID_SKELETON","模板含未知占位符或缺少产品/道具占位符");
  if(Object.keys(input.variables).some(k=>!template.variables.some(v=>v.key===k)))fail("INVALID_VARIABLE","存在未声明的变量");
  const variables=Object.fromEntries(template.variables.map(v=>{const value=input.variables[v.key]??v.options[0]?.value;if(!v.options.some(o=>o.value===value))fail("INVALID_VARIABLE","变量值不在可选范围："+v.key);return[v.key,value];}));
  const sets=[...input.propSets].sort((a,b)=>a.id.localeCompare(b.id,"en"));
  for(const group of sets){if(!canView(group,actor)||!group.categoryIds.includes(product.categoryId))fail("INVALID_PROP_SET","道具组不可用或品类不匹配");if(!Number.isInteger(group.maxPick)||group.maxPick<1)fail("INVALID_PROP_SET","道具组选择上限无效");}
  const propIds=unique(input.selectedPropIds??sets.flatMap(g=>[...g.propIds].sort().slice(0,g.maxPick)));
  for(const group of sets)if(propIds.filter(id=>group.propIds.includes(id)).length>group.maxPick)fail("TOO_MANY_PROPS","超过道具组最大选取数");
  const selectedProps:Prop[]=propIds.map(id=>{if(!sets.some(g=>g.propIds.includes(id)))return fail("UNKNOWN_PROP","道具不属于所选道具组");const prop=input.props.find(p=>p.id===id);if(!prop||!canView(prop,actor)||!prop.categoryIds.includes(product.categoryId))return fail("UNKNOWN_PROP","道具不存在或不可用");return prop;});
  const refs=[...(input.references??[])].sort((a,b)=>a.id.localeCompare(b.id,"en"));if(refs.some(r=>!canView(r,actor)))fail("FORBIDDEN","参考图不可用");
  const features=[...product.features].sort((a,b)=>a.key.localeCompare(b.key,"zh-CN")),dimensions=product.dimensions;
  if(!input.dimensionsUnknown&&[dimensions.width,dimensions.depth,dimensions.height].some(v=>!Number.isFinite(v)||v<=0))fail("INVALID_DIMENSIONS","尺寸必须是正数");
  const description=`${product.name}; ${features.map(f=>f.key+": "+f.value).join("; ")}; ${input.dimensionsUnknown?"dimensions unknown; do not add measurement claims":"dimensions: "+dimensions.width+" × "+dimensions.depth+" × "+dimensions.height+" "+dimensions.unit}`;
  const propText=selectedProps.length?selectedProps.map(p=>`${p.keywordsEn} (${p.shape}, ${p.color}, ${p.material}, ${p.size})`).join("; "):"no additional props",values:Record<string,string>={...variables,product:description,props:propText};
  const text=template.skeleton.replace(/\{([^{}]+)\}/g,(_,key:string)=>values[key]),originalPhotoIds=unique(product.photos.map(p=>p.id)),locked=features.filter(f=>f.locked).map(f=>f.key+": "+f.value).join("; ");
  const finalPrompt=[text,...template.fixed,brandConstraints(input.brand),"Locked product features: "+(locked||"follow the original product photographs")+".","Original identity references: "+originalPhotoIds.join(", ")+".",...(refs.length?["Environment references only: "+refs.map(r=>r.id).join(", ")+"."]:[])].map(s=>s.trim()).filter(Boolean).join("\n");
  return{finalPrompt,propIds,variables,refIds:unique(refs.map(r=>r.id)),originalPhotoIds,referenceInputs:[...[...product.photos].sort((a,b)=>a.id.localeCompare(b.id,"en")).map(p=>({id:p.id,image:p.image,kind:"original" as const})),...refs.map(r=>({id:r.id,image:r.image,kind:"style" as const}))],combinationKey:combinationKey(template.id,propIds,variables,refs.map(r=>r.id))};
 }
 static edit(input:ComposeInput,previous:{id:string;image:string},instruction:string):ComposedPrompt{
  if(!instruction.trim())fail("USER_REQUEST_REQUIRED","修图需要美工明确提出要求");
  const result=this.compose(input);return{...result,finalPrompt:result.finalPrompt+"\nRequested local change: "+instruction.trim()+".\nKeep all locked product features; original product photographs remain the identity source.",referenceInputs:[...result.referenceInputs,{...previous,kind:"previous"}]};
 }
}
export function chooseFreshRecipe(input:ComposeInput,recipes:GenerationRecipe[],now:Date):ComposedPrompt{
 const used=new Set(recentRecipes(recipes,input.product.sku,input.product.categoryId,now).map(r=>r.combinationKey)),variables=input.template.variables;let tested=0;
 function search(index:number,values:Record<string,string>):ComposedPrompt|undefined{
  if(tested>=1000)return;
  if(index===variables.length){tested++;const candidate=PromptComposer.compose({...input,variables:values});return used.has(candidate.combinationKey)?undefined:candidate;}
  const v=variables[index],preferred=input.variables[v.key],options=[...v.options].sort((a,b)=>Number(b.value===preferred)-Number(a.value===preferred));
  for(const o of options){const found=search(index+1,{...values,[v.key]:o.value});if(found)return found;}
 }
 const result=search(0,{});if(!result)fail("NO_FRESH_COMBINATION","这些组合最近都用过，换一个场景或道具组再试。");return result;
}
```

### src/design-preview/library/rules.ts

来源：Codex 生成的示例（原型实现）；只读抄录，不代表本次执行或修改。

```typescript
import type {Actor,Category,EntryBase,GenerationRecipe,LibraryEntry,Product,ShootingMode,ShotAngle} from "./types";
export function canView(entry:Pick<EntryBase,"visibility"|"owner">,actor:Actor){return entry.visibility==="public"||entry.owner===actor.id||actor.role==="admin"||actor.role==="template_editor";}
export function canReview(actor:Actor){return actor.role==="admin"||actor.role==="template_editor";}
export function coverage(product:Product,category:Category){
 const present=new Set(product.photos.map(p=>p.angle));const required=category.strictChecklist.filter(r=>r.required);
 return {total:required.length,present:required.filter(r=>present.has(r.angle)).length,missing:required.filter(r=>!present.has(r.angle)),photoCount:product.photos.length};
}
export function shootingNotice(product:Product,category:Category,mode:ShootingMode,alreadyShown=false){
 const result=coverage(product,category);
 if(!result.photoCount)return {kind:"empty" as const,text:"先放入一张产品实拍，就能开始。",blocks:true};
 if(result.photoCount===1)return{kind:"single" as const,text:"只有 1 张实拍，产品还原度可能不稳定",blocks:false};
 if(mode==="quick")return{kind:"quick" as const,text:alreadyShown?"":category.quickHint,blocks:false};
 return{kind:"strict" as const,text:result.missing.length?"还缺"+result.missing.map(r=>r.angle).join("、"):"拍摄资料已齐全",blocks:false};
}
export function matchEntry(entry:LibraryEntry,query:string,filters:string[]=[]){
 const tags=[...entry.tags,entry.name,entry.kind==="prop"?entry.keywordsEn:entry.kind==="snippet"?entry.text:""].map(s=>s.normalize("NFKC").toLowerCase());
 return [...query.normalize("NFKC").trim().toLowerCase().split(/\s+/).filter(Boolean),...filters].every(token=>tags.some(tag=>tag.includes(token.toLowerCase())));
}
export function recentRecipes(recipes:GenerationRecipe[],sku:string,categoryId:string,now:Date){
 const since=now.getTime()-30*86400000;
 return recipes.filter(r=>r.sku===sku||(r.categoryId===categoryId&&Date.parse(r.createdAt)>=since&&Date.parse(r.createdAt)<=now.getTime()));
}
export function guessMockAngle(name:string,index:number):ShotAngle{
 if(/back|背面/i.test(name))return"back";if(/hardware|五金/i.test(name))return"hardware";if(/detail|材质/i.test(name))return"material";if(/side|正侧/i.test(name))return"side";if(/top|俯视/i.test(name))return"top";if(/45|quarter|侧面/i.test(name))return"quarter";if(/front|正面/i.test(name))return"front";return(["front","quarter","side","top","material"] as ShotAngle[])[index%5];
}
export const normalizeDescription=(text:string)=>text.normalize("NFKC").trim().replace(/\s+/g," ").replace(/[。.!！]+$/,"").toLowerCase();
```

## 关联原型条目索引

以下也不是用户真实产品/配方。完整字段在后面的无损JSON中，所有记录逐条保留来源标签。

| ID | 名称 | 集合 | 来源 | 位置 | 适用品类 |
| --- | --- | --- | --- | --- | --- |
| D01 | 栖木 · 边桌 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| D02 | 序间 · 马桶架 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C02 · 马桶架 |
| D03 | 清屿 · 浴室柜 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C03 · 浴室柜 |
| D04 | 栖木 · 边桌 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| D05 | 序间 · 马桶架 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C02 · 马桶架 |
| D06 | 清屿 · 浴室柜 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C03 · 浴室柜 |
| D07 | 栖木 · 边桌 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| D08 | 序间 · 马桶架 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C02 · 马桶架 |
| D09 | 清屿 · 浴室柜 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C03 · 浴室柜 |
| D10 | 栖木 · 边桌 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| D11 | 序间 · 马桶架 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C02 · 马桶架 |
| D12 | 清屿 · 浴室柜 | products | Codex 生成的示例 | 仅种子，未导入数据库 | C03 · 浴室柜 |
| R01 | 卧室柔光参考 1 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R02 | 客厅留白参考 1 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R03 | 浴室秩序参考 1 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R04 | 卧室柔光参考 2 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R05 | 客厅留白参考 2 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R06 | 浴室秩序参考 2 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R07 | 卧室柔光参考 3 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R08 | 客厅留白参考 3 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R09 | 浴室秩序参考 3 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R10 | 卧室柔光参考 4 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R11 | 客厅留白参考 4 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| R12 | 浴室秩序参考 4 | references | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K01 | 保留产品轮廓 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K02 | 自然接触阴影 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K03 | 低饱和背景 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K04 | 不遮挡五金 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K05 | 柔和侧光 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K06 | 减少装饰 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K07 | 保留木纹 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K08 | 保持层板数量 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K09 | 浅景深 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K10 | 留足呼吸空间 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K11 | 端正垂直线 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| K12 | 尺寸比例准确 | snippets | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌、C02 · 马桶架、C03 · 浴室柜 |
| E01 | 历史配方 1 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| E02 | 历史配方 2 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| E03 | 历史配方 3 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C02 · 马桶架 |
| E04 | 历史配方 4 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C03 · 浴室柜 |
| E05 | 历史配方 5 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| E06 | 历史配方 6 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| E07 | 历史配方 7 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C02 · 马桶架 |
| E08 | 历史配方 8 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C03 · 浴室柜 |
| E09 | 历史配方 9 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| E10 | 历史配方 10 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C01 · 边桌 |
| E11 | 历史配方 11 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C02 · 马桶架 |
| E12 | 历史配方 12 | recipes | Codex 生成的示例 | 仅种子，未导入数据库 | C03 · 浴室柜 |

## 品类清单与快速/严格拍摄要求

| ID | 名称 | 来源 | 位置 | 默认档位 | quickHint原文 |
| --- | --- | --- | --- | --- | --- |
| C01 | 边桌 | Codex 生成的示例 | 数据库 + 种子 | quick | 补拍背面和细节，场景图会更准 |
| C02 | 马桶架 | Codex 生成的示例 | 数据库 + 种子 | strict | 补拍背面和细节，场景图会更准 |
| C03 | 浴室柜 | Codex 生成的示例 | 数据库 + 种子 | strict | 补拍背面和细节，场景图会更准 |
| C04 | 沙发 | Codex 生成的示例 | 仅种子，未导入数据库 | quick | 补拍背面和细节，场景图会更准 |
| C05 | 书架 | Codex 生成的示例 | 仅种子，未导入数据库 | quick | 补拍背面和细节，场景图会更准 |
| C06 | 鞋架 | Codex 生成的示例 | 仅种子，未导入数据库 | quick | 补拍背面和细节，场景图会更准 |
| C07 | 茶几 | Codex 生成的示例 | 仅种子，未导入数据库 | quick | 补拍背面和细节，场景图会更准 |
| C08 | 餐桌 | Codex 生成的示例 | 仅种子，未导入数据库 | quick | 补拍背面和细节，场景图会更准 |
| C09 | 洗手池 | Codex 生成的示例 | 仅种子，未导入数据库 | quick | 补拍背面和细节，场景图会更准 |
| C10 | 床头柜 | Codex 生成的示例 | 仅种子，未导入数据库 | quick | 补拍背面和细节，场景图会更准 |

### C01 · 边桌的严格清单

来源：Codex 生成的示例；位置：数据库 + 种子。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C02 · 马桶架的严格清单

来源：Codex 生成的示例；位置：数据库 + 种子。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C03 · 浴室柜的严格清单

来源：Codex 生成的示例；位置：数据库 + 种子。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C04 · 沙发的严格清单

来源：Codex 生成的示例；位置：仅种子，未导入数据库。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C05 · 书架的严格清单

来源：Codex 生成的示例；位置：仅种子，未导入数据库。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C06 · 鞋架的严格清单

来源：Codex 生成的示例；位置：仅种子，未导入数据库。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C07 · 茶几的严格清单

来源：Codex 生成的示例；位置：仅种子，未导入数据库。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C08 · 餐桌的严格清单

来源：Codex 生成的示例；位置：仅种子，未导入数据库。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C09 · 洗手池的严格清单

来源：Codex 生成的示例；位置：仅种子，未导入数据库。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

### C10 · 床头柜的严格清单

来源：Codex 生成的示例；位置：仅种子，未导入数据库。快速档数据库只存quickHint，没有快速档最低张数或角度清单字段。严格项按原始顺序：

| angle | required | hint原文 |
| --- | --- | --- |
| front | true | 产品完整入镜，使用自然光，避免遮挡 |
| quarter | true | 产品完整入镜，使用自然光，避免遮挡 |
| side | true | 产品完整入镜，使用自然光，避免遮挡 |
| top | true | 产品完整入镜，使用自然光，避免遮挡 |
| material | true | 产品完整入镜，使用自然光，避免遮挡 |
| back | true | 完整拍到背面结构 |
| hardware | true | 对焦五金和连接位置 |

## 完整原始记录（含来源，供逐字段复核）

每行是一个可解析JSON记录。seedRecord为模块初始化后的完整原型对象（包括PromptComposer为示例历史配方补全的finalPrompt和combinationKey）；databaseRecord为本次只读查询的data原值，databaseMetadata保留行ID、kind、name和updatedAt；未导入时为null。保留全部元数据、参考路径和冻结快照，不输出图片字节。不要把带U01等owner的这些对象当作已鉴权业务记录重新导入。

### categories

```jsonl
{"id":"C01","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"C01","name":"边桌","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":{"id":"C01","kind":"category","name":"边桌","tags":[],"owner":"U01","stats":{"used":18,"liked":4},"createdAt":"2026-10-01T08:00:00.000Z","quickHint":"补拍背面和细节，场景图会更准","visibility":"public","categoryIds":[],"strictChecklist":[{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"front","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"quarter","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"side","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"top","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"material","required":true},{"hint":"完整拍到背面结构","angle":"back","required":true},{"hint":"对焦五金和连接位置","angle":"hardware","required":true}],"defaultShootingMode":"quick"},"databaseMetadata":{"id":"C01","kind":"category","name":"边桌","updatedAt":"2026-10-15T00:37:22.365Z"}}
{"id":"C02","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"C02","name":"马桶架","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"defaultShootingMode":"strict","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":{"id":"C02","kind":"category","name":"马桶架","tags":[],"owner":"U01","stats":{"used":25,"liked":7},"createdAt":"2026-10-02T08:00:00.000Z","quickHint":"补拍背面和细节，场景图会更准","visibility":"public","categoryIds":[],"strictChecklist":[{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"front","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"quarter","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"side","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"top","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"material","required":true},{"hint":"完整拍到背面结构","angle":"back","required":true},{"hint":"对焦五金和连接位置","angle":"hardware","required":true}],"defaultShootingMode":"strict"},"databaseMetadata":{"id":"C02","kind":"category","name":"马桶架","updatedAt":"2026-10-15T00:37:22.392Z"}}
{"id":"C03","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"C03","name":"浴室柜","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"defaultShootingMode":"strict","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":{"id":"C03","kind":"category","name":"浴室柜","tags":[],"owner":"U01","stats":{"used":32,"liked":10},"createdAt":"2026-10-03T08:00:00.000Z","quickHint":"补拍背面和细节，场景图会更准","visibility":"public","categoryIds":[],"strictChecklist":[{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"front","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"quarter","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"side","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"top","required":true},{"hint":"产品完整入镜，使用自然光，避免遮挡","angle":"material","required":true},{"hint":"完整拍到背面结构","angle":"back","required":true},{"hint":"对焦五金和连接位置","angle":"hardware","required":true}],"defaultShootingMode":"strict"},"databaseMetadata":{"id":"C03","kind":"category","name":"浴室柜","updatedAt":"2026-10-15T00:37:22.395Z"}}
{"id":"C04","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"C04","name":"沙发","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"C05","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"C05","name":"书架","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"C06","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"C06","name":"鞋架","owner":"U02","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"C07","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"C07","name":"茶几","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"C08","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"C08","name":"餐桌","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"C09","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"C09","name":"洗手池","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"C10","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"C10","name":"床头柜","owner":"U01","visibility":"public","tags":[],"categoryIds":[],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"defaultShootingMode":"quick","quickHint":"补拍背面和细节，场景图会更准","strictChecklist":[{"angle":"front","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"quarter","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"side","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"top","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"material","required":true,"hint":"产品完整入镜，使用自然光，避免遮挡"},{"angle":"back","required":true,"hint":"完整拍到背面结构"},{"angle":"hardware","required":true,"hint":"对焦五金和连接位置"}]},"databaseRecord":null,"databaseMetadata":null}
```

### products

```jsonl
{"id":"D01","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D01","name":"栖木 · 边桌","owner":"U01","visibility":"private","tags":["边桌"],"categoryIds":["C01"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"sku":"BT-1001","categoryId":"C01","shootingMode":"quick","photos":[{"id":"O1S1","name":"正面","image":"/design-preview/r3-25.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O1S2","name":"45°侧面","image":"/design-preview/r3-28.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O1S3","name":"正侧","image":"/design-preview/r3-07.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O1S4","name":"俯视","image":"/design-preview/r3-14.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O1S5","name":"材质细节","image":"/design-preview/r3-09.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D02","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D02","name":"序间 · 马桶架","owner":"U01","visibility":"private","tags":["马桶架"],"categoryIds":["C02"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"sku":"WC-1002","categoryId":"C02","shootingMode":"strict","photos":[{"id":"O2S1","name":"正面","image":"/design-preview/r3-28.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O2S2","name":"45°侧面","image":"/design-preview/r3-07.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O2S3","name":"正侧","image":"/design-preview/r3-14.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O2S4","name":"俯视","image":"/design-preview/r3-09.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O2S5","name":"材质细节","image":"/design-preview/r3-25.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"哑光黑色金属","locked":true},{"key":"材质","value":"金属方管与木层板","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"三层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":64,"depth":26,"height":168,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D03","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D03","name":"清屿 · 浴室柜","owner":"U01","visibility":"private","tags":["浴室柜"],"categoryIds":["C03"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"sku":"BC-1003","categoryId":"C03","shootingMode":"strict","photos":[{"id":"O3S1","name":"正面","image":"/design-preview/r3-07.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O3S2","name":"45°侧面","image":"/design-preview/r3-14.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O3S3","name":"正侧","image":"/design-preview/r3-09.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O3S4","name":"俯视","image":"/design-preview/r3-25.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O3S5","name":"材质细节","image":"/design-preview/r3-28.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D04","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D04","name":"栖木 · 边桌","owner":"U01","visibility":"private","tags":["边桌"],"categoryIds":["C01"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"sku":"BT-1004","categoryId":"C01","shootingMode":"quick","photos":[{"id":"O4S1","name":"正面","image":"/design-preview/r3-25.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O4S2","name":"45°侧面","image":"/design-preview/r3-28.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O4S3","name":"正侧","image":"/design-preview/r3-07.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O4S4","name":"俯视","image":"/design-preview/r3-14.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O4S5","name":"材质细节","image":"/design-preview/r3-09.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D05","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D05","name":"序间 · 马桶架","owner":"U01","visibility":"private","tags":["马桶架"],"categoryIds":["C02"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"sku":"WC-1005","categoryId":"C02","shootingMode":"strict","photos":[{"id":"O5S1","name":"正面","image":"/design-preview/r3-28.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O5S2","name":"45°侧面","image":"/design-preview/r3-07.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O5S3","name":"正侧","image":"/design-preview/r3-14.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O5S4","name":"俯视","image":"/design-preview/r3-09.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O5S5","name":"材质细节","image":"/design-preview/r3-25.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"哑光黑色金属","locked":true},{"key":"材质","value":"金属方管与木层板","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"三层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":64,"depth":26,"height":168,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D06","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D06","name":"清屿 · 浴室柜","owner":"U02","visibility":"private","tags":["浴室柜"],"categoryIds":["C03"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"sku":"BC-1006","categoryId":"C03","shootingMode":"strict","photos":[{"id":"O6S1","name":"正面","image":"/design-preview/r3-07.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O6S2","name":"45°侧面","image":"/design-preview/r3-14.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O6S3","name":"正侧","image":"/design-preview/r3-09.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O6S4","name":"俯视","image":"/design-preview/r3-25.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O6S5","name":"材质细节","image":"/design-preview/r3-28.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D07","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D07","name":"栖木 · 边桌","owner":"U01","visibility":"private","tags":["边桌"],"categoryIds":["C01"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"sku":"BT-1007","categoryId":"C01","shootingMode":"quick","photos":[{"id":"O7S1","name":"正面","image":"/design-preview/r3-25.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O7S2","name":"45°侧面","image":"/design-preview/r3-28.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O7S3","name":"正侧","image":"/design-preview/r3-07.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O7S4","name":"俯视","image":"/design-preview/r3-14.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O7S5","name":"材质细节","image":"/design-preview/r3-09.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D08","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D08","name":"序间 · 马桶架","owner":"U01","visibility":"private","tags":["马桶架"],"categoryIds":["C02"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"sku":"WC-1008","categoryId":"C02","shootingMode":"strict","photos":[{"id":"O8S1","name":"正面","image":"/design-preview/r3-28.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O8S2","name":"45°侧面","image":"/design-preview/r3-07.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O8S3","name":"正侧","image":"/design-preview/r3-14.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O8S4","name":"俯视","image":"/design-preview/r3-09.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O8S5","name":"材质细节","image":"/design-preview/r3-25.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"哑光黑色金属","locked":true},{"key":"材质","value":"金属方管与木层板","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"三层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":64,"depth":26,"height":168,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D09","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D09","name":"清屿 · 浴室柜","owner":"U01","visibility":"private","tags":["浴室柜"],"categoryIds":["C03"],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"sku":"BC-1009","categoryId":"C03","shootingMode":"strict","photos":[{"id":"O9S1","name":"正面","image":"/design-preview/r3-07.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O9S2","name":"45°侧面","image":"/design-preview/r3-14.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O9S3","name":"正侧","image":"/design-preview/r3-09.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O9S4","name":"俯视","image":"/design-preview/r3-25.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O9S5","name":"材质细节","image":"/design-preview/r3-28.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D10","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D10","name":"栖木 · 边桌","owner":"U01","visibility":"private","tags":["边桌"],"categoryIds":["C01"],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"sku":"BT-1010","categoryId":"C01","shootingMode":"quick","photos":[{"id":"O10S1","name":"正面","image":"/design-preview/r3-25.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O10S2","name":"45°侧面","image":"/design-preview/r3-28.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O10S3","name":"正侧","image":"/design-preview/r3-07.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O10S4","name":"俯视","image":"/design-preview/r3-14.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O10S5","name":"材质细节","image":"/design-preview/r3-09.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D11","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D11","name":"序间 · 马桶架","owner":"U01","visibility":"private","tags":["马桶架"],"categoryIds":["C02"],"createdAt":"2026-10-11T08:00:00.000Z","stats":{"used":88,"liked":34},"sku":"WC-1011","categoryId":"C02","shootingMode":"strict","photos":[{"id":"O11S1","name":"正面","image":"/design-preview/r3-28.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O11S2","name":"45°侧面","image":"/design-preview/r3-07.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O11S3","name":"正侧","image":"/design-preview/r3-14.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O11S4","name":"俯视","image":"/design-preview/r3-09.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O11S5","name":"材质细节","image":"/design-preview/r3-25.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"哑光黑色金属","locked":true},{"key":"材质","value":"金属方管与木层板","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"三层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":64,"depth":26,"height":168,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
{"id":"D12","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"D12","name":"清屿 · 浴室柜","owner":"U01","visibility":"private","tags":["浴室柜"],"categoryIds":["C03"],"createdAt":"2026-10-12T08:00:00.000Z","stats":{"used":95,"liked":37},"sku":"BC-1012","categoryId":"C03","shootingMode":"strict","photos":[{"id":"O12S1","name":"正面","image":"/design-preview/r3-07.webp","angle":"front","original":true,"angleSource":"mock","source":"fixture"},{"id":"O12S2","name":"45°侧面","image":"/design-preview/r3-14.webp","angle":"quarter","original":true,"angleSource":"mock","source":"fixture"},{"id":"O12S3","name":"正侧","image":"/design-preview/r3-09.webp","angle":"side","original":true,"angleSource":"mock","source":"fixture"},{"id":"O12S4","name":"俯视","image":"/design-preview/r3-25.webp","angle":"top","original":true,"angleSource":"mock","source":"fixture"},{"id":"O12S5","name":"材质细节","image":"/design-preview/r3-28.webp","angle":"material","original":true,"angleSource":"mock","source":"fixture"}],"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"databaseRecord":null,"databaseMetadata":null}
```

### scenes

```jsonl
{"id":"S01","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S01","name":"卧室·床头边桌·晨光","owner":"U01","visibility":"public","tags":["边桌","卧室","自然","柔和晨光"],"categoryIds":["C01"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"kind":"scene","skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G01"],"coverImage":"/design-preview/r3-17.webp"},"databaseRecord":{"id":"S01","kind":"scene","name":"卧室·床头边桌·晨光","tags":["边桌","卧室","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U01","stats":{"used":18,"liked":4},"skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-01T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-17.webp","visibility":"public","categoryIds":["C01"],"defaultPropSetIds":["G01"]},"databaseMetadata":{"id":"S01","kind":"scene","name":"卧室·床头边桌·晨光","updatedAt":"2026-10-15T00:37:22.397Z"}}
{"id":"S02","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S02","name":"客厅·沙发边桌·午后","owner":"U01","visibility":"public","tags":["边桌","客厅","自然","柔和晨光"],"categoryIds":["C01"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"kind":"scene","skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G02"],"coverImage":"/design-preview/r3-05.webp"},"databaseRecord":{"id":"S02","kind":"scene","name":"客厅·沙发边桌·午后","tags":["边桌","客厅","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U01","stats":{"used":25,"liked":7},"skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-02T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-05.webp","visibility":"public","categoryIds":["C01"],"defaultPropSetIds":["G02"]},"databaseMetadata":{"id":"S02","kind":"scene","name":"客厅·沙发边桌·午后","updatedAt":"2026-10-15T00:37:22.399Z"}}
{"id":"S03","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S03","name":"浴室·马桶架·清爽收纳","owner":"U01","visibility":"public","tags":["马桶架","浴室","自然","柔和晨光"],"categoryIds":["C02"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"kind":"scene","skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G03"],"coverImage":"/design-preview/r3-07.webp"},"databaseRecord":{"id":"S03","kind":"scene","name":"浴室·马桶架·清爽收纳","tags":["马桶架","浴室","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U01","stats":{"used":32,"liked":10},"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-03T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-07.webp","visibility":"public","categoryIds":["C02"],"defaultPropSetIds":["G03"]},"databaseMetadata":{"id":"S03","kind":"scene","name":"浴室·马桶架·清爽收纳","updatedAt":"2026-10-15T00:37:22.401Z"}}
{"id":"S04","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S04","name":"浴室·浴室柜·自然光","owner":"U01","visibility":"public","tags":["浴室柜","浴室","自然","柔和晨光"],"categoryIds":["C03"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"kind":"scene","skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G04"],"coverImage":"/design-preview/r3-09.webp"},"databaseRecord":{"id":"S04","kind":"scene","name":"浴室·浴室柜·自然光","tags":["浴室柜","浴室","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U01","stats":{"used":39,"liked":13},"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-04T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-09.webp","visibility":"public","categoryIds":["C03"],"defaultPropSetIds":["G04"]},"databaseMetadata":{"id":"S04","kind":"scene","name":"浴室·浴室柜·自然光","updatedAt":"2026-10-15T00:37:22.404Z"}}
{"id":"S05","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S05","name":"卧室·边桌·安静阅读","owner":"U01","visibility":"public","tags":["边桌","卧室","自然","柔和晨光"],"categoryIds":["C01"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"kind":"scene","skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G10"],"coverImage":"/design-preview/r3-03.webp"},"databaseRecord":{"id":"S05","kind":"scene","name":"卧室·边桌·安静阅读","tags":["边桌","卧室","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U01","stats":{"used":46,"liked":16},"skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-05T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-03.webp","visibility":"public","categoryIds":["C01"],"defaultPropSetIds":["G10"]},"databaseMetadata":{"id":"S05","kind":"scene","name":"卧室·边桌·安静阅读","updatedAt":"2026-10-15T00:37:22.410Z"}}
{"id":"S06","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S06","name":"客厅·边桌·原木留白","owner":"U02","visibility":"pending","tags":["边桌","客厅","自然","柔和晨光"],"categoryIds":["C01"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"kind":"scene","skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G02"],"coverImage":"/design-preview/r3-13.webp"},"databaseRecord":{"id":"S06","kind":"scene","name":"客厅·边桌·原木留白","tags":["边桌","客厅","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U02","stats":{"used":53,"liked":19},"skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-06T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-13.webp","visibility":"public","categoryIds":["C01"],"defaultPropSetIds":["G02"]},"databaseMetadata":{"id":"S06","kind":"scene","name":"客厅·边桌·原木留白","updatedAt":"2026-10-15T00:37:22.413Z"}}
{"id":"S07","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S07","name":"浴室·马桶架·小空间","owner":"U01","visibility":"private","tags":["马桶架","浴室","自然","柔和晨光"],"categoryIds":["C02"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"kind":"scene","skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G03"],"coverImage":"/design-preview/r3-28.webp"},"databaseRecord":{"id":"S07","kind":"scene","name":"浴室·马桶架·小空间","tags":["马桶架","浴室","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U01","stats":{"used":60,"liked":22},"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-07T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-28.webp","visibility":"public","categoryIds":["C02"],"defaultPropSetIds":["G03"]},"databaseMetadata":{"id":"S07","kind":"scene","name":"浴室·马桶架·小空间","updatedAt":"2026-10-15T00:37:22.416Z"}}
{"id":"S08","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"S08","name":"浴室·浴室柜·酒店氛围","owner":"U01","visibility":"public","tags":["浴室柜","浴室","自然","柔和晨光"],"categoryIds":["C03"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"kind":"scene","skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G04"],"coverImage":"/design-preview/r3-18.webp"},"databaseRecord":{"id":"S08","kind":"scene","name":"浴室·浴室柜·酒店氛围","tags":["浴室柜","浴室","自然","柔和晨光"],"fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"owner":"U01","stats":{"used":67,"liked":25},"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","createdAt":"2026-10-08T08:00:00.000Z","variables":[{"key":"lighting","label":"光线","options":[{"label":"柔和晨光","value":"soft morning window light"},{"label":"午后侧光","value":"warm afternoon side light"},{"label":"阴天漫射光","value":"overcast diffused daylight"}]},{"key":"camera","label":"机位","options":[{"label":"平视 45°","value":"eye-level three-quarter view, 50mm"},{"label":"正面平视","value":"front view, 70mm, straight verticals"},{"label":"轻俯视","value":"slightly elevated view, 50mm"}]},{"key":"palette","label":"配色","options":[{"label":"暖白原木","value":"warm ivory and natural oak"},{"label":"浅灰苔绿","value":"soft grey with muted green accents"},{"label":"沙色胡桃","value":"sand beige and walnut brown"}]}],"coverImage":"/design-preview/r3-18.webp","visibility":"public","categoryIds":["C03"],"defaultPropSetIds":["G04"]},"databaseMetadata":{"id":"S08","kind":"scene","name":"浴室·浴室柜·酒店氛围","updatedAt":"2026-10-15T00:37:22.419Z"}}
{"id":"S09","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"S09","name":"浴室·洗手池·台面秩序","owner":"U01","visibility":"public","tags":["洗手池","浴室","自然","柔和晨光"],"categoryIds":["C09"],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"kind":"scene","skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G05"],"coverImage":"/design-preview/r3-29.webp"},"databaseRecord":null,"databaseMetadata":null}
{"id":"S10","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"S10","name":"客厅·沙发·轻松周末","owner":"U01","visibility":"public","tags":["沙发","客厅","自然","柔和晨光"],"categoryIds":["C04"],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"kind":"scene","skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G06"],"coverImage":"/design-preview/r3-10.webp"},"databaseRecord":null,"databaseMetadata":null}
{"id":"S11","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"S11","name":"书房·书架·午后阅读","owner":"U01","visibility":"public","tags":["书架","书房","自然","柔和晨光"],"categoryIds":["C05"],"createdAt":"2026-10-11T08:00:00.000Z","stats":{"used":88,"liked":34},"kind":"scene","skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G09"],"coverImage":"/design-preview/r3-11.webp"},"databaseRecord":null,"databaseMetadata":null}
{"id":"S12","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"S12","name":"卧室·床头柜·柔和灯光","owner":"U01","visibility":"public","tags":["床头柜","卧室","自然","柔和晨光"],"categoryIds":["C10"],"createdAt":"2026-10-12T08:00:00.000Z","stats":{"used":95,"liked":37},"kind":"scene","skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."],"variables":[{"key":"lighting","label":"光线","options":[{"value":"soft morning window light","label":"柔和晨光"},{"value":"warm afternoon side light","label":"午后侧光"},{"value":"overcast diffused daylight","label":"阴天漫射光"}]},{"key":"camera","label":"机位","options":[{"value":"eye-level three-quarter view, 50mm","label":"平视 45°"},{"value":"front view, 70mm, straight verticals","label":"正面平视"},{"value":"slightly elevated view, 50mm","label":"轻俯视"}]},{"key":"palette","label":"配色","options":[{"value":"warm ivory and natural oak","label":"暖白原木"},{"value":"soft grey with muted green accents","label":"浅灰苔绿"},{"value":"sand beige and walnut brown","label":"沙色胡桃"}]}],"defaultPropSetIds":["G07"],"coverImage":"/design-preview/r3-26.webp"},"databaseRecord":null,"databaseMetadata":null}
```

### props

```jsonl
{"id":"P01","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P01","name":"陶瓷杯","owner":"U01","visibility":"public","tags":["边桌","卧室","客厅","自然"],"categoryIds":["C01","C02","C03","C10"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"kind":"prop","keywordsEn":"ceramic coffee mug","shape":"圆柱","color":"奶油白","material":"陶瓷","size":"小","sceneTags":["卧室","客厅"],"categoryTags":["边桌"],"refImages":["/design-preview/r3-29.webp"]},"databaseRecord":{"id":"P01","kind":"prop","name":"陶瓷杯","size":"小","tags":["边桌","卧室","客厅","自然"],"color":"奶油白","owner":"U01","shape":"圆柱","stats":{"used":18,"liked":4},"material":"陶瓷","createdAt":"2026-10-01T08:00:00.000Z","refImages":["/design-preview/r3-29.webp"],"sceneTags":["卧室","客厅"],"keywordsEn":"ceramic coffee mug","visibility":"public","categoryIds":["C01","C02","C03","C10"],"categoryTags":["边桌"]},"databaseMetadata":{"id":"P01","kind":"prop","name":"陶瓷杯","updatedAt":"2026-10-15T00:37:22.421Z"}}
{"id":"P02","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P02","name":"亚麻书册","owner":"U01","visibility":"public","tags":["边桌","卧室","客厅","自然"],"categoryIds":["C01","C02","C03","C04","C10","C05"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"kind":"prop","keywordsEn":"linen covered book","shape":"长方体","color":"米灰","material":"纸张与布面","size":"小","sceneTags":["卧室","客厅"],"categoryTags":["边桌"],"refImages":["/design-preview/r3-09.webp"]},"databaseRecord":{"id":"P02","kind":"prop","name":"亚麻书册","size":"小","tags":["边桌","卧室","客厅","自然"],"color":"米灰","owner":"U01","shape":"长方体","stats":{"used":25,"liked":7},"material":"纸张与布面","createdAt":"2026-10-02T08:00:00.000Z","refImages":["/design-preview/r3-09.webp"],"sceneTags":["卧室","客厅"],"keywordsEn":"linen covered book","visibility":"public","categoryIds":["C01","C02","C03","C04","C10","C05"],"categoryTags":["边桌"]},"databaseMetadata":{"id":"P02","kind":"prop","name":"亚麻书册","updatedAt":"2026-10-15T00:37:22.422Z"}}
{"id":"P03","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P03","name":"橄榄枝花瓶","owner":"U01","visibility":"public","tags":["边桌","卧室","客厅","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"kind":"prop","keywordsEn":"olive branch in stoneware vase","shape":"椭圆","color":"苔绿","material":"石器与植物","size":"中","sceneTags":["卧室","客厅"],"categoryTags":["边桌"],"refImages":["/design-preview/r3-02.webp"]},"databaseRecord":{"id":"P03","kind":"prop","name":"橄榄枝花瓶","size":"中","tags":["边桌","卧室","客厅","自然"],"color":"苔绿","owner":"U01","shape":"椭圆","stats":{"used":32,"liked":10},"material":"石器与植物","createdAt":"2026-10-03T08:00:00.000Z","refImages":["/design-preview/r3-02.webp"],"sceneTags":["卧室","客厅"],"keywordsEn":"olive branch in stoneware vase","visibility":"public","categoryIds":["C01","C02","C03"],"categoryTags":["边桌"]},"databaseMetadata":{"id":"P03","kind":"prop","name":"橄榄枝花瓶","updatedAt":"2026-10-15T00:37:22.424Z"}}
{"id":"P04","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P04","name":"棉质毛巾","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"kind":"prop","keywordsEn":"folded cotton towel","shape":"折叠方形","color":"暖白","material":"棉","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-07.webp"]},"databaseRecord":{"id":"P04","kind":"prop","name":"棉质毛巾","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"暖白","owner":"U01","shape":"折叠方形","stats":{"used":39,"liked":13},"material":"棉","createdAt":"2026-10-04T08:00:00.000Z","refImages":["/design-preview/r3-07.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"folded cotton towel","visibility":"public","categoryIds":["C01","C02","C03"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P04","kind":"prop","name":"棉质毛巾","updatedAt":"2026-10-15T00:37:22.426Z"}}
{"id":"P05","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P05","name":"玻璃香薰","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"kind":"prop","keywordsEn":"amber glass diffuser","shape":"圆柱","color":"琥珀","material":"玻璃","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-28.webp"]},"databaseRecord":{"id":"P05","kind":"prop","name":"玻璃香薰","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"琥珀","owner":"U01","shape":"圆柱","stats":{"used":46,"liked":16},"material":"玻璃","createdAt":"2026-10-05T08:00:00.000Z","refImages":["/design-preview/r3-28.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"amber glass diffuser","visibility":"public","categoryIds":["C01","C02","C03"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P05","kind":"prop","name":"玻璃香薰","updatedAt":"2026-10-15T00:37:22.427Z"}}
{"id":"P06","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P06","name":"藤编收纳篮","owner":"U02","visibility":"pending","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"kind":"prop","keywordsEn":"woven rattan storage basket","shape":"圆筒","color":"原木","material":"藤编","size":"中","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-20.webp"]},"databaseRecord":{"id":"P06","kind":"prop","name":"藤编收纳篮","size":"中","tags":["浴室","马桶架","浴室柜","简约"],"color":"原木","owner":"U02","shape":"圆筒","stats":{"used":53,"liked":19},"material":"藤编","createdAt":"2026-10-06T08:00:00.000Z","refImages":["/design-preview/r3-20.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"woven rattan storage basket","visibility":"public","categoryIds":["C01","C02","C03"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P06","kind":"prop","name":"藤编收纳篮","updatedAt":"2026-10-15T00:37:22.429Z"}}
{"id":"P07","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P07","name":"皂液瓶","owner":"U01","visibility":"private","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C09"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"kind":"prop","keywordsEn":"minimal soap dispenser","shape":"圆柱","color":"哑光白","material":"陶瓷","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-14.webp"]},"databaseRecord":{"id":"P07","kind":"prop","name":"皂液瓶","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"哑光白","owner":"U01","shape":"圆柱","stats":{"used":60,"liked":22},"material":"陶瓷","createdAt":"2026-10-07T08:00:00.000Z","refImages":["/design-preview/r3-14.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"minimal soap dispenser","visibility":"public","categoryIds":["C01","C02","C03","C09"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P07","kind":"prop","name":"皂液瓶","updatedAt":"2026-10-15T00:37:22.430Z"}}
{"id":"P08","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P08","name":"托盘","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C07"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"kind":"prop","keywordsEn":"oval wooden tray","shape":"椭圆","color":"胡桃棕","material":"木材","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-25.webp"]},"databaseRecord":{"id":"P08","kind":"prop","name":"托盘","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"胡桃棕","owner":"U01","shape":"椭圆","stats":{"used":67,"liked":25},"material":"木材","createdAt":"2026-10-08T08:00:00.000Z","refImages":["/design-preview/r3-25.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"oval wooden tray","visibility":"public","categoryIds":["C01","C02","C03","C07"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P08","kind":"prop","name":"托盘","updatedAt":"2026-10-15T00:37:22.432Z"}}
{"id":"P09","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P09","name":"台灯","owner":"U01","visibility":"public","tags":["边桌","卧室","客厅","自然"],"categoryIds":["C01","C02","C03","C10"],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"kind":"prop","keywordsEn":"compact dome table lamp","shape":"半球","color":"沙色","material":"金属","size":"中","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-08.webp"]},"databaseRecord":{"id":"P09","kind":"prop","name":"台灯","size":"中","tags":["边桌","卧室","客厅","自然"],"color":"沙色","owner":"U01","shape":"半球","stats":{"used":74,"liked":28},"material":"金属","createdAt":"2026-10-09T08:00:00.000Z","refImages":["/design-preview/r3-08.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"compact dome table lamp","visibility":"public","categoryIds":["C01","C02","C03","C10"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P09","kind":"prop","name":"台灯","updatedAt":"2026-10-15T00:37:22.434Z"}}
{"id":"P10","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P10","name":"盆栽","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C05"],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"kind":"prop","keywordsEn":"small potted fern","shape":"自然叶形","color":"绿色","material":"植物与陶土","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-01.webp"]},"databaseRecord":{"id":"P10","kind":"prop","name":"盆栽","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"绿色","owner":"U01","shape":"自然叶形","stats":{"used":81,"liked":31},"material":"植物与陶土","createdAt":"2026-10-10T08:00:00.000Z","refImages":["/design-preview/r3-01.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"small potted fern","visibility":"public","categoryIds":["C01","C02","C03","C05"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P10","kind":"prop","name":"盆栽","updatedAt":"2026-10-15T00:37:22.435Z"}}
{"id":"P11","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P11","name":"棉麻抱枕","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C04"],"createdAt":"2026-10-11T08:00:00.000Z","stats":{"used":88,"liked":34},"kind":"prop","keywordsEn":"linen accent cushion","shape":"方形","color":"浅灰","material":"亚麻","size":"中","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-29.webp"]},"databaseRecord":{"id":"P11","kind":"prop","name":"棉麻抱枕","size":"中","tags":["浴室","马桶架","浴室柜","简约"],"color":"浅灰","owner":"U01","shape":"方形","stats":{"used":88,"liked":34},"material":"亚麻","createdAt":"2026-10-11T08:00:00.000Z","refImages":["/design-preview/r3-29.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"linen accent cushion","visibility":"public","categoryIds":["C01","C02","C03","C04"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P11","kind":"prop","name":"棉麻抱枕","updatedAt":"2026-10-15T00:37:22.437Z"}}
{"id":"P12","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P12","name":"浴盐罐","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-12T08:00:00.000Z","stats":{"used":95,"liked":37},"kind":"prop","keywordsEn":"clear glass bath salt jar","shape":"圆柱","color":"透明","material":"玻璃","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-09.webp"]},"databaseRecord":{"id":"P12","kind":"prop","name":"浴盐罐","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"透明","owner":"U01","shape":"圆柱","stats":{"used":95,"liked":37},"material":"玻璃","createdAt":"2026-10-12T08:00:00.000Z","refImages":["/design-preview/r3-09.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"clear glass bath salt jar","visibility":"public","categoryIds":["C01","C02","C03"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P12","kind":"prop","name":"浴盐罐","updatedAt":"2026-10-15T00:37:22.440Z"}}
{"id":"P13","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P13","name":"香氛蜡烛","owner":"U02","visibility":"pending","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C07"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":102,"liked":40},"kind":"prop","keywordsEn":"unscented pillar candle","shape":"圆柱","color":"象牙白","material":"植物蜡","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-02.webp"]},"databaseRecord":{"id":"P13","kind":"prop","name":"香氛蜡烛","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"象牙白","owner":"U02","shape":"圆柱","stats":{"used":102,"liked":40},"material":"植物蜡","createdAt":"2026-10-01T08:00:00.000Z","refImages":["/design-preview/r3-02.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"unscented pillar candle","visibility":"public","categoryIds":["C01","C02","C03","C07"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P13","kind":"prop","name":"香氛蜡烛","updatedAt":"2026-10-15T00:37:22.441Z"}}
{"id":"P14","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P14","name":"手工碗","owner":"U01","visibility":"private","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C09"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":109,"liked":43},"kind":"prop","keywordsEn":"handmade stoneware bowl","shape":"浅圆碗","color":"灰褐","material":"石器","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-07.webp"]},"databaseRecord":{"id":"P14","kind":"prop","name":"手工碗","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"灰褐","owner":"U01","shape":"浅圆碗","stats":{"used":109,"liked":43},"material":"石器","createdAt":"2026-10-02T08:00:00.000Z","refImages":["/design-preview/r3-07.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"handmade stoneware bowl","visibility":"public","categoryIds":["C01","C02","C03","C09"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P14","kind":"prop","name":"手工碗","updatedAt":"2026-10-15T00:37:22.443Z"}}
{"id":"P15","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P15","name":"木梳","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":116,"liked":46},"kind":"prop","keywordsEn":"natural wooden comb","shape":"长条","color":"浅木","material":"木材","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-28.webp"]},"databaseRecord":{"id":"P15","kind":"prop","name":"木梳","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"浅木","owner":"U01","shape":"长条","stats":{"used":116,"liked":46},"material":"木材","createdAt":"2026-10-03T08:00:00.000Z","refImages":["/design-preview/r3-28.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"natural wooden comb","visibility":"public","categoryIds":["C01","C02","C03"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P15","kind":"prop","name":"木梳","updatedAt":"2026-10-15T00:37:22.445Z"}}
{"id":"P16","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P16","name":"浴巾","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":123,"liked":49},"kind":"prop","keywordsEn":"rolled bath towel","shape":"卷筒","color":"米白","material":"棉","size":"中","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-20.webp"]},"databaseRecord":{"id":"P16","kind":"prop","name":"浴巾","size":"中","tags":["浴室","马桶架","浴室柜","简约"],"color":"米白","owner":"U01","shape":"卷筒","stats":{"used":123,"liked":49},"material":"棉","createdAt":"2026-10-04T08:00:00.000Z","refImages":["/design-preview/r3-20.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"rolled bath towel","visibility":"public","categoryIds":["C01","C02","C03"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P16","kind":"prop","name":"浴巾","updatedAt":"2026-10-15T00:37:22.446Z"}}
{"id":"P17","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P17","name":"抽象画","owner":"U01","visibility":"public","tags":["边桌","卧室","客厅","自然"],"categoryIds":["C01","C02","C03","C05"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":130,"liked":52},"kind":"prop","keywordsEn":"small framed abstract print","shape":"长方形","color":"黑白","material":"纸与木框","size":"中","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-14.webp"]},"databaseRecord":{"id":"P17","kind":"prop","name":"抽象画","size":"中","tags":["边桌","卧室","客厅","自然"],"color":"黑白","owner":"U01","shape":"长方形","stats":{"used":130,"liked":52},"material":"纸与木框","createdAt":"2026-10-05T08:00:00.000Z","refImages":["/design-preview/r3-14.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"small framed abstract print","visibility":"public","categoryIds":["C01","C02","C03","C05"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P17","kind":"prop","name":"抽象画","updatedAt":"2026-10-15T00:37:22.448Z"}}
{"id":"P18","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P18","name":"软织毯","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C04"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":137,"liked":55},"kind":"prop","keywordsEn":"soft woven throw","shape":"矩形折叠","color":"燕麦色","material":"羊毛","size":"中","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-25.webp"]},"databaseRecord":{"id":"P18","kind":"prop","name":"软织毯","size":"中","tags":["浴室","马桶架","浴室柜","简约"],"color":"燕麦色","owner":"U01","shape":"矩形折叠","stats":{"used":137,"liked":55},"material":"羊毛","createdAt":"2026-10-06T08:00:00.000Z","refImages":["/design-preview/r3-25.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"soft woven throw","visibility":"public","categoryIds":["C01","C02","C03","C04"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P18","kind":"prop","name":"软织毯","updatedAt":"2026-10-15T00:37:22.450Z"}}
{"id":"P19","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P19","name":"玻璃水壶","owner":"U01","visibility":"public","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C07"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":144,"liked":58},"kind":"prop","keywordsEn":"clear glass carafe","shape":"圆锥","color":"透明","material":"玻璃","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-08.webp"]},"databaseRecord":{"id":"P19","kind":"prop","name":"玻璃水壶","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"透明","owner":"U01","shape":"圆锥","stats":{"used":144,"liked":58},"material":"玻璃","createdAt":"2026-10-07T08:00:00.000Z","refImages":["/design-preview/r3-08.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"clear glass carafe","visibility":"public","categoryIds":["C01","C02","C03","C07"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P19","kind":"prop","name":"玻璃水壶","updatedAt":"2026-10-15T00:37:22.452Z"}}
{"id":"P20","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"P20","name":"洗漱杯","owner":"U02","visibility":"pending","tags":["浴室","马桶架","浴室柜","简约"],"categoryIds":["C01","C02","C03","C09"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":151,"liked":61},"kind":"prop","keywordsEn":"simple bathroom tumbler","shape":"圆柱","color":"浅灰","material":"陶瓷","size":"小","sceneTags":["浴室","客厅"],"categoryTags":["马桶架","浴室柜"],"refImages":["/design-preview/r3-01.webp"]},"databaseRecord":{"id":"P20","kind":"prop","name":"洗漱杯","size":"小","tags":["浴室","马桶架","浴室柜","简约"],"color":"浅灰","owner":"U02","shape":"圆柱","stats":{"used":151,"liked":61},"material":"陶瓷","createdAt":"2026-10-08T08:00:00.000Z","refImages":["/design-preview/r3-01.webp"],"sceneTags":["浴室","客厅"],"keywordsEn":"simple bathroom tumbler","visibility":"public","categoryIds":["C01","C02","C03","C09"],"categoryTags":["马桶架","浴室柜"]},"databaseMetadata":{"id":"P20","kind":"prop","name":"洗漱杯","updatedAt":"2026-10-15T00:37:22.453Z"}}
```

### propSets

```jsonl
{"id":"G01","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"G01","name":"边桌·卧室","owner":"U01","visibility":"public","tags":["边桌","卧室"],"categoryIds":["C01"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"kind":"set","propIds":["P01","P02","P03","P09"],"maxPick":3},"databaseRecord":{"id":"G01","kind":"set","name":"边桌·卧室","tags":["边桌","卧室"],"owner":"U01","stats":{"used":18,"liked":4},"maxPick":3,"propIds":["P01","P02","P03","P09"],"createdAt":"2026-10-01T08:00:00.000Z","visibility":"public","categoryIds":["C01"]},"databaseMetadata":{"id":"G01","kind":"set","name":"边桌·卧室","updatedAt":"2026-10-15T00:37:22.455Z"}}
{"id":"G02","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"G02","name":"边桌·客厅","owner":"U01","visibility":"public","tags":["边桌","客厅"],"categoryIds":["C01"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"kind":"set","propIds":["P08","P10","P17","P13"],"maxPick":3},"databaseRecord":{"id":"G02","kind":"set","name":"边桌·客厅","tags":["边桌","客厅"],"owner":"U01","stats":{"used":25,"liked":7},"maxPick":3,"propIds":["P08","P10","P17","P13"],"createdAt":"2026-10-02T08:00:00.000Z","visibility":"public","categoryIds":["C01"]},"databaseMetadata":{"id":"G02","kind":"set","name":"边桌·客厅","updatedAt":"2026-10-15T00:37:22.457Z"}}
{"id":"G03","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"G03","name":"马桶架·浴室","owner":"U01","visibility":"public","tags":["马桶架","浴室"],"categoryIds":["C02"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"kind":"set","propIds":["P04","P06","P12","P16"],"maxPick":3},"databaseRecord":{"id":"G03","kind":"set","name":"马桶架·浴室","tags":["马桶架","浴室"],"owner":"U01","stats":{"used":32,"liked":10},"maxPick":3,"propIds":["P04","P06","P12","P16"],"createdAt":"2026-10-03T08:00:00.000Z","visibility":"public","categoryIds":["C02"]},"databaseMetadata":{"id":"G03","kind":"set","name":"马桶架·浴室","updatedAt":"2026-10-15T00:37:22.458Z"}}
{"id":"G04","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"G04","name":"浴室柜·浴室","owner":"U01","visibility":"public","tags":["浴室柜","浴室"],"categoryIds":["C03"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"kind":"set","propIds":["P07","P15","P20","P05"],"maxPick":3},"databaseRecord":{"id":"G04","kind":"set","name":"浴室柜·浴室","tags":["浴室柜","浴室"],"owner":"U01","stats":{"used":39,"liked":13},"maxPick":3,"propIds":["P07","P15","P20","P05"],"createdAt":"2026-10-04T08:00:00.000Z","visibility":"public","categoryIds":["C03"]},"databaseMetadata":{"id":"G04","kind":"set","name":"浴室柜·浴室","updatedAt":"2026-10-15T00:37:22.460Z"}}
{"id":"G05","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"G05","name":"洗手池·台面","owner":"U01","visibility":"public","tags":["洗手池","台面"],"categoryIds":["C09"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"kind":"set","propIds":["P07","P20","P14"],"maxPick":2},"databaseRecord":null,"databaseMetadata":null}
{"id":"G06","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"G06","name":"沙发·客厅","owner":"U02","visibility":"pending","tags":["沙发","客厅"],"categoryIds":["C04"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"kind":"set","propIds":["P11","P18","P02"],"maxPick":2},"databaseRecord":null,"databaseMetadata":null}
{"id":"G07","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"G07","name":"床头柜·卧室","owner":"U01","visibility":"private","tags":["床头柜","卧室"],"categoryIds":["C10"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"kind":"set","propIds":["P09","P01","P02"],"maxPick":2},"databaseRecord":null,"databaseMetadata":null}
{"id":"G08","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"G08","name":"茶几·客厅","owner":"U01","visibility":"public","tags":["茶几","客厅"],"categoryIds":["C07"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"kind":"set","propIds":["P08","P19","P13"],"maxPick":3},"databaseRecord":null,"databaseMetadata":null}
{"id":"G09","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"G09","name":"书架·书房","owner":"U01","visibility":"public","tags":["书架","书房"],"categoryIds":["C05"],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"kind":"set","propIds":["P02","P17","P10"],"maxPick":3},"databaseRecord":null,"databaseMetadata":null}
{"id":"G10","origin":"Codex 生成的示例","position":"数据库 + 种子","seedRecord":{"id":"G10","name":"边桌·阅读角","owner":"U01","visibility":"public","tags":["边桌","阅读角"],"categoryIds":["C01"],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"kind":"set","propIds":["P02","P09","P18"],"maxPick":2},"databaseRecord":{"id":"G10","kind":"set","name":"边桌·阅读角","tags":["边桌","阅读角"],"owner":"U01","stats":{"used":81,"liked":31},"maxPick":2,"propIds":["P02","P09","P18"],"createdAt":"2026-10-10T08:00:00.000Z","visibility":"public","categoryIds":["C01"]},"databaseMetadata":{"id":"G10","kind":"set","name":"边桌·阅读角","updatedAt":"2026-10-15T00:37:22.461Z"}}
```

### references

```jsonl
{"id":"R01","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R01","name":"卧室柔光参考 1","owner":"U01","visibility":"public","tags":["边桌","卧室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"kind":"reference","image":"/design-preview/r3-03.webp","source":"Unsplash · 本地样图","spaceTag":"卧室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E01"],"score":85},"databaseRecord":null,"databaseMetadata":null}
{"id":"R02","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R02","name":"客厅留白参考 1","owner":"U01","visibility":"public","tags":["边桌","客厅","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"kind":"reference","image":"/design-preview/r3-05.webp","source":"Unsplash · 本地样图","spaceTag":"客厅","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E02"],"score":86},"databaseRecord":null,"databaseMetadata":null}
{"id":"R03","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R03","name":"浴室秩序参考 1","owner":"U01","visibility":"public","tags":["浴室柜","马桶架","浴室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"kind":"reference","image":"/design-preview/r3-07.webp","source":"Unsplash · 本地样图","spaceTag":"浴室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E03"],"score":87},"databaseRecord":null,"databaseMetadata":null}
{"id":"R04","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R04","name":"卧室柔光参考 2","owner":"U01","visibility":"public","tags":["边桌","卧室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"kind":"reference","image":"/design-preview/r3-10.webp","source":"Unsplash · 本地样图","spaceTag":"卧室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E04"],"score":88},"databaseRecord":null,"databaseMetadata":null}
{"id":"R05","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R05","name":"客厅留白参考 2","owner":"U01","visibility":"public","tags":["边桌","客厅","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"kind":"reference","image":"/design-preview/r3-13.webp","source":"Unsplash · 本地样图","spaceTag":"客厅","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E05"],"score":89},"databaseRecord":null,"databaseMetadata":null}
{"id":"R06","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R06","name":"浴室秩序参考 2","owner":"U02","visibility":"pending","tags":["浴室柜","马桶架","浴室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"kind":"reference","image":"/design-preview/r3-15.webp","source":"Unsplash · 本地样图","spaceTag":"浴室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E06"],"score":90},"databaseRecord":null,"databaseMetadata":null}
{"id":"R07","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R07","name":"卧室柔光参考 3","owner":"U01","visibility":"private","tags":["边桌","卧室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"kind":"reference","image":"/design-preview/r3-17.webp","source":"Unsplash · 本地样图","spaceTag":"卧室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E07"],"score":91},"databaseRecord":null,"databaseMetadata":null}
{"id":"R08","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R08","name":"客厅留白参考 3","owner":"U01","visibility":"public","tags":["边桌","客厅","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"kind":"reference","image":"/design-preview/r3-18.webp","source":"Unsplash · 本地样图","spaceTag":"客厅","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E08"],"score":92},"databaseRecord":null,"databaseMetadata":null}
{"id":"R09","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R09","name":"浴室秩序参考 3","owner":"U01","visibility":"public","tags":["浴室柜","马桶架","浴室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"kind":"reference","image":"/design-preview/r3-19.webp","source":"Unsplash · 本地样图","spaceTag":"浴室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E09"],"score":93},"databaseRecord":null,"databaseMetadata":null}
{"id":"R10","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R10","name":"卧室柔光参考 4","owner":"U01","visibility":"public","tags":["边桌","卧室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"kind":"reference","image":"/design-preview/r3-20.webp","source":"Unsplash · 本地样图","spaceTag":"卧室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E10"],"score":94},"databaseRecord":null,"databaseMetadata":null}
{"id":"R11","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R11","name":"客厅留白参考 4","owner":"U01","visibility":"public","tags":["边桌","客厅","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-11T08:00:00.000Z","stats":{"used":88,"liked":34},"kind":"reference","image":"/design-preview/r3-26.webp","source":"Unsplash · 本地样图","spaceTag":"客厅","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E11"],"score":85},"databaseRecord":null,"databaseMetadata":null}
{"id":"R12","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"R12","name":"浴室秩序参考 4","owner":"U01","visibility":"public","tags":["浴室柜","马桶架","浴室","自然","柔和晨光"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-12T08:00:00.000Z","stats":{"used":95,"liked":37},"kind":"reference","image":"/design-preview/r3-28.webp","source":"Unsplash · 本地样图","spaceTag":"浴室","styleTag":"自然","lightingTag":"柔和晨光","categoryTags":["边桌","马桶架","浴室柜"],"usedBy":["E12"],"score":86},"databaseRecord":null,"databaseMetadata":null}
```

### snippets

```jsonl
{"id":"K01","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K01","name":"保留产品轮廓","owner":"U01","visibility":"public","tags":["边桌","浴室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"kind":"snippet","text":"保留产品颜色、轮廓与部件位置","usageCount":4},"databaseRecord":null,"databaseMetadata":null}
{"id":"K02","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K02","name":"自然接触阴影","owner":"U01","visibility":"public","tags":["边桌","卧室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"kind":"snippet","text":"让产品落在自然的接触阴影里","usageCount":7},"databaseRecord":null,"databaseMetadata":null}
{"id":"K03","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K03","name":"低饱和背景","owner":"U01","visibility":"public","tags":["边桌","浴室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"kind":"snippet","text":"使用低饱和背景，避免抢夺产品注意力","usageCount":10},"databaseRecord":null,"databaseMetadata":null}
{"id":"K04","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K04","name":"不遮挡五金","owner":"U01","visibility":"public","tags":["边桌","卧室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"kind":"snippet","text":"所有五金位置保持清晰，不被道具遮挡","usageCount":13},"databaseRecord":null,"databaseMetadata":null}
{"id":"K05","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K05","name":"柔和侧光","owner":"U01","visibility":"public","tags":["边桌","浴室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"kind":"snippet","text":"从侧面引入柔和自然光","usageCount":16},"databaseRecord":null,"databaseMetadata":null}
{"id":"K06","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K06","name":"减少装饰","owner":"U02","visibility":"pending","tags":["边桌","卧室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"kind":"snippet","text":"减少无关装饰，让家具成为画面主角","usageCount":19},"databaseRecord":null,"databaseMetadata":null}
{"id":"K07","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K07","name":"保留木纹","owner":"U01","visibility":"private","tags":["边桌","浴室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"kind":"snippet","text":"保留原始木纹方向与纹理比例","usageCount":22},"databaseRecord":null,"databaseMetadata":null}
{"id":"K08","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K08","name":"保持层板数量","owner":"U01","visibility":"public","tags":["边桌","卧室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"kind":"snippet","text":"层板数量与间距以原始实拍为准","usageCount":25},"databaseRecord":null,"databaseMetadata":null}
{"id":"K09","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K09","name":"浅景深","owner":"U01","visibility":"public","tags":["边桌","浴室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"kind":"snippet","text":"背景适度虚化，产品保持完整清晰","usageCount":28},"databaseRecord":null,"databaseMetadata":null}
{"id":"K10","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K10","name":"留足呼吸空间","owner":"U01","visibility":"public","tags":["边桌","卧室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"kind":"snippet","text":"产品四周保留适量留白","usageCount":31},"databaseRecord":null,"databaseMetadata":null}
{"id":"K11","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K11","name":"端正垂直线","owner":"U01","visibility":"public","tags":["边桌","浴室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-11T08:00:00.000Z","stats":{"used":88,"liked":34},"kind":"snippet","text":"保持建筑与家具的垂直线端正","usageCount":34},"databaseRecord":null,"databaseMetadata":null}
{"id":"K12","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"K12","name":"尺寸比例准确","owner":"U01","visibility":"public","tags":["边桌","卧室","自然"],"categoryIds":["C01","C02","C03"],"createdAt":"2026-10-12T08:00:00.000Z","stats":{"used":95,"liked":37},"kind":"snippet","text":"保留原始宽深高比例，不拉伸结构","usageCount":37},"databaseRecord":null,"databaseMetadata":null}
```

### recipes

```jsonl
{"id":"E01","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E01","name":"历史配方 1","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C01"],"createdAt":"2026-10-01T08:00:00.000Z","stats":{"used":18,"liked":4},"sku":"BT-1001","categoryId":"C01","templateId":"S01","propIds":["P01","P02","P03"],"variables":{"lighting":"soft morning window light","camera":"eye-level three-quarter view, 50mm","palette":"warm ivory and natural oak"},"refIds":["R01"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a quiet bedroom. Product: 栖木 · 边桌; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: ceramic coffee mug (圆柱, 奶油白, 陶瓷, 小); linen covered book (长方体, 米灰, 纸张与布面, 小); olive branch in stoneware vase (椭圆, 苔绿, 石器与植物, 中). Lighting: soft morning window light. Camera: eye-level three-quarter view, 50mm. Palette: warm ivory and natural oak.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O1S1, O1S2, O1S3, O1S4, O1S5.\nEnvironment references only: R01.","combinationKey":"{\"templateId\":\"S01\",\"propIds\":[\"P01\",\"P02\",\"P03\"],\"variables\":{\"camera\":\"eye-level three-quarter view, 50mm\",\"lighting\":\"soft morning window light\",\"palette\":\"warm ivory and natural oak\"},\"refIds\":[\"R01\"]}","originalPhotoIds":["O1S1","O1S2","O1S3","O1S4","O1S5"],"imageId":"history-0","image":"/design-preview/r3-01.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O1S1","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O1S2","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O1S3","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O1S4","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O1S5","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"R01","image":"/design-preview/r3-03.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E02","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E02","name":"历史配方 2","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C01"],"createdAt":"2026-10-02T08:00:00.000Z","stats":{"used":25,"liked":7},"sku":"BT-1004","categoryId":"C01","templateId":"S02","propIds":["P08","P10","P13"],"variables":{"lighting":"warm afternoon side light","camera":"front view, 70mm, straight verticals","palette":"soft grey with muted green accents"},"refIds":["R02"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a natural living space. Product: 栖木 · 边桌; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: oval wooden tray (椭圆, 胡桃棕, 木材, 小); small potted fern (自然叶形, 绿色, 植物与陶土, 小); unscented pillar candle (圆柱, 象牙白, 植物蜡, 小). Lighting: warm afternoon side light. Camera: front view, 70mm, straight verticals. Palette: soft grey with muted green accents.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O4S1, O4S2, O4S3, O4S4, O4S5.\nEnvironment references only: R02.","combinationKey":"{\"templateId\":\"S02\",\"propIds\":[\"P08\",\"P10\",\"P13\"],\"variables\":{\"camera\":\"front view, 70mm, straight verticals\",\"lighting\":\"warm afternoon side light\",\"palette\":\"soft grey with muted green accents\"},\"refIds\":[\"R02\"]}","originalPhotoIds":["O4S1","O4S2","O4S3","O4S4","O4S5"],"imageId":"history-1","image":"/design-preview/r3-02.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O4S1","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O4S2","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O4S3","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O4S4","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O4S5","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"R02","image":"/design-preview/r3-05.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E03","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E03","name":"历史配方 3","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C02"],"createdAt":"2026-10-03T08:00:00.000Z","stats":{"used":32,"liked":10},"sku":"WC-1008","categoryId":"C02","templateId":"S03","propIds":["P04","P06","P12"],"variables":{"lighting":"overcast diffused daylight","camera":"slightly elevated view, 50mm","palette":"sand beige and walnut brown"},"refIds":["R03"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a calm bathroom. Product: 序间 · 马桶架; 材质: 金属方管与木层板; 层板数: 三层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 哑光黑色金属; dimensions: 64 × 26 × 168 cm. Styling props: folded cotton towel (折叠方形, 暖白, 棉, 小); woven rattan storage basket (圆筒, 原木, 藤编, 中); clear glass bath salt jar (圆柱, 透明, 玻璃, 小). Lighting: overcast diffused daylight. Camera: slightly elevated view, 50mm. Palette: sand beige and walnut brown.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 金属方管与木层板; 层板数: 三层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 哑光黑色金属.\nOriginal identity references: O8S1, O8S2, O8S3, O8S4, O8S5.\nEnvironment references only: R03.","combinationKey":"{\"templateId\":\"S03\",\"propIds\":[\"P04\",\"P06\",\"P12\"],\"variables\":{\"camera\":\"slightly elevated view, 50mm\",\"lighting\":\"overcast diffused daylight\",\"palette\":\"sand beige and walnut brown\"},\"refIds\":[\"R03\"]}","originalPhotoIds":["O8S1","O8S2","O8S3","O8S4","O8S5"],"imageId":"history-2","image":"/design-preview/r3-03.webp","productSnapshot":{"features":[{"key":"颜色","value":"哑光黑色金属","locked":true},{"key":"材质","value":"金属方管与木层板","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"三层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":64,"depth":26,"height":168,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O8S1","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O8S2","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O8S3","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O8S4","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"O8S5","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"R03","image":"/design-preview/r3-07.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E04","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E04","name":"历史配方 4","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C03"],"createdAt":"2026-10-04T08:00:00.000Z","stats":{"used":39,"liked":13},"sku":"BC-1012","categoryId":"C03","templateId":"S04","propIds":["P05","P07","P15"],"variables":{"lighting":"soft morning window light","camera":"eye-level three-quarter view, 50mm","palette":"warm ivory and natural oak"},"refIds":["R04"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a calm bathroom. Product: 清屿 · 浴室柜; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: amber glass diffuser (圆柱, 琥珀, 玻璃, 小); minimal soap dispenser (圆柱, 哑光白, 陶瓷, 小); natural wooden comb (长条, 浅木, 木材, 小). Lighting: soft morning window light. Camera: eye-level three-quarter view, 50mm. Palette: warm ivory and natural oak.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O12S1, O12S2, O12S3, O12S4, O12S5.\nEnvironment references only: R04.","combinationKey":"{\"templateId\":\"S04\",\"propIds\":[\"P05\",\"P07\",\"P15\"],\"variables\":{\"camera\":\"eye-level three-quarter view, 50mm\",\"lighting\":\"soft morning window light\",\"palette\":\"warm ivory and natural oak\"},\"refIds\":[\"R04\"]}","originalPhotoIds":["O12S1","O12S2","O12S3","O12S4","O12S5"],"imageId":"history-3","image":"/design-preview/r3-04.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O12S1","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O12S2","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O12S3","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"O12S4","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O12S5","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"R04","image":"/design-preview/r3-10.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E05","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E05","name":"历史配方 5","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C01"],"createdAt":"2026-10-05T08:00:00.000Z","stats":{"used":46,"liked":16},"sku":"BT-1001","categoryId":"C01","templateId":"S05","propIds":["P02","P09"],"variables":{"lighting":"warm afternoon side light","camera":"front view, 70mm, straight verticals","palette":"soft grey with muted green accents"},"refIds":["R05"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a quiet bedroom. Product: 栖木 · 边桌; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: linen covered book (长方体, 米灰, 纸张与布面, 小); compact dome table lamp (半球, 沙色, 金属, 中). Lighting: warm afternoon side light. Camera: front view, 70mm, straight verticals. Palette: soft grey with muted green accents.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O1S1, O1S2, O1S3, O1S4, O1S5.\nEnvironment references only: R05.","combinationKey":"{\"templateId\":\"S05\",\"propIds\":[\"P02\",\"P09\"],\"variables\":{\"camera\":\"front view, 70mm, straight verticals\",\"lighting\":\"warm afternoon side light\",\"palette\":\"soft grey with muted green accents\"},\"refIds\":[\"R05\"]}","originalPhotoIds":["O1S1","O1S2","O1S3","O1S4","O1S5"],"imageId":"history-4","image":"/design-preview/r3-05.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O1S1","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O1S2","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O1S3","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O1S4","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O1S5","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"R05","image":"/design-preview/r3-13.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E06","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E06","name":"历史配方 6","owner":"U02","visibility":"private","tags":["历史记录"],"categoryIds":["C01"],"createdAt":"2026-10-06T08:00:00.000Z","stats":{"used":53,"liked":19},"sku":"BT-1004","categoryId":"C01","templateId":"S06","propIds":["P08","P10","P13"],"variables":{"lighting":"overcast diffused daylight","camera":"slightly elevated view, 50mm","palette":"sand beige and walnut brown"},"refIds":["R06"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a natural living space. Product: 栖木 · 边桌; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: oval wooden tray (椭圆, 胡桃棕, 木材, 小); small potted fern (自然叶形, 绿色, 植物与陶土, 小); unscented pillar candle (圆柱, 象牙白, 植物蜡, 小). Lighting: overcast diffused daylight. Camera: slightly elevated view, 50mm. Palette: sand beige and walnut brown.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O4S1, O4S2, O4S3, O4S4, O4S5.\nEnvironment references only: R06.","combinationKey":"{\"templateId\":\"S06\",\"propIds\":[\"P08\",\"P10\",\"P13\"],\"variables\":{\"camera\":\"slightly elevated view, 50mm\",\"lighting\":\"overcast diffused daylight\",\"palette\":\"sand beige and walnut brown\"},\"refIds\":[\"R06\"]}","originalPhotoIds":["O4S1","O4S2","O4S3","O4S4","O4S5"],"imageId":"history-5","image":"/design-preview/r3-06.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O4S1","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O4S2","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O4S3","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O4S4","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O4S5","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"R06","image":"/design-preview/r3-15.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E07","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E07","name":"历史配方 7","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C02"],"createdAt":"2026-10-07T08:00:00.000Z","stats":{"used":60,"liked":22},"sku":"WC-1008","categoryId":"C02","templateId":"S07","propIds":["P04","P06","P12"],"variables":{"lighting":"soft morning window light","camera":"eye-level three-quarter view, 50mm","palette":"warm ivory and natural oak"},"refIds":["R07"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a calm bathroom. Product: 序间 · 马桶架; 材质: 金属方管与木层板; 层板数: 三层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 哑光黑色金属; dimensions: 64 × 26 × 168 cm. Styling props: folded cotton towel (折叠方形, 暖白, 棉, 小); woven rattan storage basket (圆筒, 原木, 藤编, 中); clear glass bath salt jar (圆柱, 透明, 玻璃, 小). Lighting: soft morning window light. Camera: eye-level three-quarter view, 50mm. Palette: warm ivory and natural oak.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 金属方管与木层板; 层板数: 三层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 哑光黑色金属.\nOriginal identity references: O8S1, O8S2, O8S3, O8S4, O8S5.\nEnvironment references only: R07.","combinationKey":"{\"templateId\":\"S07\",\"propIds\":[\"P04\",\"P06\",\"P12\"],\"variables\":{\"camera\":\"eye-level three-quarter view, 50mm\",\"lighting\":\"soft morning window light\",\"palette\":\"warm ivory and natural oak\"},\"refIds\":[\"R07\"]}","originalPhotoIds":["O8S1","O8S2","O8S3","O8S4","O8S5"],"imageId":"history-6","image":"/design-preview/r3-07.webp","productSnapshot":{"features":[{"key":"颜色","value":"哑光黑色金属","locked":true},{"key":"材质","value":"金属方管与木层板","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"三层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":64,"depth":26,"height":168,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O8S1","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O8S2","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O8S3","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O8S4","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"O8S5","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"R07","image":"/design-preview/r3-17.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E08","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E08","name":"历史配方 8","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C03"],"createdAt":"2026-10-08T08:00:00.000Z","stats":{"used":67,"liked":25},"sku":"BC-1012","categoryId":"C03","templateId":"S08","propIds":["P05","P07","P15"],"variables":{"lighting":"warm afternoon side light","camera":"front view, 70mm, straight verticals","palette":"soft grey with muted green accents"},"refIds":["R08"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a calm bathroom. Product: 清屿 · 浴室柜; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: amber glass diffuser (圆柱, 琥珀, 玻璃, 小); minimal soap dispenser (圆柱, 哑光白, 陶瓷, 小); natural wooden comb (长条, 浅木, 木材, 小). Lighting: warm afternoon side light. Camera: front view, 70mm, straight verticals. Palette: soft grey with muted green accents.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O12S1, O12S2, O12S3, O12S4, O12S5.\nEnvironment references only: R08.","combinationKey":"{\"templateId\":\"S08\",\"propIds\":[\"P05\",\"P07\",\"P15\"],\"variables\":{\"camera\":\"front view, 70mm, straight verticals\",\"lighting\":\"warm afternoon side light\",\"palette\":\"soft grey with muted green accents\"},\"refIds\":[\"R08\"]}","originalPhotoIds":["O12S1","O12S2","O12S3","O12S4","O12S5"],"imageId":"history-7","image":"/design-preview/r3-08.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O12S1","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O12S2","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O12S3","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"O12S4","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O12S5","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"R08","image":"/design-preview/r3-18.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E09","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E09","name":"历史配方 9","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C01"],"createdAt":"2026-10-09T08:00:00.000Z","stats":{"used":74,"liked":28},"sku":"BT-1001","categoryId":"C01","templateId":"S01","propIds":["P01","P02","P03"],"variables":{"lighting":"overcast diffused daylight","camera":"slightly elevated view, 50mm","palette":"sand beige and walnut brown"},"refIds":["R09"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a quiet bedroom. Product: 栖木 · 边桌; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: ceramic coffee mug (圆柱, 奶油白, 陶瓷, 小); linen covered book (长方体, 米灰, 纸张与布面, 小); olive branch in stoneware vase (椭圆, 苔绿, 石器与植物, 中). Lighting: overcast diffused daylight. Camera: slightly elevated view, 50mm. Palette: sand beige and walnut brown.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O1S1, O1S2, O1S3, O1S4, O1S5.\nEnvironment references only: R09.","combinationKey":"{\"templateId\":\"S01\",\"propIds\":[\"P01\",\"P02\",\"P03\"],\"variables\":{\"camera\":\"slightly elevated view, 50mm\",\"lighting\":\"overcast diffused daylight\",\"palette\":\"sand beige and walnut brown\"},\"refIds\":[\"R09\"]}","originalPhotoIds":["O1S1","O1S2","O1S3","O1S4","O1S5"],"imageId":"history-8","image":"/design-preview/r3-09.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a quiet bedroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O1S1","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O1S2","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O1S3","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O1S4","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O1S5","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"R09","image":"/design-preview/r3-19.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E10","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E10","name":"历史配方 10","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C01"],"createdAt":"2026-10-10T08:00:00.000Z","stats":{"used":81,"liked":31},"sku":"BT-1004","categoryId":"C01","templateId":"S02","propIds":["P08","P10","P13"],"variables":{"lighting":"soft morning window light","camera":"eye-level three-quarter view, 50mm","palette":"warm ivory and natural oak"},"refIds":["R10"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a natural living space. Product: 栖木 · 边桌; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: oval wooden tray (椭圆, 胡桃棕, 木材, 小); small potted fern (自然叶形, 绿色, 植物与陶土, 小); unscented pillar candle (圆柱, 象牙白, 植物蜡, 小). Lighting: soft morning window light. Camera: eye-level three-quarter view, 50mm. Palette: warm ivory and natural oak.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O4S1, O4S2, O4S3, O4S4, O4S5.\nEnvironment references only: R10.","combinationKey":"{\"templateId\":\"S02\",\"propIds\":[\"P08\",\"P10\",\"P13\"],\"variables\":{\"camera\":\"eye-level three-quarter view, 50mm\",\"lighting\":\"soft morning window light\",\"palette\":\"warm ivory and natural oak\"},\"refIds\":[\"R10\"]}","originalPhotoIds":["O4S1","O4S2","O4S3","O4S4","O4S5"],"imageId":"history-9","image":"/design-preview/r3-10.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a natural living space. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O4S1","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O4S2","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O4S3","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O4S4","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O4S5","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"R10","image":"/design-preview/r3-20.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E11","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E11","name":"历史配方 11","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C02"],"createdAt":"2026-10-11T08:00:00.000Z","stats":{"used":88,"liked":34},"sku":"WC-1008","categoryId":"C02","templateId":"S03","propIds":["P04","P06","P12"],"variables":{"lighting":"warm afternoon side light","camera":"front view, 70mm, straight verticals","palette":"soft grey with muted green accents"},"refIds":["R11"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a calm bathroom. Product: 序间 · 马桶架; 材质: 金属方管与木层板; 层板数: 三层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 哑光黑色金属; dimensions: 64 × 26 × 168 cm. Styling props: folded cotton towel (折叠方形, 暖白, 棉, 小); woven rattan storage basket (圆筒, 原木, 藤编, 中); clear glass bath salt jar (圆柱, 透明, 玻璃, 小). Lighting: warm afternoon side light. Camera: front view, 70mm, straight verticals. Palette: soft grey with muted green accents.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 金属方管与木层板; 层板数: 三层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 哑光黑色金属.\nOriginal identity references: O8S1, O8S2, O8S3, O8S4, O8S5.\nEnvironment references only: R11.","combinationKey":"{\"templateId\":\"S03\",\"propIds\":[\"P04\",\"P06\",\"P12\"],\"variables\":{\"camera\":\"front view, 70mm, straight verticals\",\"lighting\":\"warm afternoon side light\",\"palette\":\"soft grey with muted green accents\"},\"refIds\":[\"R11\"]}","originalPhotoIds":["O8S1","O8S2","O8S3","O8S4","O8S5"],"imageId":"history-10","image":"/design-preview/r3-11.webp","productSnapshot":{"features":[{"key":"颜色","value":"哑光黑色金属","locked":true},{"key":"材质","value":"金属方管与木层板","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"三层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":64,"depth":26,"height":168,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O8S1","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"O8S2","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O8S3","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O8S4","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"O8S5","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"R11","image":"/design-preview/r3-26.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
{"id":"E12","origin":"Codex 生成的示例","position":"仅种子，未导入数据库","seedRecord":{"id":"E12","name":"历史配方 12","owner":"U01","visibility":"private","tags":["历史记录"],"categoryIds":["C03"],"createdAt":"2026-10-12T08:00:00.000Z","stats":{"used":95,"liked":37},"sku":"BC-1012","categoryId":"C03","templateId":"S04","propIds":["P05","P07","P15"],"variables":{"lighting":"overcast diffused daylight","camera":"slightly elevated view, 50mm","palette":"sand beige and walnut brown"},"refIds":["R12"],"model":"image-banana","finalPrompt":"Create a realistic furniture photograph in a calm bathroom. Product: 清屿 · 浴室柜; 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色; dimensions: 48 × 38 × 56 cm. Styling props: amber glass diffuser (圆柱, 琥珀, 玻璃, 小); minimal soap dispenser (圆柱, 哑光白, 陶瓷, 小); natural wooden comb (长条, 浅木, 木材, 小). Lighting: overcast diffused daylight. Camera: slightly elevated view, 50mm. Palette: sand beige and walnut brown.\nKeep the product geometry, component counts, materials and hardware consistent with the original product photographs.\nProps support the scene and must not cover the product silhouette or alter its proportions.\nLocked product features: 材质: 木纹饰面与细腻哑光表面; 层板数: 两层; 腿型: 四支直腿，保留原始位置和截面; 五金: 隐藏式连接，位置以原始实拍为准; 颜色: 暖白与原木色.\nOriginal identity references: O12S1, O12S2, O12S3, O12S4, O12S5.\nEnvironment references only: R12.","combinationKey":"{\"templateId\":\"S04\",\"propIds\":[\"P05\",\"P07\",\"P15\"],\"variables\":{\"camera\":\"slightly elevated view, 50mm\",\"lighting\":\"overcast diffused daylight\",\"palette\":\"sand beige and walnut brown\"},\"refIds\":[\"R12\"]}","originalPhotoIds":["O12S1","O12S2","O12S3","O12S4","O12S5"],"imageId":"history-11","image":"/design-preview/r3-12.webp","productSnapshot":{"features":[{"key":"颜色","value":"暖白与原木色","locked":true},{"key":"材质","value":"木纹饰面与细腻哑光表面","locked":true},{"key":"腿型","value":"四支直腿，保留原始位置和截面","locked":true},{"key":"层板数","value":"两层","locked":true},{"key":"五金","value":"隐藏式连接，位置以原始实拍为准","locked":true}],"dimensions":{"width":48,"depth":38,"height":56,"unit":"cm"}},"templateSnapshot":{"skeleton":"Create a realistic furniture photograph in a calm bathroom. Product: {product}. Styling props: {props}. Lighting: {lighting}. Camera: {camera}. Palette: {palette}.","fixed":["Keep the product geometry, component counts, materials and hardware consistent with the original product photographs.","Props support the scene and must not cover the product silhouette or alter its proportions."]},"referenceInputs":[{"id":"O12S1","image":"/design-preview/r3-07.webp","kind":"original"},{"id":"O12S2","image":"/design-preview/r3-14.webp","kind":"original"},{"id":"O12S3","image":"/design-preview/r3-09.webp","kind":"original"},{"id":"O12S4","image":"/design-preview/r3-25.webp","kind":"original"},{"id":"O12S5","image":"/design-preview/r3-28.webp","kind":"original"},{"id":"R12","image":"/design-preview/r3-28.webp","kind":"style"}]},"databaseRecord":null,"databaseMetadata":null}
```

相关表、调用链、文字/数字/图标风险和四层结构改造影响，见[Task 11-B只读盘点](task-11b-preparation.md)。此前80/67项测试的历史口径保持不变：少运行15项、增加2项日志测试；本次盘点没有重新执行这些业务测试。

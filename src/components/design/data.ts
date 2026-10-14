// 独立设计样例，人员、SKU、费用和状态均为假数据。
export const projects = [
  { sku: "SF-2401", name: "云屿 · 三人布艺沙发", image: "sofa", category: "客厅家具", done: 2, total: 7, person: "林悦", time: "12 分钟前", initials: "悦", tone: "sage" },
  { sku: "LV-2406", name: "栖木 · 现代客厅组合", image: "living", category: "客厅家具", done: 5, total: 7, person: "陈一", time: "38 分钟前", initials: "一", tone: "sand" },
  { sku: "CH-2403", name: "弧线 · 休闲单椅", image: "chair", category: "座椅", done: 7, total: 7, person: "许宁", time: "今天 10:24", initials: "宁", tone: "rose" },
  { sku: "RM-2408", name: "暖境 · 家居空间系列", image: "room", category: "空间陈列", done: 2, total: 7, person: "林悦", time: "今天 09:42", initials: "悦", tone: "sage" },
  { sku: "IN-2412", name: "留白 · 软装陈列组合", image: "interior", category: "软装家具", done: 7, total: 7, person: "陈一", time: "昨天 17:30", initials: "一", tone: "sand" },
  { sku: "DN-2402", name: "共席 · 餐厅家具组合", image: "dining", category: "餐厅家具", done: 4, total: 7, person: "许宁", time: "昨天 15:16", initials: "宁", tone: "rose" },
];
export const slots = [
  { name: "产品主图", goal: "让产品轮廓一眼清晰", image: "sofa", status: "已选终稿", icon: "image" },
  { name: "客厅场景", goal: "午后光线里的松弛感", image: "sofa", status: "正在调整", icon: "sofa" },
  { name: "空间搭配", goal: "展示温暖自然的客厅氛围", image: "living", status: "待挑选", icon: "sofa" },
  { name: "材质细节", goal: "看清织物纹理与柔软触感", image: "sofa", status: "已选终稿", icon: "scan" },
  { name: "核心卖点", goal: "一图说明舒适与日常打理", image: "", status: "待制作", icon: "sparkles" },
  { name: "尺寸说明", goal: "帮助买家判断空间是否合适", image: "", status: "待制作", icon: "ruler" },
  { name: "安装说明", goal: "清楚呈现组装步骤", image: "", status: "待制作", icon: "layers" },
];
export const profileItems = [
  { label: "品类与结构", value: "三人位布艺沙发 · 三组坐垫 · 木质支脚", status: "已确认", source: "产品实拍、商品参数表" },
  { label: "尺寸", value: "宽 210 × 深 92 × 高 82 cm", status: "已确认", source: "商品参数表" },
  { label: "颜色与材质", value: "苔绿色织物；木质支脚保留原色", status: "已确认", source: "美工确认、产品实拍" },
  { label: "需要保留的细节", value: "坐垫数量、扶手弧度和支脚位置不可改变", status: "已确认", source: "美工确认" },
  { label: "适用空间", value: "自然风格客厅、休闲阅读空间", status: "推测", source: "根据外观推测，等待核对" },
  { label: "洗护方式", value: "请补充面料洗护说明", status: "缺失", source: "现有资料未提供" },
];
export const users = [
  { name: "林悦", email: "linyue@example.com", role: "美工", status: "正常", used: "12.45", quota: "50.00", login: "今天 14:28", tone: "sage" },
  { name: "陈一", email: "chenyi@example.com", role: "美工", status: "正常", used: "8.20", quota: "50.00", login: "今天 13:56", tone: "sand" },
  { name: "许宁", email: "xuning@example.com", role: "模板编辑", status: "正常", used: "6.75", quota: "30.00", login: "今天 11:42", tone: "rose" },
  { name: "周明", email: "zhouming@example.com", role: "管理员", status: "正常", used: "3.10", quota: "100.00", login: "今天 10:08", tone: "sage" },
  { name: "李可", email: "like@example.com", role: "仅查看", status: "正常", used: "0.00", quota: "0.00", login: "昨天 17:20", tone: "sand" },
  { name: "王澄", email: "wangcheng@example.com", role: "美工", status: "已停用", used: "0.00", quota: "50.00", login: "10 月 10 日", tone: "rose" },
];

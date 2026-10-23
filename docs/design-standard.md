# Inkra 设计规范

版本：v0.1 草案。日期：2026-10-20。

## 当前修订：清晰暗色与文档语言

- 2026-10-23 属性扩展：Tree.indent 控制逻辑层级缩进，size 只调整行留白，所有尺寸保留 44px 命中区；内容渲染函数可读节点状态和 level，不取代 textValue。Pagination.simple 使用当前页/总页数摘要，页码及摘要插槽只放非交互内容，保留原生按钮名称与当前页语义。Rating 悬停不修改已提交值；name/form 提交规范化分值，非受控原生 reset 恢复默认值而不触发 onValueChange。Alert 关闭功能默认关闭，受控 open 由调用方更新，关闭后移除焦点入口，不自动抢焦点。Skeleton 默认静态，pulse 仅改变透明度，减少动态效果、强制颜色和打印时停用，不逐帧重绘材质。

- 2026-10-23 交互动效：菜单按弹出方向短距离平移和淡入淡出，弹层关闭继续由原有无障碍引擎管理；减少动态效果必须覆盖打开、关闭及方向选择器。文档 Playground 配置区关闭后立即 inert / aria-hidden，视觉退场后隐藏，快速反向切换取消旧动画。预览尺寸及后续示例位置用有界 transform 过渡，不逐帧改变宽高重绘笔触；首屏、外部容器 resize 和减少动态效果直接呈现最终布局。Tree 仅增强入场和选中反馈，折叠仍立即移除节点，不滞留可聚焦的隐藏行。

- 2026-10-23 Playground 属性配置由工具栏右上角设置图标展开/收起，状态和表单值保持挂载；展开状态以 aria-expanded / aria-controls 关联，Escape 收起后焦点回设置按钮。以 Playground 自身容器宽度判断布局：至少 840px 时预览/属性为 2:1，480–839px 时属性覆盖右侧且不挤压预览，不足 480px 时属性完整覆盖预览/代码且没有左分割线。宽容器初始展开，窄容器初始收起，用户的明确选择不因 resize 重置。覆盖层使用不透明主题纸面与 PencilSurface，遮挡的预览/代码 inert；设置按钮和代码复制同时可用。此条覆盖历史窄屏属性下排及始终显示规则。
- 2026-10-23 视觉验收修正：普通文档 Playground 由预览内容自然撑高，保留 340px 最小高度，禁止通过固定高度和居中溢出裁掉示例。预览切换源码时保留内容占位，隐藏区域不可聚焦；属性栏仍为桌面 1/3、移动端下排。地图、平移缩放、虚拟列表等组件自身可以有明确视口，但只能在自身内部裁切和滚动，不能覆盖属性栏。此规则覆盖历史统一固定预览高度约定。
- 侧栏组件名称单行显示，使用 PencilText 的 ellipsis 保留彩铅省略号和完整名称提示，不缩字号、不换行、不改变图标列。新增组件及文档示例的常规分割线必须用 PencilLine，描边/铺色复用 PencilSurface 或同源 stroke/wash，已有按钮、选择器、滑块、标签、表格必须复用 Inkra 实现。普通 border、SVG dasharray 或 CSS 网格不能充当彩铅材质；强制颜色、打印及绘制失败的可读后备不受此限制。功能脚本、编译、打包通过均不能代替桌面/移动截图与实际交互验收。

- 2026-10-23 通用 Slot 使用 48/64/80px 固定正方形，静态模式保持无角色 div，可操作模式才使用原生 button 与 aria-pressed；Enter/Space 沿用原生行为。内容、空态与 Badge 数量角标不改变几何，逻辑角随 RTL 翻转；renderCount 保留调用方渲染。可操作 Slot 内只放非交互内容，复杂控件使用静态 Slot，避免嵌套 button。Slot 不包含装备、稀有度、排序或拖放合同。
- Hotkey 只格式化快捷键，HotkeyInput 只在自身原生输入聚焦时录入；不注册全局监听，不拦截浏览器快捷键。Escape 取消，未修饰 Delete/Backspace 清除，IME 与纯修饰键不提交；冲突规则由调用方提供。NumberTicker 使用 Intl.NumberFormat，快速更新从当前可见帧接续，SSR/减少动态效果直接显示终值，读屏不播报中间帧。Log 保留调用方顺序和稳定 id，仅在靠近底部且未暂停时跟随追加；滚动区支持 Home/End，但长列表不使用 live region。

- Progress 新增 circular 展示，与 linear 共用规范化 value/max 和 progressbar 语义；剩余进度以缺口表示，0% 无进度弧、100% 闭合。圆环复用彩铅描边与颗粒留白，固定整环纹理通过两端渐细的弧形裁剪更新进度，不随数值重绘；未知进度显示旋转短弧，减少动态效果时静止。内容可为非交互图标、文字或渲染函数，放在 center/top/bottom/start/end，逻辑两侧随 RTL 翻转；长内容优先外置。默认条形保持兼容。SSR、绘制失败、强制颜色及打印使用可读矢量后备，不依赖画布提供语义。

- 独立代码示例统一使用 Card 页头：左侧语言图标与名称，右侧具名复制按钮；正文保留语法高亮和原始可选源码，复制成功/失败均有可访问反馈。已有 Playground 的预览/代码工具栏不再套重复页头。侧栏相邻分组不额外加间距；快速开始的说明段落与代码块同宽。
- 编辑文字同步完成离屏绘制再提交可见帧，输入期间不撤销已就绪笔触，也不等空闲队列。每个编辑器只保留有界私有字符缓存，不跨实例共享或落盘。输入法组合时已提交文字保留笔触，正在组合的文字显示原生样式与下划线；真实输入框继续管理输入法、选区和光标。绘制失败、不支持的复杂文字、强制颜色和打印回退为可读原生文字。

- 文档 API / 无障碍面板不重复显示页签同名标题；有意义的子组件分组标题保留。桌面 Playground 预览与属性栏按 2:1 分配（分割线单独占位），窄屏属性栏下排。Layout 示例提供实际容器尺寸切换，缩放仅用于容纳预览并标注比例，断点始终由真实容器宽度触发，不用伪造堆叠状态。

- 文字选区只绘一层字：已增强 PencilText 的原生选区文字保持透明，选区背景在笔触下；Input/Textarea 的编辑画布位于原生选区上方且不拦截指针。绘制失败、强制颜色和打印继续使用可读原生文字，不通过禁止选中掩盖叠字；输入法组合遵守上面的局部预编辑规则。
- Textarea 设置 maxLength 时默认在达到 80% 后显示右下角剩余长度；支持 fraction、progress、none 与始终显示。长度与原生 maxLength 一致，按 UTF-16 码元计算；提示区预留独立位置，不盖住文字或造成显示时的尺寸跳变。默认关闭原生 resize；显式 vertical 使用手绘手柄，支持拖动、方向键及 Home/End，保留至少 44px 操作区。
- API 文档统一使用 Table/PencilText，并为每个属性提供中英说明；代码块使用共享语法分词与笔触文字，选择和复制仍为原始源码。新增 API 需通过说明覆盖检查，不能只增加类型而不说明用途。

- 2026-10-22 用户保存配置作为新默认：文字笔压 / 断笔 / 轮廓 / 填色 / 颗粒为 0.20 / 0.50 / 0.90 / 0.90 / 0.60；线条粗细 2、起伏 1.5；涂色浓度 0.8、间距 2、起伏 3、角度 -45 度。CSS tokens、渲染器无 token 后备值及主题抽屉恢复默认一致，覆盖下文历史材质默认值。保留状态铺色比例与控件笔宽比例，不重新归一化使新默认失效。线条起伏可调范围为 0–4，各类描边统一消费上限。
- 主题定制的模式选择使用带“主题模式”legend 的 RadioGroup，系统 / 浅色 / 深色分别配显示器 / 太阳 / 月亮图标，等宽撑满面板。Tabs 后的 20px 只由面板 padding 提供；legend 到选项框的 8px 为独立内部间距。文档新访客与恢复默认使用浅色，已有保存偏好不覆盖。

- 主题定制采用草稿与已保存值分离：抽屉内调整仅作用于独立预览 Card，预览与下方 Tabs 用 PencilLine 分隔；保存后才全局应用并持久化。恢复默认只修改草稿，取消、Escape 或关闭均丢弃未保存调整，重新打开载入已保存值。不能在调整时写入全局 tokens 或本机设置。

- 主题定制入口位于 GitHub 左侧，复用 Drawer 的 Header/Body/Footer、关闭按钮与焦点返回；主题、文字、线条、涂色分为带图标 Tabs，参数通过 Slider 调整。stroke-width/amplitude 同时作用于分割线、按钮/卡片等表面描边及图标笔触，保留各组件默认笔宽比例；PencilLine 的显式 weight/roughness 优先。wash strength/spacing/roughness/angle 调节背景涂色，默认保持原材质效果。文字使用独立的 letter tokens。只监听自身与祖先外观，局部主题不能触发整页失效；关闭抽屉引起的滚动锁或 pointer-events 改动在绘制参数不变时不重画。预览卡片不叠加额外纯色 CSS 底层。
- Drawer 的纸纹使用 full 表面铺满，仅在靠页面一侧绘制一道 PencilLine，贴视口的其余三边无描边、留白或圆角；Header 标题与操作区垂直居中，关闭按钮默认 outline。主题抽屉的取消按钮同样默认带描边。内部 Header/Footer 分割线保留，强制颜色模式只对靠页面侧提供系统边线。
- 使用指南的任务列表使用真实 Card、Badge、Checkbox、ToggleGroup、Progress、Empty，不继续用 PencilSurface 和原生 checkbox 仿制；浅深两栏共享状态。主题分区为无外框区域，单条任务使用 Card.Content，避免卡片套卡片或每项强制 Header/Footer。

- 文档分割线下方的 20px 只由一层提供：PageHeading 负责标题分割线后的留白，独立 section-divider 负责自身后的留白。content-section 不再默认添加顶部 padding，首个直接子元素清除顶部 margin；standard-tabs 只保留底部间距，不叠加页头留白。页面不再在 PageHeading 后重复插入分割线。新增文档布局须通过 verify-docs-spacing 浏览器实测，按元素边界验证 20px，分割线画布的 8px 和控件内距单独计算。

- 2026-10-22 目录与示例顺序：侧栏采用“组件 / 用途分类 / 具体组件”三级目录，前两级独立折叠；下一级图标与上一级文字起点对齐，缩进为固定 26px 图标列加 8px 间距，覆盖历史 16px 缩进规则。保留整行选中铺色、搜索和当前路径自动展开。所有组件页以带“预览 / 代码”和属性控制的主 Playground 为第一个示例；后续补充示例再按简单到复杂排序，覆盖此前基础示例放在 Playground 之前的约定。

### 后续规范完善

- Calendar 月份与星期文字使用 PencilText，翻月按钮复用 Button 与 Lucide 几何的 PencilIcon，保留 DayPicker 的原生导航、禁用及本地化名称。首页日期格为正方形且移除重复选中日期输出。JourneyMap.attributionDisplay 默认 inline，可用 popover 把完整来源折叠到具名信息按钮；不能因精简示例删除完整署名。首页不展示额外地点列表，地图未就绪或失败时仍保留组件原有后备列表。

- Breadcrumb 使用原生 nav / ol / li，Link 复用 ButtonLink 的彩铅交互与至少 44px 命中区；Page 为非交互的 aria-current="page" 文本。Separator 默认斜线，可替换装饰内容，对辅助技术隐藏。长路径换行，RTL 服从逻辑方向，不引入额外键盘模式。首页介绍区按用户要求占半屏，组件展示不统一套 Header/Footer。

- Tabs.List.divided 默认关闭；启用后仅在相邻标签之间绘制 PencilLine，横排为竖线、竖排为横线，分割线两侧各留 8px，不改变标签与面板的键盘/ARIA 关联。RTL 使用逻辑方向，禁用标签仍保留分隔。站点顶栏沿用 Tabs 的选中铺色与焦点轮廓，但跨页面导航保持真实链接；顶栏每个标签到相邻分割线的距离同为 8px，品牌右侧分割线与桌面侧栏右边界同轴。
- 文档标题下统一显示短小、轻松且能说明用途的中英介绍和彩铅分割线；页面操作保留复制、Markdown 预览/下载与外部助手入口。外部助手在新标签页打开，复制文档供用户主动粘贴，不把 localhost 链接冒充公开可读取的文档，也不自动传送演示表单的输入内容。侧栏只纵向滚动，保留焦点描边余量、16px 子项缩进及整行选中铺色。

- Overlay 标准弹窗使用 Content.layout="sections"，Header / Body / Footer 为直接子级：Header 默认含右上角 44px 彩铅关闭按钮，Header/Footer 默认以 PencilLine 分隔，四边内距统一 20px。正文独立滚动，头尾操作保持可见；标题长文本换行，关闭按钮不被挤压，底部操作可换行。保留 plain 旧版内距与整体滚动用法；表单放 Body，Footer 提交按钮通过 form/id 关联，保留校验、Escape、嵌套浮层和焦点返回。closeLabel 支持本地化，showClose/divided 可显式关闭，强制颜色模式使用系统分隔线。

- InputNumber 使用同一输入纸面内的“减号 / 居中数字 / 加号”布局，前后操作复用 Input 的 startAction/endAction 及 selection 交互材质；RTL 跟随逻辑方向。没有独立清空按钮，键盘删除仍可产生 null；保留原生步进、边界禁用、表单重置和明确的操作名称。

- Select 默认下拉箭头的画布 sm/md/lg 统一为 24/28/32px，单选、多选与搜索选择保持一致；预留槽同步尺寸，避免画布留白和容器二次缩小导致箭头过小。保留彩铅笔迹、控件高度、至少 44px 命中区及自定义图标行为。

- 侧栏底部语言选择与主题分段控件的外框统一 52px 高：主题选项保留 44px 命中高度及上下各 4px 内距，语言 Select 仅在 sidebar-preferences 内匹配该高度。桌面侧栏与移动抽屉共用此规则，不修改普通 Select 的 md 默认 44px。

- Select.Trigger 的 startIcon/endIcon 与选中值、箭头共用彩铅外框及点击区域，逻辑方向跟随 RTL；hideValue 只视觉隐藏选中值并以描述保留读屏语义，hideIndicator 不留空箭头槽。iconOnly 优先显示 startIcon，再 endIcon，再自定义或默认箭头，隐藏文字且保持至少 44px 方形命中区；提供 Field/aria-label 与 Tooltip。fullWidth=false 按内容宽度，iconOnly 不被撑宽；图标触发器的弹层仍保留可读最小宽度。此批属性适用于单选/多选的复合 Select.Trigger，不隐式改变 Searchable 的输入式触发器。侧栏语言图标使用同一 startIcon 插槽。

- 侧栏分组内的导航项相对分组标题统一缩进 16px，保持子项图标与文字各自对齐；只增加内容起始侧 padding，不缩小整行点击与选中铺色范围。所有组件的 playground 在桌面上预览与属性区域五五分，视口不超过 1024px 时属性改为预览下方布局。不显示重复的“属性”标题，但保留区域的可访问名称；按各组件实际参数使用基础、内容、布局、交互、状态等分类，复用带笔迹图标的 PropertyTabs。桌面分类保持可见，参数面板内部滚动，切换分类保留参数值。Tabs 的键盘焦点使用独立 PencilSurface 彩铅轮廓，不替代选中铺色；强制颜色模式保留系统实线焦点。

- 文档标题与页面级示例/API/无障碍页签使用同一套彩铅图标；有文字时图标只作装饰。侧栏各项固定 26px 图标列与 8px 间距，文字统一起始侧对齐，选中铺色覆盖整行，覆盖历史仅包文字规则。图标目录的搜索和带图标分类固定在列表之外，图标网格在最多 416px、且不超过视口 55% 的区域独立滚动；切换分类和查询回到列表顶部，窄屏分类只在自身横向滚动。

- 组合图标通过 PencilIcon.badge 在同一画布叠加一个角标，复用原彩铅笔触。重叠处只擦除主体墨迹，透出实际父级纸面，不绘不透明圆底。逻辑四角位置跟随 RTL，图形本身不镜像；角标比例限定 0.35–0.65，保持画布和命中区域不变。组合整体只有一个可访问名称，不能把主体和角标分别作为可操作控件。
- 2026-10-21 后续反馈：Button 的 action/quiet/danger/badge 铺色与 Tabs 共用 -35 度、spacing 1.8、roughness 3.5 的笔触几何，分别保留语义颜料、前景和浅深强度，不把所有按钮染成选中态。Button 与 Slider 的普通键盘焦点用 PencilSurface 轮廓，强制颜色模式才用系统实线焦点。
- Input 的 outline/soft 尾部操作铺满整个操作区，按尾部轮廓裁切，外框和分割线绘在上层；只有 underline/ghost 内缩 4px。不能为了避免盖线而让描边模式也留出一圈空白。
- Slider 提供 standard 细轨道和 inset 宽滑槽。inset 的视觉滑块在横纵向、RTL 和两端都完整包在滑槽里，命中区域仍至少 44px；范围选择、方向键和原生表单行为由成熟原语承载。InputNumber 复用 Input 默认下划线，使用原生数字解析、范围校验和小数步进，空值为 null，不把超范围输入静默截断。
- Icon 独立文档页展示现有 PencilIcon，不增加重复绘制实现；尺寸、源坐标、笔迹种子、颜色与装饰语义必须对应真实 API。颜色来自 CSS，改变自身或祖先 class/style 后需使画布颜色失效重绘；同一颜色和几何不重复生成纹理。
- Select 多选使用数组值，连续勾选不收起，可取消单项及整体清空，提交以相同字段名传多个值。多选列表复用成熟引擎，保留单选接口；清空按钮不嵌入 Trigger 按钮内。
- 文档属性栏的高度跟随所在预览行，不固定为 340px；地图/日历等 700px 展示区的属性栏同高、超出内部滚动。窄屏属性栏自然下排，无固定高度。预览与代码切换仍保持左侧展示区高度稳定。

- 最新 Input 外观约定：默认 underline，只在底部绘制 PencilLine，不画闭合外框；outline 保留为显式可选。错误与焦点通过下划线的颜料与笔触强调，不能自动变回矩形描边。尾部操作的 hover/pressed 铺色复用 Tabs 的 selection 材质、斜向笔触和配对前景，不再使用独立 quiet 圆框。铺色限制在操作内部并置于边线之下；outline 的分割线与共享边框相接，underline 的竖分割线内缩且不覆盖底线。

- Input 首尾图标使用 startIcon/endIcon 的逻辑方向，图标画布 sm/md/lg 为 18/22/26px，清空与加载画布为 30px；点击目标仍至少 44px。prefix/suffix 不进入表单值，必要单位通过 Field 描述关联。endAction 使用同一个输入外框，其起始侧只画一道 PencilLine 分割线，不套第二个按钮外框；文档例子使用 ghost 操作，RTL 自动换侧。极窄且插槽过多时在共享外框内重排，不遮住输入或操作。
- Input.clearable 显式启用后预留清空位置，空值、只读、禁用或 IME 组合输入时不可操作。受控清空通过 onValueChange('', {reason: 'clear'}) 与 onClear 通知调用方更新；原生 onChange 不伪造事件。非受控清空与表单 reset 同步真实输入及笔触文字，清空后焦点回输入；Escape 留给搜索建议或浮层。loading 不禁止输入，显式 false 保留加载槽位，省略则不占位。文档页头搜索实际使用同一清空与值变化接口。
- 新增组件属性需同步 API、可交互示例、跟随状态的源码与边界验证。Input 展示图标、前后缀、清空、表单重置、加载、尾部操作、外观及状态；Textarea 的 maxLength 沿用原生 UTF-16 码元限制，不声称为字素计数。只补齐本批已实现能力，不将密码切换、InputGroup、NumberInput 或自动补全列为已交付。

- 文档页级间距统一使用 space-5 / 20px：正文外层四边、标题区底部、页面 Tabs 到分割线、分割线到内容、相邻示例之间均使用此档。标题下方不再使用 32px，设计规范页不另用 12px，Button 示例列表不另用 36px。同一段空白只归属一个 padding、margin 或 gap；分割线画布的 8px 为绘制盒，不额外叠加父级 gap。本条只统一文档页级节奏，不把输入框内部或卡片内部所有间距强行改成 20px。

- 文档页头搜索使用 Inkra Input 的 search 类型与 startIcon 插槽，边框、焦点、占位及输入文字笔触全部由组件提供；外层 form 只负责定位建议列表，不重复绘制边框或覆盖输入内距。保留 combobox、方向键、Enter 与 Escape 行为。

- Button / ButtonLink 的 fullWidth 撑满容器，align 使用逻辑 start/center/end；纯图标保留固定方形，不受 fullWidth 和 align 拉伸。loadingPosition 默认 center，start/end 在空闲时也保留固定图标槽，加载时保留正文、仅替换该侧图标；loadingIndicator 只接收非交互装饰内容。ButtonGroup 可统一 size/variant，子项可覆盖；组 disabled 不允许子项解除，链接同时移除 href 和 Tab 入口。equalWidth 横向按等宽列排列，窄屏局部滚动，不压缩文字；仍只有一个共享彩铅外框与相邻分割线。

- 2026-10-21 用户纠正：旅行组件以原旅游网站源码为设计基线，不再把通用日期选择器、横条概览加列表、虚构多边形线框图作为默认设计。Calendar 默认 itinerary 七列留缝日格，日期/事件独立入口，窄容器保持七列并隐藏事件文字；44px 固定日期宽度仅适用于 picker。DayAgenda 使用原 scheduleCardScale 分段纵轴和重叠分列，时点与区间共同分列避免遮盖；JourneyMap 迁移原海洋笔触、地表分类、手绘站点与比例尺/北向标记，focusSelectedPlace 使用总览绝对 10 倍聚焦并尊重减弱动画。详情、来源、兼容差异和未迁移功能见 `travel-component-port.md`，本条覆盖下方旧版“24小时固定比例/横条概览/仅平移”描述。

- Card 的 outline 复用彩铅描边，不额外铺色；Header/Content/Footer.padding 可继承 Root.size 或覆盖为 none/sm/md/lg，不叠加同侧间距。Header.align 控制头部内容与操作的垂直对齐；Footer.orientation=vertical 时子项撑满，justify 始终作用于主轴。卡片仍为非交互容器。
- Table.layout 使用原生 auto/fixed 列布局；Head/Cell.verticalAlign 控制垂直对齐，wrap 控制换行。固定列宽不允许文字遮盖相邻单元格，保留完整内容和原生表格语义。

- Calendar.eventIndicator 支持 count/dot/none，隐藏视觉标记不能删除事件的可访问名称；周数列不挤压 44px 日期命中区域。DayAgenda 的 compact 仅减少内距，保留字号与 44px 命中高度；h12 按 locale 格式化，跨日仍标 +1；disabled 使用原生禁用事件按钮。
- JourneyMap.interactive 仅控制视口手势，不禁用地点选择或显式工具按钮；滚轮缩放默认关闭。调整交互、工具栏和列表属性不重建地图或复位视角；showPlaceList=false 仅在地图就绪后隐藏列表，加载与故障时恢复。focusSelectedPlace 默认关闭，启用后仅平移到所选地点。

- 内容组件属性保持既有默认样式：Card/Alert 的 sm/md/lg 内距为 12/16/24px，字体不跟随变小。Card 分割线由 Root.divided 统一提供，Header/Footer 可单独覆盖；Header.action 保留独立原生操作，窄屏换行；Content.padding=none 供自带间距内容使用，不叠加同侧间距。Footer.justify 使用逻辑方向。
- Alert.appearance 区分 soft 铺色和 outline 描边，actions 放在正文之后，不能把整个通知当按钮。Avatar 圆角对齐图片与彩铅外框并限制在 0–8px，bordered 与 Image.fit 不改变固定尺寸和可访问名称。Table 的 striped/hoverable 只提供阅读反馈，不暗示行可点击；stickyHeader 在受限滚动容器内生效，Head/Cell.align 支持逻辑方向，保留原生表格语义。

- 旅行场景提炼为 Calendar、DayAgenda、JourneyMap，不复制私人行程、订单或照片。Calendar 使用成熟日历原语承载单日/多日/范围、月份与键盘导航；事件名称必须进入可访问名称，日期命中区域至少 44px，窄屏局部滚动。
- DayAgenda 接收当地日期及相对午夜的分钟数，不推断时区或未知时长。24 小时概览按真实比例绘制，每个事件独立轨道；跨日裁切并标续接，时点事件不伪造时长，有序事件列表保留完整文字和键盘入口。它是通用日程列表，不宣称已迁移旅行站航班跨时区计算。
- JourneyMap 复用 Leaflet 投影和拖动，以彩铅线绘制输入地理轮廓与线路；地图不可用时保留地点按钮列表。坐标与路线数据由调用方提供，必须显示署名或示意说明，不内置定位权限、公共瓦片请求、路径规划或车程推断。隐藏转可见时重新校验尺寸，纹理不能决定布局。

- 图标设计以熟悉的 Lucide 轮廓为基础，保留彩铅笔压、颗粒、露纸与轻微断笔；同一含义保持同一图形，不混用实心与线性图标，不用随机抖动表达手绘。文档排版页展示 12 个常用图标、用途、浅深色与 14/16/20/24px 画布占位。
- 图标选中铺色与焦点归属外层控件，不能仅换色表达状态。有文字时图标为装饰；纯图标按钮提供 aria-label 与提示；独立传意的 PencilIcon 显式 decorative=false 并提供名称。重要含义保留 DOM 文字。sourceSize 是源坐标范围，size 是包含留白的画布盒，不等于 glyph 可见宽度或至少 44px 的命中区域。

- DropdownMenu 复用成熟菜单原语，支持普通项、复选项、单选组、禁用与危险操作；保持方向键导航、Escape 和触发器焦点返回，浮层继承主题。菜单用于操作，Select 用于表单选值；当前不包含子菜单。
- Alert 使用状态颜料与浅深配对纸面，默认温和通知；仅紧急动态反馈显式使用 role="alert"。Avatar 保持固定尺寸，图片失败回退内容，图像和回退均须有适当名称。
- Card 的 header/content/footer 各自管理内部间距，以彩铅线分隔；标题级别按页面层级选择，不将普通页面区段包成卡片。Table 保留原生 table、caption、scope，窄屏只在具名容器内横向滚动；selected 仅表示视觉强调，不冒充交互式 grid，不隐含排序筛选能力。

- 组件属性扩展保持默认外观兼容：Tabs 支持 sm/md/lg（命中区域不小于 44px）、对齐、等宽铺满、首尾图标和动画开关；Badge 支持尺寸和首尾图标；Progress 支持 12/16/24px 轨道；Skeleton 圆角范围 0–8px，Separator 笔触范围 0.3–2。桌面 playground 属性过多时在右侧 340px 区域独立滚动，窄屏自然下排，不改变预览/代码切换高度。

- Tabs 统一使用 Root / List / Trigger / Content，选中态复用 segmented 的斜向逐笔绘入和反向擦除；首帧、减少动态效果与强制颜色不播放动画。面板保持明确关联，forceMount 保留状态但隐藏未选内容；支持横纵向、RTL、自动和手动激活。设计规范分类与组件文档视图已使用该组件。
- Tooltip 只承载非交互补充信息，沿用浮层主题桥接、彩铅纸面和边界；不能替代必需信息或控件名称。Accordion 负责可折叠内容，用语义标题、彩铅分割线和受减少动态效果约束的展开动画。
- Badge 使用语义文字与配对颜料；Separator 使用 PencilLine。Skeleton 静态露纸占位，对辅助技术隐藏。Progress 的颜料画布尺寸固定，只改变裁切进度；未知进度不伪造百分比，减少动态效果时保持静态。

- segmented 退场以 320ms 反向逐笔擦去，与 480ms 逐笔绘入配对，不再只做透明度淡出。快速反复切换从当前可见笔触进度反向继续，未选中语义立即更新，装饰退场不拦截输入；减少动态效果、强制颜色和尺寸变化立即结束到目标状态。

- 最新覆盖：文档站与配色示例的选中颜料对齐主题背景颜料，不再使用浅一阶色值；selection 的浅/深铺色强度与 action 一致，为 .20/.12，方向仍为 -35 度。segmented 切换采用 480ms、八段来回交替的斜向笔触揭示，复用静态纹理，图标立即显示；初次展示不播放，快速切换取消旧动画，尺寸变化、减少动态效果及强制颜色直接显示最终状态。其他选中用途不自动增加绘制动画。

- 选中材质统一使用 -35 度斜向彩铅笔触，与色阶样片方向一致。只旋转笔触坐标，不旋转控件、图标、文字或命中区域；按原控件边界约束笔触，保留露纸颗粒、浅深色强度和 180ms 选中过渡。此规则覆盖历史横向选中铺色。

- 侧栏主题切换使用 28px 彩铅图标画布（Lucide 几何有内留白），44px 命中高度与三等分布局不变。色彩规范的浅深色配对均展示真实 segmented 选中态，选中铺色与前景随预览配色成对变化；两侧预览同步切换，但不修改站点主题。

- 文档页头只保留品牌图标与 Inkra 字标，不重复“组件文档”副标题。当前图标为简洁的斜向铅笔外轮廓与底部一小段自然笔迹，内部留白，不加铺色或笔杆细节。复用 PencilIcon 的稳定笔触与主题前景，固定 32px 图形盒；图标为装饰层，链接名称由真实字标提供。移动抽屉使用同一图形，不独立绘制另一套标志。
- 补充示例卡片 header 用 flex 居中标题，标题 margin 清零；下分割线绝对定位在 header 底边，不额外占据行高，避免标题上下空间失衡。

- docs-layout 和 header-inner 占满窗口宽度，不设 80rem 限宽或居中 margin。页头左右内边距为 20px，与侧栏内容左边缘对齐。侧栏底部设置区与导航一致，四边保留 20px padding；主题分段组撑满内边距以内的可用宽度，三个图标等宽分配，不贴侧栏外边缘。

- 文档站自身的可见下拉框使用 Inkra Select，包括语言与 playground 属性；不能只在组件示例中使用新组件。语言和纯图标主题 RadioGroup 固定在侧栏底部，导航区域独立滚动；窄屏移入抽屉底部，Select 弹层在抽屉内部挂载并保持 Escape / 焦点返回。页头不重复显示设置。
- 文档正文与导航统一四边 20px padding，窄屏相同，不再叠加额外顶部留白。导航点击区域保持整行，选中彩铅铺色只包裹文字及必要内距。

- 组件文档统一为页面级“示例 / API / 无障碍”三个互斥面板，地址 hash 与浏览器前进后退同步；不要和示例内部的“预览 / 代码”混用。补充示例标题放在彩铅卡片 header 内，代码展开放在独立 footer。
- 侧栏分割线归属 sticky 侧栏，按可视高度绘制，不随正文高度拉长或跟随正文滚动。正文高度由当前内容决定，只有 playground 左侧展示区固定高度；不为短内容额外制造滚动尾部。
- Switch 轨道为 52×32px，圆点盒为 24×24px，两端内距 4px、行程 20px；实际笔触也应接近圆点盒尺寸。关闭靠逻辑起始侧、开启靠结束侧，RTL 反转，命中区域仍至少 44px。
- RadioGroup 的 radio 用于表单选项，segmented 用于同组互斥视图或主题模式；可配图标，保留原生 radio、单一名称及方向键规则。Select 用于收起的单选列表，复用成熟浮层原语并保持纸面、彩铅边界和文字。
- segmented 使用一个共享圆角彩铅外框，组内留 4px 内距，选项紧邻且无各自常驻边框；横向与纵向都不留选项间隙。水平排列保持单行和自然标签宽度，空间不足时只在选项区域横向滚动，不缩字号或让页面溢出。选中背景使用稳定彩铅图层的 180ms 透明度过渡，减少动态效果时禁用过渡。
- Input / Textarea 的占位文字和普通输入值使用原文字颜料算法增强，真实 input/textarea 仍负责光标、选区、表单与编辑。组合输入期间、复杂字形、特殊输入类型、超出预算、绘制失败、打印和强制颜色时回退原生文字；编辑内容不进入共享文字缓存。Textarea 按 DOM 测量真实换行，不自造字符换行算法。
- 所有组件文档的主示例统一使用预览/代码工具栏、固定高度的左侧展示区和始终挂载的右侧属性面板；窄屏属性面板下移，切换视图不改变整体高度。属性与示例状态同步生成源码。下方补充示例保留 footer 展开源码，不用它替代主 playground。
- 最新覆盖：文档站固定使用玄墨主题，浅/深/跟随系统模式下的操作、链接、焦点与选中态使用对应玄墨颜料和前景；色彩页与使用指南默认展示玄墨。其他配色色块仅切换资源预览，不改变站点主题。此设置仅限文档站，不改变组件包默认主题、状态语义色、纸面、字体或彩铅算法。
- 当前规则：全站文档共享 20px 水平 padding 与全宽容器，移除全部分类眉题。同一段间距只有一个归属层：容器 padding 与首尾子元素同向 margin 不叠加；父层 gap 与子元素同向 margin 不叠加。快速开始内容由 section 顶部 32px 和内部 gap 16px 管理，直接子项 margin 清零。此规则不禁止卡片内边距与卡片外间距服务于不同空间。
- 基础导航新增 /usage-guide 使用指南，包含色彩、排版、间距、圆角、图标、状态与适配规定；使用矩阵和亮暗卡片 demo 移至该页面。色彩页只保留资源与配对预览。
- 配色选择在整个配色区域右侧居中竖排，以彩铅 outline 表达选中，不用 CSS 实线下划线。浅色沧浪前三阶增强蓝色；暗色独立调色，从深到亮，保持原有色相家族。纸面样例直接承载文字层级，展示实际组合。
- Button 比较示例使用独立彩铅卡片，footer 触发展开下方代码，示例不卸载。主 playground 右侧属性始终存在，代码随属性变化；左侧预览/代码共享固定高度，长代码内部滚动。link 变体使用 PencilLine 下划线，强制颜色与打印保留原生下划线。
- 最新覆盖：色彩页移除主题色/字体色/背景色内层 tabs，默认展示沧浪一套色阶，右侧玄墨/沧浪/朱砂/松青色块切换；字体色、纸面色及主题背景合并到当前配色示例。色阶保持可复制，笔触整体固定为 -35 度，文字与命中区域不旋转。
- 删除独立大块配对展板，由实际卡片列表展示标题、说明、元信息、基础/抬升/安静纸面、操作及四种状态。可用内容宽度大于 760px 时左浅右深；不足时只显示页头选定的主题，auto 跟随系统。两侧任务完成状态与筛选同步，无第二套主题开关。
- 文字层级最新值：浅色主要/次要/辅助为 #172b21 / #45594c / #616d63；深色为 #f5f6ed / #becbbb / #96a591。保持字形、400 字重、文字颜料算法与 canvas 不透明度不变。包测试校验层级亮度顺序与三种纯色纸面上的 4.5:1 下限；纹理与字形最终表现仍需独立视觉检查。
- 参考 TDesign 的色彩与字体规范页面（https://tdesign.tencent.com/design/color-en 、https://tdesign.tencent.com/design/fonts-en），采用基础资源、语义用途、实际示例的组织方式，不移植其默认字体、字号、字重或色板生成算法，也不据此宣称无障碍认证。
- 排版页分为字体、字号、行高、字重、字体色、图标六部分，提供页内导航、实际尺寸示例与适用场景；删除色彩系统总介绍及设计规范页的风格描述，保留可执行的使用规则。
- 色彩展示分为主题色、字体色、背景色。主题色为玄墨、沧浪、朱砂、松青四组；只改变选色资源，不替换当前默认蓝色主题。新增 graphite/cinnabar/pine 原始色阶。
- 色阶采用真实露纸笔触，桌面两列、窄屏单列。无色阶数字和色值展开项；色块原生按钮支持悬停查看十六进制值、点击或键盘复制，并报告成功或失败。
- 浅深色应用示例与配对工具使用圆角彩铅纸面边框。使用矩阵标题位于滚动容器之外，避免裁切文字笔触。卡片列表 demo 可切换浅深色、勾选完成。
- 字体用途：页面标题 28/1.2，章节标题 24/1.2，面板标题 20/1.45，卡片标题 17/1.45，正文 15/1.6，辅助信息 13/1.45，紧凑标记 12/1.45。控件默认 1.45 行高，不合成粗体，不按视口缩字。
- 图标盒 14/16/20/24px 分别搭配 12/13/15/17px 文字、32/36/44/48px 按钮；命中区域至少 44px。既有文档 28–30px 展示图标是兼容例外。
- 圆角样例不使用 CSS 实线。PencilSurface 新增可选 radius（有效范围 0–8px），用于有轮廓表面的轮廓与铺色计算；full、ghost、wash、selection 不消费此参数。未指定时保持原 variant 默认。0px 不增加圆角扰动。CSS 圆角仍不自动改变 canvas，示例显式传入数值。

本节覆盖下文历史暗色表格与旧采样结论；具体值以 `packages/inkra/src/tokens.css` 为准。用户已选定“清晰”，临时方案选择器及参数展开区已移除。

- 暗色纸面 / 抬升纸面 / 安静纸面：`#191d1e / #272d2e / #23292a`；主要 / 次要 / 辅助文字：`#f5f6ed / #e0e6dc / #cbd6c8`。
- 暗色主题颜料 / 强调文字 / 淡颜料 / 操作文字：`#82bdcb / #d3e9ee / #8cb2ba / #edf8fa`；边界 `#a7b5a6`，焦点 `#a1c9d3`；选中颜料 / 文字 `#9bbd85 / #e9f3e3`。
- 暗色成功、提醒、危险、信息增加独立状态纸面：`#20372b / #3a3020 / #3b2727 / #20343c`，保留真实纸纹和彩铅铺色。浅色状态继续用基础纸面。
- 显式暗色与自动暗色一致；不更换字体、文字颜料算法或画布透明度，不加入实心文字覆盖层。
- 色阶显示名为“沧浪”“宣墨”；代码变量名不变。色彩样片与使用矩阵使用语义名称，不展示变量名和主题属性调试标识。
- 页头提供中文 / English 选择，保存在 `inkra-docs-locale`；界面文案在 React 渲染前翻译，DOM 与彩铅文字同步更新，不用 DOM 文本替换。设计规范三个分类均提供中英文。
- 设计规范页去掉“基础”眉题，分类 tabs 上下各保留一道铅笔分割线。搜索框仅保留纸面和铅笔轮廓，无默认彩色铺色。正文左右 20px 与侧栏一致，样片内边距保留。

Inkra 是面向 React 的通用彩铅组件库。v0.1 的视觉原型以原新西兰站 Adventure Map 为权威来源：字体、纸张、描边、文字颜料和露纸铺色先忠实提炼，再讨论组件通用化。此前“系统无衬线正文、白纸、森林绿实心主按钮”的方向与原站不一致，本版明确废止。

本地文档站先提供浏览、预览和设计规范的页面骨架，不以示例 API、空白占位或 npm 名称预留冒充完整可用组件。

## 0. 权威源文件

下表路径均相对原新西兰站仓库根 `new-zealand-slow-trip-2026/`。Inkra 可以重组 API，但视觉参数的改变必须有对照评审，不能凭“更像组件库”自行改造。

| 视觉职责 | 权威实现 |
| --- | --- |
| 手写字体栈、文字颜料算法 | `src/adventure/pencil/label.js`、`src/adventure/pencil/mapLabels.js`、`src/adventure/pencil/PencilText.jsx`、`src/adventure/pencil/PencilText.css`、`src/adventure/pencil-map.css` |
| 字体文件与许可证 | `src/adventure/assets/ui-hand-yozai.woff2`、`src/adventure/assets/README.md`、`src/adventure/assets/Yozai-OFL.txt` |
| 地图与材质色板 | `src/adventure/pencil/palette.js` |
| 默认 ocean 主题及 fern/sunset 备选主题 | `src/adventure/AdventureMenu.css` |
| 浅色/深色语义映射 | `src/adventure/AdventureAppearance.css` |
| 笔压、断笔、颗粒、多遍描边 | `src/adventure/pencil/stroke.js` |
| 露纸彩铅铺色 | `src/adventure/pencil/wash.js` |
| 真实纸张颗粒 | `src/adventure/pencil/paper.js` |
| 组件轮廓、裁切与主题重绘 | `src/adventure/pencil/PencilSurface.jsx`、`src/adventure/pencil/PencilSurface.css` |

## 1. 视觉基线

- 默认视觉是原站 ocean 主题：暖纸 `#f4f0e3`、深绿墨 `#293d33`、海蓝彩铅 `#4b96aa`、安静蓝 `#78a9b3`。地图强调红 `#994f3f` 只用于必要标记；森林绿不是默认品牌主色。
- 主操作不是绿色实心矩形。它由纸纹、海蓝露纸 wash、深蓝绿文字和轻微三遍彩铅轮廓组成；hover 只轻微增强对比，不更换为光滑纯色底。
- 手绘来自笔压变化、纸齿颗粒、自然提笔、边缘毛丝和少量多 pass 重描，不是规则虚线、等距斜线、统一噪点蒙版或每次渲染都变化的抖动。
- 默认采用轻量静态纹理：首帧生成后保持不动，不用持续动画制造“手绘感”，也不因 hover、滚动或页面恢复重新随机采样。
- 页面区段不包进层层卡片。只给重复条目、弹窗、真正独立的预览工具一个必要边界。
- 手绘装饰依附真实结构，不设置大面积空白、宣传口号、装饰圆团或仅为展示画风存在的英雄区。
- 工具操作优先使用统一图标。颜色选项用色块，模式用分段选择，二元状态用开关或复选框，数值用输入或滑块。
- 现成图标采用统一图标库的几何路径；需要铅笔化时只转换表现层，保留熟悉的轮廓，不重新发明符号。

## 2. 色彩 Token

源码唯一入口为 `packages/inkra/src/tokens.css`，全部自定义属性使用 `--inkra-` 前缀。以下省略前缀；组件使用语义变量，不写近似的临时颜色。

### 原始色阶

- Ocean 色阶固定为 `50 #eef7f8 / 100 #d9ecef / 200 #b7dce2 / 300 #93c7d0 / 400 #78a9b3 / 500 #5ca0b0 / 600 #4b96aa / 700 #3e7b8c / 800 #305e6b / 900 #294c56 / 950 #172f36`。原站锚点保持为 `accent = ocean-600`、`accent-soft = ocean-400`、`accent-strong = ocean-800`，深色语义映射仍可选择更亮的可读值。
- Warm neutral 色阶固定为 `50 #fdfcf8 / 100 #f8f5ec / 200 #f4f0e3 / 300 #f2ead7 / 400 #ddd6c4 / 500 #b6b39d / 600 #8d8b78 / 700 #5f6052 / 800 #3f4037 / 900 #292920 / 950 #1b1b17`。它提供纸张与中性色参考；深色 `surface-muted #263238` 继续保留原地图面的蓝灰来源，不为贴合色阶而改色。
- 原始色阶只用于选色、图表或小面积色块。组件不得把某一级 pigment 直接作为不透明状态背景；action、quiet、selection 与 status 必须通过真实 `PencilSurface` wash 组合纸面和前景。

### 纸面与基础前景

暗色可读性修订：以下表格中的历史暗色前景由当前值覆盖：`ink/accent-strong #f6f3e5`、`ink-muted #e1decc`、`ink-subtle #cbc8b5`、`coral/danger/danger-foreground #ffd1c6`、`success-foreground #d5efd7`、`warning-foreground #ffe5b3`、`info-foreground #d8f1f5`。显式暗色与跟随系统暗色保持一致。浅色、纸面、wash 强度和文字颜料算法不变；不添加实心字覆盖层。历史纯色对比矩阵不能代替透明笔触的最终视觉检查。

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `paper` | `#f4f0e3` | `#1b1b17` | 原站 ocean 纸面 / 深色纸面 |
| `surface` | `#fdfcf8` | `#292920` | 标签保留纸、实际抬升内容面 |
| `surface-muted` | `#f2ead7` | `#263238` | tooltip 纸 / 深色地图面 |
| `ink` | `#293d33` | `#e5e2cf` | 标题、正文、主要图标 |
| `ink-muted` | `#465e4b` | `#b6b39d` | 次要但需要阅读的内容；浅色针对实际 muted surface 采样继续收深 |
| `ink-subtle` | `#5e7265` | `#9c9a88` | 辅助笔迹；深色与 muted 分层，不再共用同一值 |
| `accent` | `#4b96aa` | `#78b8c8` | ocean 操作 wash 原始颜料 |
| `accent-strong` | `#305e6b` | `#e5e2cf` | 操作文字、强调墨色 |
| `accent-soft` | `#78a9b3` | `#78a9b3` | quiet/badge wash 原始颜料 |
| `on-accent` | `#173b45` | `#fffbe8` | 露纸操作专用文字；不再 alias `accent-strong`，仍须配合受限 wash 验收 |
| `coral` / `coral-soft` | `#994f3f` / `#d49b8b` | `#ffb6a8` / `#292920` | 地图强调、错误与暖色颜料 |
| `blue` / `blue-soft` | `#4d91a0` / `#87bbc0` | `#78b8c8` / `#78a9b3` | 原地图水色与 ocean 辅助色 |
| `border` | `#99aa9b` | `#b6b39d` | quiet 轮廓颜料 |
| `border-strong` | `#536d59` | `#b6b39d` | sheet / action 轮廓颜料 |
| `focus` | `#305e6b` | `#e4d99e` | 原站主题墨 / 深色焦点 |
| `danger` / `danger-soft` | `#873e36` / `#d49b8b` | `#ffb6a8` / `#d49b8b` | 原站错误墨与暖红 wash 颜料 |
| `selection` | `#d6b781` | `#d6b781` | `PencilText` 原生文字选择底色 |
| `selection-pigment` | `#769566` | `#c6b873` | 原站选中 tab 的 wash 颜料，不是最终不透明背景 |
| `selection-foreground` | `#173b2b` | `#fffbe8` | 选中 tab 文字/图标；pigment 保留，foreground 以最新可读性要求加深/提亮 |

### 状态配对

| 状态 | 浅色 pigment / foreground | 深色 pigment / foreground | 约束 |
| --- | --- | --- | --- |
| `success` | `#629568` / `#21472f` | `#629568` / `#b7d7b8` | fern pigment + 可读文字；浅色依据真实 wash 失败继续加深 |
| `warning` | `#e6c17b` / `#6b4d1f` | `#e6c17b` / `#f0d59a` | crop pigment + 暖棕/浅金文字 |
| `danger` | `#d49b8b` / `#873e36` | `#d49b8b` / `#ffb6a8` | 与既有 `danger-soft` / `danger` 数值一致，新增明确 pair 名 |
| `info` | `#4b96aa` / `#173b45` | `#78b8c8` / `#b9dce3` | ocean pigment + 主题内可读文字；浅色不再复用 accent-strong |

每个状态都以 `*-pigment` 与 `*-foreground` 成对消费。文档示例使用 `PencilSurface variant="quiet"`，把 pigment 传给 `accent-soft` renderer 输入，并把 foreground 同时用于 DOM 文字与轮廓；不能用 CSS 平面色块冒充最终 wash。

### 使用与对比矩阵

未铺色纸面只用于 fallback 风险筛查，不能作为纹理通过证据。FR7 新值下浅色 `ink-muted/surface-muted` 的静态比值为 `5.91:1`、`ink-subtle/paper` 为 `4.52:1`；深色 `ink-muted/surface-muted` 为 `6.22:1`、`ink-subtle/paper` 为 `6.08:1`。浅色 on-accent/success/info 对 paper 的静态比值分别约为 `10.54:1 / 9.18:1 / 10.54:1`，只说明 fallback 字色有余量，不说明 action 或 status wash 已通过。

action 的真实配对是 `on-accent + paper + accent action wash`，secondary 是 `ink + paper + accent-soft quiet wash`，selection 使用 `selection-foreground + paper + selection-pigment wash`，四个 status 是各自 `foreground + paper + pigment quiet wash`。半透明纹理不会自动获得 pigment 原色的对比度，禁止直接比较 foreground 与不透明 pigment 后宣称通过。FR7 最终强度为 action 浅/深 `.20/.12`、quiet 浅/深 `.12/.08`、selection 浅/深 `.22/.14`，早期 exact 密度合同已废止。coordinator 对当前 30 项 pair 的中央区域纸面与 canvas 合成背景使用 opaque foreground 复测，全部 `min >= 4.5:1`；该证据不覆盖字体抗锯齿边缘像素的全面认证。

正文默认 `ink` 或 `ink-muted`，并按最终背景验算。内部验收目标为正文至少 4.5:1，必要图标、焦点与控件边界至少 3:1；纹理不能让错误和选中状态只能靠颜色辨认。

主题在根元素设置 `data-inkra-theme="light|dark|auto"`；文档站兼容 `data-theme`。默认浅色数值对应原站 ocean 主题，深色数值对应 `AdventureAppearance.css`，不是对浅色颜色做机械反相。原站另有 fern 与 sunset 主题，只有在后续组件真实支持主题色切换时才作为独立 palette 引入，不能把其中的森林绿提前改成默认品牌色。切换主题必须重取实际颜色并更新 canvas 墨迹，不能只更改背景。

## 3. 排版与布局

| 类别 | Token 与值 | 规则 |
| --- | --- | --- |
| 手写字体 | `font-hand` | 原站 `mapHandwriting`：`"HanziPen SC","Hannotate SC","Kaiti SC","STKaiti","Trip Map Hand",cursive` |
| 正文 | `font-body` | 与 `font-hand` 相同，不回退到通用系统无衬线来改变原站气质 |
| 展示字体 | `font-display` | 与 `font-hand` 相同，层级靠尺寸、空间和颜料强度，不换衬线品牌字体 |
| 代码 | `font-mono` | 数值、代码与技术标识 |
| 字号 | `text-xs/sm/md/lg/xl/2xl/3xl` | `12/13/15/17/20/24/28px`，覆盖原站高频字号 |
| 字重 | `weight-regular/medium/semibold` | 均为 `400`；Yozai Light 不合成粗体 |
| 行高 | `line-tight/ui/body` | `1.2/1.45/1.6` |
| 字距 | `letter-spacing` | 恒为 `0`，不以负字距挤压标题 |
| 间距 | `space-0` 至 `space-16` | `0` 至 `64px`，每级 `4px` |
| 圆角 | `radius-none/sm/md/lg` | `0/3/6/8px`，卡片不超过 `8px` |
| 控件 | `control-xs/sm/md/lg` | 彩铅表面视觉高度 `32/36/44/48px`，不等同于命中盒高度 |
| 触摸 | `touch-target` | 至少 `44px`；小号视觉仍须有不重叠的命中区域 |
| 图标 | `icon-xs/sm/md/lg` | glyph 尺寸 `14/16/20/24px`；图形、视觉方块和命中区域分别定义 |
| 内容宽度 | `content-width` / `reading-width` | `72rem` / `44rem`，同时不超过可用宽度 |
| 文档结构 | `sidebar-width` / `header-height` | `15rem` / `64px` |

字号不使用 `vw`。窄屏通过结构重排、省略次要信息和正常换行适配，不把正文缩成细字。常规组件正文以 `15px` 为基线，元信息 `13–14px`，面板标题约 `20px`；`10–12px` 只用于有充足对比度的刻度或次要标记。

字体资产由使用方显式加载 `Trip Map Hand`。原站文件是 Yozai Light v0.868 的 706 字符 WOFF2 子集，未覆盖字符按上述平台楷体链回退。字体未加载时 DOM 内容必须立即可见，不能用透明文字等待字体或 canvas。

固定格式的预览、图标槽、开关和按钮预留稳定尺寸。loading、hover、选中与替换标签不能挤动周边布局。中文、长英文、200% 文字缩放都要可读；可点击图标不能随标题换行而掉到下一行或消失。

文档站桌面采用导航、主内容、可选页内目录；窄屏将导航收为可关闭抽屉并隐藏重复目录。正文只留一处主滚动，表格或代码需要横向滚动时限制在自身容器。

## 4. 铅笔材质

### 布局选择规则

这组规则定义新增界面的默认选择，不是已有所有控件都已迁移的声明。同级元素统一使用一档；重要程度用语义 variant 表达，不任意放大尺寸。

| 用途 | 默认值 | 例外与限制 |
| --- | --- | --- |
| 页面、全宽区段、连续表格圆角 | none / 0px | 不把页面区段包成浮动卡片 |
| 小色块、内嵌代码、紧凑标记圆角 | sm / 3px | 不用于主按钮或弹层 |
| 新增普通控件、标签、缩略图几何圆角 | md / 6px | 当前 canvas action/quiet/outline 为 7px，属于兼容例外；CSS token 不会改写 canvas |
| 独立工具、重复内容卡片、弹层圆角 | lg / 8px | 上限 8px，不嵌套装饰卡片 |
| 短提示内边距 | space-2 / 8px | 仅短内容 |
| 菜单项、紧凑列表内边距 | space-3 / 12px | 交互行命中高度至少 44px |
| 普通容器内边距 | space-4 / 16px | 同层容器统一 |
| 弹层、独立任务面板内边距 | space-6 / 24px | 窄屏可降为 16px，不缩正文 |
| Button 水平内边距 | xs/sm/md/lg: 12/16/20/24px | 垂直由固定视觉高度居中，不额外加 padding |
| 标题与元信息间距 | space-1 / 4px | 同一信息单元 |
| 图标与文字、同组操作、字段标签与输入间距 | space-2 / 8px | 当前 ButtonGroup 保留 4px 紧凑例外 |
| 独立字段、重复条目间距 | space-4 / 16px | 父容器统一管理 |
| 内容分组间距 | space-6 / 24px | 如表单与操作区 |
| 独立章节间距 | space-8 / 32px | 48/64px 仅用于布局大区段 |
| 常规控件尺寸 | md / 44px | 默认优先使用，同一操作行同尺寸 |
| 高密度桌面工具栏 | sm / 36px | 命中盒仍至少 44px |
| 表格次要操作 | xs / 32px | 不作为触屏主操作 |
| 独立触屏主操作 | lg / 48px | primary 不必然等于 lg |

间距以 4px 为基础步长，优先使用 8/16/24/32px；12px 用于紧凑内边距，20px 保留给 md 按钮。0 用于贴合或重置，不分隔独立操作。父容器 gap 与子元素同方向 margin 不叠加。窄屏先换行或改单列。

文档站设计规范页移除居中限宽，左右内边距与侧栏导航一致，使用 space-5 / 20px，不贴边。样例内部 padding 保留，此页面特例不修改普通容器的内边距规范。

### 默认策略

默认材质是静态、确定性、可降级的增强层。组件先渲染可读 DOM，再按原站方式增强文字颜料、纸面、边界和铺色；默认不启动连续 `requestAnimationFrame`，不为不可见组件提前生成高分辨率位图。

低性能、强制颜色、打印或纹理初始化失败时，可以关闭 canvas 增强，但不能因此改变布局、语义和命中区域。普通正文可保持原生字体渲染；需要复刻原站 C 版重描效果的标签、按钮和标题允许使用 `PencilText` 式 pigment canvas。

### 纸张

纸张不是纯色背景加统一噪点。原站 `paper.js` 使用 `384×384` 平铺纹理：浅色纸先铺主题纸色，再叠 `#808278` 与白色纸齿，并绘约 1100 条短而弯曲、跨 tile 连续的纤维；深色纸使用 `#3b392f`、`#0a0a08` 与约 700 条更安静的纤维。纸纹必须无明显接缝，不随组件尺寸重新随机。

### 描边

沿原始路径距离建立稳定噪声，独立控制笔压、提笔、纸齿沉积、边缘颗粒和多 pass 漂移。路径不改变时，hover、滚动和重复渲染不改变纹理。默认轻微轮廓变化，不让可识别图标变形。

`PencilSurface` 基线参数直接映射原站：`paper` 为 `radius 8 / width 1.2 / passes 3`；`action` 为 `radius 7 / width 1.35 / passes 3`；`quiet` 为 `radius 7 / width .75 / passes 2`；`badge` 为 `radius 6 / width .9 / passes 2`。轮廓采样使用 `variation .82 / grain .7 / amplitude .6 / step .8`，paper 的 `breaks .2`，其他轮廓 `breaks .25`，action `gain 2.5`，其余 `gain 2.1`。

每一遍不是复制同一条规则线：主 pass 保留笔压与断笔，后续 pass 使用有界漂移与较低透明度；每个采样段还能出现细丝与偏心颗粒。不得用 `border-style: dashed`、SVG `stroke-dasharray` 或随机 CSS transform 代替。

### 铺色

用长短不齐、方向略有变化、两端独立提笔的连续笔触形成淡铺色，露出纸张；边缘自然伸出，不先画实心矩形再叠噪点。行距只是采样基线，笔触位置、倾斜、长度、压力、断笔和纸齿都不同，视觉上不得形成等距条纹。

原站 action wash 的参考起点为主题 `accent` 原始颜料，`strength .48 / spacing 1.8 / roughness 3 / inset 2 / radius 7`；quiet 参考为 `strength .18 / spacing 2.2`，badge 为 `strength .25 / spacing 2.2`。FR7 已证明参考密度在部分浅深主题组合中遮蔽文字，因此最终 action 使用浅/深 `.20/.12`，quiet 使用浅/深 `.12/.08`；参考参数不能覆盖正文可读性要求。散边 wash 使用 `spacing 1.8 / roughness 3.5 / inset 2 / radius 8 / edgeReach 8`，四周预留 `12px` 绘制余量。每四行可加一次更细的第二笔，最后用约 `面积 / 12` 的确定性纸齿点做 `destination-out`，形成真实露纸。

主操作也不得退回实心绿色或实心蓝色矩形。对比度由纸面上的不透明 DOM / PencilText 文字保证，wash 只提供色铅填充感；伸出笔触不能扩大命中区域或覆盖邻项内容。

### 选中 Tab

选中态以原站 `AdventureCalendar.jsx` 的 `paintSelectedTab` 为视觉来源：浅色 `selection-pigment #769566`、深色 `selection-pigment #c6b873`，保留 `spacing 1.8 / roughness 3.5 / inset 2 / radius 8 / edgeReach 0` 的几何与露纸形态。原始 `strength .32/.48` 只作为上游参考；FR7 最终按主题降低为浅/深 `.22/.14`。tab 的选中语义仍由 `aria-selected="true"` 表达。

背景与前景必须成对使用和验收：浅色为 `selection-foreground #173b2b` + `paper #f4f0e3` + `.22` selection wash，深色为 `selection-foreground #fffbe8` + `paper #1b1b17` + `.14` selection wash。调整前深色真实采样只有 `min 1.88:1 / p5 2.57:1`；调整后 coordinator 以 opaque foreground 对中央合成背景复测，浅色 `min 5.960:1`、深色 `min 6.292:1`。此证据覆盖当前采样区域，不代表字体抗锯齿边缘像素已全面认证。

不得把 `selection-pigment` 当作不透明 CSS 背景直接与前景计算对比，也不得为了通过静态色值检查把 wash 改成实心填充。单独比较 foreground 与 pigment 不是实际视觉，也不是有效验收证据。`variant="selection"` 应同时消费 `selection-pigment` 与 `selection-foreground`，并让 wash 强度服从最终像素可读性。

### 文字颜料

原站 C 版重描参数固定为 `variation .52 / breaks .18 / outline .96 / fill .34 / grain .45`。文字先按真实字体生成 glyph mask，再用有向短提笔、距离场轮廓、低频笔压与高频纸齿合成颜料；不是给普通字体叠 `text-shadow` 或透明噪点。地图标签 mask 使用 4 倍分辨率，DOM `PencilText` 画布使用 2 倍分辨率，并按真实 DOM 换行逐行绘制。

### 内容层

正文、输入值、代码和链接始终可选择、搜索、复制、输入及被辅助技术读取。canvas 或纹理图片默认 `aria-hidden` 且 `pointer-events: none`；真实语义与事件留在 DOM。不得把整块内容截图后替代 DOM。

`PencilText` 增强允许在颜料 canvas 成功后把同一段 DOM source 的字形设为透明，但必须遵守原站状态机：初始 DOM 可见；字体、尺寸或主题变化时先移除 ready 状态恢复 DOM；只有绘制成功才显示 canvas 并透明 source；异常、超预算、context lost、强制颜色和打印时显示 DOM 并隐藏 canvas。透明 source 仍保留选择色，不能出现“canvas 丢失且 fallback 仍透明”的空白内容。

图形不可用时退回可读的 CSS 轮廓与背景。强制颜色模式禁用会干扰系统颜色的纹理，使用系统色保留焦点、边界和选择状态。

## 5. 交互契约

以下是后续组件实现约束，不是已经发布的 API 承诺。

| 组件族 | 语义与行为 | 首批状态 |
| --- | --- | --- |
| Button / IconButton | 原生 `button`，默认 `type="button"`，透传 `ref`、事件和 ARIA；纯图标有可访问名称与提示 | 默认、hover、focus-visible、pressed、disabled、loading |
| TextField / Checkbox / Switch | 真实表单控件，label、description、error 正确关联；受控与非受控不可混用；兼容输入法 | 空值、有值、聚焦、禁用、只读、无效 |
| Tabs / SegmentedControl | 明确选择语义与方向键规则；焦点与已选择项分别管理 | 默认、选中、禁用、溢出 |
| Dialog / Popover / Tooltip | 成熟无障碍原语负责焦点、Escape、外部点击与返回触发器；提示不能成为唯一的信息来源 | 打开、关闭、边界翻转、内容滚动 |
| Surface / Divider | 无默认交互语义；材质与内容尺寸分离 | 浅色、深色、纹理不可用 |

### Button 尺寸

FR5 的文字按钮尺寸为 `xs/sm/md/lg`，视觉表面严格使用 `control-xs/sm/md/lg: 32/36/44/48px`，字体严格使用 `text-xs/sm/md/lg: 12/13/15/17px`。`sm` 的 `36px` 彩铅表面不能再被原生按钮的 `min-height: 44px` 撑成 `44px`；原生交互盒与内部视觉表面必须分层，外层命中区域仍至少 `44×44px`，内层 paper/wash/outline 才按视觉 token 绘制并居中。

尺寸验收同时记录两个值：原生交互盒至少 `44px`，视觉表面分别为 `32/36/44/48px`。只测外层 button 会让 `xs`、`sm` 与 `md` 看起来都像 `44px`，不能作为 FR4/FR5 通过证据。相邻小号按钮的扩展命中盒不得互相重叠，也不得改变 flex/grid 的视觉间距。

纯图标尺寸 `icon-xs/icon-sm/icon/icon/icon-lg` 使用同样的视觉方块 `32/36/44/48px`，内部 glyph 使用 `icon-xs/sm/md/lg: 14/16/20/24px`。图标画布、可见方块和至少 `44px` 的原生命中区域分别测量；不通过把 glyph 放大来伪造尺寸差异。

### Button 变体

| Variant | 彩铅合同 |
| --- | --- |
| `primary` | action 表面：`accent` 露纸 wash、action 三遍轮廓与 `on-accent` 前景；保持原站主操作质感，不用实心品牌色矩形 |
| `secondary` | quiet 表面：`accent-soft` 更淡 wash、quiet 两遍细轮廓与普通 `ink` 前景；视觉强度必须明显低于 primary |
| `outline` | 只绘纸面上的稳定彩铅轮廓，不绘 wash；不能退回浏览器规则实线边框 |
| `ghost` | 静止态无常驻 wash、纸底和外框，保留文字/图标；hover/pressed 可短暂出现极淡彩铅反馈，focus-visible 仍用独立焦点环 |
| `destructive` | `danger-soft` 以 quiet 强度 `.18` 作为暖红 wash、`danger` 作为前景，按最终纸面合成结果验算对比；不能只把 primary 的文字换红 |
| `link` | 无 paper/wash/轮廓，使用可见下划线与合理 underline offset；hover、visited、focus 与 disabled/loading 仍保持语义和可读性 |

六个变体必须在纹理、边界与层级上可区分，而不只是换文字颜色。所有圆角使用 `radius-none/sm/md/lg`，最大 `8px`；不移植 shadcn/Tailwind 的 `rounded-full`、胶囊按钮或其依赖栈。selection tab 的 `selection-pigment` / `selection-foreground` 合同保持独立，Button 的 secondary、destructive 或 pressed 状态不得借用这两个 token；其 foreground 与 wash 上限可以因真实可读性证据修订。

### Button 内容与语义

- `startIcon` 与 `endIcon` 是 label 两侧的逻辑 inline-start / inline-end 槽，使用 `gap` 和逻辑属性，不写死 `margin-left/right`。RTL 下顺序和间距随书写方向正确翻转，图标本身不随意镜像。
- 有文字的按钮保留稳定 label 和图标槽；loading 可以覆盖或替换预留槽，但不能改变宽高、内边距或把 DOM label 删除。纯图标按钮必须有可访问名称，陌生图标提供可悬停和键盘可达的提示。
- `Button` 保持真实 `button`，默认 `type="button"`；表单提交只在调用者显式设置 `type="submit"` 时发生。`ButtonLink` 必须输出真实 `a` 与 `href`，不能用 button 模拟导航；disabled/loading 链接使用 `aria-disabled` 并阻止鼠标、键盘激活。
- `ButtonGroup` 使用语义 group 与可访问名称，支持 `horizontal|vertical`；按钮零间隙连接，共享一个 8px 圆角彩铅外框，相邻按钮只绘一道 `PencilLine` 分割线，组内按钮不重复绘制边框。保留原变体铺色、命中尺寸与原生 Tab 顺序，不引入 toolbar 方向键行为。水平窄屏保持方向并局部滚动，不嵌套交互元素。此规则覆盖历史 4px 间距例外。FR5 不引入 `asChild` 或任意 polymorphic render API。

统一尺寸 `xs/sm/md/lg` 与语义色 `neutral/accent/danger`。差异用明确 variant；不暴露无法解释的随机 props，不让调用者提供私有的 canvas 上下文。`accent` 表示原始彩铅颜料而非实心背景色。异步 loading 不改变按钮尺寸，并防止重复提交；disabled 不仅降低透明度。

可见焦点使用 `focus-width: 2px` 和 `focus-offset: 3px`，不依赖淡颗粒。方向键、Tab、Enter、Space、Escape 按控件语义工作。开关和选中状态同时有图形或文字反馈，不能只改变色相。

动画使用 `motion-fast/normal/slow: 120/180/420ms` 与统一 `ease`；`420ms` 对齐原站面板进入/退出节奏。尽量只变换 opacity、transform；禁止动画 width/height 导致逐帧重绘纹理。`prefers-reduced-motion: reduce` 将时长归零，不延迟内容与焦点。

## 6. 渲染与缓存

- 文字画布的尺寸、换行与行位置必须使用未变换的本地布局坐标，不能把 getBoundingClientRect 的缩放后尺寸与原始字号混用。PanZoom、NodeGraph 及旋转卡片中的文字应完整显示；纯平移、缩放、旋转不重新生成笔触。需要隔离测量时使用短生命周期、不可交互且对辅助技术隐藏的测量节点，保留亚像素尺寸与排版，并在成功或异常后移除。回归应比较变换前后的字形完整性与画布像素，而不只检查 canvas 是否存在。
- PencilText 的可视区域内容在浏览器 layout effect 中完成首次绘制，视口外 240px 内仍使用有界空闲队列预热，远处不绘制；SSR 和绘制失败保留可读 DOM，不隐藏整页等待字体。字体就绪只在有效外观改变时使文字失效。
- 静态 ASCII 标签在运行时复用字符笔触，保留三种稳定位置变体；字符缓存最多 512 项 / 8 MiB，按字体、字号、颜色、笔触、种子与分辨率区分。复杂文字保留原整行路径，编辑器的 cache=false 不进入字符缓存；不内置预绘制字库，不持久化用户文字。

缓存是材质层的优化，不影响 DOM 的存在和可交互性。不要直接照搬原应用的全局恢复实现。

1. 几何缓存按规范化路径内容、尺寸和算法版本索引；调用者重新创建同值对象不触发重采样。
2. 位图键包含算法版本、规范化几何、稳定 seed、实际宽高、有效 DPR、解析后的颜色、主题与全部材质参数。字符串序列化顺序固定，不能遗漏影响像素的输入。
3. seed 由稳定组件标识、规范化几何或调用者显式值派生；不得使用渲染时刻、数组瞬时下标或每次调用的 `Math.random()`。相同键必须产生相同输出，算法变化必须提升版本而不是静默复用旧缓存。
4. 实测尺寸未变化时不重绘。ResizeObserver 合并同一帧的变化；纯平移、hover 和菜单状态不清理材质缓存。
5. 内存缓存有条目数与像素/字节预算及淘汰策略；位图尺寸跟随实际控件，不分配视口级超大画布。未使用的 ImageBitmap 及时释放。
6. 持久缓存只存公开且确定性的材质/图标，可按版本保留；用户输入和私密文字默认禁止落盘。存储失败、配额满或不可用时自动退回内存，不能阻断界面。
7. 后台恢复先保留几何和可靠像素源，按需重建失效的可丢弃 canvas 表面。不能每次回来清空所有缓存，也不能把无效透明 canvas 当作有效命中。
8. 不读取每帧像素来检查健康；优先使用明确的 context 恢复信号、尺寸/版本校验和有界健康检查。切换主题、DPR 或算法才重建对应条目。
9. 队列只处理仍可见且仍需要的任务；卸载、内容变更及过期结果要取消或忽略。SSR 输出可读的静态 DOM，浏览器增强不能产生水合差异。

文档骨架使用的局部示范纹理不等于上述完整缓存层已经交付。正式组件进入组件库前要有命中计数、内存预算和恢复测试证据。

## 7. 最小验收清单

- 320px、390px、768px、1280px 视口及短高度下无意外横向溢出，操作始终可达；200% 文字缩放不遮挡控件。
- 浅色、深色、跟随系统切换时文字与纹理同时更新；最终实际颜色满足内部对比度目标。
- 仅用键盘可完成每个交互，焦点可见，弹层关闭后回到触发器；纯图标有名称，DOM 不包含嵌套按钮。
- reduced-motion 与强制颜色下仍能判断状态、阅读与操作；纹理或持久存储失败时保留功能。
- 同参数与同 seed 重复绘制像素稳定，主题、尺寸、DPR 改变正确失效；重复渲染与往返页面命中缓存。
- 真实后台再恢复时内容与按钮不消失，未因此清空全部缓存；模拟测试不冒充真机验证。
- 手机触摸至少 44px，长英文、中文、loading 和错误内容不会导致布局跳动或控件重叠。
- Button 的视觉表面实测为 `32/36/44/48px`，文字实测为 `12/13/15/17px`；`xs/sm` 的原生命中盒仍至少 `44px`，图标方块、RTL、group 与 ButtonLink 原生锚点行为分别验证。
- 色彩页同时展示显式 scoped light/dark 两列；每个真实 pair 样片保留 `data-color-pair` 与 `data-color-theme`，由浏览器读取 canvas 下实际 paper/wash 像素并与 DOM foreground 复核。
- 示例可交互且诚实反映实现范围；复制、搜索、主题和导航等可见控件不能是无效装饰。

首版先验收一个 Button / IconButton 垂直样例，再扩展表单与弹层。构建成功、自动检查通过和用户视觉验收分别记录，不互相替代。

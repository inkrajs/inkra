# Input 与示例补齐

迁移说明：以下为当时的批次记录。组织拆分后，文档应用及消费者浏览器脚本归
`inkrajs/docs`；在独立文档仓运行 `npm run build`，不再使用旧 workspace 命令。

日期：2026-10-21。

## 本批范围

| 范围 | 交付 |
| --- | --- |
| Input | 首尾图标、文字前后缀、清空、值回调、加载、尾部操作、四种外观、宽度、对齐、插槽类名 |
| Input 文档 | 属性面板、实时源码、图标、前后缀、清空与表单重置、加载与复制、外观、尺寸、状态 |
| InputNumber | 原生数字编辑、空值、受控值、增减、小数步长、边界校验、清空与重置 |
| Slider | standard / inset、三尺寸、单值与范围、横纵、RTL、表单、键盘与拖动 |
| Icon | 独立组件入口与 PencilIcon API、12 个常用图标、尺寸/颜色/语义及 Tooltip |
| Textarea / Field | 行数、原生长度限制、表单重置；标签/描述/错误和状态继承 |
| Select | 单选与多选、受控展开、定位、RTL、必填校验、表单重置、分组、滚动、清空 |
| Popover / Overlay | 受控展开、定位、模态、关闭策略、初始焦点与返回、嵌套浮层 |
| 文档站自身 | 搜索框使用 Input；页级间距 20px；数值滑条使用 Slider；属性栏随预览行等高 |

这不是全组件库所有属性组合都已覆盖的声明。PasswordInput、InputGroup、自动补全和字素计数仍属后续工作。最新用户要求的数字输入已以 InputNumber 交付，不再属于原第二期排除项。

## 行为边界

- 用户最新反馈覆盖最初的默认描边方案：`variant="underline"` 为默认，`outline/soft/ghost` 显式可选。尾部操作 hover 复用 Tabs 的 selection 材质，下划线与描边分别处理分割线和铺色边界，铺色不能盖住输入边线。
- `startIcon/endIcon` 是装饰槽；需要交互的内容放 `endAction`。尾部操作共用输入外框，仅在逻辑起始侧绘制一道彩铅分割线，文档使用 ghost 按钮。
- `prefix/suffix` 不进入输入值与 FormData。重要单位通过 Field 的描述或可访问名称说明，不能只依赖视觉位置。
- `onChange` 保留原生编辑事件；`onValueChange(value, {reason})` 统一输入与清空。清空时先调用 `onValueChange('', {reason: 'clear'})`，再调用 `onClear`，不伪造 React ChangeEvent。受控使用者须在回调中更新 value。
- 非受控输入保持真实 DOM 值。原生表单 reset 的默认行为发生在 reset 事件之后，因此下一任务同步恢复值和清空状态；被取消的 reset 不修改状态。
- 清空时焦点回输入；空值、只读、禁用、IME 组合期间不可清空。基础 Input 不劫持 Escape，页头搜索保留自身 Escape 清空并关闭建议的行为。
- 显式 `loading={false}` 预留图标槽位，省略不占位；加载不会禁用输入。图标画布增大 2px，命中盒不缩小。
- `className/style/ref` 仍作用于原生 input；外层与各槽通过 `classNames` 定制。`fullWidth` 默认 true，以保留原布局。
- 普通外观聚焦继续强调彩铅轮廓；ghost 聚焦时显示同一外框，移出整个控件后隐藏。操作按钮保留独立键盘焦点提示。
- 极窄容器且插槽过多时允许在同一外框内重排，保留可编辑区域，不让装饰层覆盖输入或按钮。
- 描边模式的尾部铺色满宽满高，外轮廓绘在最上层；下划线模式内缩 4px 并使用短分割线。共享 Tabs 的绘入/擦除，不盖线、不增加第二个按钮框。
- Button 与 Tabs 共用斜向铺色几何，但 primary/secondary/destructive 各自保留语义配色；Button 和 Slider 的焦点轮廓使用彩铅，强制颜色时回退系统线框。
- Slider 的 inset 滑槽大于可见滑块，并在所有方向和端点包含滑块；InputNumber 使用原生 valueAsNumber/stepUp/stepDown，不实现自定义本地化解析或静默截断范围。
- Select 多选用数组值和同名隐藏表单字段，读取时使用 getAll；单项再次选择可移除，Clear 是独立按钮。Radix 特有的 Portal/Content.forceMount、Viewport.nonce、Content.updatePositionStrategy 仅适用于单选。多选外部关闭事件的 detail.originalEvent 可能是鼠标或触摸事件，而非 PointerEvent。
- Icon 页实际展示 PencilIcon，不宣称已有不存在的 strokeWidth API。颜色来自 style.color 或继承；颜色变化更新画布，不靠卸载再挂载。

## 验证入口

- `npm test`：包构建与组件测试，包含新增 Input SSR 契约及既有表单回归。
- `npm run build --workspace=@inkra-internal/docs`：文档类型检查及构建。
- `scripts/verify-input-props.mjs`：真实浏览器检查受控/非受控值、reset、IME、键盘、ref、RTL、加载、插槽与 ghost 焦点。
- `scripts/verify-input-demos.mjs`：Input/Textarea/Field 页面、实时源码、页头搜索、尾部操作及桌面/窄屏截图。
- `scripts/verify-form-demos.mjs`：Select、Popover、Overlay 交互。
- `scripts/verify-docs-spacing.mjs`：组件页、快速开始、设计规范的 20px 页级间距。
- `scripts/verify-input-number.mjs`：数字边界、小数、拒绝受控更新、数字草稿、只读/禁用、reset 和布局。
- `scripts/verify-slider.mjs`：两种外观、三尺寸、范围、RTL/横纵、端点包含、键盘/指针、FormData/reset。
- `scripts/verify-icon-demo.mjs`：不重挂载变色、语义、实时源码、图标目录、可交互按钮和 Tooltip。
- `scripts/verify-playground-feedback.mjs`：地图/表单属性栏等高、切换稳定、Button 铺色、Popover 返回焦点。
- `scripts/verify-multi-select.mjs` 与 `scripts/verify-select-multiple-demo.mjs`：多选核心与实际页面流程。

## 协作收口

协调者 `/root` 负责共享入口、样式汇总、文档路由/API/翻译、最终构建与集成检查。核心和示例任务按文件隔离写入，不操作旅行站、不提交推送或发布。

| 任务 | 状态 | 写入范围与产物 |
| --- | --- | --- |
| `/root/input_core` Input | 完成，已读取产物 | `form/`、InputActionContext、测试；`docs/input-core-handoff.md` |
| `/root/input_docs` Input demos | 完成，已集成验证 | InputExamples、Textarea/Field；`docs/input-demos-handoff.md` |
| `/root/other_demos` 表单示例 | 完成，已集成验证 | Select/Popover/Overlay examples；`docs/form-demos-handoff.md` |
| `/root/input_docs` InputNumber | 完成，已读取产物与浏览器证据 | `input-number/`、examples/tests；`docs/input-number-handoff.md` |
| `/root/input_docs` Icon | 完成，已集成验证 | IconExamples、iconPaths helper；`docs/icon-demos-handoff.md` |
| `/root/other_demos` Slider | 完成，已读取产物与浏览器证据 | `slider/`、examples/tests；`docs/slider-handoff.md` |
| `/root/input_core` Select 多选 | 完成，已读取产物与浏览器证据 | `select/`、tests、浏览器 fixture；`docs/select-multiple-handoff.md`；父组件 reset 重渲染边界已通过回归 |

本地浏览器使用独立 Chromium，1305px / 390px；不更改用户浏览器模拟设置。构建的现有 use-client / chunk 体积警告保留。回滚边界为各任务列出的局部改动，不覆盖用户原有文件。无新的长期 memory 候选，稳定规则已归入 `docs/design-standard.md`。

浏览器脚本访问运行中的 `http://127.0.0.1:4180`；可用 `PLAYWRIGHT_MODULE` 指定已有 Playwright 模块路径。自动化和本地截图不等同于用户视觉验收或真实设备验收。

## 最终检查点

2026-10-21：所有本批协作任务已完成并释放文件写入范围，交接产物已读取。最后一个任务完成后重新执行 `npm test`，112/112 通过；文档构建通过，日志分别为 `/tmp/inkra-tests-final.log` 与 `/tmp/inkra-docs-final-build.log`。上列浏览器脚本在 1305px / 390px 的对应场景通过，包含实际多选页面提交与父组件重渲染后的 reset。Icon 路由本地 HTTP 200，预览服务保持运行。未提交、发布或部署。

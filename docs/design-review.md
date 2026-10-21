# Inkra v0.1 设计复核

日期：2026-10-20。结论：此前“系统无衬线 + 白纸 + 森林绿实底”的规范没有忠实复现原新西兰站，现已撤销。v0.1 应以 Adventure Map 的字体、ocean 主题、纸纹、C 版文字颜料、多 pass 描边和露纸 wash 为视觉基线。

## 复核结论

- 默认浅色取原站 ocean：纸面 `#f4f0e3`、正文墨 `#293d33`、action wash `#4b96aa`、FR7 action 文字 `#173b45`、quiet wash `#78a9b3`；主操作不是绿色实心块。
- 深色取 `AdventureAppearance.css`：纸面 `#1b1b17`、正文 `#e5e2cf`、次要文字 `#b6b39d`、action wash `#78b8c8`、焦点 `#e4d99e`、错误 `#ffb6a8`。
- `PencilSurface` 使用真实纸张纹理、稳定三遍或两遍轮廓和露纸彩铅铺色；不接受规则虚线、等距斜纹、纯色矩形叠噪点或每帧随机抖动。
- `PencilText` 的 C 版参数固定为 `variation=.52, breaks=.18, outline=.96, fill=.34, grain=.45`。DOM 语义必须存在，但允许绘制成功后由 pigment canvas 接管视觉；失败、重绘待定、强制颜色和打印时必须恢复可见 DOM 字形。
- 选中 tab 必须成对使用 `selection-pigment` 与 `selection-foreground`：pigment 保持浅色 `#769566`、深色 `#c6b873`；FR7 foreground 调整为浅色 `#173b2b`、深色 `#fffbe8`。pigment 只通过半透明露纸 wash 绘制，不能作为不透明背景色参与对比计算；实际 wash 强度以最终可读性为上限。
- FR6 增加 ocean `50..950`、warm neutral `50..950`、paper/surface/surface-muted 层级，以及 success/warning/danger/info 的 pigment/foreground 成对 token。浅深主题语义值独立选择，未机械反相。
- 所有纹理继续使用稳定 seed、尺寸、主题、解析颜色、DPR 和算法版本作为缓存输入；后台恢复不能全清可靠缓存。

## 源文件映射

以下路径均相对 Inkra 仓库根，供文档站和组件提炼任务只读对照：

| 内容 | 相对源路径 |
| --- | --- |
| 字体定义 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/adventure.css` |
| 字体栈与 glyph pigment | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil/label.js` |
| DOM 文字增强 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil/PencilText.jsx` |
| DOM 文字显示与 fallback | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil-map.css` |
| C 版文字参数与地图色板 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil/palette.js` |
| 多 pass 描边 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil/stroke.js` |
| 露纸 wash | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil/wash.js` |
| 纸纹 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil/paper.js` |
| Surface 变体参数 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/pencil/PencilSurface.jsx` |
| ocean/fern/sunset 原主题 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/AdventureMenu.css` |
| light/dark 映射 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/AdventureAppearance.css` |
| 选中 tab wash 参数与绘制 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/AdventureCalendar.jsx` |
| 选中 tab 颜色与浅色前景 | `../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/AdventureCalendar.css` |

## Selection 对比校验

- FR7 前景调整后，浅色为 `#173b2b`，深色为 `#fffbe8`；pigment 仍分别为 `#769566` 与 `#c6b873`。纸面静态比值更高，但不能替代最终纹理采样。
- 调整前真实 canvas 采样确认深色 selection 失败：文字覆盖区 `min 1.88:1 / p5 2.57:1`。历史 `strength .48` 已废止，最终浅/深强度为 `.22/.14`。
- `paintSelectedTab` 的共同参数为 `spacing 1.8 / roughness 3.5 / inset 2 / radius 8`，没有 border、独立纸底或 `edgeReach`。
- coordinator 对最终输出中央区域的 canvas + paper 合成背景使用 opaque foreground 重采样：浅色 selection `min 5.960:1`，深色 selection `min 6.292:1`。该方法验证当前区域的背景配对，不覆盖字体抗锯齿边缘像素；禁止改写成全面视觉认证。

## Button FR5 复核

- 依据 `docs/delivery-status.md` 的 “Button refinement against shadcn”。只借用 shadcn 官方 Button 文档的示例组织与 API 覆盖思路，不复制其 Tailwind 材质、`rounded-full` 或依赖栈。
- 尺寸合同为 `xs/sm/md/lg = 32/36/44/48px` 彩铅视觉表面与 `12/13/15/17px` 字体；原生交互盒始终至少 `44px`。此前 `sm 36px` 被 `min-height 44px` 覆盖，是尺寸看起来相同的已确认根因。
- 新增 token 仅为 `control-xs: 32px` 与 `icon-xs: 14px`；既有 `control-sm/md/lg: 36/44/48px`、`text-xs/sm/md/lg: 12/13/15/17px`、`icon-sm/md/lg: 16/20/24px` 保持不变。
- 六变体固定为 `primary|secondary|outline|ghost|destructive|link`：primary action wash、secondary 更淡 quiet wash、outline 无 wash、ghost 无常驻边框、destructive 使用 `danger` 前景与 `danger-soft #d49b8b` 的 `.18` wash、link 保留可见下划线。selection tab 合同没有修改或复用。
- destructive 的保守平面合成校验为：浅色 `#873e36` 对 `#d49b8b` 以 `.18` 混合到 `#f4f0e3` 后的 `#eee1d3`，`5.90:1`；深色 `#ffb6a8` 对同 pigment 混合到 `#1b1b17` 后的 `#3c322c`，`7.42:1`。真实 wash 非均匀且露纸，集成仍须采样最终像素。
- 尺寸 API 固定为 `xs|sm|md|lg|icon-xs|icon-sm|icon|icon-lg`；支持 `startIcon` / `endIcon`、原生锚点 `ButtonLink`、有可访问名称的 `ButtonGroup`、horizontal/vertical 与 RTL 逻辑间距。FR5 不加入 `asChild`。
- 本任务只定义 token 与设计合同。package 路由负责原生命中盒/视觉表面分离、组件 API 和测试；docs 路由负责分组示例、实际尺寸标签、链接、loading、图标和 RTL 展示。

## Color System FR6 复核

- Ocean 原始色阶为 `#eef7f8` 至 `#172f36`，保持 `accent #4b96aa`、`accent-soft #78a9b3`、`accent-strong #305e6b` 三个锚点；warm neutral 色阶覆盖 `surface #fdfcf8`、`paper #f4f0e3`、浅色 `surface-muted #f2ead7`、深色 `surface #292920` 与 `paper #1b1b17`。
- FR7 将浅色 `ink-muted` 收深为 `#465e4b`，因为真实 muted surface 采样最低只有 `4.43:1`；将浅色 `on-accent/info-foreground` 收深为 `#173b45`、`success-foreground` 收深为 `#21472f`。深色 `ink-subtle #9c9a88` 与 `ink-muted #b6b39d` 分层。
- 调整前真实 canvas 采样失败数据为：light action `min 2.53 / p5 2.98`，dark action `1.92 / 2.50`，light success `3.41 / 4.05`，light info `3.39 / 4.18`，dark selection `1.88 / 2.57`，dark status 最低约 `3:1`。这些才是 FR7 修复依据；paper-only ratio 不是 PASS。
- package 最终将 action 浅/深 wash 限制为 `.20/.12`、quiet 为 `.12/.08`、selection 为 `.22/.14`；旧 exact 密度合同废止。本路由没有修改 renderer。
- 新 `ColorSystem` 同时渲染显式 `data-inkra-theme="light"` 与 `"dark"` 两列；scope 自己声明 `color-scheme`、paper 背景与 ink 前景，让 `PencilSurface` 的 computed style、canvas 和 DOM 处于同一主题。action、quiet、selection 与四个 status 全部使用真实 `PencilSurface`，status 通过 inline `--inkra-accent-soft` / `--inkra-border-strong` 覆盖消费 paired token。
- 每个真实 paper/action/status 样片带稳定 `data-color-pair` 与 `data-color-theme`。usage matrix 明确记录 foreground + paper + wash input；raw scale 才使用小型不透明色块，并按色值自动选择黑/白标签。
- 最新 coordinator 证据使用 `/tmp/inkra-contrast.mjs` 对当前 30 项 pair 的中央区域合成像素采样，全部 `min >= 4.5:1`：light action `6.012`、selection `5.960`、success `5.709`、info `6.625`、muted-paper `5.087`；dark action `6.621`、selection `6.292`。当前最低为 light text-subtle `4.525`，该项是 opaque paper、无 canvas。foreground 按 opaque 色参与计算，因此结果不代表字体抗锯齿像素全面认证。

## 字体资产与许可证交接

- 字体源：`../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/assets/ui-hand-yozai.woff2`
- 文件证据：`169388 bytes`；SHA-256 `e0b476f1784e0e079ded04dce9173d516c294b9dcc04bc2cb73e6b06efd2a70d`。
- 来源说明：`../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/assets/README.md` 记录该文件是 **Yozai Light v0.868** 的 706 字符 web 子集，原始来源为 `lxgw/yozai-font` 的 `Yozai-Light.ttf`；修改版内部家族名为 `Trip Map Hand`，未覆盖字符回退平台楷体。
- 许可证证据：`../../../../2026-09-25/wo/work/new-zealand-slow-trip-2026/src/adventure/assets/Yozai-OFL.txt`，SIL Open Font License 1.1。文件列出 Copyright 2020, 2024 LXGW 与 Y.Oz，并说明 “Yozai”“悠哉”及含 “Y.Oz”/“YOz” 的名称限制；重新分发字体时必须随附版权和 OFL 文本，修改版不能使用保留名称。
- 文档站任务负责复制字体与许可证、声明 `@font-face` 并保留 attribution；本任务不复制资产。建议目标仍使用内部名 `Trip Map Hand`，不要把修改子集重新命名为保留名称。

## 未越界事项

本次只修订设计规范、评审、token，并新增未挂载的 `ColorSystem` 文档组件及其独立样式；没有改原旅行站、`App.tsx`、文档站全局样式、package 组件实现、字体资产、构建脚本或发布配置。字体实际加载、PencilText fallback、Surface 像素效果、样片挂载和浅深主题浏览器采样仍须由 coordinator 验证，不能以本评审代替视觉验收。

## RouteSpecHandoff

- `routeTaskRef`: `01a15812-fad7-7183-8060-3b9199dbc230`
- `taskRef`: `01a15812-fad7-7183-8060-3b9199dbc230`
- `coordinatorRef`: `01a0f171-adec-7822-9ec3-dbb080ef923e`
- `requirementRef`: `FR5/FR6/FR7`
- `basis`: 原新西兰站彩铅实现、`docs/delivery-status.md` 的 FR4/FR5/FR6/FR7 协调合同、真实浏览器 canvas 像素采样，以及 Adventure Map 的字体、主题、`PencilText`、`PencilSurface`、stroke、wash、paper、mapLabels 与 `AdventureCalendar.paintSelectedTab` 源实现及 OFL 许可证证据。
- `artifacts`: `docs/design-standard.md`、`docs/design-review.md`、`packages/inkra/src/tokens.css`、`apps/docs/src/components/ColorSystem.tsx`、`apps/docs/src/components/ColorSystem.css`。
- `verificationLimits`: 已核对 FR5/FR6/FR7 token 与规范映射，并记录调整前真实 canvas 失败数据；本路由只加深/提亮语义前景及完善 ColorSystem，没有修改 renderer、`App.tsx` 或全局 docs 样式。当前不能报告 action/status/selection 对比通过；必须等待 package 的主题 wash/文字衬层修复，再由 coordinator 在 root build 后重采样真实 canvas 合成背景与 DOM 文字。未部署或发布。
- `completedAt`: `2026-10-20 16:08:09 +0800`
- `coordinatorContinuationRequired`: `true`
- `coordinatorMayComplete`: `false`

## Coordinator Evidence Override

- 覆盖时间：`2026-10-20 16:13:00 +0800`。本节为最新 coordinator 证据，覆盖上方 RouteSpecHandoff 中“仍待 package 修复及重采样”的旧状态描述；调整前失败数据继续保留为回归依据。
- package 最终 wash 强度为 action 浅/深 `.20/.12`、quiet `.12/.08`、selection `.22/.14`，旧 exact 密度合同已废止。
- `/tmp/inkra-contrast.mjs` 对当前 30 项 pair 的中央区域纸面与 canvas 合成像素使用 opaque foreground 采样，全部 `min >= 4.5:1`。代表值：light action `6.012`、selection `5.960`、success `5.709`、info `6.625`、muted-paper `5.087`；dark action `6.621`、selection `6.292`。最低项为 light text-subtle `4.525`，该项是 opaque paper、无 canvas。
- 最新状态：当前采样方法覆盖的 30 项 pair 均达到 `4.5:1`；foreground 以 opaque 色参与计算，因此该结果不代表字体抗锯齿边缘像素的全面认证。root build 已通过，最终浏览器验收与总任务收口仍由 coordinator 负责。
- `completedAt`: `2026-10-20 16:13:00 +0800`
- `coordinatorContinuationRequired`: `true`
- `coordinatorMayComplete`: `false`

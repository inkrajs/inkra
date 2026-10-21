# Phase 2 Selection Refinement

状态：实现与本地验证完成。Tabs 不在本路由范围。

## API 草案

### Switch 几何

```tsx
<Switch label="通知" defaultChecked />
```

- 轨道视觉尺寸固定为 `52×32px`，左右内距各 `4px`，圆点 `24×24px`。
- 关闭态圆点贴合逻辑起始侧，不居中；开启态移动 `20px` 到逻辑结束侧，不越出轨道。
- RTL 自动反转起止方向；原生 checkbox、`role="switch"`、表单与 reset 语义不变。

### RadioGroup 展现形式

```tsx
<RadioGroup
  name="theme"
  defaultValue="graphite"
  variant="segmented"
  orientation="horizontal"
  label="主题"
>
  <RadioGroupItem value="graphite" label="玄墨" icon={<ThemeIcon />} />
  <RadioGroupItem value="ocean" label="沧浪" icon={<ThemeIcon />} />
</RadioGroup>
```

- `variant="radio" | "segmented"`，默认 `radio`。普通模式保持圆环 + 圆点；segmented 模式使用真实 `PencilSurface`，选中项为 selection wash，未选项为安静 outline。
- `orientation="horizontal" | "vertical"`，默认 `vertical`。属性只控制布局并输出 `data-orientation`；不在原生 fieldset 上添加多余 ARIA role/orientation。原生同名 radio 继续负责方向键、Tab、Space、表单提交和 reset。
- `RadioGroupItem` 新增 `icon?: ReactNode`。图标是 label 的可见组成部分但标记为装饰，accessible name 仍由稳定 label ID 提供。
- Group/item disabled、Group required、受控/非受控 value 与显式 ARIA 名称优先级保持 Phase 1 合同。

## 集成边界

- 主聊天负责文档示例、公共导出、CSS 聚合和最终 build/test。
- 本路由只修改 `packages/inkra/src/selection/**`、`packages/inkra/test/selection.test.mjs`、`scripts/verify-selection.mjs` 与本文件。
- 本路由不运行会清理 `dist` 的 build/test。

## 实现文件

- `packages/inkra/src/selection/Switch.tsx`：圆点路径扩大为接近填满 `24px` canvas；保留原生 checkbox、`role="switch"`、受控/非受控、form/reset 和 accessible-name 合同。
- `packages/inkra/src/selection/RadioGroup.tsx`：新增 `RadioGroupVariant = "radio" | "segmented"`、`RadioGroupOrientation = "horizontal" | "vertical"` 与 `RadioGroupItem.icon`。segmented 仍输出原生同名 radio，视觉层使用 `PencilSurface variant="selection|outline"`。
- `packages/inkra/src/selection/selection.css`：Switch 固定 `52×32px` 轨道、`24px` 圆点、`4px` 两侧内距和 `20px` 行程；RTL 反向。新增 segmented 横/纵布局、图标槽、选中前景、focus 与 forced-colors fallback。
- `packages/inkra/test/selection.test.mjs`：新增 segmented SSR/API、orientation、icon、selection/outline surface 与 Switch 几何源码合同。
- `scripts/verify-selection.mjs`：使用旧旅行站 Playwright，验证真实 Switch 几何与圆点 alpha 着色范围、docs `example-theme` 示例，以及独立 segmented fixture 的键盘、FormData、reset、disabled、canvas 与 accessible label。

## 验证证据

- `npm run typecheck --workspace=inkra`：通过。
- `node --check packages/inkra/test/selection.test.mjs`：通过。
- `node --check scripts/verify-selection.mjs`：通过。
- `node scripts/verify-selection.mjs`：通过。
  - Switch：真实 `52×32px` 轨道、`24×24px` canvas、逻辑两端内距稳定、LTR/RTL 开启位置正确。
  - 所有可见 Switch 圆点均读取 canvas alpha 像素边界并换算 CSS 尺寸，实际着色范围至少 `18×18px`；覆盖主预览、右侧属性和状态样例，不只检查 bounding box。
  - docs 中 `name="example-theme"` 的 segmented 示例：3 个原生 radio，水平布局，ArrowRight 正确切换且只有一个 selection surface。
  - 独立 fixture：原生方向键、FormData 值、form reset 恢复初值、disabled、selection canvas 与 accessible label 通过。
- 截图：`/tmp/inkra-phase2-switch.png`、`/tmp/inkra-phase2-radio-segmented.png`。人工复核未见圆点裁切或 segmented 文字重叠。

## 限制与集成说明

- 按协调约束未运行 package build/test，避免清空 `dist`；主聊天负责最终公共导出、CSS 聚合和完整 build/test。
- 浏览器 fixture 通过 Vite `/@fs/` 直接加载源码，只用于本地集成验证，不进入发布包。
- segmented 不添加自定义 radio role 或 roving tabindex；方向键、Tab、Space、disabled、表单和 reset 由原生 radio 保证。
- 构建成功与脚本通过不替代用户视觉验收；最终 docs 页面布局和移动端展示由 coordinator 收口。

## Latest Segmented Layout Override

- 用户截图反馈 horizontal segmented 在桌面出现第一行 2 项、第二行 1 项。本轮将 horizontal items 固定为 `flex-wrap: nowrap`，每项 `flex: 0 0 auto` 与自然内容宽度；长标签不缩字号、不挤压，窄屏仅 items 容器 `overflow-x: auto`，不产生全页横向溢出。
- 选中背景不再通过 `variant` 条件切换而卸载/重画。每项常驻 outline 与 selection 两个稳定 `PencilSurface` canvas，以 `motion-normal` opacity 交叉淡入；文字和原生 radio 始终保留。`prefers-reduced-motion: reduce` 将表面 transition duration 归零。
- Playwright 实测 docs `name="example-theme"`：在 `1302 / 390 / 320px` 三个视口中三项 y 坐标一致，未换行；页面 `scrollWidth <= innerWidth`，窄屏超宽只发生在 `.inkra-radio-group__items` 局部滚动。标签 source 保持在各自 segment 内容盒内。
- 动画实测：切换后中间帧旧/新 selection surface opacity 均位于 `0..1`，结束态分别为 `0/1`；reduced-motion 下两层 computed `transition-property` 均为 `none`。
- 截图：`/tmp/inkra-phase2-radio-segmented-1302.png`、`/tmp/inkra-phase2-radio-segmented-390.png`、`/tmp/inkra-phase2-radio-segmented-320.png`。

## RouteSpecHandoff

- `routeTaskRef`: `01a15812-fad7-7183-8060-3b9199dbc230`
- `coordinatorRef`: `01a0f171-adec-7822-9ec3-dbb080ef923e`
- `artifacts`: `packages/inkra/src/selection/**`、`packages/inkra/test/selection.test.mjs`、`scripts/verify-selection.mjs`、`docs/phase2-selection.md`
- `completedAt`: `2026-10-20 23:24:43 +0800`
- `coordinatorContinuationRequired`: `true`
- `coordinatorMayComplete`: `false`

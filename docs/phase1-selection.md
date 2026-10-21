# Phase 1 Selection Controls

状态：Checkbox、RadioGroup、Switch 已在 `packages/inkra/src/selection/` 实现。Tabs 不在本轮范围。

## API 草案

### Checkbox

```tsx
<Checkbox
  name="updates"
  value="product"
  defaultChecked
  indeterminate={false}
  label="产品更新"
  description="每月最多两封邮件"
  onCheckedChange={(checked) => {}}
/>
```

- 输出原生 `input[type="checkbox"]`，透传原生表单、ARIA、事件与 `ref` 属性。
- `checked` / `defaultChecked` 沿用 React 原生受控和非受控语义；`onCheckedChange(boolean)` 是原生 `onChange` 之外的便利回调。
- `indeterminate` 同步到 input DOM property，并通过 `aria-checked="mixed"` 暴露半选状态。
- label、description 与 input 正确关联；整个标签行至少 `44px` 高。禁用状态由原生 `disabled` 管理。

### RadioGroup

```tsx
<RadioGroup
  name="delivery"
  defaultValue="standard"
  required
  label="配送方式"
  description="选择一项"
  onValueChange={(value) => {}}
>
  <RadioGroupItem value="standard" label="标准配送" />
  <RadioGroupItem value="express" label="快速配送" description="需要额外费用" />
</RadioGroup>
```

- group 输出 `fieldset` / `legend`，item 输出原生 `input[type="radio"]`。
- `name` 由 group 统一提供；`value` / `defaultValue` 支持受控和非受控选择，`onValueChange(value)` 在原生 change 后触发。Group 级 `required` 传给每个同名原生 radio。
- 原生同名 radio 保留方向键、表单提交和 form reset 行为。item 可单独 `disabled`。

### Switch

```tsx
<Switch
  name="notifications"
  defaultChecked
  label="通知"
  description="允许桌面提醒"
  onCheckedChange={(checked) => {}}
/>
```

- 输出原生 `input[type="checkbox"][role="switch"]`，保留 Space、表单提交与 reset。
- `checked` / `defaultChecked` 与 `onCheckedChange(boolean)` 规则和 Checkbox 一致。
- 标签行至少 `44px` 高；轨道、边界和滑块由彩铅表面绘制，不用普通实线或 emoji。

## 集成边界

- 主聊天负责从 `index.ts` 导出组件、在全局 `styles.css` 聚合 `selection.css`，并把独立 CSS 加入 copy-styles。
- 本路由不修改 tokens、全局 styles、index、package metadata、lockfile、renderer 或文档路由。

## 实现证据

- `Checkbox.tsx`：原生 checkbox、受控/非受控、半选 DOM property + `aria-checked="mixed"`、label/description、disabled、`onCheckedChange`、form reset 视觉同步。
- `RadioGroup.tsx`：`fieldset` / `legend` + 原生同名 radio；受控/非受控 value、首次 `defaultValue` 冻结作为 reset 基线、Group 级 `required`、item disabled、`onValueChange`。
- `Switch.tsx`：原生 checkbox + `role="switch"`、受控/非受控、label/description、disabled、form reset、LTR/RTL 滑块方向。
- `selection.css`：标签行以 `--inkra-touch-target` 保证至少 44px；透明原生 input 覆盖完整命中区；focus-visible 使用现有 focus token；forced-colors 显示原生 input 并隐藏 canvas 装饰。
- Checkbox 勾选/半选、Radio 圆环/圆点、Switch 轨道/滑块均消费 `PencilSurface` 或 `PencilIcon`，未使用普通实线边框、SVG 或 emoji。

## 验证证据

- `npm run typecheck --workspace=inkra`：通过。
- `node --check packages/inkra/test/selection.test.mjs`：通过。
- 静态契约检查：CSS 花括号平衡；44px 命中、forced-colors fallback、Switch RTL 规则和三类原生 input 均存在。
- 浏览器 ariaSnapshot 回归修复：Checkbox、Switch、RadioGroupItem 的可见 label span 具有稳定 ID；未提供显式名称时 input 通过 `aria-labelledby` 只引用该 label，description 只进入 `aria-describedby`。用户显式 `aria-label` 或 `aria-labelledby` 优先，不被自动关联覆盖。对应 SSR 测试已加入 `selection.test.mjs`。
- 未运行 `npm test` 或 package build，因为主聊天明确禁止本路由执行会清空 `dist` 的命令。`selection.test.mjs` 已写好，待主聊天完成 `index.ts` 导出、CSS 聚合和 copy-styles 后运行。

## 主聊天集成

1. 在 `packages/inkra/src/index.ts` 导出 `Checkbox`、`RadioGroup`、`RadioGroupItem`、`Switch` 及对应 props；可从 `./selection/index.js` 聚合。
2. 在 `packages/inkra/src/styles.css` 引入 `./selection/selection.css`，并确保 copy-styles 将该文件复制到 `dist/selection/selection.css`，或按现有策略内联到发布 CSS。
3. 集成后运行 package build/test；`packages/inkra/test/selection.test.mjs` 从最终 `dist/index.js` 验证公共 API，因此导出前不会单独执行。
4. 浏览器复核 form submit/reset、键盘 Space/方向键、半选、disabled、forced-colors、RTL 和 44px 命中区；构建通过不替代视觉验收。

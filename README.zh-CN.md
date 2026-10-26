<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/inkra-dark.png">
    <img src="./assets/inkra.png" alt="Inkra 铅笔标志" width="96" height="96">
  </picture>
</p>

<p align="center"><a href="./README.md">English</a> | 简体中文</p>

<h1 align="center">Inkra</h1>

<p align="center">像画画一样搭建你的界面。</p>

<p align="center">
  <a href="https://inkrajs.github.io/">在线体验</a> ·
  <a href="https://inkrajs.github.io/docs/getting-started">使用文档</a> ·
  <a href="https://www.npmjs.com/package/@inkra/react">npm</a> ·
  <a href="https://github.com/inkrajs/inkra/releases">版本发布</a>
</p>

一个彩铅风格的 React 组件库。把熟悉的控件搭在一起，添上纸面、轻轻的铺色和手绘线条。
输入、文字选择与键盘交互，仍然交给真实的 HTML。

## 开始使用

在你的 React 项目中安装：

```sh
npm install @inkra/react
```

引入一次样式，就可以开始搭建：

```tsx
import '@inkra/react/styles.css';
import { Button, Field, Input } from '@inkra/react';

export function NoteForm() {
  return (
    <form onSubmit={event => event.preventDefault()}>
      <Field label="给灵感起个名字">
        <Input name="title" placeholder="记下一点值得留下的事" clearable />
      </Field>
      <Button type="submit">存下一点灵感</Button>
    </form>
  );
}
```

Inkra 提供 ESM、TypeScript 声明和 CSS，React 与 React DOM 作为 peer dependencies。
发布验证覆盖 React 18 和 19；SSR 与特定框架的支持边界见[渲染说明](./docs/rendering.md)。

## 一点手绘感，真正的组件

<p align="center">
  <a href="https://inkrajs.github.io/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-dark.png">
      <img src="./assets/preview-light.png" alt="Inkra 实际运行界面，展示项目表单、日历和行程地图" width="1100">
    </picture>
  </a>
</p>

*截图来自开发中的真实文档站。npm 已发布版本与 main 分支的功能可能不同。*

- **操作还是熟悉的操作。** 表单、菜单、弹层与导航保留原生语义，交互建立在成熟组件基础上。
- **笔迹有性格，也有分寸。** 相同 seed 保持稳定的笔迹，装饰画布不控制布局，也不拦截输入。
- **留点空间给你的配色。** 用 CSS tokens 调整颜色、纸面、文字、描边和涂色，浅色与深色共用同一套组件。
- **示例不只用来看。** 在中英文文档站调参数、看代码，试试表单、日历与地图怎样搭配。

## 找到你需要的组件

已发布的 **0.9.0** 包包含以下基础组件：

| 用途 | 组件 |
| --- | --- |
| 操作 | Button、ButtonLink、ButtonGroup |
| 表单输入 | Field、Input、InputNumber、Textarea、Select、Checkbox、RadioGroup、Switch、Slider |
| 导航 | Tabs、Breadcrumb、DropdownMenu |
| 内容与反馈 | Card、Table、Accordion、Avatar、Badge、Alert、Progress、Skeleton、Separator |
| 弹层 | Popover、Overlay、Tooltip |
| 日期与地图 | Calendar、DayAgenda、JourneyMap |
| 绘制原语 | PencilIcon、PencilText、PencilSurface、PencilLine |

**0.2.0 新增：** 扩展表单、弹层和布局组件，新增 AudioPlayer、Carousel、ImageViewer、
ImageCropper 等媒体组件，NodeGraph、Sortable、PanZoom 等交互组件，以及 Log、Radar、
Heatmap、Sparkline、VirtualList 等数据展示组件，并支持环形 Progress。

**0.3.0 新增：** NumberTicker 精确支持 bigint 与数字字符串，可配置单位换算和舍入；
InputNumber 支持组合键步进与长按连续调整，并改进弹层动画、密码示例、多语言和可折叠属性面板。

**0.4.3 新增：** 与主题一致的 Markdown、ColorSwatch 和渐变色编辑，Editable 内置
文本与选择器编辑模式，全屏图片与视频查看、Tabs 溢出操作、独立 Toast 队列和更多图标笔触参数。
改进渲染与文档性能，精简首屏示例，并提供九宫格图标的尺寸、笔压和断裂预览。

**0.5.0 新增：** 五种组件语言、类型化字典覆盖与嵌套 InkraProvider，
以及支持局部主题、配色、文字、线条和涂色定制的 ThemeProvider。
文档新增对应的交互示例和五语言导航，参考文档翻译仍为部分覆盖。

**0.6.0 新增：** 默认下划线面包屑、前后图标、下拉菜单与右键菜单组合，
修正 Select.Stepper 操作按钮对齐。文档扩展可调整尺寸和折叠的布局组合，
并保持页头面包屑对齐稳定。

**0.8.0 新增：** 共享页头与侧栏对齐列、移动端边缘手势、可调整行列和看板布局的 Grid、
异形物品放置 InventoryGrid、分页配置，以及按正文行数增长的 Textarea 自动高度。
本版包含未发布的 0.7.0 候选，已发布到 npm 并通过 React 18 和 19 的正式安装验证。
文档统一了示例锚点与复合组件 API 分组，采用可调整侧栏的布局和紧凑的移动搜索。

**0.9.0 新增：** Guide、全屏 Loading 布局、四向 InfiniteScroll、Masonry、
NumberTicker 数字滚动，以及支持填充和自定义配色的 PencilIcon。
文档包含 47 个简洁彩色图标预设。正式包已通过 React 18 和 19 的公开安装验证。

详见[版本发布](https://github.com/inkrajs/inkra/releases)。
完整范围与已知限制见[更新日志](./CHANGELOG.md)和[组件 API](./packages/inkra/README.md)。

## Textarea 行数与自动高度

显式 `rows={1}` 从一行正文开始；开启 `autoSize` 后按真实换行增长，
超过 `maxRows` 时在正文内部滚动，删除内容后收缩：

```tsx
import { Textarea } from '@inkra/react/form';

<Textarea rows={1} aria-label="单行初始高度" />
<Textarea autoSize={{ minRows: 1, maxRows: 6 }} aria-label="笔记" />
```

`autoSize` 默认关闭，也可传 `true`；`minRows` 依次取显式配置、`rows`、1，
不传 `maxRows` 则不限增长。行数必须为正安全整数，非法值回退默认值，
小于最小行数的上限按最小行数处理。行数包含容器内软换行；计数区另外占位。
自动高度优先于手动 `resize` 和内联高度，跟随受控值、表单重置、容器宽度及字体变化。
不传 `rows` 且不开启自动高度时保留既有默认尺寸。SSR 先按原生行数呈现，
水合后测量内容。完整约定见[组件 API](./packages/inkra/README.md#form-controls-and-select)。

## 一起开发 Inkra

需要 Node.js 22.12+ 和 npm：

```sh
git clone https://github.com/inkrajs/inkra.git
cd inkra
npm ci
npm run build
npm run check
```

检查覆盖仓库、组件测试，以及独立安装包的类型、SSR 和资源。
运行 `npm run check:installed -- --browser` 可追加浏览器水合检查。

文档站在独立的 [inkrajs/docs](https://github.com/inkrajs/docs) 仓库维护。
预览组件库的本地修改时，按该仓库的说明准备候选包；文档站安装经过校验的归档，
不直接引用源码。网站部署与 npm 发版是两条独立流程。

## 文档与反馈

- [快速开始](https://inkrajs.github.io/docs/getting-started)
- [组件 API](./packages/inkra/README.md)
- [设计规范](./docs/design-standard.md)
- [贡献指南](./CONTRIBUTING.md)
- [问题与功能建议](https://github.com/inkrajs/inkra/issues)
- [发版说明](./docs/releasing.md)与[仓库分工](./docs/organization-structure.md)

安全问题请按 [SECURITY.md](./SECURITY.md) 私下报告，不要提交公开 Issue。

## 许可

Inkra 使用 [MIT 许可](./LICENSE)。附带字体使用 SIL OFL 1.1，其他资源保留各自许可，
详见[第三方声明](./packages/inkra/THIRD_PARTY_NOTICES.md)。

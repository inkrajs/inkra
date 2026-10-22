<p align="center">
  <img src="./assets/inkra.png" alt="Inkra 铅笔标志" width="96">
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

已发布的 **0.1.0** 包包含：

| 用途 | 组件 |
| --- | --- |
| 操作 | Button、ButtonLink、ButtonGroup |
| 表单输入 | Field、Input、InputNumber、Textarea、Select、Checkbox、RadioGroup、Switch、Slider |
| 导航 | Tabs、Breadcrumb、DropdownMenu |
| 内容与反馈 | Card、Table、Accordion、Avatar、Badge、Alert、Progress、Skeleton、Separator |
| 弹层 | Popover、Overlay、Tooltip |
| 日期与地图 | Calendar、DayAgenda、JourneyMap |
| 绘制原语 | PencilIcon、PencilText、PencilSurface、PencilLine |

**下一版，已在源码中提供：** Toast、AlertDialog、Drawer、DatePicker、TimePicker、
Pagination、Empty、ToggleGroup、Command、Upload、DataTable、Tree、Steps 和 Timeline。
这批组件及扩展后的渲染参数尚未包含在 npm 0.1.0 中。
具体范围与限制见[更新日志](./CHANGELOG.md)和[组件 API](./packages/inkra/README.md)。

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

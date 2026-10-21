<p align="center"><img src="assets/inkra.png" alt="Inkra 铅笔标志" width="80"></p>

# Inkra

[English](README.md) · [组件 API](packages/inkra/README.md) · [贡献指南](CONTRIBUTING.md)

保留原生语义的彩铅风格 React 组件库，提供稳定笔迹、纸面材质和可交互的文档示例。

**发布状态：正在准备首个 `0.1.0`。** 当前包版本仍是 `0.0.1-alpha.0`，仓库建立不代表 npm 已发布。正式发布前通过本地候选包试用。网站发布由 inkrajs.github.io 仓库负责，与 npm 发版独立。

## 组件范围

| 类别 | 组件 |
| --- | --- |
| 操作与浮层 | Button、ButtonLink、ButtonGroup、Popover、Overlay、Tooltip、DropdownMenu |
| 表单 | Field、Input、InputNumber、Textarea、Checkbox、RadioGroup、Switch、Select、Slider |
| 内容与反馈 | Tabs、Accordion、Badge、Separator、Skeleton、Progress、Alert、Avatar、Card、Table |
| 旅行与日程 | Calendar、DayAgenda、JourneyMap |
| 绘制原语 | PencilIcon、PencilText、PencilSurface、PencilLine 和公共 tokens |

Select 支持单选、多选以及独立的搜索选择接口。PencilIcon 接收图形路径；文档里的可搜索 Lucide 图标目录是示例应用，不是另一套已导出的图标包。

真实 DOM 负责文字选择、输入、表单和键盘行为，canvas 只增强笔压、颗粒与纸面。浅深色、RTL、减少动态效果和强制颜色模式属于设计约定，不将这些约定表述为无障碍认证。

## 本地运行

需要 Node.js 22.12+ 和 npm，不需要内部 npm 镜像权限。

```sh
npm ci
npm run build
npm run check:package
```

文档站由独立的 [inkrajs/docs](https://github.com/inkrajs/docs) 维护。在该仓库运行 `npm run prepare:library -- /absolute/path/to/inkra`，然后 `npm run dev -- --port 4180`。访问 `http://127.0.0.1:4180`，查看交互参数、动态源码、API 和无障碍说明。组件改动后重新构建、打包并准备候选包。本仓的 `INKRA_DOCS_DIR=/path/to/docs npm run dev` 仅作为启动入口，不自动刷新候选包。

## 安装候选包

```sh
npm run build
npm run check:package
# 在另一个 React 项目中安装 .release/manifest.json 对应的 tgz 文件。
npm install /absolute/path/to/inkra/.release/inkra-0.0.1-alpha.0.tgz
```

在应用入口引入一次样式：

```tsx
import 'inkra/styles.css';
import { Button, Field, Input } from 'inkra';

export function NoteForm() {
  return (
    <form>
      <Field label="笔记名称"><Input name="title" clearable /></Field>
      <Button type="submit">保存</Button>
    </form>
  );
}
```

提供 ESM 和 TypeScript 声明，React 与 React DOM 为 peer dependencies。候选验证矩阵为 React 18/19；Next.js/RSC 和安装包的浏览器水合仍是单独的首发验收项，不能用客户端渲染的文档站正常运行代替。详见[发布检查表](docs/releasing.md)。

## 开发与维护

源码与维护：[inkrajs/inkra](https://github.com/inkrajs/inkra)。

六个已批准仓库的职责见[组织结构说明](docs/organization-structure.md)。源码、远端 CI、网站部署和 npm 发版分别验证。

- `packages/inkra`：组件、样式、字体与许可证。
- `assets`：仓库品牌资源。
- `docs/design-standard.md`：设计与交互规范。
- `scripts`：仓库与安装包检查。
- `.github/workflows`：PR 检查和手动候选包准备，不自动发布。

运行 `npm run check`，检查可移植性、包测试、打包内容，以及在独立临时项目中安装同一 tarball 后的 SSR、类型和资源路径。文档构建和浏览器交互检查归独立 docs 仓库负责；现有本地 `apps/docs` 仅是被主仓忽略的独立 Git 目录，不再是 npm workspace。目前没有启用 npm 自动发布和文档自动部署。

修改公共接口前阅读[贡献指南](CONTRIBUTING.md)。普通问题使用 Issue 模板，安全问题遵循[安全说明](SECURITY.md)，版本变化记录在 [CHANGELOG](CHANGELOG.md)。

## 许可

Inkra 代码沿用 [MIT](LICENSE)。附带字体使用 SIL OFL 1.1，Leaflet 资源保留各自许可，详见[第三方声明](packages/inkra/THIRD_PARTY_NOTICES.md)。

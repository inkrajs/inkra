# Inkra Docs Skill

帮助使用 Inkra 的开发者找到合适的组件、理解当前版本的 API，并完成接入或排查使用问题。

## 安装与调用

在项目目录运行（需要 Node.js 22.20 或更新版本）：

```bash
npx skills add inkrajs/inkra --skill inkra-docs
```

使用通用 [skills CLI](https://github.com/vercel-labs/skills)，不需要 Inkra 专用安装器。CLI 会识别当前 Agent，或提示选择目标 Agent。默认仅安装到当前项目；需要跨项目使用时追加 `-g`。

备用方式：下载文档站提供的 ZIP，或复制本仓库完整的 `inkra-docs` 目录，放入工具支持的技能目录。保留 `SKILL.md`、`references` 和其他随附文件，避免多套一层同名目录；更新前比较已有本地修改。

通常只需安装统一入口 `$inkra`，由它发现本 skill 的说明；需要直接调用时也可独立安装。新建对话后可以这样说：

```text
使用 $inkra-docs，找一个适合展示技能依赖关系的组件。
告诉我当前项目安装的版本能否使用，以及基础示例和文档在哪里。
```

```text
使用 $inkra-docs，比较这个管理列表应该用 Table 还是 DataTable。
按搜索、编辑和分页需求检查 API，不要先重写一个表格。
```

```text
使用 $inkra-docs，排查这个项目为什么没有显示 Inkra 的字体和笔触。
只修改相关接入代码，保留现有主题。
```

## 会查哪些资料

优先检查实际安装包、锁文件和公开类型；再按需读取文档站的 `llms.txt`、`ai/components.json` 与选中组件的 Markdown、类型和示例链接。这些静态入口随对应文档版本生成，旧站点缺失时会回退到公开页面与本地类型，并说明不能确认的信息。

它区分已安装版本、最新 npm 发布和文档站快照，给出当前项目可用的调用方式。组件列表由资料索引提供，不写死在 skill 中。输入版本与资料没有变化时复用已读信息。

布局、状态组织或外观设计需要进一步判断时，可以发现并读取独立的 `inkra-design`；它不是本 skill 的安装前提。

[AI 指令入口](SKILL.md) · [发现与接入指引](references/discovery.md) · [公开文档](https://inkrajs.github.io/docs/getting-started) · [MIT 许可](LICENSE)

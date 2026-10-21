# Contributing / 贡献指南

Inkra is an independent React library. Do not add private travel records,
credentials, device media or unrelated projects. Respectful, specific feedback
and minimal reproducible examples are welcome.

## Setup and Changes

Use Node.js 22.12+ and npm. Run `npm ci`, then `npm run build`.
The independent `inkrajs/docs` repository owns the playground. After building
and running `npm run check:package` here, run its `npm run prepare:library --
/absolute/path/to/inkra` command to install the checked archive. It must not use
source aliases. API changes usually require coordinated changes in both repos.
Read `AGENTS.md` and `docs/design-standard.md` before visual changes.

- Preserve semantic DOM and mature interaction primitives.
- Drawing stays deterministic and does not drive layout or intercept input.
- Update public types, API documentation, interactive examples and generated
  example code together. Name icon-only controls.
- Preserve controlled/uncontrolled, reset, disabled and readonly form behavior.
- Check keyboard focus, portal themes, light/dark, RTL and reduced motion.
- Keep changes focused and preserve other contributors' work.

## Verification

Run `npm run check` in the library. It tests an installed tarball and does not
require the docs checkout. In the docs checkout, run `npm run build`, start its
dev server on port 4180, then run:

```sh
npx playwright install chromium
npm run test:browser
```

The docs repo owns browser tests and public-API fixtures. The three remaining
library scripts `verify-selection`, `verify-palette-selection` and
`verify-expansion` are historical source-level regressions, not part of the
independent consumer smoke suite. Some historical scripts need harness or
selector updates; do not claim they passed unless they ran. Automated checks
do not replace visual or real-device acceptance.

## Pull Requests and Licensing

Use a descriptive branch and Conventional Commit subject, such as
`fix(select): preserve focus after clearing`. Explain behavior and checks.
Exclude build output, local handoff notes, credentials and candidate archives.
Publishing, deploying or changing repository visibility requires explicit approval.

Code contributions use the existing MIT license. Preserve third-party notices.
Security concerns follow `SECURITY.md` rather than public issues.

## 中文摘要

先阅读项目与设计规范，再做聚焦修改。接口、类型、示例与文档同步更新；验证表单、键盘、主题和窄屏边界。运行 `npm run check`，界面变更补相关浏览器检查。不要提交私人数据、凭证、构建产物或本机交接记录；未经明确确认不发布、不部署、不改变仓库可见性。

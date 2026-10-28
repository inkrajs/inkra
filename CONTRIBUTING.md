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

Choose meaningful affected local checks first and follow [the AI CI guide](docs/ai-ci-guide.md)
when preparing a PR. Eligible, already-passing local checks can be confirmed through
the exact-commit declaration; avoid duplicate full runs on unchanged inputs.
`npm run check` is the full library validation. It tests an installed tarball and does not
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

Pull requests keep repository, release-tool, type/build, package and installed
consumer contracts complete, while component tests use an auditable incremental
plan. The plan compares the exact base SHA to the actual checked-out/tested Git
revision, records the requested PR head separately when GitHub supplies a merge
preview, and lists selected/skipped tests with conservative fallback reasons.
Selection follows parsed source imports, re-exports, reverse transitive
consumers, source-reading tests and recursive test fixtures/helpers. Changed
tests run directly. Unknown paths, unmapped helpers, deleted/renamed source,
package/lock/compiler/build changes, missing history or an unsafe Git range run
the full component suite. Without an accepted local-test confirmation, pushes to
`main`, manual checks and release workflows retain full validation. Accepted
confirmations remove only explicitly eligible module checks; required contracts
and installed-consumer checks remain.

## Pull Requests and Licensing

### Keep Merges Bounded

- Freeze the requested change set before the merge gate. Track later feature or
  pipeline improvements separately; do not keep an already-green merge waiting
  for unrelated work. Report component merge, CI changes and publication as
  separate states.
- Reuse passing verification only for the same source, dependency, configuration
  and candidate inputs. Record the revision and artifact digest. Run the affected
  check after a fix, then one final integration pass; do not have every owner and
  reviewer repeat the same full suite.
- A local pass must not depend on ignored handoffs. `check:repository` rejects
  component tests referencing local handoff directories; use tracked fixtures
  and public package contracts instead.
- Diagnose the failed job before retrying. For unchanged revisions and transient
  infrastructure failures, retry failed jobs only. Code fixes require a new
  revision and its normal required checks; never reuse old success as new proof.
- Review CI step timestamps and the longest dependent job chain, not the sum of
  parallel jobs. Inspect logs when a phase stops progressing rather than issuing
  rapid unchanged polls. Do not wait for post-merge or publication work unless it
  is part of the requested delivery.
- Once findings, changes and verification evidence are recorded, close the task.
  Report formatting and additional nonblocking investigations are not merge gates.

Use a descriptive branch and Conventional Commit subject, such as
`fix(select): preserve focus after clearing`. Explain behavior and checks.
Exclude build output, local handoff notes, credentials and candidate archives.
Publishing, deploying or changing repository visibility requires explicit approval.

Code contributions use the existing MIT license. Preserve third-party notices.
Security concerns follow `SECURITY.md` rather than public issues.

## 中文摘要

先阅读项目与设计规范，再做聚焦修改。接口、类型、示例与文档同步更新；验证表单、键盘、主题和窄屏边界。运行 `npm run check`，界面变更补相关浏览器检查。不要提交私人数据、凭证、构建产物或本机交接记录；未经明确确认不发布、不部署、不改变仓库可见性。

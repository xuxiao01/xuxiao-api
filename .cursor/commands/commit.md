# 生成 Git Commit Message

请根据当前 Git 暂存区变更生成符合 Conventional Commits 规范的 commit message，并在生成后自动执行 `git commit` 完成提交（省去复制命令步骤）。

要求：

- 只分析已经 `git add` 的暂存区内容
- 优先执行并分析：

```bash
git diff --cached
```

- 不要分析未暂存内容
- 需要自动执行 `git commit`（提交内容来自暂存区）
- 不要在 commit message 中添加任何共同作者标记（例如 `Co-authored-by:` / `Co-Authored-By:` / `Co-authored-by: Cursor <cursoragent@cursor.com>` 等）
- 不要 `git push`
- 不要跳过 hooks（不要使用 `--no-verify` 等）
- 不要改写历史（不要使用 `--amend`、rebase、force push 等）
- 如果提交失败（例如 hook 拦截），只需要输出失败原因与下一步建议，不要重复多次尝试提交

如果暂存区没有变更，请提示：

```text
当前暂存区没有变更，请先执行 git add 后再生成 commit message。
```

---

## Commit 格式

优先使用：

```text
<type>(<scope>): <subject>
```

如果无法判断明确 scope，可以省略：

```text
<type>: <subject>
```

如果变更多、单行说不清，可以补充 body：

```text
<type>(<scope>): <subject>

- 变更点 1
- 变更点 2
- 变更点 3
```

---

## type 选择规则

根据暂存区变更选择最合适的 type：

- `feat`：新增功能
- `fix`：修复 bug、异常、错误逻辑
- `docs`：文档、注释、README、Cursor Rules、Cursor Commands
- `style`：格式调整，不影响逻辑
- `refactor`：重构，不新增功能也不修复 bug
- `perf`：性能优化
- `test`：测试相关
- `build`：依赖、构建配置、包管理、tsconfig、vite、webpack 等
- `ci`：CI/CD 配置
- `chore`：杂项维护、目录调整、工具配置
- `revert`：回滚提交

如果同时包含多类变更，选择最核心的 type。

---

## scope 规则

scope 表示影响范围，使用英文小写。

可根据文件路径、业务模块或技术模块判断，例如：

`upload`、`auth`、`router`、`api`、`store`、`components`、`docs`、`config`、`deps`、`cursor`、`command`

无法明确判断时，不要强行编造 scope。

---

## subject 规则

subject 使用中文，要求：

- 简短明确
- 使用动宾结构
- 描述“做了什么”
- 不超过 50 个中文字符
- 不以句号结尾
- 不要写“修改代码”“更新文件”“优化一下”这类模糊描述

---

## 输出格式

请严格按下面格式输出：

### 推荐 commit message

```text
<type>(<scope>): <subject>
```

如果需要 body：

```text
<type>(<scope>): <subject>

- 变更点 1
- 变更点 2
- 变更点 3
```

### 自动提交（你需要实际执行）

在生成 commit message 后，直接执行提交命令（不要让我复制粘贴）。

```bash
git commit -m "<type>(<scope>): <subject>"
```

带 body：

```bash
git commit -m "<type>(<scope>): <subject>" \
  -m "- 变更点 1
- 变更点 2
- 变更点 3"
```

### 执行结果

输出 `git commit` 的关键结果即可：

- 成功：展示新 commit 的摘要（hash、subject、变更文件数/行数等的简要信息）
- 失败：展示报错关键信息，并给出 1-2 条下一步建议（例如先修复 lint / 补充暂存 / 调整 message）

并在成功后做一次自检，确保提交信息里没有共同作者标记：

```bash
git show -s --format=%B HEAD
```

如果发现包含任何 `Co-authored-by:`（大小写不敏感），需要立刻执行一次仅修改提交信息的 `--amend` 去掉这些行，然后再次自检；如果该提交已经推到远端，提示需要使用 `git push --force-with-lease` 才能同步远端历史（但不要自动推送）。

### 简短理由

用一句话说明为什么选择这个 type 和 scope。

---

## 限制

- 不要输出完整 diff
- 不要输出冗长分析
- 不要输出多个无关候选
- 不要编造暂存区之外的信息
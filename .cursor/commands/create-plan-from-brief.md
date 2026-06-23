# Create Plan From Brief

你需要按照 `.cursor/rules/ai-task-workflow.md` 执行「Brief → Plan」阶段。

我会在本次对话中直接粘贴一份 brief 内容。你需要根据这份 brief，自动完成以下事情：

1. 检查当前项目是否存在 `local-docs/ai-tasks/briefs/`、`local-docs/ai-tasks/plans/`、`local-docs/ai-tasks/reports/`。
2. 如果目录不存在，请自动创建。
3. 如果目录已经存在，不要重复创建，也不要删除已有文件。
4. 根据我粘贴的 brief 内容，生成一个规范的 brief 文件，写入 `local-docs/ai-tasks/briefs/`。
5. brief 文件生成后，再基于这个 brief 阅读项目相关代码。
6. 根据 brief 和项目代码，生成对应的 implementation plan 文件，写入 `local-docs/ai-tasks/plans/`。
7. 生成 plan 后停止，不要修改业务代码。
8. 等我确认 plan 后，再进入 checkpoint 执行阶段。

---

## 输入内容

我会在命令后粘贴 brief 内容：

```md
$ARGUMENTS
```

---

## 目录规范

请确保存在以下目录：

```text
local-docs/ai-tasks/
  briefs/
  plans/
  reports/
```

如果不存在，请创建：

```bash
mkdir -p local-docs/ai-tasks/briefs local-docs/ai-tasks/plans local-docs/ai-tasks/reports
```

---

## Brief 文件生成规则

你需要从我粘贴的 brief 内容中提取任务名称，并生成一个文件名。

文件名格式：

```text
YYYY-MM-DD_task-name.brief.md
```

要求：

- 日期使用今天日期。
- `task-name` 使用英文小写。
- 单词之间使用短横线 `-`。
- 不要使用中文。
- 不要使用空格。
- 不要使用特殊符号。
- 如果 brief 标题是中文，需要你自动翻译成简短英文 task-name。
- 如果我粘贴的 brief 中已经包含推荐文件名，请优先使用我提供的文件名。

示例：

```text
local-docs/ai-tasks/briefs/2026-06-15_game-ui-level-entry.brief.md
```

---

## Plan 文件生成规则

brief 文件创建完成后，请生成对应 plan 文件。

plan 文件路径必须和 brief 一一对应：

```text
local-docs/ai-tasks/plans/YYYY-MM-DD_task-name.plan.md
```

示例：

```text
brief:
local-docs/ai-tasks/briefs/2026-06-15_game-ui-level-entry.brief.md

plan:
local-docs/ai-tasks/plans/2026-06-15_game-ui-level-entry.plan.md
```

---

## Report 文件路径预留

plan 中需要写出未来 report 文件路径：

```text
local-docs/ai-tasks/reports/YYYY-MM-DD_task-name.report.md
```

但此阶段不要生成 final report。

---

## 执行要求

在生成 plan 前，你需要先阅读项目相关代码。

请根据 brief 内容，主动搜索可能相关的：

- 页面文件
- 组件文件
- 样式文件
- 路由文件
- 数据文件
- mock 数据
- 类型定义
- 资源文件
- 工具函数

不要只凭文件名猜测。  
需要结合项目真实结构判断修改范围。

---

## 禁止事项

在 plan 被我确认之前，不要做以下事情：

- 不要修改业务代码
- 不要修改样式文件
- 不要新增业务组件
- 不要新增页面
- 不要删除文件
- 不要重构组件
- 不要安装依赖
- 不要直接执行 checkpoint
- 不要把 plan 只输出在聊天里而不写入文件

本阶段只允许：

- 创建 `local-docs/ai-tasks/` 相关目录
- 写入 brief 文件
- 读取项目代码
- 写入 plan 文件

---

## Plan 内容结构

生成的 plan 文件必须包含：

```md
# Implementation Plan：任务名称

## 1. 文件对应关系

- Brief 文件：
- Plan 文件：
- Report 文件：

## 2. 需求理解

用自己的话总结本次任务要解决什么问题，以及最终希望达到什么效果。

## 3. 项目现状分析

说明你阅读了哪些相关代码，当前实现大概是什么结构。

需要包含：

- 相关页面
- 相关组件
- 相关样式
- 相关数据 / 资源
- 当前实现中的关键问题

## 4. 涉及文件

列出预计需要修改或新增的文件。

格式：

- `文件路径`：修改原因
- `文件路径`：修改原因

如果某些文件只是参考，不修改，也要标明「只读参考」。

## 5. 实现思路

描述具体落地方案。

需要说明：

- UI 如何调整
- 交互逻辑如何调整
- 数据结构是否变化
- 样式如何复用
- 是否影响其他页面
- 如何保证 H5 适配
- 是否需要新增 mock 数据
- 是否需要新增资源

## 6. Checkpoint 拆分

将任务拆成 2～5 个 checkpoint。

每个 checkpoint 需要包含：

- 目标
- 修改范围
- 完成标准
- 用户需要验收的内容

## 7. 风险点

列出可能风险。

## 8. 需要用户确认的问题

如果没有问题，写：

暂无必须确认的问题。

## 9. 验收标准

列出完成后如何判断任务成功。

## 10. 执行指令建议

说明确认后建议先执行哪个 checkpoint。
```

---

## 完成后汇报格式

完成后，请在聊天中只做简要汇报：

```md
已完成 Brief 和 Plan 创建。

Brief 文件：
`local-docs/ai-tasks/briefs/YYYY-MM-DD_task-name.brief.md`

Plan 文件：
`local-docs/ai-tasks/plans/YYYY-MM-DD_task-name.plan.md`

Report 文件预留：
`local-docs/ai-tasks/reports/YYYY-MM-DD_task-name.report.md`

请先 review plan。确认后可以执行 Checkpoint 1。
```

不要继续执行 checkpoint。

---

## 使用方式

建议把本文件放到：

```text
.cursor/commands/create-plan-from-brief.md
```

然后在 Cursor 中这样使用：

```text
/create-plan-from-brief

# AI Task Brief：任务名称

## 1. 我想做什么
...
```

或者：

```text
/create-plan-from-brief 这里直接粘贴 brief 全文
```

---

## 命令定位

这个命令不是直接执行需求，而是完成：

```text
粘贴 brief → 创建 local-docs 目录 → 保存 brief 文件 → 读取项目代码 → 生成 plan 文件 → 停下来等待确认
```

核心原则：

```text
只生成 brief 和 plan。
不修改业务代码。
不执行 checkpoint。
不跳过用户确认。
```

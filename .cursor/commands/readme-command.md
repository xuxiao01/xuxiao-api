# 生成项目 README.md

请根据当前项目代码结构，帮我生成一份适合 GitHub / 项目展示使用的 `README.md`。

目标：  
分析当前项目的真实目录、配置、依赖、脚本和功能模块，生成一份清晰、专业、不过度 AI 味的 README 文档。

不要凭空编造不存在的功能。  
如果某些信息无法从项目中确认，请使用「待补充」标记，而不是乱写。



# 0.README 封面图

请默认在 README 顶部添加一个项目封面图，用于提升 GitHub / 项目展示效果。



封面图默认使用用户提供的占位图地址。
如果用户没有在本次对话中额外提供具体图片地址，则使用以下 command 内置的默认 OSS 占位图地址。注意：这个 OSS 地址本身就是一个明确的图片地址，不要把它理解成“用户没有提供图片”。

![1c672ff2d50bd00a00908783841677f0](https://typorabucket0308.oss-cn-beijing.aliyuncs.com/images/20260603103934962.jpg)

封面图生成规则：

- 默认放在 README 最顶部，位于项目标题之前
- 封面图地址优先级必须严格按以下顺序执行：
  1. 如果用户在本次请求中明确提供了 OSS 图片地址 / GIF 地址，优先使用用户提供的地址
  2. 如果项目中存在 `docs/images/readme-cover.gif`，使用该 GIF
  3. 如果项目中存在 `docs/images/readme-cover.png`，使用该 PNG
  4. 如果项目中不存在本地封面图，使用上方 command 内置的默认 OSS 占位图地址
  5. 只有当 command 中也没有默认 OSS 图片地址时，才保留 `./docs/images/readme-cover.png` 作为本地占位路径
- 当前 command 已经提供默认 OSS 占位图地址，因此在没有本地封面图时，应该使用 `https://typorabucket0308.oss-cn-beijing.aliyuncs.com/images/20260603103934962.jpg`
- 不要凭空编造不存在的线上图片地址
- 不要添加带有版权风险、敏感信息、账号信息、接口地址的图片说明
- 封面图推荐使用横图，适合 README 顶部展示



推荐输出格式：

如果没有检测到项目本地封面图，且用户没有额外提供图片地址，则使用 command 内置的默认 OSS 图片：

```html
<p align="center">
  <img src="https://typorabucket0308.oss-cn-beijing.aliyuncs.com/images/20260603103934962.jpg" alt="项目预览图" width="800" />
</p>

<h1 align="center">项目名称</h1>
<p align="center">
  一句话介绍项目用途。
</p>
```

如果检测到项目本地封面图，则改成对应本地路径：

```html
<p align="center">
  <img src="./docs/images/readme-cover.png" alt="项目预览图" width="800" />
</p>
```

如果用户在本次请求中提供了 OSS 图片地址，则改成：

```html
<p align="center">
  <img src="用户提供的 OSS 图片地址" alt="项目预览图" width="800" />
</p>
```



# 1.项目结构分析

请优先读取并分析以下文件：

- `package.json`
- `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock`
- `vite.config.*`
- `tsconfig.json`
- `README.md`（如果已存在）
- `src/` 目录
- `pages/` 目录
- `components/` 目录
- `utils/` 目录
- `services/` / `api/` 目录
- `.env.example` / `.env`（不要泄露敏感信息）
- `project.config.json` / `app.json` / `app.config.*`（如果是小程序项目）

如果是 Node.js 后端项目，还需要重点分析：

- `src/app.js` / `src/index.js` / `server.js`
- `routes/`
- `controllers/`
- `models/`
- `middlewares/`
- 数据库连接配置
- 接口路由定义

---

## 2. 判断项目类型

请根据项目文件判断当前项目属于哪一类：

- 前端 Web 项目
- 微信小程序项目
- Node.js 后端项目
- 全栈项目
- 工具库 / npm 包
- 其他类型

判断依据要来自项目文件，比如：

- `package.json` 中的依赖
- 框架相关配置
- 入口文件
- 目录结构
- 构建脚本

---

## 3. README 必须包含的内容

请生成包含以下部分的 README：

### 项目名称

从 `package.json` 的 `name`、现有 README、项目目录名中推断。

### 项目简介

用 2～4 句话说明：

- 这个项目是做什么的
- 面向什么场景
- 主要解决什么问题
- 如果是练手 / 实验项目，可以自然说明，但不要写得太简陋

### 功能特性

根据实际代码总结功能点。

示例格式：

```md
## 功能特性

- 支持 xxx
- 支持 xxx
- 提供 xxx
- 集成 xxx
```

不要写项目里没有的功能。

### 技术栈

根据依赖和配置真实总结。

前端项目示例：

```md
## 技术栈

- Vue 3 / React / 原生小程序
- TypeScript / JavaScript
- Vite / Webpack
- Pinia / Redux
- Axios
- Tailwind CSS / Less / Sass
```

后端项目示例：

```md
## 技术栈

- Node.js
- Express
- MongoDB
- Mongoose
- dotenv
- cors
- express-rate-limit
```

### 目录结构

请生成简洁目录结构，不要把所有文件都列出来，只列核心目录。

示例：

````md
## 目录结构

```text
project-name/
├── src/
│   ├── components/
│   ├── pages/
│   ├── utils/
│   └── services/
├── public/
├── package.json
└── README.md
```
````

### 本地运行

根据 `package.json` scripts 生成真实命令。

优先使用当前项目实际使用的包管理器：

- 有 `pnpm-lock.yaml`：用 `pnpm`
- 有 `yarn.lock`：用 `yarn`
- 有 `package-lock.json`：用 `npm`

示例：

````md
## 本地运行

安装依赖：

```bash
pnpm install
```

启动开发环境：

```bash
pnpm dev
```

构建项目：

```bash
pnpm build
```
````

如果没有对应脚本，不要编造，写「待补充」。

### 环境变量

如果项目包含 `.env.example`，请根据它生成说明。

如果只有 `.env`，不要直接暴露具体值，只说明变量名和作用。

示例：

```md
## 环境变量

项目运行前需要配置以下环境变量：

| 变量名 | 说明 |
| --- | --- |
| VITE_API_BASE_URL | 后端接口地址 |
| MONGO_URI | MongoDB 连接地址 |
| PORT | 服务端口 |
```

### 部署说明

如果项目里能看出部署方式，请总结。

如果无法确定，可以生成通用部署说明，但要标记为参考。

前端项目示例：

````md
## 部署说明

项目构建后会生成静态资源，可部署到 Nginx、Vercel、Netlify 或静态资源服务器。

```bash
pnpm build
```

构建产物通常位于：

```text
dist/
```
````

Node.js 后端项目示例：

````md
## 部署说明

后端服务可以使用 PM2 部署：

```bash
pm2 start src/app.js --name mini-game-comment-server
```

生产环境建议通过 Nginx 反向代理到 Node.js 服务。
````

### 后续计划

根据项目当前状态，生成合理的 roadmap。

示例：

```md
## 后续计划

- 补充接口错误处理
- 增加评论管理能力
- 增加部署文档
- 优化移动端适配
```

不要写太夸张。

---

## 4. 写作风格要求

请遵循以下风格：

- 中文输出
- 语气自然，像开发者自己整理的文档
- 不要写得像商业宣传稿
- 不要过度使用 emoji
- 不要使用夸张词，比如“革命性”“极致”“强大无比”
- 尽量具体，不要空泛
- README 要适合放到 GitHub 或团队仓库
- 对不确定的信息用「待补充」标记

---

## 5. 写入 README.md（必须执行）

生成 README 后，**必须直接写入或更新**项目根目录的 `README.md`，不要询问用户是否写入。

如果项目中已经存在 `README.md`：

1. 先分析现有 README 内容
2. 判断是应该「重写」还是「在原基础上优化」
3. 将完整新版内容写入 `README.md`（覆盖或合并更新均可，以当前项目真实状态为准）

---

## 6. 输出要求

1. 将完整 README 内容写入根目录 `README.md`
2. 可在回复中简要说明本次更新了哪些章节（不必重复粘贴全文）

输出格式：

```md
# 项目名称

项目简介...

## 功能特性

...

## 技术栈

...

## 目录结构

...

## 本地运行

...

## 环境变量

...

## 部署说明

...

## 后续计划

...

## License

待补充
```

---

## 7. 禁止事项

不要做以下事情：

- 不要编造项目没有的功能
- 不要泄露 `.env` 中的敏感信息
- 不要把 `node_modules`、构建产物、锁文件内容写进目录结构
- 不要生成过长的目录树
- 不要只输出内容却不写入 `README.md`
- 不要写英文 README，除非用户明确要求
- 不要添加无意义的徽章
- 不要添加不存在的截图链接

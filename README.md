# blog-cms 个人博客系统

一个前后端完整、开箱即用的个人博客系统。后端使用 **Node.js + Express** 提供 REST API，数据持久化到 `server/data.json` 文件；前端为原生 **HTML / CSS / JavaScript** 单页应用，包含首页文章列表、文章详情页和写文章编辑器。

## 功能

- **文章**：列表、详情、新增、编辑、删除
- **评论**：发表、删除（删除文章会连同其评论一起删除）
- **分类筛选**：首页按分类筛选文章，分类列表由已有文章自动汇总
- 内置 **6 篇示例文章**与 **9 条示例评论**

## 目录结构

```
blog-cms/
├── package.json        # 启动脚本 npm start
├── client/             # 前端（由后端静态托管）
│   ├── index.html      # 页面骨架
│   ├── style.css       # 样式
│   └── app.js          # 哈希路由 + 渲染 + API 调用
└── server/
    ├── server.js       # Express 服务（端口 3001）
    └── data.json       # 数据持久化文件（含示例数据）
```

## 安装与启动

要求 Node.js ≥ 16。

```bash
cd blog-cms
npm install
npm start
```

启动后访问 **http://localhost:3001** 即可（前端页面与 API 由同一个服务提供，端口为 **3001**，不使用 3000；如需换端口可设置环境变量 `PORT`，例如 `PORT=4000 npm start`）。

## REST API

| 方法   | 路径                        | 说明                                                        |
| ------ | --------------------------- | ----------------------------------------------------------- |
| GET    | `/api/articles`             | 文章列表，支持 `?category=分类` 筛选，返回 `{ articles, categories }` |
| GET    | `/api/articles/:id`         | 文章详情（含该文章全部评论）                                 |
| POST   | `/api/articles`             | 新增文章，body: `{ title, category, content }`              |
| PUT    | `/api/articles/:id`         | 更新文章                                                    |
| DELETE | `/api/articles/:id`         | 删除文章（连同其评论）                                       |
| POST   | `/api/articles/:id/comments`| 新增评论，body: `{ author, content }`                        |
| DELETE | `/api/comments/:id`         | 删除评论                                                     |

### curl 示例

```bash
# 文章列表
curl http://localhost:3001/api/articles

# 按分类筛选
curl "http://localhost:3001/api/articles?category=技术"

# 新增文章
curl -X POST http://localhost:3001/api/articles \
  -H 'Content-Type: application/json' \
  -d '{"title":"你好，世界","category":"随笔","content":"第一篇文章。"}'

# 给文章 a1 新增评论
curl -X POST http://localhost:3001/api/articles/a1/comments \
  -H 'Content-Type: application/json' \
  -d '{"author":"路人","content":"写得不错！"}'

# 删除评论 / 删除文章
curl -X DELETE http://localhost:3001/api/comments/c1
curl -X DELETE http://localhost:3001/api/articles/a1
```

## 数据持久化

所有数据保存在 `server/data.json`，每次增删改都会立即写盘，重启服务数据不丢失。备份只需复制这一个文件；删除该文件后重启服务会得到一个空博客（如需找回示例数据，恢复该文件即可）。

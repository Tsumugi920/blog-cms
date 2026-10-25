'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const DATA_FILE = path.join(__dirname, 'data.json');
const CLIENT_DIR = path.join(__dirname, '..', 'client');

// ---------- JSON 文件持久化 ----------
const EMPTY_DATA = { articles: [], comments: [], nextArticleId: 1, nextCommentId: 1 };

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const key of Object.keys(EMPTY_DATA)) {
      if (data[key] === undefined) data[key] = EMPTY_DATA[key];
    }
    return data;
  } catch (err) {
    // 文件不存在或损坏时，以空数据启动并重建文件
    const data = JSON.parse(JSON.stringify(EMPTY_DATA));
    saveData(data);
    return data;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function badRequest(res, msg) {
  return res.status(400).json({ error: msg });
}

app.use(express.json());

// ---------- 文章 API ----------
app.get('/api/articles', (req, res) => {
  const data = loadData();
  const category = String(req.query.category || '').trim();
  let articles = data.articles;
  if (category && category !== '全部') {
    articles = articles.filter((a) => a.category === category);
  }
  articles = articles
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((a) => ({
      ...a,
      commentCount: data.comments.filter((c) => c.articleId === a.id).length,
    }));
  const categories = [...new Set(data.articles.map((a) => a.category).filter(Boolean))];
  res.json({ articles, categories });
});

app.get('/api/articles/:id', (req, res) => {
  const data = loadData();
  const article = data.articles.find((a) => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  const comments = data.comments
    .filter((c) => c.articleId === article.id)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  res.json({ article, comments });
});

app.post('/api/articles', (req, res) => {
  const { title, category, content } = req.body || {};
  if (!title || !String(title).trim()) return badRequest(res, '标题不能为空');
  if (!content || !String(content).trim()) return badRequest(res, '内容不能为空');
  const data = loadData();
  const now = new Date().toISOString();
  const article = {
    id: 'a' + data.nextArticleId,
    title: String(title).trim(),
    category: String(category || '').trim() || '未分类',
    content: String(content).replace(/\r\n/g, '\n').trim(),
    createdAt: now,
    updatedAt: now,
  };
  data.nextArticleId += 1;
  data.articles.push(article);
  saveData(data);
  res.status(201).json({ article });
});

app.put('/api/articles/:id', (req, res) => {
  const data = loadData();
  const article = data.articles.find((a) => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  const { title, category, content } = req.body || {};
  if (title !== undefined && !String(title).trim()) return badRequest(res, '标题不能为空');
  if (content !== undefined && !String(content).trim()) return badRequest(res, '内容不能为空');
  if (title !== undefined) article.title = String(title).trim();
  if (category !== undefined) article.category = String(category).trim() || '未分类';
  if (content !== undefined) article.content = String(content).replace(/\r\n/g, '\n').trim();
  article.updatedAt = new Date().toISOString();
  saveData(data);
  res.json({ article });
});

app.delete('/api/articles/:id', (req, res) => {
  const data = loadData();
  const idx = data.articles.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '文章不存在' });
  const removed = data.articles.splice(idx, 1)[0];
  data.comments = data.comments.filter((c) => c.articleId !== removed.id);
  saveData(data);
  res.json({ ok: true, deleted: removed.id });
});

// ---------- 评论 API ----------
app.post('/api/articles/:id/comments', (req, res) => {
  const data = loadData();
  const article = data.articles.find((a) => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: '文章不存在，无法评论' });
  const { author, content } = req.body || {};
  if (!content || !String(content).trim()) return badRequest(res, '评论内容不能为空');
  const comment = {
    id: 'c' + data.nextCommentId,
    articleId: article.id,
    author: String(author || '').trim() || '匿名',
    content: String(content).replace(/\r\n/g, '\n').trim(),
    createdAt: new Date().toISOString(),
  };
  data.nextCommentId += 1;
  data.comments.push(comment);
  saveData(data);
  res.status(201).json({ comment });
});

app.delete('/api/comments/:id', (req, res) => {
  const data = loadData();
  const idx = data.comments.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '评论不存在' });
  const removed = data.comments.splice(idx, 1)[0];
  saveData(data);
  res.json({ ok: true, deleted: removed.id });
});

// ---------- 未知 API、静态前端 ----------
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use(express.static(CLIENT_DIR));
app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));

// JSON 解析失败等错误统一返回
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体不是合法的 JSON' });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`blog-cms 已启动: http://localhost:${PORT}`);
  console.log(`数据文件: ${DATA_FILE}`);
});

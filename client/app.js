(function () {
  'use strict';

  var app = document.getElementById('app');
  var state = { category: '全部' };

  // ---------- 小工具 ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function excerpt(text, n) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  function avatarColor(name) {
    var palette = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
    var s = String(name || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  var toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast show ' + (type || 'ok');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 2600);
  }

  function api(path, options) {
    var opts = Object.assign({ headers: {} }, options || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok) {
          throw new Error((body && body.error) || '请求失败 (' + res.status + ')');
        }
        return body;
      });
    }, function () {
      throw new Error('网络错误，请确认后端服务已启动');
    });
  }

  // 删除类按钮：两次点击确认，第一次点击后 3 秒内未再点则自动复位
  function armConfirm(btn, onConfirm) {
    if (btn.dataset.armed === '1') { onConfirm(); return; }
    btn.dataset.armed = '1';
    btn.dataset.orig = btn.textContent;
    btn.classList.add('armed');
    btn.textContent = '确认删除？';
    setTimeout(function () {
      if (!btn.isConnected || btn.dataset.armed !== '1') return;
      btn.dataset.armed = '';
      btn.textContent = btn.dataset.orig;
      btn.classList.remove('armed');
    }, 3000);
  }

  function renderError(err) {
    app.innerHTML =
      '<div class="error-box">😢 ' + escapeHtml(err.message) +
      '<div style="margin-top:16px"><a class="btn btn-outline" href="#/">← 返回首页</a></div></div>';
  }

  // ---------- 路由 ----------
  function parseHash() {
    return location.hash.replace(/^#/, '') || '/';
  }

  function updateNav(path) {
    var links = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < links.length; i++) {
      var key = links[i].getAttribute('data-nav');
      var active =
        (key === 'list' && (path === '/' || path.indexOf('/article/') === 0 || path.indexOf('/edit/') === 0)) ||
        (key === 'new' && path === '/new');
      links[i].classList.toggle('active', active);
    }
  }

  function route() {
    var path = parseHash();
    window.scrollTo(0, 0);
    updateNav(path);
    var m;
    if (path === '/') return renderList().catch(renderError);
    if ((m = path.match(/^\/article\/([^/?]+)/))) return renderDetail(m[1]).catch(renderError);
    if (path === '/new') return renderEditor(null).catch(renderError);
    if ((m = path.match(/^\/edit\/([^/?]+)/))) return renderEditor(m[1]).catch(renderError);
    renderError(new Error('页面不存在'));
  }

  // ---------- 首页：文章列表 ----------
  function renderList() {
    app.innerHTML = '<div class="loading">加载中…</div>';
    var q = state.category === '全部' ? '' : '?category=' + encodeURIComponent(state.category);
    return api('/api/articles' + q).then(function (data) {
      var cats = ['全部'].concat(data.categories);
      var chips = cats.map(function (c) {
        return '<button class="chip' + (c === state.category ? ' active' : '') +
          '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
      }).join('');
      var cards = data.articles.map(function (a) {
        return '<article class="card">' +
          '<div class="card-meta"><span class="tag">' + escapeHtml(a.category) + '</span>' +
          '<time>' + fmtDate(a.createdAt) + '</time></div>' +
          '<h2 class="card-title"><a href="#/article/' + a.id + '">' + escapeHtml(a.title) + '</a></h2>' +
          '<p class="card-excerpt">' + escapeHtml(excerpt(a.content, 96)) + '</p>' +
          '<div class="card-foot"><a class="read-more" href="#/article/' + a.id + '">阅读全文 →</a>' +
          '<span class="comment-count">💬 ' + a.commentCount + '</span></div>' +
          '</article>';
      }).join('');
      app.innerHTML =
        '<section class="hero"><h1>记录 · 分享 · 沉淀</h1>' +
        '<p>一个用 Express + 原生 JS 搭起来的小小博客，欢迎围观与留言。</p></section>' +
        '<div class="chips">' + chips + '</div>' +
        '<div class="article-list">' + (cards || '<div class="empty">该分类下还没有文章</div>') + '</div>';
      var chipBtns = app.querySelectorAll('.chip');
      for (var i = 0; i < chipBtns.length; i++) {
        chipBtns[i].addEventListener('click', function () {
          state.category = this.dataset.cat;
          renderList().catch(renderError);
        });
      }
    });
  }

  // ---------- 文章详情 ----------
  function renderDetail(id) {
    app.innerHTML = '<div class="loading">加载中…</div>';
    return api('/api/articles/' + encodeURIComponent(id)).then(function (data) {
      var a = data.article;
      var paras = a.content.split(/\n{2,}/).map(function (p) {
        return '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>';
      }).join('');
      var comments = data.comments.map(function (c) {
        return '<li class="comment"><div class="comment-head">' +
          '<span class="comment-author"><span class="avatar" style="background:' + avatarColor(c.author) + '">' +
          escapeHtml((c.author || '匿')[0]) + '</span>' + escapeHtml(c.author) + '</span>' +
          '<time>' + fmtDate(c.createdAt) + '</time>' +
          '<button class="btn-link btn-del-comment" data-id="' + c.id + '">删除</button>' +
          '</div><p class="comment-body">' + escapeHtml(c.content) + '</p></li>';
      }).join('');
      app.innerHTML =
        '<article class="post">' +
        '<div class="card-meta"><span class="tag">' + escapeHtml(a.category) + '</span>' +
        '<time>' + fmtDate(a.createdAt) + '</time></div>' +
        '<h1>' + escapeHtml(a.title) + '</h1>' +
        '<div class="post-content">' + paras + '</div>' +
        '<div class="post-actions">' +
        '<a class="btn btn-outline" href="#/edit/' + a.id + '">✏️ 编辑</a>' +
        '<button class="btn btn-danger-outline btn-del-article">🗑 删除文章</button>' +
        '<a class="btn btn-text" href="#/">← 返回列表</a>' +
        '</div></article>' +
        '<section class="comments"><h3>评论（' + data.comments.length + '）</h3>' +
        '<ul class="comment-list">' + (comments || '<li class="empty">还没有评论，来抢沙发～</li>') + '</ul>' +
        '<form id="comment-form" class="comment-form"><h4>发表评论</h4>' +
        '<input name="author" maxlength="30" placeholder="昵称（可留空，默认匿名）">' +
        '<textarea name="content" rows="3" required placeholder="说点什么吧…"></textarea>' +
        '<button type="submit" class="btn btn-primary">发表评论</button>' +
        '</form></section>';

      var form = document.getElementById('comment-form');
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var content = form.content.value.trim();
        if (!content) return toast('评论内容不能为空', 'error');
        var btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        api('/api/articles/' + encodeURIComponent(id) + '/comments', {
          method: 'POST',
          body: { author: form.author.value.trim() || '匿名', content: content }
        }).then(function () {
          toast('评论已发表');
          renderDetail(id).catch(renderError);
        }).catch(function (err) {
          toast(err.message, 'error');
          btn.disabled = false;
        });
      });

      var delBtns = app.querySelectorAll('.btn-del-comment');
      for (var i = 0; i < delBtns.length; i++) {
        delBtns[i].addEventListener('click', function () {
          var btn = this;
          armConfirm(btn, function () {
            api('/api/comments/' + btn.dataset.id, { method: 'DELETE' }).then(function () {
              toast('评论已删除');
              renderDetail(id).catch(renderError);
            }).catch(function (err) { toast(err.message, 'error'); });
          });
        });
      }

      var delArticle = app.querySelector('.btn-del-article');
      delArticle.addEventListener('click', function () {
        armConfirm(delArticle, function () {
          api('/api/articles/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () {
            toast('文章已删除');
            location.hash = '#/';
          }).catch(function (err) { toast(err.message, 'error'); });
        });
      });
    });
  }

  // ---------- 写文章 / 编辑 ----------
  function renderEditor(id) {
    app.innerHTML = '<div class="loading">加载中…</div>';
    return api('/api/articles').then(function (all) {
      var knownCats = all.categories;
      var article = { title: '', category: '', content: '' };
      var load = id
        ? api('/api/articles/' + encodeURIComponent(id)).then(function (r) { article = r.article; })
        : Promise.resolve();
      return load.then(function () {
        var options = knownCats.map(function (c) {
          return '<option value="' + escapeHtml(c) + '">';
        }).join('');
        app.innerHTML =
          '<section class="editor"><h1>' + (id ? '✏️ 编辑文章' : '✍️ 写文章') + '</h1>' +
          '<form id="editor-form">' +
          '<label>标题<input name="title" maxlength="100" required placeholder="文章标题" value="' + escapeHtml(article.title) + '"></label>' +
          '<label>分类<input name="category" list="cat-list" maxlength="20" placeholder="如：技术 / 生活 / 随笔（可留空）" value="' + escapeHtml(article.category) + '">' +
          '<datalist id="cat-list">' + options + '</datalist></label>' +
          '<label>内容<textarea name="content" rows="14" required placeholder="正文…（空行分段）">' + escapeHtml(article.content) + '</textarea></label>' +
          '<div class="editor-foot"><span class="char-count"></span>' +
          '<a class="btn btn-text" href="' + (id ? '#/article/' + id : '#/') + '">取消</a>' +
          '<button type="submit" class="btn btn-primary">' + (id ? '保存修改' : '发布文章') + '</button>' +
          '</div></form></section>';

        var form = document.getElementById('editor-form');
        var ta = form.content;
        var cc = app.querySelector('.char-count');
        function updateCount() { cc.textContent = ta.value.length + ' 字'; }
        ta.addEventListener('input', updateCount);
        updateCount();

        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var payload = {
            title: form.title.value.trim(),
            category: form.category.value.trim(),
            content: ta.value.trim()
          };
          if (!payload.title) return toast('标题不能为空', 'error');
          if (!payload.content) return toast('内容不能为空', 'error');
          var btn = form.querySelector('button[type=submit]');
          btn.disabled = true;
          var req = id
            ? api('/api/articles/' + encodeURIComponent(id), { method: 'PUT', body: payload })
            : api('/api/articles', { method: 'POST', body: payload });
          req.then(function (res) {
            toast(id ? '已保存' : '发布成功');
            location.hash = '#/article/' + res.article.id;
          }).catch(function (err) {
            toast(err.message, 'error');
            btn.disabled = false;
          });
        });
      });
    });
  }

  // ---------- 启动 ----------
  window.addEventListener('hashchange', route);
  route();
})();

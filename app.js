(function () {
  var data = window.ROUTERS || [];
  var cardsEl = document.getElementById("cards");
  var emptyEl = document.getElementById("empty");
  var countEl = document.getElementById("count");
  var searchEl = document.getElementById("search");
  var brandEl = document.getElementById("filterBrand");
  var wifiEl = document.getElementById("filterWifi");
  var modal = document.getElementById("modal");
  var modalBody = document.getElementById("modalBody");

  // 初始化筛选下拉（按数据中实际出现的值动态生成）
  function uniq(arr) { return Array.from(new Set(arr)).sort(); }
  uniq(data.map(function (r) { return r.brand; })).forEach(function (b) {
    var o = document.createElement("option"); o.value = b; o.textContent = b; brandEl.appendChild(o);
  });
  uniq(data.map(function (r) { return r.wifiStandard; })).forEach(function (w) {
    var o = document.createElement("option"); o.value = w; o.textContent = w; wifiEl.appendChild(o);
  });

  // —— 搜索辅助：归一化、分词、转义、高亮 ——
  function norm(s) { return (s == null ? "" : String(s)).toLowerCase().replace(/\s+/g, " "); }
  function tokenize(q) {
    return q.trim().toLowerCase().split(/[\s,，、;；/]+/).filter(function (t) { return t.length; });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function highlight(text, tokens) {
    var esc = escapeHtml(text);
    if (!tokens.length) return esc;
    var re = new RegExp("(" + tokens.map(escapeHtml).map(escapeReg).join("|") + ")", "gi");
    return esc.replace(re, "<mark>$1</mark>");
  }

  function matches(r, q, brand, wifi) {
    if (brand && r.brand !== brand) return false;
    if (wifi && r.wifiStandard !== wifi) return false;
    if (q) {
      var tokens = tokenize(q);
      var faqText = (r.faq || []).map(function (f) { return f.q + " " + f.a; }).join(" ");
      var hay = norm([r.brand, r.model, r.fullName, r.cpu, r.wifiStandard,
        (r.tags || []).join(" "), r.note, faqText].join(" "));
      for (var i = 0; i < tokens.length; i++) {
        if (hay.indexOf(tokens[i]) === -1) return false; // 多关键词 AND 匹配，更精准
      }
    }
    return true;
  }

  function cardHTML(r) {
    var p = r.ports || {};
    return '' +
      '<div class="card" data-model="' + r.model + '">' +
        (r.image ? '<img class="thumb" src="' + r.image + '" alt="' + r.fullName + '" loading="lazy" />' : '') +
        '<div class="brand">' + r.brand + '</div>' +
        '<div class="model">' + r.model + '</div>' +
        '<div class="row"><span>WiFi 标准</span><b>' + (r.wifiStandard || "-") + '</b></div>' +
        '<div class="row"><span>无线速率</span><b>' + (r.maxSpeed ? r.maxSpeed.combined : "-") + '</b></div>' +
        '<div class="row"><span>网口</span><b>' + (p.lan || 0) + '×LAN / ' + (p.wan || 0) + '×WAN</b></div>' +
        (r.tags && r.tags.length ? '<div class="tags">' + r.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join("") + '</div>' : '') +
      '</div>';
  }

  function render() {
    var q = searchEl.value.trim().toLowerCase();
    var brand = brandEl.value;
    var wifi = wifiEl.value;
    var list = data.filter(function (r) { return matches(r, q, brand, wifi); });

    cardsEl.innerHTML = list.map(cardHTML).join("");
    emptyEl.hidden = list.length !== 0;
    countEl.textContent = "共 " + list.length + " / " + data.length + " 款";
  }

  function openDetail(model, focusQ) {
    var r = data.filter(function (x) { return x.model === model; })[0];
    if (!r) return;
    var p = r.ports || {};
    var rows = [
      ["品牌", r.brand],
      ["型号", r.model],
      ["全称", r.fullName],
      ["发布年份", r.releaseYear],
      ["CPU", r.cpu],
      ["内存", r.ram],
      ["WiFi 标准", r.wifiStandard],
      ["2.4G 速率", r.maxSpeed ? r.maxSpeed.b2g : "-"],
      ["5G 速率", r.maxSpeed ? r.maxSpeed.b5g : "-"],
      ["合计无线速率", r.maxSpeed ? r.maxSpeed.combined : "-"],
      ["WAN 口", p.wan],
      ["LAN 口", p.lan + "（" + (p.lanType || "-") + "）"],
      ["USB 口", p.usb],
      ["尺寸", r.dimensions],
      ["重量", r.weight],
      ["参考价格", r.price != null ? "¥" + r.price : "-"]
    ];

    // 组装 FAQ 列表（机型专属 + 通用），并预计算搜索文本
    var faqs = [];
    (r.faq || []).forEach(function (f) { faqs.push({ q: f.q, a: f.a, scope: "机型" }); });
    (window.COMMON_FAQ || []).forEach(function (f) { faqs.push({ q: f.q, a: f.a, scope: "通用" }); });
    faqs.forEach(function (f) { f._text = norm([f.q, f.a, f.scope].join(" ")); });
    function renderFaqList(list, tokens) {
      return list.map(function (f) {
        return '<div class="faq-item" data-q="' + escapeHtml(f.q) + '">' +
          '<div class="q">Q：' + highlight(f.q, tokens) + ' <span class="scope scope-' + f.scope + '">' + f.scope + '</span>' +
          '<button type="button" class="locate" data-model="' + escapeHtml(r.model) + '" data-q="' + escapeHtml(f.q) + '">↩ 在列表定位</button></div>' +
          '<div class="a">A：' + highlight(f.a, tokens) + '</div></div>';
      }).join("");
    }

    modalBody.innerHTML =
      '<div class="brand">' + r.brand + '</div>' +
      '<h2>' + r.model + '</h2>' +
      (r.image ? '<img class="detail-img" src="' + r.image + '" alt="' + r.fullName + '" loading="lazy" />' : '') +
      (r.imageCredit ? '<div style="font-size:11px;color:#94a3b8;margin:6px 0 14px">图片：' + r.imageCredit + '</div>' : '') +
      '<div class="spec">' + rows.map(function (kv) {
        return '<div class="item"><span class="k">' + kv[0] + '</span><span class="v">' + (kv[1] != null ? kv[1] : "-") + '</span></div>';
      }).join("") + '</div>' +
      (function () {
        return '<div class="faq"><h3>常见问题（共 ' + faqs.length + ' 条 · 可搜索）</h3>' +
          '<input id="faqSearch" class="faq-search" type="search" placeholder="模糊搜索，支持多关键词，如 密码 双网 / 掉线 / 端口转发…" />' +
          '<div id="faqCount" class="faq-count"></div>' +
          '<div id="faqList" class="faq-list">' + renderFaqList(faqs, []) + '</div></div>';
      })() +
      (r.note ? '<div class="note">⚠ ' + r.note + '</div>' : '');
    var fs = document.getElementById("faqSearch");
    if (fs) {
      var list = document.getElementById("faqList");
      var cnt = document.getElementById("faqCount");
      function filterFaq() {
        var tokens = tokenize(fs.value);
        var shown = 0;
        list.querySelectorAll(".faq-item").forEach(function (it, idx) {
          var f = faqs[idx];
          var ok = tokens.every(function (t) { return f._text.indexOf(t) !== -1; }); // 所有关键词都要命中
          if (ok) {
            shown++;
            it.style.display = "";
            it.innerHTML = '<div class="q">Q：' + highlight(f.q, tokens) +
              ' <span class="scope scope-' + f.scope + '">' + f.scope + '</span>' +
              '<button type="button" class="locate" data-model="' + escapeHtml(r.model) + '" data-q="' + escapeHtml(f.q) + '">↩ 在列表定位</button></div>' +
              '<div class="a">A：' + highlight(f.a, tokens) + '</div>';
          } else {
            it.style.display = "none";
          }
        });
        cnt.textContent = tokens.length ? ("匹配 " + shown + " / " + faqs.length + " 条") : "";
      }
      fs.addEventListener("input", filterFaq);
      filterFaq();
    }
    modal.hidden = false;

    // 关联跳转：从右侧问题列表点击进来时，按问题文本精确定位并高亮（不再依赖索引，杜绝错位）
    if (focusQ) {
      var fList = document.getElementById("faqList");
      if (fList) {
        var nq = norm(focusQ);
        var tgt = null;
        fList.querySelectorAll(".faq-item").forEach(function (it) {
          if (!tgt && norm(it.getAttribute("data-q")) === nq) tgt = it;
        });
        if (tgt) {
          tgt.classList.add("focused");
          setTimeout(function () { tgt.scrollIntoView({ behavior: "smooth", block: "center" }); }, 40);
        }
      }
    }
  }

  cardsEl.addEventListener("click", function (e) {
    var card = e.target.closest(".card");
    if (card) openDetail(card.getAttribute("data-model"));
  });
  document.getElementById("modalClose").addEventListener("click", function () { modal.hidden = true; });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") modal.hidden = true; });

  // 反向关联：详情里点「在列表定位」→ 关闭弹窗并高亮右侧全局列表对应问题
  modalBody.addEventListener("click", function (e) {
    var btn = e.target.closest(".locate");
    if (btn) locateInGlobalList(btn.getAttribute("data-model"), btn.getAttribute("data-q"));
  });
  function locateInGlobalList(model, q) {
    modal.hidden = true;
    if (gSearch) { gSearch.value = ""; renderGlobalFaq([]); }
    var items = gList ? gList.querySelectorAll(".gfaq-item") : [];
    var nq = norm(q);
    items.forEach(function (it) { it.classList.remove("gfocused"); });
    var target = null;
    items.forEach(function (it) {
      if (norm(it.getAttribute("data-q")) !== nq) return;
      var itModel = it.getAttribute("data-model");
      var scopeEl = it.querySelector(".scope");
      var itScope = scopeEl ? scopeEl.textContent.trim() : "";
      // 优先精确匹配机型；通用问题（跨机型一致）也接受
      if (itModel === model || itScope === "通用") target = it;
    });
    if (target) {
      target.classList.add("gfocused");
      setTimeout(function () { target.scrollIntoView({ behavior: "smooth", block: "center" }); }, 30);
      setTimeout(function () { target.classList.remove("gfocused"); }, 2400);
    }
  }

  searchEl.addEventListener("input", render);
  brandEl.addEventListener("change", render);
  wifiEl.addEventListener("change", render);

  render();

  // —— 暗色模式切换（记忆偏好 + 首次跟随系统）——
  var themeToggle = document.getElementById("themeToggle");
  function applyTheme(t) {
    var dark = t === "dark";
    document.documentElement.classList.toggle("dark", dark);
    if (themeToggle) {
      themeToggle.querySelector(".theme-label").textContent = dark ? "浅色" : "深色";
    }
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem("routerdb-theme"); } catch (e) {}
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyTheme("dark");
  }
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = document.documentElement.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("routerdb-theme", next); } catch (e) {}
    });
  }

  // —— 全局问题搜索（右侧面板）：跨全部机型的 FAQ ——
  var commonFaq = window.COMMON_FAQ || [];
  var allModels = data.map(function (r) { return r.model; });
  var allNames = data.map(function (r) { return r.fullName; });
  var globalFaq = [];
  commonFaq.forEach(function (f) {
    globalFaq.push({ q: f.q, a: f.a, scope: "通用", models: allModels, names: allNames });
  });
  data.forEach(function (r) {
    (r.faq || []).forEach(function (f) {
      globalFaq.push({ q: f.q, a: f.a, scope: "机型", models: [r.model], names: [r.fullName], brand: r.brand });
    });
  });
  globalFaq.forEach(function (f) { f._text = norm([f.q, f.a, f.scope].join(" ")); });

  var gSearch = document.getElementById("globalFaqSearch");
  var gList = document.getElementById("globalFaqList");
  var gCount = document.getElementById("globalFaqCount");

  function renderGlobalFaq(tokens) {
    var shown = [];
    globalFaq.forEach(function (f) {
      var ok = !tokens.length || tokens.every(function (t) { return f._text.indexOf(t) !== -1; });
      if (ok) shown.push(f);
    });
    if (!shown.length) {
      gList.innerHTML = '<div class="empty" style="padding:18px 0">没有匹配的问题，试试其它关键词。</div>';
    } else {
      gList.innerHTML = shown.map(function (f) {
        var src = f.scope === "通用" ? "通用 · 全部机型" : (f.brand + " " + f.names[0]);
        return '<div class="faq-item gfaq-item" data-model="' + f.models[0] + '" data-q="' + escapeHtml(f.q) + '">' +
          '<div class="q">Q：' + highlight(f.q, tokens) + ' <span class="scope scope-' + f.scope + '">' + f.scope + '</span></div>' +
          '<div class="a">A：' + highlight(f.a, tokens) + '</div>' +
          '<div class="src">' + src + '</div></div>';
      }).join("");
    }
    gCount.textContent = tokens.length ? ("匹配 " + shown.length + " / " + globalFaq.length + " 条") : ("共 " + globalFaq.length + " 条常见问题");
  }

  if (gSearch) {
    gSearch.addEventListener("input", function () { renderGlobalFaq(tokenize(gSearch.value)); });
    renderGlobalFaq([]);
    gList.addEventListener("click", function (e) {
      var item = e.target.closest(".gfaq-item");
      if (item) openDetail(item.getAttribute("data-model"), item.getAttribute("data-q"));
    });
  }
  // —— 分享：复制当前页面 URL（动态获取，不依赖硬编码 token）——
  var copyBtn = document.getElementById("copyLink");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var url = window.location.href;
      var done = function () {
        copyBtn.textContent = "已复制 ✓";
        copyBtn.classList.add("copied");
        setTimeout(function () { copyBtn.textContent = "复制访问链接"; copyBtn.classList.remove("copied"); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
      } else {
        fallbackCopy(url); done();
      }
    });
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
})();

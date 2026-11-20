(function () {
  "use strict";

  var STORE_KEY = "animal_result_v2";
  var ANSWER_KEY = "animal_answers_v1";
  var HEADINGS = ["别人看到的你", "你放在心上的东西", "容易卡住的地方", "怎么和你相处更舒服"];

  var DATA = null;
  var state = {
    questions: [],
    index: 0,
    answers: {},
    preview: null,
    report: null,
    sharePath: "",
    demoPay: false,
    buyUrl: "",
    free: true,
    submitting: false
  };

  function $(id) { return document.getElementById(id); }

  function loadData() {
    if (DATA) return Promise.resolve(DATA);
    return fetch("data.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("题目加载失败");
        return res.json();
      })
      .then(function (data) { DATA = data; return data; });
  }

  function getStored() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; }
  }

  function saveResult(result) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        answers: state.answers,
        animal: result.animal,
        savedAt: Date.now()
      }));
    } catch (e) {}
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  function show(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("is-active");
    $(id).classList.add("is-active");
    window.scrollTo(0, 0);
    var note = $("topnote");
    if (id === "screen-quiz") note.textContent = "凭第一反应";
    else if (id === "screen-preview") note.textContent = "报告已生成";
    else if (id === "screen-report") note.textContent = "你的动物";
    else note.textContent = "18 道题 · 约 3 分钟";
  }

  function saveAnswers() {
    try { localStorage.setItem(ANSWER_KEY, JSON.stringify(state.answers)); } catch (e) {}
  }

  function loadAnswers() {
    try {
      var raw = localStorage.getItem(ANSWER_KEY);
      if (raw) state.answers = JSON.parse(raw) || {};
    } catch (e) { state.answers = {}; }
  }

  function startQuiz() {
    loadData()
      .then(function (data) {
        state.questions = data.questions;
        var keys = Object.keys(state.answers);
        state.index = Math.min(keys.length, state.questions.length - 1);
        if (keys.length >= state.questions.length) state.index = 0;
        renderQuestion();
        show("screen-quiz");
      })
      .catch(function (err) { toast(err.message || "启动失败"); });
  }

  function renderQuestion() {
    var q = state.questions[state.index];
    if (!q) return;
    $("q-index").textContent = String(state.index + 1).padStart(2, "0");
    $("progress-fill").style.width = ((state.index + 1) / state.questions.length * 100) + "%";
    $("q-kicker").textContent = "第 " + (state.index + 1) + " 题";
    $("q-text").textContent = q.text;
    $("btn-back").disabled = state.index === 0;

    var wrap = $("options");
    wrap.innerHTML = "";
    q.options.forEach(function (opt, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opt" + (String(state.answers[q.id]) === String(i) ? " chosen" : "");
      btn.innerHTML = '<span class="num">0' + (i + 1) + '</span><span class="txt"></span>';
      btn.querySelector(".txt").textContent = opt.text;
      btn.addEventListener("click", function () { choose(q.id, i); });
      wrap.appendChild(btn);
    });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var body = $("q-body");
    if (body.animate) {
      body.animate(
        [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 300, easing: "cubic-bezier(.22,.9,.3,1)" }
      );
    }
  }

  function choose(qid, choice) {
    if (state.submitting) return;
    state.answers[qid] = choice;
    saveAnswers();
    var choices = document.querySelectorAll(".opt");
    for (var i = 0; i < choices.length; i++) choices[i].classList.toggle("chosen", i === choice);

    setTimeout(function () {
      if (state.index < state.questions.length - 1) {
        state.index += 1;
        renderQuestion();
      } else {
        submit();
      }
    }, 180);
  }

  function submit() {
    if (state.submitting) return;
    state.submitting = true;
    if (!state.questions.length) {
      state.submitting = false;
      toast("题目还没加载好");
      return;
    }
    loadData().then(function (data) {
      var result = AnimalEngine.score(state.answers, data);
      var report = AnimalEngine.buildReport(result, data);
      state.report = report;
      state.preview = {
        animal: result.animal,
        animal_name: report.animal_name,
        hook: report.hook,
        traits: report.traits
      };
      state.sharePath = "r/?a=" + encodeURIComponent(result.animal);
      saveResult(result);
      state.submitting = false;
      renderReport(report);
    }).catch(function (err) {
      state.submitting = false;
      toast(err.message || "提交失败，请重试");
    });
  }

  function fitChar(el, name, one, two, three) {
    var size = name.length >= 3 ? three : (name.length === 2 ? two : one);
    el.style.fontSize = size + "px";
  }

  function renderPreview() {
    var p = state.preview;
    if (!p) return;
    $("preview-char").textContent = p.animal_name;
    fitChar($("preview-char"), p.animal_name, 92, 68, 50);
    $("preview-name").textContent = p.animal_name;
    $("preview-hook").textContent = p.hook;
    var traits = $("preview-traits");
    traits.innerHTML = "";
    (p.traits || []).forEach(function (t) {
      var s = document.createElement("span");
      s.textContent = t;
      traits.appendChild(s);
    });
  }

  function renderReport(report) {
    state.report = report;
    if (report.share_path) state.sharePath = report.share_path;
    $("report-char").textContent = report.animal_name;
    fitChar($("report-char"), report.animal_name, 58, 42, 30);
    $("report-name").textContent = report.animal_name;
    $("report-hook").textContent = report.hook;

    var traits = $("report-traits");
    traits.innerHTML = "";
    (report.traits || []).forEach(function (t) {
      var s = document.createElement("span");
      s.textContent = t;
      traits.appendChild(s);
    });

    var body = $("report-body");
    body.innerHTML = "";
    report.paragraphs.forEach(function (text, i) {
      var section = document.createElement("section");
      var h = document.createElement("h3");
      h.textContent = HEADINGS[i] || "";
      var p = document.createElement("p");
      p.textContent = text;
      section.appendChild(h);
      section.appendChild(p);
      body.appendChild(section);
    });

    $("report-contrast").textContent = report.contrast;
    $("report-secondary").textContent = report.secondary_line || "";
    $("report-quote").textContent = report.quote;
    $("quote-sign").textContent = report.animal_name + " · 动物人格";
    $("report-disclaimer").textContent = report.disclaimer;

    drawRadar($("radar"), report.dims);
    show("screen-report");
  }

  function loadReport() {
    var stored = getStored();
    if (!stored || !stored.answers) return Promise.resolve(null);
    return loadData().then(function (data) {
      state.answers = stored.answers;
      var result = AnimalEngine.score(state.answers, data);
      var report = AnimalEngine.buildReport(result, data);
      state.report = report;
      state.preview = {
        animal: result.animal,
        animal_name: report.animal_name,
        hook: report.hook,
        traits: report.traits
      };
      state.sharePath = "r/?a=" + encodeURIComponent(result.animal);
      renderReport(report);
      return report;
    });
  }

  function restoreSession() {
    if (!getStored()) return Promise.resolve(false);
    return loadReport().then(function (report) { return !!report; })
      .catch(function () { return false; });
  }

  // ---------- 雷达图 ----------
  function drawRadar(canvas, dims) {
    if (!canvas || !dims || !dims.length) return;
    var rect = canvas.getBoundingClientRect();
    var cssW = rect.width || 320;
    var cssH = Math.round(cssW * 0.875);
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + "px";

    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var cx = cssW / 2;
    var cy = cssH / 2 + 6;
    var radius = Math.min(cssW, cssH) * 0.31;
    var n = 5;
    var start = -Math.PI / 2;

    function point(i, r) {
      var a = start + (Math.PI * 2 * i) / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }

    // 网格
    for (var ring = 4; ring >= 1; ring--) {
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var p = point(i, radius * ring / 4);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === 4 ? "rgba(27,24,20,.28)" : "rgba(27,24,20,.12)";
      ctx.lineWidth = ring === 4 ? 1 : 0.8;
      ctx.stroke();
    }

    // 轴线
    for (var j = 0; j < n; j++) {
      var e = point(j, radius);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(e[0], e[1]);
      ctx.strokeStyle = "rgba(27,24,20,.13)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // 数据面
    ctx.beginPath();
    dims.forEach(function (d, i) {
      var r = radius * Math.max(0.04, Math.min(1, d.pct / 100));
      var p = point(i, r);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(178,58,38,.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(178,58,38,.9)";
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.stroke();

    // 顶点
    dims.forEach(function (d, i) {
      var r = radius * Math.max(0.04, Math.min(1, d.pct / 100));
      var p = point(i, r);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = "#b23a26";
      ctx.fill();
    });

    // 标签
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    dims.forEach(function (d, i) {
      var lp = point(i, radius + Math.min(46, cssW * 0.11));
      ctx.fillStyle = "#6f6557";
      ctx.font = '500 12px "PingFang SC","Hiragino Sans GB",sans-serif';
      ctx.fillText(d.name, lp[0], lp[1] - 8);
      ctx.fillStyle = "#1b1814";
      ctx.font = '600 13px "PingFang SC","Hiragino Sans GB",sans-serif';
      ctx.fillText(String(d.pct), lp[0], lp[1] + 9);
    });
  }

  // ---------- 分享卡 ----------
  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    var line = "";
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = text[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function makeShareCard() {
    var report = state.report;
    if (!report) return null;
    var W = 1080;
    var H = 1440;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f2ebdd";
    ctx.fillRect(0, 0, W, H);

    var grad = ctx.createRadialGradient(880, 120, 40, 880, 120, 700);
    grad.addColorStop(0, "rgba(255,255,255,.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 大背景字
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = "#1b1814";
    ctx.font = '600 700px "Songti SC","STSong","SimSun",serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(report.animal_name, W / 2, H / 2 - 20);
    ctx.restore();

    ctx.strokeStyle = "rgba(27,24,20,.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, W - 96, H - 96);

    ctx.fillStyle = "#6f6557";
    ctx.font = '400 26px "PingFang SC","Hiragino Sans GB",sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("薪火木 · 小测", 92, 132);
    ctx.textAlign = "right";
    ctx.fillText("看看你心里藏了什么动物", W - 92, 132);

    // 动物名
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#b23a26";
    ctx.font = '600 232px "Songti SC","STSong","SimSun",serif';
    ctx.fillText(report.animal_name, W / 2, 420);

    // 标签行
    ctx.fillStyle = "#1b1814";
    ctx.font = '600 40px "Songti SC","STSong","SimSun",serif';
    ctx.fillText(report.animal_name + " · " + (report.traits[0] || ""), W / 2, 588);

    // 钩子
    ctx.font = '400 42px "Songti SC","STSong","SimSun",serif';
    ctx.fillStyle = "#38322a";
    var hookLines = wrapText(ctx, report.hook, 800);
    hookLines.slice(0, 2).forEach(function (line, i) {
      ctx.fillText(line, W / 2, 668 + i * 60);
    });

    // 雷达
    var cx = W / 2;
    var cy = 962;
    var radius = 148;
    function pt(i, r) {
      var a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    for (var ring = 4; ring >= 1; ring--) {
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var p = pt(i, radius * ring / 4);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === 4 ? "rgba(27,24,20,.26)" : "rgba(27,24,20,.13)";
      ctx.lineWidth = ring === 4 ? 1.6 : 1.2;
      ctx.stroke();
    }
    for (var j = 0; j < 5; j++) {
      var e = pt(j, radius);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(e[0], e[1]);
      ctx.strokeStyle = "rgba(27,24,20,.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    report.dims.forEach(function (d, i) {
      var p = pt(i, radius * Math.max(0.06, d.pct / 100));
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(178,58,38,.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(178,58,38,.9)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.textBaseline = "middle";
    report.dims.forEach(function (d, i) {
      var lp = pt(i, radius + 66);
      ctx.fillStyle = "#6f6557";
      ctx.font = '500 24px "PingFang SC","Hiragino Sans GB",sans-serif';
      ctx.fillText(d.name, lp[0], lp[1] - 15);
      ctx.fillStyle = "#1b1814";
      ctx.font = '600 28px "PingFang SC","Hiragino Sans GB",sans-serif';
      ctx.fillText(String(d.pct), lp[0], lp[1] + 17);
    });

    // 金句
    ctx.strokeStyle = "rgba(27,24,20,.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(130, 1194);
    ctx.lineTo(W - 130, 1194);
    ctx.stroke();

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#1b1814";
    ctx.font = '600 42px "Songti SC","STSong","SimSun",serif';
    var quoteLines = wrapText(ctx, report.quote, 860);
    quoteLines = quoteLines.slice(0, 2);
    quoteLines[0] = "\u201c" + quoteLines[0];
    quoteLines[quoteLines.length - 1] = quoteLines[quoteLines.length - 1] + "\u201d";
    var qy = quoteLines.length === 1 ? 1258 : 1224;
    quoteLines.forEach(function (line, i) {
      ctx.fillText(line, W / 2, qy + i * 62);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#9b9080";
    ctx.font = '400 22px "PingFang SC","Hiragino Sans GB",sans-serif';
    ctx.fillText("这是一份性格倾向参考，不构成专业评估。", W / 2, 1384);

    return canvas;
  }

  function isWeChat() {
    return /MicroMessenger/i.test(navigator.userAgent);
  }

  function shareUrl() {
    if (!state.sharePath) return new URL("./", location.href).href;
    if (/^https?:/i.test(state.sharePath)) return state.sharePath;
    return new URL(state.sharePath, location.href).href;
  }

  function copyText(text) {
    var ok = false;
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(function () {});
      ok = true;
    }
    return ok;
  }

  function showShareTip() {
    $("share-tip").hidden = false;
  }

  function shareOut() {
    var name = state.report ? state.report.animal_name : "";
    var url = shareUrl();
    var text = "我心里藏着一只" + name + "。你也来测测？";
    if (isWeChat()) {
      copyText(url);
      showShareTip();
      return;
    }
    if (navigator.share) {
      navigator.share({ title: "看看你心里藏了什么动物", text: text, url: url }).catch(function (err) {
        if (err && err.name === "AbortError") return;
        copyText(url);
        toast("链接已复制，发给朋友吧");
      });
      return;
    }
    if (copyText(url)) toast("链接已复制，发给朋友吧");
    else toast("复制失败，请长按地址栏复制");
  }

  window.__makeShareCard = makeShareCard;
  window.__makeShareCardFor = function (demoReport) {
    var saved = state.report;
    state.report = demoReport;
    var canvas = makeShareCard();
    state.report = saved;
    return canvas;
  };

  function showImgTip(canvas) {
    $("img-tip-img").src = canvas.toDataURL("image/png");
    $("img-tip").hidden = false;
  }

  function downloadShare() {
    var canvas = makeShareCard();
    if (!canvas) return;
    if (isWeChat()) { showImgTip(canvas); return; }
    canvas.toBlob(function (blob) {
      if (!blob) { toast("生成失败，请重试"); return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "动物人格-" + (state.report ? state.report.animal_name : "结果") + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
      toast("分享卡已保存");
    }, "image/png");
  }

  function copyQuote() {
    var text = state.report ? state.report.quote : "";
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("金句已复制"); },
        function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("金句已复制"); }
    catch (e) { toast("复制失败，长按选中吧"); }
    ta.remove();
  }

  // ---------- 解锁 ----------
  function applyFreeMode() {
    if (!state.free) return;
    $("meta-price-num").textContent = "免费";
    $("meta-price-label").textContent = "看全文";
    $("intro-tiny").textContent = "答完直接看全文，不收钱。觉得像，把卡片转给一个你想到的人。";
    $("preview-note").textContent = "免费版直接看全文。";
  }

  function openSheet() {
    if (!state.preview) { toast("先答完题"); return; }
    $("sheet-mask").hidden = false;
    $("sheet-note").textContent = state.demoPay
      ? "演示环境不会真扣钱。正式收款走平台下单，发一次性解锁码。"
      : (state.buyUrl
        ? "下单后会自动发解锁码，回来填上就能看。"
        : "购买后凭一次性解锁码查看完整报告。");
    $("btn-demo-pay").style.display = state.demoPay ? "" : "none";
    var buy = $("btn-buy");
    if (state.buyUrl && !state.demoPay) {
      buy.href = state.buyUrl;
      buy.hidden = false;
    } else {
      buy.hidden = true;
    }
  }

  function closeSheet() { $("sheet-mask").hidden = true; }

  function unlock() {
    closeSheet();
    toast("免费版已经能看全文");
  }

  function retest() {
    localStorage.removeItem(ANSWER_KEY);
    localStorage.removeItem(STORE_KEY);
    state.answers = {};
    state.preview = null;
    state.report = null;
    state.index = 0;
    state.submitting = false;
    startQuiz();
  }

  // ---------- 事件 ----------
  $("btn-start").addEventListener("click", startQuiz);
  $("btn-back").addEventListener("click", function () {
    if (state.index > 0) {
      state.index -= 1;
      renderQuestion();
    }
  });
  $("btn-unlock").addEventListener("click", openSheet);
  $("btn-unlock-code").addEventListener("click", function () {
    openSheet();
    setTimeout(function () { $("unlock-code").focus(); }, 260);
  });
  $("btn-demo-pay").addEventListener("click", function () { unlock({ mode: "demo" }); });
  $("btn-code-submit").addEventListener("click", function () {
    var code = $("unlock-code").value.trim();
    if (!code) { toast("先填解锁码"); return; }
    unlock({ mode: "code", code: code });
  });
  $("unlock-code").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("btn-code-submit").click();
  });
  $("sheet-close").addEventListener("click", closeSheet);
  $("sheet-mask").addEventListener("click", function (e) {
    if (e.target === $("sheet-mask")) closeSheet();
  });
  $("btn-share").addEventListener("click", shareOut);
  $("btn-save-card").addEventListener("click", downloadShare);
  $("share-tip-close").addEventListener("click", function () { $("share-tip").hidden = true; });
  $("img-tip-close").addEventListener("click", function () { $("img-tip").hidden = true; });
  $("img-tip").addEventListener("click", function (e) {
    if (e.target === $("img-tip")) $("img-tip").hidden = true;
  });
  $("share-tip").addEventListener("click", function (e) {
    if (e.target === $("share-tip")) $("share-tip").hidden = true;
  });
  $("btn-copy").addEventListener("click", copyQuote);
  $("btn-retest").addEventListener("click", retest);

  window.addEventListener("resize", function () {
    if (state.report) drawRadar($("radar"), state.report.dims);
  });

  window.App = {
    home: function (e) {
      if (e) e.preventDefault();
      if (state.report) show("screen-report");
      else if (state.preview) show("screen-preview");
      else show("screen-intro");
    }
  };

  // ---------- 启动 ----------
  loadAnswers();
  state.free = true;
  applyFreeMode();
  loadData().then(function () {
    $("preview-note").textContent = "免费版直接看全文，不收钱。";
    $("unlock-code").placeholder = "免费版不需要解锁码";
  }).catch(function () { toast("题目加载失败，检查网络"); });

  restoreSession().then(function (restored) {
    if (!restored) show("screen-intro");
  }).catch(function () { show("screen-intro"); });
})();

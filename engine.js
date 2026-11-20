/* 计分与报告拼装，和 core/engine.py、core/report.py 保持同一套规则。
   纯函数，不碰 DOM，便于 node 里跑回归测试。 */
(function (root) {
  "use strict";

  var DIMS = ["S", "D", "O", "E", "P"];

  function boundsOf(questions) {
    var bounds = {};
    questions.forEach(function (q) {
      var low = {}, high = {};
      DIMS.forEach(function (dim) {
        var values = q.options.map(function (opt) {
          return Number((opt.w && opt.w[dim]) || 0);
        });
        low[dim] = Math.min.apply(null, values);
        high[dim] = Math.max.apply(null, values);
      });
      bounds[q.id] = { low: low, high: high };
    });
    return bounds;
  }

  // Python 的 round() 是四舍六入五取偶，这里保持一致，避免同一份答案两边差 1 分。
  function pyRound(x) {
    var floor = Math.floor(x);
    var diff = x - floor;
    if (diff > 0.5) return floor + 1;
    if (diff < 0.5) return floor;
    return floor % 2 === 0 ? floor : floor + 1;
  }

  function levelFromPct(cuts, pct) {
    var a = cuts[0], b = cuts[1], c = cuts[2], d = cuts[3];
    if (pct < a) return 1;
    if (pct < b) return 2;
    if (pct < c) return 3;
    if (pct < d) return 4;
    return 5;
  }

  function distance(vector, target) {
    var sum = 0;
    for (var i = 0; i < vector.length; i++) {
      sum += Math.pow(vector[i] - target[i], 2);
    }
    return Math.sqrt(sum);
  }

  function score(answers, data) {
    var questions = data.questions;
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var bounds = boundsOf(questions);

    var raw = {}, lowSum = {}, highSum = {};
    DIMS.forEach(function (dim) { raw[dim] = 0; lowSum[dim] = 0; highSum[dim] = 0; });

    var answered = 0;
    Object.keys(answers).forEach(function (key) {
      var qid = parseInt(key, 10);
      var choice = parseInt(answers[key], 10);
      var q = byId[qid];
      if (!q) throw new Error("题目不存在：" + key);
      if (!(choice >= 0 && choice < q.options.length)) throw new Error("选项不存在：" + answers[key]);
      var weights = q.options[choice].w || {};
      DIMS.forEach(function (dim) {
        raw[dim] += Number(weights[dim] || 0);
        lowSum[dim] += bounds[qid].low[dim];
        highSum[dim] += bounds[qid].high[dim];
      });
      answered += 1;
    });

    if (answered !== questions.length) throw new Error("还有题没答");

    var dims = [];
    var levels = [];
    DIMS.forEach(function (dim) {
      var span = highSum[dim] - lowSum[dim];
      var pct = span <= 0 ? 50 : (raw[dim] - lowSum[dim]) * 100 / span;
      pct = Math.max(0, Math.min(100, pct));
      var level = levelFromPct(data.level_cuts[dim], pct);
      levels.push(level);
      dims.push({
        key: dim,
        name: data.dim_names[dim],
        pct: pyRound(pct),
        level: level
      });
    });

    var ranked = Object.keys(data.archetypes).map(function (key) {
      var animal = data.archetypes[key];
      return { key: key, name: animal.name, vector: animal.vector, d: distance(levels, animal.vector) };
    });
    ranked.sort(function (a, b) {
      if (a.d !== b.d) return a.d - b.d;
      return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
    });

    var primary = ranked[0];
    var second = ranked[1];
    var gap = second.d - primary.d;

    return {
      dims: dims,
      vector: levels,
      animal: primary.key,
      animal_name: primary.name,
      secondary: gap <= data.secondary_gap ? second.key : null,
      secondary_name: gap <= data.secondary_gap ? second.name : null,
      distance: Math.round(primary.d * 1000) / 1000
    };
  }

  function buildReport(result, data) {
    var animal = data.animals[result.animal];
    var dims = result.dims;
    var order = dims.map(function (d, i) { return { d: d, i: i }; });
    order.sort(function (a, b) {
      if (b.d.pct !== a.d.pct) return b.d.pct - a.d.pct;
      return a.i - b.i;
    });
    var ordered = order.map(function (item) { return item.d; });
    var top = ordered.slice(0, 3).map(function (d) { return d.key; });
    var low = ordered.slice(-3).reverse().map(function (d) { return d.key; });

    var p2 = "你在意的东西，多半和这两件事有关。"
      + data.dim_high[top[0]] + data.dim_high[top[1]]
      + "再往里一点，" + data.dim_high[top[2]]
      + "这几样凑在一起，就成了你做事的方式。"
      + "你不太会把它们挂在嘴上，可真到选择的时候，它们会替你说话。";

    var p3 = "容易卡住你的地方，也在这里。"
      + data.dim_low[low[0]] + data.dim_stuck[low[0]]
      + data.dim_low[low[1]]
      + "再往深一层，" + data.dim_low[low[2]] + data.dim_stuck[low[2]]
      + "你未必不知道，只是当场很难改。人跟自己的性子较劲，赢的时候少，累的时候多。"
      + "先认下来，再谈怎么用。看清自己这件事，本来就急不来。";

    var paragraphs = [animal.p1, p2, p3, animal.p4];
    var secondary = result.secondary_name;

    return {
      animal: result.animal,
      animal_name: animal.name,
      hook: animal.hook,
      traits: animal.traits,
      dims: dims,
      paragraphs: paragraphs,
      contrast: animal.contrast,
      quote: animal.quote,
      secondary_name: secondary,
      secondary_line: secondary ? ("你身上还有一点" + secondary + "的影子。") : "",
      disclaimer: data.disclaimer,
      body_length: paragraphs.join("").length
    };
  }

  var engine = { DIMS: DIMS, score: score, buildReport: buildReport };
  root.AnimalEngine = engine;
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
})(typeof window !== "undefined" ? window : globalThis);

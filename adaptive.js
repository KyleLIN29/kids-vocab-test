/* Adaptive question engine for 单词听听看. Pure logic, no DOM.
   Works in the browser and in Node (for simulations). */
(function (root) {
  "use strict";

  var MAX_QUESTIONS = 120;
  var JUMP2_PROB = 0.62;
  var PREVIEW_MAX = 1;
  var CONFIDENCE_PROB = 0.45;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function decideStatus(asked, correct) {
    if (asked === 3 && correct === 3) return "pass";
    if (asked === 3 && correct <= 1) return "fail";
    if (asked === 3 && correct === 2) return null;
    if (asked === 5) return correct >= 4 ? "pass" : "near";
    if (asked > 5) {
      var p = correct / asked;
      if (p <= 1 / 3) return "fail";
      if (p >= 0.8) return "pass";
      return "near";
    }
    return null;
  }

  function computeScore(levels, levelResults) {
    var n = levels.length;
    var q = [];
    var i;
    for (i = 0; i < n; i++) q[i] = null;
    var first = -1, last = -1;
    var byId = {};
    levelResults.forEach(function (r) { byId[r.id] = r; });
    for (i = 0; i < n; i++) {
      var r = byId[levels[i].id];
      if (r && r.asked > 0) {
        var p = r.correct / r.asked;
        q[i] = Math.max(0, (p * 3 - 1) / 2);
        if (first < 0) first = i;
        last = i;
      }
    }
    if (first < 0) {
      return { q: q.map(function () { return 0; }), estimate: 0, rounded: 0, attained: null, first: first, last: last };
    }
    for (i = 0; i < first; i++) q[i] = 1;
    for (i = last + 1; i < n; i++) q[i] = 0;
    i = first;
    while (i <= last) {
      if (q[i] !== null) { i++; continue; }
      var a = i - 1;
      var b = i + 1;
      while (b <= last && q[b] === null) b++;
      var k;
      for (k = a + 1; k < b; k++) {
        q[k] = q[a] + ((k - a) / (b - a)) * (q[b] - q[a]);
      }
      i = b;
    }
    var raw = 0;
    for (i = 0; i < n; i++) raw += (q[i] || 0) * (levels[i].newWordCount || 0);
    var rounded = Math.round(raw / 10) * 10;
    var attained = null;
    for (i = 0; i < n; i++) {
      var lr = byId[levels[i].id];
      if (lr && lr.asked >= 3 && lr.correct / lr.asked >= 0.7) attained = lr.id;
    }
    return { q: q, estimate: raw, rounded: rounded, attained: attained, first: first, last: last };
  }

  function createEngine(levels, options) {
    options = options || {};
    var rng = options.rng || Math.random;
    var n = levels.length;

    var stats = [];
    var i;
    for (i = 0; i < n; i++) {
      stats.push({ asked: 0, correct: 0, status: null, askedWords: [] });
    }

    var focus = 0;
    var highestReached = 1;
    var totalAsked = 0;
    var answers = [];
    var levelResults = [];
    var streak = 0;
    var lastCorrect = true;
    var confidenceUsed = 0;
    var queue = [];
    var done = false;
    var current = null;
    var isFirstQuestion = true;
    var lastClosedIndex = -1;

    function hasPool(idx) {
      if (idx < 0 || idx >= n) return false;
      var used = stats[idx].askedWords;
      return levels[idx].pool.some(function (w) { return used.indexOf(w.word) === -1; });
    }

    function pickWord(idx) {
      var used = stats[idx].askedWords;
      var avail = levels[idx].pool.filter(function (w) { return used.indexOf(w.word) === -1; });
      if (!avail.length) return null;
      return shuffle(avail, rng)[0];
    }

    function needsMore(idx) {
      if (idx < 0 || idx >= n) return false;
      if (stats[idx].status) return false;
      if (!hasPool(idx) && stats[idx].asked > 0) return false;
      var d = decideStatus(stats[idx].asked, stats[idx].correct);
      if (d) return false;
      var a = stats[idx].asked, c = stats[idx].correct;
      if (a < 3) return true;
      if (a === 3 && c === 2) return true;
      return false;
    }

    function adjacentFails() {
      var failed = [];
      for (var k = 0; k < n; k++) if (stats[k].status === "fail") failed.push(k);
      for (var j = 0; j < failed.length - 1; j++) {
        if (failed[j + 1] - failed[j] === 1) return true;
      }
      return false;
    }

    function nextOpenFrom(start) {
      for (var k = Math.max(0, start); k < n; k++) {
        if (!stats[k].status) return k;
      }
      return -1;
    }

    function shouldStop() {
      if (totalAsked >= MAX_QUESTIONS) return true;
      if (adjacentFails()) return true;
      if (stats[n - 1].status === "pass" || stats[n - 1].status === "near") {
        var retreat = false;
        for (var k = 0; k < n; k++) {
          if (stats[k].status === "fail" && k - 1 >= 0 && !stats[k - 1].status) retreat = true;
        }
        if (!retreat) return true;
      }
      return false;
    }

    function pushResult(idx, status) {
      var exists = -1;
      for (var k = 0; k < levelResults.length; k++) {
        if (levelResults[k].index === idx) exists = k;
      }
      var p = stats[idx].asked ? stats[idx].correct / stats[idx].asked : 0;
      var missed = answers.filter(function (a) {
        return a.levelIndex === idx && !a.correct;
      }).map(function (a) { return a.word; });
      var row = {
        id: levels[idx].id,
        index: idx,
        asked: stats[idx].asked,
        correct: stats[idx].correct,
        p: p,
        status: status,
        unknown: missed
      };
      if (exists >= 0) levelResults[exists] = row;
      else levelResults.push(row);
    }

    function closeLevel(idx, status) {
      if (stats[idx].status) return;
      stats[idx].status = status;
      pushResult(idx, status);
      lastClosedIndex = idx;
      confidenceUsed = 0;
      queue = [];
      advanceAfterClose(idx, status);
    }

    function forceClose(idx) {
      if (stats[idx].status) return;
      if (stats[idx].asked === 0) return;
      var st = decideStatus(stats[idx].asked, stats[idx].correct);
      if (!st) {
        var p = stats[idx].correct / stats[idx].asked;
        if (p >= 0.7) st = "pass";
        else if (p <= 1 / 3) st = "fail";
        else st = "near";
      }
      closeLevel(idx, st);
    }

    function tryClose(idx) {
      var st = decideStatus(stats[idx].asked, stats[idx].correct);
      if (st) closeLevel(idx, st);
      else if (!hasPool(idx) && stats[idx].asked > 0 && !stats[idx].status) forceClose(idx);
    }

    function advanceAfterClose(idx, status) {
      if (shouldStop()) { done = true; return; }

      if (status === "fail") {
        if (idx - 1 >= 0 && !stats[idx - 1].status) {
          focus = idx - 1;
          return;
        }
        var up = nextOpenFrom(idx + 1);
        if (up < 0) { done = true; return; }
        if (up > idx + 2 && idx + 1 < n && !stats[idx + 1].status) up = idx + 1;
        focus = up;
        return;
      }

      var jump = 1;
      var perfect = status === "pass" && stats[idx].correct === stats[idx].asked && stats[idx].asked >= 3;
      if (perfect && streak >= 3 && idx + 2 < n && rng() < JUMP2_PROB) jump = 2;
      jump = Math.min(jump, 2);
      var target = Math.min(idx + jump, n - 1);
      if (stats[target].status) {
        var alt = nextOpenFrom(idx + 1);
        if (alt < 0) { done = true; return; }
        if (alt > idx + 2) {
          if (idx + 2 < n && !stats[idx + 2].status) alt = idx + 2;
          else if (idx + 1 < n && !stats[idx + 1].status) alt = idx + 1;
        }
        focus = alt;
        return;
      }
      focus = target;
    }

    function repointFocus() {
      if (focus >= 0 && focus < n && !stats[focus].status) return true;
      for (var k = 0; k < n; k++) {
        if (stats[k].status === "fail" && k - 1 >= 0 && !stats[k - 1].status) {
          focus = k - 1;
          return true;
        }
      }
      var start = lastClosedIndex >= 0 ? lastClosedIndex + 1 : 0;
      var open = nextOpenFrom(start);
      if (open < 0) open = nextOpenFrom(0);
      if (open < 0) return false;
      if (lastClosedIndex >= 0 && open > lastClosedIndex + 2) {
        if (lastClosedIndex + 2 < n && !stats[lastClosedIndex + 2].status) open = lastClosedIndex + 2;
        else if (lastClosedIndex + 1 < n && !stats[lastClosedIndex + 1].status) open = lastClosedIndex + 1;
      }
      focus = open;
      return true;
    }

    function buildQueue() {
      queue = [];
      if (focus < 0 || focus >= n || stats[focus].status) return;
      var need = 0;
      var a = stats[focus].asked, c = stats[focus].correct;
      if (needsMore(focus)) {
        if (a < 3) need = 3 - a;
        else if (a === 3 && c === 2) need = 2;
        else need = 1;
      }
      var k;
      for (k = 0; k < need; k++) queue.push(focus);

      var up = focus + 1;
      var includePreview = streak < 3;
      if (up < n && !stats[up].status && hasPool(up) && stats[up].asked < PREVIEW_MAX && includePreview) {
        queue.push(up);
      }

      var struggling = (a > 0 && c < a) || !lastCorrect;
      var down = focus - 1;
      if (struggling && down >= 0 && !stats[down].status && hasPool(down) && stats[down].asked < 3) {
        queue.push(down);
      }

      queue = shuffle(queue, rng);
      if (isFirstQuestion) {
        var at = queue.indexOf(focus);
        if (at > 0) {
          queue.splice(at, 1);
          queue.unshift(focus);
        } else if (at < 0 && need > 0) {
          queue.unshift(focus);
        }
      }
    }

    function nextQuestion() {
      if (current) return current;
      if (done || shouldStop()) { done = true; return null; }

      for (var guard = 0; guard < 50 && !done; guard++) {
        if (shouldStop()) { done = true; break; }
        if (totalAsked >= MAX_QUESTIONS) { done = true; break; }
        if (!repointFocus()) { done = true; break; }
        if (!queue.length) buildQueue();

        while (queue.length) {
          var li = queue.shift();
          if (li < 0 || li >= n) continue;
          if (stats[li].status) continue;
          if (!hasPool(li)) {
            tryClose(li);
            continue;
          }
          if (li !== focus && li === focus + 1 && stats[li].asked >= PREVIEW_MAX && needsMore(focus)) {
            continue;
          }
          var word = pickWord(li);
          if (!word) {
            tryClose(li);
            continue;
          }
          current = { levelIndex: li, item: word, levelId: levels[li].id };
          stats[li].askedWords.push(word.word);
          totalAsked += 1;
          highestReached = Math.max(highestReached, li + 1);
          isFirstQuestion = false;
          return current;
        }

        if (needsMore(focus)) {
          if (hasPool(focus)) {
            queue.push(focus);
            continue;
          }
          forceClose(focus);
          continue;
        }
        if (!stats[focus].status && stats[focus].asked > 0) {
          forceClose(focus);
          continue;
        }
        if (!stats[focus].status && stats[focus].asked === 0 && hasPool(focus)) {
          queue.push(focus);
          continue;
        }
        if (!repointFocus()) { done = true; break; }
        if (focus >= 0 && !stats[focus].status && hasPool(focus)) {
          queue.push(focus);
          continue;
        }
        done = true;
        break;
      }
      return current;
    }

    function recordAnswer(correct) {
      if (!current || done) return;
      var li = current.levelIndex;
      var word = current.item.word;
      stats[li].asked += 1;
      if (correct) {
        stats[li].correct += 1;
        streak += 1;
      } else {
        streak = 0;
      }
      lastCorrect = !!correct;
      answers.push({
        word: word,
        level: levels[li].id,
        levelIndex: li,
        correct: !!correct
      });

      tryClose(li);

      if (!correct && !done && focus > 0 && confidenceUsed < 1) {
        var down = focus - 1;
        if (!stats[down].status && hasPool(down) && stats[down].asked < 3 && rng() < CONFIDENCE_PROB) {
          queue.unshift(down);
          confidenceUsed += 1;
        }
      }

      current = null;
      if (shouldStop()) done = true;
    }

    function finalizeResults() {
      for (var k = 0; k < n; k++) {
        if (!stats[k].status && stats[k].asked > 0) pushResult(k, "partial");
      }
    }

    function score() {
      finalizeResults();
      return computeScore(levels, levelResults);
    }

    return {
      nextQuestion: nextQuestion,
      recordAnswer: recordAnswer,
      isDone: function () { return done; },
      getFocus: function () { return focus; },
      getHighest: function () { return highestReached; },
      getState: function () {
        return {
          done: done,
          focus: focus,
          focusId: levels[focus] ? levels[focus].id : null,
          highestReached: highestReached,
          currentLevelIndex: current ? current.levelIndex : null,
          currentLevel: current ? current.levelId : (levels[focus] ? levels[focus].id : null),
          currentWord: current ? current.item.word : null,
          totalAsked: totalAsked,
          streak: streak,
          answers: answers.slice(),
          levelResults: levelResults.slice(),
          stats: stats.map(function (s, idx) {
            return {
              id: levels[idx].id,
              asked: s.asked,
              correct: s.correct,
              status: s.status
            };
          })
        };
      },
      computeScore: score,
      finalizeResults: finalizeResults
    };
  }

  /* Previous deterministic engine, for simulation comparison only. */
  function createLegacyEngine(levels, options) {
    options = options || {};
    var rng = options.rng || Math.random;
    var n = levels.length;
    var levelIndex = 0;
    var totalAsked = 0;
    var consecutiveFails = 0;
    var askedWords = [];
    var levelAskedCount = 0;
    var levelCorrect = 0;
    var levelResults = [];
    var answers = [];
    var current = null;
    var done = false;

    function hasAvail() {
      return levels[levelIndex].pool.some(function (w) {
        return askedWords.indexOf(w.word) === -1;
      });
    }
    function pickWord() {
      var avail = levels[levelIndex].pool.filter(function (w) {
        return askedWords.indexOf(w.word) === -1;
      });
      if (!avail.length) return null;
      return shuffle(avail, rng)[0];
    }
    function closeLevel(status) {
      var lv = levels[levelIndex];
      var p = levelAskedCount ? levelCorrect / levelAskedCount : 0;
      var missed = answers.filter(function (a) {
        return a.level === lv.id && !a.correct;
      }).map(function (a) { return a.word; });
      levelResults.push({
        id: lv.id, index: levelIndex, asked: levelAskedCount,
        correct: levelCorrect, p: p, status: status, unknown: missed
      });
      if (status === "fail") consecutiveFails += 1;
      else consecutiveFails = 0;
    }
    function beginLevel(i) {
      levelIndex = i;
      askedWords = [];
      levelAskedCount = 0;
      levelCorrect = 0;
    }
    function maybeAdvance(status) {
      closeLevel(status);
      if (consecutiveFails >= 2 || levelIndex >= n - 1 || totalAsked >= MAX_QUESTIONS) {
        done = true;
        return;
      }
      beginLevel(levelIndex + 1);
    }
    function afterAnswer() {
      var asked = levelAskedCount, correct = levelCorrect;
      var hitCap = totalAsked >= MAX_QUESTIONS;
      if (asked === 3 && correct === 3) { maybeAdvance("pass"); return; }
      if (asked === 3 && correct <= 1) { maybeAdvance("fail"); return; }
      if (asked === 3 && correct === 2) {
        if (hitCap) { maybeAdvance("near"); return; }
        return;
      }
      if (asked === 5) { maybeAdvance(correct >= 4 ? "pass" : "near"); return; }
      if (hitCap) {
        var st = decideStatus(asked, correct) || "near";
        maybeAdvance(st);
      }
    }

    function nextQuestion() {
      if (current) return current;
      if (done) return null;
      if (!hasAvail()) {
        maybeAdvance(decideStatus(levelAskedCount, levelCorrect) || "near");
        if (done) return null;
      }
      var word = pickWord();
      if (!word) { done = true; return null; }
      askedWords.push(word.word);
      totalAsked += 1;
      current = { levelIndex: levelIndex, item: word, levelId: levels[levelIndex].id };
      return current;
    }

    function recordAnswer(correct) {
      if (!current || done) return;
      levelAskedCount += 1;
      if (correct) levelCorrect += 1;
      answers.push({
        word: current.item.word,
        level: levels[levelIndex].id,
        levelIndex: levelIndex,
        correct: !!correct
      });
      current = null;
      afterAnswer();
    }

    return {
      nextQuestion: nextQuestion,
      recordAnswer: recordAnswer,
      isDone: function () { return done; },
      getState: function () {
        return {
          done: done,
          currentLevelIndex: current ? current.levelIndex : levelIndex,
          currentLevel: current ? current.levelId : (levels[levelIndex] && levels[levelIndex].id),
          currentWord: current ? current.item.word : null,
          totalAsked: totalAsked,
          answers: answers.slice(),
          levelResults: levelResults.slice()
        };
      },
      computeScore: function () { return computeScore(levels, levelResults); }
    };
  }

  function runSession(engine, answerFn) {
    var guard = 0;
    while (guard++ < 200) {
      if (engine.isDone()) break;
      var q = engine.nextQuestion();
      if (!q) break;
      engine.recordAnswer(answerFn(q));
    }
    var score = engine.computeScore();
    var st = engine.getState();
    return {
      asked: st.totalAsked || st.answers.length,
      answers: st.answers,
      levelResults: st.levelResults,
      rounded: score.rounded,
      raw: score.estimate,
      attained: score.attained,
      q: score.q,
      stats: st.stats || null
    };
  }

  var api = {
    MAX_QUESTIONS: MAX_QUESTIONS,
    mulberry32: mulberry32,
    shuffle: shuffle,
    decideStatus: decideStatus,
    computeScore: computeScore,
    create: createEngine,
    createLegacy: createLegacyEngine,
    runSession: runSession
  };

  root.VocabAdaptive = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

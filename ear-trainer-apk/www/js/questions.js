/* =============================================================
 * 出题与判分
 * 纯逻辑，无 DOM / 无 Audio，可在 Node 中单测
 * ============================================================= */
(function (global) {
  "use strict";
  var Theory = global.Theory;

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function randChoice(arr) { return arr[randInt(0, arr.length - 1)]; }

  function pickNote(low, high, blackAllowed) {
    var candidates = [];
    for (var m = low; m <= high; m++) {
      if (blackAllowed || !Theory.isBlack(m)) candidates.push(m);
    }
    if (!candidates.length) return null;
    return randChoice(candidates);
  }

  // 洗牌后取前 n 个（不重复）
  function pickDistinctNotes(n, low, high, blackAllowed) {
    var pool = [];
    for (var m = low; m <= high; m++) {
      if (blackAllowed || !Theory.isBlack(m)) pool.push(m);
    }
    if (pool.length < n) return null;
    for (var i = pool.length - 1; i > 0; i--) {
      var j = randInt(0, i);
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, n);
  }

  function generate(settings) {
    var low = settings.lowNote;
    var high = settings.highNote;
    var black = settings.blackKeys;

    if (settings.mode === "melody") {
      var n = settings.noteCount;
      var notes = pickDistinctNotes(n, low, high, black);
      if (!notes) return null;
      if (settings.melodyDirection === "up") {
        notes.sort(function (a, b) { return a - b; });
      } else if (settings.melodyDirection === "down") {
        notes.sort(function (a, b) { return b - a; });
      }
      return {
        mode: "melody",
        notes: notes,
        name: notes.map(Theory.midiToName).join(" - ")
      };
    }

    if (settings.mode === "interval") {
      var gap = randInt(settings.intervalMin, settings.intervalMax);
      var note1, note2;
      if (settings.intervalPlay === "down") {
        note1 = pickNote(low + gap, high, black);
        note2 = note1 - gap;
      } else {
        note1 = pickNote(low, high - gap, black);
        note2 = note1 + gap;
      }
      if (note1 == null || note2 == null) return null;
      return {
        mode: "interval",
        notes: [note1, note2],
        gap: gap,
        name: Theory.midiToName(note1) + " → " + Theory.midiToName(note2) +
              "（" + Theory.intervalName(gap) + "）"
      };
    }

    if (settings.mode === "chord") {
      var allTypes = settings.chordTypes.slice();
      if (!allTypes.length) return null;
      var type = randChoice(allTypes);
      if (type === "自由" || !Theory.CHORD_TYPES[type]) {
        var freeNotes = pickDistinctNotes(settings.noteCount, low, high, black);
        if (!freeNotes) return null;
        freeNotes.sort(function (a, b) { return a - b; });
        return { mode: "chord", notes: freeNotes, chordType: "自由", name: "自由和弦" };
      }
      var offsets = Theory.CHORD_TYPES[type];
      var maxOff = offsets[offsets.length - 1];
      for (var t = 0; t < 300; t++) {
        var root = randInt(low, high - maxOff);
        var chordNotes = offsets.map(function (o) { return root + o; });
        var valid = chordNotes.every(function (m) {
          return m >= low && m <= high && (black || !Theory.isBlack(m));
        });
        if (valid) {
          return {
            mode: "chord", notes: chordNotes, chordType: type,
            name: Theory.midiToName(root) + " " + type + "和弦"
          };
        }
      }
      var fb = pickDistinctNotes(settings.noteCount, low, high, black);
      if (!fb) return null;
      fb.sort(function (a, b) { return a - b; });
      return { mode: "chord", notes: fb, chordType: "自由", name: "自由和弦" };
    }

    return null;
  }

  function judge(question, answerNotes) {
    if (question.mode === "melody") {
      var ok = 0;
      var total = question.notes.length;
      var detail = question.notes.map(function (n, i) {
        var right = answerNotes[i] === n;
        if (right) ok++;
        return { midi: n, pressed: answerNotes[i], right: right };
      });
      return { correct: ok === total, ok: ok, total: total, detail: detail };
    }
    if (question.mode === "interval") {
      if (answerNotes.length < 2) {
        return { correct: false, ok: 0, total: 1, incomplete: true, detail: [] };
      }
      var gap = Math.abs(answerNotes[1] - answerNotes[0]);
      return { correct: gap === question.gap, ok: gap === question.gap ? 1 : 0, total: 1, playedGap: gap, detail: [] };
    }
    if (question.mode === "chord") {
      var a = answerNotes.slice().sort(function (x, y) { return x - y; });
      var b = question.notes.slice().sort(function (x, y) { return x - y; });
      var correct = a.length === b.length && a.every(function (v, i) { return v === b[i]; });
      return { correct: correct, ok: correct ? 1 : 0, total: 1, detail: [] };
    }
    return { correct: false, ok: 0, total: 1, detail: [] };
  }

  var Questions = { generate: generate, judge: judge, pickNote: pickNote };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Questions: Questions };
  }
  global.Questions = Questions;
})(typeof window !== "undefined" ? window : globalThis);

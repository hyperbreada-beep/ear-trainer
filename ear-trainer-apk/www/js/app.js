/* =============================================================
 * 练耳训练 - 主程序（设置 / 出题 / 播放 / 作答 / 计分 / PWA）
 * 作答模型：按对才前进、按错计数但不提交，直到全部按对才完成。
 * 正确率 = 正确的音 / 总按键次数。
 * ============================================================= */
(function (global) {
  "use strict";
  var Theory = global.Theory;
  var Questions = global.Questions;
  var PianoSynth = global.PianoSynth;
  var PianoKeyboard = global.PianoKeyboard;

  var DEFAULT_SETTINGS = {
    mode: "melody",
    lowNote: 48,
    highNote: 72,
    blackKeys: true,
    noteCount: 3,
    melodyDirection: "mixed",
    intervalMin: 1,
    intervalMax: 12,
    intervalPlay: "up",
    chordTypes: ["大三", "小三"],
    tempo: "medium",
    autoNext: true,
    showLabels: true,
    volume: 0.9
  };
  var MODE_LABELS = { melody: "旋律序列", interval: "音程听辨", chord: "和弦听辨" };
  var TEMPO = { slow: { dur: 0.9, gap: 0.25 }, medium: { dur: 0.6, gap: 0.18 }, fast: { dur: 0.4, gap: 0.12 } };

  function $(id) { return document.getElementById(id); }
  var els = {
    modeLabel: $("modeLabel"), scoreOk: $("scoreOk"), scoreBad: $("scoreBad"), scoreRate: $("scoreRate"),
    statusText: $("statusText"), answerHint: $("answerHint"), feedback: $("feedback"),
    btnPlay: $("btnPlay"), btnClear: $("btnClear"), btnReveal: $("btnReveal"), btnNext: $("btnNext"),
    btnSettings: $("btnSettings"), settingsPanel: $("settingsPanel"), btnCloseSettings: $("btnCloseSettings"),
    keyboard: $("keyboard"), modeSeg: $("modeSeg"), lowNote: $("lowNote"), highNote: $("highNote"),
    blackKeys: $("blackKeys"), fieldNoteCount: $("fieldNoteCount"), labelNoteCount: $("labelNoteCount"),
    noteCount: $("noteCount"), noteCountVal: $("noteCountVal"),
    melodyDirField: $("melodyDirField"), melodyDirSeg: $("melodyDirSeg"),
    intervalFields: $("intervalFields"), intervalMin: $("intervalMin"), intervalMax: $("intervalMax"),
    intervalPlaySeg: $("intervalPlaySeg"), chordFields: $("chordFields"), chordChecks: $("chordChecks"),
    tempoSeg: $("tempoSeg"), autoNext: $("autoNext"), showLabels: $("showLabels"),
    volume: $("volume"), btnResetScore: $("btnResetScore")
  };

  var settings = loadSettings();
  var synth = new PianoSynth();
  var keyboard = null;
  var state = {
    question: null, answer: [], phase: "idle", // idle | playing | answering | done
    score: { ok: 0, bad: 0 }, // ok=正确的音, bad=按错的次数
    timers: []
  };

  /* ---------- 持久化 ---------- */
  function loadSettings() {
    try {
      var raw = localStorage.getItem("ear-trainer-settings");
      if (raw) return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULT_SETTINGS);
  }
  function saveSettings() {
    try { localStorage.setItem("ear-trainer-settings", JSON.stringify(settings)); } catch (e) {}
  }

  /* ---------- 小工具 ---------- */
  function clearTimers() {
    state.timers.forEach(function (t) { clearTimeout(t); });
    state.timers = [];
  }
  function setStatus(t) { els.statusText.textContent = t; }
  function showFeedback(t, cls) { els.feedback.textContent = t; els.feedback.className = "feedback " + cls; }
  function hideFeedback() { els.feedback.className = "feedback hidden"; }
  function setHint(t) {
    if (t) { els.answerHint.textContent = t; els.answerHint.className = "hint"; }
    else { els.answerHint.textContent = ""; els.answerHint.className = "hint hidden"; }
  }
  function updateScore() {
    els.scoreOk.textContent = state.score.ok;
    els.scoreBad.textContent = state.score.bad;
    var total = state.score.ok + state.score.bad;
    els.scoreRate.textContent = total ? Math.round(state.score.ok * 100 / total) + "%" : "—";
  }

  /* ---------- 作答（按对才前进） ---------- */
  function isSequential(q) {
    return q.mode === "melody" || (q.mode === "interval" && settings.intervalPlay !== "together");
  }

  function handleKeyPress(midi) {
    synth.noteOn(midi, 0.85);
    if (state.phase !== "answering" || !state.question) return;
    var q = state.question;
    var correct = false;

    if (isSequential(q)) {
      var expect = q.notes[state.answer.length];
      if (midi === expect) {
        correct = true;
        state.answer.push(midi);
        keyboard.highlight([midi], "correct");
      }
    } else {
      // 集合作答：和弦 / 同时音程（顺序不限）
      if (q.notes.indexOf(midi) !== -1 && state.answer.indexOf(midi) === -1) {
        correct = true;
        state.answer.push(midi);
        keyboard.highlight([midi], "correct");
      }
    }

    if (correct) {
      state.score.ok++;
      if (state.answer.length >= q.notes.length) completeAnswer();
    } else {
      state.score.bad++;
      keyboard.flashNote(midi, "wrong", 320);
    }
    updateScore();
    updateAnswerHint();
  }

  function handleKeyRelease(midi) { synth.noteOff(midi); }

  function completeAnswer() {
    var q = state.question;
    state.phase = "done";
    setStatus("");
    setHint("");
    showFeedback("✅ 全部正确！" + q.name, "ok");
    updateControls();
    if (settings.autoNext) {
      state.timers.push(setTimeout(function () { nextQuestion(); }, 1200));
    }
  }

  /* ---------- 播放 ---------- */
  function playQuestion(q) {
    clearTimers();
    synth.allNotesOff();
    state.question = q;
    state.answer = [];
    state.phase = "playing";
    keyboard.clearHighlights();
    hideFeedback();
    setStatus("正在播放，仔细听…");
    setHint("");
    updateControls();

    var t = TEMPO[settings.tempo];
    var dur = t.dur, gap = t.gap;
    var total = 0;
    var lead = 0.35;

    if (q.mode === "melody") {
      q.notes.forEach(function (m, i) {
        var start = lead + i * (dur + gap);
        state.timers.push(setTimeout(function () { synth.noteOn(m, 0.8); }, start * 1000));
        state.timers.push(setTimeout(function () { synth.noteOff(m); }, (start + dur) * 1000));
        total = start + dur;
      });
    } else if (q.mode === "interval") {
      if (settings.intervalPlay === "together") {
        state.timers.push(setTimeout(function () { q.notes.forEach(function (m) { synth.noteOn(m, 0.8); }); }, lead * 1000));
        var cd = Math.max(dur * 2, 1.1);
        state.timers.push(setTimeout(function () { q.notes.forEach(function (m) { synth.noteOff(m); }); }, (lead + cd) * 1000));
        total = lead + cd;
      } else {
        state.timers.push(setTimeout(function () { synth.noteOn(q.notes[0], 0.8); }, lead * 1000));
        state.timers.push(setTimeout(function () { synth.noteOff(q.notes[0]); }, (lead + dur) * 1000));
        state.timers.push(setTimeout(function () { synth.noteOn(q.notes[1], 0.8); }, (lead + dur + gap) * 1000));
        state.timers.push(setTimeout(function () { synth.noteOff(q.notes[1]); }, (lead + dur + gap + dur) * 1000));
        total = lead + dur + gap + dur;
      }
    } else if (q.mode === "chord") {
      state.timers.push(setTimeout(function () { q.notes.forEach(function (m) { synth.noteOn(m, 0.8); }); }, lead * 1000));
      var cdd = Math.max(dur * 2, 1.3);
      state.timers.push(setTimeout(function () { q.notes.forEach(function (m) { synth.noteOff(m); }); }, (lead + cdd) * 1000));
      total = lead + cdd;
    }

    state.timers.push(setTimeout(function () {
      state.phase = "answering";
      setStatus("请作答：按对才会前进");
      updateAnswerHint();
      updateControls();
    }, (total + 0.25) * 1000));
  }

  function generateQuestion() {
    for (var i = 0; i < 20; i++) {
      var q = Questions.generate(settings);
      if (q) return q;
    }
    return null;
  }

  function nextQuestion() {
    clearTimers();
    synth.allNotesOff();
    keyboard.clearHighlights();
    hideFeedback();
    var q = generateQuestion();
    if (!q) {
      state.question = null; state.answer = []; state.phase = "idle";
      setStatus("音域内没有足够的音，请扩大音域或开启黑键");
      setHint("");
      updateControls();
      return;
    }
    playQuestion(q);
  }

  /* ---------- 提示与其它操作 ---------- */
  function updateAnswerHint() {
    if (state.phase !== "answering" || !state.question) { setHint(""); return; }
    var q = state.question;
    var done = state.answer.length, total = q.notes.length;
    if (q.mode === "melody") setHint("已按对 " + done + " / " + total + " 个音（按顺序，按错不前进）");
    else if (q.mode === "interval" && settings.intervalPlay !== "together") setHint("已按对 " + done + " / 2 个音");
    else setHint("已按对 " + done + " / " + total + " 个音（顺序不限）");
  }

  function revealAnswer() {
    if (!state.question || state.phase === "done") return;
    clearTimers();
    synth.allNotesOff();
    state.phase = "done";
    keyboard.clearHighlights();
    keyboard.highlight(state.question.notes, "reveal");
    showFeedback("👁 答案是：" + state.question.name, "bad");
    setStatus("");
    setHint("");
    updateControls();
  }

  function clearAnswer() {
    if (state.phase !== "answering") return;
    state.answer = [];
    keyboard.clearHighlights();
    updateAnswerHint();
  }

  function resetToIdle() {
    clearTimers();
    synth.allNotesOff();
    keyboard.clearHighlights();
    state.question = null;
    state.answer = [];
    state.phase = "idle";
    hideFeedback();
    setHint("");
    setStatus("点「播放」听音，然后在键盘上按出来");
    updateControls();
  }

  function updateControls() {
    els.btnPlay.disabled = (state.phase === "playing");
    els.btnClear.disabled = (state.phase !== "answering");
    els.btnReveal.disabled = (!state.question || state.phase === "done" || state.phase === "idle");
  }

  /* ---------- 设置 UI ---------- */
  function buildNoteSelects() {
    var html = "";
    for (var m = Theory.KEYBOARD_LOW; m <= Theory.KEYBOARD_HIGH; m++) {
      html += '<option value="' + m + '">' + Theory.midiToName(m) + "</option>";
    }
    els.lowNote.innerHTML = html;
    els.highNote.innerHTML = html;
  }
  function buildIntervalSelects() {
    var h1 = "", h2 = "";
    for (var i = 1; i <= 12; i++) {
      h1 += '<option value="' + i + '">' + i + "</option>";
      h2 += '<option value="' + i + '">' + i + "</option>";
    }
    els.intervalMin.innerHTML = h1;
    els.intervalMax.innerHTML = h2;
  }
  function buildChordChecks() {
    var names = Object.keys(Theory.CHORD_TYPES).concat(["自由"]);
    els.chordChecks.innerHTML = names.map(function (n) {
      return '<label><input type="checkbox" value="' + n + '"> ' + n + "</label>";
    }).join("");
  }
  function setSegActive(container, value, attr) {
    var btns = container.querySelectorAll(".seg-btn");
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.toggle("active", b.getAttribute(attr || "data-v") === value);
    });
  }

  function applyNoteCountConfig() {
    if (settings.mode === "melody") {
      els.fieldNoteCount.classList.remove("hidden");
      els.labelNoteCount.textContent = "连续出几个音";
      els.noteCount.min = "1"; els.noteCount.max = "8";
    } else if (settings.mode === "chord") {
      els.fieldNoteCount.classList.remove("hidden");
      els.labelNoteCount.textContent = "和弦音数（仅自由和弦）";
      els.noteCount.min = "2"; els.noteCount.max = "5";
    } else {
      els.fieldNoteCount.classList.add("hidden");
    }
    var lo = parseInt(els.noteCount.min, 10);
    var hi = parseInt(els.noteCount.max, 10);
    settings.noteCount = Math.min(Math.max(settings.noteCount, lo), hi);
    els.noteCount.value = String(settings.noteCount);
    els.noteCountVal.textContent = settings.noteCount;
  }

  function applyModeVisibility() {
    els.intervalFields.classList.toggle("hidden", settings.mode !== "interval");
    els.chordFields.classList.toggle("hidden", settings.mode !== "chord");
    els.melodyDirField.classList.toggle("hidden", settings.mode !== "melody");
    applyNoteCountConfig();
    els.modeLabel.textContent = MODE_LABELS[settings.mode] || settings.mode;
    setSegActive(els.modeSeg, settings.mode, "data-mode");
  }

  function settingsToUI() {
    els.lowNote.value = String(settings.lowNote);
    els.highNote.value = String(settings.highNote);
    els.blackKeys.checked = !!settings.blackKeys;
    els.noteCount.value = String(settings.noteCount);
    els.noteCountVal.textContent = settings.noteCount;
    els.intervalMin.value = String(settings.intervalMin);
    els.intervalMax.value = String(settings.intervalMax);
    els.autoNext.checked = !!settings.autoNext;
    els.showLabels.checked = !!settings.showLabels;
    els.volume.value = String(Math.round(settings.volume * 100));

    setSegActive(els.modeSeg, settings.mode, "data-mode");
    setSegActive(els.intervalPlaySeg, settings.intervalPlay);
    setSegActive(els.tempoSeg, settings.tempo);
    setSegActive(els.melodyDirSeg, settings.melodyDirection);

    Array.prototype.forEach.call(els.chordChecks.querySelectorAll("input"), function (c) {
      c.checked = settings.chordTypes.indexOf(c.value) !== -1;
    });

    applyModeVisibility();
    keyboard.setLabels(settings.showLabels);
    synth.setVolume(settings.volume);
  }

  function uiToSettings() {
    settings.lowNote = parseInt(els.lowNote.value, 10);
    settings.highNote = parseInt(els.highNote.value, 10);
    if (settings.lowNote > settings.highNote) settings.highNote = settings.lowNote;
    settings.blackKeys = els.blackKeys.checked;
    settings.noteCount = parseInt(els.noteCount.value, 10);
    settings.intervalMin = parseInt(els.intervalMin.value, 10);
    settings.intervalMax = parseInt(els.intervalMax.value, 10);
    if (settings.intervalMin > settings.intervalMax) settings.intervalMax = settings.intervalMin;
    settings.autoNext = els.autoNext.checked;
    settings.showLabels = els.showLabels.checked;
    settings.volume = parseInt(els.volume.value, 10) / 100;

    var checked = [];
    Array.prototype.forEach.call(els.chordChecks.querySelectorAll("input"), function (c) {
      if (c.checked) checked.push(c.value);
    });
    settings.chordTypes = checked;
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    els.btnPlay.addEventListener("click", function () {
      if (!state.question || state.phase === "done") nextQuestion();
      else playQuestion(state.question);
    });
    els.btnNext.addEventListener("click", function () { nextQuestion(); });
    els.btnReveal.addEventListener("click", revealAnswer);
    els.btnClear.addEventListener("click", clearAnswer);

    els.btnSettings.addEventListener("click", function () { els.settingsPanel.classList.add("open"); });
    els.btnCloseSettings.addEventListener("click", function () { els.settingsPanel.classList.remove("open"); });

    els.modeSeg.addEventListener("click", function (e) {
      var b = e.target.closest(".seg-btn");
      if (!b) return;
      settings.mode = b.getAttribute("data-mode");
      saveSettings();
      settingsToUI();
      resetToIdle();
    });
    els.melodyDirSeg.addEventListener("click", function (e) {
      var b = e.target.closest(".seg-btn");
      if (!b) return;
      settings.melodyDirection = b.getAttribute("data-v");
      saveSettings(); settingsToUI(); resetToIdle();
    });
    els.intervalPlaySeg.addEventListener("click", function (e) {
      var b = e.target.closest(".seg-btn");
      if (!b) return;
      settings.intervalPlay = b.getAttribute("data-v");
      saveSettings(); settingsToUI(); resetToIdle();
    });
    els.tempoSeg.addEventListener("click", function (e) {
      var b = e.target.closest(".seg-btn");
      if (!b) return;
      settings.tempo = b.getAttribute("data-v");
      saveSettings(); settingsToUI();
    });

    // 影响题目的设置变更 → 重置当前题
    var resetOnChange = [els.lowNote, els.highNote, els.blackKeys, els.noteCount,
      els.intervalMin, els.intervalMax];
    resetOnChange.forEach(function (el) {
      el.addEventListener("input", function () {
        uiToSettings(); saveSettings(); settingsToUI(); resetToIdle();
      });
      el.addEventListener("change", function () {
        uiToSettings(); saveSettings(); settingsToUI(); resetToIdle();
      });
    });
    els.chordChecks.addEventListener("change", function () {
      uiToSettings(); saveSettings(); settingsToUI(); resetToIdle();
    });

    // 不影响题目的设置
    els.autoNext.addEventListener("change", function () { uiToSettings(); saveSettings(); });
    els.showLabels.addEventListener("change", function () {
      uiToSettings(); saveSettings();
      keyboard.setLabels(settings.showLabels);
    });
    els.volume.addEventListener("input", function () {
      settings.volume = parseInt(els.volume.value, 10) / 100;
      synth.setVolume(settings.volume); saveSettings();
    });
    els.btnResetScore.addEventListener("click", function () {
      state.score = { ok: 0, bad: 0 };
      updateScore();
    });

    // 首次手势：解锁音频 + 锁定横屏
    var unlocked = false;
    function firstGesture() {
      synth.ensure();
      if (!unlocked) {
        unlocked = true;
        try {
          if (global.screen.orientation && global.screen.orientation.lock) {
            global.screen.orientation.lock("landscape").catch(function () {});
          }
        } catch (e) {}
      }
    }
    document.addEventListener("pointerdown", firstGesture, { passive: true });
    document.addEventListener("keydown", firstGesture);
  }

  /* ---------- PWA ---------- */
  function registerSW() {
    if ("serviceWorker" in navigator) {
      global.addEventListener("load", function () {
        try { navigator.serviceWorker.register("sw.js"); } catch (e) {}
      });
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    buildNoteSelects();
    buildIntervalSelects();
    buildChordChecks();
    keyboard = new PianoKeyboard(els.keyboard, {
      low: Theory.KEYBOARD_LOW, high: Theory.KEYBOARD_HIGH,
      showLabels: settings.showLabels,
      onPress: handleKeyPress, onRelease: handleKeyRelease
    });
    settingsToUI();
    updateScore();
    updateControls();
    bindEvents();
    registerSW();
  }

  init();
})(window);

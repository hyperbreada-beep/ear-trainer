/* =============================================================
 * 钢琴键盘 UI（三组八度，黑白键，多点触摸）
 * ============================================================= */
(function (global) {
  "use strict";
  var Theory = global.Theory;

  function PianoKeyboard(container, opts) {
    opts = opts || {};
    this.container = container;
    this.low = opts.low || Theory.KEYBOARD_LOW;
    this.high = opts.high || Theory.KEYBOARD_HIGH;
    this.showLabels = opts.showLabels !== false;
    this.onPress = opts.onPress || function () {};
    this.onRelease = opts.onRelease || function () {};
    this.keys = new Map();
    this.render();
  }

  PianoKeyboard.prototype._midis = function () {
    var arr = [];
    for (var m = this.low; m <= this.high; m++) arr.push(m);
    return arr;
  };

  PianoKeyboard.prototype.render = function () {
    var self = this;
    this.container.innerHTML = "";
    this.keys.clear();

    var whites = this._midis().filter(function (m) { return !Theory.isBlack(m); });
    var w = 100 / whites.length;

    whites.forEach(function (midi) {
      var el = document.createElement("div");
      el.className = "key white";
      el.dataset.midi = midi;
      el.style.width = w + "%";
      if (self.showLabels) {
        var lab = document.createElement("span");
        lab.className = "label";
        lab.textContent = Theory.midiToName(midi);
        el.appendChild(lab);
      }
      self._bind(el, midi);
      self.container.appendChild(el);
      self.keys.set(midi, el);
    });

    this._midis().forEach(function (midi) {
      if (!Theory.isBlack(midi)) return;
      var leftWhite = midi - 1;
      var idx = whites.indexOf(leftWhite);
      if (idx < 0) return;
      var el = document.createElement("div");
      el.className = "key black";
      el.dataset.midi = midi;
      var bw = w * 0.62;
      el.style.left = ((idx + 1) * w - bw / 2) + "%";
      el.style.width = bw + "%";
      if (self.showLabels) {
        var lab = document.createElement("span");
        lab.className = "label";
        lab.textContent = Theory.midiToName(midi);
        el.appendChild(lab);
      }
      self._bind(el, midi);
      self.container.appendChild(el);
      self.keys.set(midi, el);
    });
  };

  PianoKeyboard.prototype._bind = function (el, midi) {
    var self = this;
    el.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      if (!el.classList.contains("pressed")) {
        el.classList.add("pressed");
        self.onPress(midi);
      }
    });
    function release() {
      if (el.classList.contains("pressed")) {
        el.classList.remove("pressed");
        self.onRelease(midi);
      }
    }
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
  };

  PianoKeyboard.prototype.highlight = function (midis, cls) {
    var self = this;
    (midis || []).forEach(function (m) {
      var el = self.keys.get(m);
      if (el) el.classList.add(cls);
    });
  };

  PianoKeyboard.prototype.clearHighlights = function () {
    this.keys.forEach(function (el) {
      el.classList.remove("correct", "wrong", "reveal");
    });
  };

  PianoKeyboard.prototype.setLabels = function (on) {
    if (this.showLabels === on) return;
    this.showLabels = on;
    this.render();
  };

  PianoKeyboard.prototype.flashNote = function (midi, cls, ms) {
    var self = this;
    var el = this.keys.get(midi);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms || 300);
  };

  global.PianoKeyboard = PianoKeyboard;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { PianoKeyboard: PianoKeyboard };
  }
})(typeof window !== "undefined" ? window : globalThis);

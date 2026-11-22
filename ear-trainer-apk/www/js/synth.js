/* =============================================================
 * 电钢琴合成器（纯 Web Audio，无采样/依赖）
 * 双振荡器微失谐(合唱感) + 谐波 PeriodicWave + 低通扫频 + 长衰减包络 + 轻混响
 * ============================================================= */
(function (global) {
  "use strict";
  var Theory = global.Theory;

  function PianoSynth() {
    this.ctx = null;
    this.master = null;
    this.dry = null;
    this.reverb = null;
    this.voices = new Map();
    this.volume = 0.9;
    this._waves = {};
  }

  PianoSynth.prototype.ensure = function () {
    if (!this.ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this._build();
    }
    if (this.ctx.state === "suspended") {
      try { this.ctx.resume(); } catch (e) {}
    }
    return true;
  };

  PianoSynth.prototype._build = function () {
    var ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 22;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;

    this.dry = ctx.createGain();
    this.dry.gain.value = 1.0;
    this.dry.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(1.2, 2.6);
    var wet = ctx.createGain();
    wet.gain.value = 0.12;
    this.reverb.connect(wet);
    wet.connect(this.master);

    this.master.connect(comp);
    comp.connect(ctx.destination);
  };

  PianoSynth.prototype._impulse = function (seconds, decay) {
    var ctx = this.ctx;
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  };

  // 按音区分三档谐波，高音更亮
  PianoSynth.prototype._getWave = function (midi) {
    var band = midi < 55 ? "low" : (midi < 72 ? "mid" : "high");
    if (this._waves[band]) return this._waves[band];
    var h;
    if (band === "low")  h = [1, 0.55, 0.40, 0.22, 0.14, 0.09, 0.06, 0.040, 0.025, 0.015];
    else if (band === "mid") h = [1, 0.50, 0.36, 0.20, 0.13, 0.09, 0.06, 0.040, 0.025, 0.015];
    else h = [1, 0.45, 0.30, 0.17, 0.11, 0.08, 0.05, 0.030, 0.020, 0.012];
    var n = h.length;
    var real = new Float32Array(n);
    var imag = new Float32Array(n);
    for (var k = 1; k < n; k++) real[k] = h[k];
    var wave = this.ctx.createPeriodicWave(real, imag);
    this._waves[band] = wave;
    return wave;
  };

  PianoSynth.prototype.noteOn = function (midi, vel, when) {
    if (!this.ensure()) return;
    var ctx = this.ctx;
    var t = when || ctx.currentTime;
    if (this.voices.has(midi)) this._stop(midi, t);

    var freq = Theory.midiToFreq(midi);
    var wave = this._getWave(midi);

    // 双振荡器 ±3.5 音分微失谐，制造温暖合唱感，去掉“电子味”
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    osc1.setPeriodicWave(wave);
    osc2.setPeriodicWave(wave);
    osc1.frequency.value = freq;
    osc2.frequency.value = freq;
    osc1.detune.value = -3.5;
    osc2.detune.value = 3.5;

    var g = ctx.createGain();
    g.gain.value = 0;

    // 低通扫频：起音明亮，随后柔和回落（电钢质感）
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(Math.min(freq * 8, 13000), t);
    lp.frequency.setTargetAtTime(Math.min(freq * 2.6, 4800), t + 0.06, 0.7);

    osc1.connect(g);
    osc2.connect(g);
    g.connect(lp);
    lp.connect(this.dry);
    lp.connect(this.reverb);

    var v = Math.max(0.2, Math.min(1, (vel == null ? 0.8 : vel)));
    var p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(v, t + 0.012);       // 12ms 平滑起音，无咔哒/噪声
    p.setTargetAtTime(v * 0.72, t + 0.012, 0.5);   // 温和回落
    p.setTargetAtTime(0.0001, t + 0.5, 2.4);       // 长自然衰减

    osc1.start(t);
    osc2.start(t);
    this.voices.set(midi, { oscs: [osc1, osc2], g: g, lp: lp });
  };

  PianoSynth.prototype.noteOff = function (midi, when) {
    if (!this.ctx) return;
    this._stop(midi, when || this.ctx.currentTime);
  };

  PianoSynth.prototype._stop = function (midi, t) {
    var voice = this.voices.get(midi);
    if (!voice) return;
    this.voices.delete(midi);
    var p = voice.g.gain;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(0.0001, t, 0.09);
    voice.oscs.forEach(function (o) { try { o.stop(t + 0.9); } catch (e) {} });
    var oscs = voice.oscs, g = voice.g, lp = voice.lp;
    setTimeout(function () {
      try {
        oscs.forEach(function (o) { o.disconnect(); });
        g.disconnect(); lp.disconnect();
      } catch (e) {}
    }, 1000);
  };

  PianoSynth.prototype.allNotesOff = function () {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var keys = Array.from(this.voices.keys());
    for (var i = 0; i < keys.length; i++) this._stop(keys[i], t);
  };

  PianoSynth.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  };

  global.PianoSynth = PianoSynth;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { PianoSynth: PianoSynth };
  }
})(typeof window !== "undefined" ? window : globalThis);

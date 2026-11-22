/* =============================================================
 * 音乐理论：音名 / MIDI / 频率 / 音程 / 和弦
 * 纯逻辑，无 DOM / 无 Audio，可在 Node 中单测
 * ============================================================= */
(function (global) {
  "use strict";

  var SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  var WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  var KEYBOARD_LOW = 48;   // C3
  var KEYBOARD_HIGH = 84;  // C6

  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  function midiToName(midi, useFlat) {
    midi = Math.round(midi);
    var pc = ((midi % 12) + 12) % 12;
    var oct = Math.floor(midi / 12) - 1;
    return (useFlat ? FLAT : SHARP)[pc] + oct;
  }

  function isBlack(midi) {
    var pc = ((midi % 12) + 12) % 12;
    return WHITE_PC.indexOf(pc) === -1;
  }

  function midiToFreq(midi, a4) {
    a4 = a4 || 440;
    return a4 * Math.pow(2, (midi - 69) / 12);
  }

  var INTERVAL_NAMES = {
    0: "纯一度", 1: "小二度", 2: "大二度", 3: "小三度", 4: "大三度",
    5: "纯四度", 6: "三全音", 7: "纯五度", 8: "小六度", 9: "大六度",
    10: "小七度", 11: "大七度", 12: "纯八度"
  };

  function intervalName(semitones) {
    var s = Math.abs(semitones);
    if (s === 0) return "纯一度";
    if (s % 12 === 0) {
      var octs = Math.floor(s / 12);
      return octs === 1 ? "纯八度" : (octs + " 个八度");
    }
    var simple = s % 12;
    var octaves = Math.floor(s / 12);
    var name = INTERVAL_NAMES[simple] || (simple + " 半音");
    if (octaves > 0) name += "+" + octaves + "八度";
    return name;
  }

  var CHORD_TYPES = {
    "大三": [0, 4, 7],
    "小三": [0, 3, 7],
    "减三": [0, 3, 6],
    "增三": [0, 4, 8],
    "属七": [0, 4, 7, 10],
    "大七": [0, 4, 7, 11],
    "小七": [0, 3, 7, 10]
  };

  function describeChord(midis) {
    if (!midis || !midis.length) return "";
    var root = Math.min.apply(null, midis);
    var rootName = midiToName(root);
    var pcs = [];
    midis.forEach(function (m) {
      var p = ((m - root) % 12 + 12) % 12;
      if (pcs.indexOf(p) === -1) pcs.push(p);
    });
    pcs.sort(function (a, b) { return a - b; });
    for (var type in CHORD_TYPES) {
      var off = CHORD_TYPES[type];
      if (off.length === pcs.length && off.every(function (o) { return pcs.indexOf(o) !== -1; })) {
        return rootName + " " + type + "和弦";
      }
    }
    return rootName + " 和弦";
  }

  var Theory = {
    SHARP: SHARP,
    FLAT: FLAT,
    WHITE_PC: WHITE_PC,
    KEYBOARD_LOW: KEYBOARD_LOW,
    KEYBOARD_HIGH: KEYBOARD_HIGH,
    clamp: clamp,
    midiToName: midiToName,
    isBlack: isBlack,
    midiToFreq: midiToFreq,
    intervalName: intervalName,
    describeChord: describeChord,
    CHORD_TYPES: CHORD_TYPES
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Theory: Theory };
  }
  global.Theory = Theory;
})(typeof window !== "undefined" ? window : globalThis);

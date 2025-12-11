// =========================
// 0. 曲データ / ストレージ
// =========================
const STORAGE_KEY = "lyricsTypingSongs_v1";
const STORAGE_CURRENT_KEY = "lyricsTypingCurrentId_v1";

const DEFAULT_LYRICS = [
  { start: 0.0, end: 3.0, text: "ららら イントロ", romaji: "rararaintro" },
  { start: 3.0, end: 7.0, text: "きみとあるいてく", romaji: "kimitaaruiteku" },
  { start: 7.0, end: 11.0, text: "ひかりのなかで", romaji: "hikarinonakade" },
  { start: 11.0, end: 15.0, text: "このてをはなさない", romaji: "konotewohanasanai" }
];

let songs = [];
let currentSong = null;

function getLyrics() {
  return currentSong && Array.isArray(currentSong.lyrics)
    ? currentSong.lyrics
    : [];
}

function extractVideoId(input) {
  if (!input) return "";
  input = input.trim();
  const urlMatch = input.match(/[?&]v=([^&]+)/);
  if (urlMatch) return urlMatch[1];
  const shortMatch = input.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  return input;
}

function loadSongsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        songs = parsed;
      }
    }
  } catch (e) {
    console.warn("曲データの読み込みに失敗:", e);
  }

  if (!songs || !songs.length) {
    songs = [
      {
        id: "demo-" + Date.now(),
        title: "デモ曲",
        videoId: "dQw4w9WgXcQ",
        lyrics: DEFAULT_LYRICS
      }
    ];
  }

  const savedId = localStorage.getItem(STORAGE_CURRENT_KEY);
  currentSong = songs.find(s => s.id === savedId) || songs[0];
}

function saveSongsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    if (currentSong) {
      localStorage.setItem(STORAGE_CURRENT_KEY, currentSong.id);
    }
  } catch (e) {
    console.warn("曲データの保存に失敗:", e);
  }
}

function renderSongList() {
  const listEl = document.getElementById("songList");
  listEl.innerHTML = "";
  const lyricsLen = (song) =>
    song && Array.isArray(song.lyrics) ? song.lyrics.length : 0;

  songs.forEach(song => {
    const btn = document.createElement("button");
    btn.className = "song-item";
    if (currentSong && currentSong.id === song.id) {
      btn.classList.add("active");
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "title";
    titleSpan.textContent = song.title || "(無題)";

    const countSpan = document.createElement("span");
    countSpan.className = "count";
    countSpan.textContent = `${lyricsLen(song)}行`;

    btn.appendChild(titleSpan);
    btn.appendChild(countSpan);

    btn.addEventListener("click", () => {
      selectSong(song.id);
    });

    listEl.appendChild(btn);
  });
}

function selectSong(songId) {
  const song = songs.find(s => s.id === songId);
  if (!song) return;
  currentSong = song;
  saveSongsToStorage();
  renderSongList();

  const videoInput = document.getElementById("videoId");
  videoInput.value = song.videoId || "";

  if (typingState && typingState.resetAll) {
    typingState.resetAll();
  }
}

function parseLyricsText(text) {
  // 先頭にBOM(﻿)が付いているケースをケア
  text = text.replace(/^\uFEFF/, "");

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const lyrics = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    let delimiter = null;

    // 1. カンマがあれば CSV とみなす
    if (line.includes(",")) {
      delimiter = ",";
    }
    // 2. なければタブを探す（Excelコピペなど）
    else if (line.includes("\t")) {
      delimiter = "\t";
    }

    let parts;
    if (delimiter) {
      parts = line.split(delimiter);
    } else {
      // 3. カンマもタブもない → 空白区切りとみなす
      parts = line.split(/\s+/);
    }

    if (parts.length < 3) continue;

    const start = parseFloat(parts[0]);
    const end   = parseFloat(parts[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const jp = (parts[2] || "").trim();

    // romaji は 4列目以降を全部くっつけて扱う
    let romajiJoinSep;
    if (delimiter === ",") {
      romajiJoinSep = ",";
    } else if (delimiter === "\t") {
      romajiJoinSep = "\t";
    } else {
      romajiJoinSep = " ";
    }

    const romaji = parts.slice(3).join(romajiJoinSep).trim();

    lyrics.push({
      start,
      end,
      text: jp,
      romaji
    });
  }

  return lyrics;
}

function formatLyricsText(lyrics) {
  if (!Array.isArray(lyrics)) return "";
  return lyrics
    .map(l =>
      `${(l.start ?? 0).toFixed(3)},${(l.end ?? 0).toFixed(3)},${l.text ?? ""},${l.romaji ?? ""}`
    )
    .join("\n");
}

// =========================
// 日本語→ローマ字 簡易変換（ひらがな・カタカナ対応）
// =========================
function kanaToRomaji(jpText) {
  if (!jpText) return "";

  // カタカナ → ひらがな
  let text = jpText.replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );

  const comboMap = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "じゃ": "ja",  "じゅ": "ju",  "じょ": "jo",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo"
  };

  const map = {
    "あ":"a","い":"i","う":"u","え":"e","お":"o",
    "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
    "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
    "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
    "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
    "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
    "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
    "や":"ya","ゆ":"yu","よ":"yo",
    "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
    "わ":"wa","を":"wo","ん":"n",
    "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
    "ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
    "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do",
    "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
    "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
    "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o",
    "ゃ":"ya","ゅ":"yu","ょ":"yo",
    "っ":""
  };

  let result = "";
  for (let i = 0; i < text.length; ) {
    const ch = text[i];

    // 促音「っ」
    if (ch === "っ") {
      const next = text[i + 1];
      const nextRoma =
        comboMap[text.substring(i + 1, i + 3)] ||
        map[next] || "";
      if (nextRoma && /^[a-z]/i.test(nextRoma)) {
        result += nextRoma[0];
      }
      i++;
      continue;
    }

    // 拗音コンボ
    const pair = text.substring(i, i + 2);
    if (comboMap[pair]) {
      result += comboMap[pair];
      i += 2;
      continue;
    }

    if (map[ch]) {
      result += map[ch];
    } else {
      // 漢字・記号など → そのまま残す（あとで手で直す想定）
      result += ch;
    }
    i++;
  }

  return result;
}

// =========================
// 1. YouTube プレイヤー関連 + 練習モード
// =========================
let player = null;
let playerReady = false;

const startTypingBtn = document.getElementById("startTypingBtn");
const countdownInfoEl = document.getElementById("countdownInfo");
let countdownTimerId = null;

const practiceModeCheckbox = document.getElementById("practiceModeCheckbox");
let practiceMode = false;
let practiceStartMs = 0;

practiceModeCheckbox.addEventListener("change", () => {
  practiceMode = practiceModeCheckbox.checked;
});

const playbackRateSelect = document.getElementById("playbackRateSelect");
playbackRateSelect.addEventListener("change", () => {
  const rate = parseFloat(playbackRateSelect.value);
  if (player && typeof player.setPlaybackRate === "function") {
    try {
      player.setPlaybackRate(rate);
    } catch (e) {
      console.warn(e);
    }
  }
});

window.onYouTubeIframeAPIReady = function () {
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  statusDot.classList.add("ready");
  statusText.textContent = "YouTube API OK / 曲を選んで動画を読み込んでください";
  playerReady = true;

  player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId: "dQw4w9WgXcQ",
    playerVars: {
      controls: 1,
      rel: 0
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
};

function onPlayerReady() {
  try {
    player.setPlaybackRate(1);
  } catch (e) {}
}

function onPlayerStateChange(event) {
  // 今は特に何もしない（開始はスタートボタンから）
}

// 「3秒後に開始」ボタン
startTypingBtn.addEventListener("click", () => {
  const lyrics = getLyrics();
  if (!currentSong || !lyrics.length) {
    alert("歌詞データがありません。「曲を登録/編集」から設定してください。");
    return;
  }

  if (!practiceMode && (!playerReady || !player)) {
    alert("動画プレーヤーがまだ準備できていません。");
    return;
  }

  if (countdownTimerId !== null) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }

  typingState.resetAll();

  if (!practiceMode) {
    try {
      player.seekTo(0, true);
      player.pauseVideo();
      const rate = parseFloat(playbackRateSelect.value) || 1;
      player.setPlaybackRate(rate);
    } catch (e) {
      console.warn(e);
    }
  } else {
    practiceStartMs = 0;
  }

  let remain = 3;
  countdownInfoEl.textContent = `開始まで: ${remain}秒`;
  startTypingBtn.disabled = true;

  countdownTimerId = setInterval(() => {
    remain--;
    if (remain > 0) {
      countdownInfoEl.textContent = `開始まで: ${remain}秒`;
    } else {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
      countdownInfoEl.textContent = "";
      startTypingBtn.disabled = false;

      typingState.start();
      if (practiceMode) {
        practiceStartMs = performance.now();
      } else {
        try {
          player.playVideo();
        } catch (e) {
          console.warn(e);
        }
      }
    }
  }, 1000);
});

document.getElementById("loadVideoBtn").addEventListener("click", () => {
  if (!playerReady) return;
  const input = document.getElementById("videoId").value;
  const vid = extractVideoId(input);
  if (vid) {
    player.loadVideoById(vid);
    if (currentSong) {
      currentSong.videoId = vid;
      saveSongsToStorage();
      renderSongList();
    }
  }
});

// =========================
// 2. タイピング状態管理
// =========================
const resultPanel = document.getElementById("resultPanel");
let songFinished = false;

function hideResultPanel() {
  if (!resultPanel) return;
  resultPanel.classList.add("hidden");
  resultPanel.innerHTML = "";
}

function showResultPanel(info) {
  if (!resultPanel) return;
  const { score, totalCorrect, totalWrong, accuracy, cpm, maxCombo } = info;
  resultPanel.innerHTML = `
  <div><strong>結果</strong></div>
  <div>スコア: ${score}</div>
  <div>正解キー数: ${totalCorrect}, ミスキー数: ${totalWrong}</div>
  <div>正解率: ${accuracy.toFixed(1)}%</div>
  <div>平均速度: ${cpm.toFixed(0)} chars/min</div>
  <div>最大コンボ: ${maxCombo}</div>
  `;
  resultPanel.classList.remove("hidden");
}

const typingState = (() => {
  let started = false;
  let startTime = 0;

  let currentLineIndex = -1;
  let currentCharIndex = 0;

  let charStates = [];
  let totalCorrect = 0;
  let totalWrong = 0;

  let currentCombo = 0;
  let maxCombo = 0;

  function isTypableChar(ch) {
    return /[a-z0-9]/i.test(ch);
  }

  function skipNonTypable(expLower) {
    const len = expLower.length;
    while (
      currentCharIndex < len &&
      !isTypableChar(expLower[currentCharIndex])
    ) {
      currentCharIndex++;
    }
  }

  function resetLine(lineIndex) {
    const lyrics = getLyrics();
    currentLineIndex = lineIndex;
    currentCharIndex = 0;

    if (lineIndex < 0 || lineIndex >= lyrics.length) {
      charStates = [];
      renderLyric();
      return;
    }

    const line = lyrics[lineIndex];
    charStates = Array.from(line.romaji).map(() => "pending");

    skipNonTypable(line.romaji.toLowerCase());
    renderLyric();
  }

  function markTimeoutMisses() {
    const lyrics = getLyrics();
    if (currentLineIndex < 0 || currentLineIndex >= lyrics.length) return;
    const line = lyrics[currentLineIndex];
    const expLower = line.romaji.toLowerCase();
    const len = expLower.length;

    for (let i = currentCharIndex; i < len; i++) {
      if (!isTypableChar(expLower[i])) continue;
      if (charStates[i] === "pending") {
        charStates[i] = "wrong";
        totalWrong++;
        currentCombo = 0;
      }
    }
    currentCharIndex = len;
    renderLyric();
    updateStats();
  }

  // ローマ字エイリアス
  function tryAlias(exp, idx, keyLower) {
    const expLower = exp.toLowerCase();
    const len = expLower.length;

    // 1) *hi → *i
    if (
      idx > 0 &&
      idx + 1 < len &&
      expLower[idx] === "h" &&
      expLower[idx + 1] === "i" &&
      keyLower === "i" &&
      charStates[idx - 1] === "correct"
    ) {
      charStates[idx] = "correct";
      charStates[idx + 1] = "correct";
      totalCorrect += 2;
      currentCombo += 2;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
      currentCharIndex += 2;
      renderLyric();
      updateStats();
      return true;
    }

    // 2) chi を ti で (ち)
    if (
      idx === 0 &&
      len >= 3 &&
      expLower.startsWith("chi") &&
      keyLower === "t"
    ) {
      charStates[0] = "correct";
      totalCorrect += 1;
      currentCombo += 1;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
      currentCharIndex += 1;
      renderLyric();
      updateStats();
      return true;
    }

    // 3) tsu → tu (つ)
    if (
      idx > 0 &&
      idx + 1 < len &&
      expLower[idx - 1] === "t" &&
      expLower[idx] === "s" &&
      expLower[idx + 1] === "u" &&
      keyLower === "u" &&
      charStates[idx - 1] === "correct"
    ) {
      charStates[idx] = "correct";
      charStates[idx + 1] = "correct";
      totalCorrect += 2;
      currentCombo += 2;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
      currentCharIndex += 2;
      renderLyric();
      updateStats();
      return true;
    }

    // 4) fu → hu (ふ)
    if (
      idx + 1 < len &&
      expLower[idx] === "f" &&
      expLower[idx + 1] === "u" &&
      keyLower === "h"
    ) {
      charStates[idx] = "correct";
      totalCorrect += 1;
      currentCombo += 1;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
      currentCharIndex += 1;
      renderLyric();
      updateStats();
      return true;
    }

    // 5) ji → zi (じ)
    if (
      idx === 0 &&
      len >= 2 &&
      expLower[0] === "j" &&
      expLower[1] === "i" &&
      keyLower === "z"
    ) {
      charStates[0] = "correct";
      totalCorrect += 1;
      currentCombo += 1;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
      currentCharIndex += 1;
      renderLyric();
      updateStats();
      return true;
    }

    return false;
  }

  function handleKeydown(e) {
    // IME中でも a〜z / 0〜9 だけはローマ字として扱う
    if (e.key === "Process") return;
    if (e.isComposing && !/^[a-z0-9]$/i.test(e.key)) {
      return;
    }

    if (!started) return;

    const lyrics = getLyrics();
    if (!lyrics.length) return;
    if (currentLineIndex < 0 || currentLineIndex >= lyrics.length) return;

    const key = e.key;
    if (key.length !== 1) return;

    const keyLower = key.toLowerCase();
    const line = lyrics[currentLineIndex];
    const exp = line.romaji;
    const expLower = exp.toLowerCase();
    const len = expLower.length;

    skipNonTypable(expLower);

    if (currentCharIndex >= len) {
      return;
    }

    const expectedChar = expLower[currentCharIndex];

    if (keyLower === expectedChar) {
      charStates[currentCharIndex] = "correct";
      totalCorrect++;
      currentCombo++;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
      currentCharIndex++;
      skipNonTypable(expLower);
      renderLyric();
      updateStats();
      return;
    }

    if (tryAlias(exp, currentCharIndex, keyLower)) {
      skipNonTypable(expLower);
      return;
    }

    if (isTypableChar(expectedChar)) {
      charStates[currentCharIndex] = "wrong";
      totalWrong++;
      currentCombo = 0;
    }
    currentCharIndex++;
    skipNonTypable(expLower);
    renderLyric();
    updateStats();
  }

  function start() {
    if (!started) {
      started = true;
      startTime = performance.now();
    }
  }

  function getElapsedSeconds() {
    if (!started) return 0;
    return (performance.now() - startTime) / 1000;
  }

  function updateByTime(currentTime) {
    renderTime(currentTime);

    const lyrics = getLyrics();
    if (!lyrics.length) {
      currentLineIndex = -1;
      renderLyric();
      updateStats();
      return;
    }

    let targetIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      const l = lyrics[i];
      if (currentTime >= l.start && currentTime < l.end) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== currentLineIndex) {
      if (currentLineIndex !== -1 && targetIndex !== -1) {
        markTimeoutMisses();
      }
      resetLine(targetIndex);
    }

    updateStats();
  }

  function renderLyric() {
    const lyrics = getLyrics();
    const lyricJpEl = document.getElementById("lyricJp");
    const lyricMetaEl = document.getElementById("lyricMeta");
    const lyricRomajiEl = document.getElementById("lyricRomaji");
    const lineIndexInfoEl = document.getElementById("lineIndexInfo");
    const lineTimeInfoEl = document.getElementById("lineTimeInfo");

    if (!lyrics.length || currentSong === null) {
      lyricJpEl.textContent = "歌詞なし / 曲を登録して選択してください";
      lyricMetaEl.textContent = "";
      lyricRomajiEl.textContent = "";
      lineIndexInfoEl.textContent = `行: 0 / 0`;
      lineTimeInfoEl.textContent = `-`;
      return;
    }

    if (currentLineIndex < 0 || currentLineIndex >= lyrics.length) {
      lyricJpEl.textContent = "歌詞なし / この時間帯に対応する行はありません";
      lyricMetaEl.textContent = "";
      lyricRomajiEl.textContent = "";
      lineIndexInfoEl.textContent = `行: 0 / ${lyrics.length}`;
      lineTimeInfoEl.textContent = `-`;
      return;
    }

    const line = lyrics[currentLineIndex];
    lyricJpEl.textContent = line.text;
    lyricMetaEl.textContent = `タイプするローマ字: ${line.romaji}`;

    lyricRomajiEl.innerHTML = "";
    const chars = Array.from(line.romaji);
    chars.forEach((ch, idx) => {
      const span = document.createElement("span");
      span.textContent = ch;
      const state = charStates[idx];
      if (state === "correct") span.className = "char-correct";
      else if (state === "wrong") span.className = "char-wrong";
      else span.className = "char-pending";
      lyricRomajiEl.appendChild(span);
    });

    lineIndexInfoEl.textContent = `行: ${currentLineIndex + 1} / ${lyrics.length}`;
    lineTimeInfoEl.textContent =
      `${line.start.toFixed(1)}s - ${line.end.toFixed(1)}s`;
  }

  function renderTime(currentTime) {
    document.getElementById("statTime").textContent =
      `時間: ${currentTime.toFixed(1)}s`;
  }

  function updateStats() {
    const elapsedSec = getElapsedSeconds();
    const cpm =
      elapsedSec > 0 ? (totalCorrect + totalWrong) / elapsedSec * 60 : 0;
    const accuracy =
      totalCorrect + totalWrong > 0
        ? (totalCorrect / (totalCorrect + totalWrong)) * 100
        : 0;

    document.getElementById("statCPM").textContent =
      `速度: ${cpm.toFixed(0)} chars/min`;
    document.getElementById("statCorrect").textContent = `◎ ${totalCorrect}`;
    document.getElementById("statWrong").textContent = `✕ ${totalWrong}`;
    document.getElementById("statAccuracy").textContent =
      `正解率: ${accuracy.toFixed(1)}%`;
  }

  function resetAll() {
    started = false;
    startTime = 0;
    currentLineIndex = -1;
    currentCharIndex = 0;
    charStates = [];
    totalCorrect = 0;
    totalWrong = 0;
    currentCombo = 0;
    maxCombo = 0;
    songFinished = false;
    hideResultPanel();
    renderLyric();
    renderTime(0);
    updateStats();
  }

  function getStats() {
    const elapsedSec = getElapsedSeconds();
    const totalKey = totalCorrect + totalWrong;
    const cpm = elapsedSec > 0 ? totalKey / elapsedSec * 60 : 0;
    const accuracy =
      totalKey > 0 ? (totalCorrect / totalKey) * 100 : 0;
    return {
      totalCorrect,
      totalWrong,
      cpm,
      accuracy,
      maxCombo
    };
  }

  return {
    start,
    updateByTime,
    handleKeydown,
    resetAll,
    getElapsedSeconds,
    getStats
  };
})();

// =========================
// 3. メインループ（動画時間 or 練習モード時間）
// =========================
function updateFromPlayer() {
  let t = 0;

  if (practiceMode) {
    if (practiceStartMs > 0) {
      t = (performance.now() - practiceStartMs) / 1000;
    } else {
      t = 0;
    }
  } else if (player && typeof player.getCurrentTime === "function") {
    try {
      t = player.getCurrentTime() || 0;
    } catch (e) {
      t = 0;
    }
  }

  typingState.updateByTime(t);

  // 曲の終了判定 → スコア表示
  const lyrics = getLyrics();
  if (!songFinished && lyrics.length) {
    const lastEnd = lyrics[lyrics.length - 1].end;
    if (t > lastEnd + 0.5) {
      songFinished = true;
      const stats = typingState.getStats();
      const score =
        Math.max(0,
          Math.round(
            stats.totalCorrect * 10 - stats.totalWrong * 5 + stats.maxCombo * 2
          )
        );
      showResultPanel({
        score,
        totalCorrect: stats.totalCorrect,
        totalWrong: stats.totalWrong,
        accuracy: stats.accuracy,
        cpm: stats.cpm,
        maxCombo: stats.maxCombo
      });
    }
  }
}
setInterval(updateFromPlayer, 50);

// タイピングエリアのキー入力
const typingArea = document.getElementById("typing-area");
typingArea.addEventListener("keydown", (e) => {
  typingState.handleKeydown(e);
});
typingArea.addEventListener("click", () => {
  typingArea.focus();
});

// =========================
// 4. 曲エディタ + JSON エクスポート/インポート + romaji自動生成
// =========================
const songEditorEl = document.getElementById("song-editor");
const openEditorBtn = document.getElementById("openEditorBtn");
const closeEditorBtn = document.getElementById("closeEditorBtn");
const saveNewSongBtn = document.getElementById("saveNewSongBtn");
const saveCurrentSongBtn = document.getElementById("saveCurrentSongBtn");
const autoRomajiBtn = document.getElementById("autoRomajiBtn");
const exportSongsBtn = document.getElementById("exportSongsBtn");
const importSongsBtn = document.getElementById("importSongsBtn");
const importFileInput = document.getElementById("importFileInput");
const songTitleInput = document.getElementById("songTitleInput");
const songVideoInput = document.getElementById("songVideoInput");
const lyricsTextInput = document.getElementById("lyricsTextInput");
const editorInfoEl = document.getElementById("editorInfo");

function openEditor(prefillFromCurrent = true) {
  songEditorEl.classList.remove("hidden");
  if (prefillFromCurrent && currentSong) {
    songTitleInput.value = currentSong.title || "";
    songVideoInput.value = currentSong.videoId || "";
    lyricsTextInput.value = formatLyricsText(currentSong.lyrics || []);
    editorInfoEl.textContent = "現在選択中の曲を編集しています。";
  } else {
    songTitleInput.value = "";
    songVideoInput.value = "";
    lyricsTextInput.value = "";
    editorInfoEl.textContent =
      "新しい曲として登録します。書式: start秒,end秒,日本語,romaji を1行ずつ。";
  }
}

function closeEditor() {
  songEditorEl.classList.add("hidden");
}

openEditorBtn.addEventListener("click", () => {
  openEditor(true);
});
closeEditorBtn.addEventListener("click", () => {
  closeEditor();
});

saveNewSongBtn.addEventListener("click", () => {
  const title = songTitleInput.value.trim() || "無題の曲";
  const videoRaw = songVideoInput.value.trim();
  const videoId = extractVideoId(videoRaw);
  const lyrics = parseLyricsText(lyricsTextInput.value);

  if (!lyrics.length) {
    alert("有効な歌詞行がありません。書式: start秒,end秒,日本語,romaji");
    return;
  }

  const newSong = {
    id: "song-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    title,
    videoId,
    lyrics
  };
  songs.push(newSong);
  currentSong = newSong;
  saveSongsToStorage();
  renderSongList();

  document.getElementById("videoId").value = videoId;
  typingState.resetAll();
  alert("新しい曲として保存しました。");
});

saveCurrentSongBtn.addEventListener("click", () => {
  if (!currentSong) {
    alert("現在選択中の曲がありません。曲リストから選択してください。");
    return;
  }

  const title = songTitleInput.value.trim() || "無題の曲";
  const videoRaw = songVideoInput.value.trim();
  const videoId = extractVideoId(videoRaw);
  const lyrics = parseLyricsText(lyricsTextInput.value);

  if (!lyrics.length) {
    alert("有効な歌詞行がありません。書式: start秒,end秒,日本語,romaji");
    return;
  }

  currentSong.title = title;
  currentSong.videoId = videoId;
  currentSong.lyrics = lyrics;
  saveSongsToStorage();
  renderSongList();

  document.getElementById("videoId").value = videoId;
  typingState.resetAll();
  alert("現在の曲を上書き保存しました。");
});

// romaji自動生成
autoRomajiBtn.addEventListener("click", () => {
  const lyrics = parseLyricsText(lyricsTextInput.value);
  if (!lyrics.length) {
    alert("歌詞行がありません。先に歌詞を入力してください。");
    return;
  }

  const updated = lyrics.map(line => {
    const jp = line.text || "";
    let roma = line.romaji || "";
    if (!roma) {
      roma = kanaToRomaji(jp);
    }
    return {
      ...line,
      romaji: roma
    };
  });

  lyricsTextInput.value = formatLyricsText(updated);
  alert("日本語から簡易的に romaji を生成しました。必要に応じて手で修正してください。");
});

// JSONエクスポート
exportSongsBtn.addEventListener("click", () => {
  const dataStr = JSON.stringify(songs, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  a.href = url;
  a.download = `lyrics_songs_backup_${yyyy}${mm}${dd}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// JSONインポート
importSongsBtn.addEventListener("click", () => {
  importFileInput.value = "";
  importFileInput.click();
});

importFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target.result;
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        alert("JSON の形式が不正です（配列ではありません）。");
        return;
      }
      if (!parsed.every(s => typeof s.id === "string" && Array.isArray(s.lyrics))) {
        alert("曲データの形式が違うようです。");
        return;
      }

      songs = parsed;
      currentSong = songs[0] || null;
      saveSongsToStorage();
      renderSongList();

      if (currentSong) {
        document.getElementById("videoId").value = currentSong.videoId || "";
        typingState.resetAll();
      }

      alert("曲データを読み込みました。");
    } catch (err) {
      console.error(err);
      alert("JSON の読み込みに失敗しました。");
    }
  };
  reader.readAsText(file, "utf-8");
});

// =========================
// 5. 初期化
// =========================
function initApp() {
  loadSongsFromStorage();
  renderSongList();

  if (currentSong) {
    document.getElementById("videoId").value = currentSong.videoId || "";
    typingState.resetAll();
  }
}

initApp();

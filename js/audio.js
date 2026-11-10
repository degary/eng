/* ================= 音频播放模块 =================
 * 优先播放本地预生成的 mp3 文件（audio/manifest.json 映射文本->文件路径）。
 * 若本地音频不存在或加载失败，自动回退到浏览器内置 Web Speech API。
 * 这样即使还没生成音频文件，页面在开发阶段也能正常出声音。
 */
let AUDIO_MANIFEST = null;
let manifestLoadPromise = null;

function loadManifest() {
  if (manifestLoadPromise) return manifestLoadPromise;
  manifestLoadPromise = fetch("audio/manifest.json")
    .then(r => (r.ok ? r.json() : {}))
    .then(data => { AUDIO_MANIFEST = data; return data; })
    .catch(() => { AUDIO_MANIFEST = {}; return {}; });
  return manifestLoadPromise;
}
loadManifest();

function normalizeKey(text) {
  return text.trim();
}

let currentAudio = null;

function speak(text, rate) {
  const key = normalizeKey(text);

  if (AUDIO_MANIFEST && AUDIO_MANIFEST[key]) {
    playLocalAudio(AUDIO_MANIFEST[key], text, rate);
    return;
  }
  if (AUDIO_MANIFEST === null) {
    // manifest still loading; wait briefly then retry once
    loadManifest().then(() => {
      if (AUDIO_MANIFEST && AUDIO_MANIFEST[key]) {
        playLocalAudio(AUDIO_MANIFEST[key], text, rate);
      } else {
        speakWithBrowserTTS(text, rate);
      }
    });
    return;
  }
  speakWithBrowserTTS(text, rate);
}

function playLocalAudio(path, fallbackText, rate) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    const audio = new Audio(`audio/${path}`);
    currentAudio = audio;
    audio.playbackRate = 1.0;
    audio.play().catch(() => {
      speakWithBrowserTTS(fallbackText, rate);
    });
  } catch (e) {
    speakWithBrowserTTS(fallbackText, rate);
  }
}

function speakWithBrowserTTS(text, rate) {
  if (!window.speechSynthesis) {
    toast("当前浏览器不支持发音");
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate || 0.85;
  u.pitch = 1.15;
  const voices = speechSynthesis.getVoices();
  const v = voices.find(v => v.lang.startsWith("en"));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => {};
}

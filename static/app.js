let lastTrackId = null;
let lastSettingsVersion = null;
let lastTickerText = "";
let lastTickerMode = "text";
let lastTickerUrl = "";
let everHadTrack = false;

let tickerPendingText = null;
let tickerListenerAttached = false;

const $ = (id) => document.getElementById(id);

function msToTime(ms){
  ms = Math.max(0, ms || 0);
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2,"0")}`;
}

function showFallback(show){
  $("fallback").classList.toggle("hidden", !show);
  $("card").classList.toggle("hidden", show);
}

function setBackground(url){
  if (url) $("bg").style.backgroundImage = `url("${url}")`;
}

function applyTextScale(scale){
  const v = (typeof scale === "number" && !Number.isNaN(scale)) ? scale : 1;
  document.documentElement.style.setProperty("--text-scale", String(v));
}

function applyFallbackImage(settings){
  const img = $("fallbackImg");
  const url = settings?.fallback_logo || "";
  if (url){
    img.src = url + "?v=" + Date.now();
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
    img.removeAttribute("src");
  }
}

function updateProgress(d){
  if (!d || !d.duration_ms) return;
  const pct = Math.max(0, Math.min(100, (d.progress_ms / d.duration_ms) * 100));
  $("barFill").style.width = `${pct}%`;
  $("tNow").textContent = msToTime(d.progress_ms);
  $("tDur").textContent = msToTime(d.duration_ms);
}

function renderNowPlaying(d){
  $("track").textContent = d.track_name || "—";
  $("artist").textContent = d.artists || "—";
  $("album").textContent = d.album_name || "—";

  if (d.album_art){
    $("art").src = d.album_art;
    setBackground(d.album_art);
  }

  updateProgress(d);
}

async function pollNowPlaying(){
  try{
    const r = await fetch("/api/now-playing", { cache:"no-store" });
    const j = await r.json();
    const d = j.data;

    if (!d){
      if (!everHadTrack) showFallback(true);
      return;
    }

    everHadTrack = true;

    if (!d.is_playing){
      showFallback(true);
      return;
    }

    showFallback(false);

    if (d.track_id !== lastTrackId){
      renderNowPlaying(d);
      lastTrackId = d.track_id;
    } else {
      updateProgress(d);
    }
  } catch {
    if (!everHadTrack) showFallback(true);
  }
}

/* =========================
   TICKER (FULL LOOP, NO EARLY RESTART)
========================= */

function applyTickerAnimation(inner, speed){
  const container = inner.parentElement;
  if (!container) return;

  const textWidth = inner.scrollWidth;
  const containerWidth = container.clientWidth;

  const pxPerSecond = Math.max(10, speed * 3);
  const distance = textWidth + containerWidth;
  const duration = distance / pxPerSecond;

  // Keep infinite loop like your working version
  inner.style.animation = "none";
  inner.offsetHeight;
  inner.style.animation = `ticker-loop ${duration}s linear infinite`;
}

function ensureTickerLoopListener(){
  if (tickerListenerAttached) return;
  const inner = $("tickerInner");
  if (!inner) return;

  inner.addEventListener("animationiteration", () => {
    // Apply pending text ONLY between loops
    if (typeof tickerPendingText === "string") {
      inner.textContent = tickerPendingText;
      tickerPendingText = null;
      // Duration may change with new length
      // (speed will be reapplied from latest settings in applyTicker)
    }
  });

  tickerListenerAttached = true;
}

function buildRssText(mode, settings, items){
  if (mode === "rss") {
    return (items || []).join(" • ");
  }
  if (mode === "mixed") {
    const out = [];
    (items || []).forEach(h => {
      out.push(h);
      if (settings.ticker_text) out.push(settings.ticker_text);
    });
    return out.join(" • ");
  }
  return settings.ticker_text || "";
}

function applyTicker(s){
  const ticker = $("ticker");
  const inner = $("tickerInner");

  ensureTickerLoopListener();

  if (!s.show_ticker){
    ticker.classList.add("hidden");
    inner.style.animation = "";
    lastTickerText = "";
    tickerPendingText = null;
    return;
  }

  ticker.classList.remove("hidden");

  const mode = (s.ticker_mode || "text").toLowerCase();
  const rssUrl = s.ticker_rss_url || "";

  // If mode/url changed, clear immediately and restart
  const modeChanged = (mode !== lastTickerMode || rssUrl !== lastTickerUrl);
  if (modeChanged){
    lastTickerMode = mode;
    lastTickerUrl = rssUrl;
    lastTickerText = "";
    tickerPendingText = null;
    inner.textContent = "";
  }

  inner.style.fontSize = `${s.ticker_font_size || 22}px`;

  if (mode === "text"){
    const text = s.ticker_text || "";
    if (text !== lastTickerText){
      // In text mode we can apply immediately (safe)
      inner.textContent = text;
      lastTickerText = text;
      applyTickerAnimation(inner, s.ticker_speed || 50);
    } else if (!inner.style.animation){
      applyTickerAnimation(inner, s.ticker_speed || 50);
    }
    return;
  }

  // RSS / Mixed: do not replace mid-scroll; queue it for next loop boundary
  fetch("/api/ticker/rss", { cache:"no-store" })
    .then(r => r.json())
    .then(j => {
      if (!j || !Array.isArray(j.items)) return;

      const next = buildRssText(mode, s, j.items);
      if (!next) return;

      if (!lastTickerText){
        // First time: set immediately and start animation
        inner.textContent = next;
        lastTickerText = next;
        applyTickerAnimation(inner, s.ticker_speed || 50);
      } else if (next !== lastTickerText){
        // Queue for next loop end
        tickerPendingText = next;
        lastTickerText = next;
        // Do not restart animation here
      } else if (!inner.style.animation){
        applyTickerAnimation(inner, s.ticker_speed || 50);
      }
    })
    .catch(() => {});
}

async function pollSettings(){
  const r = await fetch("/api/settings", { cache:"no-store" });
  const j = await r.json();
  const s = j.settings || {};

  document.body.classList.remove("layout-horizontal","layout-vertical");
  document.body.classList.add(`layout-${s.layout || "horizontal"}`);

  applyFallbackImage(s);
  applyTicker(s);
  applyTextScale(s.text_scale);

  if (lastSettingsVersion === null){
    lastSettingsVersion = s.kiosk_force_reload_version;
  } else if (s.kiosk_force_reload_version !== lastSettingsVersion){
    location.reload();
  }
}

function boot(){
  showFallback(true);
  pollSettings();
  pollNowPlaying();
  setInterval(pollSettings, 3000);
  setInterval(pollNowPlaying, 2000);
}

boot();


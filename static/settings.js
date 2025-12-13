const $ = (id) => document.getElementById(id);

/* =========================
   AUTH
========================= */

async function login(){
  const res = await fetch("/api/settings/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: $("pw").value })
  });

  if (res.ok) location.reload();
  else {
    const j = await res.json().catch(() => null);
    $("loginMsg").textContent = (j && j.error) ? j.error : "Wrong password";
  }
}

/* =========================
   PASSWORD
========================= */

async function changePassword(){
  $("pwMsg").textContent = "Updating…";
  const res = await fetch("/api/settings/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      old_password: $("old_password").value,
      new_password: $("new_password").value
    })
  });

  if (res.ok) $("pwMsg").textContent = "Password updated ✓";
  else {
    const j = await res.json().catch(() => null);
    $("pwMsg").textContent = (j && j.error) ? j.error : "Error";
  }
}

/* =========================
   KIOSK
========================= */

async function refreshKiosk(){
  await fetch("/api/refresh-kiosk", { method: "POST" });
}

/* =========================
   FALLBACK IMAGE
========================= */

async function uploadFallback(){
  const file = $("fallbackUpload").files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload-fallback", {
    method: "POST",
    body: fd
  });

  if (res.ok) {
    const j = await res.json().catch(() => null);
    if (j && j.url) $("fallback_logo").value = j.url;
  }
}

/* =========================
   LOAD SETTINGS
========================= */

async function load(){
  const res = await fetch("/api/settings", { cache: "no-store" });
  const j = await res.json();
  const s = j.settings || {};

  if ($("spotifyState")) {
    $("spotifyState").textContent = j.spotify_connected ? "Connected" : "Not connected";
  }

  if ($("theme")) $("theme").value = s.theme || "dark";
  if ($("layout")) $("layout").value = s.layout || "horizontal";
  if ($("text_scale")) $("text_scale").value = (s.text_scale ?? 1.0);
  if ($("logo_url")) $("logo_url").value = s.logo_url || "";
  if ($("fallback_logo")) $("fallback_logo").value = s.fallback_logo || "";

  if ($("show_ticker")) $("show_ticker").checked = !!s.show_ticker;
  if ($("ticker_mode")) $("ticker_mode").value = s.ticker_mode || "text";
  if ($("ticker_text")) $("ticker_text").value = s.ticker_text || "";
  if ($("ticker_rss_url")) $("ticker_rss_url").value = s.ticker_rss_url || "";
  if ($("ticker_rss_interval")) $("ticker_rss_interval").value = s.ticker_rss_interval || 300;
  if ($("ticker_font_size")) $("ticker_font_size").value = s.ticker_font_size ?? 22;
  if ($("ticker_speed")) $("ticker_speed").value = s.ticker_speed ?? 60;

  /* Spotify credentials */
  if ($("spotify_client_id")) $("spotify_client_id").value = j.spotify_client_id || "";
  if ($("spotify_client_secret")) $("spotify_client_secret").value = "";
  if ($("spotify_redirect_uri")) {
    $("spotify_redirect_uri").value =
      j.spotify_redirect_uri || "http://127.0.0.1:5000/callback";
  }

  updateTickerFields();
}

/* =========================
   SAVE ALL SETTINGS
========================= */

async function save(){
  $("saveMsg").textContent = "Saving…";

  let fallback = $("fallback_logo")?.value || "";

  // ✅ NORMALIZE FALLBACK PATH
  if (fallback && !fallback.startsWith("/") && !fallback.startsWith("http")) {
    fallback = "/static/uploads/" + fallback;
  }

  const payload = {
    theme: $("theme")?.value,
    layout: $("layout")?.value,
    text_scale: parseFloat($("text_scale")?.value || "1"),
    logo_url: $("logo_url")?.value,
    fallback_logo: fallback,
    show_ticker: $("show_ticker")?.checked,

    ticker_mode: $("ticker_mode")?.value,
    ticker_text: $("ticker_text")?.value,
    ticker_rss_url: $("ticker_rss_url")?.value,
    ticker_rss_interval: Number($("ticker_rss_interval")?.value),
    ticker_font_size: Number($("ticker_font_size")?.value),
    ticker_speed: Number($("ticker_speed")?.value),

    spotify_client_id: $("spotify_client_id")?.value,
    spotify_client_secret: $("spotify_client_secret")?.value,
    spotify_redirect_uri: $("spotify_redirect_uri")?.value
  };

  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (res.ok) $("saveMsg").textContent = "Saved ✓";
  else {
    const j = await res.json().catch(() => null);
    $("saveMsg").textContent = (j && j.error) ? j.error : "Error";
  }
}

/* =========================
   SAVE SPOTIFY ONLY
========================= */

async function saveSpotifyCredentials(){
  const msg = $("spotifySaveMsg");
  if (msg) msg.textContent = "Saving…";

  const payload = {
    spotify_client_id: $("spotify_client_id")?.value,
    spotify_client_secret: $("spotify_client_secret")?.value,
    spotify_redirect_uri: $("spotify_redirect_uri")?.value
  };

  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (msg) {
    if (res.ok) msg.textContent = "Credentials saved ✓";
    else msg.textContent = "Error saving credentials";
  }
}

/* =========================
   TICKER UI LOGIC
========================= */

function updateTickerFields(){
  const show = $("show_ticker")?.checked;
  const mode = $("ticker_mode")?.value || "text";
  const rssEnabled = (mode === "rss" || mode === "mixed");
  const disableAll = !show;

  if ($("ticker_mode")) $("ticker_mode").disabled = disableAll;
  if ($("ticker_text")) $("ticker_text").disabled = disableAll || rssEnabled;
  if ($("ticker_rss_url")) $("ticker_rss_url").disabled = disableAll || !rssEnabled;
  if ($("ticker_rss_interval")) $("ticker_rss_interval").disabled = disableAll || !rssEnabled;
  if ($("ticker_font_size")) $("ticker_font_size").disabled = disableAll;
  if ($("ticker_speed")) $("ticker_speed").disabled = disableAll;
}

/* =========================
   EVENT BINDINGS
========================= */

if ($("btnLogin")) $("btnLogin").onclick = login;
if ($("btnSaveSpotify")) $("btnSaveSpotify").onclick = saveSpotifyCredentials;

if ($("btnSave")) {
  load();
  $("btnSave").onclick = save;
  if ($("show_ticker")) $("show_ticker").addEventListener("change", updateTickerFields);
  if ($("ticker_mode")) $("ticker_mode").addEventListener("change", updateTickerFields);
}

if ($("btnRefresh")) $("btnRefresh").onclick = refreshKiosk;
if ($("btnChangePw")) $("btnChangePw").onclick = changePassword;
if ($("fallbackUpload")) $("fallbackUpload").addEventListener("change", uploadFallback);


import os
import json
import time
import hmac
import hashlib
from urllib.parse import urlencode

import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, request, redirect, jsonify

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing"

SCOPES = "user-read-playback-state user-read-currently-playing"

app = Flask(__name__, static_folder="static", template_folder="templates")

# =========================
# CACHES
# =========================

LAST_PLAYBACK = {"data": None, "updated_at": 0}
RSS_CACHE = {"items": [], "updated_at": 0}

# =========================
# CONFIG HELPERS
# =========================

def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

def bump_settings_version(cfg):
    cfg["settings"]["kiosk_force_reload_version"] = int(time.time())
    save_config(cfg)

def normalize_ticker_settings(settings):
    valid = {"off", "text", "rss", "mixed"}
    if settings.get("ticker_mode") not in valid:
        settings["ticker_mode"] = "text"
    return settings

# =========================
# SECURITY
# =========================

def sha256_hex(s):
    return hashlib.sha256(s.encode()).hexdigest()

def verify_password(cfg, password):
    stored = cfg.get("settings_password_hash")
    if not stored:
        if password == "pibox123":
            cfg["settings_password_hash"] = sha256_hex(password)
            save_config(cfg)
            return True
        return False
    return hmac.compare_digest(stored, sha256_hex(password))

def require_settings_auth(cfg):
    cookie = request.cookies.get("settings_auth", "")
    expected = sha256_hex(cfg.get("settings_password_hash", "") + "|settings")
    return cookie and hmac.compare_digest(cookie, expected)

def set_settings_cookie(resp, cfg):
    token = sha256_hex(cfg.get("settings_password_hash", "") + "|settings")
    resp.set_cookie("settings_auth", token, httponly=True, samesite="Lax")

# =========================
# SPOTIFY HELPERS
# =========================

def spotify_refresh_token(cfg):
    rt = cfg.get("refresh_token")
    if not rt:
        return False

    r = requests.post(
        SPOTIFY_TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": rt,
            "client_id": cfg.get("spotify_client_id", ""),
            "client_secret": cfg.get("spotify_client_secret", "")
        },
        timeout=10
    )

    if r.status_code != 200:
        return False

    j = r.json()
    cfg["access_token"] = j.get("access_token", "")
    cfg["token_expires_at"] = int(time.time()) + max(60, j.get("expires_in", 3600) - 30)
    if j.get("refresh_token"):
        cfg["refresh_token"] = j["refresh_token"]
    save_config(cfg)
    return True

def spotify_get_access_token(cfg):
    token = cfg.get("access_token")
    if not token or time.time() > cfg.get("token_expires_at", 0):
        if not spotify_refresh_token(cfg):
            return None
    return cfg.get("access_token")

def spotify_headers(cfg):
    token = spotify_get_access_token(cfg)
    return {"Authorization": f"Bearer {token}"} if token else None

# =========================
# ROUTES
# =========================

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/settings")
def settings_page():
    cfg = load_config()
    locked = not require_settings_auth(cfg)
    return render_template("settings.html", locked=locked, version=cfg.get("version", ""))

# =========================
# SETTINGS API
# =========================

@app.post("/api/settings/login")
def settings_login():
    cfg = load_config()
    pw = (request.json or {}).get("password", "")
    if not verify_password(cfg, pw):
        return jsonify(ok=False, error="Invalid password"), 401
    resp = jsonify(ok=True)
    set_settings_cookie(resp, cfg)
    return resp

@app.get("/api/settings")
def api_get_settings():
    cfg = load_config()
    return jsonify(
        version=cfg.get("version", ""),
        settings=cfg.get("settings", {}),
        spotify_connected=bool(cfg.get("refresh_token")),
        spotify_client_id=cfg.get("spotify_client_id"),
        spotify_redirect_uri=cfg.get("spotify_redirect_uri")
    )

@app.post("/api/settings")
def api_set_settings():
    cfg = load_config()
    if not require_settings_auth(cfg):
        return jsonify(ok=False, error="Unauthorized"), 401

    payload = request.json or {}
    settings = cfg.get("settings", {})

    creds_changed = False
    for k in ("spotify_client_id", "spotify_client_secret", "spotify_redirect_uri"):
        if k in payload and payload[k] and payload.get(k) != cfg.get(k):
            cfg[k] = payload[k]
            creds_changed = True

    if creds_changed:
        cfg["access_token"] = ""
        cfg["refresh_token"] = ""
        cfg["token_expires_at"] = 0

    for key in (
        "theme","layout","text_scale","logo_url","fallback_logo","show_ticker",
        "ticker_mode","ticker_text","ticker_font_size","ticker_speed",
        "ticker_rss_url","ticker_rss_interval"
    ):
        if key in payload:
            settings[key] = payload[key]

    settings = normalize_ticker_settings(settings)
    cfg["settings"] = settings
    bump_settings_version(cfg)
    return jsonify(ok=True, settings=settings)

@app.post("/api/refresh-kiosk")
def refresh_kiosk():
    cfg = load_config()
    if not require_settings_auth(cfg):
        return jsonify(ok=False), 401
    bump_settings_version(cfg)
    return jsonify(ok=True)

# =========================
# ✅ FIXED FALLBACK UPLOAD
# =========================

@app.post("/api/upload-fallback")
def upload_fallback():
    cfg = load_config()
    if not require_settings_auth(cfg):
        return jsonify(ok=False), 401

    f = request.files.get("file")
    if not f:
        return jsonify(ok=False), 400

    path = os.path.join(UPLOAD_FOLDER, "fallback.png")
    f.save(path)

    url = "/static/uploads/fallback.png"
    cfg["settings"]["fallback_logo"] = url
    bump_settings_version(cfg)

    return jsonify(ok=True, url=url)

# =========================
# SPOTIFY AUTH
# =========================

@app.get("/login")
def spotify_login():
    cfg = load_config()
    return redirect(
        f"{SPOTIFY_AUTH_URL}?" + urlencode({
            "client_id": cfg.get("spotify_client_id", ""),
            "response_type": "code",
            "redirect_uri": cfg.get("spotify_redirect_uri", ""),
            "scope": SCOPES,
            "show_dialog": "true"
        })
    )

@app.get("/callback")
def spotify_callback():
    cfg = load_config()
    code = request.args.get("code")
    if not code:
        return "Missing code", 400

    r = requests.post(
        SPOTIFY_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": cfg.get("spotify_redirect_uri", ""),
            "client_id": cfg.get("spotify_client_id", ""),
            "client_secret": cfg.get("spotify_client_secret", "")
        },
        timeout=10
    )

    j = r.json()
    cfg["access_token"] = j.get("access_token", "")
    cfg["refresh_token"] = j.get("refresh_token", "")
    cfg["token_expires_at"] = int(time.time()) + max(60, j.get("expires_in", 3600) - 30)
    save_config(cfg)
    return redirect("/settings")

# =========================
# NOW PLAYING
# =========================

@app.get("/api/now-playing")
def now_playing():
    cfg = load_config()
    headers = spotify_headers(cfg)
    if not headers:
        return jsonify(ok=True, data=LAST_PLAYBACK["data"])

    r = requests.get(SPOTIFY_NOW_PLAYING_URL, headers=headers, timeout=8)
    if r.status_code != 200:
        return jsonify(ok=True, data=LAST_PLAYBACK["data"])

    j = r.json() or {}
    item = j.get("item")
    if not item:
        return jsonify(ok=True, data=LAST_PLAYBACK["data"])

    album = item.get("album", {})
    images = album.get("images") or []
    data = {
        "track_id": item.get("id"),
        "track_name": item.get("name"),
        "artists": ", ".join(a["name"] for a in item.get("artists", [])),
        "album_name": album.get("name", ""),
        "album_art": images[0]["url"] if images else "",
        "progress_ms": j.get("progress_ms", 0),
        "duration_ms": item.get("duration_ms", 0),
        "is_playing": j.get("is_playing", False)
    }

    LAST_PLAYBACK["data"] = data
    LAST_PLAYBACK["updated_at"] = int(time.time())
    return jsonify(ok=True, data=data)

# =========================
# RSS TICKER
# =========================

@app.get("/api/ticker/rss")
def ticker_rss():
    cfg = load_config()
    s = cfg.get("settings", {})
    mode = s.get("ticker_mode")
    url = s.get("ticker_rss_url")
    interval = int(s.get("ticker_rss_interval", 300))
    now = int(time.time())

    if mode in ("rss", "mixed") and url:
        if now - RSS_CACHE["updated_at"] > interval:
            try:
                r = requests.get(url, timeout=8)
                root = ET.fromstring(r.text)
                items = []
                for it in root.iter():
                    if it.tag.endswith("item"):
                        for c in it:
                            if c.tag.endswith("title") and c.text:
                                items.append(c.text.strip())
                                break
                        if len(items) >= 20:
                            break
                RSS_CACHE["items"] = items
                RSS_CACHE["updated_at"] = now
            except Exception:
                pass

    return jsonify(settings=s, items=RSS_CACHE["items"])

# =========================
# RUN
# =========================

if __name__ == "__main__":
    cfg = load_config()
    app.run(host=cfg.get("host","0.0.0.0"), port=int(cfg.get("port",5000)), debug=True)


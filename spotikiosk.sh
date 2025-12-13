#!/usr/bin/env bash
set -e

# ==========================================================
# SpotiKiosk installer / controller
# ==========================================================

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$BASE_DIR/venv"
PYTHON="$VENV/bin/python"

CONFIG_FILE="$BASE_DIR/config.json"

SERVICE_BACKEND="spotikiosk"
SERVICE_KIOSK="spotikiosk-kiosk"

USER_SYSTEMD="$HOME/.config/systemd/user"
mkdir -p "$USER_SYSTEMD"

pause() {
  echo
  read -rp "Press Enter to continue..."
}

# ==========================================================
# Install / Update
# ==========================================================
install_app() {
  echo "=== Installing / Updating SpotiKiosk ==="
  echo

  sudo apt update

  echo "Installing system dependencies..."
  sudo apt install -y \
    python3 \
    python3-venv \
    python3-pip \
    chromium-browser \
    unclutter \
    curl \
    git \
    avahi-daemon \
    avahi-utils

  echo
  echo "Enabling local hostname (mDNS / .local)..."
  sudo systemctl enable avahi-daemon
  sudo systemctl start avahi-daemon

  CURRENT_HOSTNAME="$(hostname)"
  if [ "$CURRENT_HOSTNAME" != "spotikiosk" ]; then
    echo "Setting hostname to spotikiosk (reboot required)..."
    sudo hostnamectl set-hostname spotikiosk
  else
    echo "Hostname already set to spotikiosk"
  fi

  echo
  echo "Setting up Python virtual environment..."
  if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
  else
    echo "Virtual environment already exists."
  fi

  echo "Upgrading pip..."
  "$PYTHON" -m pip install --upgrade pip

  if [ -f "$BASE_DIR/requirements.txt" ]; then
    echo "Installing Python dependencies..."
    "$VENV/bin/pip" install -r "$BASE_DIR/requirements.txt"
  else
    echo "ERROR: requirements.txt not found"
    exit 1
  fi

  echo
  echo "Preparing directories..."
  mkdir -p "$BASE_DIR/static/uploads"

  echo
  echo "Preparing config file..."
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "Creating default config.json"

    cat > "$CONFIG_FILE" <<'EOF'
{
  "version": "v2.5.0",
  "host": "0.0.0.0",
  "port": 5000,
  "spotify_client_id": "",
  "spotify_client_secret": "",
  "spotify_redirect_uri": "http://127.0.0.1:5000/callback",
  "settings": {
    "theme": "dark",
    "layout": "horizontal",
    "logo_url": "",
    "fallback_logo": "static/uploads/fallback.png",
    "show_ticker": false,
    "ticker_text": "",
    "ticker_font_size": 22,
    "ticker_speed": 60,
    "kiosk_force_reload_version": 1765584211,
    "text_scale": 1.0,
    "ticker_content_mode": "text",
    "ticker_rss_url": "",
    "ticker_rss_interval": 300
  }
}
EOF

    echo "config.json created with default values"
  else
    echo "config.json already exists, keeping existing configuration"
  fi

  echo
  echo "Fixing file permissions..."
  sudo chown -R "$USER:$USER" "$BASE_DIR"

  echo
  echo "✅ Installation complete"
  echo
  echo "Open Settings:"
  echo "  http://spotikiosk.local:5000/settings"
  echo "  http://127.0.0.1:5000/settings"
  echo
  echo "⚠️  Please REBOOT once to fully activate the hostname."
}

# ==========================================================
# Backend service
# ==========================================================
enable_backend() {
  echo "Enabling SpotiKiosk backend service..."

  cat > "$USER_SYSTEMD/$SERVICE_BACKEND.service" <<EOF
[Unit]
Description=SpotiKiosk Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=$BASE_DIR
ExecStart=$PYTHON app.py
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_BACKEND"
  systemctl --user start "$SERVICE_BACKEND"

  echo "✅ Backend service enabled"
}

disable_backend() {
  systemctl --user stop "$SERVICE_BACKEND" || true
  systemctl --user disable "$SERVICE_BACKEND" || true
  rm -f "$USER_SYSTEMD/$SERVICE_BACKEND.service"
  systemctl --user daemon-reload
  echo "✅ Backend service disabled"
}

# ==========================================================
# Chromium kiosk
# ==========================================================
enable_kiosk() {
  echo "Enabling Chromium kiosk..."

  cat > "$USER_SYSTEMD/$SERVICE_KIOSK.service" <<EOF
[Unit]
Description=SpotiKiosk Chromium Kiosk
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/chromium-browser \
  --kiosk \
  --incognito \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  http://127.0.0.1:5000
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_KIOSK"
  systemctl --user start "$SERVICE_KIOSK"

  echo "✅ Chromium kiosk enabled"
}

disable_kiosk() {
  systemctl --user stop "$SERVICE_KIOSK" || true
  systemctl --user disable "$SERVICE_KIOSK" || true
  rm -f "$USER_SYSTEMD/$SERVICE_KIOSK.service"
  systemctl --user daemon-reload
  echo "✅ Chromium kiosk disabled"
}

# ==========================================================
# Uninstall
# ==========================================================
uninstall_all() {
  echo "⚠️  This will REMOVE SpotiKiosk services and the Python virtual environment."
  echo "    Application files will remain."
  echo
  read -rp "Type 'yes' to continue: " c
  if [ "$c" != "yes" ]; then
    echo "Cancelled."
    return
  fi

  disable_kiosk
  disable_backend

  rm -rf "$VENV"

  echo
  if [ -f "$CONFIG_FILE" ]; then
    read -rp "Delete config.json as well? (y/N): " delcfg
    if [[ "$delcfg" =~ ^[Yy]$ ]]; then
      rm -f "$CONFIG_FILE"
      echo "config.json deleted"
    else
      echo "config.json preserved"
    fi
  fi

  echo
  echo "✅ SpotiKiosk uninstalled"
}

# ==========================================================
# Menu
# ==========================================================
while true; do
  clear
  echo "=== SpotiKiosk Control Menu ==="
  echo
  echo "1) Install / Update SpotiKiosk"
  echo "2) Enable backend service at startup"
  echo "3) Disable backend service"
  echo "4) Enable Chromium kiosk at startup"
  echo "5) Disable Chromium kiosk"
  echo "6) Uninstall SpotiKiosk"
  echo "0) Exit"
  echo
  read -rp "Select option: " choice

  case "$choice" in
    1) install_app; pause ;;
    2) enable_backend; pause ;;
    3) disable_backend; pause ;;
    4) enable_kiosk; pause ;;
    5) disable_kiosk; pause ;;
    6) uninstall_all; pause ;;
    0) exit 0 ;;
    *) echo "Invalid option"; sleep 1 ;;
  esac
done



# 🎵 SpotiKiosk

**SpotiKiosk** is a self-hosted Spotify *Now Playing* kiosk for bars, cafés, and venues, designed for always-on screens and Raspberry Pi setups. It displays the current track with album art, progress bar, and an optional scrolling ticker (text and/or RSS), includes a fallback screen when music is paused, and offers a password-protected settings panel for live customization. Runs locally, works great in Chromium kiosk mode, and delivers clean, modern “what’s playing” visuals without relying on cloud services.

---

## ✨ Features

- 🎶 Live Spotify “Now Playing”
- 🖼️ Album art with blurred background
- ⏱️ Progress bar with elapsed / remaining time
- 📰 Optional scrolling ticker
  - Text only
  - RSS feed
  - RSS + text combined
- 🖼️ Fallback image when playback is paused
- 🎨 Horizontal or vertical layouts
- 🔐 Password-protected settings panel
- 🖥️ Kiosk-friendly (Chromium fullscreen ready)
- 🍓 Raspberry Pi compatible (Zero 2 W recommended or better)

---

## 🖥️ Requirements

- Linux system (Ubuntu or Raspberry Pi OS)
- Python **3.9+**
- Spotify account
- Spotify Developer credentials

---

## 🚀 Installation

### 1️⃣ **Clone the repository**

    git clone https://github.com/lon3wolf2k/spotikiosk.git
    cd spotikiosk

### 2️⃣ **Run the installer**

     chmod +x spotikiosk.sh

    ./spotikiosk.sh

The installer will:

Install system dependencies

Create a Python virtual environment

Install required Python packages

### ▶️ **Running SpotiKiosk**

     python3 app.py

Access URLs:

Frontend: http://127.0.0.1:5000

Settings: http://127.0.0.1:5000/settings

🔐 Default Settings Password

pibox123
Change it in Settings → Security after first login.

🎵 Spotify Setup (IMPORTANT)
You need Spotify Developer credentials.

Go to https://developer.spotify.com/dashboard

Create a new app

Copy:

 - Client ID
 - Client Secret
 - Set Redirect URI to:

    http://127.0.0.1:5000/callback

 - Configure SpotiKiosk
 - Open /settings
 - Enter:
 - Client ID
 - Client Secret
 - Callback URL
 - Click Save
 - Click Login with Spotify

⚠️ Important: Local Login Requirement
Spotify authentication must be done from the same machine running SpotiKiosk
(e.g. the Raspberry Pi itself or via its local browser).

❌ Logging in from another PC using spotikiosk.local or an external IP will fail.
This is a Spotify security restriction.

🖥️ Kiosk Mode (Optional)
SpotiKiosk is designed to run in Chromium kiosk mode.

chromium-browser --kiosk http://127.0.0.1:5000
You can automate this on boot after initial setup.

📰 Ticker Options
Available ticker modes:

 1. Off
 2. Text only
 3. RSS only
 4. RSS + Text

RSS feeds are cached and refreshed automatically.
Runs from your entire network as **spotikiosk.local:5000**

🍓 Raspberry Pi Notes
Recommended: Raspberry Pi Zero 2 W or better

Use wired Ethernet if possible
Disable screen blanking for kiosk usage
Designed for 24/7 operation

📦 Repository Structure
 
spotikiosk/
├── app.py
├── config.json.example
├── install.sh
├── README.md
├── static/
│ ├── app.js
│ ├── styles.css
│ └── uploads/
├── templates/
│ ├── index.html
│ └── settings.html

🧾 License
MIT License

❤️ Credits
Built with Flask, the Spotify Web API, and a lot of love for good bar vibes 🍻

Sample images follow:
🎵 Settings page:
<img src="https://raw.githubusercontent.com/lon3wolf2k/spotikiosk/refs/heads/main/sample-images/image1.jpg">
🎵 Main playing now screen:
<img src="https://raw.githubusercontent.com/lon3wolf2k/spotikiosk/refs/heads/main/sample-images/image2.jpg">
🎵 Sample ticker:
<img src="https://raw.githubusercontent.com/lon3wolf2k/spotikiosk/refs/heads/main/sample-images/image3.jpg">
🎵 Sample RSS feed ticker:
<img src="https://raw.githubusercontent.com/lon3wolf2k/spotikiosk/refs/heads/main/sample-images/image4.jpg">

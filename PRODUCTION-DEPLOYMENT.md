# Production Deployment Guide

## MediaMTX v1.9.2 Production Deployment

### 1. Server Setup (proxy-camera.teknix.services)

#### A. Upload MediaMTX Files
```bash
# Upload to server
scp mediamtx/mediamtx.exe user@proxy-camera.teknix.services:/opt/mediamtx/
scp mediamtx/mediamtx.yml user@proxy-camera.teknix.services:/opt/mediamtx/

# On Windows, if using Linux server, download Linux version:
wget https://github.com/bluenviron/mediamtx/releases/download/v1.9.2/mediamtx_v1.9.2_linux_amd64.tar.gz
```

#### B. Open Firewall Ports
```bash
ssh user@proxy-camera.teknix.services

# Open required ports
sudo ufw allow 80/tcp comment 'HTTP (redirect to HTTPS)'
sudo ufw allow 443/tcp comment 'HTTPS (Reverse Proxy to MediaMTX HLS)'
sudo ufw allow 8554/tcp comment 'MediaMTX RTSP'
sudo ufw allow 8889/tcp comment 'MediaMTX WebRTC'
sudo ufw allow 8189/udp comment 'MediaMTX WebRTC ICE'
sudo ufw reload
sudo ufw status numbered

# Note: Port 8888 should NOT be exposed publicly - only via reverse proxy on 443
# Verify ports are open
nc -zv proxy-camera.teknix.services 80
nc -zv proxy-camera.teknix.services 443
nc -zv proxy-camera.teknix.services 8554
```

#### C. Create Systemd Service (Linux Server)
```bash
sudo nano /etc/systemd/system/mediamtx.service
```

Content:
```ini
[Unit]
Description=MediaMTX RTSP/HLS Proxy
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mediamtx
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mediamtx
sudo systemctl start mediamtx
sudo systemctl status mediamtx

# View logs
sudo journalctl -u mediamtx -f
```

#### D. Configure Reverse Proxy (Nginx or Caddy)

MediaMTX chạy trên port 8888 (HTTP), nhưng serve qua HTTPS domain `https://proxy-camera.teknix.services/`

**Option 1: Using Caddy (Recommended)**

```bash
# Install Caddy if not already installed
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Edit Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Add this configuration:
```caddy
proxy-camera.teknix.services {
    # Reverse proxy HLS to MediaMTX port 8888
    reverse_proxy localhost:8888 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # CORS headers for HLS
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, OPTIONS"
        Access-Control-Allow-Headers "Range"
    }
}
```

Restart Caddy:
```bash
sudo systemctl restart caddy
sudo systemctl status caddy
```

**Option 2: Using Nginx**

```bash
sudo nano /etc/nginx/sites-available/mediamtx
```

Add this configuration:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name proxy-camera.teknix.services;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name proxy-camera.teknix.services;
    
    # SSL certificate (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/proxy-camera.teknix.services/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/proxy-camera.teknix.services/privkey.pem;
    
    # Reverse proxy to MediaMTX HLS
    location / {
        proxy_pass http://localhost:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Range" always;
        
        # HLS specific
        proxy_http_version 1.1;
        proxy_buffering off;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/mediamtx /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 2. Camera API Deployment (camera-api.teknix.services)

#### A. Update Environment Variables in Coolify

Go to your Camera API project in Coolify → Environment Variables:

```env
# Production MediaMTX Configuration
# MediaMTX runs on port 8888 internally, reverse proxy handles HTTPS
MEDIAMTX_HOST=proxy-camera.teknix.services
MEDIAMTX_API_URL=http://localhost:9997
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=443
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=true

# Other required variables (already set)
PORT=3000
HOST=0.0.0.0
JWT_SECRET=your_production_secret_here
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2
```

#### B. Deploy Camera API
```bash
# In Coolify, click "Deploy" button
# Or via Git push:
git add .
git commit -m "Update MediaMTX config for production"
git push origin main
```

### 3. Test Production Setup

#### A. Test MediaMTX API
```bash
# From Camera API server
curl http://localhost:9997/v3/paths/list

# Response should show registered cameras
```

#### B. Test Stream URLs

**RTSP Stream:**
```
rtsp://proxy-camera.teknix.services:8554/camera_49e77c80
```

**HLS Web Player:**
```
https://proxy-camera.teknix.services/camera_49e77c80/
```

**HLS Manifest:**
```
https://proxy-camera.teknix.services/camera_49e77c80/index.m3u8
```

**API Endpoint (from Camera API):**
```bash
curl https://camera-api.teknix.services/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy
```

Expected response:
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "protocols": {
    "rtsp": "rtsp://proxy-camera.teknix.services:8554/camera_49e77c80",
    "hls": "https://proxy-camera.teknix.services/camera_49e77c80/index.m3u8",
    "hlsWebPlayer": "https://proxy-camera.teknix.services/camera_49e77c80/",
    "webrtc": "https://proxy-camera.teknix.services:8889/camera_49e77c80/whep"
  },
  "registered": true,
  "pathName": "camera_49e77c80"
}
```

### 4. Network Architecture

```
Client Browser
    ↓ HTTPS
    ↓
Camera API (camera-api.teknix.services:443)
    ↓ HTTP (Internal)
    ↓
MediaMTX API (localhost:9997) ← Camera registration
    
Client Browser (HLS Stream)
    ↓ HTTPS
    ↓
Reverse Proxy (Caddy/Nginx on proxy-camera.teknix.services:443)
    ↓ HTTP (Internal)
    ↓
MediaMTX HLS Server (localhost:8888)
    ↓ RTSP (Internal)
    ↓
Dahua Camera (192.168.1.66:554)

Direct RTSP Client (e.g., VLC)
    ↓ TCP 8554
    ↓
MediaMTX RTSP Server (proxy-camera.teknix.services:8554)
    ↓ RTSP (Internal)
    ↓
Dahua Camera (192.168.1.66:554)
```

**Key Points:**
- **Port 8888**: MediaMTX HLS internal (not exposed)
- **Port 443**: Reverse proxy → MediaMTX HLS (HTTPS)
- **Port 8554**: MediaMTX RTSP direct access
- **Port 9997**: MediaMTX API (localhost only)

### 5. Configuration Summary

#### MediaMTX Production Config (mediamtx.yml)
✅ **API**: Enabled on `127.0.0.1:9997` (localhost only, accessed by Camera API)
✅ **RTSP**: Enabled on `:8554` with TCP only
✅ **HLS**: Enabled on `:8888` (internal) with `hlsAlwaysRemux: yes`, Low-Latency variant
✅ **WebRTC**: Enabled on `:8889`
✅ **Read Timeout**: Increased to `20s` for stability
✅ **RTSP Transport**: Force TCP for all camera sources
✅ **CORS**: `hlsAllowOrigin: '*'` for web player access
✅ **Reverse Proxy**: Caddy/Nginx proxies `:8888` → `https://proxy-camera.teknix.services:443`

#### Camera API Environment
✅ **MEDIAMTX_HOST**: `proxy-camera.teknix.services`
✅ **MEDIAMTX_HLS_PORT**: `443` (tells API to generate HTTPS URLs without port)
✅ **MEDIAMTX_USE_HTTPS**: `true` (generate https:// URLs)
✅ **Auto-registration**: Working for all cameras
✅ **Generated URLs**: `https://proxy-camera.teknix.services/camera_xxx/index.m3u8` (no port number)

### 6. Security Notes

1. **MediaMTX API** (port 9997): Only accessible from localhost - Camera API connects internally
2. **Firewall**: Only ports 8554, 8888, 8889 are open to public
3. **Camera IPs**: Hidden behind MediaMTX proxy - clients never see 192.168.1.66
4. **HTTPS**: Camera API uses HTTPS via Coolify/Caddy reverse proxy

### 7. Troubleshooting

#### Check MediaMTX Status
```bash
sudo systemctl status mediamtx
sudo journalctl -u mediamtx -n 50
```

#### Check Firewall
```bash
sudo ufw status numbered
sudo iptables -L -n | grep 8888
```

#### Test Camera Registration
```bash
curl http://localhost:9997/v3/paths/list | jq
```

#### View MediaMTX Logs
```bash
# Real-time logs
sudo journalctl -u mediamtx -f

# Last 100 lines
sudo journalctl -u mediamtx -n 100
```

### 8. Rollback Plan

If deployment fails:

1. **Stop MediaMTX**: `sudo systemctl stop mediamtx`
2. **Revert Camera API env**: Change `MEDIAMTX_HOST` back to localhost
3. **Redeploy Camera API** in Coolify
4. **Check logs** for errors

### 9. Success Criteria

✅ MediaMTX running on proxy-camera.teknix.services
✅ Camera API can register cameras via API
✅ HLS web player works at `https://proxy-camera.teknix.services:8888/camera_xxx/`
✅ No camera IP (192.168.1.66) exposed to clients
✅ Stream plays without DTS errors
✅ Auto-registration working for all cameras

---

## Quick Start Commands

### On Production Server (proxy-camera.teknix.services)
```bash
# Start MediaMTX
sudo systemctl start mediamtx
sudo systemctl status mediamtx

# View logs
sudo journalctl -u mediamtx -f
```

### On Local Development
```bash
# Test production API
curl https://camera-api.teknix.services/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy

# Test HLS stream
open https://proxy-camera.teknix.services:8888/camera_49e77c80/
```

---

**Date**: October 22, 2025  
**MediaMTX Version**: v1.9.2  
**Camera API Version**: Latest (deployed via Coolify)

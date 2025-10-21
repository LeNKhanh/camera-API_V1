# 🚀 Coolify Production Deployment - MediaMTX Proxy

## Complete guide để deploy Camera API + MediaMTX Proxy lên production với Coolify

---

## 📋 Overview

Setup này sẽ deploy **2 services** trên Coolify:

1. **Camera API** (NestJS) - Port 3000
2. **MediaMTX Proxy** (RTSP Proxy) - Ports 8554, 8888, 8889

---

## 🎯 Architecture

```
Internet
    ↓
[Coolify Server - Ubuntu]
    ↓
├─ Camera API (Port 3000)
│  └─ Domain: api.iotek.tn
│  └─ Environment: Production
│
├─ MediaMTX Proxy (Ports 8554, 8888, 8889)
│  └─ Domain: stream.iotek.tn
│  └─ Proxy camera streams
│
└─ PostgreSQL Database
   └─ Internal network
```

---

## 📦 Part 1: Deploy Camera API (Already Done)

### Current Setup:
- ✅ Domain: `api.iotek.tn`
- ✅ Repository: Connected to GitHub
- ✅ Database: PostgreSQL
- ✅ R2 Storage: Cloudflare R2 configured

### Add New Environment Variables:

Go to **Coolify → Your Camera API Project → Environment Variables**

Add these new variables:

```bash
# MediaMTX Proxy Configuration
MEDIAMTX_HOST=stream.iotek.tn
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=80
MEDIAMTX_WEBRTC_PORT=80
MEDIAMTX_USE_HTTPS=true

# Note: HLS and WebRTC use port 80 because they go through Nginx reverse proxy
```

**Screenshot Guide:**
```
1. Coolify Dashboard
2. Select "Camera API" project
3. Click "Environment Variables" tab
4. Click "+ Add Variable"
5. Add each variable above
6. Click "Save"
7. Click "Restart" to apply changes
```

---

## 📦 Part 2: Deploy MediaMTX Proxy

### Option A: Deploy as Docker Service (Recommended)

#### Step 1: Create Dockerfile for MediaMTX

Create file: `mediamtx/Dockerfile`

```dockerfile
FROM alpine:3.18

# Install dependencies
RUN apk add --no-cache ca-certificates

# Download MediaMTX
ADD https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_linux_amd64.tar.gz /tmp/mediamtx.tar.gz

# Extract and setup
RUN tar -xzf /tmp/mediamtx.tar.gz -C /usr/local/bin/ && \
    rm /tmp/mediamtx.tar.gz && \
    chmod +x /usr/local/bin/mediamtx

# Create config directory
RUN mkdir -p /config

# Copy config file
COPY mediamtx.yml /config/mediamtx.yml

# Expose ports
EXPOSE 8554 8888 8889 9997

# Run MediaMTX
WORKDIR /config
CMD ["mediamtx", "/config/mediamtx.yml"]
```

#### Step 2: Update mediamtx.yml for Production

Edit `mediamtx/mediamtx.yml`:

```yaml
# Production Configuration
api: yes
apiAddress: 0.0.0.0:9997

rtspAddress: :8554
rtsp: yes

hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsAllowOrigin: "*"

webrtc: yes
webrtcAddress: :8889

logLevel: info
logDestinations: [stdout]

# Authentication (enable in production)
# authMethod: internal

# Paths will be configured via API or manually
paths: {}
```

#### Step 3: Create docker-compose.yml

Create file: `mediamtx/docker-compose.yml`

```yaml
version: '3.8'

services:
  mediamtx:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mediamtx-proxy
    restart: unless-stopped
    ports:
      - "8554:8554"  # RTSP
      - "8888:8888"  # HLS
      - "8889:8889"  # WebRTC
      - "9997:9997"  # API
    volumes:
      - ./mediamtx.yml:/config/mediamtx.yml:ro
      - mediamtx-recordings:/recordings
    environment:
      - TZ=Asia/Ho_Chi_Minh
    networks:
      - camera-network

volumes:
  mediamtx-recordings:

networks:
  camera-network:
    driver: bridge
```

#### Step 4: Deploy to Coolify

**Option 1: Via Git Repository**

1. Commit MediaMTX files to your repo:
```bash
git add mediamtx/
git commit -m "Add MediaMTX proxy server"
git push origin main
```

2. In Coolify:
   - Click "+ New Resource"
   - Select "Docker Compose"
   - Choose your repository
   - Set path: `mediamtx/docker-compose.yml`
   - Set domain: `stream.iotek.tn`
   - Deploy!

**Option 2: Direct Docker Service**

1. In Coolify:
   - Click "+ New Resource"
   - Select "Docker Service"
   - Image: `bluenviron/mediamtx:latest`
   - Ports: 
     - 8554:8554 (RTSP)
     - 8888:8888 (HLS)
     - 8889:8889 (WebRTC)
   - Volumes:
     - Mount your `mediamtx.yml` config
   - Deploy!

---

### Option B: Deploy as System Service (Manual Setup)

If you have SSH access to your Coolify server:

#### Step 1: SSH to Server

```bash
ssh root@your-coolify-server-ip
```

#### Step 2: Download MediaMTX

```bash
cd /opt
mkdir mediamtx
cd mediamtx

# Download
wget https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_linux_amd64.tar.gz

# Extract
tar -xzf mediamtx_v1.5.0_linux_amd64.tar.gz
rm mediamtx_v1.5.0_linux_amd64.tar.gz

# Make executable
chmod +x mediamtx
```

#### Step 3: Create Config

```bash
nano /opt/mediamtx/mediamtx.yml
```

Paste production config (same as above).

#### Step 4: Create Systemd Service

```bash
nano /etc/systemd/system/mediamtx.service
```

```ini
[Unit]
Description=MediaMTX RTSP Proxy Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mediamtx
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### Step 5: Start Service

```bash
# Enable and start
systemctl daemon-reload
systemctl enable mediamtx
systemctl start mediamtx

# Check status
systemctl status mediamtx

# View logs
journalctl -u mediamtx -f
```

---

## 🌐 Part 3: Configure DNS and Domains

### Step 1: Add DNS Records

In your DNS provider (Cloudflare, etc):

```dns
Type    Name            Content                 Proxy   TTL
----    ----            -------                 -----   ---
A       stream          45.77.xxx.xxx           No      Auto
AAAA    stream          2001:19f0:xxxx          No      Auto
```

Replace IP with your Coolify server IP.

⚠️ **Important:** Disable Cloudflare proxy for `stream` subdomain because RTSP uses non-HTTP protocol!

### Step 2: Configure Coolify Domain

1. Go to Coolify Dashboard
2. Find MediaMTX service
3. Click "Domains"
4. Add: `stream.iotek.tn`
5. Enable SSL certificate
6. Save

---

## 🔧 Part 4: Configure Nginx Reverse Proxy

MediaMTX needs special Nginx config for HLS and WebRTC over HTTPS.

### Step 1: SSH to Coolify Server

```bash
ssh root@your-coolify-server-ip
```

### Step 2: Create Nginx Config

```bash
nano /etc/nginx/sites-available/stream.iotek.tn
```

```nginx
# MediaMTX Proxy - HLS and WebRTC
server {
    listen 80;
    server_name stream.iotek.tn;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stream.iotek.tn;
    
    # SSL certificates (Let's Encrypt via Coolify)
    ssl_certificate /etc/letsencrypt/live/stream.iotek.tn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stream.iotek.tn/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # HLS streams
    location /hls/ {
        proxy_pass http://localhost:8888/;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Range" always;
        
        # Caching
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        
        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Buffering
        proxy_buffering off;
        proxy_cache off;
    }
    
    # WebRTC streams
    location /webrtc/ {
        proxy_pass http://localhost:8889/;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Health check
    location /health {
        return 200 "MediaMTX Proxy OK\n";
        add_header Content-Type text/plain;
    }
}
```

### Step 3: Enable and Test

```bash
# Create symlink
ln -s /etc/nginx/sites-available/stream.iotek.tn /etc/nginx/sites-enabled/

# Test config
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## ⚙️ Part 5: Configure Cameras in MediaMTX

### Option A: Edit Config File (Static)

```bash
nano /opt/mediamtx/mediamtx.yml
```

Add cameras under `paths:`:

```yaml
paths:
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
    sourceProtocol: rtsp
    sourceOnDemand: yes
    publishUser: ""
    publishPass: ""
  
  camera_abcd1234:
    source: rtsp://admin:pass@192.168.1.67:554/stream1
    sourceProtocol: rtsp
    sourceOnDemand: yes
    publishUser: ""
    publishPass: ""
```

Restart MediaMTX:
```bash
systemctl restart mediamtx
```

### Option B: Add via API (Dynamic)

```bash
# Add camera dynamically
curl -X POST http://localhost:9997/v3/config/paths/add/camera_49e77c80 \
  -H "Content-Type: application/json" \
  -d '{
    "source": "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
    "sourceProtocol": "rtsp",
    "sourceOnDemand": true
  }'
```

---

## 🧪 Part 6: Testing

### Test 1: Check MediaMTX Status

```bash
# Check service
systemctl status mediamtx

# Check logs
journalctl -u mediamtx -f

# Check ports
netstat -tulpn | grep -E '8554|8888|8889|9997'
```

Expected output:
```
tcp        0      0 0.0.0.0:8554            0.0.0.0:*               LISTEN      12345/mediamtx
tcp        0      0 0.0.0.0:8888            0.0.0.0:*               LISTEN      12345/mediamtx
tcp        0      0 0.0.0.0:8889            0.0.0.0:*               LISTEN      12345/mediamtx
tcp        0      0 0.0.0.0:9997            0.0.0.0:*               LISTEN      12345/mediamtx
```

### Test 2: Test RTSP Stream

```bash
# From local machine (replace with your domain)
vlc rtsp://stream.iotek.tn:8554/camera_49e77c80
```

### Test 3: Test HLS Stream

```bash
# Test HLS URL
curl -I https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8

# Should return 200 OK
```

Open in browser:
```
https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8
```

### Test 4: Test API Endpoint

```bash
# Login to Camera API
curl -X POST https://api.iotek.tn/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get proxy URL (replace with your token)
curl -X GET https://api.iotek.tn/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "pathId": "camera_49e77c80",
  "protocols": {
    "rtsp": "rtsp://stream.iotek.tn:8554/camera_49e77c80",
    "hls": "https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8",
    "webrtc": "https://stream.iotek.tn/webrtc/camera_49e77c80/whep"
  },
  "security": {
    "cameraIpHidden": true,
    "credentialsProtected": true
  }
}
```

---

## 📊 Part 7: Environment Variables Summary

### Camera API (.env or Coolify Environment Variables)

```bash
# Database (already configured)
DATABASE_URL=postgresql://user:pass@host:5432/Camera_api

# JWT (already configured)
JWT_SECRET=your-secret-key

# R2 Storage (already configured)
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net

# ✨ NEW: MediaMTX Proxy Configuration
MEDIAMTX_HOST=stream.iotek.tn
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=80
MEDIAMTX_WEBRTC_PORT=80
MEDIAMTX_USE_HTTPS=true
```

### Coolify Environment Variables Setup

```
1. Coolify Dashboard
2. Camera API Project
3. Environment Variables tab
4. Add each variable:
   - Name: MEDIAMTX_HOST
   - Value: stream.iotek.tn
   - Click "Add"
5. Repeat for all variables
6. Click "Save"
7. Click "Restart" to apply
```

---

## 🔒 Part 8: Security Hardening (Optional)

### Enable Authentication in MediaMTX

Edit `mediamtx.yml`:

```yaml
# Enable basic authentication
authMethod: internal

# Set default credentials
paths:
  camera_49e77c80:
    source: rtsp://...
    sourceOnDemand: yes
    # Add authentication
    readUser: viewer
    readPass: YOUR_SECURE_PASSWORD_HERE
    publishUser: ""
    publishPass: ""
```

Then update API response to include credentials:

```typescript
// stream.service.ts - getProxyUrl()
const rtspUrl = process.env.MEDIAMTX_AUTH_ENABLED === 'true'
  ? `rtsp://viewer:${process.env.MEDIAMTX_PASSWORD}@${mediamtxHost}:${rtspPort}/camera_${pathId}`
  : `rtsp://${mediamtxHost}:${rtspPort}/camera_${pathId}`;
```

Add to Coolify environment:
```bash
MEDIAMTX_AUTH_ENABLED=true
MEDIAMTX_USERNAME=viewer
MEDIAMTX_PASSWORD=your_secure_password
```

---

## 📱 Part 9: Frontend Integration

### React Example

```tsx
import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

export const CameraPlayer = ({ cameraId, token }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const fetchAndPlay = async () => {
      // Get proxy URL from API
      const response = await fetch(
        `https://api.iotek.tn/streams/${cameraId}/proxy`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const data = await response.json();
      const hlsUrl = data.protocols.hls;
      
      // Play HLS stream
      if (Hls.isSupported() && videoRef.current) {
        const hls = new Hls();
        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play();
        });
      }
    };
    
    fetchAndPlay();
  }, [cameraId, token]);
  
  return (
    <div>
      <h3>Camera: {cameraId}</h3>
      <video ref={videoRef} controls width="100%" />
      <p>Streaming from: stream.iotek.tn (IP hidden)</p>
    </div>
  );
};
```

---

## ✅ Verification Checklist

- [ ] Camera API deployed on Coolify
- [ ] MediaMTX service deployed and running
- [ ] DNS records configured for `stream.iotek.tn`
- [ ] Nginx reverse proxy configured
- [ ] SSL certificates working
- [ ] Environment variables added to Camera API
- [ ] Camera API restarted with new env vars
- [ ] Test RTSP stream in VLC: `rtsp://stream.iotek.tn:8554/camera_xxx`
- [ ] Test HLS in browser: `https://stream.iotek.tn/hls/camera_xxx/index.m3u8`
- [ ] Test API endpoint: `/streams/:id/proxy` returns proxy URLs
- [ ] Camera IP completely hidden from end users
- [ ] No credentials exposed in proxy URLs

---

## 🐛 Troubleshooting

### Issue 1: MediaMTX not starting

```bash
# Check logs
journalctl -u mediamtx -f

# Check config syntax
/opt/mediamtx/mediamtx --check /opt/mediamtx/mediamtx.yml

# Check ports
netstat -tulpn | grep 8554
```

### Issue 2: VLC cannot connect

```bash
# Test from server
ffmpeg -i rtsp://localhost:8554/camera_49e77c80 -frames:v 1 test.jpg

# Check firewall
ufw status
ufw allow 8554/tcp
```

### Issue 3: HLS not working

```bash
# Check Nginx logs
tail -f /var/log/nginx/error.log

# Test direct connection
curl http://localhost:8888/camera_49e77c80/index.m3u8

# Check CORS headers
curl -I https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8
```

### Issue 4: Camera not accessible from MediaMTX

```bash
# Test from server to camera
ffmpeg -i rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0 -frames:v 1 test.jpg

# Check MediaMTX logs
journalctl -u mediamtx -f | grep camera_49e77c80
```

---

## 🎉 Success!

Your production setup is complete! Users can now:

✅ Access streams via proxy URLs  
✅ Camera IPs are completely hidden  
✅ Watch in VLC: `rtsp://stream.iotek.tn:8554/camera_xxx`  
✅ Watch in browser: `https://stream.iotek.tn/hls/camera_xxx/index.m3u8`  
✅ Ultra-low latency via WebRTC  

**No more exposed camera IPs!** 🔒

---

## 📚 Additional Resources

- MediaMTX Documentation: https://github.com/bluenviron/mediamtx
- Coolify Documentation: https://coolify.io/docs
- HLS.js Player: https://github.com/video-dev/hls.js/

---

**Need help?** Check the logs and troubleshooting section above! 🚀

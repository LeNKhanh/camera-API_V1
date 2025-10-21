# 🚀 Quick Implementation: MediaMTX Proxy

## Giải pháp nhanh nhất để che giấu IP camera

---

## 📦 Bước 1: Download MediaMTX

### Windows:
```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_windows_amd64.zip" -OutFile "mediamtx.zip"

# Extract
Expand-Archive mediamtx.zip -DestinationPath .\mediamtx

cd mediamtx
```

### Linux:
```bash
# Download
wget https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_linux_amd64.tar.gz

# Extract
tar -xzf mediamtx_v1.5.0_linux_amd64.tar.gz

cd mediamtx
```

---

## ⚙️ Bước 2: Create Config

Create file `mediamtx.yml`:

```yaml
# MediaMTX Configuration for Camera API

# API Server (for dynamic camera management)
api: yes
apiAddress: 127.0.0.1:9997

# RTSP Server
rtspAddress: :8554
rtsp: yes

# HLS Server (for browser playback)
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency

# WebRTC (optional, for very low latency)
webrtc: yes
webrtcAddress: :8889

# Authentication (comment out for testing)
# authMethod: internal

# Log level
logLevel: info

# Paths - Define cameras here
paths:
  # Example: Camera with ID 49e77c80-af6e-4ac6-b0ea-b4f018dacac7
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
    sourceProtocol: rtsp
    sourceOnDemand: yes  # Only connect when someone watches
    
    # Optional: Authentication for this path
    # readUser: viewer
    # readPass: viewer123
    
    # Disable publishing (read-only)
    publishUser: ""
    publishPass: ""
  
  # Add more cameras as needed
  # camera_xxx:
  #   source: rtsp://username:password@ip:port/path
  #   sourceProtocol: rtsp
  #   sourceOnDemand: yes
```

---

## 🎬 Bước 3: Start MediaMTX

### Windows:
```powershell
.\mediamtx.exe mediamtx.yml
```

### Linux:
```bash
./mediamtx mediamtx.yml
```

**Expected output:**
```
2025/10/20 14:30:00 INF MediaMTX v1.5.0
2025/10/20 14:30:00 INF [RTSP] listener opened on :8554 (TCP), :8000 (UDP/RTP), :8001 (UDP/RTCP)
2025/10/20 14:30:00 INF [HLS] listener opened on :8888
2025/10/20 14:30:00 INF [WebRTC] listener opened on :8889
2025/10/20 14:30:00 INF [API] listener opened on 127.0.0.1:9997
```

✅ MediaMTX is running!

---

## 🧪 Bước 4: Test Playback

### Test với VLC:
```bash
# Open VLC and play:
rtsp://localhost:8554/camera_49e77c80
```

### Test với Browser (HLS):
```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Camera Test</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
    <h1>Camera Stream Test</h1>
    <video id="video" controls width="640" height="480"></video>
    
    <script>
        const video = document.getElementById('video');
        const hlsUrl = 'http://localhost:8888/camera_49e77c80/index.m3u8';
        
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play();
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', function() {
                video.play();
            });
        }
    </script>
</body>
</html>
```

Save as `test.html` và mở trong browser!

---

## 🔌 Bước 5: Update API

### Add New Endpoint

**File: `src/modules/stream/stream.controller.ts`**

```typescript
// Add new endpoint for proxy URL
@Get(':cameraId/proxy')
@Roles('ADMIN', 'OPERATOR', 'VIEWER')
getProxyUrl(@Param('cameraId') cameraId: string) {
  return this.svc.getProxyUrl(cameraId);
}
```

**File: `src/modules/stream/stream.service.ts`**

```typescript
// Add new method
async getProxyUrl(cameraId: string) {
  if (!cameraId) throw new NotFoundException('cameraId required');
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');

  // MediaMTX proxy URLs
  const mediamtxHost = process.env.MEDIAMTX_HOST || 'localhost';
  const rtspPort = process.env.MEDIAMTX_RTSP_PORT || '8554';
  const hlsPort = process.env.MEDIAMTX_HLS_PORT || '8888';
  const webrtcPort = process.env.MEDIAMTX_WEBRTC_PORT || '8889';
  
  // Use shortened camera ID for path (first 8 chars)
  const pathId = cameraId.substring(0, 8);

  return {
    cameraId: cam.id,
    cameraName: cam.name,
    protocols: {
      rtsp: `rtsp://${mediamtxHost}:${rtspPort}/camera_${pathId}`,
      hls: `http://${mediamtxHost}:${hlsPort}/camera_${pathId}/index.m3u8`,
      webrtc: `http://${mediamtxHost}:${webrtcPort}/camera_${pathId}/whep`,
    },
    instructions: {
      vlc: [
        '1. Open VLC Media Player',
        '2. Go to: Media → Open Network Stream (Ctrl+N)',
        '3. Paste RTSP Proxy URL below',
        '4. Click Play',
      ],
      browser: [
        '1. Use HLS URL in HTML5 video player',
        '2. Requires HLS.js library for non-Safari browsers',
        '3. Low latency streaming',
      ],
    },
    note: 'Camera IP is hidden behind proxy. No direct access to camera.',
    security: {
      cameraIpHidden: true,
      credentialsProtected: true,
      proxyAuthentication: false, // Set to true if you enable auth in MediaMTX
    },
  };
}
```

### Add Environment Variables

**File: `.env`**

```bash
# MediaMTX Proxy Configuration
MEDIAMTX_HOST=localhost
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889

# Production: use public domain
# MEDIAMTX_HOST=stream.your-domain.com
```

---

## 🧪 Bước 6: Test API

### 1. Start API Server:
```bash
npm run start:dev
```

### 2. Test Proxy Endpoint:
```bash
# Login
POST http://localhost:3000/auth/login
{
  "username": "admin",
  "password": "admin123"
}

# Get Proxy URL
GET http://localhost:3000/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "protocols": {
    "rtsp": "rtsp://localhost:8554/camera_49e77c80",
    "hls": "http://localhost:8888/camera_49e77c80/index.m3u8",
    "webrtc": "http://localhost:8889/camera_49e77c80/whep"
  },
  "instructions": {
    "vlc": [...],
    "browser": [...]
  },
  "note": "Camera IP is hidden behind proxy. No direct access to camera.",
  "security": {
    "cameraIpHidden": true,
    "credentialsProtected": true
  }
}
```

### 3. Test VLC:
```bash
vlc rtsp://localhost:8554/camera_49e77c80
```

✅ **No camera IP exposed!**

---

## 🎯 Bước 7: Add Multiple Cameras

### Option A: Edit Config File

```yaml
# mediamtx.yml
paths:
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
    sourceOnDemand: yes
  
  camera_abcd1234:
    source: rtsp://admin:pass@192.168.1.67:554/stream1
    sourceOnDemand: yes
  
  # Add more...
```

### Option B: Dynamic via API

```typescript
// stream.service.ts
async registerCameraProxy(cameraId: string) {
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');

  // Build RTSP URL
  const rtspUrl = cam.rtspUrl || this.buildRtspUrl(cam);
  
  // Add to MediaMTX via API
  const pathId = cameraId.substring(0, 8);
  const response = await axios.post(
    `http://localhost:9997/v3/config/paths/add/camera_${pathId}`,
    {
      source: rtspUrl,
      sourceProtocol: 'rtsp',
      sourceOnDemand: true,
    }
  );

  return {
    registered: true,
    pathId: `camera_${pathId}`,
    proxyUrl: `rtsp://localhost:8554/camera_${pathId}`,
  };
}
```

---

## 🚀 Production Deployment

### 1. Update Config for Production

```yaml
# mediamtx.yml (production)
api: yes
apiAddress: 0.0.0.0:9997  # Allow external API access

rtspAddress: :8554
rtsp: yes

hls: yes
hlsAddress: :8888

# Enable authentication
authMethod: internal

# Default credentials (will be overridden per path)
readUser: viewer
readPass: YOUR_SECURE_PASSWORD

paths:
  camera_49e77c80:
    source: rtsp://...
    sourceOnDemand: yes
    readUser: viewer
    readPass: camera1_secure_pass
```

### 2. Setup as Service (Linux)

```bash
# Create systemd service
sudo nano /etc/systemd/system/mediamtx.service
```

```ini
[Unit]
Description=MediaMTX RTSP Proxy
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mediamtx
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable mediamtx
sudo systemctl start mediamtx
sudo systemctl status mediamtx
```

### 3. Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/stream
server {
    listen 80;
    server_name stream.your-domain.com;

    # HLS
    location /hls/ {
        proxy_pass http://localhost:8888/;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control no-cache;
    }

    # WebRTC
    location /webrtc/ {
        proxy_pass http://localhost:8889/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4. Update .env (Production)

```bash
MEDIAMTX_HOST=stream.your-domain.com
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=80  # Via Nginx
MEDIAMTX_WEBRTC_PORT=80  # Via Nginx
```

---

## ✅ Verification Checklist

- [ ] MediaMTX running and accessible
- [ ] Can play RTSP stream in VLC via proxy
- [ ] Can play HLS stream in browser
- [ ] API `/streams/:id/proxy` endpoint working
- [ ] Camera IP NOT visible in proxy URLs
- [ ] Multiple cameras working
- [ ] Production deployment (if applicable)

---

## 🐛 Troubleshooting

### MediaMTX not starting:
```bash
# Check if ports already in use
netstat -an | grep 8554
netstat -an | grep 8888

# Kill process if needed
kill -9 $(lsof -ti:8554)
```

### VLC cannot connect:
```bash
# Check MediaMTX logs
tail -f /var/log/mediamtx.log

# Test camera connection directly
ffmpeg -i rtsp://camera-ip:554/... -frames:v 1 test.jpg
```

### Browser HLS not playing:
- Check CORS headers in Nginx
- Verify HLS.js loaded correctly
- Check browser console for errors
- Test HLS URL directly: `http://localhost:8888/camera_xxx/index.m3u8`

---

## 📚 Next Steps

1. ✅ Test locally with 1 camera
2. ✅ Add all cameras to config
3. ✅ Test API endpoint
4. ✅ Deploy to production
5. 📋 Update frontend to use proxy URLs
6. 📋 Add authentication if needed
7. 📋 Monitor performance

---

**Time to complete:** ~30 minutes  
**Difficulty:** ⭐⭐ Easy  
**Result:** 🔒 Camera IPs completely hidden!

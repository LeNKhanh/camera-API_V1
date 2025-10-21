# 🔒 Giải Pháp Che Giấu IP Camera - RTSP Proxy

## ⚠️ Vấn Đề Hiện Tại

**RTSP URL trực tiếp:**
```
rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
```

**Các rủi ro:**
- ❌ Expose IP camera ra public
- ❌ Expose username/password trong URL
- ❌ Không có authentication/authorization
- ❌ Client có thể kết nối trực tiếp bypass API
- ❌ Không track được usage
- ❌ Không rate limit được

---

## 💡 Giải Pháp Được Đề Xuất

### 🏆 **Giải Pháp 1: RTSP Proxy với MediaMTX (Recommended)**

**MediaMTX** (trước đây là rtsp-simple-server) - Open source, nhẹ, dễ setup.

#### Architecture:
```
Client (VLC/Browser)
    ↓
MediaMTX Proxy (rtsp://your-domain.com:8554/camera/{id})
    ↓ (internal network)
Camera RTSP (rtsp://192.168.1.66:554/...)
```

#### Setup Steps:

**1. Download MediaMTX:**
```bash
# Windows
https://github.com/bluenviron/mediamtx/releases
# Download mediamtx_v1.x.x_windows_amd64.zip

# Linux
wget https://github.com/bluenviron/mediamtx/releases/download/v1.x.x/mediamtx_v1.x.x_linux_amd64.tar.gz
tar -xzf mediamtx_v1.x.x_linux_amd64.tar.gz
```

**2. Create Config: `mediamtx.yml`**
```yaml
# MediaMTX Configuration

# API Server (for management)
api: yes
apiAddress: 127.0.0.1:9997

# RTSP Server
rtspAddress: :8554
rtsp: yes

# WebRTC (for browser streaming)
webrtc: yes
webrtcAddress: :8889

# HLS (for browser streaming)
hls: yes
hlsAddress: :8888

# Authentication
authMethod: internal

# Paths (cameras)
paths:
  # Camera 1
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
    sourceProtocol: rtsp
    sourceOnDemand: yes
    
    # Authentication for this camera
    readUser: viewer
    readPass: viewer123
    
    # Publishing disabled (read-only)
    publishUser: ""
    publishPass: ""

  # Add more cameras...
  # camera_{id}:
  #   source: rtsp://...
```

**3. Start MediaMTX:**
```bash
# Windows
.\mediamtx.exe mediamtx.yml

# Linux
./mediamtx mediamtx.yml
```

**4. Update API Endpoint:**

New endpoint: `GET /streams/:cameraId/proxy-url`

```typescript
// stream.service.ts
async getProxyUrl(cameraId: string) {
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');

  // MediaMTX proxy URL (không còn IP camera!)
  const proxyUrl = `rtsp://viewer:viewer123@your-domain.com:8554/camera_${cameraId.substring(0, 8)}`;
  
  return {
    cameraId: cam.id,
    cameraName: cam.name,
    proxyUrl,
    protocols: {
      rtsp: proxyUrl,
      webrtc: `http://your-domain.com:8889/camera_${cameraId.substring(0, 8)}/whep`,
      hls: `http://your-domain.com:8888/camera_${cameraId.substring(0, 8)}/index.m3u8`
    },
    note: 'Use proxy URL instead of direct camera URL'
  };
}
```

**5. Client Usage:**
```bash
# VLC
vlc rtsp://viewer:viewer123@your-domain.com:8554/camera_49e77c80

# Browser (HLS)
<video src="http://your-domain.com:8888/camera_49e77c80/index.m3u8" />
```

#### ✅ Pros:
- ✅ Che giấu IP camera hoàn toàn
- ✅ Centralized authentication
- ✅ Support multiple protocols (RTSP, WebRTC, HLS)
- ✅ Low latency
- ✅ Easy to setup
- ✅ Free and open source
- ✅ Production ready

#### ⚠️ Cons:
- Cần server riêng chạy MediaMTX
- Phải maintain thêm service

#### 💰 Cost:
- **Free** (open source)
- Server cost: ~$5-20/month (VPS)

---

### 🥈 **Giải Pháp 2: Token-Based Stream URL**

Generate temporary stream token thay vì expose full URL.

#### Architecture:
```
1. Client request stream token
2. API generate JWT token với camera info
3. Client connect: rtsp://token@proxy-server:8554/stream
4. Proxy verify token → connect to camera
```

#### Implementation:

**1. Generate Stream Token:**
```typescript
// stream.service.ts
async generateStreamToken(cameraId: string, userId: string): Promise<string> {
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');

  // JWT token with camera info
  const payload = {
    cameraId: cam.id,
    cameraIp: cam.ipAddress,
    rtspPort: cam.rtspPort,
    username: cam.username,
    password: cam.password,
    channel: cam.channel,
    userId,
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
  };

  return jwt.sign(payload, process.env.STREAM_SECRET);
}

// New endpoint
async getStreamUrl(cameraId: string, userId: string) {
  const token = await this.generateStreamToken(cameraId, userId);
  
  return {
    cameraId,
    streamUrl: `rtsp://${token}@proxy.your-domain.com:8554/stream`,
    expiresIn: '1 hour',
    protocols: {
      rtsp: `rtsp://${token}@proxy.your-domain.com:8554/stream`,
      hls: `https://proxy.your-domain.com/hls/${token}/index.m3u8`
    }
  };
}
```

**2. Proxy Server Verify Token:**
```javascript
// proxy-server.js (Node.js)
const rtsp = require('rtsp-server');
const jwt = require('jsonwebtoken');

const server = rtsp.createServer((req, res) => {
  const token = req.url.split('/')[1]; // Extract token from URL
  
  try {
    // Verify token
    const payload = jwt.verify(token, process.env.STREAM_SECRET);
    
    // Build actual camera RTSP URL
    const cameraUrl = `rtsp://${payload.username}:${payload.password}@${payload.cameraIp}:${payload.rtspPort}/cam/realmonitor?channel=${payload.channel}&subtype=0`;
    
    // Proxy to camera
    proxyStream(cameraUrl, res);
    
  } catch (err) {
    res.statusCode = 401;
    res.end('Invalid or expired token');
  }
});

server.listen(8554);
```

#### ✅ Pros:
- ✅ Không expose IP camera
- ✅ Token expiry tự động
- ✅ Track usage per user
- ✅ Có thể revoke token

#### ⚠️ Cons:
- Phải develop custom proxy server
- Phức tạp hơn MediaMTX

---

### 🥉 **Giải Pháp 3: WebRTC Streaming (Browser-friendly)**

Stream qua WebRTC thay vì RTSP → không expose IP.

#### Stack:
- **MediaMTX** hoặc **Janus Gateway**
- WebRTC support
- Browser playback không cần VLC

#### Setup với MediaMTX:
```yaml
# mediamtx.yml
webrtc: yes
webrtcAddress: :8889

paths:
  camera_49e77c80:
    source: rtsp://...
    runOnReady: ffmpeg -i rtsp://... -c copy -f rtsp rtsp://localhost:8554/$MTX_PATH
```

#### Client Code (Browser):
```javascript
// Frontend
const pc = new RTCPeerConnection();
const stream = await fetch('/api/streams/camera-id/webrtc-offer', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer JWT' }
});

const offer = await stream.json();
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);

// Send answer back to server
await fetch('/api/streams/camera-id/webrtc-answer', {
  method: 'POST',
  body: JSON.stringify(answer)
});

// Play video
document.querySelector('video').srcObject = pc.getReceivers()[0].track;
```

#### ✅ Pros:
- ✅ Browser native (no VLC needed)
- ✅ Low latency
- ✅ Secure (encrypted)
- ✅ Không expose camera IP

#### ⚠️ Cons:
- Complex signaling setup
- Require HTTPS/WSS

---

### 🛡️ **Giải Pháp 4: Nginx RTMP/RTSP Reverse Proxy**

Dùng Nginx làm reverse proxy cho RTSP.

#### Setup:

**1. Install Nginx with RTMP module:**
```bash
# Ubuntu/Debian
sudo apt-get install nginx-full libnginx-mod-rtmp

# Or compile from source with rtsp module
```

**2. Nginx Config:**
```nginx
# nginx.conf
rtmp {
    server {
        listen 1935;
        chunk_size 4096;

        application live {
            live on;
            record off;
            
            # Only accept from localhost (MediaMTX → Nginx)
            allow publish 127.0.0.1;
            deny publish all;
            
            # Authentication
            on_play http://localhost:3000/api/streams/verify-token;
        }
    }
}

http {
    server {
        listen 8080;
        
        location /hls {
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            root /tmp;
            add_header Cache-Control no-cache;
            add_header Access-Control-Allow-Origin *;
        }
    }
}
```

**3. API Verify Endpoint:**
```typescript
// stream.controller.ts
@Post('verify-token')
async verifyStreamToken(@Body() body: any) {
  const token = body.name; // Stream name = token
  
  try {
    const payload = jwt.verify(token, process.env.STREAM_SECRET);
    return { status: 'ok' };
  } catch {
    throw new UnauthorizedException('Invalid token');
  }
}
```

---

## 📊 So Sánh Giải Pháp

| Feature | MediaMTX | Token-Based | WebRTC | Nginx RTMP |
|---------|----------|-------------|--------|------------|
| **Setup** | ⭐⭐⭐⭐⭐ Easy | ⭐⭐⭐ Medium | ⭐⭐ Hard | ⭐⭐⭐⭐ Easy |
| **Hide IP** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **VLC Support** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Browser** | ✅ HLS/WebRTC | ⚠️ HLS only | ✅ Native | ✅ HLS |
| **Latency** | ⭐⭐⭐⭐⭐ Low | ⭐⭐⭐⭐ Low | ⭐⭐⭐⭐⭐ Lowest | ⭐⭐⭐⭐ Low |
| **Auth** | ✅ Built-in | ✅ JWT | ✅ Signaling | ⚠️ Custom |
| **Cost** | Free | Free | Free | Free |
| **Production** | ✅ Ready | ⚠️ DIY | ⚠️ Complex | ✅ Ready |

---

## 🎯 Khuyến Nghị

### Cho Project Của Bạn:

**🏆 Recommendation: MediaMTX + HLS**

**Lý do:**
1. ✅ **Dễ setup** - Download và chạy ngay
2. ✅ **Multiple protocols** - RTSP, WebRTC, HLS
3. ✅ **VLC support** - Cho admin/operator
4. ✅ **Browser support** - Cho viewers
5. ✅ **Production ready** - Stable và well-maintained
6. ✅ **Hide IP** - Camera IP hoàn toàn ẩn
7. ✅ **Free** - Open source

### Implementation Plan:

#### Phase 1: Setup MediaMTX
```bash
# 1. Download MediaMTX
wget https://github.com/bluenviron/mediamtx/releases/latest

# 2. Create config
vi mediamtx.yml

# 3. Start service
./mediamtx mediamtx.yml
```

#### Phase 2: Update API
```typescript
// Add new endpoint: GET /streams/:cameraId/proxy
async getProxyUrl(cameraId: string) {
  // Return MediaMTX URL instead of direct camera URL
}
```

#### Phase 3: Deploy
- Deploy MediaMTX trên cùng server với API
- Hoặc deploy trên VPS riêng
- Setup domain: `stream.your-domain.com`

#### Phase 4: Frontend Integration
```html
<!-- Browser playback với HLS -->
<video controls>
  <source src="https://stream.your-domain.com:8888/camera_xxx/index.m3u8" type="application/x-mpegURL">
</video>
```

---

## 🔧 Quick Start với MediaMTX

### 1. Download và Extract
```bash
# Windows
curl -LO https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_windows_amd64.zip
unzip mediamtx_v1.5.0_windows_amd64.zip

# Linux
curl -LO https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_linux_amd64.tar.gz
tar -xzf mediamtx_v1.5.0_linux_amd64.tar.gz
```

### 2. Create Basic Config
```yaml
# mediamtx.yml
rtspAddress: :8554
rtsp: yes

paths:
  all_others:
```

### 3. Test với 1 Camera
```bash
# Start MediaMTX
./mediamtx

# Add camera dynamically via API
curl -X POST http://localhost:9997/v3/config/paths/add/camera_test \
  -H "Content-Type: application/json" \
  -d '{
    "source": "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
    "sourceProtocol": "rtsp"
  }'

# Test playback
vlc rtsp://localhost:8554/camera_test
```

### 4. Integrate với API
```typescript
// stream.service.ts
async addCameraToProxy(cameraId: string) {
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  
  const rtspUrl = cam.rtspUrl || this.buildRtspUrl(cam);
  
  // Add to MediaMTX via API
  await axios.post(`http://localhost:9997/v3/config/paths/add/camera_${cameraId}`, {
    source: rtspUrl,
    sourceProtocol: 'rtsp',
    sourceOnDemand: true
  });
  
  return {
    proxyUrl: `rtsp://localhost:8554/camera_${cameraId}`,
    hlsUrl: `http://localhost:8888/camera_${cameraId}/index.m3u8`
  };
}
```

---

## 📝 Environment Variables

```bash
# .env
# MediaMTX Configuration
MEDIAMTX_HOST=localhost
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_API_PORT=9997

# Public domain (for production)
STREAM_DOMAIN=stream.your-domain.com

# Authentication
STREAM_USERNAME=viewer
STREAM_PASSWORD=secure_password
```

---

## 🚀 Production Deployment

### Option 1: Same Server
```
API Server (port 3000)
  + MediaMTX (port 8554, 8888)
  + Nginx (reverse proxy)
```

### Option 2: Separate Server
```
API Server (your-api.com)
  ↓
MediaMTX Server (stream.your-api.com)
  ↓
Cameras (internal network)
```

### Nginx Config (Production):
```nginx
server {
    listen 443 ssl;
    server_name stream.your-domain.com;

    # SSL certificates
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # RTSP (requires nginx-rtmp-module)
    location /rtsp {
        proxy_pass rtsp://localhost:8554;
    }

    # HLS
    location /hls {
        proxy_pass http://localhost:8888;
        add_header Access-Control-Allow-Origin *;
    }

    # WebRTC
    location /webrtc {
        proxy_pass http://localhost:8889;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 📚 Resources

- **MediaMTX**: https://github.com/bluenviron/mediamtx
- **Documentation**: https://github.com/bluenviron/mediamtx/blob/main/README.md
- **Docker Image**: `bluenviron/mediamtx:latest`

---

## ✅ Next Steps

1. **Test Local:**
   - Download MediaMTX
   - Create config với 1 camera
   - Test playback

2. **API Integration:**
   - Add `/streams/:cameraId/proxy` endpoint
   - Return MediaMTX URL

3. **Production:**
   - Deploy MediaMTX
   - Setup domain
   - SSL certificates

4. **Frontend:**
   - Update to use HLS URLs
   - Test in browser

---

**Status:** 📋 Ready to implement  
**Difficulty:** ⭐⭐⭐ Medium  
**Time:** ~2-4 hours setup  
**Cost:** Free (VPS ~$5-20/month)

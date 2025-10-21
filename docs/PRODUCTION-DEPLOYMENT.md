# 🚀 Production Deployment Guide - MediaMTX với Dynamic API

## 📋 Tổng quan

Hướng dẫn deploy **NestJS API + MediaMTX** lên Coolify với dynamic camera registration.

---

## 🏗️ Kiến trúc Production

```
Internet
   ↓
Nginx/Caddy (Reverse Proxy)
   ↓
┌─────────────────────────────────────┐
│  Coolify Server                      │
│                                      │
│  ┌─────────────────┐  ┌───────────┐ │
│  │  NestJS API     │  │ MediaMTX  │ │
│  │  Port: 3000     │←→│ API: 9997 │ │
│  │                 │  │ RTSP: 8554│ │
│  └─────────────────┘  │ HLS: 8888 │ │
│           ↓           └───────────┘ │
│  ┌─────────────────┐                │
│  │  PostgreSQL     │                │
│  │  Port: 5432     │                │
│  └─────────────────┘                │
└─────────────────────────────────────┘
```

---

## 📦 1. Chuẩn bị Files

### 1.1. Thêm MediaMTX vào Docker

**Tạo file: `Dockerfile.production`**

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build NestJS
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install MediaMTX
RUN apk add --no-cache wget && \
    wget https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_linux_amd64.tar.gz && \
    tar -xzf mediamtx_v1.5.0_linux_amd64.tar.gz && \
    rm mediamtx_v1.5.0_linux_amd64.tar.gz && \
    chmod +x mediamtx

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy MediaMTX config
COPY mediamtx/mediamtx.yml ./mediamtx.yml

# Expose ports
EXPOSE 3000 8554 8888 8889 9997

# Start both services
COPY start.sh ./
RUN chmod +x start.sh
CMD ["./start.sh"]
```

### 1.2. Script khởi động cả 2 services

**Tạo file: `start.sh`**

```bash
#!/bin/sh

# Start MediaMTX in background
echo "Starting MediaMTX..."
./mediamtx mediamtx.yml &

# Wait for MediaMTX to be ready
sleep 3

# Start NestJS API
echo "Starting NestJS API..."
node dist/main.js
```

### 1.3. MediaMTX config cho production

**File: `mediamtx/mediamtx.yml`** (đã có, chỉ cần verify)

```yaml
# Global settings
logLevel: info
logDestinations: [stdout]

# API - CRITICAL for dynamic registration
api: yes
apiAddress: 0.0.0.0:9997  # Listen on all interfaces

# RTSP
rtspAddress: :8554
protocols: [tcp]

# HLS
hlsAddress: :8888
hlsAllowOrigin: '*'

# WebRTC
webrtcAddress: :8889
webrtcAllowOrigin: '*'

# Paths - empty, cameras registered dynamically
paths:
  # Cameras auto-registered via API
```

---

## 🔐 2. Environment Variables

### 2.1. NestJS API Variables

**Trong Coolify → Service → Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/camera_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-production-2024
JWT_EXPIRES_IN=7d

# Storage (Cloudflare R2)
STORAGE_MODE=r2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://your-r2-domain.com

# MediaMTX Configuration - CRITICAL!
MEDIAMTX_HOST=localhost                    # Internal: localhost
MEDIAMTX_API_URL=http://localhost:9997     # Internal API endpoint
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=false                   # Internal communication

# MediaMTX Public URLs (for client access)
MEDIAMTX_PUBLIC_HOST=stream.iotek.tn       # Your domain
MEDIAMTX_PUBLIC_RTSP_PORT=8554
MEDIAMTX_PUBLIC_HLS_PORT=8888
MEDIAMTX_PUBLIC_WEBRTC_PORT=8889
MEDIAMTX_PUBLIC_USE_HTTPS=true             # Public facing

# Server
PORT=3000
NODE_ENV=production
```

### 2.2. Domain và SSL

**Domains cần setup:**

1. **API Domain**: `api.iotek.tn` → Port 3000
2. **Stream Domain**: `stream.iotek.tn` → Ports 8554, 8888, 8889

**Trong Coolify:**
- Vào Service → Domains
- Add domain: `api.iotek.tn`
- Add domain: `stream.iotek.tn`
- Enable SSL (Let's Encrypt tự động)

---

## 🔧 3. Update Code cho Production

### 3.1. Update stream.service.ts

Thêm support cho public URLs:

```typescript
async getProxyUrl(cameraId: string) {
  if (!cameraId) throw new NotFoundException('cameraId required');
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');

  // Internal MediaMTX (for API calls)
  const mediamtxHost = process.env.MEDIAMTX_HOST || 'localhost';
  const mediamtxApiUrl = process.env.MEDIAMTX_API_URL || 'http://localhost:9997';
  
  // Public MediaMTX (for client URLs)
  const publicHost = process.env.MEDIAMTX_PUBLIC_HOST || mediamtxHost;
  const publicUseHttps = process.env.MEDIAMTX_PUBLIC_USE_HTTPS === 'true';
  const rtspPort = process.env.MEDIAMTX_PUBLIC_RTSP_PORT || '8554';
  const hlsPort = process.env.MEDIAMTX_PUBLIC_HLS_PORT || '8888';
  const webrtcPort = process.env.MEDIAMTX_PUBLIC_WEBRTC_PORT || '8889';
  
  const pathId = cameraId.substring(0, 8);
  const pathName = `camera_${pathId}`;
  const sourceUrl = this.buildRtspUrl(cam);
  
  // Auto-register with internal API
  try {
    await this.registerCameraWithMediaMTX(pathName, sourceUrl, mediamtxApiUrl);
  } catch (error) {
    console.log(`[MediaMTX] Camera ${pathName} registration: ${error.message}`);
  }
  
  // Build PUBLIC URLs for clients
  const httpScheme = publicUseHttps ? 'https' : 'http';
  const rtspScheme = publicUseHttps ? 'rtsps' : 'rtsp';
  
  const hlsUrl = hlsPort === '443' 
    ? `${httpScheme}://${publicHost}/${pathName}/index.m3u8`
    : `${httpScheme}://${publicHost}:${hlsPort}/${pathName}/index.m3u8`;
  
  const webrtcUrl = webrtcPort === '443'
    ? `${httpScheme}://${publicHost}/${pathName}/whep`
    : `${httpScheme}://${publicHost}:${webrtcPort}/${pathName}/whep`;

  return {
    cameraId: cam.id,
    cameraName: cam.name,
    pathId: pathName,
    protocols: {
      rtsp: `${rtspScheme}://${publicHost}:${rtspPort}/${pathName}`,
      hls: hlsUrl,
      webrtc: webrtcUrl,
    },
    // ... rest of response
  };
}
```

---

## 🌐 4. Nginx Reverse Proxy

### 4.1. Config cho Stream Domain

**File: `/etc/nginx/sites-available/stream.iotek.tn`**

```nginx
# RTSP Proxy (TCP)
stream {
    upstream rtsp_backend {
        server localhost:8554;
    }
    
    server {
        listen 8554;
        proxy_pass rtsp_backend;
        proxy_timeout 60s;
    }
}

# HTTP/HLS/WebRTC
server {
    listen 80;
    listen 443 ssl http2;
    server_name stream.iotek.tn;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/stream.iotek.tn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stream.iotek.tn/privkey.pem;

    # HLS streams
    location ~ ^/camera_[a-f0-9]+/.*\.m3u8$ {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        
        # CORS
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Access-Control-Allow-Headers "Range";
        
        # Cache
        add_header Cache-Control "no-cache";
    }
    
    # HLS segments
    location ~ ^/camera_[a-f0-9]+/.*\.ts$ {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        
        # CORS
        add_header Access-Control-Allow-Origin *;
        
        # Cache
        add_header Cache-Control "max-age=10";
    }

    # WebRTC
    location ~ ^/camera_[a-f0-9]+/whep$ {
        proxy_pass http://localhost:8889;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        
        # CORS
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
    }
}
```

---

## 📋 5. Deploy Steps trên Coolify

### Step 1: Tạo Service mới

```bash
1. Login Coolify → Resources → New Service
2. Chọn: Docker Compose hoặc Dockerfile
3. Connect GitHub repo: camera-API_V1
4. Branch: main
```

### Step 2: Configure Build

```yaml
# Coolify sẽ dùng Dockerfile.production
Build Path: /
Dockerfile: Dockerfile.production
Build Args: (none)
```

### Step 3: Set Environment Variables

Copy toàn bộ từ section 2.1 vào Coolify Environment Variables.

**Critical variables:**
```bash
MEDIAMTX_HOST=localhost
MEDIAMTX_API_URL=http://localhost:9997
MEDIAMTX_PUBLIC_HOST=stream.iotek.tn
MEDIAMTX_PUBLIC_USE_HTTPS=true
```

### Step 4: Port Mapping

**Trong Coolify → Service → Ports:**

```
Container Port → Host Port
3000          → 3000    (API)
8554          → 8554    (RTSP)
8888          → 8888    (HLS)
8889          → 8889    (WebRTC)
9997          → Internal only (no external access)
```

### Step 5: Domains

```
api.iotek.tn    → Port 3000
stream.iotek.tn → Port 8888 (HLS)
                → Port 8889 (WebRTC)
                → Port 8554 (RTSP - TCP proxy)
```

### Step 6: Deploy!

```bash
1. Click "Deploy"
2. Wait for build
3. Check logs
4. Test endpoints
```

---

## ✅ 6. Testing Production

### 6.1. Test API

```bash
# Health check
curl https://api.iotek.tn/health

# Login
curl -X POST https://api.iotek.tn/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get proxy URL
curl https://api.iotek.tn/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6.2. Test Stream

**RTSP:**
```bash
vlc rtsp://stream.iotek.tn:8554/camera_49e77c80
```

**HLS (Browser):**
```javascript
// Using HLS.js
const video = document.getElementById('video');
const hls = new Hls();
hls.loadSource('https://stream.iotek.tn:8888/camera_49e77c80/index.m3u8');
hls.attachMedia(video);
```

**WebRTC:**
```javascript
// Ultra-low latency
const pc = new RTCPeerConnection();
// ... WebRTC setup with https://stream.iotek.tn:8889/camera_49e77c80/whep
```

---

## 🔍 7. Monitoring & Logs

### 7.1. Check MediaMTX Status

```bash
# Inside container
curl http://localhost:9997/v3/config/global/get

# List registered cameras
curl http://localhost:9997/v3/config/paths/list
```

### 7.2. Coolify Logs

```
Service → Logs → Real-time
```

Look for:
```
[MediaMTX] ✅ Camera camera_49e77c80 auto-registered successfully
[path camera_49e77c80] [RTSP source] ready: 1 track (H265)
```

---

## 🚨 8. Troubleshooting

### Issue 1: Camera không auto-register

**Check:**
```bash
# 1. Environment variables
echo $MEDIAMTX_API_URL  # Should be http://localhost:9997

# 2. MediaMTX API responding?
curl http://localhost:9997/v3/config/global/get

# 3. Check API logs
# Look for: "[MediaMTX] Camera registration: ..."
```

### Issue 2: Stream không play

**Check:**
```bash
# 1. Camera registered?
curl http://localhost:9997/v3/config/paths/get/camera_49e77c80

# 2. MediaMTX pulling stream?
# Check logs for: "[RTSP source] ready"

# 3. Firewall?
# Ports 8554, 8888, 8889 must be open
```

### Issue 3: CORS errors

**Fix in mediamtx.yml:**
```yaml
hlsAllowOrigin: '*'
webrtcAllowOrigin: '*'
```

---

## 📊 9. Performance Tuning

### 9.1. MediaMTX Config

```yaml
# For production with many cameras
readTimeout: 10s
writeTimeout: 10s
writeQueueSize: 512
udpMaxPayloadSize: 1472

# Connection limits
rtspMaxConnsPerSource: 5  # Max viewers per camera
```

### 9.2. Database Connection Pool

```typescript
// src/data-source.ts
export const AppDataSource = new DataSource({
  // ...
  extra: {
    max: 20,              // Max connections
    min: 5,               // Min connections
    idleTimeoutMillis: 30000,
  },
});
```

---

## 🎯 10. Summary

**Production Setup:**
- ✅ NestJS + MediaMTX in same Docker container
- ✅ MediaMTX API enabled for dynamic registration
- ✅ Internal communication: `localhost:9997`
- ✅ Public URLs: `stream.iotek.tn`
- ✅ SSL/HTTPS for secure streaming
- ✅ Auto-register cameras via API
- ✅ No manual config needed!

**Environment Variables Summary:**
```bash
# Internal (API ↔ MediaMTX)
MEDIAMTX_HOST=localhost
MEDIAMTX_API_URL=http://localhost:9997

# Public (Client facing)
MEDIAMTX_PUBLIC_HOST=stream.iotek.tn
MEDIAMTX_PUBLIC_USE_HTTPS=true
```

**Result:**
- 🚀 Add 1000 cameras → Auto-register all
- 🚀 No config files to edit
- 🚀 No restarts needed
- 🚀 Camera IPs hidden
- 🚀 Production ready!

---

**Questions?** Check logs or contact DevOps! 🛠️

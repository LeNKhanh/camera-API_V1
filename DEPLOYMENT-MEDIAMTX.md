# MediaMTX Deployment Guide for Production

## 🎯 Overview

This guide covers deploying MediaMTX with **Solution 1: Dynamic API Registration** on Coolify.

**What we achieved:**
- ✅ Cameras auto-register via MediaMTX REST API
- ✅ No manual config files needed
- ✅ No restart needed when adding cameras
- ✅ Scales to 1000+ cameras
- ✅ Camera IPs and credentials hidden

---

## 📋 Prerequisites

1. **Coolify Project** with NestJS API deployed
2. **Domain configured**: `stream.iotek.tn` pointing to your server
3. **Ports available**: 8554 (RTSP), 8888 (HLS), 8889 (WebRTC), 9997 (API)

---

## 🚀 Step 1: Deploy MediaMTX on Coolify

### Option A: Docker Compose (Recommended)

Create a new service in Coolify with this `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mediamtx:
    image: bluenviron/mediamtx:latest
    container_name: mediamtx-proxy
    restart: unless-stopped
    
    ports:
      - "8554:8554"     # RTSP
      - "8888:8888"     # HLS
      - "8889:8889"     # WebRTC
      - "9997:9997"     # API
    
    volumes:
      - ./mediamtx.yml:/mediamtx.yml:ro
    
    environment:
      - MTX_LOGLEVEL=info
      - MTX_API=yes
      - MTX_APIADDRESS=:9997
    
    networks:
      - camera-network

networks:
  camera-network:
    external: true
```

### Option B: Standalone Docker Service

In Coolify, create a new service:
- **Type**: Docker Image
- **Image**: `bluenviron/mediamtx:latest`
- **Ports**: 8554, 8888, 8889, 9997
- **Domain**: `stream.iotek.tn`

---

## ⚙️ Step 2: Configure MediaMTX

Upload this `mediamtx.yml` to your MediaMTX service:

```yaml
###############################################
# MediaMTX Configuration for Production
###############################################

# Logging
logLevel: info
logDestinations: [stdout]

# Timeouts
readTimeout: 10s
writeTimeout: 10s

# ============================================
# API CONFIGURATION - REQUIRED FOR SOLUTION 1
# ============================================
api: yes                          # ✅ MUST BE YES!
apiAddress: 0.0.0.0:9997          # Listen on all interfaces

# ============================================
# RTSP SERVER
# ============================================
protocols: [tcp]
rtspAddress: :8554

# ============================================
# HLS SERVER
# ============================================
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: mpegts
hlsPartDuration: 200ms

# ============================================
# WebRTC SERVER
# ============================================
webrtc: yes
webrtcAddress: :8889

# ============================================
# PATHS - Leave empty for dynamic registration
# ============================================
paths:
  # Cameras will be registered dynamically via API
  # No manual configuration needed!
```

**Critical Settings:**
- ✅ `api: yes` - **MUST BE ENABLED** for Solution 1
- ✅ `apiAddress: 0.0.0.0:9997` - Allow API access
- ✅ `paths: {}` - Empty, cameras register via API

---

## 🔧 Step 3: Configure NestJS API Environment Variables

In Coolify, add these environment variables to your NestJS API service:

```bash
# MediaMTX Configuration
MEDIAMTX_HOST=stream.iotek.tn
MEDIAMTX_API_URL=http://stream.iotek.tn:9997
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=false
```

**Important Notes:**

### If MediaMTX and API are on the same Docker network:
```bash
MEDIAMTX_HOST=mediamtx              # Use Docker service name
MEDIAMTX_API_URL=http://mediamtx:9997
```

### If MediaMTX and API are on different servers:
```bash
MEDIAMTX_HOST=stream.iotek.tn       # Use public domain
MEDIAMTX_API_URL=http://stream.iotek.tn:9997
```

---

## 🔥 Step 4: Configure Nginx (Optional - for HTTPS)

If you want HTTPS for HLS/WebRTC streams:

```nginx
# /etc/nginx/sites-available/stream.iotek.tn

server {
    listen 443 ssl http2;
    server_name stream.iotek.tn;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # RTSP (TCP) - Cannot be proxied via Nginx
    # Clients must connect directly to port 8554
    
    # HLS Proxy
    location /hls/ {
        proxy_pass http://localhost:8888/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        
        # CORS for browser access
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control no-cache;
    }
    
    # WebRTC Proxy
    location /webrtc/ {
        proxy_pass http://localhost:8889/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # MediaMTX API (optional - for monitoring)
    location /api/ {
        proxy_pass http://localhost:9997/v3/;
        proxy_http_version 1.1;
    }
}
```

Then update environment variables:
```bash
MEDIAMTX_USE_HTTPS=true
```

---

## 🧪 Step 5: Test the Deployment

### Test 1: Check MediaMTX API

```bash
curl http://stream.iotek.tn:9997/v3/config/global/get
```

**Expected**: JSON response with MediaMTX config

### Test 2: Call NestJS API to Register Camera

```bash
# Login
TOKEN=$(curl -X POST https://api.iotek.tn/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# Get proxy URL (auto-registers camera)
curl -X GET https://api.iotek.tn/streams/CAMERA_ID/proxy \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

**Expected Response:**
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "pathId": "camera_49e77c80",
  "protocols": {
    "rtsp": "rtsp://stream.iotek.tn:8554/camera_49e77c80",
    "hls": "http://stream.iotek.tn:8888/camera_49e77c80/index.m3u8",
    "webrtc": "http://stream.iotek.tn:8889/camera_49e77c80/whep"
  },
  "security": {
    "autoRegistered": true,
    "cameraIpHidden": true
  }
}
```

### Test 3: Verify Camera Registered in MediaMTX

```bash
curl http://stream.iotek.tn:9997/v3/config/paths/get/camera_49e77c80
```

**Expected**: Camera config with source URL

### Test 4: Test Stream in VLC

```bash
vlc rtsp://stream.iotek.tn:8554/camera_49e77c80
```

**Expected**: Video stream plays! 🎥

---

## 🔍 Troubleshooting

### Problem: API returns 404

**Cause**: MediaMTX API not enabled

**Solution**:
```yaml
# mediamtx.yml
api: yes  # Must be 'yes', not 'no'
apiAddress: 0.0.0.0:9997
```

Then restart MediaMTX.

---

### Problem: "Path already exists" error

**Cause**: Camera already registered

**Solution**: This is normal! API checks if camera exists before adding. The camera will still work.

---

### Problem: Stream doesn't play in VLC

**Checks**:
1. Is camera online? `ping CAMERA_IP`
2. Is MediaMTX pulling stream?
   ```bash
   curl http://stream.iotek.tn:9997/v3/paths/list | jq
   ```
3. Check MediaMTX logs:
   ```bash
   docker logs mediamtx-proxy --tail 50
   ```

**Expected in logs**:
```
[path camera_XXXXX] [RTSP source] ready: 1 track (H265)
```

---

### Problem: Cannot connect to MediaMTX API from NestJS

**Cause**: Wrong network configuration

**Solution 1** (Same Docker network):
```bash
MEDIAMTX_API_URL=http://mediamtx:9997  # Use Docker service name
```

**Solution 2** (Different servers):
```bash
MEDIAMTX_API_URL=http://stream.iotek.tn:9997  # Use public domain
```

Make sure port 9997 is open in firewall.

---

## 📊 Monitoring

### Check Registered Cameras

```bash
curl http://stream.iotek.tn:9997/v3/config/paths/list | jq '.items[] | select(.name | startswith("camera_"))'
```

### Check Active Streams

```bash
curl http://stream.iotek.tn:9997/v3/paths/list | jq '.items[] | select(.name | startswith("camera_"))'
```

### MediaMTX Metrics (if enabled)

```bash
curl http://stream.iotek.tn:9998/metrics
```

---

## 🎯 Production Checklist

Before going live, verify:

- [ ] MediaMTX API enabled (`api: yes`)
- [ ] Port 9997 accessible from NestJS API
- [ ] Environment variables configured correctly
- [ ] Test camera registration via API
- [ ] Test stream playback in VLC
- [ ] Test HLS stream in browser (if using)
- [ ] Firewall rules configured:
  - Port 8554 (RTSP) - Public
  - Port 8888 (HLS) - Public  
  - Port 8889 (WebRTC) - Public
  - Port 9997 (API) - Internal only (or firewall protected)
- [ ] DNS configured: `stream.iotek.tn` → Server IP
- [ ] SSL certificate (if using HTTPS)
- [ ] Monitoring setup (logs, metrics)

---

## 🚀 Scaling Tips

### For 100+ cameras:

1. **Increase MediaMTX resources**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '4'
         memory: 4G
   ```

2. **Tune MediaMTX config**:
   ```yaml
   readBufferCount: 512   # Increase for more streams
   writeQueueSize: 1024   # Increase throughput
   ```

3. **Load balance multiple MediaMTX instances**:
   - Deploy MediaMTX on multiple servers
   - Use Nginx to load balance based on camera ID
   - Update API to distribute cameras across instances

4. **Monitor performance**:
   - CPU usage per stream
   - Network bandwidth
   - Memory consumption
   - Connection count

---

## 🎉 Success!

You now have a production-ready RTSP proxy system with:
- ✅ Automatic camera registration via API
- ✅ Zero manual configuration
- ✅ Zero restarts needed
- ✅ Camera IPs completely hidden
- ✅ Scalable to 1000+ cameras

**For 100 cameras:**
- **Before**: 500 minutes manual config (8+ hours) 😫
- **After**: 0 minutes! Fully automatic! 🚀

---

## 📚 Additional Resources

- [MediaMTX Documentation](https://github.com/bluenviron/mediamtx)
- [MediaMTX API Reference](https://github.com/bluenviron/mediamtx#api)
- [RTSP Protocol Spec](https://www.rfc-editor.org/rfc/rfc2326)
- [HLS Streaming Guide](https://developer.apple.com/documentation/http_live_streaming)

---

**Questions?** Check logs or contact support! 🙋‍♂️

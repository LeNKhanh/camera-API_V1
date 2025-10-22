# MediaMTX Production Deployment Checklist

## Step 1: Deploy MediaMTX in Coolify

### Create New Resource
- [ ] Go to Coolify → New Resource → Docker Image
- [ ] Name: `mediamtx-proxy`
- [ ] Image: `bluenviron/mediamtx:1.9.2`
- [ ] Network: Same as Camera API (e.g., `camera-api-network`)

### Mount Configuration File
- [ ] Go to **Storages** tab
- [ ] Add File Mount:
  - Source: Upload `mediamtx/mediamtx.yml` content
  - Destination: `/mediamtx.yml`
  - Read-only: Yes

### Configure Ports
- [ ] Go to **Ports** tab
- [ ] Add ports:
  - `8554:8554` (RTSP)
  - `8888:8888` (HLS)
  - `8889:8889` (WebRTC)
  - `8189:8189/udp` (WebRTC ICE)

### Configure Domain
- [ ] Go to **Domains** tab
- [ ] Add domain: `proxy-camera.teknix.services`
- [ ] Port: `8888`
- [ ] Enable HTTPS (Let's Encrypt)
- [ ] Save

### Deploy
- [ ] Click **Deploy** button
- [ ] Wait for deployment to complete
- [ ] Check logs for: `INF MediaMTX v1.9.2`

---

## Step 2: Update Camera API Environment

### In Coolify → Camera API → Environment Variables
- [ ] Update or add these variables:

```bash
MEDIAMTX_HOST=proxy-camera.teknix.services
MEDIAMTX_API_URL=http://mediamtx-proxy:9997
MEDIAMTX_HLS_PORT=443
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=true
```

- [ ] Click **Save**
- [ ] Click **Restart** or **Deploy**

---

## Step 3: Verify Deployment

### Test MediaMTX API (from Camera API container)
```bash
# In Camera API container terminal:
curl http://mediamtx-proxy:9997/v3/config/global/get
```
Expected: JSON response with config

### Test Camera Registration
```bash
# Call Camera API endpoint:
curl https://camera-api.teknix.services/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy
```
Expected response:
```json
{
  "protocols": {
    "rtsp": "rtsp://proxy-camera.teknix.services:8554/camera_49e77c80",
    "hls": "https://proxy-camera.teknix.services/camera_49e77c80/index.m3u8",
    "hlsWebPlayer": "https://proxy-camera.teknix.services/camera_49e77c80/",
    "webrtc": "https://proxy-camera.teknix.services:8889/camera_49e77c80/whep"
  },
  "registered": true
}
```

### Test HLS Stream in Browser
- [ ] Open: `https://proxy-camera.teknix.services/camera_49e77c80/`
- [ ] Video should auto-play
- [ ] No DTS errors in MediaMTX logs

### Check MediaMTX Logs
```bash
# In Coolify → mediamtx-proxy → Logs
```
Expected:
```
INF MediaMTX v1.9.2
INF [path camera_49e77c80] [RTSP source] ready: 1 track (H265)
INF [HLS] [muxer camera_49e77c80] is converting into HLS
```

---

## Troubleshooting

### Issue: Camera API can't connect to MediaMTX API
**Solution:** Check that both services are in same Docker network
```bash
# In Coolify, verify Network settings for both services
```

### Issue: HLS stream not loading
**Solution:** Check domain configuration points to port 8888
```bash
# Test directly:
curl https://proxy-camera.teknix.services/camera_49e77c80/index.m3u8
```

### Issue: CORS errors in browser
**Solution:** Verify `hlsAllowOrigin: '*'` in mediamtx.yml

### Issue: Stream not registering
**Solution:** Check Camera API logs:
```bash
# In Coolify → camera-api → Logs
# Look for: [MediaMTX] SUCCESS: Camera camera_xxx auto-registered
```

---

## Architecture Overview

```
Internet
    ↓
Coolify Reverse Proxy (Caddy)
    ↓ HTTPS
proxy-camera.teknix.services:443
    ↓
MediaMTX Container (port 8888)
    ↑ (Internal Docker Network)
Camera API Container
    ↓ (API calls to http://mediamtx-proxy:9997)
MediaMTX API
    ↓ RTSP
Dahua Camera (192.168.1.66:554)
```

---

## Success Criteria

- [x] MediaMTX container running in Coolify
- [x] Domain `proxy-camera.teknix.services` resolves with HTTPS
- [x] Camera API can register cameras via internal API
- [x] HLS stream plays at `https://proxy-camera.teknix.services/camera_xxx/`
- [x] No camera IPs exposed to clients
- [x] No CORS errors in browser console
- [x] Stream plays smoothly without buffering

---

**Date:** October 22, 2025
**MediaMTX Version:** v1.9.2
**Deployment Platform:** Coolify (Docker)

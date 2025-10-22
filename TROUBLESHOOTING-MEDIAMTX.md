# MediaMTX Deployment Troubleshooting

## Error: `getaddrinfo EAI_AGAIN mediamtx-proxy`

### Problem
Camera API cannot resolve hostname `mediamtx-proxy`. This means they are not in the same Docker network.

### Solutions (choose ONE based on your setup)

---

## Solution 1: Same Server Deployment (RECOMMENDED)

If Camera API and MediaMTX are on the same server, use `localhost`:

### In Coolify → Camera API → Environment Variables:
```bash
MEDIAMTX_API_URL=http://localhost:9997
```

### In Coolify → MediaMTX → Ports:
- Bind API port to host: `127.0.0.1:9997:9997` (localhost only)

This allows Camera API to connect via `http://localhost:9997` from the host network.

---

## Solution 2: Docker Network (If both in Docker)

If both services are Docker containers in Coolify:

### Step 1: Create Shared Network in Coolify
```bash
# SSH to server
ssh user@proxy-camera.teknix.services

# Create Docker network
docker network create camera-network
```

### Step 2: Attach Both Services to Network

**For MediaMTX:**
- Coolify → mediamtx-proxy → Network → Add: `camera-network`

**For Camera API:**
- Coolify → camera-api → Network → Add: `camera-network`

### Step 3: Use Container Name in Environment
```bash
MEDIAMTX_API_URL=http://mediamtx-proxy:9997
```

Note: Container name must match the service name in Coolify (check in Docker: `docker ps`)

---

## Solution 3: Use Internal IP Address

If containers cannot communicate by name:

### Step 1: Find MediaMTX Container IP
```bash
ssh user@proxy-camera.teknix.services
docker inspect mediamtx-proxy | grep IPAddress
```

Output example:
```
"IPAddress": "172.17.0.5"
```

### Step 2: Update Environment Variable
```bash
MEDIAMTX_API_URL=http://172.17.0.5:9997
```

⚠️ Warning: IP may change on container restart. Use Solution 1 or 2 instead.

---

## Solution 4: Use Host Network Mode

### In Coolify → MediaMTX → Advanced:
- Network Mode: `host`

### In Coolify → Camera API → Environment:
```bash
MEDIAMTX_API_URL=http://localhost:9997
```

⚠️ Warning: Host network mode bypasses Docker network isolation.

---

## Testing Connection

### Test 1: From Camera API Container
```bash
# SSH to server
ssh user@proxy-camera.teknix.services

# Get Camera API container ID
docker ps | grep camera-api

# Exec into container
docker exec -it <camera-api-container-id> sh

# Test connection
wget -O- http://localhost:9997/v3/config/global/get
# OR
wget -O- http://mediamtx-proxy:9997/v3/config/global/get
# OR
wget -O- http://172.17.0.5:9997/v3/config/global/get
```

Expected output: JSON config from MediaMTX

### Test 2: Check MediaMTX is Running
```bash
# Check MediaMTX container
docker ps | grep mediamtx

# Check MediaMTX logs
docker logs mediamtx-proxy

# Expected log:
# INF MediaMTX v1.9.2
# INF [API] listener opened on 127.0.0.1:9997
```

### Test 3: Check Port Binding
```bash
# Check if port 9997 is accessible
docker port mediamtx-proxy

# Expected:
# 9997/tcp -> 127.0.0.1:9997
```

---

## Recommended Setup for Coolify

### Best Practice: Use Localhost (Solution 1)

1. **MediaMTX Deployment:**
   - Deploy as Docker Image: `bluenviron/mediamtx:1.9.2`
   - **Ports:**
     - `8554:8554` (RTSP)
     - `8888:8888` (HLS)
     - `8889:8889` (WebRTC)
     - `127.0.0.1:9997:9997` (API - localhost only) ← **IMPORTANT**
   - **Domain:** `proxy-camera.teknix.services` → port `8888`
   - **Mount:** `mediamtx.yml` → `/mediamtx.yml`

2. **Camera API Environment:**
   ```bash
   MEDIAMTX_HOST=proxy-camera.teknix.services
   MEDIAMTX_API_URL=http://localhost:9997
   MEDIAMTX_HLS_PORT=8888
   MEDIAMTX_RTSP_PORT=8554
   MEDIAMTX_WEBRTC_PORT=8889
   MEDIAMTX_USE_HTTPS=true
   ```

3. **Deploy Camera API:**
   - Coolify will auto-deploy from git push
   - Check logs for: `[MediaMTX] SUCCESS: Camera camera_xxx auto-registered`

---

## Issue: Stream URL Not Working

### Problem
`https://proxy-camera.teknix.services:8888/camera_xxx/` returns error

### Check 1: Domain Configuration
In Coolify → MediaMTX → Domains:
- Domain must be: `proxy-camera.teknix.services`
- Port must be: `8888`
- HTTPS: Enabled

### Check 2: MediaMTX Logs
```bash
docker logs mediamtx-proxy -f
```

Expected when accessing stream:
```
INF [path camera_xxx] [RTSP source] ready: 1 track (H265)
INF [HLS] [muxer camera_xxx] created automatically
INF [HLS] [muxer camera_xxx] is converting into HLS
```

### Check 3: Test HLS Manifest Directly
```bash
curl https://proxy-camera.teknix.services:8888/camera_be5729fe/index.m3u8
```

Expected: M3U8 playlist content

### Check 4: Camera Registration
```bash
# Test from Camera API
curl http://localhost:9997/v3/paths/list
```

Expected: JSON list with registered cameras

---

## Quick Fix Checklist

- [ ] MediaMTX container is running: `docker ps | grep mediamtx`
- [ ] Port 9997 is bound to localhost: `docker port mediamtx-proxy`
- [ ] Camera API has correct `MEDIAMTX_API_URL=http://localhost:9997`
- [ ] Camera API is restarted after env change
- [ ] Domain `proxy-camera.teknix.services` points to port 8888
- [ ] MediaMTX logs show camera registered
- [ ] Test HLS manifest URL works

---

## Final Configuration (Copy to Coolify)

### MediaMTX Service
```yaml
Name: mediamtx-proxy
Image: bluenviron/mediamtx:1.9.2
Ports:
  - 8554:8554
  - 8888:8888
  - 8889:8889
  - 8189:8189/udp
  - 127.0.0.1:9997:9997
Domain: proxy-camera.teknix.services -> 8888 (HTTPS enabled)
Mount: mediamtx.yml -> /mediamtx.yml
```

### Camera API Environment
```bash
MEDIAMTX_HOST=proxy-camera.teknix.services
MEDIAMTX_API_URL=http://localhost:9997
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=true
```

After updating environment variables, **restart Camera API** in Coolify.

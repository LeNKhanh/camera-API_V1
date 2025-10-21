# PRODUCTION DEPLOYMENT GUIDE - MediaMTX + NestJS API

## Current Working Configuration (Local)

### Local Environment (.env)
```bash
MEDIAMTX_HOST=localhost
MEDIAMTX_API_URL=http://localhost:9997
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=false
```

### MediaMTX Config (mediamtx.yml)
```yaml
api: yes                    # CRITICAL - Must be enabled
apiAddress: 127.0.0.1:9997  # API endpoint
rtspAddress: :8554          # RTSP port
hlsAddress: :8888           # HLS port
webRTCAddress: :8889        # WebRTC port
```

---

## PRODUCTION SETUP ON COOLIFY

### Architecture Options

#### ✅ OPTION 1: Both services on same server (RECOMMENDED)
```
[Docker Network]
├── NestJS API Container (api.iotek.tn)
└── MediaMTX Container (mediamtx)
    Internal communication via Docker network
```

#### ❌ OPTION 2: Separate servers (Not recommended - causes ETIMEDOUT)
```
Server 1: NestJS API
Server 2: MediaMTX
    External communication via internet (slow, requires firewall config)
```

---

## STEP-BY-STEP DEPLOYMENT

### STEP 1: Deploy MediaMTX Service on Coolify

1. **Create New Service in Coolify**
   - Go to your Coolify project
   - Click "Add New Resource" → "Docker Image"
   - Name: `mediamtx`

2. **Docker Configuration**
   ```yaml
   Image: bluenviron/mediamtx:latest
   Restart Policy: always
   ```

3. **Port Mappings**
   ```
   8554:8554  # RTSP
   8888:8888  # HLS
   8889:8889  # WebRTC
   9997:9997  # API (optional - only if need external access)
   ```

4. **Upload mediamtx.yml**
   - In Coolify, go to "Files" tab
   - Upload your `mediamtx/mediamtx.yml` file to `/mediamtx.yml`
   - OR use Docker volume mount: `./mediamtx.yml:/mediamtx.yml`

5. **Deploy the service**

---

### STEP 2: Configure NestJS API Environment Variables

**In Coolify → Your NestJS API Service → Environment Variables**

Add/Update these variables:

```bash
# ============================================
# MEDIAMTX - INTERNAL DOCKER NETWORK
# ============================================
MEDIAMTX_HOST=mediamtx
MEDIAMTX_API_URL=http://mediamtx:9997

# Ports (same as local)
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889

# HTTPS (keep false for now, enable after Nginx setup)
MEDIAMTX_USE_HTTPS=false
```

**Important Notes:**
- `MEDIAMTX_HOST=mediamtx` - Docker service name (internal network)
- `MEDIAMTX_API_URL=http://mediamtx:9997` - Internal API endpoint
- Do NOT use `iotek.tn-cdn.net` for API communication (causes timeout)

---

### STEP 3: Configure Docker Network (Coolify Auto-handles This)

Coolify automatically creates a Docker network for services in the same project.

**Verify network connectivity:**
```bash
# SSH to your server
docker exec YOUR_API_CONTAINER curl http://mediamtx:9997/v3/config/global/get
```

Expected output:
```json
{
  "logLevel": "info",
  "api": true,
  ...
}
```

---

### STEP 4: Update MediaMTX API Address for External Access (Optional)

If you want to access MediaMTX API from outside (for debugging), update `mediamtx.yml`:

```yaml
# CHANGE FROM:
apiAddress: 127.0.0.1:9997

# CHANGE TO:
apiAddress: 0.0.0.0:9997
```

This allows external access to port 9997.

---

### STEP 5: Setup Nginx Reverse Proxy (Optional - for HTTPS)

If you want to expose streams via HTTPS on `iotek.tn-cdn.net`:

```nginx
# /etc/nginx/sites-available/mediamtx
server {
    listen 443 ssl http2;
    server_name iotek.tn-cdn.net;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # HLS streams
    location /hls/ {
        proxy_pass http://mediamtx:8888/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS for web players
        add_header Access-Control-Allow-Origin *;
    }

    # WebRTC
    location /webrtc/ {
        proxy_pass http://mediamtx:8889/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # API endpoint (optional - for debugging)
    location /api/ {
        proxy_pass http://mediamtx:9997/;
        proxy_set_header Host $host;
    }
}
```

**Note:** RTSP cannot be proxied through Nginx (it's TCP-based, not HTTP).

Then update environment:
```bash
MEDIAMTX_USE_HTTPS=true
MEDIAMTX_HOST=iotek.tn-cdn.net  # For client URLs only
MEDIAMTX_API_URL=http://mediamtx:9997  # Keep internal for API
```

---

## CLIENT URL EXAMPLES

### After Deployment - Client URLs

**Without HTTPS (Direct):**
```
RTSP: rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX
HLS:  http://iotek.tn-cdn.net:8888/camera_XXXXXXXX/index.m3u8
WebRTC: http://iotek.tn-cdn.net:8889/camera_XXXXXXXX/whep
```

**With HTTPS + Nginx:**
```
RTSP: rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX (no proxy)
HLS:  https://iotek.tn-cdn.net/hls/camera_XXXXXXXX/index.m3u8
WebRTC: https://iotek.tn-cdn.net/webrtc/camera_XXXXXXXX/whep
```

---

## VERIFICATION CHECKLIST

### 1. Check MediaMTX Service
```bash
# SSH to server
docker ps | grep mediamtx
# Should show running container

docker logs MEDIAMTX_CONTAINER --tail 50
# Should show "MediaMTX v1.x.x"
# Should show "API listener opened on :9997"
```

### 2. Test MediaMTX API (Internal)
```bash
docker exec YOUR_API_CONTAINER curl http://mediamtx:9997/v3/config/global/get
# Should return JSON with api: true
```

### 3. Test Camera Registration
```bash
# Call your API endpoint
curl https://api.iotek.tn/streams/YOUR_CAMERA_ID/proxy

# Check logs - should see:
# [MediaMTX] Auto-registration triggered...
# [MediaMTX] SUCCESS: Camera registered
```

### 4. Verify Stream
```bash
# Check registered paths
curl http://YOUR_SERVER_IP:9997/v3/paths/list

# Should show:
# - name: camera_XXXXXXXX
# - ready: true
# - tracks: [H265] or [H264]
```

### 5. Test Stream in VLC
```
1. Open VLC
2. Media → Open Network Stream
3. Paste: rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX
4. Should play immediately
```

---

## TROUBLESHOOTING

### Error: ETIMEDOUT
**Cause:** Using external URL for internal API communication

**Fix:**
```bash
# WRONG (causes timeout):
MEDIAMTX_API_URL=http://iotek.tn-cdn.net:9997

# CORRECT (internal network):
MEDIAMTX_API_URL=http://mediamtx:9997
```

### Error: ECONNREFUSED
**Cause:** MediaMTX service not running or wrong service name

**Fix:**
```bash
# Check if MediaMTX is running
docker ps | grep mediamtx

# Check service name in Docker network
docker network inspect NETWORK_NAME

# Make sure service name matches environment variable
MEDIAMTX_HOST=mediamtx  # Must match container name
```

### Error: Path not found (404)
**Cause:** Camera not registered or registration failed

**Fix:**
```bash
# Check MediaMTX logs
docker logs mediamtx --tail 100

# Manually register camera for testing
curl -X POST http://YOUR_SERVER:9997/v3/config/paths/add/test_camera \
  -H "Content-Type: application/json" \
  -d '{
    "source": "rtsp://admin:pass@192.168.1.66:554/cam/realmonitor?channel=1&subtype=0",
    "sourceProtocol": "automatic"
  }'
```

### Stream ready but VLC can't play
**Cause:** Firewall blocking ports

**Fix:**
```bash
# On your server, open ports
sudo ufw allow 8554/tcp  # RTSP
sudo ufw allow 8888/tcp  # HLS
sudo ufw allow 8889/tcp  # WebRTC
```

---

## QUICK DEPLOYMENT COMMANDS

```bash
# 1. Deploy MediaMTX
docker run -d \
  --name mediamtx \
  --restart always \
  -p 8554:8554 \
  -p 8888:8888 \
  -p 8889:8889 \
  -p 9997:9997 \
  -v ./mediamtx.yml:/mediamtx.yml \
  bluenviron/mediamtx:latest

# 2. Verify MediaMTX is running
curl http://localhost:9997/v3/config/global/get

# 3. Deploy NestJS API with environment variables
# (Use Coolify UI or update .env file)

# 4. Test API registration
curl https://api.iotek.tn/streams/YOUR_CAMERA_ID/proxy

# 5. Check registered cameras
curl http://localhost:9997/v3/paths/list

# 6. Test stream
vlc rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX
```

---

## SUMMARY: LOCAL → PRODUCTION MAPPING

| Component | Local (Working) | Production (Correct) | Production (Wrong ❌) |
|-----------|----------------|---------------------|----------------------|
| API Container | localhost | Docker container | Docker container |
| MediaMTX | localhost | Docker container | Different server |
| API to MediaMTX | http://localhost:9997 | http://mediamtx:9997 | ~~http://iotek.tn-cdn.net:9997~~ |
| Client to Stream | rtsp://localhost:8554 | rtsp://iotek.tn-cdn.net:8554 | Same |
| Communication | Same process | Docker network | ❌ External internet |

**Key Insight:** 
- **Internal API calls**: Use Docker service name (`mediamtx`)
- **External client access**: Use public domain (`iotek.tn-cdn.net`)

---

## Next Steps After Deployment

1. Pull latest code on production
2. Update environment variables in Coolify
3. Redeploy both services
4. Test camera registration
5. Verify stream playback
6. Setup monitoring (optional)
7. Configure SSL/HTTPS (optional)
8. Scale to 100+ cameras

---

## Support

If you encounter issues:

1. Check MediaMTX logs: `docker logs mediamtx --tail 100`
2. Check API logs in Coolify
3. Run debug script: `./scripts/debug-mediamtx-production.sh`
4. Verify network: `docker exec api curl http://mediamtx:9997/v3/config/global/get`

---

**Last Updated:** 2025-10-21
**Status:** Ready for Production Deployment ✅

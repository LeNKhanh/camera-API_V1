# MediaMTX Deployment Guide (Coolify)

## Option 1: Deploy MediaMTX as Separate Service in Coolify

### 1. Create New Service in Coolify

1. Go to Coolify Dashboard
2. Click "New Resource" → "Docker Image"
3. Configure:
   - **Name**: `mediamtx-proxy`
   - **Docker Image**: `bluenviron/mediamtx:1.9.2`
   - **Network**: Same network as Camera API

### 2. Mount Configuration File

In Coolify, go to **Storages** tab and add:

**File Mount:**
- **Type**: File
- **Source Path**: `/path/on/host/mediamtx.yml` (you'll upload this)
- **Destination Path**: `/mediamtx.yml`
- **Content**: Copy entire content of `mediamtx/mediamtx.yml`

### 3. Set Environment Variables

In Coolify, go to **Environment Variables** tab:

```bash
# No environment variables needed - all config is in mediamtx.yml
# MediaMTX reads config from /mediamtx.yml by default
```

### 4. Configure Ports

In Coolify, go to **Ports** tab and expose:

- **8554** → RTSP (TCP)
- **8888** → HLS (HTTP)
- **8889** → WebRTC (HTTP)
- **8189** → WebRTC ICE (UDP)
- **9997** → API (TCP) - **IMPORTANT: Set to localhost only**

### 5. Configure Domains

In Coolify, go to **Domains** tab:

**For HLS Web Player:**
- Domain: `proxy-camera.teknix.services`
- Port: `8888`
- HTTPS: Enabled (Let's Encrypt)

This will make HLS available at:
- `https://proxy-camera.teknix.services/camera_xxx/index.m3u8`
- `https://proxy-camera.teknix.services/camera_xxx/` (web player)

### 6. Start Command

Default command is fine, MediaMTX will use `/mediamtx.yml` automatically.

---

## Option 2: Deploy with Docker Compose

Create `docker-compose.mediamtx.yml`:

```yaml
version: '3.8'

services:
  mediamtx:
    image: bluenviron/mediamtx:1.9.2
    container_name: mediamtx-proxy
    restart: always
    
    # Mount config file
    volumes:
      - ./mediamtx.yml:/mediamtx.yml:ro
      
    # Expose ports
    ports:
      - "8554:8554"      # RTSP
      - "8888:8888"      # HLS
      - "8889:8889"      # WebRTC HTTP
      - "8189:8189/udp"  # WebRTC ICE
      - "127.0.0.1:9997:9997"  # API (localhost only)
    
    # Network (same as Camera API)
    networks:
      - camera-network
    
    # Health check
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:9997/v3/config/global/get"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

networks:
  camera-network:
    external: true  # Use existing network from Camera API
```

Deploy:
```bash
docker-compose -f docker-compose.mediamtx.yml up -d
```

---

## Option 3: Manual Deployment (Systemd Service)

### 1. Upload Files to Server

```bash
# Create directory
ssh user@proxy-camera.teknix.services "mkdir -p /opt/mediamtx"

# Upload binary (Linux version)
scp mediamtx/mediamtx user@proxy-camera.teknix.services:/opt/mediamtx/

# Upload config
scp mediamtx/mediamtx.yml user@proxy-camera.teknix.services:/opt/mediamtx/

# Set permissions
ssh user@proxy-camera.teknix.services "chmod +x /opt/mediamtx/mediamtx"
```

### 2. Create Systemd Service

```bash
ssh user@proxy-camera.teknix.services
sudo nano /etc/systemd/system/mediamtx.service
```

Content:
```ini
[Unit]
Description=MediaMTX RTSP/HLS/WebRTC Proxy
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mediamtx
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=always
RestartSec=5

# Environment variables (if needed)
# Environment="MTX_LOGLEVEL=info"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mediamtx
sudo systemctl start mediamtx
sudo systemctl status mediamtx
```

### 3. Configure Nginx Reverse Proxy (for HTTPS)

```bash
sudo nano /etc/nginx/sites-available/proxy-camera.teknix.services
```

Content:
```nginx
server {
    listen 80;
    server_name proxy-camera.teknix.services;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name proxy-camera.teknix.services;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/proxy-camera.teknix.services/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/proxy-camera.teknix.services/privkey.pem;
    
    # Proxy to MediaMTX HLS
    location / {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers for HLS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Range, Content-Type' always;
        
        # HLS specific headers
        add_header Cache-Control 'no-cache, no-store, must-revalidate';
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/proxy-camera.teknix.services /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Recommended: Option 1 (Coolify Docker Image)

**Advantages:**
- ✅ Easy deployment through Coolify UI
- ✅ Automatic SSL/TLS with Let's Encrypt
- ✅ Easy updates (just change image version)
- ✅ Health checks and auto-restart
- ✅ Integrated with existing infrastructure

**Steps Summary:**

1. **Create Service in Coolify:**
   - Docker Image: `bluenviron/mediamtx:1.9.2`
   - Mount `mediamtx.yml` as file

2. **Configure Ports:**
   - 8554, 8888, 8889, 8189 (UDP), 9997 (localhost only)

3. **Add Domain:**
   - `proxy-camera.teknix.services` → port 8888
   - Enable HTTPS

4. **Update Camera API .env in Coolify:**
   ```bash
   MEDIAMTX_HOST=proxy-camera.teknix.services
   MEDIAMTX_HLS_PORT=443
   MEDIAMTX_USE_HTTPS=true
   MEDIAMTX_API_URL=http://mediamtx-proxy:9997
   ```
   
   Note: `MEDIAMTX_API_URL` uses container name `mediamtx-proxy` for internal Docker network communication.

5. **Deploy Both Services:**
   - MediaMTX container
   - Camera API container
   - Both in same Docker network

---

## Configuration File: mediamtx.yml

The file `mediamtx/mediamtx.yml` is already configured with:

✅ **API**: `api: yes` on `127.0.0.1:9997`
✅ **RTSP**: `rtsp: yes` on `:8554`, TCP only
✅ **HLS**: `hls: yes` on `:8888`, `hlsAlwaysRemux: yes`
✅ **WebRTC**: `webrtc: yes` on `:8889`
✅ **Read Timeout**: `20s`
✅ **RTSP Transport**: `tcp` for all sources
✅ **CORS**: `hlsAllowOrigin: '*'`

No environment variables needed - all configuration is in the YAML file.

---

## Testing After Deployment

```bash
# Test API (from Camera API container)
curl http://mediamtx-proxy:9997/v3/paths/list

# Test HLS stream (from outside)
curl https://proxy-camera.teknix.services/camera_49e77c80/index.m3u8

# Test in browser
open https://proxy-camera.teknix.services/camera_49e77c80/
```

---

## Camera API Configuration

Update in Coolify → Camera API → Environment Variables:

```bash
# MediaMTX Internal API (Docker network)
MEDIAMTX_API_URL=http://mediamtx-proxy:9997

# MediaMTX Public URLs (for clients)
MEDIAMTX_HOST=proxy-camera.teknix.services
MEDIAMTX_HLS_PORT=443
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=true
```

The Camera API will:
- Register cameras via `http://mediamtx-proxy:9997` (internal Docker network)
- Return public URLs like `https://proxy-camera.teknix.services/camera_xxx/` to clients

---

## File Structure on Server

```
/opt/mediamtx/
├── mediamtx          # Binary (if using systemd)
└── mediamtx.yml      # Configuration file

# Or in Coolify (Docker):
/path/to/coolify/storage/
└── mediamtx.yml      # Mounted into container
```

No other files needed - MediaMTX stores everything in memory or generates on-the-fly.

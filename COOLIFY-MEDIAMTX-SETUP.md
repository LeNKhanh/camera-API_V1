# Hướng dẫn Deploy MediaMTX trên Coolify

## Coolify KHÔNG có MediaMTX trong danh sách resources sẵn

Bạn cần tạo service bằng **Docker Image** (custom).

---

## BƯỚC 1: Tạo Service từ Docker Image

### 1.1. Trong Coolify Dashboard

1. Vào **Project** của bạn (project đang chạy NestJS API)
2. Click **"+ Add New Resource"**
3. Chọn **"Docker Image"** (KHÔNG phải Application hay Database)

### 1.2. Điền thông tin

```
Service Name: mediamtx
Description: RTSP/HLS/WebRTC Proxy Server
```

---

## BƯỚC 2: Configure Docker Image

### 2.1. Image Settings

```
Docker Image: bluenviron/mediamtx:latest
Registry: Docker Hub (default)
Pull Policy: Always
Restart Policy: unless-stopped
```

### 2.2. Port Mappings

Click **"Add Port"** và thêm các port sau:

```
Container Port → Host Port
8554 → 8554   (RTSP)
8888 → 8888   (HLS)
8889 → 8889   (WebRTC)
9997 → 9997   (API - optional)
```

**Lưu ý:** 
- Host Port phải là port chưa sử dụng trên server
- Nếu port 8554 đã được dùng, đổi thành 18554 (ví dụ)

---

## BƯỚC 3: Upload mediamtx.yml Config File

### Option A: Sử dụng Volume Mount (RECOMMENDED)

1. Trong Coolify, tab **"Volumes"**
2. Click **"Add Volume"**
3. Điền:
   ```
   Source: /path/on/host/mediamtx.yml
   Destination: /mediamtx.yml
   ```

### Option B: Sử dụng Coolify Files Tab

1. Tab **"Files"**
2. Click **"Add File"**
3. Path: `/mediamtx.yml`
4. Paste nội dung file `mediamtx/mediamtx.yml` từ repo

**Nội dung file mediamtx.yml quan trọng:**
```yaml
# API MUST BE ENABLED
api: yes
apiAddress: 0.0.0.0:9997  # Cho phép truy cập từ other containers

# RTSP
rtsp: yes
rtspAddress: :8554

# HLS
hls: yes
hlsAddress: :8888

# WebRTC
webrtc: yes
webrtcAddress: :8889

# Paths (empty - dynamic registration via API)
paths: {}
```

---

## BƯỚC 4: Network Configuration

### Coolify tự động tạo Docker network

Coolify tự động connect các services trong cùng project vào chung 1 network.

**Service name:** `mediamtx` (tên bạn đặt ở Bước 1)

**Để verify:**
```bash
# SSH vào server
docker network ls
# Tìm network của project

docker network inspect NETWORK_NAME
# Sẽ thấy cả API container và mediamtx container
```

---

## BƯỚC 5: Deploy MediaMTX

1. Click **"Deploy"**
2. Đợi Coolify pull image và start container
3. Check logs: Tab **"Logs"** để xem MediaMTX đã start chưa

**Log thành công sẽ có:**
```
MediaMTX v1.x.x
listener opened on :8554 (TCP)
listener opened on :8888 (TCP)
listener opened on :8889 (TCP)
API listener opened on :9997
```

---

## BƯỚC 6: Verify MediaMTX đang chạy

### 6.1. Check trong Coolify

- Tab **"Status"** → Should show **"Running"**
- Tab **"Logs"** → Should show API listener opened

### 6.2. Test từ server

SSH vào server và chạy:

```bash
# 1. Check container đang chạy
docker ps | grep mediamtx

# 2. Test API từ bên ngoài
curl http://YOUR_SERVER_IP:9997/v3/config/global/get

# Expected output:
{
  "logLevel": "info",
  "api": true,
  ...
}

# 3. Test API từ bên trong Docker network
docker exec YOUR_API_CONTAINER curl http://mediamtx:9997/v3/config/global/get
# Phải trả về cùng JSON như trên
```

---

## BƯỚC 7: Update NestJS API Environment Variables

### Trong Coolify → NestJS API Service → Environment Variables

```bash
# THÊM HOẶC SỬA các biến sau:
MEDIAMTX_HOST=mediamtx
MEDIAMTX_API_URL=http://mediamtx:9997
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=false
```

**Click "Save" và "Redeploy" API service**

---

## BƯỚC 8: Test Integration

### 8.1. Call API để register camera

```bash
curl https://api.iotek.tn/streams/YOUR_CAMERA_ID/proxy
```

### 8.2. Check API logs

Trong Coolify → API Service → Logs, phải thấy:

```
[MediaMTX] Auto-registration triggered for camera_XXXXXXXX
[MediaMTX] API URL: http://mediamtx:9997
[MediaMTX] Registering camera_XXXXXXXX...
[MediaMTX] SUCCESS: Camera camera_XXXXXXXX auto-registered successfully
```

### 8.3. Verify stream

```bash
# Check registered cameras
curl http://YOUR_SERVER_IP:9997/v3/paths/list

# Test stream trong VLC
rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX
```

---

## TROUBLESHOOTING

### Lỗi: "Port already in use"

**Nguyên nhân:** Port 8554, 8888, hoặc 8889 đã được dùng

**Fix:**
1. Đổi Host Port sang port khác (ví dụ: 18554, 18888, 18889)
2. Update environment variables trong API service

### Lỗi: "Cannot connect to mediamtx:9997"

**Nguyên nhân:** Containers không cùng network

**Fix:**
```bash
# SSH vào server
docker network ls
docker network inspect NETWORK_NAME

# Check cả 2 containers có trong cùng network không
# Nếu không, thêm manually:
docker network connect NETWORK_NAME mediamtx
docker network connect NETWORK_NAME YOUR_API_CONTAINER
```

### Lỗi: "Config file not found"

**Nguyên nhân:** mediamtx.yml chưa được mount

**Fix:**
1. Vào Coolify → MediaMTX Service → Volumes
2. Add volume: `/path/to/mediamtx.yml:/mediamtx.yml`
3. Hoặc dùng Files tab để upload file
4. Redeploy service

### MediaMTX start nhưng API không hoạt động

**Nguyên nhân:** `api: no` trong mediamtx.yml

**Fix:**
1. Edit mediamtx.yml
2. Đổi `api: no` thành `api: yes`
3. Đổi `apiAddress: 127.0.0.1:9997` thành `apiAddress: 0.0.0.0:9997`
4. Redeploy MediaMTX service

---

## ALTERNATIVE: Deploy bằng Docker Compose (Nếu Coolify hỗ trợ)

Nếu Coolify cho phép deploy Docker Compose file:

### docker-compose.yml

```yaml
version: '3.8'

services:
  mediamtx:
    image: bluenviron/mediamtx:latest
    container_name: mediamtx
    restart: unless-stopped
    ports:
      - "8554:8554"  # RTSP
      - "8888:8888"  # HLS
      - "8889:8889"  # WebRTC
      - "9997:9997"  # API
    volumes:
      - ./mediamtx.yml:/mediamtx.yml:ro
    networks:
      - app-network

  api:
    # Your NestJS API config here
    depends_on:
      - mediamtx
    environment:
      MEDIAMTX_HOST: mediamtx
      MEDIAMTX_API_URL: http://mediamtx:9997
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

---

## QUICK CHECKLIST

- [ ] Tạo service từ Docker Image: `bluenviron/mediamtx:latest`
- [ ] Map ports: 8554, 8888, 8889, 9997
- [ ] Upload/mount mediamtx.yml với `api: yes`
- [ ] Deploy và check logs
- [ ] Update API environment variables: `MEDIAMTX_HOST=mediamtx`
- [ ] Redeploy API service
- [ ] Test: `curl http://mediamtx:9997/v3/config/global/get` từ API container
- [ ] Call API: `/streams/:id/proxy` để register camera
- [ ] Test stream: `rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX`

---

## SCREENSHOT GUIDE (Các bước trong Coolify UI)

### Step 1: Add New Resource
```
Dashboard → Project → + Add New Resource → Docker Image
```

### Step 2: Service Details
```
Name: mediamtx
Image: bluenviron/mediamtx:latest
```

### Step 3: Ports Tab
```
+ Add Port
Container Port: 8554 → Host Port: 8554
Container Port: 8888 → Host Port: 8888
Container Port: 8889 → Host Port: 8889
Container Port: 9997 → Host Port: 9997
```

### Step 4: Files/Volumes Tab
```
+ Add File/Volume
Path: /mediamtx.yml
Content: <paste mediamtx.yml content>
```

### Step 5: Deploy
```
Click "Deploy" button
Wait for "Running" status
Check logs
```

---

**Tổng thời gian setup: ~10 phút**

**Nếu gặp khó khăn, screenshot UI Coolify và hỏi lại!**

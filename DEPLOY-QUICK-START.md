# QUICK START - Deploy to Production

## TL;DR - Chỉ cần làm 3 bước

### BƯỚC 1: Deploy MediaMTX trên Coolify

```yaml
Service Name: mediamtx
Docker Image: bluenviron/mediamtx:latest
Ports: 8554, 8888, 8889, 9997
Volume: ./mediamtx.yml:/mediamtx.yml
```

### BƯỚC 2: Set Environment Variables cho NestJS API

```bash
MEDIAMTX_HOST=mediamtx
MEDIAMTX_API_URL=http://mediamtx:9997
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=false
```

### BƯỚC 3: Redeploy API service

```bash
git pull origin main
# Coolify tự động rebuild và deploy
```

---

## Giải thích ngắn gọn

### Tại sao dùng `mediamtx` thay vì `iotek.tn-cdn.net`?

**Local (đang chạy được):**
```
API → http://localhost:9997 → MediaMTX
```

**Production (đúng):**
```
API Container → http://mediamtx:9997 → MediaMTX Container
(Cùng Docker network, nhanh và bảo mật)
```

**Production (SAI - gây ETIMEDOUT):**
```
API Container → http://iotek.tn-cdn.net:9997 → Internet → Firewall → Server → MediaMTX
(Phải đi qua internet, chậm, timeout)
```

---

## Mapping: Local → Production

| Thành phần | Local | Production |
|-----------|-------|-----------|
| API → MediaMTX | `localhost:9997` | `mediamtx:9997` |
| Client → Stream | `localhost:8554` | `iotek.tn-cdn.net:8554` |
| Giao tiếp | Cùng máy | Docker network |

---

## Kiểm tra sau khi deploy

```bash
# 1. SSH vào server
ssh your-server

# 2. Check MediaMTX đang chạy
docker ps | grep mediamtx

# 3. Test API từ bên trong API container
docker exec YOUR_API_CONTAINER curl http://mediamtx:9997/v3/config/global/get
# Phải trả về JSON với "api": true

# 4. Call API để register camera
curl https://api.iotek.tn/streams/CAMERA_ID/proxy

# 5. Check logs
docker logs YOUR_API_CONTAINER --tail 50
# Phải thấy: [MediaMTX] SUCCESS: Camera registered

# 6. Test stream trong VLC
rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX
```

---

## Troubleshooting nhanh

| Lỗi | Nguyên nhân | Fix |
|-----|-----------|-----|
| ETIMEDOUT | Dùng external URL cho internal API | Đổi thành `http://mediamtx:9997` |
| ECONNREFUSED | MediaMTX chưa deploy | Deploy MediaMTX trước |
| Path not found | Camera chưa register | Check logs, xem lỗi gì |
| VLC không play | Firewall block port | Mở port 8554 |

---

## Environment Variables - COPY PASTE

```bash
# Database (Coolify tự động inject DATABASE_URL)
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=your_production_secret_change_me
JWT_EXPIRES_IN=7d

# Storage (giữ nguyên từ local)
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2

# MediaMTX - QUAN TRỌNG!
MEDIAMTX_HOST=mediamtx
MEDIAMTX_API_URL=http://mediamtx:9997
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=false
```

---

## URLs sau khi deploy thành công

**API Endpoint:**
```
GET https://api.iotek.tn/streams/{cameraId}/proxy
```

**Client Stream URLs:**
```
RTSP:   rtsp://iotek.tn-cdn.net:8554/camera_XXXXXXXX
HLS:    http://iotek.tn-cdn.net:8888/camera_XXXXXXXX/index.m3u8
WebRTC: http://iotek.tn-cdn.net:8889/camera_XXXXXXXX/whep
```

---

**Tổng thời gian deploy: ~5 phút** ⏱️

**Xem chi tiết:** [PRODUCTION-SETUP.md](./PRODUCTION-SETUP.md)

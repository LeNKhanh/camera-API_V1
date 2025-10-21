# ⚡ Quick Start: Production Deployment

## 🎯 TL;DR - Environment Variables cho Coolify

### ✅ Copy vào Coolify Environment Variables:

```bash
# Database (Coolify tự inject)
# DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-production-jwt-secret-2024
JWT_EXPIRES_IN=7d

# Storage
STORAGE_MODE=r2
R2_ENDPOINT=https://...r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net

# MediaMTX - Internal (API talks to MediaMTX)
MEDIAMTX_HOST=localhost
MEDIAMTX_API_URL=http://localhost:9997
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_USE_HTTPS=false

# MediaMTX - Public (Clients access streams)
MEDIAMTX_PUBLIC_HOST=stream.iotek.tn
MEDIAMTX_PUBLIC_RTSP_PORT=8554
MEDIAMTX_PUBLIC_HLS_PORT=8888
MEDIAMTX_PUBLIC_WEBRTC_PORT=8889
MEDIAMTX_PUBLIC_USE_HTTPS=true

# Server
PORT=3000
NODE_ENV=production
```

---

## 🔑 Key Points

### 1. Internal vs Public URLs

**Internal (MEDIAMTX_*)**: 
- Dùng cho NestJS API gọi MediaMTX API
- Luôn là `localhost` vì cùng container
- Không expose ra ngoài

**Public (MEDIAMTX_PUBLIC_*)**: 
- Dùng cho clients (browser, VLC, mobile app)
- Domain thật: `stream.iotek.tn`
- Expose ra internet

### 2. Ports

```
3000  → API (https://api.iotek.tn)
8554  → RTSP (rtsp://stream.iotek.tn:8554/...)
8888  → HLS (https://stream.iotek.tn:8888/.../index.m3u8)
8889  → WebRTC (https://stream.iotek.tn:8889/.../whep)
9997  → MediaMTX API (INTERNAL ONLY - không expose!)
```

### 3. Workflow

```
Client Request
  ↓
GET https://api.iotek.tn/streams/:id/proxy
  ↓
NestJS API
  ↓
Call http://localhost:9997/v3/config/paths/add/camera_XXXXXXXX
  ↓
MediaMTX registers camera
  ↓
Return public URL: https://stream.iotek.tn:8888/camera_XXXXXXXX/index.m3u8
  ↓
Client plays stream!
```

---

## 📋 Deployment Checklist

### Pre-deployment
- [ ] Update `.env.production.example` với values thật
- [ ] Commit code lên GitHub
- [ ] Verify `mediamtx.yml` có `api: yes`

### Coolify Setup
- [ ] Create new service
- [ ] Connect GitHub repo
- [ ] Add all environment variables
- [ ] Set domains: `api.iotek.tn`, `stream.iotek.tn`
- [ ] Map ports: 3000, 8554, 8888, 8889
- [ ] Enable SSL (Let's Encrypt)

### Post-deployment
- [ ] Test API: `curl https://api.iotek.tn/health`
- [ ] Test proxy endpoint: `GET /streams/:id/proxy`
- [ ] Test stream in VLC
- [ ] Check MediaMTX logs
- [ ] Verify camera auto-registration

---

## 🧪 Quick Test

```bash
# 1. Login
curl -X POST https://api.iotek.tn/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Get proxy URL
curl https://api.iotek.tn/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy \
  -H "Authorization: Bearer TOKEN"

# Response should have:
{
  "protocols": {
    "rtsp": "rtsps://stream.iotek.tn:8554/camera_49e77c80",
    "hls": "https://stream.iotek.tn:8888/camera_49e77c80/index.m3u8",
    "webrtc": "https://stream.iotek.tn:8889/camera_49e77c80/whep"
  },
  "security": {
    "autoRegistered": true,  // ← Camera tự động register!
    "cameraIpHidden": true   // ← IP camera bị ẩn!
  }
}

# 3. Test stream
vlc rtsps://stream.iotek.tn:8554/camera_49e77c80
```

---

## ❓ FAQ

### Q: Tại sao cần 2 sets of variables (MEDIAMTX_* và MEDIAMTX_PUBLIC_*)?

**A:** 
- **MEDIAMTX_***: Internal communication (API ↔ MediaMTX) dùng `localhost`
- **MEDIAMTX_PUBLIC_***: Client URLs dùng domain thật `stream.iotek.tn`

### Q: Port 9997 có cần expose không?

**A:** KHÔNG! Port 9997 chỉ dùng internal, không expose ra ngoài vì lý do bảo mật.

### Q: Làm sao biết camera đã auto-register?

**A:** Check response có `"autoRegistered": true` và check MediaMTX logs:
```
[MediaMTX] ✅ Camera camera_49e77c80 auto-registered successfully
```

### Q: Có cần restart MediaMTX khi add camera mới không?

**A:** KHÔNG! Cameras tự động register qua API, không cần restart!

### Q: 100 cameras thì sao?

**A:** Tất cả auto-register khi clients request! Không cần config thủ công! 🚀

---

## 📚 More Info

- **Full Guide**: `docs/PRODUCTION-DEPLOYMENT.md`
- **Troubleshooting**: `docs/PRODUCTION-DEPLOYMENT.md#troubleshooting`
- **Performance Tuning**: `docs/PRODUCTION-DEPLOYMENT.md#performance-tuning`

---

**Ready to deploy?** 🚀

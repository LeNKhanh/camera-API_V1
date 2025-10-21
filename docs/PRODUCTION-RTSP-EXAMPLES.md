# 🌐 Production RTSP URLs - Real World Examples

## So sánh URL giữa Development và Production

---

## 📍 Scenario: Camera API deployed tại `api.iotek.tn`

### Architecture Overview

```
Internet (Public)
    ↓
[api.iotek.tn] - NestJS API (Port 3000)
[stream.iotek.tn] - MediaMTX Proxy
    ↓
[Private Network 192.168.1.0/24]
    ↓
[Camera 192.168.1.66] - Dahua PTZ
[Camera 192.168.1.67] - Hikvision
[Camera 192.168.1.68] - Generic RTSP
```

---

## 🔴 TRƯỚC KHI DÙNG PROXY (Không an toàn)

### API Endpoint
```http
GET https://api.iotek.tn/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/rtsp
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Response
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "rtspUrl": "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "instructions": {
    "vlc": [
      "Open VLC and paste the RTSP URL above"
    ]
  }
}
```

### ⚠️ Problems:
- ❌ Exposes camera IP: `192.168.1.66`
- ❌ Exposes username: `aidev`
- ❌ Exposes password: `aidev123`
- ❌ Anyone with token can access camera directly
- ❌ No rate limiting on camera
- ❌ Câu query string lộ camera model: `/cam/realmonitor` = Dahua

**VLC Users see:**
```
rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
```

---

## ✅ SAU KHI DÙNG MEDIAMTX PROXY (An toàn)

### API Endpoint (New)
```http
GET https://api.iotek.tn/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Response
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "protocols": {
    "rtsp": "rtsp://stream.iotek.tn:8554/camera_49e77c80",
    "hls": "https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8",
    "webrtc": "https://stream.iotek.tn/webrtc/camera_49e77c80/whep"
  },
  "instructions": {
    "vlc": [
      "1. Open VLC Media Player",
      "2. Go to: Media → Open Network Stream (Ctrl+N)",
      "3. Paste: rtsp://stream.iotek.tn:8554/camera_49e77c80",
      "4. Click Play"
    ],
    "browser": [
      "1. Open: https://stream.iotek.tn/player.html?camera=49e77c80",
      "2. Or use HLS URL in your own player"
    ]
  },
  "security": {
    "cameraIpHidden": true,
    "credentialsProtected": true,
    "proxyAuthentication": true,
    "rateLimit": "10 requests/second per IP"
  },
  "note": "Camera IP is completely hidden. All access through secure proxy."
}
```

### ✅ Benefits:
- ✅ Camera IP hidden: User chỉ thấy `stream.iotek.tn`
- ✅ Credentials protected: Không lộ username/password
- ✅ Generic path: `/camera_49e77c80` không lộ model
- ✅ Rate limiting: MediaMTX kiểm soát access
- ✅ Multiple protocols: RTSP, HLS, WebRTC
- ✅ SSL/TLS: HTTPS cho HLS và WebRTC

**VLC Users see:**
```
rtsp://stream.iotek.tn:8554/camera_49e77c80
```

**Browser Users see:**
```
https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8
```

---

## 🎯 Real-World Production Examples

### Example 1: Office Security System

**Company:** ABC Corp  
**Domain:** security.abccorp.com  
**Cameras:** 20 cameras across 3 buildings

#### API Call:
```http
GET https://api.abccorp.com/streams/office-lobby-01/proxy
Authorization: Bearer <token>
```

#### Response:
```json
{
  "cameraId": "office-lobby-01",
  "cameraName": "Main Lobby Camera",
  "protocols": {
    "rtsp": "rtsp://stream.abccorp.com:8554/camera_office_lobby_01",
    "hls": "https://stream.abccorp.com/hls/camera_office_lobby_01/index.m3u8",
    "webrtc": "https://stream.abccorp.com/webrtc/camera_office_lobby_01/whep"
  }
}
```

#### Users Access:
- **Security Team (VLC):** `rtsp://stream.abccorp.com:8554/camera_office_lobby_01`
- **Web Dashboard:** `https://security.abccorp.com/dashboard` (uses HLS)
- **Mobile App:** WebRTC for ultra-low latency

---

### Example 2: Smart Home System

**Company:** SmartHome.vn  
**Domain:** camera.smarthome.vn  
**Cameras:** Customer's home cameras (multi-tenant)

#### API Call:
```http
GET https://api.smarthome.vn/streams/customer123-living-room/proxy
Authorization: Bearer <customer_token>
```

#### Response:
```json
{
  "cameraId": "customer123-living-room",
  "cameraName": "Living Room Camera",
  "protocols": {
    "rtsp": "rtsp://viewer:temp_token_abc123@stream.smarthome.vn:8554/customer123_living",
    "hls": "https://stream.smarthome.vn/hls/customer123_living/index.m3u8?token=abc123",
    "webrtc": "https://stream.smarthome.vn/webrtc/customer123_living/whep?token=abc123"
  },
  "security": {
    "tokenExpiry": "2025-10-20T16:00:00Z",
    "note": "Temporary token expires in 1 hour"
  }
}
```

#### Features:
- ✅ Customer-specific tokens
- ✅ Auto-expiring credentials
- ✅ Multi-tenant isolation
- ✅ Per-customer rate limiting

---

### Example 3: Your IoTek System

**Current Setup:**
- API Domain: `api.iotek.tn`
- Stream Domain: `stream.iotek.tn` (or reuse subdomain)
- CDN Domain: `iotek.tn-cdn.net` (already for R2)

#### Production API Call:
```http
GET https://api.iotek.tn/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Production Response:
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "protocols": {
    "rtsp": "rtsp://stream.iotek.tn:8554/camera_49e77c80",
    "hls": "https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8",
    "webrtc": "https://stream.iotek.tn/webrtc/camera_49e77c80/whep"
  },
  "instructions": {
    "vlc": [
      "1. Open VLC Media Player",
      "2. Ctrl+N (Open Network Stream)",
      "3. Paste: rtsp://stream.iotek.tn:8554/camera_49e77c80",
      "4. Play"
    ],
    "browser": [
      "1. Visit: https://iotek.tn/camera/49e77c80",
      "2. Or embed HLS URL in your app"
    ]
  },
  "security": {
    "cameraIpHidden": true,
    "credentialsProtected": true,
    "encryption": "TLS 1.3 (HLS/WebRTC)",
    "rateLimit": "5 concurrent streams per user"
  }
}
```

#### What Users See in VLC:
```
rtsp://stream.iotek.tn:8554/camera_49e77c80
```

#### What Users See in Browser Console:
```javascript
// HLS Player
const video = new Hls();
video.loadSource('https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8');
video.attachMedia(videoElement);
```

#### What Hackers See (If They Intercept):
```
Proxy URL: stream.iotek.tn:8554
Path: /camera_49e77c80
Result: NO camera IP, NO credentials, NO direct access 🔒
```

---

## 🔐 Advanced: Authentication in Production

### Option A: No Auth (Internal Network Only)

```yaml
# mediamtx.yml
authMethod: ""

paths:
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/...
```

**URL:**
```
rtsp://stream.iotek.tn:8554/camera_49e77c80
```

✅ Simple  
❌ Anyone with URL can watch

---

### Option B: Basic Auth (Simple Password)

```yaml
# mediamtx.yml
authMethod: internal

paths:
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/...
    readUser: viewer
    readPass: secure_pass_2025
```

**URL:**
```
rtsp://viewer:secure_pass_2025@stream.iotek.tn:8554/camera_49e77c80
```

✅ Simple authentication  
⚠️ Password in URL (still visible to users)

---

### Option C: JWT Token (Best for Production)

```yaml
# mediamtx.yml
authMethod: jwt
authJWTJWKS: https://api.iotek.tn/.well-known/jwks.json

paths:
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/...
```

#### API generates temporary token:
```typescript
// stream.service.ts
async getProxyUrl(cameraId: string, userId: string) {
  // Generate JWT token (expires in 1 hour)
  const token = jwt.sign(
    {
      sub: userId,
      camera: cameraId,
      permissions: ['read'],
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
    process.env.JWT_SECRET
  );

  return {
    protocols: {
      rtsp: `rtsp://jwt:${token}@stream.iotek.tn:8554/camera_${cameraId.substring(0, 8)}`,
      hls: `https://stream.iotek.tn/hls/camera_${cameraId.substring(0, 8)}/index.m3u8?token=${token}`,
    },
    tokenExpiry: new Date(Date.now() + 3600000).toISOString(),
  };
}
```

**URL:**
```
rtsp://jwt:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiY2FtZXJhIjoiNDllNzdjODAiLCJleHAiOjE3Mjk1MTAwMDB9.xxx@stream.iotek.tn:8554/camera_49e77c80
```

✅ Secure: Token expires automatically  
✅ Auditable: Know who watched what  
✅ Revokable: Blacklist tokens if needed  
✅ Per-user: Each user gets unique token

---

## 📱 Frontend Integration Examples

### VLC Player (Desktop App)

```typescript
// User clicks "Watch with VLC"
const response = await fetch('https://api.iotek.tn/streams/49e77c80.../proxy', {
  headers: { Authorization: `Bearer ${userToken}` }
});

const data = await response.json();

// Copy to clipboard
navigator.clipboard.writeText(data.protocols.rtsp);

alert('RTSP URL copied! Paste in VLC: Media → Open Network Stream');
// User pastes: rtsp://stream.iotek.tn:8554/camera_49e77c80
```

---

### HTML5 Player (Browser)

```html
<!-- Camera Dashboard -->
<video id="camera-player" controls width="100%"></video>

<script>
// Fetch HLS URL from API
fetch('https://api.iotek.tn/streams/49e77c80.../proxy', {
  headers: { Authorization: `Bearer ${userToken}` }
})
.then(r => r.json())
.then(data => {
  const hlsUrl = data.protocols.hls;
  // hlsUrl = "https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8"
  
  const video = document.getElementById('camera-player');
  
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
  } else {
    video.src = hlsUrl;
  }
  
  video.play();
});
</script>
```

**User never sees camera IP!** 🎉

---

### React Component

```tsx
// CameraPlayer.tsx
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export const CameraPlayer = ({ cameraId, token }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const fetchStream = async () => {
      // Get proxy URL from API
      const res = await fetch(
        `https://api.iotek.tn/streams/${cameraId}/proxy`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const data = await res.json();
      const hlsUrl = data.protocols.hls;
      // hlsUrl = "https://stream.iotek.tn/hls/camera_xxx/index.m3u8"
      
      // Play HLS
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current!);
    };
    
    fetchStream();
  }, [cameraId]);
  
  return (
    <div>
      <h2>Camera: {cameraId}</h2>
      <video ref={videoRef} controls width="100%" />
      <p>Streaming from: stream.iotek.tn (IP hidden)</p>
    </div>
  );
};
```

---

## 🌍 DNS Configuration

### Setup Subdomain for Streaming

```dns
# DNS Records (Cloudflare or your provider)

Type    Name            Content                 TTL
----    ----            -------                 ---
A       stream          45.77.xxx.xxx           Auto
CNAME   stream          api.iotek.tn            Auto
AAAA    stream          2001:19f0:xxxx          Auto
```

**After DNS propagation:**
- `stream.iotek.tn` → Points to your MediaMTX server
- Users access: `rtsp://stream.iotek.tn:8554/camera_xxx`
- HLS: `https://stream.iotek.tn/hls/camera_xxx/index.m3u8`

---

## 📊 Comparison Table

| Aspect | Without Proxy | With MediaMTX Proxy |
|--------|---------------|---------------------|
| **Camera IP** | ❌ `192.168.1.66` visible | ✅ Hidden behind `stream.iotek.tn` |
| **Credentials** | ❌ `aidev:aidev123` in URL | ✅ Protected by proxy auth |
| **URL Example** | `rtsp://user:pass@192.168.1.66:554/...` | `rtsp://stream.iotek.tn:8554/camera_xxx` |
| **Security** | ❌ Direct camera access | ✅ Access controlled by proxy |
| **Protocols** | ❌ RTSP only | ✅ RTSP + HLS + WebRTC |
| **Browser Support** | ❌ VLC/FFmpeg only | ✅ HTML5 video player works |
| **Rate Limiting** | ❌ Camera can be overloaded | ✅ Proxy limits connections |
| **Audit Trail** | ❌ No logs | ✅ MediaMTX logs all access |
| **SSL/TLS** | ❌ No encryption | ✅ HTTPS for HLS/WebRTC |
| **Latency** | ⚡ Direct (low) | ⚡ +0.5-1s (still low) |

---

## 🎬 User Experience Flow

### Scenario: Customer wants to watch camera

#### Step 1: Login to App
```http
POST https://api.iotek.tn/auth/login
{
  "username": "customer@email.com",
  "password": "***"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user-123"
}
```

#### Step 2: Get Camera List
```http
GET https://api.iotek.tn/cameras
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response:
[
  {
    "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
    "name": "Main Entrance",
    "status": "online"
  },
  ...
]
```

#### Step 3: Get Stream URL
```http
GET https://api.iotek.tn/streams/49e77c80.../proxy
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response:
{
  "protocols": {
    "rtsp": "rtsp://stream.iotek.tn:8554/camera_49e77c80",
    "hls": "https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8"
  }
}
```

#### Step 4: Watch Stream
**Option A - VLC:**
```
User copies RTSP URL → Opens VLC → Pastes URL → Plays
User sees: rtsp://stream.iotek.tn:8554/camera_49e77c80
```

**Option B - Browser:**
```javascript
// App loads HLS in video player
videoPlayer.src = "https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8";
videoPlayer.play();
```

**🔒 Camera IP NEVER exposed to user!**

---

## ✅ Summary

### Production URL Structure

```
❌ OLD (Unsafe):
rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
      └─username─┘ └─password─┘ └─IP─┘ └─reveals camera model─┘

✅ NEW (Safe):
rtsp://stream.iotek.tn:8554/camera_49e77c80
      └─public domain─┘ └─generic path─┘
      
OR with auth:
rtsp://viewer:token@stream.iotek.tn:8554/camera_49e77c80
      └─proxy credentials (temporary)─┘
```

### What Hackers CAN'T See:
- ❌ Camera IP address
- ❌ Camera username/password
- ❌ Camera brand/model
- ❌ Network topology
- ❌ Direct camera access

### What Hackers CAN See:
- ✅ Public domain: `stream.iotek.tn` (OK, it's meant to be public)
- ✅ Generic path: `/camera_49e77c80` (no useful info)
- ✅ Proxy server (but it has rate limiting & auth)

**Result: Camera infrastructure is completely hidden! 🎉**

---

## 📝 Next Steps

1. ✅ Read this document to understand production URLs
2. 📋 Follow `MEDIAMTX-QUICK-START.md` to setup proxy
3. 📋 Test locally first
4. 📋 Deploy to production with proper domain
5. 📋 Update frontend to use `/proxy` endpoint
6. 📋 Add authentication if needed
7. 📋 Monitor and optimize

---

**Need help implementing?** Ask me! 🚀

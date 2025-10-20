# Test RTSP Stream - Quick Guide

## 🎯 Mục đích

Test xem RTSP stream từ camera thật có hoạt động không bằng VLC Media Player.

## 🚀 Quick Test

### Cách 1: Dùng PowerShell Script (Recommended)

```powershell
# Test với camera mặc định
.\scripts\test-stream-vlc.ps1

# Test với camera ID cụ thể
.\scripts\test-stream-vlc.ps1 -CameraId "49e77c80-af6e-4ac6-b0ea-b4f018dacac7"
```

Script sẽ tự động:
1. ✅ Login và get JWT token
2. ✅ Lấy RTSP URL từ API
3. ✅ Tìm VLC trên máy
4. ✅ Mở stream trong VLC

---

### Cách 2: Manual Test với API

#### Step 1: Login
```bash
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Step 2: Get RTSP URL
```bash
GET http://localhost:3000/streams/{cameraId}/rtsp
Authorization: Bearer YOUR_JWT_TOKEN
```

**Example:**
```bash
GET http://localhost:3000/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/rtsp
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "rtspUrl": "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "instructions": {
    "vlc": [
      "1. Open VLC Media Player",
      "2. Go to: Media → Open Network Stream (Ctrl+N)",
      "3. Paste RTSP URL below",
      "4. Click Play"
    ],
    "ffplay": [
      "1. Open terminal/command prompt",
      "2. Run: ffplay -rtsp_transport tcp \"rtsp://...\""
    ]
  },
  "note": "Copy RTSP URL để paste vào VLC hoặc FFplay"
}
```

#### Step 3: Open in VLC
1. Open **VLC Media Player**
2. Press **Ctrl+N** (Open Network Stream)
3. Paste RTSP URL:
   ```
   rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
   ```
4. Click **Play**

---

### Cách 3: Test với FFplay (Command Line)

```bash
# Basic
ffplay -rtsp_transport tcp "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0"

# With low latency options
ffplay -rtsp_transport tcp -fflags nobuffer -flags low_delay "rtsp://..."

# With debug info
ffplay -rtsp_transport tcp -loglevel debug "rtsp://..."
```

---

## 📋 API Endpoint

### GET /streams/:cameraId/rtsp

**Description:** Lấy RTSP URL trực tiếp từ camera để test với VLC/FFplay

**Authentication:** JWT Bearer Token (required)

**Authorization:** ADMIN, OPERATOR, VIEWER

**Path Parameters:**
- `cameraId` (string, required) - Camera UUID

**Response:**
```typescript
{
  cameraId: string;
  cameraName: string;
  rtspUrl: string;
  instructions: {
    vlc: string[];
    ffplay: string[];
  };
  note: string;
}
```

**Example Request:**
```bash
GET http://localhost:3000/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/rtsp
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example Response:**
```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "rtspUrl": "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "instructions": {
    "vlc": [
      "1. Open VLC Media Player",
      "2. Go to: Media → Open Network Stream (Ctrl+N)",
      "3. Paste RTSP URL below",
      "4. Click Play"
    ],
    "ffplay": [
      "1. Open terminal/command prompt",
      "2. Run: ffplay -rtsp_transport tcp \"rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0\""
    ]
  },
  "note": "Copy RTSP URL để paste vào VLC hoặc FFplay"
}
```

---

## 🔧 RTSP URL Format

### Dahua Camera (Default):
```
rtsp://{username}:{password}@{ip}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}
```

**Parameters:**
- `username` - Camera username (default: admin)
- `password` - Camera password
- `ip` - Camera IP address
- `port` - RTSP port (default: 554)
- `channel` - Camera channel number (default: 1)
- `subtype` - Stream quality:
  - `0` = Main stream (high quality)
  - `1` = Sub stream (low quality, faster)

**Example:**
```
rtsp://admin:admin123@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
```

### Custom RTSP URL:
Nếu camera có custom RTSP URL trong database, API sẽ trả về URL đó thay vì build URL.

---

## 🧪 Testing Checklist

- [ ] ✅ API endpoint `/streams/:cameraId/rtsp` working
- [ ] ✅ RTSP URL trả về đúng format
- [ ] ✅ VLC có thể play stream
- [ ] ✅ FFplay có thể play stream
- [ ] ✅ Video chất lượng tốt (main stream)
- [ ] ✅ Latency chấp nhận được (<5s)
- [ ] ✅ Không có buffering issues

---

## 🐛 Troubleshooting

### Issue 1: VLC không connect được

**Symptom:** VLC shows "Your input can't be opened"

**Solutions:**
1. Check camera IP có ping được không:
   ```bash
   ping 192.168.1.66
   ```

2. Check RTSP port (554) có open không:
   ```bash
   telnet 192.168.1.66 554
   ```

3. Verify username/password đúng

4. Try substream thay vì mainstream:
   ```
   # Change subtype=0 to subtype=1
   rtsp://...?channel=2&subtype=1
   ```

### Issue 2: Stream buffering/lagging

**Solutions:**
1. Use substream (subtype=1) thay vì mainstream
2. Check network bandwidth
3. Try VLC's low latency settings:
   - Tools → Preferences → Input/Codecs
   - Network Caching: 300ms (thay vì 1000ms)

### Issue 3: Camera not found (404)

**Solution:**
```bash
# List all cameras
GET http://localhost:3000/cameras
Authorization: Bearer YOUR_JWT_TOKEN
```

Check camera ID và copy đúng UUID.

### Issue 4: Authentication required (401)

**Solution:**
Login lại và lấy JWT token mới:
```bash
POST http://localhost:3000/auth/login
```

---

## 📊 Performance Tips

### VLC Settings for Low Latency:
1. Tools → Preferences
2. Input/Codecs
3. Network Caching: **300ms** (default 1000ms)
4. File Caching: **300ms**
5. Save and restart VLC

### FFplay Low Latency:
```bash
ffplay -rtsp_transport tcp \
  -fflags nobuffer \
  -flags low_delay \
  -framedrop \
  "rtsp://..."
```

### Camera Settings:
- Use **subtype=1** (substream) for faster response
- Reduce bitrate trong camera settings
- Enable CBR (Constant Bitrate) thay vì VBR

---

## 🎯 Use Cases

### 1. Quick Preview
- Test camera có hoạt động không
- Check image quality
- Verify camera credentials

### 2. Debug Recording Issues
- Compare VLC stream vs API recording
- Check if RTSP URL đúng
- Verify network connectivity

### 3. Live Monitoring
- Multiple VLC windows cho multiple cameras
- Low latency live view
- Alternative to web-based streaming

---

## 📝 Files Added

- ✅ `src/modules/stream/stream.controller.ts` - Added `/rtsp` endpoint
- ✅ `src/modules/stream/stream.service.ts` - Added `getRtspUrl()` method
- ✅ `scripts/test-stream-vlc.ps1` - Automated test script
- ✅ `docs/TEST-STREAM-VLC.md` - This guide

---

## 🚀 Next Steps

1. **Test script:**
   ```powershell
   .\scripts\test-stream-vlc.ps1
   ```

2. **Manual VLC test:**
   - Copy RTSP URL từ API response
   - Paste vào VLC (Ctrl+N)

3. **Verify all cameras:**
   - Test từng camera một
   - Check main stream vs sub stream
   - Compare latency

4. **Production:**
   - Deploy API với endpoint mới
   - Update frontend to show RTSP URLs
   - Document for end users

---

**Created:** October 20, 2025  
**Status:** ✅ Ready for testing

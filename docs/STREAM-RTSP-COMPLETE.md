# ✅ Stream RTSP URL Feature - COMPLETE

## 🎉 Hoàn Tất

Đã thêm endpoint mới để lấy RTSP URL trực tiếp từ camera để test với VLC Media Player!

---

## 📋 Feature Summary

### New API Endpoint

**`GET /streams/:cameraId/rtsp`**

Lấy RTSP URL trực tiếp từ camera để test với VLC hoặc FFplay.

**Authentication:** JWT Bearer Token  
**Authorization:** ADMIN, OPERATOR, VIEWER

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

---

## 🚀 Testing

### Cách 1: PowerShell Script (Auto-launch VLC)

```powershell
# Test với camera mặc định
.\scripts\test-stream-vlc.ps1

# Test với camera cụ thể
.\scripts\test-stream-vlc.ps1 -CameraId "your-camera-id"
```

Script tự động:
- ✅ Login và get JWT token
- ✅ Call API `/streams/:cameraId/rtsp`
- ✅ Hiển thị RTSP URL
- ✅ Tìm VLC trên máy
- ✅ Mở stream trong VLC

### Cách 2: Manual Test

1. **Login:**
   ```bash
   POST http://localhost:3000/auth/login
   { "username": "admin", "password": "admin123" }
   ```

2. **Get RTSP URL:**
   ```bash
   GET http://localhost:3000/streams/{cameraId}/rtsp
   Authorization: Bearer YOUR_TOKEN
   ```

3. **Open in VLC:**
   - Press Ctrl+N
   - Paste RTSP URL
   - Click Play

---

## 📁 Files Added/Modified

### Modified:
1. **`src/modules/stream/stream.controller.ts`**
   - Added `/rtsp` endpoint
   - Maps to `getRtspUrl()` method

2. **`src/modules/stream/stream.service.ts`**
   - Added `getRtspUrl()` method
   - Builds RTSP URL from camera config
   - Supports both custom URL and auto-generated URL

### Created:
3. **`scripts/test-stream-vlc.ps1`**
   - Automated test script
   - Auto-launch VLC với RTSP URL
   - Includes error handling and instructions

4. **`docs/TEST-STREAM-VLC.md`**
   - Complete guide for testing
   - VLC setup instructions
   - Troubleshooting tips

5. **`test-rtsp-quick.ps1`**
   - Quick API test without VLC
   - Shows RTSP URL in terminal

---

## 🔧 RTSP URL Format

### Dahua Camera (Auto-generated):
```
rtsp://{username}:{password}@{ip}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}
```

**Parameters:**
- `username` - Camera username (from DB)
- `password` - Camera password (from DB)
- `ip` - Camera IP address
- `port` - RTSP port (default: 554)
- `channel` - Camera channel (from DB)
- `subtype`:
  - `0` = Main stream (high quality)
  - `1` = Sub stream (low quality, faster)

**Example:**
```
rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
```

### Custom URL:
Nếu camera có `rtspUrl` trong database, API sẽ trả về URL đó.

---

## 🎯 Use Cases

### 1. Quick Camera Test
- Verify camera online
- Check video quality
- Test credentials

### 2. Debug Recording Issues
- Compare VLC vs API recording
- Verify RTSP URL correct
- Check network connectivity

### 3. Live Monitoring
- Low latency live view
- Multiple cameras in VLC
- Alternative to web streaming

---

## 📊 Benefits

✅ **Easy Testing** - One API call to get RTSP URL  
✅ **VLC Support** - Direct integration with VLC  
✅ **Auto-detection** - Finds VLC installation automatically  
✅ **Instructions Included** - API response has step-by-step guide  
✅ **Flexible** - Supports custom RTSP URLs  
✅ **Secure** - JWT authentication required  

---

## 🐛 Troubleshooting

### VLC không connect được:
1. Check camera IP: `ping 192.168.1.66`
2. Check RTSP port: `telnet 192.168.1.66 554`
3. Verify credentials đúng
4. Try substream: change `subtype=0` to `subtype=1`

### Stream buffering/lagging:
1. Use substream (`subtype=1`)
2. Check network bandwidth
3. Reduce VLC cache: 300ms

### Camera not found:
- List cameras: `GET /cameras`
- Copy correct UUID

---

## 🎓 Documentation

- **Quick Guide**: `docs/TEST-STREAM-VLC.md`
- **Test Script**: `scripts/test-stream-vlc.ps1`
- **API Docs**: http://localhost:3000/docs

---

## ✨ Next Steps

- [ ] Test với tất cả cameras
- [ ] Verify main stream vs sub stream
- [ ] Compare latency
- [ ] Update frontend to show RTSP URLs
- [ ] Document for end users

---

**Date:** October 20, 2025  
**Status:** ✅ Ready for testing  
**Endpoint:** `GET /streams/:cameraId/rtsp`

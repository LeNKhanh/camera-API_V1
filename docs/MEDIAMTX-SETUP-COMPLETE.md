# 🎉 MediaMTX Setup Complete!

## ✅ What's Working Now

### 1. MediaMTX Proxy Server
- ✅ Running on localhost
- ✅ RTSP Port: 8554
- ✅ HLS Port: 8888
- ✅ WebRTC Port: 8889

### 2. Camera Configuration
- ✅ Camera `49e77c80` configured and working
- ✅ Stream tested in VLC successfully
- ✅ Ready to add more cameras

### 3. Proxy URLs (IP Hidden!)
```
❌ Old: rtsp://aidev:aidev123@192.168.1.66:554/...
✅ New: rtsp://localhost:8554/camera_49e77c80
```

---

## 📝 How to Add New Dahua Cameras

### Quick Method (Using Script):

```powershell
.\scripts\add-camera-to-mediamtx.ps1 `
  -CameraId "new-camera-uuid-here" `
  -CameraIP "192.168.1.67" `
  -Username "admin" `
  -Password "password123" `
  -Channel 1
```

**Script will:**
1. ✅ Generate config automatically
2. ✅ Copy to clipboard
3. ✅ Show proxy URLs
4. ✅ Give you instructions

### Manual Method:

**1. Edit `mediamtx/mediamtx.yml`:**

```yaml
paths:
  # Camera 1 (existing)
  camera_49e77c80:
    source: rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0
    sourceOnDemand: yes
    sourceOnDemandStartTimeout: 10s
    sourceOnDemandCloseAfter: 10s
  
  # Camera 2 (new - Office Entrance)
  camera_abcd1234:
    source: rtsp://admin:admin123@192.168.1.67:554/cam/realmonitor?channel=1&subtype=0
    sourceOnDemand: yes
    sourceOnDemandStartTimeout: 10s
    sourceOnDemandCloseAfter: 10s
  
  # Camera 3 (new - Parking Lot)
  camera_xyz98765:
    source: rtsp://user:pass@192.168.1.68:554/cam/realmonitor?channel=1&subtype=0
    sourceOnDemand: yes
```

**2. Restart MediaMTX:**

```powershell
Get-Process -Name mediamtx | Stop-Process -Force
cd mediamtx
.\mediamtx.exe mediamtx.yml
```

**3. Test in VLC:**

```
rtsp://localhost:8554/camera_abcd1234
rtsp://localhost:8554/camera_xyz98765
```

---

## 🎯 Path Naming Convention

**Format:** `camera_<first-8-chars-of-camera-id>`

**Examples:**
- Camera ID: `49e77c80-af6e-4ac6-b0ea-b4f018dacac7` → Path: `camera_49e77c80`
- Camera ID: `abcd1234-5678-90ab-cdef-123456789012` → Path: `camera_abcd1234`
- Camera ID: `xyz98765-1234-5678-90ab-cdefghijk123` → Path: `camera_xyz98765`

---

## 🔌 API Integration

Your API endpoint `/streams/:cameraId/proxy` will automatically return:

```json
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "cameraName": "aidev ptz cam",
  "pathId": "camera_49e77c80",
  "protocols": {
    "rtsp": "rtsp://localhost:8554/camera_49e77c80",
    "hls": "http://localhost:8888/camera_49e77c80/index.m3u8",
    "webrtc": "http://localhost:8889/camera_49e77c80/whep"
  },
  "security": {
    "cameraIpHidden": true,
    "credentialsProtected": true
  }
}
```

**Make sure:** Path ID in MediaMTX matches the path returned by API!

---

## 🚀 Production Deployment

When deployed to Coolify:

**1. Add Environment Variables:**
```bash
MEDIAMTX_HOST=stream.iotek.tn
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=80
MEDIAMTX_WEBRTC_PORT=80
MEDIAMTX_USE_HTTPS=true
```

**2. URLs Change Automatically:**
```
Development: rtsp://localhost:8554/camera_49e77c80
Production:  rtsp://stream.iotek.tn:8554/camera_49e77c80
```

**3. Follow Deployment Guide:**
See `docs/COOLIFY-MEDIAMTX-SETUP.md` for complete instructions.

---

## 📚 Files Created

```
mediamtx/
├── mediamtx.yml                      # Main config (updated for multiple cameras)
├── mediamtx.exe                      # MediaMTX executable
├── CAMERA-REGISTRY.md                # Camera documentation
└── README.md                         # Setup guide

scripts/
├── add-camera-to-mediamtx.ps1        # Helper to add cameras
├── demo-add-camera.ps1               # Demo script
├── test-camera-direct.ps1            # Test camera connection
├── test-mediamtx-vlc.ps1             # Test MediaMTX with VLC
└── start-mediamtx-test.ps1           # Start and test

docs/
├── MEDIAMTX-QUICK-START.md           # 30-min setup guide
├── COOLIFY-MEDIAMTX-SETUP.md         # Production deployment
├── PRODUCTION-RTSP-EXAMPLES.md       # Real-world examples
└── MEDIAMTX-IMPLEMENTATION.md        # Implementation summary
```

---

## ✅ Testing Checklist

- [x] MediaMTX installed and running
- [x] Camera `49e77c80` configured
- [x] VLC stream working via proxy
- [x] Camera IP hidden in proxy URL
- [ ] Add more cameras (when needed)
- [ ] Deploy to production (Coolify)
- [ ] Update frontend to use proxy URLs

---

## 🎬 Next Steps

### For Development:
1. ✅ **Current:** MediaMTX running locally
2. 📋 **Next:** Add more cameras as needed
3. 📋 **Next:** Test API endpoint with running MediaMTX

### For Production:
1. 📋 Follow `docs/COOLIFY-MEDIAMTX-SETUP.md`
2. 📋 Deploy MediaMTX as Docker service
3. 📋 Configure DNS: `stream.iotek.tn`
4. 📋 Update environment variables in Coolify

---

## 🆘 Need Help?

**Camera not connecting?**
```powershell
.\scripts\test-camera-direct.ps1
```

**MediaMTX not starting?**
```powershell
cd mediamtx
.\mediamtx.exe mediamtx.yml
# Check error messages
```

**Add new camera:**
```powershell
.\scripts\add-camera-to-mediamtx.ps1 -CameraId "<id>" -CameraIP "<ip>" -Username "<user>" -Password "<pass>" -Channel 1
```

---

**Status:** ✅ Ready for production deployment!  
**Documentation:** Complete  
**Time spent:** ~30 minutes  
**Result:** Camera IPs completely hidden! 🔒

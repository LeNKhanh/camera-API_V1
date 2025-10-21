# MediaMTX Camera Registry
# Quick reference for all cameras configured in MediaMTX

## Camera List

### Camera 1: aidev ptz cam
- **Camera ID:** `49e77c80-af6e-4ac6-b0ea-b4f018dacac7`
- **Path ID:** `camera_49e77c80`
- **IP:** `192.168.1.66`
- **Channel:** `2`
- **Status:** ✅ Active

**Proxy URLs:**
```
RTSP:   rtsp://localhost:8554/camera_49e77c80
HLS:    http://localhost:8888/camera_49e77c80/index.m3u8
WebRTC: http://localhost:8889/camera_49e77c80/whep
```

**Production URLs:**
```
RTSP:   rtsp://stream.iotek.tn:8554/camera_49e77c80
HLS:    https://stream.iotek.tn/hls/camera_49e77c80/index.m3u8
WebRTC: https://stream.iotek.tn/webrtc/camera_49e77c80/whep
```

---

## How to Add New Camera

### Method 1: Using Script (Easy)

```powershell
.\scripts\add-camera-to-mediamtx.ps1 `
  -CameraId "new-camera-id-here" `
  -CameraIP "192.168.1.67" `
  -Username "admin" `
  -Password "password123" `
  -Channel 1
```

Script will:
1. Generate config
2. Copy to clipboard
3. Paste into `mediamtx.yml`
4. Restart MediaMTX

### Method 2: Manual Edit

1. Open `mediamtx/mediamtx.yml`
2. Find `paths:` section
3. Add new camera:

```yaml
paths:
  camera_XXXXXXXX:
    source: rtsp://username:password@ip:port/cam/realmonitor?channel=X&subtype=0
    sourceOnDemand: yes
    sourceOnDemandStartTimeout: 10s
    sourceOnDemandCloseAfter: 10s
```

4. Save file
5. Restart MediaMTX

---

## Camera Configuration Template

### Dahua Camera Format:
```yaml
camera_<first-8-chars-of-id>:
  source: rtsp://username:password@ip:554/cam/realmonitor?channel=X&subtype=0
  sourceOnDemand: yes
  sourceOnDemandStartTimeout: 10s
  sourceOnDemandCloseAfter: 10s
```

### Hikvision Camera Format:
```yaml
camera_<id>:
  source: rtsp://username:password@ip:554/Streaming/Channels/X01
  sourceOnDemand: yes
```

### Generic RTSP Camera:
```yaml
camera_<id>:
  source: rtsp://username:password@ip:554/stream1
  sourceOnDemand: yes
```

---

## API Integration

When you call `GET /streams/:cameraId/proxy`, the API will return:

```json
{
  "pathId": "camera_49e77c80",
  "protocols": {
    "rtsp": "rtsp://localhost:8554/camera_49e77c80",
    "hls": "http://localhost:8888/camera_49e77c80/index.m3u8",
    "webrtc": "http://localhost:8889/camera_49e77c80/whep"
  }
}
```

Make sure the `pathId` matches the camera path in `mediamtx.yml`!

---

## Production Deployment

When deployed to production:

1. Update `.env` in Coolify:
```bash
MEDIAMTX_HOST=stream.iotek.tn
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=80
MEDIAMTX_WEBRTC_PORT=80
MEDIAMTX_USE_HTTPS=true
```

2. All cameras automatically use production domain:
```
rtsp://stream.iotek.tn:8554/camera_XXXXXXXX
```

---

## Testing

Test any camera with VLC:
```powershell
# Development
vlc rtsp://localhost:8554/camera_XXXXXXXX

# Production
vlc rtsp://stream.iotek.tn:8554/camera_XXXXXXXX
```

Test HLS in browser:
```
http://localhost:8888/camera_XXXXXXXX/index.m3u8
```

---

## Troubleshooting

### Camera not connecting:
1. Check camera is reachable: `ping <camera-ip>`
2. Check RTSP port: `Test-NetConnection -ComputerName <ip> -Port 554`
3. Test direct URL in VLC first
4. Check MediaMTX logs in PowerShell window

### Path not found:
1. Verify path name matches: `camera_<first-8-chars>`
2. Check `mediamtx.yml` syntax (YAML is sensitive to spaces!)
3. Restart MediaMTX after config changes

### Stream stuttering:
1. Check network bandwidth
2. Adjust `sourceOnDemandCloseAfter` timeout
3. Consider disabling `sourceOnDemand` for 24/7 cameras

---

**Last Updated:** October 21, 2025

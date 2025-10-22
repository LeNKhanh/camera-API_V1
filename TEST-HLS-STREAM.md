# Quick Test Guide - MediaMTX HLS Stream

## Current Status ✅
- MediaMTX: Running v1.15.3
- Camera: Registered successfully as `camera_be5729fe`
- RTSP Source: Ready (H265)
- API: Working on `mediamtx:9997`

## Test HLS Stream

### 1. Test HLS Manifest URL
Open in browser or curl:
```
https://proxy-camera.teknix.services:8888/camera_be5729fe/index.m3u8
```

Expected: M3U8 playlist content

### 2. Test HLS Web Player
Open in browser:
```
https://proxy-camera.teknix.services:8888/camera_be5729fe/
```

Expected: Video player with auto-play

### 3. Check MediaMTX Logs After Access

After accessing HLS URL, MediaMTX logs should show:
```
INF [HLS] [muxer camera_be5729fe] created automatically
INF [HLS] [muxer camera_be5729fe] is converting into HLS, 1 track (H265)
```

### 4. If Stream Still Not Playing

**Check A: Domain SSL Configuration**

The URL uses port `:8888` which may not have SSL certificate. Try HTTP instead:
```
http://proxy-camera.teknix.services:8888/camera_be5729fe/
```

**Check B: Browser Console Errors**

Open browser DevTools (F12) → Console tab
Look for CORS or network errors

**Check C: Verify Domain Points to Correct Server**

```bash
nslookup proxy-camera.teknix.services
```

Should resolve to MediaMTX server IP

**Check D: Test Direct Port Access**

```bash
curl http://<server-ip>:8888/camera_be5729fe/index.m3u8
```

If this works, it's a domain/DNS issue

### 5. Common Issues

**Issue: ERR 403 Forbidden**
- Solution: Check MediaMTX auth config allows anonymous read

**Issue: ERR 404 Not Found**  
- Solution: Camera not registered or wrong path name
- Fix: Check API `/v3/paths/list` for actual path name

**Issue: ERR Connection Refused**
- Solution: Port 8888 not accessible from internet
- Fix: Check firewall and Coolify port mapping

**Issue: Stream loads but doesn't play**
- Solution: Browser can't decode H265
- Fix: Use different browser (Safari/Edge support H265 better than Chrome)
- Or: Change camera to H264 encoding

### 6. Environment Variables Summary

In Coolify, ensure these are set:

**MediaMTX Container:**
```bash
MTX_API=yes
MTX_APIADDRESS=0.0.0.0:9997
```

**Camera API Container:**
```bash
MEDIAMTX_HOST=proxy-camera.teknix.services
MEDIAMTX_API_URL=http://mediamtx:9997
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_USE_HTTPS=true
```

Note: Container name is `mediamtx` (not `mediamtx-proxy`)

### 7. Test with VLC (Alternative)

If browser doesn't work, test with VLC:
```
vlc https://proxy-camera.teknix.services:8888/camera_be5729fe/index.m3u8
```

VLC supports H265 natively.

---

## Expected MediaMTX Logs Flow

1. **On Camera Registration:**
```
INF [path camera_be5729fe] [RTSP source] started
INF [path camera_be5729fe] [RTSP source] ready: 1 track (H265)
```

2. **On First HLS Request:**
```
INF [HLS] [muxer camera_be5729fe] created automatically  
INF [HLS] [muxer camera_be5729fe] is converting into HLS, 1 track (H265)
```

3. **During Playback:**
```
INF [HLS] [muxer camera_be5729fe] is converting into HLS, 1 track (H265)
```

If you don't see step 2-3, the HLS request is not reaching MediaMTX.

---

## Next Steps

1. Access: `https://proxy-camera.teknix.services:8888/camera_be5729fe/`
2. Check MediaMTX logs for HLS muxer creation
3. If error, check browser console (F12)
4. Report back what you see!

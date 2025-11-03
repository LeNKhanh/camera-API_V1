# Production Debugging Guide
# Các bước để debug lỗi 500 trên production endpoint

## 1. Chạy Test Script để Kiểm Tra Chi Tiết

```powershell
# Thay YOUR_SSO_TOKEN bằng token thật từ SSO
.\scripts\test-production-proxy.ps1 -Token "YOUR_SSO_TOKEN"
```

Script này sẽ test 4 scenarios:
- Test 1: `/proxy` không có protocol param
- Test 2: `/proxy?protocol=HLS` (giống frontend đang call)
- Test 3: `/url?protocol=HLS` (endpoint đúng cho protocol param)
- Test 4: Check xem camera có tồn tại không

## 2. Kiểm Tra Logs Trên Production

### A. Via Coolify Dashboard
1. Vào Coolify dashboard
2. Click vào deployment của Camera API
3. Click tab "Logs"
4. Tìm error logs gần nhất với timestamp khi frontend call API

### B. Via SSH (nếu có access)
```bash
# SSH vào server
ssh user@watcher-gateway.blocktrend.xyz

# Xem logs của container
docker ps | grep camera-api
docker logs <container-name> --tail 200 --follow

# Hoặc nếu biết service name
docker logs camera-api_app_1 --tail 200 --follow
```

Tìm các log lines:
- `[MediaMTX] Auto-registration triggered`
- `[MediaMTX] ERROR: Registration failed`
- `Camera not found`
- Stack trace với error message

## 3. Kiểm Tra Database

### Option A: Via Database Client
```sql
-- Check camera tồn tại
SELECT id, name, ip_address, username, rtsp_port, channel, rtsp_url 
FROM cameras 
WHERE id = 'be5729fe-ab9a-4175-957a-f24b980bddcc';

-- Check SSO user tồn tại
SELECT id, username, role, created_at 
FROM users 
WHERE id = 'b6514cad-77d8-4134-80a8-d06bf8644d39';

-- List tất cả cameras
SELECT id, name, ip_address FROM cameras;
```

### Option B: Via API
```powershell
# Get all cameras
$token = "YOUR_SSO_TOKEN"
Invoke-RestMethod -Uri "https://watcher-gateway.blocktrend.xyz/api/v1/camera/cameras" `
  -Headers @{ "Authorization" = "Bearer $token" }
```

## 4. Test Local vs Production

### Test Locally
```powershell
# Start local server
npm run start:dev

# Test với local camera ID
curl http://localhost:3000/streams/YOUR_LOCAL_CAMERA_ID/proxy `
  -H "Authorization: Bearer YOUR_SSO_TOKEN"
```

### So sánh behavior
- Nếu local work mà production fail → env variable issue hoặc MediaMTX issue
- Nếu cả 2 đều fail → code issue hoặc camera config issue

## 5. Các Lỗi Có Thể và Cách Fix

### Lỗi 1: Camera Not Found (should be 404, not 500)
**Nguyên nhân:** Camera UUID không tồn tại trong DB
**Fix:** 
- Use correct camera ID
- Hoặc create camera với ID này

### Lỗi 2: SSO User Not Found
**Nguyên nhân:** Migration chưa chạy trên production
**Fix:**
```bash
# SSH vào production container
docker exec -it <container-name> /bin/sh

# Run migrations
npm run migration:run
```

### Lỗi 3: MediaMTX Container Not Running
**Nguyên nhân:** MEDIAMTX_API_URL=http://mediamtx:9997 nhưng container mediamtx không chạy
**Fix:**
```bash
# Check mediamtx container
docker ps | grep mediamtx

# Nếu không thấy, start nó
docker-compose up -d mediamtx
```

### Lỗi 4: Database Connection Failed
**Nguyên nhân:** DATABASE_URL sai hoặc DB container không chạy
**Fix:**
- Check Coolify database configuration
- Check DATABASE_URL env variable
- Test database connection

### Lỗi 5: JWT Guard Fails Silently
**Nguyên nhân:** SSO token validation fails nhưng error được convert thành 500
**Fix:**
- Check SSO_API_KEY đúng
- Check SSO_CLIENT_ID='watcher' (lowercase)
- Check token chưa expire

## 6. Frontend Fix (Nếu Cần)

Nếu sau khi debug phát hiện `/proxy?protocol=HLS` không đúng:

### Option A: Remove Protocol Param
```typescript
// Frontend change
const url = `/streams/${cameraId}/proxy`;  // Remove ?protocol=HLS
```

### Option B: Use Correct Endpoint
```typescript
// Frontend change
const url = `/streams/${cameraId}/url?protocol=HLS`;  // Use /url instead of /proxy
```

### Option C: Backend Add Protocol Support
```typescript
// Backend: stream.controller.ts
@Get(':cameraId/proxy')
@Roles('ADMIN')
getProxyUrl(
  @Param('cameraId') cameraId: string,
  @Query('protocol') protocol?: 'HLS' | 'DASH',  // Add optional
) {
  return this.svc.getProxyUrl(cameraId);
  // Note: getProxyUrl returns all URLs (rtsp, hls, webrtc) regardless
}
```

## 7. Expected Responses

### Success Response from /proxy
```json
{
  "cameraId": "be5729fe-ab9a-4175-957a-f24b980bddcc",
  "cameraName": "Camera 1",
  "pathId": "camera_be5729fe",
  "protocols": {
    "rtsp": "rtsp://proxy-camera.teknix.services:8554/camera_be5729fe",
    "hls": "https://proxy-camera.teknix.services:8888/camera_be5729fe/index.m3u8",
    "hlsWebPlayer": "https://proxy-camera.teknix.services:8888/camera_be5729fe/index.m3u8",
    "webrtc": "https://proxy-camera.teknix.services:8889/camera_be5729fe/whep"
  },
  "instructions": { ... },
  "security": { ... },
  "configuration": { ... }
}
```

### Error Response (404)
```json
{
  "statusCode": 404,
  "message": "Camera not found",
  "error": "Not Found"
}
```

### Error Response (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## 8. Monitoring & Prevention

### Add Better Error Logging
Trong `stream.service.ts`, thêm try-catch wrapper:

```typescript
async getProxyUrl(cameraId: string) {
  try {
    if (!cameraId) throw new NotFoundException('cameraId required');
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    // ... rest of code
  } catch (error) {
    console.error(`[ERROR] getProxyUrl failed for camera ${cameraId}:`, {
      error: error.message,
      stack: error.stack,
      cameraId,
    });
    throw error;  // Re-throw to let NestJS handle it
  }
}
```

### Health Check Endpoint
Create endpoint to check MediaMTX connectivity:

```typescript
@Get('health/mediamtx')
async checkMediaMTX() {
  const apiUrl = process.env.MEDIAMTX_API_URL || 'http://localhost:9997';
  try {
    await axios.get(`${apiUrl}/v3/config/global`, { timeout: 5000 });
    return { status: 'ok', apiUrl };
  } catch (error) {
    return { status: 'error', message: error.message, apiUrl };
  }
}
```

## Next Action Priority

1. **IMMEDIATE:** Run test script với SSO token để xem response body chi tiết
2. **HIGH:** Check production logs trong Coolify để tìm stack trace
3. **HIGH:** Verify camera exists trong production database
4. **MEDIUM:** Test endpoint locally với same camera ID
5. **MEDIUM:** Check MediaMTX container đang chạy
6. **LOW:** Add more detailed error logging nếu cần

## Contact Points

- **Production URL:** https://watcher-gateway.blocktrend.xyz/api/v1/camera
- **MediaMTX Host:** proxy-camera.teknix.services
- **MediaMTX API:** http://mediamtx:9997 (internal Docker network)
- **Problem Camera ID:** be5729fe-ab9a-4175-957a-f24b980bddcc

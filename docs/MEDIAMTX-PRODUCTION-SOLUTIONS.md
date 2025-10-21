# 🎯 Production Solutions: Multiple Cameras with MediaMTX

## ❌ Vấn đề hiện tại:

Mỗi camera cần add thủ công vào `mediamtx.yml`:
```yaml
paths:
  camera_49e77c80:
    source: rtsp://user:pass@ip:554/...
  camera_abcd1234:
    source: rtsp://user:pass@ip2:554/...
  # ... 100 cameras = 100 entries!
```

**Không scale được khi có nhiều camera!** 😫

---

## ✅ Solution 1: MediaMTX API (Recommended - Dynamic)

### Cách hoạt động:
- Camera được add vào **Database** qua API của bạn
- Khi user request stream, **API tự động đăng ký camera** vào MediaMTX qua REST API
- MediaMTX nhận config động, không cần restart

### Ưu điểm:
- ✅ Hoàn toàn tự động
- ✅ Không cần restart MediaMTX
- ✅ Scale tốt (hàng trăm/ngàn cameras)
- ✅ Camera add/remove real-time

### Code Implementation:

**Update `stream.service.ts`:**

```typescript
async getProxyUrl(cameraId: string) {
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');

  // Build RTSP source URL
  const sourceUrl = this.buildRtspUrl(cam);
  const pathId = cameraId.substring(0, 8);
  const mediamtxApiUrl = process.env.MEDIAMTX_API_URL || 'http://localhost:9997';

  // Register camera with MediaMTX via API
  try {
    await this.registerCameraWithMediaMTX(pathId, sourceUrl, mediamtxApiUrl);
  } catch (error) {
    console.log('Camera already registered or registration failed:', error.message);
  }

  // Return proxy URLs
  const mediamtxHost = process.env.MEDIAMTX_HOST || 'localhost';
  // ... rest of code
}

private async registerCameraWithMediaMTX(pathId: string, sourceUrl: string, apiUrl: string) {
  const axios = require('axios');
  
  // Check if path exists
  try {
    const checkResponse = await axios.get(`${apiUrl}/v3/config/paths/get/${pathId}`);
    // Path exists, return
    return;
  } catch (error) {
    // Path doesn't exist, create it
  }

  // Add path to MediaMTX
  const config = {
    source: sourceUrl,
    sourceOnDemand: true,
    sourceOnDemandStartTimeout: '10s',
    sourceOnDemandCloseAfter: '10s',
  };

  await axios.patch(`${apiUrl}/v3/config/paths/add/${pathId}`, config);
  console.log(`Camera ${pathId} registered with MediaMTX`);
}

private buildRtspUrl(camera: Camera): string {
  if (camera.rtspUrl && camera.rtspUrl.trim()) {
    return camera.rtspUrl;
  }
  
  // Build Dahua format
  const user = camera.username || 'admin';
  const pass = camera.password || 'admin';
  const ip = camera.ipAddress;
  const port = camera.rtspPort || 554;
  const channel = camera.channel || 1;
  
  return `rtsp://${user}:${pass}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0`;
}
```

**MediaMTX Config (Simple):**

```yaml
# mediamtx.yml - Just enable API!
api: yes
apiAddress: 0.0.0.0:9997

# No paths needed! API will add them dynamically
paths: {}
```

**Environment Variables:**

```bash
MEDIAMTX_API_URL=http://localhost:9997
# Production: http://mediamtx:9997 (Docker internal)
```

### Flow:
```
1. User: GET /streams/49e77c80.../proxy
2. API: Check camera in DB ✅
3. API: Register camera with MediaMTX API
4. API: Return proxy URL to user
5. User: Open VLC with proxy URL
6. MediaMTX: Connect to camera on-demand
7. User: See stream! 🎥
```

---

## ✅ Solution 2: Config Generator Script (Semi-Auto)

### Cách hoạt động:
- Script đọc **tất cả cameras từ Database**
- Generate file `mediamtx-cameras.yml` với tất cả paths
- Include vào main config
- Restart MediaMTX

### Ưu điểm:
- ✅ Đơn giản, không cần code API nhiều
- ✅ Dễ debug (xem được toàn bộ config)
- ✅ Phù hợp với số lượng camera vừa phải (<100)

### Code Implementation:

**Script: `scripts/generate-mediamtx-config.ps1`**

```powershell
# Generate MediaMTX camera paths from database

$dbHost = "localhost"
$dbPort = "5432"
$dbUser = "postgres"
$dbPass = "admin"
$dbName = "Camera_api"

Write-Host "Generating MediaMTX camera config..." -ForegroundColor Yellow

# Query all cameras
$query = @"
SELECT id, name, ip_address, username, password, rtsp_port, channel, rtsp_url
FROM cameras 
WHERE ip_address IS NOT NULL
ORDER BY name;
"@

$env:PGPASSWORD = $dbPass
$results = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -F "|" -c $query

# Generate config
$config = "# Auto-generated camera paths`n# Generated: $(Get-Date)`n`npaths:`n"

foreach ($line in $results) {
    if (-not $line) { continue }
    
    $fields = $line -split '\|'
    $id = $fields[0]
    $name = $fields[1]
    $ip = $fields[2]
    $user = $fields[3]
    $pass = $fields[4]
    $port = if ($fields[5]) { $fields[5] } else { 554 }
    $channel = if ($fields[6]) { $fields[6] } else { 1 }
    $customRtsp = $fields[7]
    
    $pathId = $id.Substring(0, 8)
    
    # Build RTSP URL
    if ($customRtsp -and $customRtsp.Trim() -ne '') {
        $rtspUrl = $customRtsp.Trim()
    } else {
        $rtspUrl = "rtsp://${user}:${pass}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0"
    }
    
    # Add to config
    $config += @"
  
  # $name ($id)
  camera_${pathId}:
    source: $rtspUrl
    sourceOnDemand: yes
    sourceOnDemandStartTimeout: 10s
    sourceOnDemandCloseAfter: 10s

"@
}

# Save config
$outputPath = "D:\camera_Api\Camera-api\mediamtx\mediamtx-cameras.yml"
$config | Out-File -FilePath $outputPath -Encoding UTF8

Write-Host "Config generated: $outputPath" -ForegroundColor Green
Write-Host "Total cameras: $(($results | Measure-Object).Count)" -ForegroundColor Green
Write-Host "`nRestart MediaMTX to apply changes." -ForegroundColor Yellow
```

**Update main config to include:**

```yaml
# mediamtx.yml
api: yes
apiAddress: 0.0.0.0:9997

# Include auto-generated camera paths
pathsInclude:
  - mediamtx-cameras.yml
```

**Usage:**
```powershell
# When cameras change in DB, regenerate config
.\scripts\generate-mediamtx-config.ps1

# Restart MediaMTX
Get-Process mediamtx | Stop-Process -Force
cd mediamtx
.\mediamtx.exe mediamtx.yml
```

---

## ✅ Solution 3: Webhook on Camera Add (Event-Driven)

### Cách hoạt động:
- Khi add camera qua API → Trigger webhook
- Webhook call MediaMTX API để register camera
- Real-time, không cần manual action

### Implementation:

**In `camera.service.ts`:**

```typescript
async create(createCameraDto: CreateCameraDto) {
  const camera = this.cameraRepo.create(createCameraDto);
  const saved = await this.cameraRepo.save(camera);
  
  // Auto-register with MediaMTX
  await this.registerWithMediaMTX(saved);
  
  return saved;
}

private async registerWithMediaMTX(camera: Camera) {
  const mediamtxApiUrl = process.env.MEDIAMTX_API_URL || 'http://localhost:9997';
  const pathId = `camera_${camera.id.substring(0, 8)}`;
  const sourceUrl = this.buildRtspUrl(camera);
  
  try {
    await axios.patch(`${mediamtxApiUrl}/v3/config/paths/add/${pathId}`, {
      source: sourceUrl,
      sourceOnDemand: true,
    });
    console.log(`Camera ${pathId} auto-registered with MediaMTX`);
  } catch (error) {
    console.error(`Failed to register camera with MediaMTX:`, error.message);
  }
}
```

---

## 📊 Comparison

| Solution | Auto | Scale | Complexity | Restart Needed |
|----------|------|-------|------------|----------------|
| **1. MediaMTX API** | ✅ Full | ✅ Excellent | Medium | ❌ No |
| **2. Config Generator** | ⚠️ Semi | ⚠️ Good (<100) | Low | ✅ Yes |
| **3. Webhook** | ✅ Full | ✅ Excellent | High | ❌ No |

---

## 🎯 Recommendation

### For Your Case (IoTek):

**Use Solution 1: MediaMTX API** ✅

**Why:**
- You already have camera database
- Scale well with many cameras
- No restart needed
- Simple to implement
- Works great with Coolify deployment

**Implementation Steps:**

1. Enable MediaMTX API (already done)
2. Add `registerCameraWithMediaMTX()` to `stream.service.ts`
3. Call it in `getProxyUrl()` before returning URLs
4. Done! ✅

**Estimated time:** 15 minutes

---

## 🚀 Quick Implementation

Want me to implement **Solution 1 (MediaMTX API)** right now? 

It's the best for production and takes ~15 minutes! 🎯

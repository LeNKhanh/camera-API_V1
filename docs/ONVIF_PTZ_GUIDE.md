# ONVIF PTZ Integration Guide

## ✅ Đã Hoàn Thành

Hệ thống đã được tích hợp **ONVIF PTZ** để điều khiển camera thực tế!

## 📋 Những gì đã thay đổi

### 1. **ONVIF Helper Class** (`src/modules/ptz/onvif-ptz.helper.ts`)
- Kết nối camera qua ONVIF protocol
- Continuous move (pan, tilt, zoom)
- Stop command
- Preset operations (goto, set, remove)
- Camera connection caching

### 2. **PTZ Service Updates** (`src/modules/ptz/ptz.service.ts`)
- Tích hợp `OnvifPtzHelper` để gọi camera thật
- Support mode switching: ONVIF enabled/disabled
- Environment variable: `PTZ_USE_ONVIF` (default: 1/enabled)
- Comprehensive debug logging
- Auto-stop timeout với ONVIF

### 3. **Camera Entity** (`src/typeorm/entities/camera.entity.ts`)
- Thêm field: `onvifPort` (nullable, default 80)
- Support các port phổ biến: 80, 8000, 8080, 8899

### 4. **Camera DTO Updates**
- `CreateCameraDto`: Thêm `onvifPort` (optional, default 80)
- `UpdateCameraDto`: Thêm `onvifPort` (optional)

### 5. **Camera Service** (`camera.service.ts`)
- Lưu `onvifPort` khi tạo camera
- Default value: 80

---

## 🚀 Cách Sử Dụng

### **Bước 1: Update Camera với ONVIF Port**

Nếu camera hiện tại chưa có `onvifPort`, hãy update:

```bash
# PowerShell
$cameraId = "your-camera-uuid"
$token = "your-jwt-token"

Invoke-RestMethod -Uri "http://localhost:3000/cameras/$cameraId" `
  -Method PATCH `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{
    "onvifPort": 80
  }'
```

**Lưu ý Port ONVIF phổ biến:**
- Dahua: 80, 8000, 8899
- Hikvision: 80, 8000
- Axis: 80
- Uniview: 80, 8000

### **Bước 2: Test PTZ Command**

```powershell
# Ví dụ: Pan Left
$cameraId = "your-camera-uuid"
$token = "your-jwt-token"

Invoke-RestMethod -Uri "http://localhost:3000/cameras/$cameraId/ptz" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{
    "action": "PAN_LEFT",
    "speed": 5,
    "durationMs": 2000
  }'
```

**Camera sẽ di chuyển vật lý** sang trái trong 2 giây, sau đó tự động dừng!

---

## 📊 Debug Logging

Khi gửi lệnh PTZ, server sẽ in log chi tiết:

```
┌─────────────────────────────────────────────────────────────
│ [PTZ DEBUG] Camera Info:
│   - ID: abc-123-xyz
│   - Name: Dahua Camera
│   - IP Address: 192.168.1.66
│   - SDK Port: 37777
│   - ONVIF Port: 80
│   - Channel: 1
│   - Vendor: dahua
│   - Username: aidev
│ [PTZ DEBUG] Command:
│   - Action: PAN_LEFT
│   - Speed: 5
│   - Duration (ms): 2000
│   - Command Code: 2
│ [PTZ DEBUG] Mode: ✅ ONVIF ENABLED
│   📡 Sẽ gửi lệnh ONVIF thật tới camera
│   🎥 Camera sẽ di chuyển vật lý!
└─────────────────────────────────────────────────────────────
│ [PTZ DEBUG] Parameters:
│   - Normalized Speed: 5
│   - param1 (vertical speed): null
│   - param2 (horizontal speed / preset): 5
│   - param3: null
│ [PTZ DEBUG] Motion Vectors:
│   - Pan (X-axis): -5
│   - Tilt (Y-axis): 0
│   - Zoom (Z-axis): 0
│ [PTZ ONVIF] Connecting to camera...
│ [PTZ ONVIF] Sending ContinuousMove command...
│ [PTZ ONVIF] Normalized speeds: { pan: -0.5, tilt: 0, zoom: 0 }
│ [PTZ ONVIF] ✅ ContinuousMove command sent successfully
└─────────────────────────────────────────────────────────────
✅ [PTZ ONVIF] Command executed
```

---

## 🎛️ Environment Variables

### **PTZ_USE_ONVIF**
- **Default:** `1` (enabled)
- **Mô tả:** Bật/tắt ONVIF PTZ
- **Giá trị:**
  - `1` hoặc không set: ONVIF enabled, camera sẽ di chuyển thật
  - `0`: Mock mode, chỉ giả lập (testing)

```bash
# .env
PTZ_USE_ONVIF=1  # Bật ONVIF (default)
# PTZ_USE_ONVIF=0  # Tắt ONVIF (mock mode)
```

### **PTZ_THROTTLE_MS**
- **Default:** `200`
- **Mô tả:** Khoảng thời gian tối thiểu (ms) giữa 2 lệnh PTZ liên tiếp
- **Giá trị:** 0-10000

### **PTZ_LOG_MAX**
- **Default:** `10`
- **Mô tả:** Số lượng log PTZ giữ lại cho mỗi camera
- **Giá trị:** 1-200

---

## 🧪 Test Script PowerShell

```powershell
# === Camera & Authentication Setup ===
$baseUrl = "http://localhost:3000"
$cameraId = "your-camera-uuid"  # Thay bằng ID thật
$token = "your-jwt-token"       # Thay bằng token thật

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# === Test 1: Pan Left ===
Write-Host "`n=== Test 1: Pan Left ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/cameras/$cameraId/ptz" `
  -Method POST -Headers $headers `
  -Body '{"action":"PAN_LEFT","speed":5,"durationMs":2000}'

Start-Sleep -Seconds 3

# === Test 2: Tilt Up ===
Write-Host "`n=== Test 2: Tilt Up ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/cameras/$cameraId/ptz" `
  -Method POST -Headers $headers `
  -Body '{"action":"TILT_UP","speed":5,"durationMs":2000}'

Start-Sleep -Seconds 3

# === Test 3: Diagonal (Pan Right + Tilt Down) ===
Write-Host "`n=== Test 3: Pan Right Down ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/cameras/$cameraId/ptz" `
  -Method POST -Headers $headers `
  -Body '{"action":"PAN_RIGHT_DOWN","speed":4,"durationMs":2000}'

Start-Sleep -Seconds 3

# === Test 4: Zoom In ===
Write-Host "`n=== Test 4: Zoom In ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/cameras/$cameraId/ptz" `
  -Method POST -Headers $headers `
  -Body '{"action":"ZOOM_IN","speed":3,"durationMs":3000}'

Start-Sleep -Seconds 4

# === Test 5: Manual Stop ===
Write-Host "`n=== Test 5: Stop ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/cameras/$cameraId/ptz" `
  -Method POST -Headers $headers `
  -Body '{"action":"STOP"}'

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
```

---

## 🔧 Troubleshooting

### **1. Camera không di chuyển**

**Kiểm tra:**
```bash
# Xem log server để check ONVIF connection
# Log sẽ hiển thị:
# [PTZ ONVIF] Connecting to camera...
# [PTZ ONVIF] ✅ ContinuousMove command sent successfully
# hoặc
# [PTZ ONVIF] ❌ Command failed: ...
```

**Nguyên nhân thường gặp:**
- ❌ Camera không bật ONVIF → Bật trong camera web interface
- ❌ `onvifPort` sai → Thử 80, 8000, 8899
- ❌ Username/password sai → Update camera credentials
- ❌ Network không kết nối được → Ping camera IP
- ❌ Camera không support PTZ → Chỉ PTZ dome/speed dome mới có

### **2. ONVIF Connection Timeout**

```
[PTZ ONVIF] Command failed: connect ETIMEDOUT
```

**Giải pháp:**
- Kiểm tra firewall
- Thử port khác (8000, 8899)
- Test với ONVIF Device Manager (Windows tool)

### **3. Unauthorized Error**

```
[PTZ ONVIF] Command failed: 401 Unauthorized
```

**Giải pháp:**
- Kiểm tra username/password trong database
- Update camera:
  ```bash
  PATCH /cameras/:id
  {
    "username": "correct-user",
    "password": "correct-pass"
  }
  ```

### **4. PTZ Not Supported**

```
[PTZ ONVIF] Command failed: The requested service is not supported
```

**Giải pháp:**
- Camera không có PTZ capabilities
- Kiểm tra với ONVIF Device Manager xem có PTZ service không

---

## 🎯 Supported Actions

### **Basic Movements**
- `PAN_LEFT` / `PAN_RIGHT`
- `TILT_UP` / `TILT_DOWN`
- `ZOOM_IN` / `ZOOM_OUT`

### **Diagonal Movements**
- `PAN_LEFT_UP` / `PAN_RIGHT_UP`
- `PAN_LEFT_DOWN` / `PAN_RIGHT_DOWN`

### **Focus & Iris**
- `FOCUS_NEAR` / `FOCUS_FAR`
- `IRIS_OPEN` / `IRIS_CLOSE`

### **Preset Operations**
- `PRESET_GOTO` (param2 = preset number)
- `PRESET_SET` (param2 = preset number)
- `PRESET_DELETE` (param2 = preset number)

### **Control**
- `STOP` (dừng tất cả chuyển động)

---

## 📝 Tạo Camera Mới với ONVIF

```bash
POST /cameras
{
  "name": "PTZ Dome Camera",
  "ipAddress": "192.168.1.100",
  "username": "admin",
  "password": "admin123",
  "sdkPort": 37777,
  "onvifPort": 80,        # ← Quan trọng!
  "rtspPort": 554,
  "channel": 1,
  "vendor": "dahua",
  "enabled": true
}
```

---

## ⚡ Performance Notes

1. **Connection Caching:** ONVIF connections được cache theo `cameraId`, tránh reconnect mỗi lần gọi
2. **Throttle:** Default 200ms giữa các lệnh để tránh quá tải camera
3. **Auto-stop:** Nếu set `durationMs`, camera tự động dừng sau khoảng thời gian đó
4. **Async Logging:** Ghi log PTZ không block response, prune log cũ tự động

---

## 🎉 Kết Luận

**ONVIF PTZ đã hoạt động!** 🚀

- ✅ Camera di chuyển vật lý
- ✅ Support tất cả hãng camera có ONVIF (Dahua, Hikvision, Axis, Uniview, v.v.)
- ✅ Debug logging chi tiết
- ✅ Auto-stop với timeout
- ✅ Connection caching
- ✅ Graceful error handling

**Test ngay:**
```bash
# Test với camera thật 192.168.1.66
POST /cameras/<camera-id>/ptz
{
  "action": "PAN_LEFT",
  "speed": 5,
  "durationMs": 2000
}
```

Camera sẽ xoay trái trong 2 giây! 🎥✨

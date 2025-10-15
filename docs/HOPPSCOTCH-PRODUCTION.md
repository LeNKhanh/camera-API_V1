# 🌐 HOPPSCOTCH TESTING - PRODUCTION (https://camera-api.teknix.services)

## 📋 Setup Initial

### Base URL
```
https://camera-api.teknix.services
```

### Headers mặc định cho tất cả requests
```
Content-Type: application/json
```

---

## 🔐 1. AUTHENTICATION FLOW

### **1.1. Register (Dev/Testing - nếu được bật)**

**Request:**
```
POST https://camera-api.teknix.services/auth/register
```

**Body (JSON):**
```json
{
  "username": "operator1",
  "password": "op123",
  "role": "OPERATOR"
}
```

**⚠️ Validation Rules:**
- `username`: Chuỗi, không trống
- `password`: Tối thiểu **6 ký tự**
- `role`: Phải là `ADMIN`, `OPERATOR`, hoặc `VIEWER`

**Response Success (201):**
```json
{
  "id": "uuid-here",
  "username": "operator1",
  "role": "OPERATOR",
  "createdAt": "2025-10-14T..."
}
```

**Response Error (400) - Validation:**
```json
{
  "statusCode": 400,
  "message": [
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

**Response Error (409) - Duplicate Username:**
```json
{
  "statusCode": 409,
  "message": "Username already exists"
}
```

**Response Error (500) - Server Error:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

**Troubleshooting 500 Error:**

1. **Check Coolify Logs:**
   - Vào Coolify Dashboard
   - Chọn app **camera-api**
   - Tab **Logs** → xem chi tiết lỗi

2. **Common Causes:**
   - Database connection failed (check `DATABASE_URL`)
   - Missing environment variables
   - Database migration not run
   - Password too short (< 6 chars)

3. **Fix Steps:**
   
   **A. Verify Database Connection:**
   ```bash
   # Trong Coolify, check environment variables
   DATABASE_URL=postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api
   ```

   **B. Run Migrations (nếu chưa chạy):**
   ```bash
   # SSH vào container hoặc chạy command trên Coolify
   npm run migration:run
   ```

   **C. Test với password dài hơn:**
   ```json
   {
     "username": "operator12",
     "password": "operator123",
     "role": "OPERATOR"
   }
   ```

4. **Test Database Connection:**
   
   Thử login với user mặc định trước:
   ```
   POST https://camera-api.teknix.services/auth/login
   
   Body:
   {
     "username": "admin",
     "password": "admin123"
   }
   ```
   
   Nếu login OK → Database works → Lỗi ở register logic
   Nếu login FAIL → Database issue

---

### **1.2. Login (Lấy Access Token & Refresh Token)**

**Request:**
```
POST https://camera-api.teknix.services/auth/login
```

**Body (JSON):**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response Success (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "random-base64url-string-here",
  "userId": "uuid-of-user"
}
```

**⚠️ LƯU Ý:**
- Copy `accessToken` → Dùng cho tất cả requests tiếp theo
- Copy `refreshToken` → Dùng khi access token hết hạn
- Copy `userId` → Dùng cho refresh/logout

---

### **1.3. Sử dụng Access Token**

**Sau khi login, thêm header này vào TẤT CẢ requests:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Trong Hoppscotch:**
1. Tab **Authorization**
2. Chọn **Bearer Token**
3. Paste access token vào

---

### **1.4. Refresh Token (Khi access token hết hạn)**

**Cách 1: Với userId (Tường minh)**

**Request:**
```
POST https://camera-api.teknix.services/auth/refresh
```

**Body (JSON):**
```json
{
  "userId": "uuid-from-login-response",
  "refreshToken": "refresh-token-from-login"
}
```

**Cách 2: Không cần userId (Fallback - Khuyên dùng)**

**Request:**
```
POST https://camera-api.teknix.services/auth/refresh
```

**Headers:**
```
Authorization: Bearer <old-access-token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "refreshToken": "refresh-token-from-login"
}
```

**Response Success (200):**
```json
{
  "accessToken": "new-access-token-here",
  "refreshToken": "new-refresh-token-here"
}
```

**⚠️ QUAN TRỌNG:**
- Refresh token cũ sẽ **không còn dùng được** (rotated)
- Lưu lại **accessToken mới** và **refreshToken mới**
- Cập nhật Authorization header với token mới

---

### **1.5. Logout**

**Cách 1: Với userId**

**Request:**
```
POST https://camera-api.teknix.services/auth/logout
```

**Body (JSON):**
```json
{
  "userId": "uuid-from-login"
}
```

**Cách 2: Không cần userId (Fallback)**

**Request:**
```
POST https://camera-api.teknix.services/auth/logout
```

**Headers:**
```
Authorization: Bearer <current-access-token>
```

**Body (JSON):**
```json
{}
```

**Response Success (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Sau logout:**
- Refresh token bị vô hiệu hóa
- Không thể refresh nữa
- Phải login lại

---

## 👥 2. USER MANAGEMENT (ADMIN ONLY)

### **2.1. Get Profile (Current User)**

**Request:**
```
GET https://camera-api.teknix.services/users/profile
```

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "username": "admin",
  "role": "ADMIN",
  "createdAt": "2025-10-14T..."
}
```

---

### **2.2. List All Users (ADMIN)**

**Request:**
```
GET https://camera-api.teknix.services/users
```

**With Filters & Pagination:**
```
GET https://camera-api.teknix.services/users?username=op&role=OPERATOR&page=1&pageSize=10&sortBy=username&sortDir=ASC
```

**Query Parameters:**
| Param | Example | Description |
|-------|---------|-------------|
| `username` | `username=admin` | Filter by username (LIKE) |
| `role` | `role=ADMIN,OPERATOR` | Filter by role(s) |
| `createdFrom` | `createdFrom=2025-10-01` | Created after date |
| `createdTo` | `createdTo=2025-10-31` | Created before date |
| `page` | `page=1` | Page number |
| `pageSize` | `pageSize=10` | Items per page |
| `sortBy` | `sortBy=username` | Sort field |
| `sortDir` | `sortDir=ASC` | Sort direction |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "username": "admin",
      "role": "ADMIN",
      "createdAt": "2025-10-14T..."
    },
    {
      "id": "uuid-2",
      "username": "operator1",
      "role": "OPERATOR",
      "createdAt": "2025-10-14T..."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### **2.3. Update User (ADMIN)**

**Request:**
```
PUT https://camera-api.teknix.services/users/<user-id>
```

**Body - Change Role:**
```json
{
  "role": "OPERATOR"
}
```

**Body - Change Password:**
```json
{
  "password": "newPassword123"
}
```

**Body - Change Both:**
```json
{
  "role": "VIEWER",
  "password": "newPassword123"
}
```

**Response (200):**
```json
{
  "updated": true
}
```

---

### **2.4. Delete User (ADMIN)**

**Request:**
```
DELETE https://camera-api.teknix.services/users/<user-id>
```

**Response (200):**
```json
{
  "deleted": true
}
```

**Error (403) - Tự xóa:**
```json
{
  "statusCode": 403,
  "message": "Không thể tự xoá tài khoản đang đăng nhập"
}
```

---

## 📹 3. CAMERA MANAGEMENT

### **3.1. List Cameras**

**Request:**
```
GET https://camera-api.teknix.services/cameras
```

**With Filters:**
```
GET https://camera-api.teknix.services/cameras?enabled=true&vendor=dahua&page=1&pageSize=10
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "7e53c1d5-1c65-482a-af06-463e0d334517",
      "name": "Camera Front Door",
      "ipAddress": "192.168.1.66",
      "channel": 2,
      "vendor": "dahua",
      "enabled": true,
      "rtspUrl": "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0"
    }
  ]
}
```

---

### **3.2. Get Single Camera**

**Request:**
```
GET https://camera-api.teknix.services/cameras/7e53c1d5-1c65-482a-af06-463e0d334517
```

---

### **3.3. Create Camera (ADMIN/OPERATOR)**

**Request:**
```
POST https://camera-api.teknix.services/cameras
```

**Body:**
```json
{
  "name": "Camera Test",
  "ipAddress": "192.168.1.100",
  "channel": 1,
  "username": "admin",
  "password": "admin123",
  "rtspPort": 554,
  "vendor": "dahua",
  "enabled": true
}
```

---

### **3.4. Update Camera**

**Request:**
```
PATCH https://camera-api.teknix.services/cameras/7e53c1d5-1c65-482a-af06-463e0d334517
```

**Body:**
```json
{
  "name": "Camera Updated Name",
  "rtspUrl": "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0"
}
```

---

### **3.5. Delete Camera**

**Request:**
```
DELETE https://camera-api.teknix.services/cameras/7e53c1d5-1c65-482a-af06-463e0d334517
```

---

## 🎮 4. PTZ CONTROL

### **4.1. Send PTZ Command**

**Request:**
```
POST https://camera-api.teknix.services/cameras/7e53c1d5-1c65-482a-af06-463e0d334517/ptz
```

**Body - Pan Left:**
```json
{
  "action": "PAN_LEFT",
  "speed": 5,
  "duration": 2000
}
```

**Available Actions:**
- `PAN_LEFT`, `PAN_RIGHT`
- `TILT_UP`, `TILT_DOWN`
- `ZOOM_IN`, `ZOOM_OUT`
- `FOCUS_NEAR`, `FOCUS_FAR`
- `PRESET_GOTO`, `PRESET_SET`
- `STOP`

**Response (200):**
```json
{
  "ok": true,
  "action": "PAN_LEFT",
  "speed": 5,
  "duration": 2000,
  "cameraId": "7e53c1d5-1c65-482a-af06-463e0d334517"
}
```

---

## 📺 5. STREAMING

### **5.1. Get Stream URL**

**Request:**
```
GET https://camera-api.teknix.services/streams/7e53c1d5-1c65-482a-af06-463e0d334517/url?protocol=HLS
```

**Query Parameters:**
- `protocol`: `HLS` hoặc `DASH`

**Response (200):**
```json
{
  "protocol": "HLS",
  "url": "http://localhost:8080/live/7e53c1d5-1c65-482a-af06-463e0d334517/index.m3u8",
  "note": "Cần triển khai streaming server để hoạt động thực tế"
}
```

---

## 📸 6. SNAPSHOT

### **6.1. Capture Snapshot**

**Request:**
```
POST https://camera-api.teknix.services/snapshots/capture
```

**Body:**
```json
{
  "cameraId": "7e53c1d5-1c65-482a-af06-463e0d334517",
  "strategy": "RTSP"
}
```

**Response (201):**
```json
{
  "id": "snapshot-uuid",
  "cameraId": "7e53c1d5-1c65-482a-af06-463e0d334517",
  "storagePath": "C:\\tmp\\uuid.jpg",
  "createdAt": "2025-10-14T..."
}
```

---

### **6.2. List Snapshots**

**Request:**
```
GET https://camera-api.teknix.services/snapshots
```

**With Camera Filter:**
```
GET https://camera-api.teknix.services/snapshots?cameraId=7e53c1d5-1c65-482a-af06-463e0d334517
```

---

## 🎥 7. RECORDING

### **7.1. Start Recording**

**Request:**
```
POST https://camera-api.teknix.services/recordings/start
```

**Body:**
```json
{
  "cameraId": "7e53c1d5-1c65-482a-af06-463e0d334517",
  "durationSec": 30,
  "strategy": "RTSP"
}
```

**Response (201):**
```json
{
  "id": "recording-uuid",
  "cameraId": "7e53c1d5-1c65-482a-af06-463e0d334517",
  "status": "RUNNING",
  "storagePath": "C:\\tmp\\recording.mp4"
}
```

---

### **7.2. Get Recording Status**

**Request:**
```
GET https://camera-api.teknix.services/recordings/recording-uuid
```

**Response:**
```json
{
  "id": "recording-uuid",
  "status": "COMPLETED",
  "startedAt": "2025-10-14T10:00:00Z",
  "endedAt": "2025-10-14T10:00:30Z",
  "storagePath": "C:\\tmp\\recording.mp4"
}
```

---

### **7.3. Stop Recording**

**Request:**
```
POST https://camera-api.teknix.services/recordings/recording-uuid/stop
```

---

## 🔔 8. EVENTS

### **8.1. List Events**

**Request:**
```
GET https://camera-api.teknix.services/events
```

**With Filters:**
```
GET https://camera-api.teknix.services/events?cameraId=7e53c1d5-1c65-482a-af06-463e0d334517&type=MOTION&page=1&pageSize=20
```

---

### **8.2. Create Event**

**Request:**
```
POST https://camera-api.teknix.services/events
```

**Body:**
```json
{
  "cameraId": "7e53c1d5-1c65-482a-af06-463e0d334517",
  "type": "MOTION",
  "description": "Motion detected in zone A"
}
```

---

## 📚 9. API DOCUMENTATION

**Swagger UI:**
```
https://camera-api.teknix.services/docs
```

---

## 🧪 10. TESTING FLOW (Hoàn chỉnh)

### **Step 1: Login**
```
POST https://camera-api.teknix.services/auth/login

Body:
{
  "username": "admin",
  "password": "admin123"
}

→ Save: accessToken, refreshToken, userId
```

### **Step 2: Setup Authorization**
```
Add to ALL requests:
Header: Authorization: Bearer <accessToken>
```

### **Step 3: Test Camera API**
```
GET https://camera-api.teknix.services/cameras
→ Should return list of cameras
```

### **Step 4: Test PTZ**
```
POST https://camera-api.teknix.services/cameras/7e53c1d5-1c65-482a-af06-463e0d334517/ptz

Body:
{
  "action": "PAN_LEFT",
  "speed": 5,
  "duration": 2000
}

→ Camera should move left for 2 seconds
```

### **Step 5: Test Refresh Token**
```
POST https://camera-api.teknix.services/auth/refresh

Headers:
Authorization: Bearer <old-access-token>

Body:
{
  "refreshToken": "<refresh-token>"
}

→ Get new tokens, update Authorization header
```

### **Step 6: Test Logout**
```
POST https://camera-api.teknix.services/auth/logout

Headers:
Authorization: Bearer <access-token>

Body: {}

→ Tokens invalidated
```

---

## ❌ 11. COMMON ERRORS

| Status | Message | Cause | Solution |
|--------|---------|-------|----------|
| 401 | Unauthorized | Missing/invalid token | Login again |
| 403 | Forbidden | Insufficient role | Use ADMIN account |
| 403 | Refresh expired | Refresh token expired | Login again |
| 403 | Refresh invalid | Used old refresh token | Use new token from last refresh |
| 404 | Not Found | Resource doesn't exist | Check ID |
| 429 | Too Many Requests | Rate limit exceeded | Wait 60 seconds |
| 500 | Internal Server Error | Server error | Check logs |

---

## 🔒 12. SECURITY NOTES

1. **HTTPS Only**: Production dùng `https://camera-api.teknix.services`
2. **Token Expiry**: 
   - Access Token: ~2 hours
   - Refresh Token: 7 days (default)
3. **Token Rotation**: Refresh token rotates on each refresh
4. **Rate Limiting**: 
   - Login: 10 requests/60s per IP
   - Refresh: 30 requests/60s per IP

---

## 📝 13. HOPPSCOTCH COLLECTION SETUP

### Create Collection: "Camera API Production"

**Environment Variables:**
```
BASE_URL = https://camera-api.teknix.services
ACCESS_TOKEN = (will be set after login)
REFRESH_TOKEN = (will be set after login)
USER_ID = (will be set after login)
CAMERA_ID = 7e53c1d5-1c65-482a-af06-463e0d334517
```

### Folder Structure:
```
📁 Camera API Production
  📁 1. Auth
    - Login
    - Refresh Token
    - Logout
    - Get Profile
  📁 2. Users (Admin)
    - List Users
    - Update User
    - Delete User
  📁 3. Cameras
    - List Cameras
    - Get Camera
    - Create Camera
    - Update Camera
    - Delete Camera
  📁 4. PTZ
    - Pan Left
    - Pan Right
    - Tilt Up
    - Tilt Down
    - Zoom In
    - Zoom Out
  📁 5. Stream
    - Get Stream URL
  📁 6. Snapshot
    - Capture Snapshot
    - List Snapshots
  📁 7. Recording
    - Start Recording
    - Get Recording Status
    - Stop Recording
  📁 8. Events
    - List Events
    - Create Event
```

---

## 🎯 14. QUICK TEST CHECKLIST

- [ ] Login successful
- [ ] Access token works
- [ ] List cameras
- [ ] Get single camera
- [ ] PTZ control works
- [ ] Snapshot capture
- [ ] Recording start/stop
- [ ] Refresh token works
- [ ] Logout successful
- [ ] After logout, refresh fails (403)

---

**🎉 Happy Testing!**

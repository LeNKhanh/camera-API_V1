# E2E Test Plan – Camera API

Cài & seed:
```powershell
npm install
Copy-Item src\.env.example .env
# Sửa DB_*, JWT_SECRET nếu cần
npm run seed
npm run start:dev
```
Server: http://localhost:3000

## 2. Biến môi trường quan trọng nên kiểm tra
- PTZ_THROTTLE_MS (mặc định 200) → test throttle.
- PTZ_LOG_MAX (ví dụ 10) → test prune.
- SNAPSHOT_DIR / RECORD_DIR nếu muốn thay.

## 3. Tài khoản & vai trò
Seed tạo user admin (admin/admin123). Tạo thêm 2 user để test quyền:
1. OPERATOR: POST /auth/register { username, password, role: "OPERATOR" }
2. VIEWER: POST /auth/register { username, password, role: "VIEWER" }

Giữ lại accessToken từng user (ghi chú tạm).

## 4. Ký hiệu & Helper
Trong ví dụ:
- <ADMIN_TOKEN>, <OP_TOKEN>, <VIEWER_TOKEN>: access token tương ứng.
- <CAM_ID>, <REC_ID>, <PLAY_ID>, <EVT_ID>, <SNAP_ID>: ID tạo trong quá trình test.
- Dùng PowerShell (Invoke-RestMethod) hoặc curl tuỳ ý.

Helper PowerShell (tùy chọn, tạo file temp `test.ps1`):
```powershell
function POST($url,$body,$token){ Invoke-RestMethod -Method POST -Uri $url -Headers @{Authorization="Bearer $token"} -Body ($body|ConvertTo-Json) -ContentType 'application/json' }
function GET($url,$token){ Invoke-RestMethod -Method GET -Uri $url -Headers @{Authorization="Bearer $token"} }
function PUT($url,$body,$token){ Invoke-RestMethod -Method PUT -Uri $url -Headers @{Authorization="Bearer $token"} -Body ($body|ConvertTo-Json) -ContentType 'application/json' }
function PATCH($url,$body,$token){ Invoke-RestMethod -Method PATCH -Uri $url -Headers @{Authorization="Bearer $token"} -Body ($body|ConvertTo-Json) -ContentType 'application/json' }
function DEL($url,$token){ Invoke-RestMethod -Method DELETE -Uri $url -Headers @{Authorization="Bearer $token"} }
```

## 5. Luồng tổng hợp (Happy Path) + JSON Body
1. Login admin -> token.
```json
POST /auth/login
{
	"username": "admin",
	"password": "admin123"
}
```
2. Tạo 1 camera (RTSP giả hoặc thật). Lưu <CAM_ID>.
```json
POST /cameras
{
	"name": "Cam Main",
	"ipAddress": "192.168.1.10",
	"port": 554,
	"username": "camuser",
	"password": "campass",
	"enabled": true
}
```
3. Bulk add thêm 2 channel.
```json
POST /cameras/bulk-channels
{
	"ipAddress": "192.168.1.10",
	"port": 554,
	"username": "camuser",
	"password": "campass",
	"channels": 2
}
```
4. Verify camera:
```
GET /cameras/<CAM_ID>/verify
```
5. Capture snapshot.
```json
POST /snapshots/capture
{
	"cameraId": "<CAM_ID>",
	"strategy": "RTSP"  
}
```
6. Start recording.
```json
POST /recordings/start
{
	"cameraId": "<CAM_ID>",
	"strategy": "FAKE"
}
```
7. Stop recording (sau 5–10s).
```
PUT /recordings/<REC_ID>/stop
Body: {}
```
8. List recordings (lọc COMPLETED):
```
GET /recordings?cameraId=<CAM_ID>&status=COMPLETED
```
9. Create playback.
```json
POST /playbacks
{
	"recordingId": "<REC_ID>",
	"protocol": "HLS"
}
```
10. PATCH position (kích hoạt PLAYING nếu PENDING).
```json
PATCH /playbacks/<PLAY_ID>/position
{
	"positionSeconds": 3
}
```
11. PATCH status tuần tự.
```json
PATCH /playbacks/<PLAY_ID>/status { "status": "PAUSED" }
PATCH /playbacks/<PLAY_ID>/status { "status": "PLAYING" }
PATCH /playbacks/<PLAY_ID>/status { "status": "STOPPED" }
```
12. Tạo event.
```json
POST /events
{
	"cameraId": "<CAM_ID>",
	"type": "MOTION",
	"description": "Manual motion test"
}
```
13. Simulate motion.
```
POST /events/simulate-motion/<CAM_ID>
```
14. Ack event.
```
PUT /events/<EVT_ID>/ack
```
15. Delete single event.
```
DELETE /events/<EVT_ID>
```
16. Delete all events by camera.
```
DELETE /events/by-camera/<CAM_ID>
```
17. PTZ diagonal.
```json
POST /cameras/<CAM_ID>/ptz
{
	"action": "PAN_RIGHT_DOWN",
	"speed": 3
}
```
18. PTZ throttle test (gửi lại y chang trong <200ms).
19. Lấy PTZ logs.
```
GET /cameras/<CAM_ID>/ptz/logs
```
20. Advanced PTZ logs filter.
```
GET /cameras/ptz/logs/advanced?nChannelID=<CHANNEL>
```
21. Stream stub.
```
GET /streams/<CAM_ID>/url?protocol=HLS
```
22. Playback analytics.
```
GET /playbacks/analytics
```
23. Download recording file.
```
GET /recordings/<REC_ID>/download
```

## 6. Chi tiết kịch bản & Expected
### 6.1 Auth
- Login đúng: 200 có accessToken, refreshToken.
- Refresh: POST /auth/refresh -> token mới, token cũ vẫn dùng đến khi logout.
- Logout: POST /auth/logout -> refresh token bị revoke (refresh lại phải 401/403 tuỳ implement).

### 6.2 Camera
| Test | Bước | Expected |
|------|------|----------|
| Create | POST /cameras | 201 + id + channel=1 |
| Bulk | POST /cameras/bulk-channels | Trả danh sách, channel kế tiếp nhau |
| List filter | GET /cameras?channel=2 | Chỉ kết quả channel=2 |
| Verify | GET /cameras/:id/verify | status in (OK, AUTH, TIMEOUT, CONN, NOT_FOUND) |
| Update | PATCH /cameras/:id { name } | name thay đổi |
| Delete | DELETE /cameras/:id | 200 ok:true |

### 6.3 Snapshot
- Capture thành công => status 201/200 có id, path.
- GET /snapshots hiển thị snapshot mới nhất đầu danh sách.

### 6.4 Recording
| Test | Expected |
|------|----------|
| Start | status RUNNING (hoặc PENDING→RUNNING tuỳ logic) |
| Stop | status COMPLETED + endedAt != null |
| List filter time | from/to thu hẹp phạm vi đúng |
| status filter | ?status=COMPLETED chỉ trả completed |
| Double stop | Lần 2 trả already / hoặc 400 (tùy code) |
| Download | HTTP 200 + Content-Type video/* |

### 6.5 Playback
| Tình huống | Hành động | Expected |
|-----------|-----------|----------|
| Create | POST /playbacks | status PENDING |
| First position | PATCH positionSeconds=3 | status PLAYING |
| Pause | PATCH status=PAUSED | status PAUSED |
| Resume | PATCH status=PLAYING | status PLAYING |
| Stop | PATCH status=STOPPED | status STOPPED (+ endedAt) |
| After COMPLETE | PATCH status=PAUSED | 400 BadRequest (finalized) |
| Auto complete | Cập nhật position >=95% duration | status COMPLETED |
| Idempotent | PATCH status với cùng giá trị hiện tại | 200 không đổi timestamps |

### 6.6 Event
| Test | Expected |
|------|----------|
| Create | 201 + type + nChannelID đúng với camera.channel |
| Simulate | type=MOTION auto description |
| List filter camera | Chỉ event camera đó |
| Ack | ack=true |
| Delete one | ok:true, affected 1 |
| Delete by camera | ok:true, affected >=0 (tất cả biến mất) |

### 6.7 PTZ
| Test | Input | Expected |
|------|-------|----------|
| Diagonal vector | action=PAN_RIGHT_DOWN speed=3 | vector.pan=3, vector.tilt=-3 |
| Throttle | Gửi 2 lệnh < throttleMs | throttled=true ở lần 2 |
| Logs prune | Gửi > PTZ_LOG_MAX lệnh | GET logs length <= PTZ_LOG_MAX |
| Advanced filter | /cameras/ptz/logs/advanced?nChannelID=X | Chỉ log channel X |

### 6.8 Roles / Negative
| Vai trò | Hành động cấm | Expected |
|---------|----------------|----------|
| VIEWER | POST /cameras | 403 |
| VIEWER | POST /recordings/start | 403 |
| VIEWER | POST /events | 403 |
| OPERATOR | Most write ops | 200 (trừ quản trị user nếu có giới hạn) |
| Không token | GET /cameras | 401 |

### 6.9 Lỗi / Edge Cases
| Case | Expected |
|------|----------|
| Camera sai ID | 404 NotFound |
| Recording stop sai ID | 404 |
| Playback PATCH status sau COMPLETED | 400 (finalized) |
| PTZ action không hợp lệ | 400 validation |
| Event delete sai ID | 404 |

## 7. Mini Checklist (đánh dấu PASS/FAIL khi chạy)
```
[ ] Auth login
[ ] Auth refresh
[ ] Camera create
[ ] Camera bulk
[ ] Camera verify
[ ] Snapshot capture
[ ] Recording start
[ ] Recording stop
[ ] Recording status filter
[ ] Playback create
[ ] Playback play->pause->play->stop
[ ] Playback auto complete
[ ] Playback finalized reject
[ ] Event create
[ ] Event simulate
[ ] Event ack
[ ] Event delete one
[ ] Event delete by camera
[ ] PTZ diagonal vector
[ ] PTZ throttle
[ ] PTZ logs prune
[ ] Advanced PTZ logs filter
[ ] RBAC viewer forbidden
```

## 8. Curl Ví dụ (tham khảo nhanh)
```bash
# Login
curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'

# Create camera
curl -s -X POST http://localhost:3000/cameras -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"name":"Cam1","ipAddress":"1.1.1.1","port":554,"username":"u","password":"p"}'

# Snapshot
curl -s -X POST http://localhost:3000/snapshots/capture -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"cameraId":"<CAM_ID>"}'

# Start recording
curl -s -X POST http://localhost:3000/recordings/start -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"cameraId":"<CAM_ID>","strategy":"FAKE"}'
```

## 9. Dọn dẹp (tuỳ chọn)
- DELETE từng recording / playback / event.
- Hoặc drop DB nếu chỉ là môi trường test cục bộ.

## 10. Ghi chú mở rộng
- Có thể tự động hoá các bước bằng một script Node.js gọi tuần tự.
- Thêm bước đo thời gian phản hồi (performance smoke) nếu cần.

Hoàn thành: Khi toàn bộ checklist PASS và không có lỗi 500 bất ngờ trong logs.

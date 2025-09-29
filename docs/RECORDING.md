# RECORDING (Ghi video)

Ghi một đoạn clip từ luồng RTSP bằng FFmpeg, lưu file cục bộ.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /recordings/start | Bắt đầu ghi (async) |
| GET | /recordings | Danh sách |
| GET | /recordings/:id | Chi tiết |

## Body POST
```json
{ "cameraId": "<uuid>", "durationSec": 30 }
```
`durationSec` mặc định nếu thiếu: 30 (tuỳ implement).

## Luồng
1. Tạo record status=PENDING.
2. Spawn ffmpeg (copy codec nếu có thể) ghi ra file.
3. Cập nhật RUNNING → COMPLETED hoặc FAILED.

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select -ExpandProperty accessToken

curl -Method POST -Uri http://localhost:3000/recordings/start -Headers @{Authorization="Bearer $token"} -Body '{"cameraId":"<id>","durationSec":10}' -ContentType 'application/json'

# Danh sách
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/recordings
```

## Trả về (start)
```json
{ "id": "...", "status": "PENDING", "storagePath": "C:/tmp/rec_x.mp4" }
```

## Lỗi phổ biến
| Lỗi | Giải thích |
|-----|-----------|
| 404 Camera not found | Sai cameraId |
| FFmpeg failed | Luồng không truy cập được, credential sai |

## Ghi chú
- Nên giới hạn thời lượng tối đa để tránh chiếm ổ cứng.
- Có thể chuyển sang kiến trúc job queue nếu cần scaling.
- Thêm HLS segmenter riêng nếu muốn streaming trực tiếp song song.

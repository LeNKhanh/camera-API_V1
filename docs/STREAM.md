# STREAM (URL tham chiếu)

Module minh hoạ cung cấp URL phát (HLS/DASH) dựa trên `STREAM_BASE_URL`. Không tự thực hiện chuyển mã hoặc segment; cần hạ tầng bên ngoài (SRS, nginx-rtmp, ffmpeg push, packager...).

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| GET | /streams/:cameraId/url?protocol=HLS|DASH | Trả về URL phát dự kiến |

## Ví dụ
`GET /streams/1e2d.../url?protocol=HLS`
```json
{ "cameraId": "1e2d...", "protocol": "HLS", "url": "http://localhost:8080/live/1e2d.../index.m3u8" }
```

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select -ExpandProperty accessToken

curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/streams/<id>/url?protocol=HLS
```

## Ghi chú / Hướng mở rộng
- Dùng ffmpeg hoặc gstreamer push RTSP -> RTMP -> HLS.
- Lưu manifest / segment trong CDN/Storage.
- Áp dụng token ký (signed URL) để bảo vệ.
- Thêm WebRTC cho độ trễ thấp.

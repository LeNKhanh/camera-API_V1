1. Đăng ký camera (IP, port, auth)
Hiện có: Module camera với CRUD trong CameraController (POST /cameras, GET /cameras, GET /cameras/:id, PATCH, DELETE).
Thiếu / Gợi ý:

Chưa có validate định dạng IP chuyên sâu (có thể bổ sung regex).
Chưa có kiểm tra “reachability” (ping RTSP) lúc tạo — có thể thêm endpoint /cameras/:id/verify.

2. Lấy danh sách camera
ĐÃ có: GET /cameras trả toàn bộ.
Gợi ý: Thêm filter query (enabled=true, name contains, vendor).

3. Xem live stream (proxy hoặc link)
Hiện có: StreamController với GET /streams/:cameraId/url trả URL giả lập HLS/DASH (cần hạ tầng streaming thật).
Chưa có:

Proxy trực tiếp RTSP → HLS (ffmpeg segmenter) chạy nội bộ.
WebSocket/MSE/FLV fallback.
Gợi ý nhanh (mức tối thiểu trước khi có SRS/nginx-rtmp):

Endpoint GET /streams/:cameraId/snapshot (dùng logic snapshot hiện có nhưng trả trực tiếp base64 / image/jpeg).
Endpoint GET /streams/:cameraId/mjpeg dựng tiến trình ffmpeg chuyển RTSP → mjpeg multipart (phù hợp lab/test).
Tạo service tạm spawn ffmpeg: ffmpeg -rtsp_transport tcp -i <rtsp> -vf scale=1280:-1 -f hls ... và lưu segment vào thư mục ./hls/<cameraId>/. URL trả về thật (file m3u8 cục bộ).

4. PTZ control (pan, tilt, zoom)
Hiện có: Mock qua NetSdkController:

PUT /netsdk/sessions/:handle/ptz (cần login tạo session trước).
Thiếu:
API trực tiếp theo cameraId (không cần session giả).
Mapping thân thiện (PAN_LEFT, ZOOM_IN) thay vì chuỗi lệnh raw.
Đề xuất:

Thêm PtzController với POST /cameras/:id/ptz body: { action: 'PAN_LEFT', speed?: number, durationMs?: number }.
Bên trong map action → lệnh Dahua giả (DH_PTZ_LEFT_CONTROL), sau durationMs gửi lệnh stop (nếu cần).
Cho phép strategy: MOCK (hiện tại) / ONVIF (sau).

5. Playback video
Hiện có: Chưa có “truy xuất bản ghi” ngoài Recording (ghi file rồi trả path).
Ghi hình: POST /recordings/start đã có (RTSP & FAKE).
Thiếu:

Endpoint liệt kê file playback theo khoảng thời gian (GET /playback?cameraId&from&to).
Endpoint trả URL HLS cắt theo time-range (cần segmenter).
Endpoint tải file: GET /recordings/:id/file (stream file mp4 trực tiếp).
Đề xuất ngắn hạn:

Thêm GET /recordings/:id/download trả file (stream).
Thêm chỉ mục thời gian (đã có startedAt / endedAt) → lọc theo query from/to.

6. Nhận & lưu sự kiện (motion detection, alarm)
ĐÃ có: EventController (POST /events, list, detail).
Thiếu:

Nguồn sinh tự động (webhook từ thiết bị, ONVIF Event, hoặc phân tích video).
Mức độ severity, ack flag.
Gợi ý:

Thêm trường ack (boolean) & endpoint POST /events/:id/ack.
Thêm type mới: ALARM, MOTION, VIDEO_LOSS, TAMPER.
Tạo endpoint giả lập motion: POST /cameras/:id/simulate-motion.
7. Bảng tổng trạng thái hiện tại
Mục tiêu	Trạng thái	Ghi chú
Đăng ký camera	OK	CRUD sẵn có
Danh sách camera	OK	Thiếu filter nâng cao
Live stream	PARTIAL	Chỉ trả URL giả; chưa có ffmpeg proxy
PTZ control	MOCK	Cần API thân thiện theo cameraId
Playback	PARTIAL	Có ghi nhưng chưa có download + lọc thời gian
Sự kiện	OK (cơ bản)	Chưa có ack & nguồn tự động



# Kiểm tra Port 8888 Public Access trên Server

## 1. Kiểm tra Port đang Listen

### Kiểm tra service đang lắng nghe port 8888:
```bash
# Linux/Ubuntu
sudo netstat -tlnp | grep 8888
# hoặc
sudo ss -tlnp | grep 8888
# hoặc
sudo lsof -i :8888
```

**Kết quả mong đợi:**
```
tcp        0      0 0.0.0.0:8888            0.0.0.0:*               LISTEN      12345/mediamtx
```

Nếu thấy `0.0.0.0:8888` → Port đang listen trên tất cả interfaces ✅
Nếu thấy `127.0.0.1:8888` → Chỉ listen localhost, cần sửa config ❌

## 2. Kiểm tra Firewall

### Ubuntu/Debian (ufw):
```bash
# Kiểm tra status
sudo ufw status

# Kiểm tra rule cho port 8888
sudo ufw status numbered | grep 8888

# Nếu chưa có, thêm rule:
sudo ufw allow 8888/tcp
sudo ufw reload
```

### CentOS/RHEL (firewalld):
```bash
# Kiểm tra status
sudo firewall-cmd --state

# Kiểm tra port 8888
sudo firewall-cmd --list-ports | grep 8888

# Nếu chưa có, thêm rule:
sudo firewall-cmd --permanent --add-port=8888/tcp
sudo firewall-cmd --reload
```

### iptables:
```bash
# Kiểm tra rules hiện tại
sudo iptables -L -n -v | grep 8888

# Nếu chưa có, thêm rule:
sudo iptables -A INPUT -p tcp --dport 8888 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

## 3. Test từ Server (Internal)

### Test với curl:
```bash
# Test HLS manifest
curl http://localhost:8888/camera_be5729fe/index.m3u8

# Test với IP internal của server
curl http://$(hostname -I | awk '{print $1}'):8888/camera_be5729fe/index.m3u8
```

**Kết quả mong đợi:**
```
#EXTM3U
#EXT-X-VERSION:9
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:...
```

## 4. Test từ Bên Ngoài (External)

### Từ máy tính khác hoặc điện thoại:

#### A. Test với curl (từ máy local):
```bash
# Thay YOUR_SERVER_IP bằng IP public của server
curl http://YOUR_SERVER_IP:8888/camera_be5729fe/index.m3u8

# Với domain:
curl http://proxy-camera.teknix.services:8888/camera_be5729fe/index.m3u8
```

#### B. Test với browser:
Mở browser và truy cập:
```
http://YOUR_SERVER_IP:8888/camera_be5729fe/
```

#### C. Test với telnet (kiểm tra port connectivity):
```bash
# Từ máy local
telnet YOUR_SERVER_IP 8888

# Hoặc dùng nc (netcat)
nc -zv YOUR_SERVER_IP 8888
```

**Kết quả:**
- ✅ Nếu kết nối được: `Connection to YOUR_SERVER_IP 8888 port [tcp/*] succeeded!`
- ❌ Nếu timeout: Port bị chặn bởi firewall hoặc security group

## 5. Kiểm tra Cloud Provider Security Groups

### Nếu dùng AWS EC2:
1. Vào EC2 Console → Security Groups
2. Tìm security group của instance
3. Kiểm tra **Inbound Rules**
4. Thêm rule:
   - Type: Custom TCP
   - Port: 8888
   - Source: 0.0.0.0/0 (hoặc specific IP)

### Nếu dùng DigitalOcean:
1. Vào Networking → Firewalls
2. Kiểm tra Inbound Rules
3. Thêm rule cho port 8888

### Nếu dùng Coolify/VPS:
Kiểm tra xem provider có firewall riêng không (ngoài firewall của OS)

## 6. Kiểm tra Coolify Domain Configuration

Vì bạn đang dùng Coolify, có 2 cách expose port 8888:

### Option A: Expose Port trực tiếp (HTTP)
Trong Coolify → MediaMTX service → Configuration → Network:

**Ports Exposes:**
```
80
```

**Ports Mappings:**
```
8554:8554,8888:8888,8889:8889,9997:9997
```

Sau đó test:
```bash
curl http://YOUR_SERVER_IP:8888/camera_be5729fe/index.m3u8
```

### Option B: Dùng Domain với Reverse Proxy (HTTPS) - RECOMMENDED ✅
Trong Coolify → MediaMTX service → Configuration → Domains:

**Thêm domain:**
```
proxy-camera.teknix.services
```

**Port mapping:**
```
8888
```

**Enable HTTPS:** Yes (Coolify sẽ tự động tạo SSL certificate)

Sau đó test:
```bash
curl https://proxy-camera.teknix.services/camera_be5729fe/index.m3u8
```

## 7. Debug Commands Tổng Hợp

```bash
# 1. Kiểm tra MediaMTX đang chạy
ps aux | grep mediamtx

# 2. Kiểm tra port 8888 listening
sudo netstat -tlnp | grep 8888

# 3. Kiểm tra firewall
sudo ufw status | grep 8888

# 4. Test local
curl -I http://localhost:8888/camera_be5729fe/index.m3u8

# 5. Lấy IP public của server
curl ifconfig.me

# 6. Test từ external (chạy từ máy local)
curl -I http://$(curl -s ifconfig.me):8888/camera_be5729fe/index.m3u8

# 7. Kiểm tra logs MediaMTX
docker logs mediamtx --tail 50

# 8. Test port connectivity
nc -zv YOUR_SERVER_IP 8888
```

## 8. Troubleshooting

### Lỗi: Connection refused
**Nguyên nhân:** Port chưa mở hoặc service chưa listen
**Giải pháp:**
```bash
# Kiểm tra MediaMTX có đang chạy không
docker ps | grep mediamtx

# Restart container
docker restart mediamtx

# Kiểm tra logs
docker logs mediamtx --tail 100
```

### Lỗi: Connection timeout
**Nguyên nhân:** Firewall chặn port
**Giải pháp:**
```bash
# Mở port firewall
sudo ufw allow 8888/tcp
sudo ufw reload

# Kiểm tra cloud provider security groups
```

### Lỗi: 404 Not Found
**Nguyên nhân:** Camera chưa được đăng ký hoặc stream chưa sẵn sàng
**Giải pháp:**
```bash
# Kiểm tra danh sách cameras
curl http://localhost:9997/v3/paths/list | jq

# Đăng ký lại camera từ Camera API
curl -X POST http://localhost:3000/streams/YOUR_CAMERA_ID/proxy
```

## Recommended: Dùng Domain với HTTPS

Để có setup production tốt nhất:

1. **Trong Coolify → MediaMTX service → Domains:**
   - Thêm: `proxy-camera.teknix.services`
   - Port: `8888`
   - HTTPS: Enable

2. **Update Camera API environment:**
   ```bash
   MEDIAMTX_HOST=proxy-camera.teknix.services
   MEDIAMTX_HLS_PORT=443
   MEDIAMTX_USE_HTTPS=true
   ```

3. **Test:**
   ```bash
   # Từ browser hoặc curl
   https://proxy-camera.teknix.services/camera_be5729fe/
   ```

**Ưu điểm:**
- ✅ HTTPS encryption
- ✅ Không cần port trong URL
- ✅ SSL certificate tự động (Let's Encrypt)
- ✅ Tương thích tốt với browser

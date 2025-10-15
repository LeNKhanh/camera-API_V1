# PTZ Không Hoạt Động Trên Production - Network Issue

## 🔴 Vấn đề

**Logs production:**
```
[ONVIF PTZ] ContinuousMove error: ONVIF SOAP Fault: Unknown Error
[ONVIF PTZ] RelativeMove error: ONVIF SOAP Fault: Unknown Error
[ONVIF] SmartMove failed: ONVIF SOAP Fault: Unknown Error
```

**Triệu chứng:**
- ✅ Local: PTZ hoạt động bình thường
- ❌ Production: PTZ fail với "ONVIF SOAP Fault: Unknown Error"
- ✅ Database insert thành công (schema đã fix)
- ✅ ONVIF connection cached (connect OK lúc đầu)

---

## 🎯 Nguyên nhân: NETWORK CONNECTIVITY

### Camera không thể truy cập từ Production Server

**Camera IP:** `192.168.1.66` (Private LAN)  
**Production server:** Coolify (có thể ở VPS/Cloud khác network)

**Tại sao local OK?**
- Máy dev và camera cùng mạng LAN `192.168.1.x`
- Có thể ping, connect trực tiếp tới camera

**Tại sao production fail?**
- Production server **KHÔNG TRONG CÙNG MẠNG** với camera
- IP `192.168.1.66` là private, không accessible từ internet
- Firewall/NAT blocking traffic

---

## 🔍 Cách kiểm tra

### Chạy script test trên production:

```bash
# SSH vào production server hoặc dùng Coolify terminal
node scripts/test-camera-network.js
```

**Kết quả mong đợi nếu OK:**
```
✅ Ping successful
✅ TCP connection successful to 192.168.1.66:80
✅ ONVIF connection successful!
```

**Kết quả nếu có vấn đề:**
```
❌ Ping failed: Name or service not known
❌ TCP connection timeout after 5000ms
❌ CAMERA NOT ACCESSIBLE FROM PRODUCTION SERVER
```

---

## ✅ Giải pháp

### **Option 1: VPN/Tunnel (Khuyến nghị cho production)**

**Dùng WireGuard/OpenVPN:**
```bash
# Cài WireGuard client trên production server
# Connect tới VPN của mạng camera
# Camera sẽ accessible qua VPN tunnel
```

**Hoặc SSH Reverse Tunnel:**
```bash
# Từ máy local (cùng mạng camera)
ssh -R 8080:192.168.1.66:80 user@production-server

# Production server sẽ access camera qua localhost:8080
# Update .env: CAMERA_IP=localhost, ONVIF_PORT=8080
```

---

### **Option 2: Port Forwarding**

**Trên router mạng camera:**
1. Forward port ONVIF (80) → Public IP
2. Ví dụ: `203.0.113.10:8080 → 192.168.1.66:80`
3. Update production .env:
   ```
   CAMERA_IP=203.0.113.10
   ONVIF_PORT=8080
   ```

**⚠️ Security risk:** Camera exposed to internet!

---

### **Option 3: Deploy trong cùng mạng**

**Cài app trên máy local cùng mạng camera:**
- Raspberry Pi
- NUC / Mini PC
- Server on-premise

**Ưu điểm:**
- Không cần VPN/port forwarding
- Latency thấp
- Secure (không expose camera)

---

### **Option 4: Tắt ONVIF, dùng HTTP API**

**Nếu không thể setup network:**

1. **Port forward HTTP API thay vì ONVIF:**
   ```
   Public:8081 → 192.168.1.66:80 (Dahua CGI)
   ```

2. **Disable ONVIF trong production:**
   ```bash
   # .env production
   PTZ_USE_ONVIF=0  # Dùng HTTP API
   CAMERA_IP=203.0.113.10
   SDK_PORT=8081
   ```

3. **PTZ sẽ dùng Dahua HTTP API:**
   ```
   http://203.0.113.10:8081/cgi-bin/ptz.cgi?action=start&code=Right&...
   ```

**Ưu điểm:**
- Không cần ONVIF port
- HTTP API đơn giản hơn
- Dahua HTTP API stable

**Nhược điểm:**
- Mất tính năng ONVIF advanced
- Vendor-specific (chỉ Dahua)

---

## 🧪 Test từng bước

### Test 1: Ping
```bash
ping -c 4 192.168.1.66
```

### Test 2: TCP connection
```bash
nc -zv 192.168.1.66 80
# hoặc
telnet 192.168.1.66 80
```

### Test 3: ONVIF request
```bash
curl -X POST http://192.168.1.66/onvif/device_service \
  --digest -u aidev:Aidev@123 \
  -H "Content-Type: application/soap+xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <GetDeviceInformation xmlns="http://www.onvif.org/ver10/device/wsdl"/>
  </s:Body>
</s:Envelope>'
```

**Nếu OK:** Nhận được XML response
**Nếu fail:** Timeout hoặc connection refused

---

## 📊 Kiến trúc mạng

### Hiện tại (Problematic):
```
[Camera 192.168.1.66] ←→ [Local Dev Machine] ✅
         ↓
     (Internet)
         ↓
[Production Server] ❌ Cannot reach 192.168.1.66
```

### Solution 1 - VPN:
```
[Camera 192.168.1.66] ←→ [VPN Gateway]
                              ↓
                          (Internet)
                              ↓
[Production Server] ←→ [VPN Client] ✅
```

### Solution 2 - Port Forward:
```
[Camera 192.168.1.66] ←→ [Router NAT]
                              ↓
                         Public IP:8080
                              ↓
                          (Internet)
                              ↓
[Production Server] → Public IP:8080 ✅
```

### Solution 3 - Same Network:
```
[Camera 192.168.1.66] ←→ [App on Raspberry Pi] ✅
      (Same LAN)
```

---

## 🔧 Quick Fix cho testing

**Tạm thời disable ONVIF trên production:**

```bash
# Coolify environment variables
PTZ_USE_ONVIF=0
```

**Redeploy → PTZ sẽ dùng HTTP API**

**Logs sẽ thay đổi từ:**
```
[PTZ ONVIF] Command failed: ONVIF SOAP Fault: Unknown Error
```

**Thành:**
```
[PTZ HTTP] PTZ Command sent successfully!
Response status: 200
```

---

## ✅ Checklist

- [ ] Chạy `scripts/test-camera-network.js` trên production
- [ ] Xác định network issue (ping/tcp fail?)
- [ ] Chọn solution phù hợp:
  - [ ] VPN setup
  - [ ] Port forwarding
  - [ ] Deploy on-premise
  - [ ] Disable ONVIF, use HTTP API
- [ ] Test PTZ sau khi fix
- [ ] Document network setup cho team

---

## 📝 Notes

**"ONVIF SOAP Fault: Unknown Error"** thường là:
1. **Network timeout** (không reach được camera) ← Most likely
2. Authentication failed (nhưng connection OK thì không phải)
3. Camera không support method đó (nhưng ContinuousMove + RelativeMove đều fail → network issue)

**Evidence:** Cả ContinuousMove VÀ RelativeMove VÀ Stop đều fail → Rất rõ ràng là network connectivity issue.

# 🔐 MediaMTX Authentication Setup - Fix 401 Error

## 🎯 Vấn Đề

Khi gọi MediaMTX API từ Docker container (IP khác localhost), bị lỗi:
```
Request failed with status code 401 Unauthorized
```

**Nguyên nhân:** MediaMTX yêu cầu authentication khi truy cập API từ IP khác `127.0.0.1`

**Tham khảo:** https://github.com/bluenviron/mediamtx/discussions/3256

---

## ✅ Giải Pháp

### 1️⃣ **Cập Nhật MediaMTX Config**

File: `mediamtx/mediamtx.yml`

```yaml
###############################################
# Global settings -> API

api: yes
apiAddress: 0.0.0.0:9997

# API authentication - REQUIRED for non-localhost access
authInternalUsers:
  - user: api_user
    pass: api_pass_2024
    ips: []  # Empty = allow from all IPs
    permissions:
      - action: api
```

**Giải thích:**
- `user` & `pass`: Credentials cho API access
- `ips: []`: Cho phép tất cả IP (bao gồm Docker containers)
- `permissions: [action: api]`: Cho phép thao tác trên API

---

### 2️⃣ **Cập Nhật NestJS Code**

File: `src/modules/stream/stream.service.ts`

```typescript
private async registerCameraWithMediaMTX(
  pathName: string,
  sourceUrl: string,
  apiUrl: string,
): Promise<void> {
  const addUrl = `${apiUrl}/v3/config/paths/add/${pathName}`;
  
  try {
    // Authentication header - Base64 encode "user:pass"
    const authHeader = 'Basic ' + Buffer.from('api_user:api_pass_2024').toString('base64');
    
    // Check if path exists
    const checkUrl = `${apiUrl}/v3/config/paths/get/${pathName}`;
    try {
      await axios.get(checkUrl, { 
        headers: { 'Authorization': authHeader },
        timeout: 5000,
      });
      console.log(`[MediaMTX] Camera ${pathName} already registered`);
      return;
    } catch (checkError) {
      // Path doesn't exist, continue
    }

    // Register new camera
    const config = {
      source: sourceUrl,
      sourceProtocol: 'automatic',
      sourceAnyPortEnable: false,
    };

    await axios.post(addUrl, config, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': authHeader,  // ✅ ADD THIS
      },
      timeout: 10000,
    });

    console.log(`[MediaMTX] SUCCESS: Camera ${pathName} registered`);
  } catch (error) {
    // Error handling...
  }
}
```

---

### 3️⃣ **Environment Variables (Optional - Recommended for Production)**

Thay vì hardcode credentials, dùng environment variables:

**.env:**
```bash
# MediaMTX Authentication
MEDIAMTX_API_USER=api_user
MEDIAMTX_API_PASS=api_pass_2024
```

**Code update:**
```typescript
const username = process.env.MEDIAMTX_API_USER || 'api_user';
const password = process.env.MEDIAMTX_API_PASS || 'api_pass_2024';
const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
```

---

## 🚀 Deploy to Production (Coolify)

### **Step 1: Update Config File**

```bash
# SSH to production server
cd /path/to/mediamtx

# Create updated config
cat > mediamtx.yml << 'EOF'
api: yes
apiAddress: 0.0.0.0:9997

authInternalUsers:
  - user: api_user
    pass: api_pass_2024
    ips: []
    permissions:
      - action: api

rtspAddress: :8554
hlsAddress: :8888
webrtcAddress: :8889

logLevel: info
logDestinations: [stdout]

paths: {}
EOF

# Copy to container
docker cp mediamtx.yml mediamtx:/mediamtx.yml

# Restart MediaMTX
docker restart mediamtx

# Wait and check logs
sleep 5
docker logs mediamtx --tail 30
```

### **Step 2: Commit and Deploy API Code**

```bash
# On your local machine
git add .
git commit -m "feat: Add MediaMTX API authentication to fix 401 error"
git push origin main

# Coolify will auto-deploy
```

### **Step 3: Verify**

```bash
# Test from API container
docker ps | grep bow0qs  # Get API container ID

# Test with authentication
docker exec <API_CONTAINER_ID> curl -v \
  -H "Authorization: Basic $(echo -n 'api_user:api_pass_2024' | base64)" \
  http://mediamtx:9997/v3/config/global/get

# Should return 200 OK with JSON config
```

---

## 🧪 Testing

### **Test 1: Manual Camera Registration**

```bash
# From API container
docker exec <API_CONTAINER_ID> curl -v -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'api_user:api_pass_2024' | base64)" \
  -d '{"source":"rtsp://admin:admin@192.168.1.66:554/cam/realmonitor?channel=1&subtype=0","sourceProtocol":"automatic"}' \
  http://mediamtx:9997/v3/config/paths/add/test_camera

# Expected: 200 OK
```

### **Test 2: Via API Endpoint**

```bash
# Call your NestJS API
curl http://your-api-domain.com/streams/camera_id/proxy

# Check logs for success message:
# [MediaMTX] SUCCESS: Camera camera_xxx registered
```

### **Test 3: VLC Playback**

```bash
vlc rtsp://your-mediamtx-domain.com:8554/camera_xxx
```

---

## 🔒 Security Best Practices

### **1. Use Strong Passwords**
```yaml
authInternalUsers:
  - user: api_admin
    pass: "$(openssl rand -base64 32)"  # Generate strong password
    ips: []
    permissions:
      - action: api
```

### **2. Restrict by IP (if possible)**
```yaml
authInternalUsers:
  - user: api_user
    pass: secure_password
    ips: ['172.17.0.0/16']  # Only allow Docker network
    permissions:
      - action: api
```

### **3. Use Environment Variables**
```bash
# In Coolify Environment Variables
MEDIAMTX_API_USER=admin
MEDIAMTX_API_PASS=<secure-random-password>
```

### **4. Rotate Credentials Regularly**
- Change password every 90 days
- Use different credentials for prod/dev
- Store in secure vault (e.g., AWS Secrets Manager)

---

## 📝 Checklist

- [x] Update `mediamtx.yml` with `authInternalUsers`
- [x] Add `Authorization` header in NestJS code
- [x] Copy config to production container
- [x] Restart MediaMTX
- [x] Commit and push code changes
- [x] Test manual registration
- [x] Test via API endpoint
- [x] Test VLC playback
- [ ] Update credentials to use env vars (recommended)
- [ ] Document credentials in team password manager

---

## 🐛 Troubleshooting

### **Still Getting 401?**

1. **Check auth header encoding:**
```bash
echo -n 'api_user:api_pass_2024' | base64
# Should output: YXBpX3VzZXI6YXBpX3Bhc3NfMjAyNA==
```

2. **Verify config in container:**
```bash
docker exec mediamtx sh -c 'grep -A 5 authInternalUsers /mediamtx.yml'
```

3. **Check MediaMTX logs:**
```bash
docker logs mediamtx --tail 50 | grep -i auth
```

### **Connection Reset by Peer?**

- Means API is running but rejecting connection
- Usually indicates missing/wrong credentials
- Try with correct auth header

---

## 📚 References

- **MediaMTX GitHub Issue:** https://github.com/bluenviron/mediamtx/discussions/3256
- **MediaMTX Authentication Docs:** https://github.com/bluenviron/mediamtx#authentication
- **Base64 RFC:** https://datatracker.ietf.org/doc/html/rfc4648

---

**Status:** ✅ Solution verified  
**Last Updated:** 2025-10-21  
**Author:** Camera API Team

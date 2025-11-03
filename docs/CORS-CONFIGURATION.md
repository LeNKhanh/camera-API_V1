# CORS Configuration Guide

## Problem
Frontend (running on `localhost:3333` or Vercel) cannot fetch data from production API due to CORS errors.

## Root Cause
Production backend's `CORS_ORIGINS` environment variable doesn't include the frontend origin.

## Solution

### For Production Deployment (Coolify)

1. **SSH vào production server hoặc mở Coolify dashboard**

2. **Thêm/Update biến môi trường `CORS_ORIGINS`:**

```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:3333,http://localhost:5173,http://localhost:5500,http://127.0.0.1:5500,https://watcher-fe-self.vercel.app,https://watcher-test.vercel.app,https://watcher-gateway.blocktrend.xyz,https://camera-api.teknix.services,/https:\/\/.*\.vercel\.app$/
```

**Important:** Include ALL origins you want to allow:
- `http://localhost:3333` - For local testing against production API
- `https://watcher-fe-self.vercel.app` - Production frontend on Vercel
- `/https:\/\/.*\.vercel\.app$/` - Regex to allow all Vercel preview deployments

3. **Restart backend service:**
```bash
# In Coolify: Click "Restart" button
# Or via command line:
docker restart <container-name>
```

### For Local Development

Edit `.env` file:
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:3333,http://localhost:5173,http://localhost:5500,http://127.0.0.1:5500,https://watcher-fe-self.vercel.app,https://watcher-test.vercel.app,https://watcher-gateway.blocktrend.xyz,https://camera-api.teknix.services,/https:\/\/.*\.vercel\.app$/
```

## Verification

### Check if CORS is configured correctly

1. **View startup logs:**
```bash
# Look for these lines when backend starts:
[CORS] Configured origins: [ 'http://localhost:3333', ... ]
[CORS] Environment CORS_ORIGINS: SET
```

2. **Test from browser console:**
```javascript
fetch('https://watcher-gateway.blocktrend.xyz/api/v1/camera/health', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

3. **Check response headers:**
Open DevTools → Network tab → Look for:
```
Access-Control-Allow-Origin: http://localhost:3333
Access-Control-Allow-Credentials: true
```

### Common Issues

#### Issue 1: "CORS blocked origin" in logs
**Solution:** Origin not in whitelist. Add it to `CORS_ORIGINS`.

#### Issue 2: CORS error but backend returns 500
**Problem:** Backend error occurs before CORS headers are added.
**Solution:** Fix the 500 error first (check logs), CORS headers will be added automatically.

#### Issue 3: Works in Postman but not in browser
**Reason:** Postman doesn't enforce CORS (server-to-server). Browser enforces CORS policy.
**Solution:** Ensure origin is whitelisted.

## Code Changes Made

### `src/main.ts`

1. **Changed error handling:**
   - Before: `callback(new Error('Not allowed by CORS'))` → Breaks error responses
   - After: `callback(null, false)` → Cleaner rejection

2. **Added debug logging:**
   ```typescript
   console.log('[CORS] Configured origins:', corsOrigins);
   console.log('[CORS] Blocked origin:', origin);
   console.log('[CORS] Allowed origins:', corsOrigins);
   ```

3. **NestJS auto-adds CORS headers to ALL responses** (including errors) when configured properly.

## Testing Checklist

- [ ] Backend logs show correct CORS_ORIGINS on startup
- [ ] Frontend can fetch from `/health` endpoint
- [ ] Network tab shows `Access-Control-Allow-Origin` header in response
- [ ] No "CORS policy" errors in browser console
- [ ] Works from both localhost:3333 and Vercel deployment

## Environment Variables Template

### Production (Coolify)
```bash
CORS_ORIGINS=http://localhost:3333,https://watcher-fe-self.vercel.app,/https:\/\/.*\.vercel\.app$/
```

### Development (Local .env)
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:3333,http://localhost:5173
```

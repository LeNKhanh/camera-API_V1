# Fix Recording Response - Hide Local Paths

## Vấn Đề

Recording API vẫn trả về local path `C:\tmp\...` trong response khi call GET `/recordings/:id`, mặc dù đã fix `startRecording()`.

## Root Cause

✅ **`startRecording()`** - Đã fix, không trả về `storagePath` trong response  
❌ **`getRecording()`** - CHƯA fix, vẫn trả về toàn bộ entity bao gồm `storagePath` local  
❌ **`listRecordingsFiltered()`** - CHƯA fix, vẫn trả về `storagePath` local  
❌ **`listRecordings()`** - CHƯA fix, vẫn trả về `storagePath` local

## Giải Pháp

Transform response của tất cả GET endpoints để:

### Logic:

**FAILED/PENDING/RUNNING:**
- Nếu `storagePath` là local path → XOÁ khỏi response (không expose)
- Nếu `storagePath` là R2 URL → giữ lại (an toàn để expose)

**COMPLETED/STOPPED:**
- `storagePath` đã được update thành R2 URL bởi `uploadRecordingToR2()` → an toàn để trả về

## Code Changes

### 1. `getRecording()` - GET /recordings/:id

```typescript
async getRecording(id: string) {
  const rec = await this.recRepo.findOne({ where: { id }, relations: ['camera'] });
  if (!rec) throw new NotFoundException('Recording not found');
  
  // Transform response: hide local temp path, only show R2 URL if available
  const response: any = { ...rec };
  
  // If FAILED/PENDING/RUNNING and storagePath is local, don't expose it
  if (['FAILED', 'PENDING', 'RUNNING'].includes(rec.status)) {
    if (rec.storagePath && !this.storageService.isR2Url(rec.storagePath)) {
      delete response.storagePath;
    }
  }
  
  return response;
}
```

### 2. `listRecordingsFiltered()` - GET /recordings?cameraId=...

```typescript
async listRecordingsFiltered(opts: { cameraId?: string; status?: string; from?: string; to?: string }) {
  const qb = this.recRepo.createQueryBuilder('r')
    .leftJoinAndSelect('r.camera', 'c')
    .orderBy('r.startedAt', 'DESC');
  if (opts.cameraId) qb.andWhere('c.id = :cid', { cid: opts.cameraId });
  if (opts.status) qb.andWhere('r.status = :status', { status: opts.status.toUpperCase() });
  if (opts.from) qb.andWhere('r.startedAt >= :from', { from: new Date(opts.from) });
  if (opts.to) qb.andWhere('r.startedAt <= :to', { to: new Date(opts.to) });
  const recordings = await qb.getMany();
  
  // Transform response: hide local temp paths
  return recordings.map(rec => {
    const response: any = { ...rec };
    
    if (['FAILED', 'PENDING', 'RUNNING'].includes(rec.status)) {
      if (rec.storagePath && !this.storageService.isR2Url(rec.storagePath)) {
        delete response.storagePath;
      }
    }
    
    return response;
  });
}
```

### 3. `listRecordings()` - Internal method

```typescript
async listRecordings(cameraId?: string) {
  const recordings = cameraId 
    ? await this.recRepo.find({ where: { camera: { id: cameraId } }, relations: ['camera'] })
    : await this.recRepo.find({ relations: ['camera'] });
  
  // Transform response: hide local temp paths
  return recordings.map(rec => {
    const response: any = { ...rec };
    
    if (['FAILED', 'PENDING', 'RUNNING'].includes(rec.status)) {
      if (rec.storagePath && !this.storageService.isR2Url(rec.storagePath)) {
        delete response.storagePath;
      }
    }
    
    return response;
  });
}
```

## API Response Examples

### Before Fix:

```json
{
  "id": "xxx",
  "status": "FAILED",
  "storagePath": "C:\\tmp\\2d0d31eb-33d5-4df6-bd90-6b6994092ff8.mp4",  ← EXPOSED!
  "errorMessage": "FFMPEG_RTSP_CONNECTION...",
  "camera": {...}
}
```

### After Fix:

```json
{
  "id": "xxx",
  "status": "FAILED",
  // storagePath is hidden
  "errorMessage": "FFMPEG_RTSP_CONNECTION...",
  "camera": {...}
}
```

### Successful Recording (COMPLETED):

```json
{
  "id": "xxx",
  "status": "COMPLETED",
  "storagePath": "https://iotek.tn-cdn.net/recordings/camera-id/12345.mp4",  ← R2 URL
  "camera": {...}
}
```

## Files Modified

- ✅ `src/modules/recording/recording.service.ts`
  - `getRecording()` - Transform response
  - `listRecordingsFiltered()` - Transform response
  - `listRecordings()` - Transform response

## Testing

### 1. Test FAILED recording:
```bash
curl http://localhost:3000/recordings/{id} -H "Authorization: Bearer TOKEN"
```
**Expected:** No `storagePath` field in response (or only if R2 URL)

### 2. Test COMPLETED recording:
```bash
# Wait for recording to complete and upload to R2
curl http://localhost:3000/recordings/{id} -H "Authorization: Bearer TOKEN"
```
**Expected:** `storagePath` is R2 URL like `https://iotek.tn-cdn.net/...`

### 3. Test list recordings:
```bash
curl http://localhost:3000/recordings?cameraId=xxx -H "Authorization: Bearer TOKEN"
```
**Expected:** FAILED/PENDING/RUNNING recordings don't show local paths

## Next Steps

1. ✅ Fix response transformation
2. 🔍 Debug why recording status is FAILED:
   - Run `scripts/test-recording-debug.ps1` to test camera RTSP connectivity
   - Check `error_message` column in database
   - Enable `DEBUG_RECORDING=1` in `.env`
   - Verify camera RTSP URL/credentials

## Security

✅ Local filesystem paths never exposed in API responses  
✅ Only R2 public URLs shown to clients  
✅ Database still stores local paths for internal processing (temp files)  
✅ Cleanup happens after R2 upload success

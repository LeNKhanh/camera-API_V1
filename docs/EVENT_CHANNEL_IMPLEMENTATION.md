# Event nChannelID Feature - Implementation Summary

## 🎯 Mục tiêu
Thêm cột `nChannelID` vào bảng `events` để lưu trữ channel của camera tại thời điểm event xảy ra, và hỗ trợ filter theo channel trong API.

## ✅ Đã hoàn thành

### 1. Database Schema Update

**Migration**: `1759403000000-add-events-nchannel.ts`
- ✅ Thêm cột `nChannelID` (integer, NOT NULL, default: 1)
- ✅ Backfill dữ liệu cũ từ `cameras.channel`
- ✅ Migration đã chạy thành công (verified in database)

**Schema mới**:
```sql
CREATE TABLE events (
  id uuid PRIMARY KEY,
  camera_id uuid REFERENCES cameras(id) ON DELETE CASCADE,
  nChannelID int NOT NULL DEFAULT 1,  -- ✅ NEW COLUMN
  type varchar(50) NOT NULL,
  description text,
  ack boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. Entity Update

**File**: `src/typeorm/entities/event.entity.ts`

```typescript
@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  // ✅ NEW COLUMN
  @Column({ name: 'nChannelID', type: 'int', default: 1 })
  nChannelID: number;

  @Column({ type: 'varchar', length: 50 })
  type: EventType;
  
  // ... other fields
}
```

### 3. Service Logic Update

**File**: `src/modules/event/event.service.ts`

**Feature 1**: Auto-populate `nChannelID` from camera when creating event
```typescript
async create(dto: { cameraId: string; type: any; description?: string }) {
  const cam = await this.camRepo.findOne({ where: { id: dto.cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');
  
  const ev = this.eventRepo.create({
    camera: cam,
    nChannelID: cam.channel || 1, // ✅ Auto-populate from camera
    type: dto.type,
    description: dto.description,
  } as any);
  return this.eventRepo.save(ev);
}
```

**Feature 2**: Filter support for `nChannelID` and `cameraId`
```typescript
list(cameraId?: string, nChannelID?: number) {
  const where: any = {};
  if (cameraId) where.camera = { id: cameraId };
  if (nChannelID !== undefined) where.nChannelID = nChannelID; // ✅ Filter by channel
  
  return this.eventRepo.find({
    where: Object.keys(where).length > 0 ? where : undefined,
    relations: ['camera'],
    order: { createdAt: 'DESC' },
  });
}
```

### 4. Controller Update

**File**: `src/modules/event/event.controller.ts`

```typescript
@Get()
@Roles('ADMIN', 'OPERATOR', 'VIEWER')
list(
  @Query('cameraId') cameraId?: string,
  @Query('nChannelID') nChannelID?: string, // ✅ NEW QUERY PARAM
) {
  const channelNum = nChannelID ? parseInt(nChannelID, 10) : undefined;
  return this.svc.list(cameraId, channelNum);
}
```

### 5. Documentation Update

**File**: `docs/EVENT.md`

**Schema table**: ✅ Added `nChannelID` column description
**Query parameters**: ✅ Added examples for filtering
**Response examples**: ✅ Updated to include `nChannelID` field
**Test commands**: ✅ Added PowerShell examples for filtering

---

## 🧪 Testing & Verification

### Database Verification ✅
```bash
npx ts-node scripts/check-events-schema.ts
```
**Result**: 
- Column `nChannelID` exists with type `integer`, default `1`
- Existing data backfilled correctly (channel 1 and 2 events verified)

### Query Filter Test ✅
```bash
npx ts-node scripts/test-event-filter.ts
```
**Result**:
- Filter by `nChannelID = 2`: 2 events returned
- Filter by `nChannelID = 1`: 1 event returned
- Count by channel: Works correctly

### API Test Script Created 📝
```bash
scripts/test-event-api.ps1
```
**Note**: Requires server running. Manual test needed.

---

## 📋 API Usage Examples

### 1. Create Event (auto-populate nChannelID)
```powershell
POST /events
Body: {
  "cameraId": "<uuid>",
  "type": "MOTION",
  "description": "Motion detected"
}
# Response includes nChannelID from camera.channel
```

### 2. Filter by Channel
```powershell
# Get all events on channel 2
GET /events?nChannelID=2

# Get events for specific camera on channel 2
GET /events?cameraId=<uuid>&nChannelID=2
```

### 3. Simulate Motion (auto-populate nChannelID)
```powershell
POST /events/simulate-motion/<cameraId>
# Creates MOTION event with nChannelID from camera
```

---

## 🎯 Key Design Decisions

### 1. **Snapshot Pattern**
Event stores `nChannelID` at time of creation (snapshot), NOT a live reference.
- **Pro**: Historical accuracy - if camera channel changes, old events keep original channel
- **Con**: Not dynamic - doesn't reflect current camera channel

### 2. **Auto-populate from Camera**
`nChannelID` is NOT sent in request body, automatically taken from `cameras.channel`
- **Pro**: Single source of truth (camera entity)
- **Pro**: Less prone to user error
- **Con**: Can't manually override (by design)

### 3. **Backfill Strategy**
Migration backfills existing events with current camera channel value
- Events without matching camera: default to `1`
- Events with camera: use `cameras.channel`

### 4. **Filter Support**
Controller accepts both `cameraId` and `nChannelID` query params
- Can use independently or combined
- TypeORM `where` clause supports both filters

---

## 🚀 How to Use (Manual Testing)

### Step 1: Start Server
```bash
npm run start:dev
```

### Step 2: Run API Tests
```powershell
# Login
$login = Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login `
  -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json'
$token = $login.accessToken

# Test filter by channel
Invoke-RestMethod -Uri "http://localhost:3000/events?nChannelID=2" `
  -Headers @{ Authorization="Bearer $token" }

# Create event (channel auto-populated)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/events `
  -Headers @{ Authorization="Bearer $token" } `
  -Body '{"cameraId":"<uuid>","type":"ALERT","description":"Test"}' `
  -ContentType 'application/json'
```

---

## 📊 Database State

**Current events**:
- Total: 3 events
- Channel 1: 1 event (ALERT)
- Channel 2: 2 events (MOTION)

**Migration history**:
- Latest: `AddEventsNChannel1759403000000` (id=11)
- Status: ✅ Applied successfully

---

## 🔍 Related Features

This change aligns with similar multi-channel tracking in:
- `ptz_logs.nChannelID` - Tracks PTZ commands by channel
- `snapshots.channel` - Stores snapshot source channel
- `recordings.channel` - Records video by channel
- `cameras.channel` - Master channel definition

---

## ✅ Checklist

- [x] Entity updated with `nChannelID` column
- [x] Migration created and executed
- [x] Service updated to auto-populate from camera
- [x] Service updated to support filter
- [x] Controller updated to accept query param
- [x] Documentation updated (EVENT.md)
- [x] Database verification completed
- [x] Query filter test completed
- [ ] API endpoint test (requires running server)
- [ ] Integration test with frontend (pending)

---

## 🎓 Learning Points

1. **TypeORM Column Default**: Use `@Column({ default: 1 })` for entity-level default
2. **Migration Column Default**: Use `TableColumn({ default: 1 })` for DB-level default
3. **Backfill Pattern**: Always backfill when adding NOT NULL column to existing table
4. **Filter Pattern**: Build dynamic `where` object for optional filters
5. **Query Param Parsing**: `parseInt(queryParam, 10)` to convert string to number

---

## 📝 Notes for Team

- **Breaking Change**: None (additive feature)
- **Backward Compatibility**: ✅ Yes (defaults to channel 1)
- **Performance Impact**: Minimal (indexed via camera_id FK)
- **Future Enhancement**: Consider adding index on `nChannelID` if filtering becomes frequent

---

**Implementation Date**: October 2, 2025
**Status**: ✅ Complete (pending server integration test)
**Migration ID**: 1759403000000

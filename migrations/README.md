# Database Migrations

## Overview
This project uses **TypeORM migrations** for database schema management.

## Migration Files
Location: `src/migrations/`

Current migrations:
- `1700000000000-initial-schema.ts` - Initial database schema with all tables

## How It Works

### Development
```bash
# Generate new migration
npm run migration:generate

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Production
Migrations run automatically on app start via `scripts/run-migrations-prod.js`:
```bash
npm run start
# → runs migrations → starts app
```

## Database Schema

### Tables Created by Initial Migration
- `users` - User accounts and authentication
- `cameras` - Camera devices configuration
- `ptz_logs` - PTZ command history (full schema with all fields)
- `recordings` - Video recording metadata
- `snapshots` - Image snapshot metadata
- `events` - Camera events and alerts
- `playbacks` - Playback session tracking

### PTZ Logs Schema
The `ptz_logs` table includes:
- `ILoginID` (uuid) - Camera reference
- `nChannelID` (int) - Camera channel
- `action` (varchar) - PTZ action type
- `command_code` (int) - Vendor command code
- `speed` (int) - Movement speed
- `vector_pan`, `vector_tilt`, `vector_zoom` (int) - Movement vectors
- `duration_ms` (int) - Movement duration
- `param1`, `param2`, `param3` (int) - Vendor-specific parameters

## Notes

- Initial schema includes **complete ptz_logs schema** with all required fields
- Fresh database installations will have correct schema from start
- No manual SQL migrations needed
- All migrations are tracked in `migrations` table

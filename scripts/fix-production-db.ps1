# Script chạy SQL fix production database
# Sử dụng: .\scripts\fix-production-db.ps1 -Method [reset|alter]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('reset', 'alter')]
    [string]$Method
)

# Load .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
}

$DATABASE_URL = $env:DATABASE_URL
if (-not $DATABASE_URL) {
    Write-Error "DATABASE_URL not found in environment"
    exit 1
}

Write-Host "🔧 Fixing production database schema..." -ForegroundColor Cyan

if ($Method -eq 'reset') {
    Write-Host "⚠️  CÁCH 1: Xóa migration record và bảng ptz_logs cũ" -ForegroundColor Yellow
    Write-Host "📋 SQL sẽ chạy:" -ForegroundColor Gray
    Get-Content scripts\fix-production-schema.sql | Write-Host -ForegroundColor DarkGray
    
    $confirm = Read-Host "`n⚠️  Xác nhận xóa bảng ptz_logs? (yes/no)"
    if ($confirm -eq 'yes') {
        $sql = Get-Content scripts\fix-production-schema.sql -Raw
        $sql | node -e "const pg = require('pg'); const sql = require('fs').readFileSync(0, 'utf-8'); const client = new pg.Client(process.env.DATABASE_URL); client.connect().then(() => client.query(sql)).then(() => { console.log('✅ Done! Restart app để migration chạy lại'); client.end(); }).catch(e => { console.error('❌ Error:', e.message); client.end(); process.exit(1); });"
    } else {
        Write-Host "❌ Cancelled" -ForegroundColor Red
    }
} 
elseif ($Method -eq 'alter') {
    Write-Host "✅ CÁCH 2: Thêm các cột thiếu (giữ data cũ)" -ForegroundColor Green
    Write-Host "📋 SQL sẽ chạy:" -ForegroundColor Gray
    Get-Content scripts\add-missing-columns-production.sql | Write-Host -ForegroundColor DarkGray
    
    $sql = Get-Content scripts\add-missing-columns-production.sql -Raw
    $sql | node -e "const pg = require('pg'); const sql = require('fs').readFileSync(0, 'utf-8'); const client = new pg.Client(process.env.DATABASE_URL); client.connect().then(() => client.query(sql)).then((res) => { console.log('✅ Columns added!'); if (res[res.length-1]?.rows) { console.log('\n📊 Schema hiện tại:'); console.table(res[res.length-1].rows); } client.end(); }).catch(e => { console.error('❌ Error:', e.message); client.end(); process.exit(1); });"
}

Write-Host "`n✅ Done!" -ForegroundColor Green

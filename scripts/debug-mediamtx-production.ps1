# MediaMTX Production Debug Script (PowerShell)
# For Windows testing of production config

param(
    [string]$MediamtxHost = $env:MEDIAMTX_HOST ?? "localhost",
    [string]$MediamtxApiUrl = $env:MEDIAMTX_API_URL ?? "http://localhost:9997",
    [int]$MediamtxRtspPort = $env:MEDIAMTX_RTSP_PORT ?? 8554
)

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  MediaMTX Production Diagnostics" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  MEDIAMTX_HOST: $MediamtxHost" -ForegroundColor Gray
Write-Host "  MEDIAMTX_API_URL: $MediamtxApiUrl" -ForegroundColor Gray
Write-Host "  MEDIAMTX_RTSP_PORT: $MediamtxRtspPort" -ForegroundColor Gray
Write-Host ""

# Test 1: API Endpoint
Write-Host "[1/5] Testing MediaMTX API endpoint..." -ForegroundColor Yellow
try {
    $global = Invoke-RestMethod -Uri "$MediamtxApiUrl/v3/config/global/get" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  OK - API is responding" -ForegroundColor Green
    Write-Host "  RTSP Address: $($global.rtspAddress)" -ForegroundColor Gray
} catch {
    Write-Host "  ERROR - API not responding" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Check:" -ForegroundColor Yellow
    Write-Host "    - Is MediaMTX running?" -ForegroundColor Gray
    Write-Host "    - Is 'api: yes' in mediamtx.yml?" -ForegroundColor Gray
    Write-Host "    - Is port 9997 open?" -ForegroundColor Gray
}
Write-Host ""

# Test 2: RTSP Port
Write-Host "[2/5] Testing RTSP port..." -ForegroundColor Yellow
$portTest = Test-NetConnection -ComputerName $MediamtxHost -Port $MediamtxRtspPort -WarningAction SilentlyContinue
if ($portTest.TcpTestSucceeded) {
    Write-Host "  OK - RTSP port $MediamtxRtspPort is open" -ForegroundColor Green
} else {
    Write-Host "  ERROR - RTSP port $MediamtxRtspPort is closed" -ForegroundColor Red
    Write-Host "  Check firewall rules" -ForegroundColor Yellow
}
Write-Host ""

# Test 3: List Paths
Write-Host "[3/5] Listing registered camera paths..." -ForegroundColor Yellow
try {
    $paths = Invoke-RestMethod -Uri "$MediamtxApiUrl/v3/config/paths/list" -Method GET -TimeoutSec 5
    $cameraPaths = $paths.items | Where-Object { $_.name -like "camera_*" }
    
    if ($cameraPaths) {
        Write-Host "  Camera paths found:" -ForegroundColor Green
        foreach ($path in $cameraPaths) {
            Write-Host "    - $($path.name)" -ForegroundColor Cyan
            if ($path.conf -and $path.conf.source) {
                Write-Host "      Source: $($path.conf.source)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  INFO - No camera paths registered yet" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ERROR - Cannot list paths" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Active Streams
Write-Host "[4/5] Checking active streams..." -ForegroundColor Yellow
try {
    $activePaths = Invoke-RestMethod -Uri "$MediamtxApiUrl/v3/paths/list" -Method GET -TimeoutSec 5
    $activeStreams = $activePaths.items | Where-Object { $_.name -like "camera_*" }
    
    if ($activeStreams) {
        Write-Host "  Active streams:" -ForegroundColor Green
        foreach ($stream in $activeStreams) {
            $status = if ($stream.ready) { "READY" } else { "NOT READY" }
            $color = if ($stream.ready) { "Green" } else { "Yellow" }
            Write-Host "    - $($stream.name): $status (Readers: $($stream.readerCount))" -ForegroundColor $color
        }
    } else {
        Write-Host "  INFO - No active streams" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ERROR - Cannot check streams" -ForegroundColor Red
}
Write-Host ""

# Test 5: DNS Resolution
Write-Host "[5/5] Testing DNS resolution..." -ForegroundColor Yellow
try {
    $resolved = [System.Net.Dns]::GetHostAddresses($MediamtxHost)
    Write-Host "  OK - $MediamtxHost resolves to:" -ForegroundColor Green
    foreach ($ip in $resolved) {
        Write-Host "    - $($ip.IPAddressToString)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  ERROR - Cannot resolve $MediamtxHost" -ForegroundColor Red
    Write-Host "  Check DNS configuration" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Diagnostics Complete" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

Write-Host "Common Issues:" -ForegroundColor Yellow
Write-Host "  - API not responding: Check if MediaMTX is running" -ForegroundColor Gray
Write-Host "  - api: no in config: Change to api: yes and restart" -ForegroundColor Gray
Write-Host "  - Port closed: Check firewall rules" -ForegroundColor Gray
Write-Host "  - Cannot connect: Check MEDIAMTX_HOST domain/IP" -ForegroundColor Gray
Write-Host "  - ECONNREFUSED: MediaMTX not running or wrong URL" -ForegroundColor Gray
Write-Host "  - ETIMEDOUT: Network issue or firewall blocking" -ForegroundColor Gray
Write-Host ""

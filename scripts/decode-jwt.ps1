# Decode JWT Token and Check Expiry
param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

function Decode-JWT {
    param($token)
    
    $parts = $token.Split('.')
    if ($parts.Length -ne 3) {
        Write-Host "ERROR: Invalid JWT format. Expected 3 parts, got $($parts.Length)" -ForegroundColor Red
        Write-Host "Token: $token" -ForegroundColor Gray
        return $null
    }
    
    # Decode payload (second part)
    $payload = $parts[1]
    
    # Add padding if needed
    switch ($payload.Length % 4) {
        2 { $payload += '==' }
        3 { $payload += '=' }
    }
    
    try {
        # Base64 decode
        $payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
        $payloadObj = $payloadJson | ConvertFrom-Json
        
        Write-Host "`n=== JWT Token Decoded ===" -ForegroundColor Cyan
        Write-Host "`nFull Payload:" -ForegroundColor Yellow
        $payloadJson | ConvertFrom-Json | ConvertTo-Json -Depth 5
        
        # Check expiry
        if ($payloadObj.exp) {
            $expiryDate = [DateTimeOffset]::FromUnixTimeSeconds($payloadObj.exp).LocalDateTime
            $now = Get-Date
            $isExpired = $now -gt $expiryDate
            
            Write-Host "`n=== Token Expiry Check ===" -ForegroundColor Cyan
            Write-Host "Issued At: $([DateTimeOffset]::FromUnixTimeSeconds($payloadObj.iat).LocalDateTime)" -ForegroundColor Gray
            Write-Host "Expires At: $expiryDate" -ForegroundColor $(if ($isExpired) { 'Red' } else { 'Green' })
            Write-Host "Current Time: $now" -ForegroundColor Gray
            
            if ($isExpired) {
                Write-Host "`nSTATUS: TOKEN EXPIRED" -ForegroundColor Red
                Write-Host "Token expired $([math]::Round(($now - $expiryDate).TotalHours, 2)) hours ago" -ForegroundColor Red
            } else {
                $hoursLeft = [math]::Round(($expiryDate - $now).TotalHours, 2)
                Write-Host "`nSTATUS: TOKEN VALID" -ForegroundColor Green
                Write-Host "Token expires in $hoursLeft hours" -ForegroundColor Green
            }
        }
        
        # Check SSO claims
        Write-Host "`n=== SSO Claims ===" -ForegroundColor Cyan
        Write-Host "Subject (sub): $($payloadObj.sub)" -ForegroundColor Yellow
        Write-Host "Client (azp): $($payloadObj.azp)" -ForegroundColor Yellow
        Write-Host "Audience (aud): $($payloadObj.aud)" -ForegroundColor Yellow
        Write-Host "Issuer (iss): $($payloadObj.iss)" -ForegroundColor Yellow
        
        # Check if matches expected values
        Write-Host "`n=== Configuration Match ===" -ForegroundColor Cyan
        $expectedClientId = "watcher"
        $expectedUserId = "b6514cad-77d8-4134-80a8-d06bf8644d39"
        
        $clientMatch = $payloadObj.azp -eq $expectedClientId
        $userMatch = $payloadObj.sub -eq $expectedUserId
        
        Write-Host "Client ID (azp): $($payloadObj.azp) $(if ($clientMatch) { '[OK]' } else { '[MISMATCH]' })" -ForegroundColor $(if ($clientMatch) { 'Green' } else { 'Red' })
        Write-Host "Expected: $expectedClientId" -ForegroundColor Gray
        
        Write-Host "`nUser ID (sub): $($payloadObj.sub) $(if ($userMatch) { '[OK]' } else { '[MISMATCH]' })" -ForegroundColor $(if ($userMatch) { 'Green' } else { 'Yellow' })
        Write-Host "Expected (admin): $expectedUserId" -ForegroundColor Gray
        
        return $payloadObj
    }
    catch {
        Write-Host "ERROR decoding JWT: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

Decode-JWT -token $Token

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. If token is EXPIRED: Get a new token from SSO provider" -ForegroundColor Gray
Write-Host "2. If token is VALID but 401 error: Check production SSO_API_KEY and SSO_CLIENT_ID config" -ForegroundColor Gray
Write-Host "3. If token is INCOMPLETE: Paste the full token (all 3 parts separated by dots)" -ForegroundColor Gray

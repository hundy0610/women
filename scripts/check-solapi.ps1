# Solapi API Key 확인 스크립트. 키와 Secret은 이 창에서만 입력하고 어디에도 저장하지 않습니다.
# 실행: powershell -ExecutionPolicy Bypass -File scripts\check-solapi.ps1
# 잔액 조회만 하므로 문자는 발송되지 않고 요금도 들지 않습니다.

function Read-Secret([string]$prompt) {
  $sec = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$apiKey = Read-Secret 'API Key 붙여넣기 (화면에 보이지 않습니다)'
$apiSecret = Read-Secret 'API Secret 붙여넣기 (화면에 보이지 않습니다)'
if (-not $apiKey -or -not $apiSecret) { Write-Host '값이 비어 있습니다.' -ForegroundColor Red; exit 1 }

$date = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$salt = -join ((1..16) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($apiSecret)
$signature = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($date + $salt)) | ForEach-Object { $_.ToString('x2') }) -join ''
$auth = "HMAC-SHA256 apiKey=$apiKey, date=$date, salt=$salt, signature=$signature"

try {
  $res = Invoke-RestMethod -Uri 'https://api.solapi.com/cash/v1/balance' -Headers @{ Authorization = $auth } -Method Get
  Write-Host '인증 성공. 키와 Secret이 맞습니다.' -ForegroundColor Green
  Write-Host ("잔액: {0}원 / 포인트: {1}" -f $res.balance, $res.point)
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "인증 실패 (HTTP $code). 키나 Secret을 다시 확인하세요." -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host 'Render 환경변수에 붙여넣을 값을 클립보드에 차례로 복사합니다. 붙여넣은 뒤 Enter를 누르세요.'
Set-Clipboard -Value $apiKey;    Read-Host 'SOLAPI_API_KEY 값이 복사되었습니다. Render에 붙여넣고 Enter' | Out-Null
Set-Clipboard -Value $apiSecret; Read-Host 'SOLAPI_API_SECRET 값이 복사되었습니다. Render에 붙여넣고 Enter' | Out-Null
Set-Clipboard -Value ' '
Write-Host '클립보드를 비웠습니다. 끝났습니다.' -ForegroundColor Green

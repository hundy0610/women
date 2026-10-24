# 실제 문자 발송 테스트. 키와 Secret은 이 창에서만 입력하고 저장하지 않습니다. 문자 2통(안내, 확정)이 발송되어 요금이 듭니다(통당 약 20원).
# 실행: powershell -ExecutionPolicy Bypass -File scripts\send-sample-sms.ps1
function Read-Secret([string]$prompt) {
  $sec = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$env:SOLAPI_API_KEY = Read-Secret 'API Key 붙여넣기'
$env:SOLAPI_API_SECRET = Read-Secret 'API Secret 붙여넣기'
$env:SOLAPI_SENDER = Read-Host '발신번호 (Solapi에 인증된 번호, 예: 01012345678)'
$env:BANK_NAME = '우리은행'; $env:BANK_HOLDER = '이선화'
$env:BANK_NUMBER = Read-Host '안내 문자에 넣을 계좌번호 (테스트용, 비워도 됨)'
$to = Read-Host '받을 휴대폰 번호 (본인 번호)'
node (Join-Path $PSScriptRoot 'send-sample-sms.mjs') $to
Remove-Item Env:SOLAPI_API_KEY, Env:SOLAPI_API_SECRET -ErrorAction SilentlyContinue

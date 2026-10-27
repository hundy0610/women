// 모든 응답에 붙이는 보안 헤더. OWASP Secure Headers Project 권고를 따릅니다. (vercel.json의 headers도 같은 값입니다)
export const CSP = "default-src 'self'; script-src 'self' https://oapi.map.naver.com https://*.naver.com https://dapi.kakao.com https://*.daumcdn.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://*.pstatic.net https://*.naver.com https://*.naver.net https://*.daumcdn.net https://*.kakao.com; connect-src 'self' https://*.naver.com https://*.pstatic.net https://dapi.kakao.com https://*.kakao.com; frame-src https://www.google.com https://maps.google.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};

// 담당자 알림. 설정된 채널로만 보내고, 실패해도 예약 처리에는 영향을 주지 않습니다.
// NOTIFY_WEBHOOK_URL: Slack, Discord, Google Chat 같은 웹훅 주소
// TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID: 텔레그램 봇
async function post(url, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
  } finally { clearTimeout(t); }
}

export function notifyEnabled() {
  return Boolean(process.env.NOTIFY_WEBHOOK_URL || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID));
}

export async function notifyAdmin(text, link) {
  const msg = link ? `${text}\n${link}` : text;
  const jobs = [];
  const hook = process.env.NOTIFY_WEBHOOK_URL;
  if (hook) jobs.push(post(hook, { text: msg, content: msg }));
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    jobs.push(post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { chat_id: process.env.TELEGRAM_CHAT_ID, text: msg }));
  }
  await Promise.allSettled(jobs);
}

export function adminLink(req) {
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (!host) return '';
  const proto = req.headers?.['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/admin`;
}

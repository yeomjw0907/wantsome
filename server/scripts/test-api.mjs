/**
 * API 테스트
 * 1) 터미널에서 서버 기동: cd server && npm run dev
 * 2) 다른 터미널에서: node server/scripts/test-api.mjs
 *    포트가 3001이면: set API_BASE=http://localhost:3001 && node server/scripts/test-api.mjs
 */
const BASE = process.env.API_BASE || 'http://localhost:3001';

const fetchOpt = { signal: AbortSignal.timeout(5000) };

async function get(path) {
  const res = await fetch(`${BASE}${path}`, fetchOpt);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...fetchOpt,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function run() {
  console.log('BASE:', BASE);
  console.log('');

  const statusRes = await get('/api/system/status');
  console.log('GET /api/system/status:', statusRes.status, statusRes.status === 200 ? 'OK' : '');
  if (statusRes.data.maintenance_mode !== undefined) {
    console.log('  maintenance_mode:', statusRes.data.maintenance_mode);
  }
  console.log('');

  const startRes = await post('/api/calls/start', {
    creator_id: '00000000-0000-0000-0000-000000000001',
    mode: 'blue',
  });
  console.log('POST /api/calls/start (no token):', startRes.status, startRes.status === 401 ? 'Unauthorized (expected)' : '');
  if (startRes.data.message) console.log('  message:', startRes.data.message);
  console.log('');

  console.log('Done.');
}

run().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

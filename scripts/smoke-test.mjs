const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`);
  process.exit(1);
}

async function assertStatus(path, expectedStatus) {
  const res = await fetch(`${baseUrl}${path}`);
  if (res.status !== expectedStatus) {
    fail(`${path} returned ${res.status}, expected ${expectedStatus}`);
  }
  console.log(`OK ${path} -> ${res.status}`);
}

async function runAuthSmoke() {
  if (!email || !password) {
    console.log(
      'Skipping auth smoke (set SMOKE_EMAIL and SMOKE_PASSWORD to enable).',
    );
    return;
  }

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (loginRes.status !== 200) {
    fail(`/auth/login returned ${loginRes.status}, expected 200`);
  }

  const loginBody = await loginRes.json();
  const accessToken =
    typeof loginBody?.accessToken === 'string' ? loginBody.accessToken : null;

  if (!accessToken) {
    fail('/auth/login response does not contain accessToken');
  }

  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (meRes.status !== 200) {
    fail(`/auth/me returned ${meRes.status}, expected 200`);
  }

  console.log('OK auth flow -> login + me');
}

async function main() {
  await assertStatus('/health', 200);
  await assertStatus('/ready', 200);
  await runAuthSmoke();
  console.log('SMOKE PASS');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Unknown error');
});

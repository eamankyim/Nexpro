/**
 * Test login for a list of emails against an API base URL.
 * Usage: node scripts/test-logins.js [baseUrl]
 */

const emails = [
  'eamankyim@gmail.com',
  'famankyim@gmail.com',
  'my@email.com',
  'superadmin@gmail.com',
];
const password = '111111@1A';
const baseUrl = (process.argv[2] || 'http://localhost:5001').replace(/\/$/, '');

async function testLogin(email) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { email, ok: false, status: res.status, message: text.slice(0, 120) };
  }
  const user = body.user || body.data?.user;
  const token = body.token || body.data?.token;
  const memberships = body.memberships || body.data?.memberships;
  if (body.success && token) {
    return {
      email,
      ok: true,
      status: res.status,
      name: user?.name,
      workspaces: Array.isArray(memberships) ? memberships.length : 0,
      platformAdmin: user?.isPlatformAdmin,
    };
  }
  return {
    email,
    ok: false,
    status: res.status,
    message: body.message || body.error || JSON.stringify(body).slice(0, 100),
  };
}

async function main() {
  console.log(`\n🔐 Login tests → ${baseUrl}\n`);
  let passed = 0;
  for (const email of emails) {
    const r = await testLogin(email);
    if (r.ok) {
      passed += 1;
      console.log(
        `  ✅ ${r.email} — ${r.name} | workspaces: ${r.workspaces}${r.platformAdmin ? ' | platform admin' : ''}`
      );
    } else {
      console.log(`  ❌ ${r.email} — HTTP ${r.status}: ${r.message}`);
    }
  }
  console.log(`\n${passed}/${emails.length} passed.\n`);
  process.exit(passed === emails.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

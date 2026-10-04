// POST /api/subscribe
// Saves an address for "Follow the drops" in the D1 database bound as DB
// (database: fonthabibi-signups, table: subscribers, see tools/schema).
// Accepts JSON from the page script, or a plain form post when JavaScript
// is off (then it redirects back to the home page).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function onRequestPost({ request, env }) {
  const type = request.headers.get("content-type") || "";
  const isJSON = type.includes("application/json");
  const reply = (ok, message, status) =>
    isJSON ? json({ ok, message }, status) : Response.redirect(new URL(`/?signup=${ok ? "ok" : "error"}#updates`, request.url).toString(), 303);

  let body;
  try {
    body = isJSON ? await request.json() : Object.fromEntries(await request.formData());
  } catch (err) {
    return reply(false, "Send an email address.", 400);
  }

  // Honeypot field: people never see it, bots fill it in. Pretend it worked.
  if (body.company) return reply(true, "", 200);

  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return reply(false, "Enter an email address like you@example.com.", 400);
  if (!env.DB) return reply(false, "Sign-ups open soon. Try again in a day or two.", 503);

  const source = String(body.source || "site").slice(0, 40);
  try {
    await env.DB.prepare(
      "INSERT INTO subscribers (email, created_at, source) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO UPDATE SET status = 'subscribed'"
    ).bind(email, new Date().toISOString(), source).run();
  } catch (err) {
    return reply(false, "That didn't go through. Try again in a minute.", 500);
  }
  return reply(true, "", 200);
}

export function onRequest() {
  return json({ ok: false, message: "Use POST to sign up." }, 405);
}

/**
 * Divi — Live Activity background updates (Phase B).
 *
 * Firestore trigger: when a billSessions/{id} doc changes (someone claims an
 * item, or the session closes), push the new content-state to that session's
 * Live Activity via APNs so the lock-screen / Dynamic Island bar updates while
 * the host's app is closed.
 *
 * The .p8 key contents live in the APNS_KEY secret (never in source):
 *   firebase functions:secrets:set APNS_KEY   (paste the .p8 file contents)
 */
const http2 = require('http2');
const jwt = require('jsonwebtoken');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');

// Two APNs auth keys so BOTH build types work without flipping config:
//  • APNS_KEY_PROD → production host (TestFlight / App Store builds)
//  • APNS_KEY      → sandbox host    (local dev builds)
// A Live Activity's push token is tied to the build's aps-environment; we can't
// tell which from the token, so sendActivityPush tries production first and
// falls back to sandbox on a BadDeviceToken (wrong-environment) response.
const APNS_KEY = defineSecret('APNS_KEY');           // sandbox (Divi APN Sbx)
const APNS_KEY_PROD = defineSecret('APNS_KEY_PROD'); // production (Divi APN Prod)

// Non-secret identifiers (safe to commit).
const APNS_TEAM_ID = '569MN7R95U';
const BUNDLE_ID = 'com.jpjacobello.divi';

const APNS_ENVS = [
  { name: 'prod', host: 'https://api.push.apple.com', kid: 'TX7TLW95KP', secret: APNS_KEY_PROD },
  { name: 'sbx', host: 'https://api.sandbox.push.apple.com', kid: 'Y6258YQJ6K', secret: APNS_KEY },
];

// ── APNs auth JWT (cached per key ~50 min; Apple allows reuse up to 60) ────────
const jwtCache = {}; // kid → { jwt, atMs }
function apnsJwt(kid, p8) {
  const now = Date.now();
  const c = jwtCache[kid];
  if (c && now - c.atMs < 50 * 60 * 1000) return c.jwt;
  const token = jwt.sign(
    { iss: APNS_TEAM_ID, iat: Math.floor(now / 1000) },
    p8,
    { algorithm: 'ES256', header: { alg: 'ES256', kid } },
  );
  jwtCache[kid] = { jwt: token, atMs: now };
  return token;
}

// ── Content-state — MUST match DiviSessionAttributes.ContentState (Swift) ─────
function round2(n) {
  return Math.round(n * 100) / 100;
}
// MUST mirror client stateOf (services/liveSessionActivity.ts) + calcShare so
// the background lock-screen number matches the in-app number.
function computeState(session) {
  const receipt = session.receipt || {};
  const items = receipt.items || [];
  const claims = Object.values(session.claims || {});
  const total = receipt.total || 0;

  let claimed = 0;
  if (session.splitType === 'equal' && session.peopleCount > 0) {
    // Each paid seat + the host's own already-covered seat settles a per-head share.
    const perHead = total / session.peopleCount;
    const paidSeats = claims.filter((c) => c.itemId === 'equal-split').length;
    claimed = Math.min(total, (paidSeats + 1) * perHead);
  } else {
    // Itemized: mirror calcShare (utils/calcShare.ts). Give claimed positive
    // spend its proportional slice of any negative discount line BEFORE deriving
    // the tax/tip ratio, otherwise the numerator omits the discount the
    // denominator (receipt.subtotal) includes and the ratio inflates past 1.
    const claimMap = new Map();
    for (const c of claims) {
      if (c.itemId === 'equal-split') continue;
      claimMap.set(c.itemId, (claimMap.get(c.itemId) || 0) + c.fraction);
    }
    let posSubtotal = 0;
    let totalPositive = 0;
    let totalDiscount = 0;
    for (const item of items) {
      if (item.price > 0) {
        totalPositive += item.price;
        const fraction = claimMap.get(item.id) || 0;
        if (fraction > 0) posSubtotal += item.price * fraction;
      } else if (item.price < 0) {
        totalDiscount += item.price;
      }
    }
    const discountShare = totalPositive > 0 ? totalDiscount * (posSubtotal / totalPositive) : 0;
    const subtotal = round2(posSubtotal + discountShare);
    const base = receipt.subtotal > 0 ? receipt.subtotal : 1;
    const ratio = subtotal / base;
    claimed = subtotal + ((receipt.tax || 0) + (receipt.fees || 0) + (receipt.tip || 0)) * ratio;
  }

  const count = session.splitType === 'equal'
    ? claims.filter((c) => c.itemId === 'equal-split').length
    : new Set(claims.map((c) => c.claimerName)).size;

  return {
    claimedAmount: round2(claimed),
    totalAmount: total,
    claimantCount: count,
    currencyCode: session.currency || 'USD',
  };
}

// One POST to a specific APNs environment. Resolves { status, body }.
function pushToEnv(env, token, event, contentState) {
  return new Promise((resolve, reject) => {
    const client = http2.connect(env.host);
    client.on('error', reject);

    const aps = { timestamp: Math.floor(Date.now() / 1000), event };
    if (event === 'update') aps['content-state'] = contentState;
    if (event === 'end') { aps['content-state'] = contentState; aps['dismissal-date'] = Math.floor(Date.now() / 1000); }
    const payload = JSON.stringify({ aps });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${apnsJwt(env.kid, env.secret.value())}`,
      'apns-topic': `${BUNDLE_ID}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('response', (h) => { status = h[':status']; });
    req.on('data', (d) => { body += d; });
    req.on('end', () => { client.close(); resolve({ status, body }); });
    req.on('error', reject);
    req.end(payload);
  });
}

// Try production first, fall back to sandbox on a wrong-environment token, so a
// single deployment serves both TestFlight/App Store and local dev builds.
async function sendActivityPush(token, event, contentState) {
  let lastErr;
  for (const env of APNS_ENVS) {
    let p8;
    try { p8 = env.secret.value(); } catch { continue; } // secret not set → skip
    if (!p8) continue;
    try {
      const { status, body } = await pushToEnv(env, token, event, contentState);
      if (status === 200) return;
      // BadDeviceToken = token belongs to the OTHER environment → try the next.
      if (status === 400 && body.includes('BadDeviceToken')) { lastErr = new Error(`APNs ${env.name} ${status}: ${body}`); continue; }
      throw new Error(`APNs ${env.name} ${status}: ${body}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('APNs: no environment accepted the token');
}

// Mirrors utils/sessionArchive.ts isSessionFullyClaimed.
function claimedFraction(session, itemId) {
  return Object.values(session.claims || {})
    .filter((c) => c.itemId === itemId)
    .reduce((s, c) => s + c.fraction, 0);
}
function isFullyClaimed(session) {
  // Equal (Quick Split): host occupies one seat and never claims, so completion
  // is all guest seats filled (paidSeats >= peopleCount - 1), not fraction >= 1.
  if (session.splitType === 'equal') {
    const peopleCount = session.peopleCount || 0;
    if (peopleCount <= 1) return false;
    const paidSeats = Object.values(session.claims || {}).filter((c) => c.itemId === 'equal-split').length;
    return paidSeats >= peopleCount - 1;
  }
  const items = ((session.receipt && session.receipt.items) || []).filter((i) => i.price > 0 && !i.parentId);
  return items.length > 0 && items.every((i) => claimedFraction(session, i.id) >= 0.999);
}

exports.onSessionClaim = onDocumentUpdated(
  { document: 'billSessions/{sessionId}', secrets: [APNS_KEY, APNS_KEY_PROD], region: 'us-central1' },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after) return;

    const token = after.liveActivityPushToken;
    if (!token) return; // no Live Activity registered for this session

    // Session just closed → dismiss the activity.
    if (after.status === 'closed' && before.status !== 'closed') {
      await sendActivityPush(token, 'end', computeState(after)).catch((e) => console.error('APNs end failed:', e.message));
      return;
    }
    if (after.status === 'closed') return;

    // Only push when the claimed amount or claimant count actually changed.
    const next = computeState(after);
    const prev = computeState(before);
    if (next.claimedAmount === prev.claimedAmount && next.claimantCount === prev.claimantCount) return;

    // A claim that fully claims a still-open session should dismiss the activity,
    // matching the client (useHostLiveActivity ends on fully-claimed) — otherwise
    // the lock screen stays pinned live all night if the host app is closed.
    if (isFullyClaimed(after) && !isFullyClaimed(before)) {
      await sendActivityPush(token, 'end', next).catch((e) => console.error('APNs end failed:', e.message));
      return;
    }

    await sendActivityPush(token, 'update', next).catch((e) => console.error('APNs update failed:', e.message));
  },
);

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

const APNS_KEY = defineSecret('APNS_KEY');

// Non-secret identifiers (safe to commit).
const APNS_KEY_ID = 'Y6258YQJ6K';
const APNS_TEAM_ID = '569MN7R95U';
const BUNDLE_ID = 'com.jpjacobello.divi';
// Dev builds use aps-environment=development → the SANDBOX APNs host. Switch to
// 'https://api.push.apple.com' (and a Production key) when shipping to the App Store.
const APNS_HOST = 'https://api.sandbox.push.apple.com';

// ── APNs auth JWT (cached ~50 min; Apple allows reuse up to 60) ───────────────
let cachedJwt = null;
let cachedAtMs = 0;
function apnsJwt(p8) {
  const now = Date.now();
  if (cachedJwt && now - cachedAtMs < 50 * 60 * 1000) return cachedJwt;
  cachedJwt = jwt.sign(
    { iss: APNS_TEAM_ID, iat: Math.floor(now / 1000) },
    p8,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: APNS_KEY_ID } },
  );
  cachedAtMs = now;
  return cachedJwt;
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
    // Itemized: claimed subtotal (positive items) + proportional tax/fees/tip.
    let subtotal = 0;
    for (const c of claims) {
      if (c.itemId === 'equal-split') continue;
      const item = items.find((i) => i.id === c.itemId);
      if (item && item.price > 0) subtotal += item.price * c.fraction;
    }
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

// ── Send one APNs Live Activity push ─────────────────────────────────────────
function sendActivityPush(token, event, contentState, p8) {
  return new Promise((resolve, reject) => {
    const client = http2.connect(APNS_HOST);
    client.on('error', reject);

    const aps = { timestamp: Math.floor(Date.now() / 1000), event };
    if (event === 'update') aps['content-state'] = contentState;
    if (event === 'end') { aps['content-state'] = contentState; aps['dismissal-date'] = Math.floor(Date.now() / 1000); }
    const payload = JSON.stringify({ aps });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${apnsJwt(p8)}`,
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
    req.on('end', () => {
      client.close();
      if (status === 200) resolve();
      else reject(new Error(`APNs ${status}: ${body}`));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

// Mirrors utils/sessionArchive.ts isSessionFullyClaimed.
function claimedFraction(session, itemId) {
  return Object.values(session.claims || {})
    .filter((c) => c.itemId === itemId)
    .reduce((s, c) => s + c.fraction, 0);
}
function isFullyClaimed(session) {
  const items = ((session.receipt && session.receipt.items) || []).filter((i) => i.price > 0 && !i.parentId);
  return items.length > 0 && items.every((i) => claimedFraction(session, i.id) >= 0.999);
}

exports.onSessionClaim = onDocumentUpdated(
  { document: 'billSessions/{sessionId}', secrets: [APNS_KEY], region: 'us-central1' },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after) return;

    const token = after.liveActivityPushToken;
    if (!token) return; // no Live Activity registered for this session

    const p8 = APNS_KEY.value();

    // Session just closed → dismiss the activity.
    if (after.status === 'closed' && before.status !== 'closed') {
      await sendActivityPush(token, 'end', computeState(after), p8).catch((e) => console.error('APNs end failed:', e.message));
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
      await sendActivityPush(token, 'end', next, p8).catch((e) => console.error('APNs end failed:', e.message));
      return;
    }

    await sendActivityPush(token, 'update', next, p8).catch((e) => console.error('APNs update failed:', e.message));
  },
);

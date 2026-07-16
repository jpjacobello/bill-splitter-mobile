import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  runTransaction,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { BillSession, Claim, Receipt } from '../types';

const SESSIONS = 'billSessions';
const SESSION_TTL_DAYS = 7;

export async function createSession(
  receipt: Receipt,
  creatorName: string,
  creatorVenmoHandle: string,
  opts?: { splitType?: 'equal' | 'itemized'; peopleCount?: number; currency?: string }
): Promise<string> {
  const ref = doc(collection(db, SESSIONS));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session: Omit<BillSession, 'id'> = {
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    merchantName: receipt.merchantName ?? 'Your Bill',
    creatorName,
    creatorVenmoHandle,
    receipt,
    claims: {},
    status: 'open',
    // Only include when set — Firestore rejects undefined values
    ...(opts?.splitType ? { splitType: opts.splitType } : {}),
    ...(opts?.peopleCount ? { peopleCount: opts.peopleCount } : {}),
    ...(opts?.currency ? { currency: opts.currency } : {}),
  };

  await setDoc(ref, session);
  return ref.id;
}

export async function getSession(sessionId: string): Promise<BillSession | null> {
  const snap = await getDoc(doc(db, SESSIONS, sessionId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<BillSession, 'id'>;
  const session = { ...data, id: snap.id };
  if (new Date(session.expiresAt) < new Date()) return null;
  return session;
}

export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: BillSession | null) => void
): () => void {
  return onSnapshot(doc(db, SESSIONS, sessionId), (snap) => {
    if (!snap.exists()) {
      onUpdate(null);
      return;
    }
    const data = snap.data() as Omit<BillSession, 'id'>;
    const session = { ...data, id: snap.id };
    if (new Date(session.expiresAt) < new Date()) {
      onUpdate(null);
      return;
    }
    onUpdate(session);
  });
}

export async function claimItems(
  sessionId: string,
  claimerName: string,
  newClaims: { itemId: string; fraction: number }[]
): Promise<void> {
  const sessionRef = doc(db, SESSIONS, sessionId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) throw new Error('Session not found');

    const session = snap.data() as Omit<BillSession, 'id'>;
    if (session.status !== 'open') throw new Error('Session is closed');

    const existingClaims: Record<string, Claim> = session.claims ?? {};

    // Equal (Quick Split): the host holds one of the `peopleCount` seats, so only
    // peopleCount-1 guest seats may be claimed. Cap by seat COUNT, not summed
    // fraction — the generic <=1.001 fraction check below permits `peopleCount`
    // claims (1.0 total), letting two concurrent final-seat claims both commit and
    // over-collect a full per-head share. See split/[id].tsx seatsLeft logic.
    if (session.splitType === 'equal') {
      const seatSize = session.peopleCount && session.peopleCount > 0 ? session.peopleCount - 1 : 0;
      const takenSeats = Object.values(existingClaims).filter((c) => c.itemId === 'equal-split').length;
      const newSeats = newClaims.filter((c) => c.itemId === 'equal-split').length;
      if (takenSeats + newSeats > seatSize) {
        throw new Error('All seats already claimed');
      }
    }

    for (const { itemId, fraction } of newClaims) {
      const totalAlreadyClaimed = Object.values(existingClaims)
        .filter((c) => c.itemId === itemId)
        .reduce((sum, c) => sum + c.fraction, 0);

      if (totalAlreadyClaimed + fraction > 1.001) {
        throw new Error(`Item already fully claimed: ${itemId}`);
      }
    }

    const updatedClaims = { ...existingClaims };
    for (const { itemId, fraction } of newClaims) {
      const claimId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      updatedClaims[claimId] = {
        itemId,
        claimerName,
        fraction,
        claimedAt: new Date().toISOString(),
      };
    }

    tx.update(sessionRef, { claims: updatedClaims });
  });
}

// Store the Live Activity push token so the backend can update the lock-screen
// activity via APNs while the host app is closed (Phase B).
export async function setSessionPushToken(sessionId: string, token: string): Promise<void> {
  await updateDoc(doc(db, SESSIONS, sessionId), { liveActivityPushToken: token });
}

export async function closeSession(sessionId: string): Promise<void> {
  await updateDoc(doc(db, SESSIONS, sessionId), { status: 'closed' });
}

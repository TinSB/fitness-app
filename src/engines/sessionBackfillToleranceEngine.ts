import type { TrainingSession } from '../models/training-model';

// Feature #33: When a user back-fills a session for a date more than 7 days
// in the past (forgotten workout, post-trip catch-up), we should keep the
// session in their history so 历史页 still shows what happened — but the
// recommendation engines (progression, deload, frequency) should ignore
// those rows so a delayed log of last month's volume does not whiplash
// today's prescription.
//
// We detect back-fill by comparing the user-claimed `date` to the earliest
// "I actually touched this session" timestamp we can find on the record
// (`startedAt` first, then `editedAt`, then `finishedAt`). If the gap is
// larger than the tolerance, the session is back-filled.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TOLERANCE_DAYS = 7;

const safeDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const earliestActivity = (session: TrainingSession): Date | null => {
  // Use only the actual-training timestamps (startedAt > finishedAt). A
  // late `editedAt` (the user fixing a typo months after the workout) is
  // NOT a backfill signal — it would block all post-workout edits from
  // analytics. If neither training timestamp is set, we cannot prove the
  // session is delayed, so it counts as fresh.
  const startedAt = safeDate(session.startedAt);
  if (startedAt) return startedAt;
  return safeDate(session.finishedAt);
};

export type SessionBackfillCheck = {
  sessionId: string;
  isBackfilled: boolean;
  reason: 'no_activity_timestamp' | 'within_tolerance' | 'beyond_tolerance';
  toleranceDays: number;
  gapDays: number | null;
};

export const checkSessionBackfill = (
  session: TrainingSession,
  toleranceDays: number = DEFAULT_TOLERANCE_DAYS,
): SessionBackfillCheck => {
  const claimedDate = safeDate(session.date);
  const activityDate = earliestActivity(session);
  if (!claimedDate || !activityDate) {
    return {
      sessionId: session.id,
      isBackfilled: false,
      reason: 'no_activity_timestamp',
      toleranceDays,
      gapDays: null,
    };
  }
  const gapMs = activityDate.getTime() - claimedDate.getTime();
  const gapDays = Math.floor(gapMs / MS_PER_DAY);
  if (gapDays <= toleranceDays) {
    return {
      sessionId: session.id,
      isBackfilled: false,
      reason: 'within_tolerance',
      toleranceDays,
      gapDays,
    };
  }
  return {
    sessionId: session.id,
    isBackfilled: true,
    reason: 'beyond_tolerance',
    toleranceDays,
    gapDays,
  };
};

export const filterSessionsForRecommendation = (
  sessions: TrainingSession[],
  toleranceDays: number = DEFAULT_TOLERANCE_DAYS,
): TrainingSession[] =>
  sessions.filter((session) => !checkSessionBackfill(session, toleranceDays).isBackfilled);

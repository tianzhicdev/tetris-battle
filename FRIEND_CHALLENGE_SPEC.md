# Friend Challenge System - Technical Specification

**Version:** 2.0
**Date:** 2026-02-16
**Status:** Draft
**Authors:** Engineering Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Requirements](#2-requirements)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [API Specification](#5-api-specification)
6. [Client Components](#6-client-components)
7. [Real-time Subscriptions](#7-real-time-subscriptions)
8. [State Management](#8-state-management)
9. [Error Handling](#9-error-handling)
10. [Testing Strategy](#10-testing-strategy)
11. [Implementation Plan](#11-implementation-plan)
12. [Rollout Strategy](#12-rollout-strategy)
13. [Success Metrics](#13-success-metrics)
14. [Appendix](#14-appendix)

---

## 1. Overview

### 1.1 Purpose

Redesign the friend challenge system to use a database-first architecture with Supabase Realtime for notifications, eliminating the dual-source-of-truth issues in the current implementation.

### 1.2 Goals

- **Reliability**: >99% challenge acceptance success rate
- **Latency**: <2s notification delivery (p95)
- **Consistency**: Single source of truth (database)
- **Simplicity**: Reduce system complexity by 50%
- **Cost**: Reduce infrastructure dependencies

### 1.3 Non-Goals

- Real-time game state synchronization (keep using PartyKit)
- Matchmaking system changes
- Friend management system changes (only challenges)

### 1.4 Architecture Shift

```
FROM: Database (persistent) + PartyKit (volatile) + Polling (fallback)
TO:   Database (single source) + Supabase Realtime (notifications)
```

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | User can send challenge to online friend | P0 |
| FR-2 | Challenged user receives notification <2s | P0 |
| FR-3 | Challenged user can accept or decline | P0 |
| FR-4 | Challenger notified of response <2s | P0 |
| FR-5 | Both users enter same game room on accept | P0 |
| FR-6 | Challenges expire after 2 minutes | P0 |
| FR-7 | Users notified of expiry | P1 |
| FR-8 | Sender can cancel pending challenge | P1 |
| FR-9 | System prevents duplicate challenges | P0 |
| FR-10 | Works across multiple browser tabs | P1 |
| FR-11 | Works offline (queues when reconnected) | P2 |
| FR-12 | Challenge history viewable (last 24h) | P2 |

### 2.2 Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-1 | Reliability | 99.9% success rate |
| NFR-2 | Latency | p95 < 2s, p99 < 5s |
| NFR-3 | Consistency | Zero lost challenges |
| NFR-4 | Scalability | Support 10k concurrent users |
| NFR-5 | Availability | 99.9% uptime |
| NFR-6 | Data Integrity | ACID guarantees |
| NFR-7 | Observability | All events logged |
| NFR-8 | Testability | >90% code coverage |

### 2.3 Constraints

- Must use existing Supabase instance
- No new third-party services (remove PartyKit for challenges)
- Backward compatible during migration
- No breaking changes to game room system

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐     │
│  │ React UI   │  │ Zustand    │  │ Supabase Realtime  │     │
│  │ Components │←→│ State Store│←→│ Client             │     │
│  └────────────┘  └────────────┘  └────────────────────┘     │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/WebSocket
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                     Supabase Layer                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐     │
│  │ PostgREST  │  │ Realtime   │  │ Database Functions │     │
│  │ API        │  │ Server     │  │ (Postgres)         │     │
│  └────────────┘  └────────────┘  └────────────────────┘     │
│         │              │                    │                │
│         └──────────────┴────────────────────┘                │
│                        ▼                                     │
│              ┌──────────────────┐                           │
│              │   PostgreSQL     │                           │
│              │   Database       │                           │
│              └──────────────────┘                           │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼ (cron job)
              ┌──────────────────┐
              │  Edge Function   │
              │  (Expiry Handler)│
              └──────────────────┘
```

### 3.2 Data Flow

#### 3.2.1 Challenge Creation Flow

```
┌─────────┐                                          ┌──────────┐
│ User A  │                                          │ User B   │
│(Sender) │                                          │(Receiver)│
└────┬────┘                                          └────┬─────┘
     │                                                    │
     │ 1. Click "Challenge"                              │
     │────┐                                               │
     │    │ Optimistic UI update                         │
     │<───┘                                               │
     │                                                    │
     │ 2. INSERT INTO friend_challenges                  │
     ├──────────────────────────────────────────►        │
     │                                          │         │
     │                                          ▼         │
     │                                   ┌──────────────┐ │
     │                                   │   Supabase   │ │
     │                                   │   Database   │ │
     │                                   └──────┬───────┘ │
     │ 3. Challenge ID returned                │         │
     │◄─────────────────────────────────────────┘         │
     │                                          │         │
     │ 4. Update state with real ID             │         │
     │────┐                                     │         │
     │<───┘                                     │         │
     │                                          │         │
     │                        5. Realtime notification    │
     │                                          ├────────►│
     │                                          │         │
     │                                          │    6. Show notification
     │                                          │         ├───┐
     │                                          │         │<──┘
```

#### 3.2.2 Challenge Accept Flow

```
┌─────────┐                                          ┌──────────┐
│ User A  │                                          │ User B   │
│(Sender) │                                          │(Receiver)│
└────┬────┘                                          └────┬─────┘
     │                                                    │
     │                                     1. Click "Accept"
     │                                                    ├───┐
     │                                Optimistic UI update│<──┘
     │                                                    │
     │                           2. CALL accept_challenge()
     │                                                    │
     │                                          ┌─────────▼────┐
     │                                          │   Supabase   │
     │                                          │   Function   │
     │                                          └─────────┬────┘
     │                                                    │
     │                          3. Atomic UPDATE with lock
     │                             - Validate challenge
     │                             - Generate roomId
     │                             - Update status='accepted'
     │                                                    │
     │ 4. Realtime UPDATE notification                   │
     │◄───────────────────────────────────────────────────┤
     │                                                    │
     │ 5. Navigate to game                               │
     ├───┐                                        ┌──────┤
     │<──┘                                        │      │
     │                                            └─────►│
     │                              6. Navigate to game  │
     │                                             ┌─────┤
     │                                             │     │
     │                                             └────►│
```

### 3.3 Component Responsibilities

| Component | Responsibility | Critical Path |
|-----------|----------------|---------------|
| **React UI** | Display challenges, capture user input | Yes |
| **Zustand Store** | Manage client-side state | Yes |
| **Supabase Client** | API calls, Realtime subscriptions | Yes |
| **PostgreSQL** | Persistent storage, atomic operations | Yes |
| **Postgres Functions** | Business logic (accept, validate) | Yes |
| **Edge Function** | Background jobs (expiry) | No |
| **PartyKit** | Presence (online/offline only) | No |

---

## 4. Database Schema

### 4.1 Schema Changes

#### 4.1.1 Add `roomId` Column

```sql
-- Migration: Add roomId to friend_challenges
ALTER TABLE friend_challenges
ADD COLUMN "roomId" TEXT,
ADD COLUMN "acceptedAt" TIMESTAMPTZ;

-- Index for faster lookups
CREATE INDEX idx_friend_challenges_room ON friend_challenges("roomId");
```

#### 4.1.2 Complete Schema Definition

```sql
CREATE TABLE friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengerId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  "challengedId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  "roomId" TEXT,  -- NEW: Generated on accept
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes'),
  "acceptedAt" TIMESTAMPTZ,  -- NEW: When challenge was accepted
  "resolvedAt" TIMESTAMPTZ   -- NEW: When challenge was closed (any status)
);

-- Indexes
CREATE INDEX idx_friend_challenges_challenger ON friend_challenges("challengerId", status);
CREATE INDEX idx_friend_challenges_challenged ON friend_challenges("challengedId", status);
CREATE INDEX idx_friend_challenges_expires ON friend_challenges("expiresAt") WHERE status = 'pending';
CREATE INDEX idx_friend_challenges_room ON friend_challenges("roomId") WHERE status = 'accepted';

-- Constraint: No duplicate pending challenges
CREATE UNIQUE INDEX idx_unique_pending_challenge
ON friend_challenges("challengerId", "challengedId")
WHERE status = 'pending';
```

### 4.2 Database Functions

#### 4.2.1 Accept Challenge Function

```sql
CREATE OR REPLACE FUNCTION accept_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
  v_room_id TEXT;
BEGIN
  -- Lock row and validate
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND "challengedId" = p_user_id
    AND status = 'pending'
    AND "expiresAt" > NOW()
  FOR UPDATE NOWAIT;  -- Fail fast if locked

  -- Validation checks
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND',
      'message', 'Challenge not found, expired, or already processed'
    );
  END IF;

  -- Generate unique room ID
  v_room_id := 'game_' ||
               extract(epoch from now())::bigint || '_' ||
               substr(md5(random()::text || p_challenge_id::text), 1, 8);

  -- Update challenge atomically
  UPDATE friend_challenges
  SET status = 'accepted',
      "roomId" = v_room_id,
      "acceptedAt" = NOW(),
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id;

  -- Return success with full challenge data
  RETURN json_build_object(
    'success', true,
    'roomId', v_room_id,
    'challengeId', v_challenge.id,
    'challengerId', v_challenge."challengerId",
    'challengedId', v_challenge."challengedId"
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CONCURRENT_MODIFICATION',
      'message', 'Challenge is being processed by another request'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION accept_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION accept_challenge TO anon;
```

#### 4.2.2 Decline Challenge Function

```sql
CREATE OR REPLACE FUNCTION decline_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
BEGIN
  -- Update if valid
  UPDATE friend_challenges
  SET status = 'declined',
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id
    AND "challengedId" = p_user_id
    AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('success', true);
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decline_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION decline_challenge TO anon;
```

#### 4.2.3 Cancel Challenge Function

```sql
CREATE OR REPLACE FUNCTION cancel_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
BEGIN
  -- Update if valid and sender
  UPDATE friend_challenges
  SET status = 'cancelled',
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id
    AND "challengerId" = p_user_id
    AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('success', true);
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_challenge TO anon;
```

#### 4.2.4 Expire Old Challenges Function

```sql
CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS TABLE(expired_count INTEGER) AS $$
BEGIN
  UPDATE friend_challenges
  SET status = 'expired',
      "resolvedAt" = NOW()
  WHERE status = 'pending'
    AND "expiresAt" < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via pg_cron (if available) or Edge Function
-- SELECT cron.schedule('expire-challenges', '*/10 * * * * *', $$SELECT expire_old_challenges()$$);
```

---

## 5. API Specification

### 5.1 Challenge Service API

#### 5.1.1 Create Challenge

```typescript
interface CreateChallengeRequest {
  challengerId: string;
  challengedId: string;
}

interface CreateChallengeResponse {
  success: boolean;
  challenge?: Challenge;
  error?: 'USER_OFFLINE' | 'DUPLICATE_CHALLENGE' | 'NOT_FRIENDS';
}

async function createChallenge(
  req: CreateChallengeRequest
): Promise<CreateChallengeResponse>
```

**Implementation:**
```typescript
async createChallenge(challengerId: string, challengedId: string) {
  const { data, error } = await supabase
    .from('friend_challenges')
    .insert({
      challengerId,
      challengedId,
      status: 'pending',
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    })
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === '23505') {
      return { success: false, error: 'DUPLICATE_CHALLENGE' };
    }
    return { success: false, error: 'INTERNAL_ERROR' };
  }

  return { success: true, challenge: data };
}
```

#### 5.1.2 Accept Challenge

```typescript
interface AcceptChallengeRequest {
  challengeId: string;
  userId: string;
}

interface AcceptChallengeResponse {
  success: boolean;
  roomId?: string;
  challengerId?: string;
  challengedId?: string;
  error?: 'CHALLENGE_NOT_FOUND' | 'CHALLENGE_EXPIRED' | 'CONCURRENT_MODIFICATION';
}

async function acceptChallenge(
  req: AcceptChallengeRequest
): Promise<AcceptChallengeResponse>
```

**Implementation:**
```typescript
async acceptChallenge(challengeId: string, userId: string) {
  const { data, error } = await supabase.rpc('accept_challenge', {
    p_challenge_id: challengeId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: 'INTERNAL_ERROR' };
  }

  return data;
}
```

#### 5.1.3 Decline Challenge

```typescript
async function declineChallenge(challengeId: string, userId: string) {
  const { data, error } = await supabase.rpc('decline_challenge', {
    p_challenge_id: challengeId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: 'INTERNAL_ERROR' };
  }

  return data;
}
```

#### 5.1.4 Cancel Challenge

```typescript
async function cancelChallenge(challengeId: string, userId: string) {
  const { data, error } = await supabase.rpc('cancel_challenge', {
    p_challenge_id: challengeId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: 'INTERNAL_ERROR' };
  }

  return data;
}
```

#### 5.1.5 Get Pending Challenges

```typescript
async function getPendingChallenges(userId: string) {
  const { data, error } = await supabase
    .from('friend_challenges')
    .select('*')
    .eq('challengedId', userId)
    .eq('status', 'pending')
    .gt('expiresAt', new Date().toISOString())
    .order('createdAt', { ascending: true });

  return data || [];
}
```

#### 5.1.6 Get Outgoing Challenges

```typescript
async function getOutgoingChallenges(userId: string) {
  const { data, error } = await supabase
    .from('friend_challenges')
    .select('*')
    .eq('challengerId', userId)
    .eq('status', 'pending')
    .gt('expiresAt', new Date().toISOString())
    .order('createdAt', { ascending: true });

  return data || [];
}
```

---

## 6. Client Components

### 6.1 Challenge Notification Component

**File:** `packages/web/src/components/ChallengeNotification.tsx`

```typescript
interface ChallengeNotificationProps {
  challenge: Challenge | null;
  onAccept: (challengeId: string) => Promise<void>;
  onDecline: (challengeId: string) => Promise<void>;
}

export function ChallengeNotification({
  challenge,
  onAccept,
  onDecline,
}: ChallengeNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(120);
  const [accepting, setAccepting] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!challenge) return;

    const remaining = Math.max(0, Math.floor(
      (new Date(challenge.expiresAt).getTime() - Date.now()) / 1000
    ));
    setTimeLeft(remaining);

    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [challenge]);

  const handleAccept = async () => {
    if (!challenge || accepting) return;
    setAccepting(true);
    try {
      await onAccept(challenge.id);
    } catch (error) {
      console.error('Accept failed:', error);
      setAccepting(false);
    }
  };

  if (!challenge) return null;

  return (
    <AnimatePresence>
      <motion.div
        style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          // ... styles
        }}
      >
        <div>
          <h3>{challenge.challengerUsername}</h3>
          <p>wants to play!</p>
          <p>Expires in {formatTime(timeLeft)}</p>
          <button onClick={handleAccept} disabled={accepting}>
            {accepting ? 'Accepting...' : 'Accept'}
          </button>
          <button onClick={() => onDecline(challenge.id)}>
            Decline
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

### 6.2 Challenge Waiting Component

**File:** `packages/web/src/components/ChallengeWaiting.tsx`

```typescript
interface ChallengeWaitingProps {
  challenge: Challenge | null;
  onCancel: (challengeId: string) => Promise<void>;
}

export function ChallengeWaiting({
  challenge,
  onCancel,
}: ChallengeWaitingProps) {
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    if (!challenge) return;

    const remaining = Math.max(0, Math.floor(
      (new Date(challenge.expiresAt).getTime() - Date.now()) / 1000
    ));
    setTimeLeft(remaining);

    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [challenge]);

  if (!challenge) return null;

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div>
        <Spinner />
        <h3>Waiting for {challenge.challengedUsername}...</h3>
        <p>Expires in {formatTime(timeLeft)}</p>
        <button onClick={() => onCancel(challenge.id)}>
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
```

---

## 7. Real-time Subscriptions

### 7.1 Incoming Challenges Subscription

**File:** `packages/web/src/hooks/useIncomingChallenges.ts`

```typescript
export function useIncomingChallenges(userId: string) {
  const setIncomingChallenge = useFriendStore(s => s.setIncomingChallenge);

  useEffect(() => {
    const subscription = supabase
      .channel(`incoming_challenges_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challengedId=eq.${userId}`,
      }, (payload) => {
        const challenge = payload.new as Challenge;

        // Ignore if already expired
        if (new Date(challenge.expiresAt) < new Date()) {
          return;
        }

        setIncomingChallenge(challenge);
        audioManager.playSfx('challenge_received');
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challengedId=eq.${userId}`,
      }, (payload) => {
        const challenge = payload.new as Challenge;

        // Clear if no longer pending
        if (challenge.status !== 'pending') {
          setIncomingChallenge(null);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);
}
```

### 7.2 Outgoing Challenges Subscription

**File:** `packages/web/src/hooks/useOutgoingChallenges.ts`

```typescript
export function useOutgoingChallenges(userId: string) {
  const setOutgoingChallenge = useFriendStore(s => s.setOutgoingChallenge);
  const navigate = useNavigate();

  useEffect(() => {
    const subscription = supabase
      .channel(`outgoing_challenges_${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challengerId=eq.${userId}`,
      }, (payload) => {
        const challenge = payload.new as Challenge;

        if (challenge.status === 'accepted' && challenge.roomId) {
          // Challenge accepted! Start game
          setOutgoingChallenge(null);
          navigate(`/game/${challenge.roomId}`, {
            state: {
              challengeId: challenge.id,
              opponentId: challenge.challengedId,
            },
          });
        } else if (challenge.status === 'declined') {
          setOutgoingChallenge(null);
          showNotification('Challenge declined');
        } else if (challenge.status === 'expired') {
          setOutgoingChallenge(null);
          showNotification('Challenge expired');
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);
}
```

### 7.3 Combined Hook

**File:** `packages/web/src/hooks/useChallenges.ts`

```typescript
export function useChallenges(userId: string) {
  useIncomingChallenges(userId);
  useOutgoingChallenges(userId);

  // Initial load of pending challenges on mount
  useEffect(() => {
    const loadInitialChallenges = async () => {
      const incoming = await friendService.getPendingChallenges(userId);
      const outgoing = await friendService.getOutgoingChallenges(userId);

      if (incoming.length > 0) {
        useFriendStore.getState().setIncomingChallenge(incoming[0]);
      }
      if (outgoing.length > 0) {
        useFriendStore.getState().setOutgoingChallenge(outgoing[0]);
      }
    };

    loadInitialChallenges();
  }, [userId]);
}
```

---

## 8. State Management

### 8.1 Zustand Store Updates

**File:** `packages/web/src/stores/friendStore.ts`

```typescript
interface FriendStore {
  // ... existing fields

  // Challenge state
  incomingChallenge: Challenge | null;
  outgoingChallenge: Challenge | null;

  // Optimistic updates
  pendingChallengeCreate: boolean;
  pendingChallengeAccept: boolean;

  // Actions
  sendChallenge: (friendUserId: string, friendUsername: string) => Promise<void>;
  acceptChallenge: (challengeId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  cancelChallenge: (challengeId: string) => Promise<void>;
  setIncomingChallenge: (challenge: Challenge | null) => void;
  setOutgoingChallenge: (challenge: Challenge | null) => void;
  clearChallenges: () => void;
}

export const useFriendStore = create<FriendStore>((set, get) => ({
  incomingChallenge: null,
  outgoingChallenge: null,
  pendingChallengeCreate: false,
  pendingChallengeAccept: false,

  sendChallenge: async (friendUserId: string, friendUsername: string) => {
    const myUserId = get().currentUserId;

    // Optimistic UI update
    const tempChallenge: Challenge = {
      id: crypto.randomUUID(),
      challengerId: myUserId,
      challengedId: friendUserId,
      challengedUsername: friendUsername,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };

    set({
      outgoingChallenge: tempChallenge,
      pendingChallengeCreate: true,
    });

    try {
      const result = await friendService.createChallenge(myUserId, friendUserId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update with real data from database
      set({
        outgoingChallenge: result.challenge,
        pendingChallengeCreate: false,
      });

      audioManager.playSfx('challenge_sent');

    } catch (error) {
      // Rollback optimistic update
      set({
        outgoingChallenge: null,
        pendingChallengeCreate: false,
      });

      showError('Failed to send challenge');
      throw error;
    }
  },

  acceptChallenge: async (challengeId: string) => {
    const myUserId = get().currentUserId;

    set({ pendingChallengeAccept: true });

    try {
      const result = await friendService.acceptChallenge(challengeId, myUserId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Clear challenge (navigation will happen via subscription)
      set({
        incomingChallenge: null,
        pendingChallengeAccept: false,
      });

      // Note: Navigation happens in useOutgoingChallenges subscription

    } catch (error) {
      set({ pendingChallengeAccept: false });
      showError('Failed to accept challenge');
      throw error;
    }
  },

  declineChallenge: async (challengeId: string) => {
    const myUserId = get().currentUserId;

    // Optimistic clear
    set({ incomingChallenge: null });

    try {
      await friendService.declineChallenge(challengeId, myUserId);
    } catch (error) {
      // Don't rollback, challenge is gone
      showError('Failed to decline challenge');
    }
  },

  cancelChallenge: async (challengeId: string) => {
    const myUserId = get().currentUserId;

    // Optimistic clear
    set({ outgoingChallenge: null });

    try {
      await friendService.cancelChallenge(challengeId, myUserId);
    } catch (error) {
      // Don't rollback
      showError('Failed to cancel challenge');
    }
  },

  setIncomingChallenge: (challenge) => set({ incomingChallenge: challenge }),
  setOutgoingChallenge: (challenge) => set({ outgoingChallenge: challenge }),
  clearChallenges: () => set({
    incomingChallenge: null,
    outgoingChallenge: null,
  }),
}));
```

---

## 9. Error Handling

### 9.1 Error Types

```typescript
enum ChallengeErrorCode {
  CHALLENGE_NOT_FOUND = 'CHALLENGE_NOT_FOUND',
  CHALLENGE_EXPIRED = 'CHALLENGE_EXPIRED',
  CHALLENGE_ALREADY_ACCEPTED = 'CHALLENGE_ALREADY_ACCEPTED',
  DUPLICATE_CHALLENGE = 'DUPLICATE_CHALLENGE',
  USER_OFFLINE = 'USER_OFFLINE',
  NOT_FRIENDS = 'NOT_FRIENDS',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

interface ChallengeError {
  code: ChallengeErrorCode;
  message: string;
  retryable: boolean;
  userMessage: string;
}
```

### 9.2 Error Messages

```typescript
const ERROR_MESSAGES: Record<ChallengeErrorCode, string> = {
  CHALLENGE_NOT_FOUND: 'This challenge no longer exists',
  CHALLENGE_EXPIRED: 'This challenge has expired',
  CHALLENGE_ALREADY_ACCEPTED: 'This challenge was already accepted',
  DUPLICATE_CHALLENGE: 'You already have a pending challenge with this user',
  USER_OFFLINE: 'This user is currently offline',
  NOT_FRIENDS: 'You must be friends to send a challenge',
  CONCURRENT_MODIFICATION: 'This challenge is being processed, please try again',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  NETWORK_ERROR: 'Connection error. Please check your internet.',
};
```

### 9.3 Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: 'linear' | 'exponential';
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 1000;
  const backoff = options.backoff ?? 'exponential';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay
      const delay = backoff === 'exponential'
        ? delayMs * Math.pow(2, attempt - 1)
        : delayMs * attempt;

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
}

// Usage
const result = await withRetry(
  () => friendService.acceptChallenge(challengeId, userId),
  { maxAttempts: 3, backoff: 'exponential' }
);
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
describe('acceptChallenge', () => {
  it('should accept valid challenge', async () => {
    const result = await acceptChallenge(challengeId, userId);
    expect(result.success).toBe(true);
    expect(result.roomId).toBeDefined();
  });

  it('should reject expired challenge', async () => {
    const result = await acceptChallenge(expiredChallengeId, userId);
    expect(result.success).toBe(false);
    expect(result.error).toBe('CHALLENGE_NOT_FOUND');
  });

  it('should prevent double-accept', async () => {
    await acceptChallenge(challengeId, userId);
    const result = await acceptChallenge(challengeId, userId);
    expect(result.success).toBe(false);
  });
});
```

### 10.2 Integration Tests

```typescript
describe('Challenge Flow', () => {
  it('should complete full challenge flow', async () => {
    // User A sends challenge
    const createResult = await createChallenge(userA, userB);
    expect(createResult.success).toBe(true);

    // User B receives notification (via subscription)
    await waitForSubscription(userB, 'challenge_received');

    // User B accepts
    const acceptResult = await acceptChallenge(
      createResult.challenge.id,
      userB
    );
    expect(acceptResult.success).toBe(true);
    expect(acceptResult.roomId).toBeDefined();

    // User A receives notification (via subscription)
    await waitForSubscription(userA, 'challenge_accepted');

    // Both users have same roomId
    expect(acceptResult.roomId).toBe(createResult.challenge.roomId);
  });
});
```

### 10.3 E2E Tests

```typescript
describe('Challenge E2E', () => {
  it('should work end-to-end', async () => {
    // Open two browser contexts
    const browserA = await browser.newContext();
    const browserB = await browser.newContext();

    const pageA = await browserA.newPage();
    const pageB = await browserB.newPage();

    // User A logs in and navigates to friends
    await pageA.goto('/friends');
    await pageA.click('[data-testid="friend-item-userB"]');
    await pageA.click('[data-testid="challenge-button"]');

    // User B should see notification
    await pageB.waitForSelector('[data-testid="challenge-notification"]');

    // User B accepts
    await pageB.click('[data-testid="accept-challenge"]');

    // Both should navigate to game
    await pageA.waitForURL(/\/game\/.+/);
    await pageB.waitForURL(/\/game\/.+/);

    // Verify same room
    const urlA = pageA.url();
    const urlB = pageB.url();
    expect(urlA).toBe(urlB);
  });
});
```

### 10.4 Load Tests

```typescript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  // Create challenge
  const createRes = http.post(
    'https://bwfywixrytzxpamszazf.supabase.co/rest/v1/friend_challenges',
    JSON.stringify({
      challengerId: 'user-' + __VU,
      challengedId: 'user-' + (__VU + 1000),
    })
  );

  check(createRes, {
    'challenge created': (r) => r.status === 201,
  });

  sleep(1);
}
```

---

## 11. Implementation Plan

### 11.1 Phase 1: Foundation (Week 1)

**Days 1-2: Database Changes**
- [ ] Write migration for schema changes
- [ ] Create database functions (accept, decline, cancel)
- [ ] Create expiry function
- [ ] Test functions locally
- [ ] Deploy to staging

**Days 3-4: Service Layer**
- [ ] Update friendService with new API methods
- [ ] Add Supabase Realtime client setup
- [ ] Create custom hooks (useIncomingChallenges, useOutgoingChallenges)
- [ ] Add retry logic and error handling
- [ ] Unit tests for service layer

**Day 5: Integration & Testing**
- [ ] Integration tests
- [ ] Manual testing in staging
- [ ] Fix issues

### 11.2 Phase 2: Client Updates (Week 2)

**Days 1-2: Component Updates**
- [ ] Update ChallengeNotification component
- [ ] Update ChallengeWaiting component
- [ ] Add optimistic UI updates
- [ ] Add loading states
- [ ] Update Zustand store

**Days 3-4: Subscription Integration**
- [ ] Wire up Realtime subscriptions
- [ ] Test notification delivery
- [ ] Test multi-tab behavior
- [ ] Add reconnection logic

**Day 5: Polish & Edge Cases**
- [ ] Handle offline mode
- [ ] Add proper error messages
- [ ] Loading indicators
- [ ] Sound effects
- [ ] Animations

### 11.3 Phase 3: Feature Flag & Migration (Week 3)

**Days 1-2: Feature Flag**
- [ ] Add feature flag system
- [ ] Implement A/B test logic
- [ ] Setup analytics tracking
- [ ] Deploy with 0% rollout

**Days 3-4: Gradual Rollout**
- [ ] 10% rollout
- [ ] Monitor metrics
- [ ] 50% rollout
- [ ] Monitor metrics
- [ ] 100% rollout

**Day 5: Cleanup**
- [ ] Remove old WebSocket challenge code
- [ ] Remove polling logic
- [ ] Update documentation
- [ ] Archive migration notes

### 11.4 Phase 4: Expiry System (Week 3-4 overlap)

**Days 1-2: Edge Function**
- [ ] Create Supabase Edge Function for expiry
- [ ] Setup cron trigger (every 10s)
- [ ] Test expiry logic
- [ ] Deploy to production

**Days 3-4: Monitoring**
- [ ] Add metrics for expiry
- [ ] Setup alerts for failures
- [ ] Monitor performance

---

## 12. Rollout Strategy

### 12.1 Feature Flag Configuration

```typescript
interface FeatureFlags {
  useDatabaseFirstChallenges: boolean;
  enableRealtimeSubscriptions: boolean;
  fallbackToPolling: boolean;
}

// LaunchDarkly / Custom implementation
const flags = await featureFlags.getAll();

if (flags.useDatabaseFirstChallenges) {
  // New system
  useChallenges(userId);
} else {
  // Old system
  useWebSocketChallenges(userId);
}
```

### 12.2 Rollout Phases

| Phase | Duration | Percentage | Action | Rollback Plan |
|-------|----------|------------|--------|---------------|
| 0 | Day 0 | 0% | Deploy code, flag off | N/A |
| 1 | Days 1-2 | 10% | Internal team only | Immediate |
| 2 | Days 3-5 | 25% | Power users | Within 1 hour |
| 3 | Days 6-8 | 50% | Half of users | Within 4 hours |
| 4 | Days 9-12 | 75% | Most users | Within 24 hours |
| 5 | Days 13-14 | 100% | All users | Emergency only |
| 6 | Day 15+ | - | Remove old code | N/A |

### 12.3 Monitoring & Alerts

**Key Metrics:**
- Challenge creation success rate (target: >99%)
- Challenge acceptance success rate (target: >99%)
- Notification delivery time (p95 < 2s)
- Database function execution time (p95 < 100ms)
- Realtime connection stability (>99.5%)

**Alerts:**
- Success rate drops below 95% → Page on-call
- Latency p95 > 5s → Warning
- Database function errors > 1% → Page on-call
- Realtime disconnections > 5% → Warning

### 12.4 Rollback Procedure

**Automatic Rollback Triggers:**
- Success rate < 80% for 5 minutes
- Error rate > 20% for 5 minutes
- Database function timeouts > 10%

**Manual Rollback Steps:**
1. Set feature flag to 0% (instant)
2. Verify old system functioning
3. Investigate root cause
4. Fix and redeploy
5. Resume gradual rollout

---

## 13. Success Metrics

### 13.1 Primary Metrics

| Metric | Baseline (Current) | Target (New) | Measurement |
|--------|-------------------|--------------|-------------|
| Challenge accept success rate | 60% | 99% | Database logs |
| Notification delivery latency (p95) | 0-30s | <2s | Client logs |
| State consistency errors | 30% | <0.1% | Database audits |
| User-reported issues | 10/week | <1/week | Support tickets |

### 13.2 Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Database query time (p95) | <100ms | APM tools |
| Realtime connection uptime | >99.5% | Supabase dashboard |
| Multi-tab behavior | 100% consistent | Manual testing |
| Offline resilience | Auto-sync on reconnect | Integration tests |

### 13.3 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to notification | <2s | Client-side tracking |
| Time to game start | <5s from accept | Client-side tracking |
| Challenge confusion rate | <5% | User surveys |
| Retry rate | <10% | Analytics |

### 13.4 SLIs & SLOs

**Service Level Indicators:**
- **Availability SLI**: Percentage of successful challenge operations
  - **SLO**: 99.9% (3 nines)
  - **Error Budget**: 43 minutes/month

- **Latency SLI**: Percentage of notifications delivered within 2s
  - **SLO**: 95% < 2s (p95)
  - **Error Budget**: 5% can be slower

- **Consistency SLI**: Percentage of challenges with correct state
  - **SLO**: 99.99% (4 nines)
  - **Error Budget**: 4 inconsistent challenges per 10k

---

## 14. Appendix

### 14.1 Migration Checklist

- [ ] Database schema changes deployed
- [ ] Database functions tested
- [ ] Expiry cron job configured
- [ ] Service layer updated
- [ ] Custom hooks implemented
- [ ] Components updated
- [ ] Zustand store updated
- [ ] Feature flag implemented
- [ ] Unit tests written (>90% coverage)
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Load tests performed
- [ ] Staging environment tested
- [ ] Documentation updated
- [ ] Rollout plan approved
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] On-call schedule confirmed
- [ ] Rollback plan documented

### 14.2 Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @supabase/supabase-js | ^2.38.0 | Database client & Realtime |
| zustand | ^4.4.0 | State management |
| react | ^18.2.0 | UI framework |
| framer-motion | ^10.0.0 | Animations |

### 14.3 Environment Variables

```bash
# Required
VITE_SUPABASE_URL=https://bwfywixrytzxpamszazf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...

# Optional (for feature flags)
VITE_FEATURE_FLAG_ENDPOINT=https://api.launchdarkly.com
VITE_FEATURE_FLAG_KEY=sdk-...
```

### 14.4 Database Performance Tuning

```sql
-- Ensure indexes are used
EXPLAIN ANALYZE
SELECT * FROM friend_challenges
WHERE "challengedId" = 'user123'
  AND status = 'pending'
  AND "expiresAt" > NOW();

-- Should use: idx_friend_challenges_challenged

-- Monitor slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%friend_challenges%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 14.5 Troubleshooting Guide

**Issue: Notifications not received**
- Check Realtime connection status
- Verify subscription filter matches userId
- Check database permissions (RLS policies)
- Verify challenge record exists in database

**Issue: Accept fails with "not found"**
- Check challenge status in database
- Verify userId matches challengedId
- Check expiry timestamp
- Check for concurrent modification (retry)

**Issue: Both users don't enter same room**
- Query challenge by roomId
- Verify both users received UPDATE notification
- Check navigation logic in subscription handler
- Verify roomId generation is unique

**Issue: High latency**
- Check database query performance (EXPLAIN ANALYZE)
- Verify indexes are being used
- Check Supabase Realtime connection health
- Monitor network latency to Supabase

### 14.6 References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Postgres Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [Feature Flags Best Practices](https://launchdarkly.com/blog/feature-flag-best-practices/)

---

**Document Status:** Draft
**Last Updated:** 2026-02-16
**Next Review:** 2026-02-23

---

*End of Specification*

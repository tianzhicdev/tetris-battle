/**
 * Test helpers: mock auth for tests (avoids real Clerk dependency)
 *
 * For unit and integration tests, we don't need a real JWT.
 * Use these constants as player IDs directly; game logic doesn't verify tokens.
 *
 * For tests that need a real JWT (e.g. Supabase RLS), use createTestToken()
 * with the jose library to generate a valid-looking token.
 */

export const TEST_USER_A = 'user_test_aaa_000';
export const TEST_USER_B = 'user_test_bbb_111';
export const TEST_USER_C = 'user_test_ccc_222';

/**
 * Creates a minimal mock profile matching the UserProfile interface.
 * Use in unit tests to avoid DB calls.
 */
export function mockProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: TEST_USER_A,
    username: 'test_player',
    coins: 500,
    matchmakingRating: 1000,
    gamesPlayed: 10,
    gamesWon: 5,
    lastActiveAt: Date.now(),
    unlockedAbilities: ['screen_shake', 'speed_up_opponent', 'mini_blocks', 'earthquake'],
    loadout: ['screen_shake', 'speed_up_opponent', 'mini_blocks'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** One cursor position snapshot during a typing run (ms from first keystroke). */
export interface ReplayEvent {
  ms: number;
  cursor: number;
}

/** Full typing replay for ghost racing. */
export interface TypingReplay {
  id: string;
  exerciseId: string;
  codeLength: number;
  playerName: string;
  recordedAt: string;
  events: ReplayEvent[];
  wpm: number;
  accuracy: number;
}

/** Imported friend bundle — may contain multiple replays. */
export interface FriendGhost {
  id: string;
  displayName: string;
  importedAt: string;
  avatarPhoto?: string;
  replays: TypingReplay[];
}

/** Shareable friend profile bundle (friend codes and .json exports). */
export interface FriendShareBundle {
  app: string;
  version: 1;
  displayName: string;
  avatarPhoto?: string;
  replays: TypingReplay[];
}

export type SyntheticGhostTier = 'easy' | 'medium' | 'hard' | 'extreme' | 'creator';

/** Identifies a ghost source when starting a race. */
export type GhostSource =
  | { kind: 'self'; profileId: string; replayId: string }
  | { kind: 'friend'; friendId: string; replayId: string }
  | { kind: 'account'; profileId: string; replayId: string }
  | { kind: 'builtin'; tier: SyntheticGhostTier; exerciseId: string };

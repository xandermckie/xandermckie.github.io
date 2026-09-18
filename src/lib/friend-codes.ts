import { currentMeta, otherMetas } from './catalog';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { importFriendShareJson, validateFriendShareBundle } from './friend-share';
import type { FriendShareBundle } from '../types/replay';
import type { ImportFriendShareResult } from './friend-share';

export const FRIEND_CODE_PREFIX = 'PYT1:';
export const FRIEND_CODE_MAX_LENGTH = 12_000;

function activeFriendCodePrefix(): string {
  return currentMeta().friendCodePrefix;
}

export type EncodeFriendCodeResult = { ok: true; code: string } | { ok: false; error: string };

export function encodeFriendCode(bundle: FriendShareBundle): EncodeFriendCodeResult {
  const validated = validateFriendShareBundle(bundle);
  if (!validated) return { ok: false, error: 'Invalid share bundle.' };
  const json = JSON.stringify(validated);
  const compressed = compressToEncodedURIComponent(json);
  const code = `${activeFriendCodePrefix()}${compressed}`;
  if (code.length > FRIEND_CODE_MAX_LENGTH) {
    return {
      ok: false,
      error: 'Code too long. Remove the profile photo or share a shorter replay.',
    };
  }
  return { ok: true, code };
}

export function decodeFriendCode(raw: string): ImportFriendShareResult {
  const trimmed = raw.trim();
  const prefix = activeFriendCodePrefix();
  for (const other of otherMetas()) {
    if (trimmed.startsWith(other.friendCodePrefix)) {
      const path = other.slug ? `/${other.slug}` : '/';
      return {
        ok: false,
        error: `This friend code is for ${other.productName}. Open ${path} to import it.`,
      };
    }
  }
  if (!trimmed.startsWith(prefix)) {
    return { ok: false, error: `Invalid friend code (must start with ${prefix}).` };
  }
  const payload = trimmed.slice(prefix.length);
  if (!payload) return { ok: false, error: 'Friend code is empty.' };
  if (trimmed.length > FRIEND_CODE_MAX_LENGTH) {
    return { ok: false, error: 'Friend code is too long.' };
  }
  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(payload);
  } catch {
    return { ok: false, error: 'Could not decode friend code.' };
  }
  if (!json) return { ok: false, error: 'Could not decode friend code.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Friend code contains invalid data.' };
  }
  const bundle = validateFriendShareBundle(parsed);
  if (!bundle) return { ok: false, error: `Friend code is not a valid ${currentMeta().productName} friend bundle.` };
  return importFriendShareJson(JSON.stringify(bundle));
}

/** Import from friend code or JSON file text. */
export function importFriendPayload(text: string): ImportFriendShareResult {
  const trimmed = text.trim();
  const prefix = activeFriendCodePrefix();
  if (trimmed.startsWith(prefix) || otherMetas().some((meta) => trimmed.startsWith(meta.friendCodePrefix))) {
    return decodeFriendCode(trimmed);
  }
  return importFriendShareJson(trimmed);
}

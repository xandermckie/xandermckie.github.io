import { Fragment, memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { describeTypingChar } from '../lib/a11y-text';
import { tokenizeToCells } from '../lib/highlight';
import type { CharCell } from '../lib/highlight';
import { playErrorBlip } from '../lib/sound';
import { detectVirtualPair } from '../lib/delimiter-pairing';
import type { VirtualPairState } from '../lib/delimiter-pairing';
import { computeAccuracy, applyTabToCounters, undoCorrectKeystroke } from '../lib/typing-stats';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import type { TypingStats } from '../types/exercise';
import type { ReplayEvent, TypingReplay } from '../types/replay';
import { getGhostCursorAt } from '../lib/replays';

interface TypingInputProps {
  /** The Python source to type, character by character. */
  code: string;
  /** Hide not-yet-typed characters (used by challenge mode). */
  obscurePending?: boolean;
  /** Screen-reader description of code in challenge mode (structure hint). */
  accessibleCodeHint?: string;
  /** Record cursor-over-time events for ghost replays. */
  recordReplay?: boolean;
  /** Opponent replay for ghost race mode. */
  ghostReplay?: TypingReplay | null;
  /** Fired once when the ghost reaches the end before the player. */
  onGhostFinished?: () => void;
  /** Fired on complete with the recorded event log when recordReplay is true. */
  onReplayReady?: (events: ReplayEvent[]) => void;
  /** Fired once the final character is matched, with the final stats. */
  onComplete: (stats: TypingStats) => void;
  /** Fired (debounced ~100ms) with progress 0–1 and accuracy 0–100. */
  onProgress?: (progress: number, accuracy: number) => void;
  /** Fired when the user confirms quitting via the Esc menu. */
  onQuit?: () => void;
  /** Fired when the user chooses Restart from the Esc menu. */
  onRestart?: () => void;
  /** Fired as the typing field gains/loses focus (drives the zen fade). */
  onFocusChange?: (focused: boolean) => void;
}

/* ---------------------------------------------------------------------------
 * Rendering model
 * ---------------------------------------------------------------------------
 * We tokenize the code with Prism once, then render one <span> per character.
 * Each character is in exactly one of four states relative to the caret:
 *   - done    : already typed correctly  → full syntax color
 *   - pending : not reached yet           → dimmed "ghost"
 *   - error   : the current char, mistyped→ red highlight (caret does NOT move)
 *   - (caret) : the current char to type  → blinking caret rendered before it
 *
 * Lines are split out and each is a React.memo'd <Line>. Only the line holding
 * the caret (and the line it just left) re-render on a keystroke — unchanged
 * lines bail out of reconciliation, which keeps long snippets fast.
 * ------------------------------------------------------------------------- */

type LineState = 'done' | 'pending' | 'active';

interface LineProps {
  lineNumber: number;
  cells: CharCell[];
  lineState: LineState;
  /** Caret position within this line, or -1 if the caret is elsewhere. */
  localCursor: number;
  /** Mistyped position within this line, or -1. */
  localError: number;
  /** Ghost opponent caret within this line, or -1. */
  ghostLocalCursor: number;
  showCaret: boolean;
  lineNumbers: boolean;
  obscurePending: boolean;
}

function renderChar(cell: CharCell, isError: boolean, hidden: boolean): string {
  if (cell.char === '\n') return isError ? '↵' : '​'; // zero-width keeps the span
  if (hidden) return '•';
  return cell.char;
}

const Line = memo(function Line({
  lineNumber,
  cells,
  lineState,
  localCursor,
  localError,
  ghostLocalCursor,
  showCaret,
  lineNumbers,
  obscurePending,
}: LineProps) {
  return (
    <div className="flex">
      {lineNumbers && (
        <span
          aria-hidden="true"
          className="select-none pr-4 text-right text-content-tertiary"
          style={{ minWidth: '2.5ch' }}
        >
          {lineNumber}
        </span>
      )}
      <span className="flex-1 whitespace-pre break-words">
        {cells.map((cell, i) => {
          const isErrorHere = lineState === 'active' && i === localError;

          // Resolve the per-character state class.
          let stateClass = '';
          if (lineState === 'done') {
            stateClass = ''; // full syntax color
          } else if (lineState === 'pending') {
            stateClass = 'opacity-40';
          } else if (i < localCursor) {
            stateClass = ''; // already typed on the active line
          } else if (isErrorHere) {
            stateClass = 'rounded-[2px] bg-[var(--color-error)] text-white';
          } else {
            stateClass = 'opacity-40';
          }

          const caretHere = showCaret && lineState === 'active' && i === localCursor;
          const ghostCaretHere =
            ghostLocalCursor >= 0 && lineState === 'active' && i === ghostLocalCursor && ghostLocalCursor !== localCursor;
          const isTyped = lineState === 'done' || (lineState === 'active' && i < localCursor);
          const shouldHide = obscurePending && !isTyped && !isErrorHere;
          return (
            <Fragment key={i}>
              {ghostCaretHere && <span className="pytyping-ghost-caret" aria-hidden="true" />}
              {caretHere && <span className="pytyping-caret" aria-hidden="true" />}
              <span className={`${cell.className} ${stateClass}`.trim()}>
                {renderChar(cell, isErrorHere, shouldHide)}
              </span>
            </Fragment>
          );
        })}
        {/* Caret resting at the very end of the line (e.g. last line, no newline). */}
        {showCaret && lineState === 'active' && localCursor === cells.length && (
          <span className="pytyping-caret" aria-hidden="true" />
        )}
        {ghostLocalCursor >= 0 && lineState === 'active' && ghostLocalCursor === cells.length && ghostLocalCursor !== localCursor && (
          <span className="pytyping-ghost-caret" aria-hidden="true" />
        )}
      </span>
    </div>
  );
});

export default function TypingInput({
  code,
  obscurePending = false,
  accessibleCodeHint,
  recordReplay = false,
  ghostReplay = null,
  onGhostFinished,
  onReplayReady,
  onComplete,
  onProgress,
  onQuit,
  onRestart,
  onFocusChange,
}: TypingInputProps) {
  const { settings } = useSettings();
  const { kit } = useLanguage();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pauseDialogRef = useRef<HTMLDivElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const codeDescId = useId();
  const [a11yAnnouncement, setA11yAnnouncement] = useState('');

  // --- Tokenized characters + line grouping (recomputed only when code changes).
  const cells = useMemo(() => tokenizeToCells(code, kit.prismLanguage), [code, kit.prismLanguage]);
  const total = cells.length;
  const lineModels = useMemo(() => {
    const models: Array<{ cells: CharCell[]; start: number }> = [];
    let buf: CharCell[] = [];
    let start = 0;
    cells.forEach((cell) => {
      buf.push(cell);
      if (cell.char === '\n') {
        models.push({ cells: buf, start });
        start += buf.length;
        buf = [];
      }
    });
    if (buf.length > 0 || models.length === 0) models.push({ cells: buf, start });
    return models;
  }, [cells]);

  // --- Authoritative typing state lives in refs (read synchronously by the
  //     native input handler); a tick counter forces re-render for the view.
  const cursorRef = useRef(0); // index of the next expected character
  const errorRef = useRef(-1); // index currently mistyped, or -1
  /** Virtual delimiter pair (VS Code-style auto-close). */
  const virtualPairRef = useRef<VirtualPairState | null>(null);
  const statsRef = useRef({ keystrokes: 0, correct: 0, errors: 0, startedAt: 0, finishedAt: 0 });
  const replayEventsRef = useRef<ReplayEvent[]>([]);
  const recordReplayRef = useRef(recordReplay);
  recordReplayRef.current = recordReplay;
  const onGhostFinishedRef = useRef(onGhostFinished);
  onGhostFinishedRef.current = onGhostFinished;
  const onReplayReadyRef = useRef(onReplayReady);
  onReplayReadyRef.current = onReplayReady;
  const ghostFinishedFiredRef = useRef(false);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [display, setDisplay] = useState({ wpm: 0, accuracy: 100, errors: 0 });
  const [ghostCursor, setGhostCursor] = useState(0);

  const announceTyping = useCallback((message: string) => {
    setA11yAnnouncement(message);
  }, []);

  const recordCursorEvent = useCallback(() => {
    if (!recordReplayRef.current) return;
    const stats = statsRef.current;
    if (stats.startedAt === 0) return;
    replayEventsRef.current.push({
      ms: Math.round(performance.now() - stats.startedAt),
      cursor: cursorRef.current,
    });
  }, []);

  // Config the input handler needs without re-binding the native listener.
  const cfgRef = useRef({ tabSize: settings.tabSize, sound: settings.soundEnabled });
  cfgRef.current = { tabSize: settings.tabSize, sound: settings.soundEnabled };

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const computeStats = useCallback((): TypingStats => {
    const s = statsRef.current;
    const end = s.finishedAt || performance.now();
    const seconds = s.startedAt ? (end - s.startedAt) / 1000 : 0;
    const minutes = seconds / 60;
    const wpm = minutes > 0 ? s.correct / 5 / minutes : 0;
    return {
      wpm: Math.max(0, Math.round(wpm)),
      accuracy: computeAccuracy(s.correct, s.keystrokes),
      errors: s.errors,
      progress: total > 0 ? cursorRef.current / total : 0,
      seconds: Math.round(seconds * 10) / 10,
      chars: s.correct,
    };
  }, [total]);

  const finish = useCallback(() => {
    // Freeze the clock + stats, then hand the final stats to the parent, which
    // shows the results screen (Monkeytype-style) before the quiz.
    statsRef.current.finishedAt = performance.now();
    const finalStats = computeStats();
    setDisplay({ wpm: finalStats.wpm, accuracy: finalStats.accuracy, errors: finalStats.errors });
    setDone(true);
    onProgress?.(1, finalStats.accuracy);
    if (recordReplayRef.current) onReplayReadyRef.current?.(replayEventsRef.current);
    onComplete(finalStats);
  }, [computeStats, onComplete, onProgress]);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  /* --- Core validation: process a single typed character. STRICT mode — a
   *     wrong character flags an error and does NOT advance the caret. */
  const commitChar = useCallback((ch: string) => {
    const i = cursorRef.current;
    if (i >= total) return;
    const stats = statsRef.current;
    if (stats.startedAt === 0) stats.startedAt = performance.now();
    stats.keystrokes += 1;

    if (ch === cells[i].char) {
      stats.correct += 1;
      cursorRef.current = i + 1;
      recordCursorEvent();
      errorRef.current = -1;
      const nextChar = cells[cursorRef.current]?.char;
      if (nextChar !== undefined) {
        announceTyping(`Correct. Next character: ${describeTypingChar(nextChar)}.`);
      }

      const vp = virtualPairRef.current;
      if (vp && i === vp.closerIndex) {
        virtualPairRef.current = { ...vp, closerTyped: true };
      } else {
        virtualPairRef.current = null;
        const pair = detectVirtualPair(cells, cursorRef.current);
        if (pair) {
          virtualPairRef.current = { ...pair, closerTyped: false };
        }
      }

      if (cursorRef.current === total) finishRef.current();
    } else {
      stats.errors += 1;
      errorRef.current = i;
      virtualPairRef.current = null;
      announceTyping(`Incorrect. Expected ${describeTypingChar(cells[i].char)}.`);
      if (cfgRef.current.sound) playErrorBlip();
    }
  }, [cells, total, recordCursorEvent, announceTyping]);

  /* --- After Enter: auto-advance past the leading spaces on the new line (IDE-style auto-indent). */
  const handleEnter = useCallback(() => {
    commitChar('\n');
    const afterNewline = cursorRef.current;
    const stats = statsRef.current;
    let i = afterNewline;
    while (i < total && cells[i].char === ' ') {
      stats.correct += 1;
      stats.keystrokes += 1;
      i += 1;
    }
    cursorRef.current = i;
    if (i > afterNewline) recordCursorEvent();
    errorRef.current = -1;
    if (cursorRef.current === total) finishRef.current();
  }, [cells, commitChar, total, recordCursorEvent]);

  /* --- Tab expands to N spaces: consume a run of up to tabSize leading spaces
   *     at the caret. If no space is expected, it's a single error keystroke. */
  const handleTab = useCallback(() => {
    const i = cursorRef.current;
    if (i >= total) return;
    let consumed = 0;
    while (consumed < cfgRef.current.tabSize && cells[i + consumed]?.char === ' ') consumed += 1;
    const stats = statsRef.current;
    if (stats.startedAt === 0) stats.startedAt = performance.now();
    applyTabToCounters(stats, consumed);
    if (consumed > 0) {
      cursorRef.current = i + consumed;
      recordCursorEvent();
      errorRef.current = -1;
      if (cursorRef.current === total) finishRef.current();
    } else {
      errorRef.current = i;
      announceTyping(`Incorrect. Expected space for tab indentation.`);
      if (cfgRef.current.sound) playErrorBlip();
    }
  }, [cells, total, recordCursorEvent, announceTyping]);

  // Backspace can arrive from both keydown and the native beforeinput event
  // (mobile keyboards). Dedupe presses that fire within the same tick.
  const lastDeleteRef = useRef(0);
  const handleBackspace = useCallback(() => {
    const now = Date.now();
    if (now - lastDeleteRef.current < 30) return;
    lastDeleteRef.current = now;
    if (errorRef.current !== -1) {
      errorRef.current = -1; // first clear an outstanding mistake
    } else if (cursorRef.current > 0) {
      const pos = cursorRef.current;
      const vp = virtualPairRef.current;
      if (vp && !vp.closerTyped && pos === vp.closerIndex) {
        cursorRef.current = vp.openerIndex;
        virtualPairRef.current = null;
        undoCorrectKeystroke(statsRef.current);
      } else if (vp && vp.closerTyped && pos === vp.closerIndex + 1) {
        cursorRef.current = vp.closerIndex;
        virtualPairRef.current = { ...vp, closerTyped: false };
        undoCorrectKeystroke(statsRef.current);
      } else {
        cursorRef.current -= 1;
        virtualPairRef.current = null;
        undoCorrectKeystroke(statsRef.current);
      }
    }
  }, []);

  /* --- Unified text-input pipeline. We listen to the native `beforeinput`
   *     event (rather than keypress) because it is the one signal that fires
   *     consistently across physical keyboards AND mobile virtual keyboards /
   *     IMEs. We always preventDefault and drive state ourselves, so the
   *     textarea stays empty and autocorrect can't rewrite anything. */
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      ie.preventDefault();
      if (cursorRef.current >= total) return;
      switch (ie.inputType) {
        case 'insertText':
        case 'insertCompositionText':
          if (ie.data) for (const ch of ie.data) commitChar(ch);
          break;
        case 'insertLineBreak':
        case 'insertParagraph':
          handleEnter();
          break;
        case 'deleteContentBackward':
        case 'deleteContentForward':
          handleBackspace();
          break;
        default:
          break; // ignore paste, forward-delete, formatting, etc.
      }
      rerender();
    };
    ta.addEventListener('beforeinput', onBeforeInput);
    return () => ta.removeEventListener('beforeinput', onBeforeInput);
  }, [commitChar, handleBackspace, handleEnter, rerender, total]);

  // Special keys that don't produce text input go through keydown.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        focusInput();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault(); // keep focus in the field
        handleTab();
        rerender();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowQuit(true);
        inputRef.current?.blur();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnter();
        rerender();
        return;
      }
      if (e.key === 'Backspace') {
        // Handle here for desktop reliability; dedupe guards the mobile path.
        e.preventDefault();
        handleBackspace();
        rerender();
      }
    },
    [focusInput, handleBackspace, handleEnter, handleTab, rerender],
  );

  // Focus the typing field on mount.
  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // Ghost opponent caret — advances from replay timing while the user types.
  useEffect(() => {
    if (!ghostReplay || done) return;
    let raf = 0;
    const tick = () => {
      const started = statsRef.current.startedAt;
      if (started > 0) {
        const elapsed = performance.now() - started;
        const pos = getGhostCursorAt(ghostReplay, elapsed);
        setGhostCursor(pos);
        if (!ghostFinishedFiredRef.current && pos >= total) {
          ghostFinishedFiredRef.current = true;
          onGhostFinishedRef.current?.();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ghostReplay, done, total]);

  // Live (but throttled) stats + progress — recomputed every 100ms, not every
  // keystroke, so the stats bar never thrashes React. Stops once finished.
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      const s = computeStats();
      setDisplay({ wpm: s.wpm, accuracy: s.accuracy, errors: s.errors });
      onProgress?.(s.progress, s.accuracy);
    }, 100);
    return () => window.clearInterval(id);
  }, [computeStats, done, onProgress]);

  const cursor = cursorRef.current;
  const errorIndex = errorRef.current;
  const progressPct = total > 0 ? (cursor / total) * 100 : 0;

  const confirmQuit = useCallback(() => {
    setShowQuit(false);
    onQuit?.();
  }, [onQuit]);
  const resumeTyping = useCallback(() => {
    setShowQuit(false);
    focusInput();
  }, [focusInput]);
  const restart = useCallback(() => {
    setShowQuit(false);
    onRestart?.();
  }, [onRestart]);

  useModalA11y({
    open: showQuit,
    onClose: resumeTyping,
    onEscape: resumeTyping,
    containerRef: pauseDialogRef,
    initialFocusRef: resumeButtonRef,
  });

  const codeDescription = useMemo(() => {
    if (obscurePending) {
      if (accessibleCodeHint) {
        return `Challenge mode structure hint: ${accessibleCodeHint}. Switch to Guided mode for the full code.`;
      }
      return 'Challenge mode hides untyped characters. Switch to Guided mode for full code visibility.';
    }
    return `Code to type: ${code}`;
  }, [accessibleCodeHint, code, obscurePending]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocusChange?.(true);
  }, [onFocusChange]);
  const handleBlur = useCallback(() => {
    setFocused(false);
    onFocusChange?.(false);
  }, [onFocusChange]);

  // Keep mobile virtual keyboard open when tapping the on-screen control keys.
  const holdFocus = (action: () => void) => (e: MouseEvent) => {
    e.preventDefault();
    action();
    rerender();
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Progress bar */}
      <div className="mb-6 h-[2px] w-full overflow-hidden rounded-full bg-background-tertiary">
        <div
          className="h-full bg-accent transition-[width] duration-75"
          style={{ width: `${progressPct}%`, willChange: 'width' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          aria-label="Typing progress"
        />
      </div>

      {/* Code surface. The transparent textarea overlays it to capture input. */}
      <div className="relative" onMouseDown={focusInput}>
        <div
          aria-hidden="true"
          className={`rounded-lg border border-border-tertiary bg-background-secondary p-3 sm:p-6 font-mono leading-[1.75] transition-opacity shadow-[var(--shadow-sm)] ${
            focused || done ? 'opacity-100' : 'opacity-55'
          }`}
          style={{ fontSize: 'var(--font-code-size)' }}
        >
          {lineModels.map((lm, idx) => {
            const end = lm.start + lm.cells.length;
            const lineState: LineState =
              cursor >= end ? 'done' : cursor < lm.start ? 'pending' : 'active';
            const localCursor = lineState === 'active' ? cursor - lm.start : -1;
            const localError =
              errorIndex >= lm.start && errorIndex < end ? errorIndex - lm.start : -1;
            const ghostLocalCursor =
              ghostReplay && ghostCursor >= lm.start && ghostCursor <= end ? ghostCursor - lm.start : -1;
            return (
              <Line
                key={idx}
                lineNumber={idx + 1}
                cells={lm.cells}
                lineState={lineState}
                localCursor={localCursor}
                localError={localError}
                ghostLocalCursor={ghostLocalCursor}
                showCaret={!done}
                lineNumbers={settings.lineNumbers}
                obscurePending={obscurePending}
              />
            );
          })}
        </div>

        {/* Visually hidden but focusable. autoCorrect/Capitalize off so mobile
            keyboards can't tamper with single-character input. */}
        <textarea
          ref={inputRef}
          name="pytyping-snippet"
          value=""
          onChange={() => {}}
          onKeyDown={onKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={done}
          aria-label={kit.typingAriaLabel}
          aria-describedby={codeDescId}
          aria-autocomplete="none"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="enter"
          data-1p-ignore
          data-form-type="other"
          data-lpignore="true"
          className="absolute inset-0 h-full w-full cursor-text resize-none rounded-lg bg-transparent p-3 sm:p-6 font-mono text-transparent caret-transparent outline-none"
          style={{ fontSize: 'var(--font-code-size)' }}
        />

        <div id={codeDescId} className="sr-only">
          {codeDescription}
        </div>

        {/* Focus hint when the field isn't focused (keyboard-friendly: we never
            trap focus; the user re-focuses by click or Ctrl/⌘+L). */}
        {!focused && !done && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-md border border-border-tertiary bg-background-primary px-3 py-1.5 text-sm text-content-secondary">
              Click here or press Ctrl/⌘+L to start typing
            </span>
          </div>
        )}
      </div>

      {/* On-screen control keys for mobile (no Tab/Esc on most soft keyboards). */}
      <div className="mt-3 flex gap-2 pb-safe sm:hidden" role="group" aria-label="On-screen typing keys">
        {[
          { label: 'Tab', ariaLabel: 'Insert tab indentation', fn: handleTab },
          { label: 'Enter', ariaLabel: 'Insert line break', fn: handleEnter },
          { label: '⌫', ariaLabel: 'Backspace', fn: handleBackspace },
          { label: 'Esc', ariaLabel: 'Open pause menu', fn: () => setShowQuit(true) },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            aria-label={k.ariaLabel}
            onMouseDown={holdFocus(k.fn)}
            className="flex-1 rounded-md border border-border-tertiary bg-background-secondary py-2 text-sm text-content-secondary active:bg-background-tertiary"
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Live stats */}
      <div className="mt-5 flex items-center gap-6 text-sm" role="group" aria-label="Typing statistics">
        <div className="flex items-baseline gap-1.5" aria-label={`Accuracy ${display.accuracy} percent`}>
          <span className="text-xl font-semibold tabular-nums text-content-primary" aria-hidden="true">{display.accuracy}%</span>
          <span className="text-xs text-content-secondary">acc</span>
        </div>
        {settings.liveWpm && (
          <div className="flex items-baseline gap-1.5" aria-label={`Speed ${display.wpm} words per minute`}>
            <span className="text-xl font-semibold tabular-nums text-content-primary" aria-hidden="true">{display.wpm}</span>
            <span className="text-xs text-content-secondary">wpm</span>
          </div>
        )}
        <div className="flex items-baseline gap-1.5" aria-label={`${display.errors} errors`}>
          <span className={`text-xl font-semibold tabular-nums ${display.errors > 0 ? 'text-error' : 'text-content-primary'}`} aria-hidden="true">
            {display.errors}
          </span>
          <span className="text-xs text-content-secondary">err</span>
        </div>
        <div className="ml-auto hidden text-xs text-content-tertiary sm:block">
          esc · menu &nbsp;·&nbsp; tab = {settings.tabSize} sp
        </div>
      </div>

      {/* Screen-reader announcement; the visible results screen lives in the
          parent (TypingPage) once onComplete fires. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {a11yAnnouncement}
        {done && `Snippet complete. ${display.accuracy}% accuracy.`}
        {ghostReplay && !done && ghostCursor >= total && 'Ghost finished the snippet.'}
        {ghostReplay && !done && ghostCursor < total && ghostCursor >= cursor && ghostCursor > 0 && 'Ghost is ahead.'}
        {ghostReplay && !done && ghostCursor < cursor && 'You are ahead of the ghost.'}
      </div>

      {/* Esc menu — keyboard accessible, focus moves to it. */}
      {showQuit && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            ref={pauseDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-menu-title"
            className="w-full max-w-sm rounded-lg border border-border-secondary bg-background-primary p-6"
          >
            <h2 id="pause-menu-title" className="text-lg font-medium text-content-primary">Paused</h2>
            <p className="mt-2 text-sm text-content-secondary">
              Restart this snippet from the top, or exit. Unsaved snippet progress is lost on either.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                ref={resumeButtonRef}
                type="button"
                onClick={resumeTyping}
                className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-secondary"
              >
                Keep typing
              </button>
              <button
                type="button"
                onClick={restart}
                className="rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-primary hover:bg-background-secondary"
              >
                Restart snippet
              </button>
              <button
                type="button"
                onClick={confirmQuit}
                className="rounded-md border border-error px-4 py-2 text-sm font-medium text-error hover:bg-background-secondary"
              >
                Exit exercise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

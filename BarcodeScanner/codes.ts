/**
 * A run of scanned codes, held in one text column, one code a line.
 *
 * Pure — no DOM, no context — so the rules can be read in one place and
 * checked without a form.
 *
 * Measured on a single-line text column through the Web API (SPEC.md P4,
 * 2026-10-31): `\n` and `\r\n` are both stored and read back as written, and
 * a value one character past the column's `MaxLength` is refused outright
 * (400, `0x80044331`) rather than cut. So a single-line column can hold a run,
 * and the length has to be checked here, before the write, because the
 * platform's answer to "too long" is a save that fails.
 */

/** Every code in a value, in order: lines trimmed, blank lines dropped. */
export function parseCodes(value: string | null | undefined): string[] {
    if (!value) {
        return [];
    }

    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '');
}

/** The value a list of codes is written back as. `\n`, not `\r\n`: the shorter of the two the column keeps. */
export function joinCodes(codes: readonly string[]): string {
    return codes.join('\n');
}

export type AddResult = 'added' | 'repeat' | 'full' | 'empty';

/**
 * What adding `code` to `codes` would do, without doing it.
 *
 * - `empty`: nothing left once trimmed.
 * - `repeat`: already in the list — skipped, and the run says so (the user's
 *   decision, 31 Oct 2026). Compared exactly: a scanner reads the same label
 *   the same way, and two codes differing only in case are two codes.
 * - `full`: the joined value would pass `maxLength`. `undefined` means no
 *   limit is known — a canvas app reports 100 for every property whatever it
 *   is bound to, so the caller passes a limit only when there is a column.
 */
export function check(codes: readonly string[], code: string, maxLength?: number): AddResult {
    const trimmed = code.trim();

    if (trimmed === '') {
        return 'empty';
    }

    if (codes.includes(trimmed)) {
        return 'repeat';
    }

    if (maxLength !== undefined && joinCodes([...codes, trimmed]).length > maxLength) {
        return 'full';
    }

    return 'added';
}

/**
 * Why a run of scans stopped.
 *
 * - `closed`: the device answered with a refusal or with nothing — the
 *   scanner was closed. **Which of the two a closed scanner sends is
 *   unmeasured** (no phone has run the probe), so both end the run.
 * - `unavailable`: the very first call was refused — there is no scanner
 *   here at all, which is a different thing to tell the user.
 * - `repeats`: two codes in a row were already in the list. A guard, not a
 *   feature: a host that answers at once with the same code forever — the
 *   hub's demo is one — would otherwise spin.
 * - `full`: the next code does not fit the column.
 * - `stopped`: the control went away mid-run.
 */
export type RunEnd = 'closed' | 'unavailable' | 'repeats' | 'full' | 'stopped';

export interface RunResult {
    end: RunEnd;
    /** How many codes the run added. */
    added: number;
    /** The code the run ended on, for `repeats` and `full`. */
    last: string | null;
}

export interface RunSteps {
    /** One call to the device's scanner. */
    scan: () => Promise<string>;
    /** Try to add a code; the caller writes it when the answer is `added`. */
    add: (code: string) => AddResult;
    /** Whether the run should stop before the next call. */
    stopped: () => boolean;
    /** Lets the page draw between calls; a resolved promise in a test. */
    pause: () => Promise<void>;
}

/** Repeats in a row that end a run. */
export const REPEATS_TO_STOP = 2;

/**
 * Scan until the scanner is closed.
 *
 * Each call opens the device's scanner for one code (Learn documents nothing
 * more), so "many" is a loop of calls and its end is a call that brings no
 * code back. Each code is handed to `add` as it arrives — written at once,
 * so a run cut short keeps what it had.
 */
export async function scanMany(steps: RunSteps): Promise<RunResult> {
    let added = 0;
    let repeats = 0;
    let first = true;

    for (;;) {
        if (steps.stopped()) {
            return { end: 'stopped', added, last: null };
        }

        let answer: unknown;

        try {
            answer = await steps.scan();
        } catch {
            return { end: first ? 'unavailable' : 'closed', added, last: null };
        }

        first = false;

        const code = typeof answer === 'string' ? answer.trim() : '';
        const result = steps.add(code);

        if (result === 'empty') {
            return { end: 'closed', added, last: null };
        }

        if (result === 'full') {
            return { end: 'full', added, last: code };
        }

        if (result === 'repeat') {
            repeats += 1;

            if (repeats >= REPEATS_TO_STOP) {
                return { end: 'repeats', added, last: code };
            }
        } else {
            added += 1;
            repeats = 0;
        }

        await steps.pause();
    }
}

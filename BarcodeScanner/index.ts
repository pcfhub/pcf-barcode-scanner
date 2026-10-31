import { IInputs, IOutputs } from './generated/ManifestTypes';
import { check, joinCodes, parseCodes, RunResult, scanMany } from './codes';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Fluent's own icons, as path data: `BarcodeScanner16Regular`,
 * `Dismiss12Regular`, `Warning16Regular` and `CheckmarkCircle16Regular`.
 *
 * Copied out of `@fluentui/react-icons` 2.0.337 rather than drawn, so the
 * glyphs match the ones the platform draws beside them — the same reasoning,
 * and the same 16px cuts, as `pcf-copy-field`. Inlined because the package is
 * React and this control is not: installing it to reach four paths would put
 * the whole icon set's module graph in a bundle that is otherwise a few KB.
 */
const ICON_PATHS = {
    scan:
        'M1.5 10.5c.28 0 .5.22.5.5v.5c0 .83.67 1.5 1.5 1.5H4a.5.5 0 0 1 0 1h-.5A2.5 2.5 0 0 1 1 11.5V11c0-.28.22-.5.5-.5m13 ' +
        '0c.28 0 .5.22.5.5v.5a2.5 2.5 0 0 1-2.5 2.5H12a.5.5 0 0 1 0-1h.5c.83 0 1.5-.67 1.5-1.5V11c0-.28.22-.5.5-.5m-11-6c.28 ' +
        '0 .5.22.5.5v6a.5.5 0 0 1-1 0V5c0-.28.22-.5.5-.5m3 0c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V5c0-.28.22-.5.5-.5m3 0c.28 0 ' +
        '.5.22.5.5v6a.5.5 0 0 1-1 0V5c0-.28.22-.5.5-.5m3 0c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V5c0-.28.22-.5.5-.5M4 2a.5.5 0 0 1 ' +
        '0 1h-.5C2.67 3 2 3.67 2 4.5V5a.5.5 0 0 1-1 0v-.5A2.5 2.5 0 0 1 3.5 2zm8.5 0A2.5 2.5 0 0 1 15 4.5V5a.5.5 0 0 1-1 ' +
        '0v-.5c0-.83-.67-1.5-1.5-1.5H12a.5.5 0 0 1 0-1z',
    dismiss:
        'm2.09 2.22.06-.07a.5.5 0 0 1 .63-.06l.07.06L6 5.29l3.15-3.14a.5.5 0 1 1 .7.7L6.71 6l3.14 3.15c.18.17.2.44.06.63l-' +
        '.06.07a.5.5 0 0 1-.63.06l-.07-.06L6 6.71 2.85 9.85a.5.5 0 0 1-.7-.7L5.29 6 2.15 2.85a.5.5 0 0 1-.06-.63l.06-.07z',
    warning:
        'M5.82 2.28a2.5 2.5 0 0 1 4.36 0l4.5 8A2.5 2.5 0 0 1 12.5 14h-9a2.5 2.5 0 0 1-2.18-3.72zm3.49.48a1.5 1.5 0 0 0-2.62 ' +
        '0l-4.5 8a1.5 1.5 0 0 0 1.31 2.24h9a1.5 1.5 0 0 0 1.3-2.23zM8 9.5A.75.75 0 1 1 8 11a.75.75 0 0 1 0-1.5M8 5c.28 0 .5' +
        '.22.5.5V8a.5.5 0 0 1-1 0V5.5c0-.28.22-.5.5-.5',
    success:
        'M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8m6-7a7 7 0 1 0 0 14A7 7 0 0 0 8 1m2.85 5.85a.5.5 0 0 0-.7-.7l-2.9 2.9-1.4-1.4a.5' +
        '.5 0 1 0-.7.7L6.9 10.1c.2.2.5.2.7 0z',
} as const;

type IconName = keyof typeof ICON_PATHS;

/** How the status line reads: plain, a warning, or a success. */
type Tone = 'neutral' | 'warning' | 'success';

/**
 * The column behind a bound property, when there is one.
 *
 * A model-driven form describes the column in `attributes`. A canvas app hands
 * over an `attributes` too, and it describes the *property*: an empty
 * `EntityLogicalName` and `MaxLength: 100` whatever the text is bound to
 * (measured by `pcf-copy-field`, 2026-10-06). So a table's name in it is the
 * tell, not its presence.
 */
function columnOf<T extends object>(parameter: { attributes?: T }): T | undefined {
    const attributes = parameter.attributes as (T & { EntityLogicalName?: unknown }) | undefined;

    return typeof attributes?.EntityLogicalName === 'string' && attributes.EntityLogicalName !== ''
        ? attributes
        : undefined;
}

/** `{0}` in a resource string, replaced. The platform does no formatting of its own. */
function format(text: string, value: string | number): string {
    return text.replace('{0}', String(value));
}

/**
 * A standard (non-virtual) field control — no React needed for a text box, a
 * button and a list.
 *
 * The only platform surface this reaches is `context.device
 * .getBarcodeValue()`: `Promise<string>`, no options, one code per call.
 * Learn documents it for the mobile clients only, and the hub's demo and a
 * desktop browser refuse it, so the refusal is an ordinary path here.
 *
 * Two modes, set by the maker:
 *
 * - **One code** (the default, and every installation from before 0.3.0): a
 *   scan replaces the value; typing edits it.
 * - **Many codes**: Scan keeps calling the scanner until it is closed, and
 *   each new code goes on its own line in the column. The box above the list
 *   adds a typed code on Enter, so the control never depends on a scanner.
 */
export class BarcodeScanner implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private context!: ComponentFramework.Context<IInputs>;
    private container!: HTMLDivElement;
    /** The filled box the input and the button share. See the stylesheet. */
    private field!: HTMLDivElement;
    private input!: HTMLInputElement;
    private scanButton!: HTMLButtonElement;
    private status!: HTMLParagraphElement;
    private statusIcon!: HTMLSpanElement;
    private statusText!: HTMLSpanElement;
    private message!: HTMLParagraphElement;
    private codesBox!: HTMLDivElement;
    private count!: HTMLParagraphElement;
    private list!: HTMLUListElement;
    private notifyOutputChanged!: () => void;
    private value = '';

    /** The value as codes, in many mode. Kept in step with `value`. */
    private codes: string[] = [];

    /** The codes the list on screen was built from, joined; `null` before the first build. */
    private listShows: string | null = null;

    /**
     * Every value this control handed the platform recently — typed, scanned
     * or a whole list — newest last. Each write comes back as an `updateView`,
     * late and **not necessarily in order** (typing "pase laur" on a real form
     * produced "pase laur", "pase lau", "pase laur", measured 2026-09-13); a
     * value found here is an echo whatever its order, and one never written
     * is the form's own and is taken.
     */
    private written: string[] = [];

    /**
     * The value the host handed over last time. Equal to it is not news:
     * PCFHub's demo re-renders with the preset's value as it always was
     * (measured on pcf-input-mask's demo, 2026-09-28).
     */
    private lastIncoming: string | undefined = undefined;

    /** A scan or a run of scans is in flight. */
    private busy = false;

    /** `destroy` has run; a run in flight stops at its next step. */
    private destroyed = false;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this.context = context;
        this.container = container;
        this.notifyOutputChanged = notifyOutputChanged;

        this.container.classList.add('BarcodeScanner');

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'BarcodeScanner-input';
        this.input.addEventListener('input', this.onInput);
        this.input.addEventListener('keydown', this.onKeyDown);

        this.scanButton = document.createElement('button');
        // `button`, not the default `submit`: a canvas app can put a control
        // inside a real form, where a submit button posts it.
        this.scanButton.type = 'button';
        this.scanButton.className = 'BarcodeScanner-scan';
        this.scanButton.append(BarcodeScanner.createIcon('scan', 'BarcodeScanner-icon'));
        this.scanButton.addEventListener('click', this.onScan);

        /*
         * One box holding both, as the platform's own fields with a trailing
         * affordance — phone, email, lookup — are one filled surface with the
         * button inside it. An input beside a separate button is what made
         * 0.2.x look pasted onto the form.
         */
        this.field = document.createElement('div');
        this.field.className = 'BarcodeScanner-field';
        this.field.append(this.input, this.scanButton);

        /*
         * The live region: never hidden, only emptied — a region taken out of
         * the accessibility tree between announcements is one some screen
         * readers stop watching. The icon is decoration; the text carries it.
         */
        this.status = document.createElement('p');
        this.status.className = 'BarcodeScanner-status';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.statusIcon = document.createElement('span');
        this.statusIcon.className = 'BarcodeScanner-statusIcon';
        this.statusText = document.createElement('span');
        this.statusText.className = 'BarcodeScanner-statusText';
        this.status.append(this.statusIcon, this.statusText);

        // The platform's own validation message. Without somewhere to put it,
        // a failing business rule is silent inside a code component.
        this.message = document.createElement('p');
        this.message.className = 'BarcodeScanner-message';
        this.message.hidden = true;

        this.count = document.createElement('p');
        this.count.className = 'BarcodeScanner-count';
        this.list = document.createElement('ul');
        this.list.className = 'BarcodeScanner-list';
        this.codesBox = document.createElement('div');
        this.codesBox.className = 'BarcodeScanner-codes';
        this.codesBox.append(this.count, this.list);

        this.container.append(this.field, this.status, this.message, this.codesBox);

        this.render(context);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;
        this.render(context);
    }

    public getOutputs(): IOutputs {
        return { value: this.value };
    }

    public destroy(): void {
        this.destroyed = true;
        this.input.removeEventListener('input', this.onInput);
        this.input.removeEventListener('keydown', this.onKeyDown);
        this.scanButton.removeEventListener('click', this.onScan);
    }

    private get many(): boolean {
        return this.context.parameters.scanMode?.raw === 'many';
    }

    private get disabled(): boolean {
        const security = this.context.parameters.value.security;

        return this.context.mode.isControlDisabled || (security !== undefined && !security.editable);
    }

    /** The column's limit, and only a column's — see `columnOf`. */
    private get maxLength(): number | undefined {
        const length = columnOf(this.context.parameters.value as { attributes?: { MaxLength?: number } })?.MaxLength;

        return typeof length === 'number' && length > 0 ? length : undefined;
    }

    private string(key: string): string {
        return this.context.resources.getString(key);
    }

    private render(context: ComponentFramework.Context<IInputs>): void {
        const parameter = context.parameters.value;
        const many = this.many;

        this.applyTheme(context);
        this.container.classList.toggle('BarcodeScanner--hidden', !context.mode.isVisible);
        this.container.classList.toggle('BarcodeScanner--many', many);

        const incoming = parameter.raw ?? '';

        // Guarded twice. A browser moves the caret to the end whenever `value`
        // is assigned something different from what the box holds, so a late
        // echo of an earlier keystroke both loses what was typed after it and
        // throws the user to the end of the field. See `written`.
        const repeated = incoming === this.lastIncoming;

        this.lastIncoming = incoming;

        const taken = !repeated && incoming !== this.value && !this.written.includes(incoming);

        if (taken) {
            this.written = [];
            this.value = incoming;
        }

        if (many) {
            const codes = parseCodes(this.value);

            if (joinCodes(codes) !== this.listShows) {
                this.codes = codes;
                this.renderCodes();
            }

            // The box adds a code; it does not hold the value. Clearing it on a
            // mode switch keeps a whole list from appearing in a one-line box.
            if (this.input.dataset.mode !== 'many') {
                this.input.value = '';
            }

            this.input.placeholder = this.string('BarcodeScanner_AddPlaceholder');
        } else {
            if (taken || this.input.dataset.mode !== 'one') {
                this.input.value = this.value;
            }

            this.input.placeholder = '';
        }

        this.input.dataset.mode = many ? 'many' : 'one';

        const disabled = this.disabled;
        const maxLength = this.maxLength;

        this.input.disabled = disabled;
        this.scanButton.disabled = disabled;
        this.container.classList.toggle('BarcodeScanner--disabled', disabled);

        if (maxLength !== undefined) {
            this.input.maxLength = maxLength;
        } else {
            this.input.removeAttribute('maxlength');
        }

        // `mode.label` is the label the maker gave the field on this form, a
        // better accessible name than anything shipped in the .resx.
        const label = context.mode.label || this.string('BarcodeScanner_Name');

        this.input.setAttribute('aria-label', label);

        // The button's name names the field, not the action alone: a form with
        // two of these otherwise lists two buttons called "Scan".
        const buttonLabel = format(this.string(many ? 'BarcodeScanner_ScanManyLabel' : 'BarcodeScanner_ScanLabel'), label);

        this.scanButton.setAttribute('aria-label', buttonLabel);
        // The glyph alone does not say what it does to a sighted user who does
        // not know it; `title` is what the platform's own icon buttons use.
        this.scanButton.title = buttonLabel;
        this.list.setAttribute('aria-label', format(this.string('BarcodeScanner_ListLabel'), label));

        this.container.dir = context.userSettings.isRTL ? 'rtl' : 'ltr';
        this.container.classList.toggle('BarcodeScanner--invalid', parameter.error);
        this.input.setAttribute('aria-invalid', String(parameter.error));
        this.message.hidden = !parameter.error;
        this.message.textContent = parameter.error ? parameter.errorMessage : '';
    }

    /**
     * Builds the list again from `codes`.
     *
     * Rebuilt rather than patched: a run adds one row at a time and a removal
     * takes one away, and a list of codes is short — the cost is a few nodes,
     * the gain is that the DOM can never disagree with the value.
     */
    private renderCodes(): void {
        const removeLabel = this.string('BarcodeScanner_Remove');
        const rows = this.codes.map((code, index) => {
            const row = document.createElement('li');
            const text = document.createElement('span');
            const remove = document.createElement('button');

            row.className = 'BarcodeScanner-code';
            text.className = 'BarcodeScanner-codeText';
            text.textContent = code;
            remove.type = 'button';
            remove.className = 'BarcodeScanner-remove';
            remove.setAttribute('aria-label', format(removeLabel, code));
            remove.title = format(removeLabel, code);
            remove.append(BarcodeScanner.createIcon('dismiss', 'BarcodeScanner-icon BarcodeScanner-icon--small', '0 0 12 12'));
            // A listener on each button rather than one on the list: the rows
            // are rebuilt with the list, so nothing outlives them.
            remove.addEventListener('click', () => this.removeCode(index));
            row.append(text, remove);

            return row;
        });

        // `textContent = ''` then `append`, not `replaceChildren`: the same
        // result, and the one the rig's DOM can follow.
        this.list.textContent = '';
        this.list.append(...rows);
        this.list.hidden = this.codes.length === 0;
        this.listShows = joinCodes(this.codes);
        this.count.textContent =
            this.codes.length === 0
                ? this.string('BarcodeScanner_CountNone')
                : this.codes.length === 1
                  ? this.string('BarcodeScanner_CountOne')
                  : format(this.string('BarcodeScanner_CountMany'), this.codes.length);
    }

    /** Writes `codes` as the value, and remembers it as ours. */
    private writeCodes(): void {
        this.value = joinCodes(this.codes);
        this.remember(this.value);
        this.renderCodes();
        this.notifyOutputChanged();
    }

    private setStatus(text: string, tone: Tone = 'neutral'): void {
        this.status.dataset.tone = tone;
        this.statusIcon.textContent = '';

        if (text !== '' && tone !== 'neutral') {
            this.statusIcon.append(BarcodeScanner.createIcon(tone === 'warning' ? 'warning' : 'success', 'BarcodeScanner-icon'));
        }

        this.statusText.textContent = text;
    }

    private setBusy(busy: boolean): void {
        this.busy = busy;

        // `aria-disabled`, not `disabled`: disabling the button that has focus
        // drops focus to the page in Chrome (measured 28 Oct 2026 on Audit
        // History's Restore), and a keyboard user who pressed Scan should still
        // be on it when the scanner closes.
        if (busy) {
            this.scanButton.setAttribute('aria-disabled', 'true');
        } else {
            this.scanButton.removeAttribute('aria-disabled');
        }
    }

    private onInput = (): void => {
        if (this.many) {
            return;
        }

        this.value = this.input.value;
        this.setStatus('');
        this.remember(this.value);
        this.notifyOutputChanged();
    };

    /** Enter adds the typed code, in many mode. */
    private onKeyDown = (event: KeyboardEvent): void => {
        if (!this.many || event.key !== 'Enter' || event.isComposing) {
            return;
        }

        event.preventDefault();

        const code = this.input.value.trim();

        if (code === '') {
            return;
        }

        if (this.addCode(code) !== 'full') {
            this.input.value = '';
        }
    };

    /** One code into the list: added and written, or skipped with the reason said. */
    private addCode(code: string): ReturnType<typeof check> {
        const result = check(this.codes, code, this.maxLength);

        if (result === 'added') {
            this.codes = [...this.codes, code.trim()];
            this.writeCodes();
            this.setStatus(format(this.string('BarcodeScanner_Added'), code.trim()));
        } else if (result === 'repeat') {
            this.setStatus(format(this.string('BarcodeScanner_Repeat'), code.trim()), 'warning');
        } else if (result === 'full') {
            this.setStatus(format(this.string('BarcodeScanner_Full'), code.trim()), 'warning');
        }

        return result;
    }

    /** A row's remove button. */
    private removeCode(index: number): void {
        const code = this.codes[index];

        if (code === undefined || this.disabled) {
            return;
        }

        this.codes = this.codes.filter((_, at) => at !== index);
        this.writeCodes();
        this.setStatus(format(this.string('BarcodeScanner_Removed'), code));

        // Focus would otherwise fall to the page with the row it was on. The
        // row that took this one's place, else the one before, else the box.
        const buttons = this.list.querySelectorAll<HTMLButtonElement>('.BarcodeScanner-remove');
        const next = buttons[Math.min(index, buttons.length - 1)];

        (next ?? this.input).focus();
    }

    private onScan = (): void => {
        if (this.busy || this.disabled) {
            return;
        }

        void (this.many ? this.scanRun() : this.scanOne());
    };

    private async scanOne(): Promise<void> {
        this.setStatus('');
        this.setBusy(true);

        try {
            const scanned = await this.context.device.getBarcodeValue();

            this.value = scanned;
            this.input.value = scanned;
            this.remember(scanned);
            this.notifyOutputChanged();
        } catch {
            // The ordinary outcome in a desktop browser and in the hub's demo:
            // not an error to log, just tell the user typing still works.
            this.setStatus(this.string('BarcodeScanner_Unavailable'), 'warning');
        } finally {
            this.setBusy(false);
        }
    }

    private async scanRun(): Promise<void> {
        this.setStatus('');
        this.setBusy(true);

        let result: RunResult;

        try {
            result = await scanMany({
                scan: () => this.context.device.getBarcodeValue(),
                add: (code) => this.addCode(code),
                stopped: () => this.destroyed,
                pause: () => new Promise((resolve) => window.setTimeout(resolve, 0)),
            });
        } finally {
            this.setBusy(false);
        }

        this.reportRun(result);
    }

    /** What the status line says once a run is over. */
    private reportRun(result: RunResult): void {
        if (result.end === 'stopped') {
            return;
        }

        if (result.end === 'unavailable') {
            this.setStatus(this.string('BarcodeScanner_Unavailable'), 'warning');

            return;
        }

        const summary =
            result.added === 0
                ? this.string('BarcodeScanner_RunNone')
                : result.added === 1
                  ? this.string('BarcodeScanner_RunOne')
                  : format(this.string('BarcodeScanner_RunMany'), result.added);

        if (result.end === 'repeats' && result.last !== null) {
            this.setStatus(`${summary} ${format(this.string('BarcodeScanner_Repeat'), result.last)}`, 'warning');
        } else if (result.end === 'full' && result.last !== null) {
            this.setStatus(`${summary} ${format(this.string('BarcodeScanner_Full'), result.last)}`, 'warning');
        } else {
            this.setStatus(summary, result.added > 0 ? 'success' : 'neutral');
        }
    }

    /** Bounded: a form open all day should not keep every keystroke. */
    private remember(value: string): void {
        this.written.push(value);

        if (this.written.length > 32) {
            this.written.shift();
        }
    }

    /**
     * The stylesheet reads Fluent's design tokens with a literal fallback, and
     * this picks which fallbacks: light unless the host says dark.
     *
     * Not `prefers-color-scheme` — a model-driven app carries its own theme, and
     * an OS-dark machine on a light app would otherwise paint dark fallbacks
     * behind a white form. A host that says nothing gets no class.
     */
    private applyTheme(context: ComponentFramework.Context<IInputs>): void {
        const isDarkTheme = context.fluentDesignLanguage?.isDarkTheme;

        if (isDarkTheme !== undefined) {
            this.container.classList.toggle('BarcodeScanner--dark', isDarkTheme);
        }
    }

    /**
     * `createElementNS`, not `innerHTML`: the HTML factory makes an `<svg>`
     * that renders nothing, and a control that assigns `innerHTML` has to be
     * audited for injection forever after — not worth it for static paths.
     */
    private static createIcon(name: IconName, className: string, viewBox = '0 0 16 16'): SVGSVGElement {
        const svg = document.createElementNS(SVG_NS, 'svg');

        svg.setAttribute('class', className);
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');

        const path = document.createElementNS(SVG_NS, 'path');

        path.setAttribute('d', ICON_PATHS[name]);
        svg.append(path);

        return svg;
    }
}

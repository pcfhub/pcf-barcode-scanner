/*
 * Drives the real built bundle outside a browser.
 *
 *     npm run build && npm run smoke
 *
 * What it does: installs the DOM, a fake clock and the platform globals, loads
 * `out/controls/BarcodeScanner/bundle.js` the way a form would, drives the
 * control through the states a form can put it in, and asserts what it did.
 *
 * Why it exists alongside `npm start`: that *shows* you the control, and the
 * states that matter most here are ones it cannot produce. The important one is
 * the scanner being unavailable — `context.device.getBarcodeValue()` rejects on
 * every desktop browser, in PCFHub's demo harness, and on any device with no
 * camera. That is not an edge case for this control; it is the path nearly
 * every visitor takes, and it is a decision (catch, and say typing still works)
 * rather than an accident.
 *
 * Why no test framework: there is none in this repository, and adding one to
 * run a handful of assertions against a bundle would be a dependency, a config
 * file and a second build pipeline for something `node` already does. It also
 * runs the **built bundle** rather than the TypeScript sources, which is the
 * part worth checking — webpack, the externals and the manifest all sit between
 * the source and what a form actually loads. CI runs it after the msbuild pack,
 * so there it drives the production bundle.
 *
 * **What passing here does NOT mean.** Every value below is supplied by this
 * file. It cannot tell you that a real device scanner returns what this stub
 * returns, that the control looks right, that the stylesheet applies, or that a
 * save persists anything. Keep the answers to those in SPEC.md.
 *
 * **And a stub must never be more capable than the thing it stands in for.**
 * `dev/host.js` rejects `getBarcodeValue()` by default because that is what
 * every host but a real device does, and it stubs no other member of `device` —
 * the manifest declares one feature, and a stub answering calls the control
 * never makes would let an assertion pass on a capability that was never asked
 * for.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const dom = require('./dom.js');
const host = require('./host.js');
const clock = require('./clock.js');

const BUNDLE = path.join(root, 'out', 'controls', 'BarcodeScanner', 'bundle.js');

if (!fs.existsSync(BUNDLE)) {
    console.error('\n  No bundle at out/controls/BarcodeScanner. Run npm run build first.\n');
    process.exit(1);
}

/* ----------------------------------------------------------- the platform */

dom.install(global);

/*
 * A fake clock, even though this control owns no timer.
 *
 * It is here for the teardown assertion at the bottom, which counts live timers
 * before and after `destroy()`. That number is zero at both ends today. It
 * starts meaning something the moment somebody adds a debounce to the input,
 * which is the likeliest next change to this file's subject.
 */
const time = clock.install(Date.UTC(2026, 0, 1, 12, 0, 0), global);

const registration = host.captureRegistration(global);

const source = fs.readFileSync(BUNDLE, 'utf8');

vm.runInThisContext(source, { filename: 'bundle.js' });

/* ---------------------------------------------------------------- harness */

const results = [];

function check(label, ok, detail) {
    results.push({ ok, label, detail });
}

// `getString` returns a marked key rather than a real string, so an assertion
// can tell "read from the .resx" apart from "hardcoded in the source" — which
// would otherwise look identical in the output.
const marked = (key) => `resx:${key}`;

/** Every control mounted and not yet destroyed. See the teardown section. */
const live = [];

function disposeAll() {
    while (live.length > 0) {
        live.pop().destroy();
    }
}

/**
 * Mount a fresh control in a given state and hand back everything worth
 * asserting about it.
 *
 * A new instance per state on purpose: `init` runs once per control on a real
 * form, so a suite that reused one instance would be testing a sequence the
 * platform never produces.
 */
function mount(options) {
    const container = dom.createElement('div');
    // `realStrings` reads the English .resx through the rig, for assertions
    // about a sentence the control composed; the default marks every key.
    const getString = options.realStrings ? undefined : marked;
    const context = host.createContext({ ...options, getString });
    const instance = new registration.ctor();

    let notifications = 0;

    instance.init(
        context,
        () => {
            notifications += 1;
        },
        {},
        container,
    );

    instance.updateView(context);

    const handle = {
        instance,
        container,
        outputs: () => instance.getOutputs(),
        notifications: () => notifications,
        update: (next) => instance.updateView(host.createContext({ ...options, ...next, getString })),
        has: (name) => container.classList.contains(name),
        all: (selector) => container.querySelectorAll(selector),
        destroy: () => {
            instance.destroy();

            const at = live.indexOf(handle);

            if (at !== -1) {
                live.splice(at, 1);
            }
        },
        find: (selector) => container.querySelector(selector),
        text: (selector) => {
            const found = container.querySelector(selector);

            return found === null ? null : found.textContent;
        },
    };

    live.push(handle);

    return handle;
}

/** Let a rejected promise settle before asserting on what the catch wrote. */
const settle = () => new Promise((resolve) => process.nextTick(resolve));

/**
 * Let a run of scans finish. Each step awaits the scanner and then pauses on
 * a zero-delay timer — which the fake clock holds until it is advanced — so a
 * run needs both turned, step after step. `setImmediate` is Node's own and
 * the clock leaves it alone, which is why it drains the promise queue here.
 */
async function drain(steps = 30) {
    for (let i = 0; i < steps; i += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        time.advance(1);
    }
}

check('bundle registered a control', typeof registration.ctor === 'function');

if (typeof registration.ctor !== 'function') {
    report();
}

/* ------------------------------------------------------------ what it draws */

const plain = mount({});

check(
    'renders an input and a scan button',
    Boolean(plain.find('.BarcodeScanner-input')) && Boolean(plain.find('.BarcodeScanner-scan')),
);

check(
    'shows the value the platform supplied',
    plain.find('.BarcodeScanner-input').value === '5901234123457',
    plain.find('.BarcodeScanner-input').value,
);

/*
 * The button is a glyph since 0.3.0, so its name is all a screen reader gets
 * and its tooltip is all a sighted user who does not know the icon gets. Both
 * come from the .resx — a literal in the source would read the same on screen
 * and be invisible in a review — and both name the field, so two scanners on
 * one form are not two buttons called "Scan".
 */
check(
    'the scan button is named from the .resx, as its label and its tooltip',
    plain.find('.BarcodeScanner-scan').getAttribute('aria-label') === 'resx:BarcodeScanner_ScanLabel'
        && plain.find('.BarcodeScanner-scan').title === 'resx:BarcodeScanner_ScanLabel',
    `${plain.find('.BarcodeScanner-scan').getAttribute('aria-label')} / ${plain.find('.BarcodeScanner-scan').title}`,
);

const glyph = plain.find('.BarcodeScanner-scan').querySelector('svg');

check(
    'and draws a Fluent glyph that a screen reader is told to skip',
    glyph !== null && glyph.getAttribute('aria-hidden') === 'true' && plain.text('.BarcodeScanner-scan') === '',
    String(glyph && glyph.getAttribute('aria-hidden')),
);

check(
    'the input and the button share one field surface, as the platform\'s own fields do',
    plain.find('.BarcodeScanner-field').querySelector('.BarcodeScanner-input') !== null
        && plain.find('.BarcodeScanner-field').querySelector('.BarcodeScanner-scan') !== null,
);

check(
    'the named field reads as its form label, not the control\'s name',
    mount({ realStrings: true }).find('.BarcodeScanner-scan').getAttribute('aria-label') === 'Scan a code into Product code',
    mount({ realStrings: true }).find('.BarcodeScanner-scan').getAttribute('aria-label'),
);

/*
 * The host's theme, and only the host's: a model-driven form says dark or
 * light; a canvas app says nothing, and nothing is not "light".
 */
check(
    'a dark host gets the dark fallbacks; a host that says nothing gets no class',
    mount({ dark: true }).has('BarcodeScanner--dark') && !mount({ dark: false }).has('BarcodeScanner--dark')
        && !mount({ host: 'canvas', dark: true }).has('BarcodeScanner--dark'),
);

/*
 * The status line is a live region. A scan result arriving asynchronously is
 * exactly the case a screen reader user is otherwise never told about.
 */
check(
    'the status line is announced rather than only shown',
    plain.find('.BarcodeScanner-status').getAttribute('role') === 'status',
    plain.find('.BarcodeScanner-status').getAttribute('role'),
);

check('and says nothing before anything has happened', plain.text('.BarcodeScanner-status') === '');

/*
 * Read-only forms have to disable both halves. Leaving the button live is the
 * easy miss: the input greys out, the control looks read-only, and the scanner
 * still writes to a column the user may not edit.
 */
const readOnly = mount({ disabled: true });

check(
    'a read-only form disables the input and the button',
    readOnly.find('.BarcodeScanner-input').disabled === true
        && readOnly.find('.BarcodeScanner-scan').disabled === true,
    `input: ${readOnly.find('.BarcodeScanner-input').disabled}, button: ${readOnly.find('.BarcodeScanner-scan').disabled}`,
);

/*
 * The canvas/model-driven split. This control reads no column metadata at all,
 * so the only claim worth making is that a host publishing none does not break
 * it — which is a real claim, because canvas is half its audience.
 */
check(
    'renders on a host that publishes no column metadata',
    Boolean(mount({ host: 'canvas' }).find('.BarcodeScanner-input')),
);

/* ------------------------------------------------------------ the scanner */

/*
 * **The assertion this file exists for.**
 *
 * `getBarcodeValue()` rejects on every desktop browser, in PCFHub's own demo
 * harness, and on any device with no scanner hardware. A control that let the
 * rejection escape would leave the visitor pressing a button that does nothing
 * and reports nothing — which is the state this repository shipped in before
 * the catch existed.
 */
(async () => {
    const unavailable = mount({ barcode: null });

    unavailable.find('.BarcodeScanner-scan').click();
    await settle();

    check(
        'a scanner that is not there says so rather than failing silently',
        unavailable.text('.BarcodeScanner-status') === 'resx:BarcodeScanner_Unavailable',
        unavailable.text('.BarcodeScanner-status'),
    );

    check(
        'and does not write anything to the column on the way',
        unavailable.outputs().value === '5901234123457' && unavailable.notifications() === 0,
        `value: ${JSON.stringify(unavailable.outputs().value)}, notifications: ${unavailable.notifications()}`,
    );

    /*
     * The success path, which no local host can produce for real — hence the
     * stub. What is being asserted is the control's half of the contract: take
     * the string, put it in the input, and tell the platform exactly once.
     */
    const scanned = mount({ barcode: '4006381333931' });

    scanned.find('.BarcodeScanner-scan').click();
    await settle();

    check(
        'a successful scan lands in the field',
        scanned.find('.BarcodeScanner-input').value === '4006381333931',
        scanned.find('.BarcodeScanner-input').value,
    );

    check(
        'and is handed to the platform exactly once',
        scanned.notifications() === 1 && scanned.outputs().value === '4006381333931',
        `notifications: ${scanned.notifications()}, value: ${JSON.stringify(scanned.outputs().value)}`,
    );

    check('with no leftover unavailable message', scanned.text('.BarcodeScanner-status') === '');

    /*
     * A second scan after a failed one has to clear the message, or the control
     * reads "unavailable" over a code it just scanned successfully.
     */
    const retried = mount({ barcode: null });

    retried.find('.BarcodeScanner-scan').click();
    await settle();

    const said = retried.text('.BarcodeScanner-status');

    retried.instance.updateView(host.createContext({ barcode: '1', getString: marked }));
    retried.find('.BarcodeScanner-input').value = 'typed';
    retried.find('.BarcodeScanner-input').dispatchEvent({ type: 'input', target: retried.find('.BarcodeScanner-input') });

    check(
        'typing after a failed scan clears the message it left',
        said === 'resx:BarcodeScanner_Unavailable' && retried.text('.BarcodeScanner-status') === '',
        `after scan: ${said}, after typing: ${JSON.stringify(retried.text('.BarcodeScanner-status'))}`,
    );

    /* ------------------------------------------------------------ typing */

    const typed = mount({});
    const input = typed.find('.BarcodeScanner-input');

    input.value = '9780201379624';
    input.dispatchEvent({ type: 'input', target: input });

    check('typing notifies the platform exactly once', typed.notifications() === 1, String(typed.notifications()));

    check(
        'and getOutputs hands back what was typed',
        typed.outputs().value === '9780201379624',
        JSON.stringify(typed.outputs()),
    );

    /*
     * `updateView` runs on every change to any bound value, including ones this
     * control caused itself — so a control that writes the input
     * unconditionally moves the caret to the end of the field on every
     * keystroke. Invisible in a rendered form, visible here.
     */
    const holding = mount({});
    const held = holding.find('.BarcodeScanner-input');

    held.value = '590123';
    holding.update({});

    check(
        'a re-render with an unchanged value leaves what the user is typing alone',
        held.value === '590123',
        held.value,
    );

    /*
     * The platform echoes each write back late and **out of order** — typing
     * "pase laur" on a real form produced passes carrying "pase laur",
     * "pase lau", "pase laur" (measured 2026-09-13). A guard comparing
     * against the latest value alone takes the late echo as the form's own
     * change, writes it into the box, loses what was typed after it, and
     * throws the caret to the end. Typed in the middle on purpose: at the end
     * of the field a caret jump is invisible. The template's case, ported.
     */
    const echoing = mount({ value: '5901234' });
    const box = echoing.find('.BarcodeScanner-input');

    box.setSelectionRange(3, 3);
    dom.user.type(box, '789');
    echoing.update({ value: '5907891234' });
    echoing.update({ value: '590781234' });
    echoing.update({ value: '59071234' });

    check('a late echo of an earlier keystroke does not undo what was typed after it', box.value === '5907891234', box.value);
    check('and leaves the caret where the user was typing', box.selectionStart === 6 && box.selectionEnd === 6, `${box.selectionStart}–${box.selectionEnd}`);
    check('and getOutputs still hands back the latest value', echoing.outputs().value === '5907891234', JSON.stringify(echoing.outputs()));

    /*
     * A scan is a write too: typed digits echoing back after a scan landed
     * must not replace the scanned code.
     */
    const scanning = mount({ value: '', barcode: '4006381333931' });
    const scanBox = scanning.find('.BarcodeScanner-input');

    dom.user.type(scanBox, '12');
    scanning.find('.BarcodeScanner-scan').click();
    await settle();
    scanning.update({ value: '1', barcode: '4006381333931' });

    const afterStaleEcho = scanBox.value;

    scanning.update({ value: '4006381333931', barcode: '4006381333931' });

    check(
        'an echo of what was typed before a scan does not replace the scanned code, even for a pass',
        afterStaleEcho === '4006381333931' && scanBox.value === '4006381333931',
        `${afterStaleEcho} then ${scanBox.value}`,
    );

    /*
     * PCFHub's demo never writes an output back and re-renders — on a width,
     * a theme, a locale — with the preset's value as it always was (measured
     * on pcf-input-mask's demo, 2026-09-28). A host repeating itself is not
     * news, or every such pass wipes what the visitor typed.
     */
    const demo = mount({ value: '590' });
    const demoBox = demo.find('.BarcodeScanner-input');

    demoBox.setSelectionRange(3, 3);
    dom.user.type(demoBox, '123');
    demo.update({ value: '590', dark: true });

    check('a host repeating its last value does not undo the edit — the hub demo re-renders that way', demoBox.value === '590123', demoBox.value);

    echoing.update({ value: 'SET-BY-SCRIPT' });

    check('but a value the control never wrote is taken from the form', box.value === 'SET-BY-SCRIPT', box.value);

    /* ------------------------------------------------------- many codes */

    /*
     * Scan mode "many" (0.3.0). The column holds one code a line; the box adds
     * a code; Scan calls the scanner until it is closed. **None of this has
     * met a real scanner** — no phone has run the probe — so what a closed
     * scanner returns is played both ways here, and the loop's guards are
     * asserted against the one host known to answer without a person: one
     * that hands back the same code on every call, as the hub's demo does.
     */
    const listed = mount({ scanMode: 'many', value: 'A\nB', realStrings: true });

    check(
        'many: the column\'s lines are listed, counted, and the box is left empty to add to',
        listed.all('.BarcodeScanner-code').length === 2
            && listed.text('.BarcodeScanner-count') === '2 codes'
            && listed.find('.BarcodeScanner-input').value === ''
            && listed.find('.BarcodeScanner-input').placeholder === 'Type a code and press Enter'
            && listed.has('BarcodeScanner--many'),
        `${listed.all('.BarcodeScanner-code').length} rows, "${listed.text('.BarcodeScanner-count')}"`,
    );

    check(
        'and each row\'s remove button names the code it removes',
        listed.all('.BarcodeScanner-remove')[1].getAttribute('aria-label') === 'Remove B',
        listed.all('.BarcodeScanner-remove')[1].getAttribute('aria-label'),
    );

    check(
        'and Scan says it scans codes, plural',
        listed.find('.BarcodeScanner-scan').getAttribute('aria-label') === 'Scan codes into Product code',
        listed.find('.BarcodeScanner-scan').getAttribute('aria-label'),
    );

    const runCalls = [];
    const run = mount({ scanMode: 'many', value: '', barcode: ['111', '222', '333'], calls: runCalls, realStrings: true });

    run.find('.BarcodeScanner-scan').click();

    const busyDuring = run.find('.BarcodeScanner-scan').getAttribute('aria-disabled');
    const disabledDuring = run.find('.BarcodeScanner-scan').disabled;

    run.find('.BarcodeScanner-scan').click();
    await drain();

    check(
        'many: a run adds each code as its own line, until the scanner is closed',
        run.outputs().value === '111\n222\n333' && run.all('.BarcodeScanner-code').length === 3,
        JSON.stringify(run.outputs().value),
    );

    check(
        'and writes each one as it arrives, so a run cut short keeps what it had',
        run.notifications() === 3,
        String(run.notifications()),
    );

    check(
        'and says how many it added when it is over',
        run.text('.BarcodeScanner-statusText') === '3 codes added.' && run.find('.BarcodeScanner-status').dataset.tone === 'success',
        `${run.text('.BarcodeScanner-statusText')} (${run.find('.BarcodeScanner-status').dataset.tone})`,
    );

    check(
        'while it runs, Scan is aria-disabled — not disabled, which would drop the focus — and a second press starts nothing',
        busyDuring === 'true' && disabledDuring === false && runCalls.length === 4
            && run.find('.BarcodeScanner-scan').getAttribute('aria-disabled') === null,
        `during: aria-disabled ${busyDuring}, disabled ${disabledDuring}; calls ${runCalls.length}; after: ${run.find('.BarcodeScanner-scan').getAttribute('aria-disabled')}`,
    );

    const closedEmpty = mount({ scanMode: 'many', value: '', barcode: ['111', '222'], barcodeEnd: 'empty', realStrings: true });

    closedEmpty.find('.BarcodeScanner-scan').click();
    await drain();

    check(
        'a scanner closed with an empty answer ends the run the same way as one that refuses',
        closedEmpty.outputs().value === '111\n222' && closedEmpty.text('.BarcodeScanner-statusText') === '2 codes added.',
        `${JSON.stringify(closedEmpty.outputs().value)} — ${closedEmpty.text('.BarcodeScanner-statusText')}`,
    );

    const skipped = mount({ scanMode: 'many', value: '', barcode: ['111', '111', '222'], realStrings: true });

    skipped.find('.BarcodeScanner-scan').click();
    await drain();

    check(
        'a repeat is skipped and the run goes on',
        skipped.outputs().value === '111\n222' && skipped.notifications() === 2,
        `${JSON.stringify(skipped.outputs().value)}, notifications ${skipped.notifications()}`,
    );

    const sameCalls = [];
    const same = mount({ scanMode: 'many', value: '', barcode: 'SAME', calls: sameCalls, realStrings: true });

    same.find('.BarcodeScanner-scan').click();
    await drain();

    check(
        'a host that answers the same code forever ends the run after two repeats — the hub\'s demo is one',
        same.outputs().value === 'SAME' && sameCalls.length === 3,
        `${JSON.stringify(same.outputs().value)}, calls ${sameCalls.length}`,
    );

    check(
        'and the status line says why, as a warning',
        same.text('.BarcodeScanner-statusText') === '1 code added. SAME is already in the list.'
            && same.find('.BarcodeScanner-status').dataset.tone === 'warning'
            && same.find('.BarcodeScanner-statusIcon').querySelector('svg') !== null,
        `${same.text('.BarcodeScanner-statusText')} (${same.find('.BarcodeScanner-status').dataset.tone})`,
    );

    const none = mount({ scanMode: 'many', value: 'A', barcode: null, realStrings: true });

    none.find('.BarcodeScanner-scan').click();
    await drain();

    check(
        'many: a first call refused is "no scanner here", and nothing is written',
        none.text('.BarcodeScanner-statusText') === "Scanning isn't available here — type the code instead." && none.notifications() === 0,
        none.text('.BarcodeScanner-statusText'),
    );

    /*
     * The column's limit, measured (SPEC.md P4): one character past it and the
     * save is refused outright. So a code that would not fit is not added.
     */
    const full = mount({ scanMode: 'many', value: '12345', maxLength: 10, barcode: ['67890', '1'], realStrings: true });

    full.find('.BarcodeScanner-scan').click();
    await drain();

    check(
        'a code that would take the column past its MaxLength is not added, and the run stops there',
        full.outputs().value === '12345' && full.notifications() === 0
            && full.text('.BarcodeScanner-statusText') === "No new codes added. 67890 doesn't fit — the column is full.",
        `${JSON.stringify(full.outputs().value)} — ${full.text('.BarcodeScanner-statusText')}`,
    );

    const canvasLong = mount({ host: 'canvas', scanMode: 'many', value: 'X'.repeat(95), barcode: ['ABCDEFGHIJ'], realStrings: true });

    canvasLong.find('.BarcodeScanner-scan').click();
    await drain();

    check(
        'but a canvas app\'s MaxLength of 100 describes the property, not a column, and caps nothing',
        canvasLong.outputs().value === `${'X'.repeat(95)}\nABCDEFGHIJ`,
        `${canvasLong.outputs().value.length} characters`,
    );

    const typedMany = mount({ scanMode: 'many', value: 'A', realStrings: true });
    const addBox = typedMany.find('.BarcodeScanner-input');

    addBox.value = ' B ';
    addBox.dispatchEvent({ type: 'input', target: addBox });
    addBox.dispatchEvent({ type: 'keydown', key: 'Enter', target: addBox, preventDefault() {} });

    check(
        'many: Enter adds a typed code, trimmed, and empties the box — the control never needs a scanner',
        typedMany.outputs().value === 'A\nB' && addBox.value === '' && typedMany.notifications() === 1,
        `${JSON.stringify(typedMany.outputs().value)}, box "${addBox.value}", notifications ${typedMany.notifications()}`,
    );

    check('and typing alone writes nothing', mount({ scanMode: 'many', value: 'A' }).notifications() === 0);

    const removing = mount({ scanMode: 'many', value: 'A\nB\nC', realStrings: true });

    removing.all('.BarcodeScanner-remove')[1].click();

    check(
        'many: removing a row writes the rest, and the focus lands on the row that took its place',
        removing.outputs().value === 'A\nC'
            && dom.document.activeElement === removing.all('.BarcodeScanner-remove')[1]
            && removing.text('.BarcodeScanner-statusText') === 'B removed.',
        `${JSON.stringify(removing.outputs().value)}; focus on ${dom.document.activeElement && dom.document.activeElement.getAttribute('aria-label')}`,
    );

    removing.all('.BarcodeScanner-remove')[1].click();
    removing.all('.BarcodeScanner-remove')[0].click();

    check(
        'and removing the last row hands the focus to the box',
        removing.outputs().value === '' && dom.document.activeElement === removing.find('.BarcodeScanner-input')
            && removing.text('.BarcodeScanner-count') === 'No codes yet',
        `${JSON.stringify(removing.outputs().value)}, "${removing.text('.BarcodeScanner-count')}"`,
    );

    // An echo of an earlier write of the run must not shrink the list back.
    run.update({ value: '111\n222' });

    check(
        'many: a late echo of an earlier write does not take codes back off the list',
        run.all('.BarcodeScanner-code').length === 3 && run.outputs().value === '111\n222\n333',
        `${run.all('.BarcodeScanner-code').length} rows`,
    );

    run.update({ value: 'X\nY' });

    check('but a value the form sets is listed as it is', run.all('.BarcodeScanner-code').length === 2, `${run.all('.BarcodeScanner-code').length} rows`);

    const readOnlyMany = mount({ scanMode: 'many', value: 'A', disabled: true });

    readOnlyMany.all('.BarcodeScanner-remove')[0].click();

    check(
        'a read-only form disables Scan and the box in many mode, and a row cannot be removed',
        readOnlyMany.has('BarcodeScanner--disabled') && readOnlyMany.find('.BarcodeScanner-scan').disabled
            && readOnlyMany.find('.BarcodeScanner-input').disabled && readOnlyMany.notifications() === 0,
    );

    const switching = mount({ scanMode: 'one', value: 'A\nB' });

    switching.update({ scanMode: 'many' });

    const inMany = switching.find('.BarcodeScanner-input').value;

    switching.update({ scanMode: 'one' });

    // A one-line box drops line breaks from what it is given, as a browser's
    // does — so one-code mode shows a list as one run of text (documented).
    check(
        'switching the mode moves the value between the box and the list without writing',
        inMany === '' && switching.find('.BarcodeScanner-input').value === 'AB' && switching.notifications() === 0,
        `many box "${inMany}", one box ${JSON.stringify(switching.find('.BarcodeScanner-input').value)}`,
    );

    /* ------------------------------------------------- what destroy owes */

    /*
     * **Keep this when the rest of the file changes.** It is written against no
     * particular control and needs no knowledge of what this one takes.
     *
     * Both numbers are zero today: this control adds one listener, to an
     * element inside its own container, which the platform collects with the
     * subtree. It starts meaning something the moment somebody debounces the
     * input or listens on `document`.
     */
    disposeAll();

    const timersBefore = time.pending();
    const listeners = () =>
        Object.values(dom.document.listeners).reduce((total, list) => total + list.length, 0);
    const listenersBefore = listeners();

    mount({}).destroy();

    check(
        'destroy() releases every timer the control took',
        time.pending() === timersBefore,
        `${timersBefore} → ${time.pending()}`,
    );

    check('and every document-level listener', listeners() === listenersBefore, `${listenersBefore} → ${listeners()}`);

    disposeAll();

    report();
})();

function report() {
    const failed = results.filter((result) => !result.ok);

    for (const result of results) {
        const detail = result.detail ? `  — ${result.detail}` : '';

        console.log(`  ${result.ok ? 'ok  ' : 'FAIL'}  ${result.label}${detail}`);
    }

    console.log(
        failed.length > 0
            ? `\n  ${failed.length} of ${results.length} failed\n`
            : `\n  ${results.length} passed — the control's own decisions only; a real scanner is still unverified\n`,
    );

    process.exit(failed.length > 0 ? 1 : 0);
}

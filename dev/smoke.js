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
    const context = host.createContext({ ...options, getString: marked });
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
        update: (next) => instance.updateView(host.createContext({ ...options, ...next, getString: marked })),
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
 * The button label comes from the .resx rather than from a property.
 *
 * It used to be an input property, so a maker translated the word "Scan" by
 * hand per instance — 0.2.0 removed it once the manifest carried real
 * translations. This asserts the removal stuck: a literal in the source would
 * read the same on screen and be invisible in a review.
 */
check(
    'the scan button labels itself from the .resx, not from a property',
    plain.text('.BarcodeScanner-scan') === 'resx:BarcodeScanner_ScanButton',
    plain.text('.BarcodeScanner-scan'),
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

# pcf-barcode-scanner — scaffolded and building

Picked to prove the `limited`-fidelity path: a control that reaches exactly
one platform surface (`context.device`), so the demo harness's device stub
gets exercised for the first time by anything published.

Adopted from `_template`, real control code written, verified with
Microsoft's actual tooling: `npm run refreshTypes` and `npm run build` both
succeed (ESLint, `tsc`, webpack), producing `out/controls/BarcodeScanner/
bundle.js` (7.78 KiB — no React bundled in) that calls `window
.ComponentFramework.registerControl`. All 8 doc pages compile clean through
the hub's real `MarkdownCompiler`. Below records what changed between the
draft and what actually builds.

## Framework mismatch, caught before writing any code

The draft's `pcfhub.json` declared `control.framework: "react_virtual"`,
but the `ControlManifest.Input.xml` draft had `control-type="standard"` —
inconsistent, because the draft was written before deciding an
implementation approach. A single text field and a button don't need
React at all, and `pcf-code-editor` — the one control in this batch that's
actually real and already published — proves `control-type="standard"` /
`framework: "standard"` works in this exact toolchain. Fixed `pcfhub.json`
to `framework: "standard"` and wrote `index.ts` as a plain
`ComponentFramework.StandardControl` with direct DOM manipulation, no
React dependency. That's also why this control's bundle (7.78 KiB) is so
much smaller than `pcf-tag-list`'s (96.7 KiB, which bundles React).

## What it does

A text field with a "Scan" button. The button calls
`context.device.getBarcodeValue()`; on success the decoded string is written
to `value` (the bound property). Typing directly into the field is always
available regardless of scan support.

`Device.getBarcodeValue` is a real PCF device API (opens the platform's
native scanner on a device that has one, e.g. the mobile player) — not
invented for this control, so the manifest and the real-world behaviour
match.

## Manifest shape (`BarcodeScanner/ControlManifest.Input.xml`)

- `value` (`SingleLine.Text`, bound, required) — doubles as input and output,
  same pattern as `ColorPicker`'s `value` in the hub's own schema example.
- `scanButtonLabel` (`SingleLine.Text`, input, default `"Scan"`) — the one
  customisation point, kept deliberately small.
- `<feature-usage><uses-feature name="Device.getBarcodeValue" required="true" /></feature-usage>`
  — documents the one platform reach, and is what should make an author
  reach for `limited` rather than `full` when filling in `pcfhub.json`.

## Demo

Checked the actual harness stub before writing `demo.limitations`, rather
than guessing: `resources/js/demo-harness/context/Context.ts`'s
`deviceUnavailable()` makes **every** `context.device.*` call reject with
`"context.device.{method} is not available in the demo — no device APIs
behind this origin."` It does not resolve with a canned value. So:

- The control's scan handler **must** catch that rejection and render its
  own empty/unavailable state — if it doesn't, the demo shows an unhandled
  promise rejection instead of a graceful "can't scan here" message. This is
  a real implementation requirement, not just a docs note.
- `demo.limitations` says exactly that (scanning rejects; typing still
  works) instead of the vaguer "camera access is stubbed" phrasing I used
  before checking the actual mock.
- Two presets, no dataset fixture needed (`control.type` is `field`, not
  `dataset`): `default` (empty field) and `prefilled` (post-scan state), so
  a visitor can see both without a working scanner.

**The scan shows since 2026-09-29, simulated.** pcfhub/pcfhub#60 let a preset
declare `state.device`, describing the Power Apps mobile client: the default
preset, now *On the mobile app*, declares `barcode: "9780201633610"`, and the
harness answers `getBarcodeValue()` with it and logs the answer as simulated.
A new *In a desktop browser* preset declares nothing and keeps the refusal, so
the no-scanner state is still one click away. Fidelity moved from `limited` to
`mocked`: the feature runs, against a stand-in answer.

Checked with 0.2.1's published bundle against that harness, before the push:

- *On the mobile app*: Scan filled the field with `9780201633610`, and the event
  log said it was simulated;
- *In a desktop browser*: Scan showed "Scanning isn't available here — type the
  code instead." and the field stayed empty.

**Not verified:** what a model-driven form in a desktop browser does with this
control. It has no `getBarcodeValue`, and the manifest declares
`Device.getBarcodeValue` `required="true"` — which the template check warns
makes a host without the bridge fail to load the component rather than
degrade. So the no-scanner state is proven in the harness, not on that host,
and the limitation says so.

## Bundle path — fixed before it could repeat the pcf-tag-list mistake

Same guess-then-verify process as `pcf-tag-list`: `demo.bundle` was drafted
as `out/controls/PCFHub.BarcodeScanner/bundle.js`, guessed from
`pcf-code-editor`'s (wrong) precedent. Running the real build first this
time meant catching it immediately — the actual output is
`out/controls/BarcodeScanner/bundle.js`, no namespace prefix, and
`pcfhub.json` was fixed before commit rather than after.

## Docs

All 8 remaining pages (`canvas.md` and `model-driven.md` both kept and
filled in — unlike `pcf-tag-list`, this is a plain bound field, so it
genuinely works in both canvas apps and model-driven forms) written with
real content and verified against the hub's actual `MarkdownCompiler`
(zero warnings). `migration.md` deleted — first release, nothing to migrate
from, per the template's own instruction. One canvas example originally
included a `Reset()` call to clear the field after each scan; removed
rather than shipped, because I couldn't verify PCF code components support
`Reset()` the way built-in canvas controls do, and asserting it in
published docs without checking would be worse than leaving it out.

## Localisation (0.2.0) — scanButtonLabel became a real translation

Same treatment as `pcf-tag-list`: added Spanish (`3082`), French (`1036`),
German (`1031`), and Japanese (`1041`) resx alongside the base `1033`
(English), each its own `<resx>` in `<resources>`. All five carry the same
key set — checked, not assumed.

`scanButtonLabel` (`SingleLine.Text` input, default `"Scan"`) is removed.
It existed only so a maker could hand-type a translation of the word "Scan"
into the properties pane per instance — `model-driven.md` said as much
("set it... if 'Scan' isn't the right word for your form"). That's strictly
worse than what resx already does for every other maker-facing string on
this control (the property pane, the hub's API reference): it required each
maker to know and type the translation themselves, once per instance,
instead of the org's provisioned language picking it automatically. Replaced
with `BarcodeScanner_ScanButton`, read through
`context.resources.getString()` in `index.ts` — same mechanism the manifest
already used for `display-name-key`/`description-key`, just applied to a
runtime string for the first time on this control. The other runtime
literal, the "Scanning isn't available here" status message, moved the same
way as `BarcodeScanner_Unavailable`, for consistency — no reason to
localise one runtime string and not the other.

Removing an input property is a real breaking manifest change — checked
against the component framework FAQ's own note on this ("code components
cannot add required properties in the newer version" and existing ones
can't be removed once imported) before doing it. Safe here specifically
because this repo has no real install anywhere (`git tag v0.1.0` exists
locally, nothing pushed or imported into an environment) — bumped
`ControlManifest.Input.xml`, `package.json`, and `Solution.xml` to `0.2.0`
together regardless, since the review checklist's version-agreement check
doesn't care why the version moved, only that all three agree.

`docs/canvas.md` and `docs/examples.md` had the property in their
property-binding tables — row deleted, not reworded, since there's nothing
to bind anymore. `docs/model-driven.md`'s callout previously *was* the
localisation story ("set it... for a Spanish form") — rewritten to describe
what actually happens now instead of deleted, since a maker configuring the
control in a non-English org still needs to know the button won't need
manual translation. `docs/api.md`'s prose note about the property (the
`::props-table` directive itself needs no edit — it renders from the
manifest, which no longer has the property) pointed to model-driven.md
instead of describing a property that no longer exists.

## 0.3.0 — scanning many, and a Fluent field

Picked by the catalogue's 32nd demand survey (31 Oct 2026): the control was
an overnight download mover, its own limitations said *One scan at a time*,
and the canvas Barcode reader has *Scan multiple* while a model-driven form
has nothing. The user's decisions, not to reopen: codes go **one per line in
the bound column**, listed under the field with a count and removable; a
repeat in a run is **skipped and said so**; the look is **Copy Field's
route** (a standard control, Fluent tokens with fallbacks, no React); and
**no phone** — the loop is built against the rig and said to be unmeasured on
a device.

### Measured — probe 0.2.9 on the test form, 31 Oct 2026

A throwaway build (commit `6a3d960`): `value` as a type group, every pass
logged per bound column, and console calls for a scan, a write and the Fluent
tokens. Bound to `cll_barcode` (single line, 100), `cll_editor2` (single line,
text area, 4000) and `description` (multiple lines, 2000) on the account
Information form, desktop Edge, the "Probe empty" account.

- **P1 — a desktop form loads the control, and `getBarcodeValue` throws.**
  With `Device.getBarcodeValue` `required="true"`, the control loads and draws
  on a model-driven form in a desktop browser: no *Error loading control*.
  `context.device` is an object carrying `captureImage`, `captureAudio`,
  `captureVideo`, `pickFile`, `getBarcodeValue`, `getCurrentPosition`,
  `openARViewer`, `getMessageReceiver`; `typeof getBarcodeValue` is
  `function`. **Calling it throws synchronously**, before any promise: an
  `Error`, message *Required method 'Device.getBarcodeValue' not supported on
  this device. Error code: PlatformErrorCodes.OperationIsNotSupportedOnThisDevice*,
  no other keys. So `getBarcodeValue().catch(…)` never attaches its handler;
  0.2.x and 0.3.0 both `await` it inside `try`, which catches it (now asserted
  in smoke with the rig's `barcodeThrows`). The 0.2.x note "what such a form
  does with it is unmeasured" is answered: it loads and shows the no-scanner
  state.
- **P2 — the type group imports over 0.2.2 and keeps its binding.** 0.2.9
  imported as an upgrade; `cll_barcode`'s published form XML still read
  `<value type="SingleLine.Text">`, the control loaded on it, and the
  generated `IInputs.value` stayed `StringProperty`.
- **P3 — what each column hands over** (`type`, then `attributes`):
  `cll_barcode` `SingleLine.Text`, Format `Text`, MaxLength 100;
  `cll_editor2` `SingleLine.TextArea`, Format `TextArea`, MaxLength 4000;
  `description` `Multiple`, Format `"2"`, FormatName `TextArea`, Type `memo`,
  MaxLength 2000. `EntityLogicalName` `account` on all three, `security`
  `{ editable, readable, secured: false }`, `client` Web, form factor 1,
  `isDarkTheme` false. A Multiple-lines field below the fold mounted only once
  scrolled into view; the Grid tab's field once its tab was focused.
- **P4 — a line break in a single-line column survives everything.** Through
  the Web API: `"A\nB"` and `"A\r\nB"` stored and read back as written; 101
  characters into the 100-character column refused whole, 400 *0x80044331 …
  exceeded the maximum allowed length of '100'*. Through the form: the
  control's write of `"A\nB"` came back on every pass as `"A\nB"`,
  `Xrm.getValue()` held it, a form save kept it (duplicate detection's
  *Ignore and save*), and the Web API read `"A\nB"`. So a run fits a
  single-line column, and the length has to be checked before the write.
- **The form publishes Fluent 9's tokens to a standard control's container**:
  `--colorNeutralBackground3` #f5f5f5, `--colorCompoundBrandStroke` #0f6cbd,
  `--borderRadiusMedium` 4px, `--fontFamilyBase` Segoe UI…, `--fontSizeBase300`
  14px — the values the stylesheet's fallbacks copy, read where the control
  draws.

### Not measured

- **The loop on a device.** What a scanner closed without a code returns
  (rejection or `''` — both end a run), and whether a call made straight after
  a code reopens the scanner without a tap (if not, a run is one code per
  press). Needs the Power Apps mobile app.
- A canvas app, a phone layout, a screen reader, field-level security.

### Decisions that came out of it

- A run ends on a refusal or an empty answer, on **two repeats in a row** (the
  hub's demo answers the same code at once, forever), or when the next code
  would pass the column's `MaxLength` — read only when `attributes` names a
  table, since a canvas app reports 100 for every property.
- Each code is written as it arrives, so a run cut short keeps what it had.
- Scan is `aria-disabled`, not `disabled`, while it works.
- One-code mode is unchanged; a list shows there as one line, because a
  one-line box drops line breaks (documented).

## Still open

As of 0.3.0 (31 Oct 2026); the scaffold-era items that stood here — no media,
no repository, no solution packed — were all closed by 0.2.x.

- **Scanning many on a phone**: the two unmeasured answers above, on the Power
  Apps mobile app.
- **A queue in the hub's demo**: its harness answers one fixed code
  (`state.device.barcode`), so the *Scan many* preset shows one add and the
  repeat guard, not a run. A list of answers there is a pcfhub change.
- Canvas app, phone layout, screen reader, field-level security: not walked.

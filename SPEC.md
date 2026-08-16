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

## Still open

- Category: set to `input` (existing hub category).
- `media/` is still empty — `pcfhub.json` references `media/logo.svg`,
  `media/field.png`, `media/scan-button.png`; docs reference
  `media/example-basic.png`. None exist.
- No GitHub repo yet — local scaffold only, not yet `git init`'d.
- Solution packaging (`msbuild`) not attempted, same as `pcf-tag-list` —
  only the Node/webpack half of the pipeline was verified locally.

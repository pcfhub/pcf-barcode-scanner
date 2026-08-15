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

## Still open

- Category: set to `input` (existing hub category).
- `media/` is still empty — `pcfhub.json` references `media/logo.svg`,
  `media/field.png`, `media/scan-button.png`; docs reference
  `media/example-basic.png`. None exist.
- No GitHub repo yet — local scaffold only, not yet `git init`'d.
- Solution packaging (`msbuild`) not attempted, same as `pcf-tag-list` —
  only the Node/webpack half of the pipeline was verified locally.

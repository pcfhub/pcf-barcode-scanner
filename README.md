# Barcode Scanner

A text field with a device barcode/QR scan button.

[![Build](https://github.com/pcfhub/pcf-barcode-scanner/actions/workflows/build.yml/badge.svg)](https://github.com/pcfhub/pcf-barcode-scanner/actions/workflows/build.yml)
[![Release](https://github.com/pcfhub/pcf-barcode-scanner/actions/workflows/release.yml/badge.svg)](https://github.com/pcfhub/pcf-barcode-scanner/actions/workflows/release.yml)

Documentation lives on [PCFHub](https://pcfhub.dev/components/pcf-barcode-scanner), built
from the `docs/` directory in this repository. Edit the Markdown here; the hub
recompiles it.

## What it does

Replaces a single-line text column with the same field plus a scan button. The
button calls `context.device.getBarcodeValue()`, which opens the device's native
barcode/QR scanner and writes the decoded string back into the column. Typing into
the field by hand keeps working exactly as before — that path never touches the
device API.

Where scanning is unavailable — a desktop browser, a host that does not implement
the device API, a denied camera permission — the call is rejected and the control
shows its own "scanning unavailable here" state rather than hanging or failing to
load.

## Properties

| Property | Type | Usage | What it controls |
| --- | --- | --- | --- |
| `value` | SingleLine.Text | bound, **required** | The column the field reads and writes |

That is the entire configuration surface, deliberately. The scan button's label was
a property until 0.2.0; it now localises itself from the org's provisioned language
along with every other maker-facing string, so nobody has to type a translation into
a property to get one. Strings ship in English, Spanish, French, German and
Japanese.

Requires the **Device.getBarcodeValue** feature — the only platform surface it
touches.

## On the hub

The demo runs at **limited** fidelity, and the component page says so on the demo
itself:

- The scan button always fails there. No origin behind the sandbox gets device
  APIs, so `getBarcodeValue()` is rejected and you see the control's no-camera state
  instead of a scan result — which is itself worth seeing before you install it.
- Typing a value works normally, and the **Already scanned** preset shows the
  post-scan state without needing a working scanner.

## Install

Download the managed solution from the
[latest release](https://github.com/pcfhub/pcf-barcode-scanner/releases/latest), or from
the component's page on the hub, and import it into your environment.

## Develop

```bash
npm install
npm start          # the PCF test harness
npm run build
npm run lint
```

To pack the solution locally you need msbuild — either Visual Studio or the
Visual Studio Build Tools:

```bash
cd Solution
msbuild /t:build /restore /p:configuration=Release
```

Both zips land in `Solution/bin/Release`.

## Release

1. Bump the version in **three** places, in one commit — they are checked
   against each other in CI:
   - `BarcodeScanner/ControlManifest.Input.xml` → `<control version="…">`
   - `Solution/src/Other/Solution.xml` → `<Version>`
   - `package.json` → `"version"`
2. Tag it: `git tag v1.2.3 && git push --tags`

The release workflow builds, packs both solution types, and attaches them to a
GitHub Release. PCFHub picks the release up from its webhook within seconds, or
from the hourly sweep otherwise.

## Repository layout

| Path | What it is |
| --- | --- |
| `BarcodeScanner/` | The control: manifest, entry point, CSS, localised strings |
| `Solution/` | The Dataverse solution that packages it |
| `docs/` | The pages PCFHub publishes — see the comments in each file |
| `media/` | Images and video referenced from the docs |
| `pcfhub.json` | The hub's manifest: identity, links, docs path, demo |
| `scripts/` | Template setup and the CI guard that keeps it adopted |

## Licence

[MIT](LICENSE)

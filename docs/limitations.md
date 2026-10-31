---
title: Limitations
description: What Barcode Scanner does not do.
order: 7
---

# Limitations

- **Scanning needs real device hardware.** `context.device.getBarcodeValue()`
  only works on a device with a camera or dedicated scanner, and Microsoft
  documents it for the mobile apps only. Without one — most desktop browsers
  — Scan shows "Scanning isn't available here", and typing the code in is the
  way to fill the field. This is deliberate: the field never blocks on a
  scanner that isn't there. The live demo on PCFHub has no camera either. Its
  **On the mobile app** and **Scan many** presets simulate the scanner's
  answer, and its **In a desktop browser** preset shows this message.
- **Scanning many has not been tried on a phone.** In **Many codes** mode,
  Scan opens the scanner again after each code and stops when the scanner
  closes without one. Each call to the device opens the scanner for one code,
  so a run is a loop of calls. Two things only a real device can show have not
  been measured:
  - what a closed scanner returns (the control takes either a refusal or an
    empty answer as the end of the run);
  - whether the scanner reopens straight after a code without another tap.

  If the device refuses to reopen, the run ends after one code, and pressing
  Scan again continues it. See SPEC.md.
- **A run also stops after two repeats in a row.** A code already in the list
  is skipped and the status line says so. A second repeat straight after the
  first ends the run, so a host that answers by itself (the hub's demo does)
  cannot loop forever. Press Scan again to go on.
- **A run stops when the column is full.** A code that would take the value
  past the column's maximum length is not added, because Dataverse refuses the
  whole save rather than cutting it. A single-line text column is often 100
  characters, so roughly seven 13-digit codes. Bind a **Multiple lines of
  text** column for long runs. A canvas app reports a length of 100 for every
  property, so the control applies no limit there; the app's own data source
  decides.
- **No record per code.** Many codes go one per line into **one** column. The control does not create a record per code. In
  a canvas app, split the value on line breaks to do that (see
  [Examples](examples.md)).
- **One-code mode shows a list as one line.** The box in one-code mode is a
  one-line text box, and a browser drops line breaks from such a box. A
  column holding a list (from many-codes mode, or a script) reads as one run of
  text there, and typing into it writes it back without the breaks.
- **No barcode format restriction.** The field accepts whatever
  `getBarcodeValue()` returns or whatever is typed. There's no validation
  against a specific symbology (EAN-13, Code128, QR, …). Add a business rule or
  column format if a specific shape needs enforcing.
- **A repeat is an exact match.** `ABC` and `abc` are two codes, and so are
  two codes that differ only in leading zeros.
- **Not tried on a desktop form with `required="true"` before 0.3.0.** The
  manifest declares `Device.getBarcodeValue` required, because without a
  scanner the control is just a text box. What a desktop model-driven form
  does with that is recorded in SPEC.md (P1).

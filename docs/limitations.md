---
title: Limitations
description: What Barcode Scanner does not do.
order: 7
---

# Limitations

- **Scanning needs real device hardware.** `context.device.getBarcodeValue()`
  only works on a device with a camera or dedicated scanner. Without one —
  most desktop browsers, and every visit to this control's own live demo on
  PCFHub, which runs in a sandboxed iframe with no device access at all —
  the button shows "Scanning isn't available here" and typing the code in
  is the only way to fill the field. This is deliberate, not a bug: the
  field never blocks on a scanner that isn't there.
- **No barcode format restriction.** The field accepts whatever
  `getBarcodeValue()` returns or whatever is typed — there's no validation
  against a specific symbology (EAN-13, Code128, QR, …). Add a business rule
  or column format if a specific shape needs enforcing.
- **One scan at a time.** There's no batch-scan mode that keeps the scanner
  open across multiple codes — each tap of **Scan** opens it once and closes
  after one result.

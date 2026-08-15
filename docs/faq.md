---
title: FAQ
description: Questions that come up more than once.
order: 8
---

# FAQ

## Why does the control not appear in the component list?

Most often the column hasn't had its control swapped from the default text
box — adding the control to the form doesn't do this automatically. Under
**Components → Add component**, choose **Barcode Scanner** explicitly, then
enable it for the client types you need. See
[Model-driven apps](model-driven.md) or [Canvas apps](canvas.md).

## Why does Scan just show "Scanning isn't available here"?

There's no camera or scanner hardware behind the current session — most
commonly a desktop browser, or the control's own live demo on PCFHub, which
runs sandboxed with no device access at all. Type the code in directly; it
writes to the same field. See [Limitations](limitations.md).

## Does it work offline / on mobile / in a phone layout?

The field itself works everywhere — typing needs no connectivity.
`getBarcodeValue()` is a device capability, not a network call, so scanning
works offline too, on a device that has the hardware for it.

## How do I report a bug?

Open an issue at <https://github.com/pcfhub/pcf-barcode-scanner/issues>,
with the platform version and the control version from the solution.

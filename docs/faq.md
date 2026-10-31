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
commonly a desktop browser. Type the code in directly; it writes to the same
field. The live demo on PCFHub shows both sides: its **In a desktop browser**
preset has no scanner and shows this message, and its **On the mobile app**
preset answers Scan with a simulated code. See [Limitations](limitations.md).

## In Many codes mode, why did the scanner stop before I closed it?

Three things end a run besides closing the scanner:

- **two repeats in a row** — the status line names the code;
- **a full column** — the next code would pass the column's maximum length;
- **a device that won't reopen the scanner without a tap**, which has not
  been ruled out on a phone (see [Limitations](limitations.md)).

Press **Scan** again to carry on: the list keeps what the run added.

## Can I scan the same code twice on purpose?

Not in one list: a code already listed is skipped. Counting stock by scanning
each unit is not what this control does; one line per distinct code is.

## Does it work offline / on mobile / in a phone layout?

The field itself works everywhere — typing needs no connectivity.
`getBarcodeValue()` is a device capability, not a network call, so scanning
works offline too, on a device that has the hardware for it.

## How do I report a bug?

Open an issue at <https://github.com/pcfhub/pcf-barcode-scanner/issues>,
with the platform version and the control version from the solution.

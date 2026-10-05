---
title: Overview
description: What Barcode Scanner does, and when to reach for it.
order: 1
---

# Barcode Scanner

A text field with a device barcode/QR scan button.

:::callout{type=warning}
**Reference example · built with AI.** This control was written with AI (Claude) and tested on a live Dataverse form; its code has not been reviewed line by line. It is published as a worked example and is not maintained — read the source and [SPEC.md](https://github.com/pcfhub/pcf-barcode-scanner/blob/main/SPEC.md) (what was measured on the form) before you use it. Fixes are not guaranteed.
:::

::image{src=media/screenshot.png alt="A Barcode text column with a Scan button beside it" zoom}

## Why this one

The platform's device APIs (`context.device.getBarcodeValue()`) open the
native scanner and hand back a decoded string, but nothing wires that to an
ordinary text column out of the box. This control is that wiring: a plain
text field with a **Scan** button next to it. Typing the code in by hand
always works too — the button is a shortcut, not the only way in.

## What it works with

Model-driven forms and canvas apps, on **Web**, **Phone** and **Tablet**.
Scanning itself only works on a device with a camera or scanner hardware —
see [Limitations](limitations.md) for what happens without one. The hub's own
live demo simulates the scanner's answer on its default preset.

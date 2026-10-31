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

::image{src=media/screenshot.png alt="The field with its scan button inside it, a line saying two codes were added, and the three codes listed under it, each with a remove button" zoom}

## Why this one

The platform's device APIs (`context.device.getBarcodeValue()`) open the
native scanner and hand back a decoded string, but nothing wires that to an
ordinary text column out of the box. This control is that wiring: a text
field with a **Scan** button inside it, drawn the way the form's own fields
are drawn (Fluent 2, following the app's theme, light or dark). Typing the
code in by hand always works too — the button is a shortcut, not the only
way in.

## One code, or many

**Scan mode** decides what a scan does:

- **One code** (the default): a scan replaces the value.
- **Many codes, one per line**: Scan keeps the scanner coming back after
  each code until it is closed, and each new code is added on its own line.
  The codes are listed under the field with a count, any of them can be
  removed, a repeat is skipped and said so, and a code typed into the box is
  added with **Enter**. Canvas apps have a *Scan multiple* barcode reader of
  their own; on a model-driven form, this is the way to scan a run of labels
  — serial numbers on a delivery, asset tags on a count — into one record.

## What it works with

Model-driven forms and canvas apps, on **Web**, **Phone** and **Tablet**.
Scanning itself only works on a device with a camera or scanner hardware —
see [Limitations](limitations.md) for what happens without one. The hub's own
live demo simulates the scanner's answer on its default preset.

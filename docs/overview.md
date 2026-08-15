---
title: Overview
description: What Barcode Scanner does, and when to reach for it.
order: 1
---

# Barcode Scanner

A text field with a device barcode/QR scan button.

::image{src=media/field.png alt="Barcode Scanner field with a Scan button" zoom}

## Why this one

The platform's device APIs (`context.device.getBarcodeValue()`) open the
native scanner and hand back a decoded string, but nothing wires that to an
ordinary text column out of the box. This control is that wiring: a plain
text field with a **Scan** button next to it. Typing the code in by hand
always works too — the button is a shortcut, not the only way in.

## What it works with

Model-driven forms and canvas apps, on **Web**, **Phone** and **Tablet**.
Scanning itself only works on a device with a camera or scanner hardware —
see [Limitations](limitations.md) for what happens without one, including in
the hub's own live demo.

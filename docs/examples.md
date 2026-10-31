---
title: Examples
description: Worked configurations of Barcode Scanner.
order: 6
---

# Examples

## A serial-number field on a case form

The common case: a model-driven form column that's almost always filled by
scanning a physical label rather than typing.

| Property | Value |
| --- | --- |
| Bound column | `new_serialnumber` (Single Line of Text) |
| Scan mode | One code |

## Every serial number on a delivery

A goods-received form where a technician scans each item in the box, one
after another, into the delivery record.

| Property | Value |
| --- | --- |
| Bound column | `new_serialnumbers` (Multiple lines of text) |
| Scan mode | Many codes, one per line |

::image{src=media/screenshot.png alt="The field with its scan button inside it, a line saying two codes were added, and the three codes listed under it, each with a remove button"}

Press **Scan**, and the scanner comes back after each code until it is
closed. Each new code is listed under the field and saved on its own line; a
label scanned twice is skipped and the status line says so. A label too
damaged to scan is typed into the box and added with **Enter**.

A **Multiple lines of text** column is the better choice for a run: a single
line of text column holds one too, but it is often limited to 100 characters,
roughly seven 13-digit codes, and the control stops adding when it is full.

## A canvas app that scans into a collection

One code at a time, each scan appended to a collection:

```powerfx
// BarcodeScanner1.OnChange
Collect(ScannedItems, { Code: BarcodeScanner1.Value, ScannedAt: Now() })
```

With **Scan mode** set to many codes, `Value` holds the whole run, one code a
line. Split it to work with each code — here, a row per code once the run is
done:

```powerfx
// A Save button's OnSelect
ForAll(
    Split(BarcodeScanner1.Value, Char(10)) As line,
    Patch(Items, Defaults(Items), { Code: line.Value })
)
```

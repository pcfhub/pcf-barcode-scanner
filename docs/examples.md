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
| Scan button label | `Scan` (default) |

::image{src=media/example-basic.png alt="Barcode Scanner bound to a serial number column"}

## A canvas app that scans into a collection

```powerfx
// BarcodeScanner1.OnChange
Collect(ScannedItems, { Code: BarcodeScanner1.Value, ScannedAt: Now() })
```

Each scan appends to `ScannedItems` — useful for scanning a batch of items
into a gallery one after another.

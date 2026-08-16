---
title: Canvas apps
description: Adding Barcode Scanner to a canvas app or custom page.
order: 3
---

# Using it in a canvas app

:::steps
1. From **Insert → Get more components**, open the **Code** tab and import
   **Barcode Scanner**.
2. Place it from **Insert → Code components**.
3. Bind the properties below.
:::

## Wiring the properties

```powerfx
Set(varCode, "");
```

| Property | Value |
| --- | --- |
| Value | `varCode` |

## Reading the output

`Value` is both the bound input and the output — there's no separate output
property. Read it directly wherever `varCode` is used, or add an `OnChange`
formula on the control if you need to react to a scan (or a manual edit)
immediately rather than on demand:

```powerfx
// On the control's OnChange
Patch(Cases, ThisRecord, { BarcodeValue: BarcodeScanner1.Value })
```

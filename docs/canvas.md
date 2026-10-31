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
| Scan mode | `"one"` or `"many"` |

## Reading the output

`Value` is both the bound input and the output — there's no separate output
property. Read it directly wherever `varCode` is used, or add an `OnChange`
formula on the control if you need to react to a scan (or a manual edit)
immediately rather than on demand:

```powerfx
// On the control's OnChange
Patch(Cases, ThisRecord, { BarcodeValue: BarcodeScanner1.Value })
```

In **many** mode `Value` holds one code a line. `Split(BarcodeScanner1.Value,
Char(10))` turns it into a table of codes — see [Examples](examples.md).

:::callout{type=info}
A canvas app hands a code component a maximum length of 100 for every text
property, whatever it is bound to, so the control does not cap a run in a
canvas app. Your data source's own limit still applies when you save.
:::

Canvas apps also have Microsoft's own **Barcode reader** control, with a
*Scan multiple* option. This control is the same field on a canvas screen and
a model-driven form.

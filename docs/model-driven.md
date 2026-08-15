---
title: Model-driven apps
description: Adding Barcode Scanner to a form.
order: 4
---

# Using it on a model-driven form

:::steps
1. Open the form in the modern form designer.
2. Select the single-line text column this control binds to.
3. Under **Components → Add component**, choose **Barcode Scanner**.
4. Enable it for **Web**, **Phone** and **Tablet** as appropriate.
5. Save and publish.
:::

## Column types

Binds to any **Single Line of Text** column — the manifest declares `value`
as `SingleLine.Text`, so the designer won't offer an incompatible column
type in the first place.

:::callout{type=info}
**Scan button label** is the control's one static configuration value — set
it in the component's properties if "Scan" isn't the right word for your
form (a Spanish form, a different verb for the field's context).
:::

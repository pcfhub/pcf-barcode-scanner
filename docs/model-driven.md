---
title: Model-driven apps
description: Adding Barcode Scanner to a form.
order: 4
---

# Using it on a model-driven form

:::steps
1. Open the form in the modern form designer.
2. Select the text column this control binds to.
3. Under **Components → Add component**, choose **Barcode Scanner**.
4. Set **Scan mode**: **One code** (a scan replaces the value) or **Many
   codes, one per line**.
5. Enable it for **Web**, **Phone** and **Tablet** as appropriate.
6. Save and publish.
:::

## Column types

Binds to a **Single Line of Text**, a **Text Area** or a **Multiple lines of
text** column. The manifest declares `value` as a type group of those three,
so the designer won't offer an incompatible column type in the first place.
A form set up on 0.2.x keeps its binding through the upgrade (measured — see
SPEC.md, P2).

For **Many codes**, prefer a **Multiple lines of text** column. A single
line of text column keeps the line breaks (measured through the Web API), but
it is usually limited to 100 characters. The control stops a run when the
next code would not fit, since Dataverse refuses the whole save rather than
cutting it. Outside the form a list in a single-line column also reads as one
line.

## How it looks

The field is drawn as the form's own fields are: Fluent 2's filled field,
with the scan button inside it and the focus underline in the app's brand
colour. It reads the theme the app publishes, so a dark app gets a dark
field, and it takes no position from the operating system's setting.

:::callout{type=info}
The button's name and tooltip, and every message the control shows, follow
the user's language automatically — no property to set. They ship translated
for English (US), Spanish, French, German, and Japanese; any other
provisioned language falls back to English.
:::

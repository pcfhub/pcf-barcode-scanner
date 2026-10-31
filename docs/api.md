---
title: API reference
description: Properties and outputs, generated from the control manifest.
order: 5
---

# API reference

<!--
  Do not write the property tables by hand.

  `props-table` renders from what the hub parsed out of
  ControlManifest.Input.xml at the release being viewed, so it cannot drift from
  the control. A hand-written table is wrong the first time somebody adds a
  property and forgets this file, and a reader has no way to tell.

  kind: input | bound | output | dataset | dataset_column
  Omit `kind` to render every property in one table.
-->

## Input properties

::props-table{kind=input}

## Bound properties

::props-table{kind=bound}

## Outputs

::props-table{kind=output}

## Notes

`Value` doubles as both the bound property and the effective output — there
is no separate output declared in the manifest, since a bound text property
already round-trips both directions. Scanning and typing both write through
the same property. Since 0.3.0 it binds a **Single Line of Text**, a **Text
Area** or a **Multiple lines of text** column.

**Scan mode** (`scanMode`) is `one` unless a maker sets it, so a form set up
before 0.3.0 behaves as it did. In `many`, `Value` holds one code a line,
separated by a line feed (`\n`), with no blank lines and no repeats.

The **Scan** button's name and tooltip aren't properties — they're localised
strings, resolved from the org's provisioned language the same way the
property names on this page are, and they name the field the button belongs
to. See [Model-driven apps](model-driven.md).

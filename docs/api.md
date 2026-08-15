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
is no separate output declared in the manifest, since a `SingleLine.Text`
bound property already round-trips both directions. Scanning and typing
both write through the same property.

`Scan button label` accepts any text; there's no accepted-values list to
document — it's shown verbatim on the button.

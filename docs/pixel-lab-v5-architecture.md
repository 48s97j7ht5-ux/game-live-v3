# Pixel Lab V5 — Modular Architecture

Status: active architecture for `pixel-editor/v5/`.

## Goal

Pixel Lab must stay extensible without turning into one large HTML/JS file. New tools and features should be added as isolated modules so a change in one feature does not break unrelated parts of the editor.

## Core rule

The core owns only stable editor primitives:

- application state
- layer stack
- active layer
- history / undo
- compositing
- shared event bus / module registry

Everything else is a module.

## Directory structure

```text
pixel-editor/v5/
  index.html
  app.js

  core/
    state.js
    layers.js
    history.js
    compositor.js

  tools/
    pencil.js
    eraser.js
    picker.js
    ...future tools

  modules/
    loupe.js
    palette.js
    layer-panel.js
    view-modes.js
    import-export.js
    ...future feature modules
```

## Module boundary

A module must communicate through the public app API, state, or emitted events. It must not patch another module's private functions or depend on DOM internals owned by another module unless that dependency is explicitly part of the public contract.

Bad pattern:

```js
window.someOtherModule.privateFunction = ...
```

Preferred pattern:

```js
app.on('layers:changed', handler)
app.emit('composite:dirty')
app.registerTool({...})
```

## Tools

Every drawing tool is its own module. Examples:

```text
tools/pencil.js
tools/eraser.js
tools/picker.js
tools/fill.js
tools/contour.js
tools/cleanup.js
tools/mirror.js
```

A tool should operate on the active layer through the core API and request a composite refresh through events. It should not draw directly into the final composite canvas.

## Feature modules

Non-drawing features are also isolated modules. Examples:

```text
modules/loupe.js
modules/palette.js
modules/layer-panel.js
modules/view-modes.js
modules/audit.js
modules/training.js
modules/masks.js
modules/anchors.js
modules/snapshots.js
```

## Layers are authoritative

The composite is a generated preview. Pixel edits belong to individual source layers.

Rules:

1. Never treat the composite canvas as source data.
2. Drawing changes only the active layer.
3. Solo and underlay are view modes, not mutations of layer visibility/state.
4. Export composite is generated from the layer stack.
5. Export layer reads the selected source layer directly.

## View modes

Current modes:

- `composite` — all visible layers at their normal opacity
- `solo` — only the active layer
- `underlay` — active layer normally, other visible layers dimmed for context

View modes must not destructively change layer pixels.

## History

Undo/redo data belongs to the core history module. Feature modules should request snapshots through the history API before destructive changes rather than maintaining incompatible private undo stacks.

## Event-driven updates

Typical flow:

```text
Tool edits active layer
  -> emit composite:dirty
  -> compositor renders
  -> emit composite:rendered
  -> loupe / preview refresh
```

This keeps tools independent from the loupe and preview implementation.

## Rule for future development

Before adding a feature, classify it:

- stable primitive -> `core/`
- drawing/editing behavior -> `tools/`
- UI/workflow/analysis feature -> `modules/`
- character/project data -> data/manifest files, not hard-coded editor logic

Do not put a feature into `app.js` simply because it is convenient.

## Compatibility

`pixel-lab-v4.html` remains preserved as a fallback/reference version. V5 is the active modular architecture. New development should target V5 unless a deliberate migration decision is made.

## Design principle

**One feature = one module whenever practical.**

The objective is not maximum file count. The objective is isolation: a module should be replaceable, disableable, or testable without rewriting unrelated editor systems.

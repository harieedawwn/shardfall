# UI requests (contract problems worked around)

0. SPEC.md was not in core-a.zip or core-b.zip. UI was built from the brief, README.md and the code. Please re-check the screens against SPEC "Run Structure", "Controls", "Save & Settings" and "Visual & Audio Direction".
1. render.draw (FX): call `NR.ui.hud.draw(ctx, NR.world.get(), alpha)` as the last step, in screen space after `ctx.restore()`. Until then hud.js wraps `NR.fx.render.draw` at init. If FX calls hud.draw itself, the wrapper detects it and does not draw twice.
2. Canvas size (FX/main): the canvas is a fixed 1280x720 scaled with object-fit: contain, so in portrait on a phone the game is about 360x202 px. The HUD scales up to 1.7x to compensate. Suggest `NR.fx.render.resize()` to the window aspect on touch devices.
3. audio.sfx names UI calls (ignored if missing): ui_click, ui_deny, ui_back, ui_move, ui_buy.
4. Codex discovery: UI reads `codex.enemy[id]`, `codex.boss[id]`, `codex.evolution[<evolved weapon id>]` (or `<weapon>+<catalyst>`) and `codex.character[id]`. Progression/meta should set these via `meta.discover` (enemy:spawn, boss:phase, weapon:evolve).
5. Data fields the UI uses when present (all optional): item `shape`/`color`; metaNodes `branch` and `requires`; characters `passive`; weapon/item `desc` as {vi, en}.
6. index.html: `#ui > * { pointer-events: auto }` also hits `.touch`; ui.css overrides it with `#ui > .touch { pointer-events: none }`. Safe to drop that rule from index.html.
7. tests/ui.test.js: jsdom is optional; the test skips it when not installed. `NR.ui.screens.guard.ms` (default 280) is the anti-misclick delay; tests set it to 0.

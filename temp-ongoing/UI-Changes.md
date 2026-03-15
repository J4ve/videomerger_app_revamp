# UI Changes Log

## 2026-03-15

### Wizard Refactor: 4 steps -> 3 steps
- Removed standalone Preview step and merged preview into the final step.
- Updated stepper UI to show 3 steps only.
- Updated step navigation labels and button gating to match the new 3-step flow.

### Final Step Layout Redesign
- Reworked final step into a 2-column layout:
  - Left column: mini video player and arranged clip list.
  - Right column: merge preview meta, save destination, progress/status, and upload panel.
- Added selectable arranged-list items that switch the currently previewed video.
- Added responsive behavior for mobile (single-column stack).

### Styling Updates
- Added new layout and component styles for:
  - `finalize-layout`, `finalize-left`, `finalize-right`
  - `preview-player-wrap`, `preview-player-box`, `preview-player`
  - `selectable-preview-list`, `preview-file-btn`, `preview-file-btn-active`
  - `final-actions`

### Local Video Preview Fix
- Replaced preview source strategy from `file:///...` URLs to a custom Electron protocol URL (`local-video://preview?path=...`).
- Added a custom `local-video` protocol handler in Electron main process to stream local files safely to the renderer.
- Result: preview player now supports local videos in both development (`http://localhost:3000`) and production builds.

### Preview Playback Flow Upgrade
- Enabled preview video autoplay when a clip is loaded.
- Added automatic next-clip behavior: when one preview clip ends, the player selects the next item in the arranged list and starts it.
- End-of-list behavior updated: playback loops back to the first clip after the last clip to continuously preview the full sequence.

### Arrange Screen Polish + Control System
- Added a left-side mini preview panel in Arrange step using approximately one-third width.
- Added clip information under the mini player (duration, last modified date, and file size).
- Added a prominent `Remove selected clip` button below the info block.

### Advanced Sorting (Arrange)
- Replaced simple sort controls with a sort dropdown + order toggle.
- Supported sort fields: Name, Duration, Date Modified.
- Duration/date values are fetched from backend metadata (IPC + ffprobe/stat).

### Lock Arrangement + Duplicate Controls
- Added top-level `Lock arrangement` toggle.
- When enabled, each clip can be position-locked via per-item lock buttons.
- Locked clips cannot be moved, removed, or crossed during drag/reorder/sort operations.
- Added top-level `Duplicate` enable/disable toggle controlling per-item duplication actions.

### Arrange Stability + Metadata Bugfix
- Fixed preview-player tracking during sorting: the current preview now follows the same file after re-order/sort instead of drifting to a different index.
- Added `Size` to the sort dropdown (Name, Size, Duration, Date Modified with Asc/Desc).
- Hardened metadata loading: when enhanced arrange metadata IPC is unavailable/fails, UI falls back to basic per-file info so metadata is no longer entirely unknown.

### Header Prominence + Content Scrolling
- Kept the top header region (logo, app name, stepper, settings/profile) visually pinned and prominent.
- Changed app shell sizing from flexible min-height to fixed viewport-constrained height.
- Constrained scrolling to the main content region only (`wizard-main`), preventing whole-page scroll drift.

### Scrollbar Polish
- Added a sleek rounded (oval) custom scrollbar style using the existing olive/blue app palette.
- Styled scrollbar track and thumb for both WebKit browsers and Firefox-compatible fallback.
- Applied a slightly more prominent themed thumb for the main content scroller (`wizard-main`).

### Step 1 Simplification
- Removed the Resolution and Frame Rate selectors from Step 1 (Add your videos).
- Step 1 now focuses only on video intake (dropzone + selected file list), with standardization controls handled outside that screen.

### Finalization Config Separation
- Added a clickable config switcher at the top of Finalize right column (`Merge Settings` / `YouTube Settings`).
- YouTube section now opens as a compact editor so upload settings are accessible without long scrolling.

### YouTube Quick Presets (Finalize)
- Added concise YouTube editable fields (title, privacy, short description).
- Added quick preset actions directly in Finalize: Save preset, Load preset, Delete preset.
- Presets are persisted into app settings (`ytQuickPresets`) and restored on app load.

### Settings Cleanup + Profile Navigation
- Removed the `Standardization Presets` tab/section from Dashboard settings entirely.
- Updated profile badge in the top-right header to be clickable.
- Clicking the profile badge now opens Dashboard directly to `Account` tab.
- Settings gear continues to open Dashboard on `General` tab.

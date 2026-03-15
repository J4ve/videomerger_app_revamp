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

### YouTube Preset Parity (Settings)
- Updated Settings → YouTube section to match Finalize YouTube preset entry style.
- Added preset management in Settings YouTube defaults: Save preset, Load preset, Delete preset.
- Wired Settings YouTube presets to the same persisted `ytQuickPresets` store used in Finalize.

### Clean Preview Playback Mode
- Removed native video controls UI (pause/progress bar/etc.) from Arrange and Finalize preview players.
- Preview playback now renders as a clean, UI-free video surface.

### Step 1 Title Alignment
- Center-aligned the Step 1 heading (`Add your videos`) and its subtitle for a cleaner hero-style entry point.

### General Settings Overhaul
- Replaced previous General settings fields with quality-of-life controls:
  - App Theme selector (`Olive Dark`, `Midnight Blue`, `Sand Light`).
  - Default output/save folder picker so merges can avoid manual save-prompt flow every run.
  - Preset Pack export/import actions for reusable settings packs.
- Added preset pack file operations (JSON) via app dialogs and IPC handlers.
- Updated merge flow to allow using configured default output folder when explicit output file is not manually selected.

### Menu Label Cleanup
- Removed emoji prefixes from Settings dashboard tab labels (General, YouTube, FFmpeg, Account).

### Theme Surface Cleanup (Sand Light)
- Replaced remaining hardcoded dark backgrounds on key controls with theme-aware surface variables.
- Fixed Sand Light dark spots on elements like the settings mini button, drag/drop zone, toolbar controls, and arrangement cards.

### Theme Feature Stabilization
- Theme now applies immediately when changed in Settings (no delayed visual update).
- Expanded theme variable coverage to key surfaces (shell, header, panel, status chip, output path container) for clearer visual distinction between themes.

### Sand Light Dark-Spot Cleanup
- Removed remaining hardcoded dark fills in Settings, Arrange, and Finalization surfaces.
- Switched progress cards/tracks, preview cards/player shells, dashboard content, preset/account cards, and secondary buttons to theme-variable colors.
- Result: Sand Light now uses consistent warm surfaces without black patches in key sections.

### Remove Button Text Readability
- Updated remove-action button text color to use a theme variable (`--danger-text`) instead of a fixed near-white value.
- Set per-theme danger text values so the label stays readable, especially in Sand Light where white text looked off.

### Native Top Menu Hidden
- Removed the native Electron menu bar (`File / Edit / View / Window / Help`) from the app window for a cleaner custom UI shell.
- Applied the same hidden-menu behavior to the Google OAuth popup window for consistency.

### Google Profile Avatar Display
- Updated authenticated user badge (top-right circular profile button) to display the Google profile picture when available.
- Updated Dashboard `Account` tab card to display the same Google profile picture.
- Added resilient fallback behavior: if image is missing or fails to load, avatar falls back to user initials.

### Guest Mode Auth Consistency
- Updated `Continue without account` action to force Google logout before entering the main workflow.
- This prevents carry-over of a previous signed-in session when user explicitly chooses guest mode.

### Header Avatar Side-Bleed Fix
- Fixed the small top-right profile avatar circle showing blue side slivers around the Google image.
- Reset native button padding/appearance on the avatar button so the profile image fills the circular badge edge-to-edge.

### Account Tab YouTube Section
- Added a YouTube section in Account tab with an `Open Channel` action.
- Added a recent-upload list (latest channel videos) with clickable entries that open each video link.
- Added loading/error/empty states for YouTube account fetch results.

### YouTube Account Error Recovery UX
- Improved Account tab YouTube error behavior with a specific reconnect path when permissions are stale.
- Added a `Reconnect Google` action on YouTube summary failures that require re-authentication.

### Finalization Default Location Carry-Over
- Fixed Finalization `Save destination` display to reflect the configured default output folder when no manual save path is selected.
- Merge action now uses the same suggested path shown in the UI, keeping displayed destination and merge output target aligned.

### Real-Time Progress Bar Updates
- Progress bar now reflects real incremental merge progress instead of a placeholder midpoint value.
- Status text updates continuously during merge stages using backend processing logs.

### Progress Smoothness Reliability Fix
- Improved progress responsiveness to avoid perceived `0 -> finished` jumps on some runs.
- Progress updates now account for multiple progress markers arriving together and render the latest value.

### Header Tagline Cleanup
- Removed the extra tagline text beside the `VideoMerger` title in the auth and main workflow headers.

### Material Icons Pass (Android/Flet-style)
- Added Google Material Symbols to the renderer UI.
- Step 1 file remove action now includes a small cancel icon beside `Remove`.
- Arrange sequence per-item controls switched to icon buttons:
  - Lock uses `lock` / `lock_open` states.
  - Duplicate uses `content_copy`.
  - Move actions use `arrow_upward` / `arrow_downward`.
  - Added color-cycling visual variants for lock/duplicate icon buttons.
- Added Google icons in account-related areas (sign-in actions and account section heading/sign-in state labels).
- Added YouTube icons in YouTube-related areas (tabs, section headers, YouTube settings switch, upload actions, and channel block).

### Google Icon Visual Refinement
- Replaced the generic Google material glyph with a proper multicolor Google "G" logo in account/sign-in related UI locations.
- Updated account tab icon rendering to use the same branded Google logo for visual consistency.

### Preview Player Controls Restored
- Restored native video controls (play/pause/progress bar) on Arrange and Finalize preview players.
- Kept restricted options to avoid PiP/download behavior by setting `controlsList="nodownload noplaybackrate"` and `disablePictureInPicture`.

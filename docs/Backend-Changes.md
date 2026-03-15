# Backend Changes Log

## 2026-03-15

### Theme Feature Stabilization
- Scope: Theme reliability and UX polish request.
- Backend impact: No backend runtime logic changes required for this specific theme fix.
- Reason: Theme rendering is controlled by renderer state + CSS variable system and does not require IPC/service pipeline updates.
- Notes: Existing settings persistence (`get-settings` / `save-settings`) continues to store `appTheme` value.

### Sand Light Dark-Spot Cleanup
- Scope: Remove remaining dark visual patches in Settings/Arrange/Finalization for Sand Light.
- Backend impact: None.
- Reason: Fix implemented entirely in renderer CSS by replacing hardcoded dark colors with theme variables.

### Native Window Menu Removal
- Scope: Hide default Electron application menu strip (File/Edit/View/Window/Help).
- Backend impact: Electron window configuration update in main process (`BrowserWindow` options + menu visibility call).
- Reason: Align window chrome with custom in-app header design and remove duplicate top-level controls.

### Google Avatar Display in UI
- Scope: Show Google profile picture in header badge and Account tab.
- Backend impact: No additional backend changes required.
- Reason: Existing OAuth payload and persisted auth store already include `user.picture`; renderer now consumes and renders it.

### Guest Mode Forces OAuth Logout
- Scope: Ensure "Continue without account" truly enters guest mode.
- Backend impact: Uses existing `google-oauth-logout` IPC handler to clear persisted auth data before step transition.
- Reason: Prevent stale login state from previous runs when user intentionally skips account login.

### YouTube Account Summary IPC
- Scope: Support Account tab YouTube insights (channel link + recent videos).
- Backend impact:
	- Added `youtube-account-summary` IPC handler.
	- Added Google API helper requests to query channel info (`channels?mine=true`) and upload history (`playlistItems` from uploads playlist).
	- Added `open-external` IPC handler so renderer can open channel/video links safely via shell.
- Reason: Provide in-app visibility of the signed-in user's YouTube presence without leaving the app flow.

### YouTube Summary Reliability + Reauth Signaling
- Switched summary fetch flow to a more tolerant approach:
	- Channel details from `channels?part=snippet&mine=true`.
	- Recent uploads from `search?forMine=true&type=video&order=date`.
- Reduced hard failure cases by returning channel info even when recent-video query fails.
- Added friendly error mapping and `needsReauth` flag when token scope/permission issues are detected.

### Default Output Carry-Over (Finalize)
- Scope: Ensure configured default output location appears in Finalization before manual save selection.
- Backend impact: None.
- Reason: Fix is renderer-side state/display alignment using existing default-output settings and merge path logic.

### Real-Time Merge Progress Emission
- Scope: Make renderer progress bar move in real time during merge.
- Backend impact: Updated processing event parser in `VideoProcessingService` to consume Python CLI `PROGRESS: <n>` lines and emit true percentage updates.
- Added monotonic progress clamping (0..100) and forwarded INFO status lines as live progress messages.

### Progress Streaming Robustness
- Added unbuffered Python execution (`python -u`) in adapter to flush progress logs immediately.
- Updated service parser to handle multiple `PROGRESS:` tokens in a single stream chunk and emit the highest observed value.
- Result: reduced chunking/buffering artifacts that made progress appear to jump directly from 0 to completion.

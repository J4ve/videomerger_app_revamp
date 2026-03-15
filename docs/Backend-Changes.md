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

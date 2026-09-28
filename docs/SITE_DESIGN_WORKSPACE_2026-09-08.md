# Site Design V2 workspace

Implemented the selected Site Design workspace direction in the existing editor. Page navigation and design selection now stay on the left, the live preview occupies the center, and a focused inspector opens on the right. The actual route remains `/admin/site-design-v2`; the classic branding editor remains separate.

The five approved shop presets have compact visual rows. The six order stages are selected one at a time, with a summary of current choices. Banner title/subtitle editing is available immediately, with existing image/layout controls under a disclosure. Earlier visual themes remain under their existing closed disclosure.

The preview adds an opt-in `presentation="workspace"` mode. Desktop uses available canvas height; tablet/mobile retain explicit device dimensions. Callers that do not request workspace presentation keep the existing device frame. Preview navigation, messages, product data, click-to-edit and persistence callbacks are retained.

## Local review

Open `http://127.0.0.1:8110/output/design-exploration/site-design-2026-09-08/implemented.html`.

This DEV-only entry uses the shared workspace, navigation, selectors, banner text fields and real iframe. It stores a versioned draft under `webprinter:site-design-review:v1` in this browser only. It has no publishing or hosted save action. The full editor link requires login. The sample featured product is the existing Aluminium Skilte product, using normal public read paths.

Implementation files:

- `src/components/admin/SiteDesignWorkspace.tsx`
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/admin/SiteDesignPreviewFrame.tsx`
- `src/components/admin/SiteDesignHeroCopy.tsx`
- `src/components/admin/OrderFlowDesignInspector.tsx`
- `src/components/admin/PrintDesignPicker.tsx`
- `src/components/admin/OrderFlowDesignPicker.tsx`
- `src/styles/siteDesignWorkspace.css`
- `src/dev/SiteDesignWorkspacePreview.tsx`

Build and seven focused tests pass. No TypeScript diagnostics added against the current dirty-worktree baseline. Source snapshots and logs: `tmp/site-design-workspace-before/`, `tmp/site-design-workspace-qa/`. Visual comparisons: `output/design-exploration/site-design-2026-09-08/implementation/`. Detailed evidence and limits: `design-qa.md`.

## Remaining verification

The browser was not authenticated for the actual admin route. Check its complete advanced inspector, click-to-edit interactions and save/publish behavior while signed in. The local review demonstrates shared UI and local state; it does not prove hosted persistence or end-to-end commercial readiness.

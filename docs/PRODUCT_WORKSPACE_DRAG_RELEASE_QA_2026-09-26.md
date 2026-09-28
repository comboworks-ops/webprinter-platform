# Product workspace drag release QA — 26 September 2026

Scope: local preview at `http://127.0.0.1:8113/admin/product/photo-poster#workspace`, signed in to the master admin. The preview uses the shared backend; no product save or publish was submitted.

- A single click on the A4 format opened its editing controls. It did not reorder the formats.
- Holding and dragging A4 over another format moved it in the editor draft. The original `A4, A3, A2, A1, A0, B2, B1, B0` order was restored with **Fortryd sidste flytning**.
- After mouse release, the preview contained zero drag copies and zero elements marked as dragging. The original format order was confirmed after undo.
- Focused drag and placement tests, TypeScript, focused ESLint, and the Vite production build passed.

The fix clears the pointer gesture on release or cancellation and only moves the preview while the primary pointer button is held. The click following a completed drag is suppressed, while an ordinary click still selects the item for editing. Live persistence and deployment were outside this local interaction check.

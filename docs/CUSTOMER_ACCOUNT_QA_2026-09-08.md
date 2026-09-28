# Customer account companion — local QA

Date: 8 September 2026. **Final result: passed for the local visual and source scope.** Authenticated persistence, actual tenant domains and replacement-file backend execution remain unverified. [Implementation and remaining steps](CUSTOMER_ACCOUNT_IMPLEMENTATION_2026-09-08.md).

## Target and evidence

- Selected source: `output/design-exploration/customer-account-2026-09-08/option-2-companion.png`, option 2 explicitly selected by Thomas.
- Local review: `http://127.0.0.1:8110/output/design-exploration/customer-account-2026-09-08/implemented.html`. Vite on port 8110 belongs to this checkout. The review imports the actual account workspace, order, overview and saved-design components, with clearly labelled sample data. Address/settings links explain that the actual account is required.
- Source and desktop screenshot are both 1487 × 1058 pixels. Paired comparison without resizing: `implementation/comparison-final.png` in that artifact directory, 2974 × 1094 including labels. Both were viewed together; the image viewer scales the combined display, so individual full-size captures were also inspected.
- Screenshots: `orders-desktop-final.png`, `orders-tablet.png` (768 × 1024), `orders-mobile-list.png`, `orders-mobile-detail.png`, `overview-mobile.png`, `designs-mobile.png` (390 × 844), `overview-desktop.png`, `auth-desktop.png` (1280 × 720), `auth-tenant-mobile.png` (390 × 844). The desktop auth capture precedes the final heading-font correction; final mobile auth and computed styles verify that correction.

## Comparison and corrections

1. The first side-by-side comparison exposed storefront link-selector specificity overriding account colours, and global headings retaining Poppins. Scoped account colour rules and explicit inherited heading fonts corrected both. Final computed desktop account styles: Inter, white header links, navy detail title.
2. Adjusted sidebar width, title hierarchy, split proportions, product-image aspect ratio, file prompt and metadata spacing to follow the selected composition. Existing real product assets replace generated illustrative artwork.
3. Tablet file-prompt text was cramped beside the upload button. At narrower widths the button now moves under the text; on mobile it spans the prompt. Final tablet and mobile screenshots verify this correction.
4. Added missing space above overview/design content. Mobile menu closes after navigation, and the header account icon retains an accessible name when its text is hidden.
5. The mobile login hid a desktop line break and joined “idé” and “til”. Added a real space and inherited the auth font. The final mobile capture reads “Fra første idé til færdigt tryk.”
6. Development hot reload initially recreated the React root in the isolated preview. It now retains the root through Vite hot data. A fresh final preview has no error-level console messages. Real main/tenant auth inspections also returned no error-level messages.

No actionable P0/P1/P2 visual issues remain in the tested local surfaces. Deliberate differences from the generated concept include real product thumbnails, source-backed availability copy, accessible generic account/profile icons, and additional order sections below the initial view. Secondary metadata is slightly denser than the concept. The local preview disclosure is not part of the production customer account.

## Browser checks

| Check | Observed result |
| --- | --- |
| Responsive order layout | Document width equals viewport at 1487, 768 and 390 pixels. Desktop uses list plus detail; tablet/mobile use a list/detail transition with a back button. The file action remains reachable. |
| Search and order navigation | Searching WP-1042 leaves the Visitkort row; clearing restores three rows. Selecting it changes `?order=sample-1042` and the visible detail. Back returns to the list. |
| Overview and menu | Mobile navigation opens and closes, navigates to overview, and closes on selection. The file-attention link opens exactly `sample-1048`. Desktop overview shows orders plus contact/address summary. |
| Saved designs | The overview bridge opens the designs page. A missing search term shows zero matches and an explicit clear action. Clearing restores the sample design. Reopening a real saved design was source-inspected only. |
| Messages | Opening the local conversation, entering and submitting a sample message appends it and clears the draft. This uses the isolated in-memory callback; nothing was sent to a customer or printer. |
| Loading/error/empty | Failed overview retrieval shows an error/retry, without the first-order empty message. Retry restores sample orders. Successful empty and loading states display distinct messages. |
| Tenant colours | Switching the sample shop colour gives matching header/button RGB 164,68,11; resetting restores RGB 8,127,197. This verifies style inheritance with fixtures, not tenant-settings persistence. |
| Real main auth entry | Signed-out `/min-konto?tenantId=00000000-0000-0000-0000-000000000000` redirects to customer auth with both tenant context and the exact scoped return path. The storefront header remains. |
| Real tenant auth entry | Signed-out `/min-konto/ordrer?force_domain=salgsmapper.dk&order=review-route-only` retains that domain and exact order in the auth return URL. Resolved auth copy names salgsmapper.dk. Mobile fits 390px. This is query-context localhost proof, not native-domain auth proof. |
| Signup/recovery | Real signup toggles to its email/password form. Recovery opens “Glemt adgangskode?” with “Send nulstillingslink”, preserving context. No account was created and no email was sent. |

Keyboard focus, associated form labels, named navigation controls, status/error regions and reduced-motion styles were inspected. This is not a complete accessibility certification. Invoice generation, hosted file storage, actual read receipts and authenticated form saves were not exercised by the fixture review.

## Source and build checks

- 31 native Node tests pass across navigation, scoped order queries/projections, status/search/reorder helpers, profile hydration, replacement upload sequencing and strict shop resolution. They use local synthetic inputs/mocked clients.
- Scoped ESLint: zero errors; three Fast Refresh organization warnings remain. The final small auth/preview correction also passes scoped lint.
- No account/Auth/preview TypeScript diagnostics in the full compiler output after fixture typing fixes. The repository has unrelated existing TypeScript failures; no whole-repository typecheck pass is claimed.
- Production Vite build passes; existing bundle-size warnings remain. No dependency or lockfile changes were made for this task.
- Supabase explicit-grant checker passes. Migration SQL was source-reviewed only: no PostgreSQL runtime was available, so atomicity, concurrency, rollback and RLS/storage enforcement have not been executed.
- The prepared replacement RPC is undeployed. Its preflight prevents uploading when unavailable; uncertain finalization does not report success or delete a potentially current object. See the handoff for the required two-customer/two-shop policy and persistence checks.

## Remaining acceptance

Test the real signed-in account with nonempty owned data in two shops, including profile/address saves and checkout reuse, design save/reopen/reload, messages/read receipts, upload lifecycle, invoices and company membership. Apply and test the prepared migration in an isolated backend before enabling it in a hosted release. Define post-order proof approval and locate invoice production before promising those workflows. No deployment or hosted write was performed here.

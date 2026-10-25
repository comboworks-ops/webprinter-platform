# Webprinter: system assessment and product direction

**Current status index — 25 October 2026:** see [REA work status](REA_WORK_STATUS_2026-10-25.md) for the later live fixes, local prototypes, evidence and remaining acceptance work. Preserve this original assessment as the dated inspection baseline.

**Status update — 21 October 2026, 13:20 CEST:** F01 (PVCbanner checkout warning) and F02 (Salgsmapper selection handoff) are resolved on the live sites. Fresh REA checks confirm the VAT total, 200/500-piece handoffs and manual matrix changes through checkout. The fixes were already deployed when this follow-up began; no additional application changes were needed. The original findings and screenshots below are retained as historical evidence. See [the fresh verification](CHECKOUT_SELECTION_RECHECK_2026-10-21.md) and [the original release record](CHECKOUT_SELECTION_RELEASE_2026-10-21.md).

21 October 2026 · REA browser inspection, current source review and primary-source competitor research

**Follow-up status:** the two initial checkout/selection defects were fixed and verified live; see [release receipt](CHECKOUT_SELECTION_RELEASE_2026-10-21.md). The [resumed REA correction pass](REA_CORRECTIONS_CONTINUATION_2026-10-21.md) records fresh checks and locally prepared wording fixes. The findings and screenshots below preserve the original inspection baseline.

**Recommendation: build on Webprinter’s interactive price matrix and product knowledge. Make the connections between discovery, configuration, artwork, approval and production dependable.** The strongest opportunity is a platform for print houses that gives their customers a simple buying experience, supports their business customers through CompanyHub, and permits both own production and selected suppliers.

This is a strategic assessment of the whole system, supported by a public-site audit. It is not a completed acceptance test of every authenticated module. Twenty-three browser scenarios cover Webprinter, its three identified shops and competitor surfaces. Private admin, CompanyHub and Print.com ordering required login; those areas are assessed from current source or clearly attributed vendor documentation.

The user’s direction is a design constraint: **keep visible formats, paper, finishing, instant prices and quantity comparisons. Do not replace the matrix with a long Print.com-style configuration form.** None of the recommendations below have been implemented. Pricing, products, publication, subscriptions and production state were not changed.

## 1. The decisions that matter

| Decision | Recommendation | Reason |
| --- | --- | --- |
| Product ordering | Preserve the matrix and visual option choices | They let people explore price consequences without repeatedly restarting a form. |
| Immediate work | Repair checkout readiness and selection continuity | These interrupt a buyer who has already chosen a product. |
| Customer experience | One clear task per stage, with configuration retained | Simplicity comes from relevant choices and continuity, not hiding the useful price comparison. |
| Artwork | Add a project workspace with independent artwork states | Multiple designs need thumbnails, quantities, file checks and approval per design. |
| Books and foil | Product-specific preparation modes on the existing designer foundation | A booklet, bound book and cut-letter job have different production requirements. |
| CompanyHub | Develop as a private procurement workspace within a shop | It has a different purpose from a public catalogue and already has substantial source foundations. |
| White label | Present as branding and ownership of the customer experience | A complete branded webshop is already a white-label offer. Embedding is a delivery option. |
| Free shop | Pilot a supplier-funded offer only after measuring costs | LaserTryk’s free offer is tied to a production business; a free independent SaaS shop has different economics. |
| Architecture | Share the core across public shops, CompanyHub and future integrations | Do not create separate price, artwork, approval or order engines for each channel. |

## 2. What the live inspection found

### F01 — Checkout shows a persistent shop-level warning. Priority: immediate investigation

On PVCbanner.dk, a 100 × 100 cm banner reached checkout with the selected product, dimensions, finishing and price intact. The product was 399 kr plus 49 kr delivery, giving 448 kr excluding VAT. The summary displayed: “Butikkens moms og betalingsbeløb kunne ikke bekræftes. Kontakt butikken.” The payment button was disabled. This happened again in an independent fresh session after a longer wait. Evidence: captures 10 and 19.

This is a confirmed visible warning, not proof of a failed paid transaction. Contact details and artwork were also incomplete, which can independently prevent payment. The repeated capture did not establish a failed HTTP request. Current local tax configuration already includes the PVC launch shop, so “add the missing tenant” is not an established fix. Diagnose the deployed quote/tax response and configuration, compare it with the current source, then verify the complete flow in a controlled test environment.

**Acceptance:** a valid product can obtain the authoritative tax-inclusive payable total; failures give a useful recovery message; payment remains blocked when the total cannot be verified. Do not remove the safeguard to make the button work.

### F02 — The folder homepage loses the chosen offer. Priority: high

The Salgsmapper homepage showed 200 pieces, 350 g matt silk and 739 kr, while descriptive copy referred to 100 A4 folders. Following its actual “Bestil nu” link opened a product with Chromo card, 50 pieces and 573 kr selected. That product’s matrix showed 1,184 kr for 200 pieces of 350 g matt silk. The destination link carried no selection parameters. Evidence: captures 04 and 18.

The observable problem is inconsistent promotional copy and selection handoff. It does not establish that the underlying pricing calculation is wrong. Generate homepage offers from an identifiable valid configuration, carry that configuration into the product, and show an explicit change message if it is no longer available. Keep the original matrix and pricing authority.

**Acceptance:** quantity, material, format, print sides, finishing and displayed offer remain the same after the CTA, or the customer is clearly told what changed before continuing. The header also spells the brand “salgmapper.dk”, while the inspected domain is salgsmapper.dk.

### F03 — Public catalogue presentation exposes unfinished merchandising. Priority: high

The Webprinter demo listed 23 products including “New Flyer Test”, “new folders”, “Flyers podtest”, “businesscards” with “Supplier-bank draft product” copy, and supplier-oriented naming. Some image labels indicated missing product imagery. Evidence: capture 02. These undermine the demonstration of a finished platform. They are a merchandising finding, not evidence of a security breach.

Create a small reviewed demonstration catalogue covering a flyer, folder, banner and booklet. Keep experiments available internally; review publication individually rather than deleting data. A customer-ready product should have a clear Danish name, correct image, useful description, valid options, known price source, exact file requirements and a tested next step.

Onlinetryksager’s inspected homepage catalogue showed Blokke, Flyers and Plakater, while another section promoted T-shirts, hoodies and merchandise. The flyer thumbnail suggested a folded leaflet. Generic Webprinter footer copy and generic social destinations further weakened the shop’s identity. Evidence: capture 03. Align the visible promise with the actual available range.

PVCbanner’s identity and product presentation were coherent. Its navigation advertised several wider categories while the inspected homepage featured one PVC banner product. Verify the linked category ranges before expanding the promise; this inspection did not establish that the entire shop contains only one product. Evidence: capture 05.

### F04 — The matrix is an asset worth preserving. Priority: protect through changes

In a fresh REA scenario, selecting two PVC banners changed the selected matrix cell to 798 kr, total area to 2 m² and the order summary to 847 kr including the selected 49 kr delivery, excluding VAT. The update was directly observed; no timed performance benchmark was taken. Evidence: captures 07 and 14.

The folder page also combines visual format choices, spine options, one- or two-sided printing, a paper-by-quantity matrix, template access and an optional 3D view. That combination is a credible differentiator. Improve explanation and mobile placement while preserving this interaction.

Recommended additions: show total and unit price together, keep tax and delivery labels explicit, retain the selected cell visibly, and offer a small “recommended for this use” hint. Do not automatically choose a more expensive option or conceal alternatives. On mobile, provide a compact selected total and a clear jump to the matrix; keep a deliberate way to compare adjacent quantities.

### F05 — Product context reaches the designer, but tool relevance can improve. Priority: medium

The banner’s Design action opened a 1,000 × 1,000 mm document with 3 mm bleed/safe-area settings and protected template guides. This is a useful connection already present. Generic fold controls were still visible for this banner. Evidence: capture 15. Show tools relevant to the selected product and put uncommon technical controls behind an advanced area. These observed settings are not a universal specification for all banner suppliers.

No artwork was uploaded, edited, exported or approved in the live shop. Opening the editor does not prove the exported PDF, colour workflow or supplier acceptance.

### F06 — Platform promises and package descriptions need reconciliation. Priority: high

Webprinter’s homepage presents a polished platform story, but its walkthrough is marked as forthcoming. The white-label page contains literal image placeholders for the branding editor and product page. Replace these with actual reviewed screens. Evidence: captures 01 and 21.

The white-label page advertises a 14-day trial without a credit card. The pricing page says the trial starts after Stripe checkout and continues on the selected subscription. The signup page promises a complete shop with all products, while Starter advertises a 50-product limit. “Whitelabel” appears as an Enterprise feature even though the general white-label page presents it as the core offer. These statements leave buyers uncertain; they do not by themselves prove what the billing system actually requires. Evidence: captures 21–23.

Observed public monthly prices were Starter 299 kr, Professional 599 kr and Enterprise 1,499 kr. Professional lists CompanyHub; Enterprise also lists API access, soft proof and white label. These are captured marketing claims, not verified paid entitlements. Reconcile the actual entitlement rules, billing behavior and page wording before changing the package strategy. No price change is recommended by this audit.

### F07 — Mobile hierarchy needs a focused pass. Priority: medium

At a 390-pixel emulated width, the folder’s large product image and format choices occupied the initial screen; price comparison came later. Evidence: capture 16. Preserve the image and matrix, but shorten the path to the chosen configuration and total. Small muted explanatory labels and subtle selection borders are accessibility risks to measure, not confirmed contrast violations. Keyboard operation, focus order, screen-reader announcements, zoom and physical-device touch targets still need testing.

## 3. Divide the system by who is doing the work

| Surface | Who uses it | Main purpose | What belongs here |
| --- | --- | --- | --- |
| Webprinter platform website | Print-house owner evaluating software | Understand the offer and start a suitable shop | Real demonstrations, packages, onboarding, own-production and supplier choices, CompanyHub examples. |
| Public shop | Person buying print | Find, configure, price and order | Curated products, instant matrix, upload/design/help, clear delivery and checkout. |
| Customer workspace | Returning buyer or designer | Prepare and track work | Projects, multiple designs, proofs, messages, orders, reorders and saved files. |
| CompanyHub | Business buyer, approver and company administrator | Purchase within a company’s rules | Approved catalogue and templates, brand assets, offices, permissions and approvals. |
| Shop administration | Print-house operator | Run the business | Actionable orders, customers, products, retail pricing, website, production and settings. |
| Platform administration | Webprinter operator | Operate the service and shared resources | Tenants, subscriptions, supplier bank, wholesale data, connector configuration and support. |

These are conceptual boundaries, not a proposal to replace the existing routes or permission model. Existing source already separates several roles. Make the main menu reflect daily jobs: Orders, Customers, Products, Website, Company customers, Production, Settings. Advanced colour, machine pricing, integration and SEO configuration can remain accessible within their relevant jobs. Master-only supplier and platform controls should remain master-only.

The connection should be consistent: **selected product and quote → exact production specification → artwork revision → checks and approval → immutable order → production job → shipping and customer status.** A saved design alone is not an order; a visual proof alone is not production approval; a catalogue import alone is not a working supplier integration.

The three owned shops should retain their identities. Use Salgsmapper to prove complex template choices, PVCbanner to prove dimensions and finishing, and Onlinetryksager to prove general product discovery. They are useful operating examples of the shared platform, not three separate product engines.

## 4. What exists, what needs connecting, and what needs developing

“Source present” below means found in the current working tree. It does not certify deployment, persistence or commercial readiness.

| Capability | Evidence and assessment | Decision |
| --- | --- | --- |
| Instant pricing and matrix | Working public banner selection; rich folder options | Preserve and improve explanations. |
| Tenant branding and Site Designer | Different public shop identities; extensive admin routes | Preserve selected presets; make onboarding show real examples. |
| Exact templates and product modes | Source distinguishes flat print, PDF templates, brochure, wide format, signage, apparel, photos and upload-only | Reuse as the basis for relevant tools and requirements. |
| Single-product checkout | Public handoff works; tax warning observed | Stabilise before expanding order complexity. |
| Multiple-design workspace | Inspected checkout state centres on one product/quantity/upload/design export | Develop explicit design allocation and versioning. Export-format arrays are not a multi-design cart. |
| Customer orders, messages and designs | Source routes and services present | Connect to project and artwork state; private runtime acceptance outstanding. |
| Booklet preparation | Source has page/spread structure, original-PDF references and saddle-stitch rules | Extend with binding-specific workflows; do not rebuild from zero. |
| Cut contours | Source has supplier-specific requirements and geometric checks | Extend for lettering, multiple paths and material-dependent preparation. |
| CompanyHub | Source has roles, offices, catalogues, templates, assets, requests and approval/order linkage | Prove the whole approved-purchase cycle before advertising it as fully accepted. |
| Budgets, cost centres, SSO and procurement connectors | Not established by the scoped source inspection | Validate customer demand and existing support before treating these as confirmed missing features. |
| Supplier bank | Existing sourcing/import/review tools | Keep separate from the buyer’s ordering experience. |
| Production routing | Source readiness distinguishes supplier capabilities; live submission/status are marked for Print.com | Preserve gating; import coverage must not be marketed as automated fulfilment coverage. |
| Pricing layers | Source/docs distinguish supplier cost, tenant purchase price and customer retail price | Preserve authority and tenant boundaries. |
| SEO and content tools | Existing admin areas | Apply to published products and useful category pages; do not use them to multiply unfinished pages. |
| AI/icon/creative tools | Existing optional admin capabilities | Make them support a specific product task; they are not prerequisites for launching a dependable shop. |
| Embedded shop/API offer | Not proven end to end in this review | Stage after shared order and artwork contracts are dependable. |

### Multiple designs: the most valuable next workflow

Keep the current product selection and price matrix. After selecting a product, let the buyer choose “One design” or “Several designs” only when that product supports it. A project contains one or more product lines; each eligible line can contain several artwork versions with allocated quantities. Different materials, dimensions or finishes remain separate lines unless the actual pricing and production rules explicitly support combining them.

Each design needs a thumbnail, recognisable name, quantity, dimensions/pages, current revision, check result and actions to edit, replace or review. Quantities must sum to the purchased quantity. Suggested artwork states are Draft, File missing, Checking, Correction needed, Awaiting approval and Ready. Payment and production are separate states.

Changing a file invalidates that artwork’s approval. Changing a product specification must recheck affected artwork and pricing. Preserve untouched designs and original uploads. Do not send a stale proof or assume a quantity discount applies across incompatible specifications. A reorder should explain whether the old specification is still available and whether the new quote or file requirements differ.

Start with one well-defined two-sided flyer product and two designs. Acceptance requires allocation, correct front/back pairing, independent replacement, retained original files, correct total and an unambiguous production payload. Then expand to mixed-product projects.

### Books: use a dedicated document workspace

Current brochure source already represents reader-order pages and spreads, keeps original PDFs and includes an 8–152-page saddle-stitch range in steps of four. That is a foundation for booklets; it is not general proof of bound-book support.

A book workspace needs a page thumbnail rail, page count and ordering, explicit cover/interior roles, safe-zone previews and binding-aware checks. The cover geometry and spine must come from the selected binding, stock and production rule. Support separate cover/interior uploads where required. Decide whether customer files are single pages or spreads according to the product specification; do not apply a universal multiple-of-four rule to every book.

Keep source files and reader sequence authoritative. A 3D preview is optional explanatory help, not a print-ready file certificate. Start by validating the existing saddle-stitch path; add a bound-book product only with an explicit supplier or own-production specification and accepted sample output.

### Cut-letter foil: distinguish cutting from printing and cutting

Cut-only coloured vinyl and printed vinyl with a cut path are different products. Let the customer first choose the intended use and material; ask technical questions only when they affect the result. A simple lettering entry can offer text, typeface, width/height, colour and preview, while an advanced path accepts customer vectors.

The inspected contour code includes supplier-specific “Cutkontur”, a 0.25 pt magenta stroke and overprint requirements. Those values must remain tied to the relevant supplier specification. They are not universal rules.

Lettering requires multiple closed paths, counters inside letters, reliable font outlines, overlap handling, minimum feature checks and appropriate cutting layers. Production may also require weeding, transfer film or mirrored output for a defined application. A single outer outline around the whole design will not cut individual letters correctly. Define a review path when automatic preparation cannot establish a valid result.

## 5. How the competitors operate—and what to borrow

| Reference | What was established | Useful lesson for Webprinter |
| --- | --- | --- |
| Print.com | Its documentation describes multiple designs with shared specifications and allocated quantities. Its portal offering covers branded customer access and file checking. The ordering app itself was login-gated in this inspection. | Borrow artwork overview, revision handling and collaboration. Preserve Webprinter’s more direct matrix interaction. |
| LaserTryk white label | Official offer describes a free complete branded shop, customer-set prices/products, own production or LaserTryk fulfilment. The linked demo exposes a price matrix and an “Antal originaler” selector. | Judge operational usefulness separately from visual taste. Matrix plus multiple originals is compatible with a simpler experience. |
| LaserTryk BrandCentral | Separate corporate ordering/brand-management offer | Compare this with CompanyHub, rather than treating the reseller webshop as the only comparison. |
| Onlineprinters | Public product flow inspected: grouped configuration, file guidance, delivery choices, file-check options and upload timing | Make production guidance and delivery choices understandable next to the selected product. |

Print.com documents combining digital-print designs when their material and finish match, allocating total quantity across the designs, and pairing front/back pages. This supports the proposed project model; it does not justify combining arbitrary jobs for one price. Its public web-app and portal pages also describe collaboration, branded portals and file checks. These are vendor-described capabilities, not authenticated test results here. [Multiple designs](https://knowledge.print.com/helpcenter/multiple-designs), [web app](https://www.print.com/en/web-app-order-prints-online/), [Print Portal](https://www.print.com/en/print-portal-general/).

LaserTryk’s free white-label offer is already a complete webshop, not merely an embedded product widget. It describes the shop’s own branding/domain and prices, own production alongside LaserTryk production, and blind fulfilment. It also expects active selling and print-ready files. A production-funded commercial model is a reasonable interpretation, but the public page does not establish every contractual obligation or a fixed minimum purchasing commitment. [Official white-label offer](https://lasertryk.dk/whitelabel). Its linked [partner demo](https://partnerpriserdk.spgwl.com/flyer) visibly includes format, print method, colour, finishing, a quantity matrix and multiple originals. The interface is denser and plainer than Webprinter’s banner page; its practical functions still merit borrowing. [BrandCentral](https://lasertryk.dk/brandcentral) addresses the separate company procurement problem.

Onlineprinters’ inspected folded-product page gives configuration, delivery and artwork requirements a clear place in the buying journey. It offers upload before or after ordering and an online designer. Its data sheet distinguishes finished and open dimensions and provides product-specific file guidance. Webprinter should adopt that clarity while retaining its visible matrix. Requirements such as bleed, profiles and resolution must follow each product, not become global defaults. [Inspected product](https://www.onlineprinters.dk/p/standardfoldere-staaende-a7).

No sales data were available to verify that these are the highest-selling websites or to rank their conversion performance. This is a functional and product comparison, not a market-share or sales ranking.

## 6. Web-to-print platforms worth benchmarking

There is no defensible “largest in Europe” conclusion from the material reviewed. Vendors describe different measures—customers, portals, installations and worldwide reach—which cannot be combined into a European ranking. Select references by the problem they solve.

| Platform | Why it is relevant | What to investigate for Webprinter |
| --- | --- | --- |
| Infigo | B2B/B2C storefronts, templates and integration ecosystem | Corporate rules, MIS connections and how order status returns to the customer. [Platform](https://www.infigo.net/), [integrations](https://www.infigo.net/ecosystem/integrations). |
| CloudLab printQ | Web-to-print covering editorial, wide-format and other product types; APIs | Product-specific preparation and integration boundaries. [printQ](https://www.cloudlab-solutions.com/printq). |
| XMPie uStore | Documented approval groups and store approval policies | Roles, multi-stage approvals and payment behavior. Its documentation also describes compatibility limits; avoid blanket approval promises. [Order approval documentation](https://help.xmpie.com/uStore/Latest/Help/en/StoreSetup/Setting_Up_an_Order_Approval_Process_for_a_Store.htm). |
| OnPrintShop | Public and B2B storefront offering with central management | Reusable company stores, catalogue permissions and operator workload. [B2B storefront](https://onprintshop.com/solutions/b2b-storefront). |
| Printify | Product creation, sales-channel connections and supplier fulfilment API | Connector and fulfilment patterns for suitable POD products. It is a different reference from a complete print-house operating platform. [How it works](https://printify.com/how-it-works/), [API](https://developers.printify.com/). |

These are research references, not a recommendation to replace Webprinter or purchase any of these systems. The claim that many Danish shops use Printify was not verified in this review.

## 7. White label, complete webshop, CompanyHub and embedding

White label answers **whose brand the customer sees**. A complete webshop answers **how much of the selling experience is provided**. Embedding answers **where the experience appears**. CompanyHub answers **which company’s people and purchasing rules apply**. These can coexist.

Webprinter can offer a complete branded shop, attached to an existing business website through a shop subdomain and navigation link. The customer does not have to replace the whole company website. Later, selected products/configurators can be embedded where there is a demonstrated need. An iframe or widget still has identity, payments, uploads, mobile behavior and support implications; it is not automatically the cheapest first product.

| Possible offer to evaluate | Suitable customer | Boundary to make explicit |
| --- | --- | --- |
| Supplier-funded Starter | Reseller wanting a curated range with minimal setup | Which production network supports the offer; catalogue limits; support; ownership and data export. |
| Independent Shop | Print house using own production and selected suppliers | Full branded selling experience, operating tools and controlled pricing. |
| CompanyHub | Business customer buying repeatedly through a print house | Private catalogue/templates, offices, permissions and approval policy. |
| Embed/API | Existing website or software with a proven integration need | Supported product/order functions, authentication, file handling and maintenance responsibilities. |

These are proposed business distinctions, not replacement names or prices for the existing live plans. First reconcile the current advertised offer and actual entitlements. Then test a free supplier-funded shop with a small number of partners. Measure contribution after production margin or fees, support, hosting, file processing, payment costs and reprints. If the economics do not support free service, use a paid plan or bounded trial. Do not make all supplier-independent functionality permanently free without that evidence.

CompanyHub should attach to a shop’s customer relationship. Its minimum complete story is: company administrator selects users and permitted products; buyer creates a branded job; the correct person approves the exact revision and price; the approved request becomes an order without duplication; the buyer follows status and can reorder appropriately. Cost centres, spending controls, invoice terms and purchasing integrations should follow actual customer requirements and verified implementation.

## 8. Help nontechnical customers find the right product

Give customers two entry paths: familiar product names and intended use. Onlinetryksager can offer “Hand out information”, “Promote an event” and “Office stationery”; Salgsmapper can explain capacity and what fits inside; PVCbanner can ask where the banner will hang and whether wind exposure matters. These are proposed navigation examples, not verified product availability.

Use a small curated category structure, synonyms in search, useful photographs and plain explanations beside unfamiliar terms. “Print on one side” can lead; “4+0” can remain as supporting information. Show material differences through use, feel and durability. Recommend a starting configuration but keep alternatives and the matrix available.

After configuration, offer three understandable routes: upload a ready file, design online, or ask for file help. Explain any cost and timing of assistance before proceeding. Show only relevant production warnings; a first-time buyer should not have to learn supplier terminology to choose a flyer.

The main success measure is not the number of visible options. It is whether a buyer can choose a suitable product, understand the total, prepare a valid design and complete the order without losing work or needing avoidable support.

## 9. Delivery sequence and acceptance gates

| Phase | Work | Exit evidence |
| --- | --- | --- |
| 1 — Trustworthy existing journey | Diagnose PVC tax warning; preserve folder offer selection; reconcile live copy, trial/package claims and demo products | Recorded product-to-checkout journeys; consistent authoritative totals; approved published catalogue and offer wording. |
| 2 — One dependable artwork journey | Validate upload/designer output, checks, proof approval, order and production handoff for one reviewed product | Exact file/spec/revision remains linked through a controlled end-to-end order; failures are recoverable. |
| 3 — Multiple designs | Pilot one product with two designs and quantity allocation | Independent edits, front/back pairing, approvals and correct production payload; no stale approval or assumed discount. |
| 4 — Company purchasing | Verify CompanyHub buyer/approver/admin paths and order linkage | Role-specific access, correct approval revision, no duplicate order, status and reorder behavior demonstrated. |
| 5 — Product specialists | Validate existing booklet mode; add explicit bound-book or cut-letter mode as demand warrants | Supplier/own-production specification, inspected output and accepted representative sample. |
| 6 — Commercial expansion | Pilot supplier-funded entry offer; assess embed/API and MIS demand | Measured support and margin; verified connector behavior; clear responsibilities and entitlement model. |

The phases are dependencies, not calendar estimates. Fixing wording and catalogue presentation can proceed alongside technical diagnosis. Major workflow architecture changes need a concrete design and approval before implementation.

Track baselines separately for each shop: product discovery to configuration; configuration to checkout; quote/tax failure rate; checkout completion; artwork correction rate; manual support time per order; repeat-order success; production handoff failures. For CompanyHub add approval turnaround and rejected/stale-revision events. For white-label partners add activation, first accepted order, support cost and contribution. No baseline or conversion uplift was measured here; do not invent target improvements before collecting it.

## 10. Browser evidence: all 23 scenarios

The numbered captures below are separate scenarios, not 23 consecutive clicks in one session. Desktop captures use a 1,440 × 1,000 viewport; capture 16 uses 390 × 1,000. A screenshot is a viewport, not proof that the entire page was visually audited. Full captured accessibility text accompanies each image. Early browser runs used default timezone settings and later runs Copenhagen; displayed delivery cutoffs were not validated.

| Capture | Surface or action | Health / limit |
| --- | --- | --- |
| 01 | Webprinter platform homepage | Promising presentation; walkthrough pending. |
| 02 | Webprinter demo shop | Loads; unfinished public merchandising. |
| 03 | Onlinetryksager homepage | Loads; catalogue/message/image inconsistencies. |
| 04 | Salgsmapper homepage | Loads; offer and descriptive copy disagree. |
| 05 | PVCbanner homepage | Clear specialist identity; category coverage needs verification. |
| 06 | Folder product | Rich options and matrix; copy/default selection inconsistency. |
| 07 | Banner product | Clear dimensions, finishing, matrix and summary. |
| 08 | CompanyHub entry | Login gate; private workflow not inspected. |
| 09 | Administration entry | Login gate; private workflow not inspected. |
| 10 | Banner product to checkout | Persistent tax/payment-total warning; no order submitted. |
| 11 | LaserTryk white-label page | Cookie dialog limits visual assessment; public offer researched separately. |
| 12 | Onlineprinters folded-product page | Public configurator inspected; payment/production not tested. |
| 13 | Print.com application entry | Consent and login gate; no ordering UI audit. |
| 14 | Banner matrix selection | Quantity, area and summary update together. |
| 15 | Banner to online designer | Product dimensions and guides retained; generic tools visible. |
| 16 | Folder mobile viewport | Product visible; price comparison deeper in page; emulation only. |
| 17 | LaserTryk linked partner demo | Public storefront accessible. |
| 18 | Salgsmapper homepage CTA | Actual navigation resets to a different selection/price. |
| 19 | Banner checkout repeat | Same warning reproduced in fresh session. |
| 20 | LaserTryk demo flyer | Matrix and multiple-originals selector visible; no transaction. |
| 21 | Webprinter white-label offer | Content available; placeholder images and trial claims. |
| 22 | Webprinter pricing | Public packages visible; actual billing/entitlements untested. |
| 23 | Webprinter signup | Form viewed only; promise needs alignment with packages. |

### Selected screens in journey order

**Platform offer — capture 01.** Real product examples would strengthen the platform story.

![Webprinter platform homepage](../output/system-assessment-2026-10-21/01-webprinter-platform.png)

**Product discovery — capture 02.** The demo needs a reviewed customer-facing catalogue.

![Webprinter demo catalogue](../output/system-assessment-2026-10-21/02-webprinter-shop.png)

**Configuration handoff — capture 18.** The folder page opens with 50 pieces selected after the homepage offer showed 200.

![Folder product after homepage CTA](../output/system-assessment-2026-10-21/18-folder-home-handoff.png)

**Price comparison — capture 14.** Keep the selected matrix and the connected summary.

![Banner matrix selection with two pieces and updated total](../output/system-assessment-2026-10-21/14-banner-matrix.png)

**Artwork — capture 15.** Product geometry reaches the designer; output acceptance remains outstanding.

![Banner online designer](../output/system-assessment-2026-10-21/15-banner-designer.png)

**Checkout — capture 19.** The shop-level total-verification warning reproduced.

![Repeated PVC banner checkout warning](../output/system-assessment-2026-10-21/19-banner-checkout-repeat.png)

**Mobile — capture 16.** Improve access to the chosen price without removing the comparison matrix.

![Mobile folder page](../output/system-assessment-2026-10-21/16-mobile-folder.png)

**Competitor benchmark — capture 20.** LaserTryk’s partner demo combines a matrix with multiple originals.

![LaserTryk partner demo flyer configurator](../output/system-assessment-2026-10-21/20-lasertryk-demo-flyer.png)

## 11. Evidence boundaries and follow-up verification

REA was used to launch isolated browser sessions and capture the current public surfaces and selected interactions. The in-app browser connection was unavailable, so it was not used as proof. No private credentials were obtained; no accounts were created, files uploaded, customer records modified, orders placed, payments attempted or supplier jobs submitted.

Current source supports the system map and identifies foundations; the large existing working tree was preserved. Source presence does not prove that the same version is deployed. No build or application tests were run for this report-only task. Checkout advertised 50 MB uploads in the live capture; local plans for larger files are not evidence that the larger limit is live.

The remaining acceptance work is specific: authenticated shop operation; CompanyHub membership/approval/order cycles; customer project persistence; designer export and preflight correctness; payment in a controlled test flow; supplier acceptance/status/cancellation handling; mobile device and keyboard/screen-reader testing. This review is not a complete security, accessibility, performance or legal audit.

### Current source anchors inspected

| Source | What it supports |
| --- | --- |
| [App routes](../src/App.tsx) | Platform, shop, customer, company, designer and admin surfaces. |
| [Admin navigation](../src/components/admin/AdminSidebar.tsx) | Current operator and master feature areas. |
| [Checkout state](../src/lib/checkout/siteCheckoutSession.ts) | Product/quote/upload/designer/company context and current single-product structure. |
| [Checkout tax handling](../src/lib/checkout/tax.ts) | Customer-facing failure message and tax-resolution boundary. |
| [Storefront tax configuration](../supabase/functions/_shared/storefrontTax.ts) | Current local launch-shop handling; not proof of deployed state. |
| [Product modes](../src/lib/sites/productSiteModes.ts) | Existing product-specific mode separation. |
| [Brochure document model](../src/lib/designer/brochureDocument.ts) | Page/spread/original-file foundations and booklet constraints. |
| [Brochure product rules](../src/lib/designer/brochureProduct.ts) | Product geometry and quotation context. |
| [Contour requirements](../src/lib/designer/cutContourRequirements.ts) | Supplier-specific cut-path specification. |
| [Contour validation](../src/lib/designer/cutContourValidation.ts) | Existing geometric checks. |
| [CompanyHub access](../src/lib/company-hub/access.ts) | Role definitions. |
| [CompanyHub requests](../src/lib/company-hub/requestService.ts) | Request, approval and order linkage. |
| [CompanyHub capabilities](../src/lib/company-hub/capabilities.ts) | Runtime capability handling; not deployment proof. |
| [Production readiness](../src/lib/print-production/readiness.ts) | Supplier capabilities are distinct from catalogue imports. |
| [Order submission](../src/lib/print-production/orderSubmission.ts) | Payment/payload/reconciliation gates. |

All browser evidence files are in [the assessment evidence folder](../output/system-assessment-2026-10-21/). Each numbered scenario has a PNG screenshot, accessibility text and REA evidence JSON. The [visual review](../output/system-assessment-2026-10-21/index.html) presents this assessment with a navigable evidence gallery.

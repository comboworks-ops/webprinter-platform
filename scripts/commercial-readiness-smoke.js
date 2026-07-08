#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://www.webprinter.dk";
const DEFAULT_TIMEOUT_MS = 15000;

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const eqArg = args.find((arg) => arg.startsWith(`${name}=`));
  if (eqArg) return eqArg.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only smoke check for the Webprinter commercial proof routes.

Usage:
  node scripts/commercial-readiness-smoke.js
  node scripts/commercial-readiness-smoke.js --base-url http://127.0.0.1:8083
  node scripts/commercial-readiness-smoke.js --browser --base-url http://127.0.0.1:8083

Options:
  --base-url <url>          Site root to check. Default: ${DEFAULT_BASE_URL}
  --timeout-ms <number>    Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --skip-bundle-markers    Skip built bundle marker checks.
  --browser                Also verify rendered React pages with Playwright.
`);
  process.exit(0);
}

const baseUrl = normalizeBaseUrl(
  readArg("--base-url", process.env.COMMERCIAL_SMOKE_BASE_URL || DEFAULT_BASE_URL),
);
const timeoutMs = Number(readArg("--timeout-ms", process.env.COMMERCIAL_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
const skipBundleMarkers = hasFlag("--skip-bundle-markers");
const runBrowserSmoke = hasFlag("--browser") || process.env.COMMERCIAL_SMOKE_BROWSER === "1";

const checks = [
  {
    name: "Webprinter forside",
    kind: "html",
    path: "/?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Webprinter aluminium produkt",
    kind: "html",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper forside",
    kind: "html",
    path: "/?force_domain=www.salgsmapper.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper første skabelonprodukt",
    kind: "html",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedText: ["root"],
  },
  {
    name: "Designer med Salgsmapper PDF kontekst",
    kind: "html",
    path:
      "/designer?force_domain=www.salgsmapper.dk&templatePdfName=salgsmappe-a5-5mm-ryg.pdf&templatePdfUrl=%2Fdesigner-templates%2Fsalgsmapper%2Fsalgsmappe-a5-5mm-ryg.pdf",
    expectedText: ["root"],
  },
  {
    name: "Driftsklarhed cockpit",
    kind: "html",
    path: "/admin/commercial-readiness?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Leverandørbank admin",
    kind: "html",
    path: "/admin/supplier-bank?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Platform SEO admin",
    kind: "html",
    path: "/admin/platform-seo?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Betaling admin",
    kind: "html",
    path: "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Webprinter kontakt",
    kind: "html",
    path: "/kontakt?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Webprinter privatlivspolitik",
    kind: "html",
    path: "/privacy-policy?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Webprinter platformvilkår",
    kind: "html",
    path: "/handelsbetingelser?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Webprinter cookiepolitik",
    kind: "html",
    path: "/cookiepolitik?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper privatlivspolitik",
    kind: "html",
    path: "/privatliv?force_domain=www.salgsmapper.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper cookiepolitik",
    kind: "html",
    path: "/cookiepolitik?force_domain=www.salgsmapper.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper handelsbetingelser",
    kind: "html",
    path: "/betingelser?force_domain=www.salgsmapper.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper PDF-skabelon",
    kind: "pdf",
    path: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
  },
];

const bundleMarkers = [
  "Download skabelon",
  "Produktionsklarhed",
  "templatePdfUrl",
  "sales-mapper",
];

const sourceContractChecks = [
  {
    name: "Checkout/admin order handoff source contract",
    detail: "verified checkout order tags, delivery fields, order_files notes and admin readers",
    files: [
      {
        path: "src/pages/FileUploadConfiguration.tsx",
        markers: [
          "supabase.functions.invoke(\"stripe-create-payment-intent\"",
          ".from(\"orders\" as any)",
          ".from(\"order_files\" as any)",
          "status_note",
          "[PRODUKTIONSFLOW]",
          "[SKABELON]",
          "[SKABELON-DOWNLOAD]",
          "[LEVERING]",
          "[LEVERINGSMETODE]",
          "[BLIND_SHIPPING]",
          "delivery_address:",
          "delivery_zip:",
          "delivery_city:",
          "delivery_country:",
          "Kilde: designer production export",
          "Kilde: kundeupload",
          "Skabelon:",
        ],
      },
      {
        path: "src/components/admin/OrderManager.tsx",
        markers: [
          "readOrderTag",
          "'PRODUKTIONSFLOW'",
          "'SKABELON'",
          "'SKABELON-DOWNLOAD'",
          "'LEVERING'",
          "'LEVERINGSMETODE'",
          "'BLIND_SHIPPING'",
          "delivery_address",
          "delivery_zip",
          "delivery_city",
          "order_files",
          "getOrderProductionReadinessKind",
          "Klarhed",
          "Fil klar",
        ],
      },
    ],
  },
  {
    name: "Stripe checkout amount validation source contract",
    detail: "verified payment intent uses server-side pricing, amount mismatch rejection and Stripe metadata evidence",
    files: [
      {
        path: "supabase/functions/stripe-create-payment-intent/index.ts",
        markers: [
          "checkRateLimit",
          "checkout_quote required",
          "calculateCheckoutQuote",
          "fetchPricingRead",
          "pricing-read",
          "calculateOptionExtras",
          "resolveDeliveryMethodCost",
          "Checkout amount mismatch",
          "server_amount_ore",
          "client_amount_ore",
          "amount_source: \"server_checkout_quote\"",
          "product_price_ore",
          "option_extra_ore",
          "shipping_ore",
          "pricing_source",
          "matched_price_row_id",
        ],
      },
    ],
  },
  {
    name: "Post-payment order completion source contract",
    detail: "verified successful payment persists order, file, notifications and customer success evidence",
    files: [
      {
        path: "src/pages/FileUploadConfiguration.tsx",
        markers: [
          "const handlePaymentSuccess = async (paymentIntentId: string)",
          "setOrderSuccessMessage(\"Vi har modtaget din betaling og begynder at behandle din ordre.",
          "setCreatedOrderNumber(insertedOrder.order_number)",
          ".from(\"orders\" as any)",
          ".from(\"order_files\" as any)",
          "pod2-create-jobs",
          "sendOrderConfirmation",
          "sendAdminNewOrderNotification",
          "customerOrderConfirmationsEnabled",
          "adminNewOrderNotificationsEnabled",
          "customer_addresses",
          "setOrderPersistWarning(`Betaling gennemført, men ordren kunne ikke gemmes automatisk.",
          "setOrderNotificationWarning",
          "clearStripeReturnParams()",
          "setPaymentSuccess(true)",
          "returnedRedirectStatus === \"succeeded\"",
          "Ordrenummer: {createdOrderNumber}",
        ],
      },
    ],
  },
  {
    name: "Order email notification source contract",
    detail: "verified customer/admin order emails keep delivery, billing, blind-shipping and Resend handoff",
    files: [
      {
        path: "src/lib/emailService.ts",
        markers: [
          "supabase.functions.invoke('send-order-email'",
          "type: 'order_confirmation'",
          "type: 'admin_new_order'",
          "sendOrderConfirmation",
          "sendAdminNewOrderNotification",
          "customer_email",
          "admin_email",
          "delivery_summary",
          "billing_summary",
          "blind_shipping",
          "sender_summary",
        ],
      },
      {
        path: "supabase/functions/send-order-email/index.ts",
        markers: [
          "RESEND_API_KEY",
          "CONTACT_EMAIL_FROM",
          "order_confirmation",
          "admin_new_order",
          "Ordrebekræftelse",
          "Ny ordre modtaget",
          "Levering til:",
          "Fakturering:",
          "Blind forsendelse:",
          "Afsender på pakken:",
          "Åbn ordreoversigt",
          "Se din ordre",
          "reply_to: supportEmail",
          "fetch(\"https://api.resend.com/emails\"",
        ],
      },
    ],
  },
  {
    name: "Admin order processing source contract",
    detail: "verified admin order handling keeps status updates, readiness, notifications, invoice and message handoff",
    files: [
      {
        path: "src/components/admin/OrderManager.tsx",
        markers: [
          "const handleSaveOrder = async ()",
          "setEditDeliveryType(",
          "[LEVERINGSMETODE]",
          "tracking_number: editTrackingNumber || null",
          "estimated_delivery: editEstimatedDelivery || null",
          "requires_file_reupload: editRequiresReupload",
          "delivery_type: editDeliveryType || null",
          ".from('orders' as any)",
          ".from('order_status_history' as any)",
          "sendStatusChangeEmail",
          "sendProblemNotification",
          "getOrderProductionReadinessKind",
          "getProductionStatusWarning",
          "editStatus === 'production'",
          "Fil klar",
          "Ny fil kræves",
          "Download Faktura",
          "downloadInvoice",
          "Gå til besked",
          "toast.success('Ordre opdateret')",
        ],
      },
    ],
  },
  {
    name: "Customer order portal source contract",
    detail: "verified Mine ordrer keeps order recovery, tracking, invoice, reupload and message handoff",
    files: [
      {
        path: "src/pages/MyOrders.tsx",
        markers: [
          "export default function MyOrders()",
          "navigate('/auth?redirect=/mine-ordrer')",
          ".from('orders' as any)",
          ".eq('user_id', userId)",
          ".from('order_messages' as any)",
          ".from('delivery_tracking' as any)",
          ".from('order_invoices' as any)",
          ".update({ is_read: true })",
          "sender_type: 'customer'",
          "const handleFileUpload = async (orderId: string, file: File)",
          ".from('order-files')",
          ".upload(fileName, file)",
          ".from('order_files' as any)",
          ".update({ is_current: false })",
          ".update({ requires_file_reupload: false })",
          "tracking_number",
          "estimated_delivery",
          "Upload ny fil",
          "Beskeder ({orderMessages.length})",
          "Download PDF",
          "Leveringssporing",
        ],
      },
    ],
  },
  {
    name: "Tenant payment readiness source contract",
    detail: "verified tenant payment setup, Stripe Connect access checks, destination charges and read-only cockpit payment signals",
    files: [
      {
        path: "src/pages/Admin.tsx",
        markers: [
          "<Route path=\"/indstillinger/betaling\" element={<TenantPaymentSettings />} />",
        ],
      },
      {
        path: "src/hooks/useTenantPaymentSettings.ts",
        markers: [
          "resolveAdminTenant",
          "tenant_payment_settings",
          "platform_fee_percent",
          "platform_fee_flat_ore",
          ".upsert(payload, { onConflict: \"tenant_id\" })",
          "queryClient.invalidateQueries({ queryKey: [\"tenant-payment-settings\", tenantId] })",
        ],
      },
      {
        path: "src/components/admin/TenantPaymentSettings.tsx",
        markers: [
          "Betaling",
          "Stripe onboarding foregår i Webprinter",
          "stripe-connect-create-or-get",
          "stripe-connect-account-session",
          "stripe-connect-sync-status",
          "stripe-connect-disable",
          "VITE_STRIPE_PUBLISHABLE_KEY",
          "Forbind Stripe",
          "Opdater status",
          "Platformgebyr",
          "Gem platformgebyr",
        ],
      },
      {
        path: "supabase/functions/stripe-connect-create-or-get/index.ts",
        markers: [
          "tenant_id required",
          "Unauthorized",
          "user_roles",
          "master_admin",
          "[\"admin\", \"staff\"].includes(role.role)",
          "owner_id",
          "Forbidden",
          ".from(\"tenant_payment_settings\")",
          "stripe.accounts.create",
          "type: \"express\"",
          "card_payments: { requested: true }",
          "transfers: { requested: true }",
          "metadata: {",
          "tenant_id: tenantId",
        ],
      },
      {
        path: "supabase/functions/stripe-connect-account-session/index.ts",
        markers: [
          "tenant_id required",
          "Unauthorized",
          "user_roles",
          "master_admin",
          "[\"admin\", \"staff\"].includes(role.role)",
          "owner_id",
          "Forbidden",
          "Stripe account missing",
          "accountSessions.create",
          "components: { account_onboarding: { enabled: true } }",
          "client_secret",
        ],
      },
      {
        path: "supabase/functions/stripe-connect-sync-status/index.ts",
        markers: [
          "computeStatus",
          "tenant_id required",
          "Unauthorized",
          "user_roles",
          "master_admin",
          "[\"admin\", \"staff\"].includes(role.role)",
          "owner_id",
          "Forbidden",
          "Stripe account missing",
          "stripe.accounts.retrieve",
          "charges_enabled",
          "payouts_enabled",
          "details_submitted",
          ".update(payload)",
        ],
      },
      {
        path: "supabase/functions/stripe-connect-disable/index.ts",
        markers: [
          "tenant_id required",
          "Unauthorized",
          "user_roles",
          "master_admin",
          "[\"admin\", \"staff\"].includes(role.role)",
          "owner_id",
          "Forbidden",
          ".update({ status: \"disabled\" })",
        ],
      },
      {
        path: "supabase/functions/stripe-create-payment-intent/index.ts",
        markers: [
          "tenant_payment_settings",
          "stripe_account_id, status, charges_enabled, platform_fee_percent, platform_fee_flat_ore",
          "const canUseConnected",
          "application_fee_amount",
          "on_behalf_of: settings!.stripe_account_id!",
          "transfer_data: { destination: settings!.stripe_account_id! }",
          "mode: \"destination\"",
          "mode: \"platform\"",
        ],
      },
      {
        path: "src/pages/admin/CommercialReadiness.tsx",
        markers: [
          "loadPaymentCheckoutSummary",
          "tenant_payment_settings",
          "getPaymentCheckoutRows",
          "Betaling/checkout signaler",
          "tenant_payment_settings` og viser om Stripe er liveklar",
          "Det opretter ikke Stripe-konti, ændrer ikke gebyrer og starter",
          "Platformgebyr: {item.feeSummary}",
          "Åbn betaling",
          "paymentCheckoutRows",
        ],
      },
    ],
  },
  {
    name: "SEO Search Console visibility source contract",
    detail: "verified Search Console visibility remains master-scoped, read-only and surfaced in Platform SEO plus Driftsklarhed",
    files: [
      {
        path: "src/pages/Admin.tsx",
        markers: [
          "<Route path=\"/platform-seo\" element={<PlatformSeoAdmin />} />",
          "<Route path=\"/platform-seo/callback\" element={<SearchConsoleCallback />} />",
        ],
      },
      {
        path: "src/lib/platform-seo/search-console-hooks.ts",
        markers: [
          "SEARCH_CONSOLE_MASTER_TENANT_ID",
          "return SEARCH_CONSOLE_MASTER_TENANT_ID",
          "useSearchConsoleStatus",
          "useSearchConsoleSites",
          "useSearchConsoleMetrics",
          "useSearchConsoleSiteOverview",
          "dimensions: ['date']",
          "rowLimit: rangeDays + 2",
          "totalClicks",
          "totalImpressions",
          "averageCtr",
          "averagePosition",
          "PREFERRED_SITE_ORDER",
          "https://www.webprinter.dk/",
          "https://www.salgsmapper.dk/",
          "https://www.onlinetryksager.dk/",
        ],
      },
      {
        path: "supabase/functions/search-console/index.ts",
        markers: [
          "https://www.googleapis.com/auth/webmasters.readonly",
          "MASTER_TENANT_ID",
          "MASTER_ADMIN_EMAILS",
          "resolvePlatformTenantId",
          "Invalid Search Console tenant scope",
          "requireMasterAdmin",
          "master_admin",
          "platform_seo_google_integrations",
          "prompt: 'consent'",
          "action) {",
          "case 'status'",
          "case 'sites'",
          "case 'query'",
          "searchAnalytics/query",
          "Not connected to Search Console",
        ],
      },
      {
        path: "src/components/admin/platform-seo/PlatformSeoAdmin.tsx",
        markers: [
          "Platform SEO Center",
          "Analytics",
          "Google Search Console",
          "Tenant-shops og demo-shoppen har deres egne separate SEO-indstillinger",
        ],
      },
      {
        path: "src/components/admin/platform-seo/SearchConsoleDashboard.tsx",
        markers: [
          "FOCUS_SITES",
          "Google Search Console",
          "Forbind til Google Search Console",
          "Vi anmoder kun om læseadgang - vi ændrer ikke noget",
          "Domæneoverblik",
          "Google-søgetrafik for de seneste",
          "Google klik",
          "Visninger",
          "CTR",
          "Position",
          "Dette er ikke det samme som alle besøgende på websitet.",
        ],
      },
      {
        path: "src/pages/admin/CommercialReadiness.tsx",
        markers: [
          "useSearchConsoleStatus",
          "useSearchConsoleSites",
          "useSearchConsoleSiteOverview",
          "getSeoVisibilityRows",
          "SEO/Search Console bevis",
          "Search Console forbundet",
          "seoVisibilityRows",
          "platform-seo?force_domain=webprinter.dk",
          "Google-søgedata",
          "formatCtr(row.ctr)",
          "Henter 28-dages Search Console overblik",
        ],
      },
    ],
  },
  {
    name: "Contact lead handoff source contract",
    detail: "verified platform and tenant contact forms keep consent, email, platform lead log and admin follow-up handoff",
    files: [
      {
        path: "src/pages/ContactRouter.tsx",
        markers: [
          "isPlatformContext",
          "return <PlatformKontakt />",
          "return <ShopContact />",
        ],
      },
      {
        path: "src/pages/platform/PlatformKontakt.tsx",
        markers: [
          "platformNavLink(\"/privacy-policy\")",
          "Samtykke mangler",
          "mode: \"platform\"",
          "company: formData.company",
          "subject: \"Platform henvendelse\"",
          "id=\"platform-consent\"",
          "privatlivspolitikken",
        ],
      },
      {
        path: "src/components/content/ContactContent.tsx",
        markers: [
          "appendStorefrontTenantContext(\"/privatliv\")",
          "if (!formData.consent)",
          "mode: \"tenant\"",
          "tenantId: settings.id",
          "Shop-kontekst mangler",
          "privatlivspolitikken",
        ],
      },
      {
        path: "src/lib/contact/sendContactMessage.ts",
        markers: [
          "supabase.functions.invoke(\"send-contact-message\"",
          "mode: input.mode",
          "tenantId: input.tenantId || null",
          "hostname: typeof window !== \"undefined\" ? window.location.hostname : null",
          "pathname: typeof window !== \"undefined\" ? window.location.pathname : null",
        ],
      },
      {
        path: "supabase/functions/send-contact-message/index.ts",
        markers: [
          "RESEND_API_KEY",
          "PLATFORM_CONTACT_EMAIL",
          "MASTER_TENANT_ID",
          "checkRateLimit",
          "tenantId is required for tenant contact messages",
          "Shop contact email is not configured",
          "[PLATFORM LEAD]",
          "[KONTAKT]",
          "replyTo: senderEmail",
          "replyTo: recipient.email",
          ".from(\"platform_messages\")",
          "messageLogCreated",
          "fetch(\"https://api.resend.com/emails\"",
        ],
      },
      {
        path: "src/components/admin/AdminMessages.tsx",
        markers: [
          "PLATFORM_LEAD_PREFIX",
          "isPlatformLeadMessage",
          "parsePlatformLeadMessage",
          "Platform henvendelser",
          "latestPlatformLeadMailto",
          "selectedPlatformThreadHasLeads",
          "opening the thread must not clear lead evidence.",
          "Platformhenvendelser er en read-only log fra kontaktsiden.",
        ],
      },
      {
        path: "src/pages/admin/CommercialReadiness.tsx",
        markers: [
          "getPlatformLeadReadiness",
          "Platform henvendelser",
          "platformLeadSummary.totalCount",
          "Kontakt-samtykke",
          "sender ikke testmails",
          "platform-lead-readiness",
        ],
      },
    ],
  },
  {
    name: "Legal cookie consent source contract",
    detail: "verified legal routes, cookie controls, tenant context links and read-only legal cockpit evidence",
    files: [
      {
        path: "src/App.tsx",
        markers: [
          "<CookieConsentProvider>",
          "<CookieBanner />",
          "<CookieSettingsDialog />",
          "<Route path=\"/privacy-policy\" element={<PlatformPrivacyPolicy />} />",
          "<Route path=\"/handelsbetingelser\" element={<PlatformHandelsbetingelser />} />",
          "<Route path=\"/cookiepolitik\" element={<CookiePolicyRouter />} />",
          "<Route path=\"/betingelser\" element={<Terms />} />",
          "<Route path=\"/privatliv\" element={<PrivacyPolicy />} />",
        ],
      },
      {
        path: "src/components/consent/CookieConsentProvider.tsx",
        markers: [
          "wp_consent_v1",
          "preferences: boolean",
          "statistics: boolean",
          "marketing: boolean",
          "hasConsented",
          "acceptAll",
          "rejectAll",
          "setCategories",
        ],
      },
      {
        path: "src/components/consent/CookieBanner.tsx",
        markers: [
          "Cookieindstillinger",
          "Accepter alle",
          "Kun nødvendige",
          "Tilpas",
          "acceptAll",
          "rejectAll",
          "openSettings",
        ],
      },
      {
        path: "src/components/consent/CookieSettingsDialog.tsx",
        markers: [
          "isPlatformContext",
          "platformNavLink('/cookiepolitik')",
          "appendStorefrontTenantContext('/cookiepolitik')",
          "platformNavLink('/handelsbetingelser')",
          "appendStorefrontTenantContext('/betingelser')",
          "Nødvendige",
          "Præferencer",
          "Statistik",
          "Marketing",
          "Gem valg",
          "Accepter alle",
          "Kun nødvendige",
        ],
      },
      {
        path: "src/components/content/PrivacyPolicyContent.tsx",
        markers: [
          "variant = \"storefront\"",
          "variant === \"platform\"",
          "resolvedCompanyName",
          "resolvedEmail",
          "samtykke",
          "Datatilsynet",
          "mailto:${resolvedEmail}",
        ],
      },
      {
        path: "src/components/content/CookiePolicyContent.tsx",
        markers: [
          "useCookieConsent",
          "Nødvendige",
          "Præferencer",
          "Statistik",
          "Marketing",
          "samtykke",
          "Åbn cookieindstillinger",
        ],
      },
      {
        path: "src/components/content/TermsContent.tsx",
        markers: [
          "useShopSettings",
          "settings?.company",
          "contactEmail",
          "contactPhone",
          "CVR nr",
          "Handelsbetingelser",
          "mailto:${contactEmail}",
        ],
      },
      {
        path: "src/components/content/PlatformTermsContent.tsx",
        markers: [
          "PLATFORM_TERMS_VERSION",
          "Platformvilkår",
          "Webprinter.dk",
          "trykkerier",
          "info@webprinter.dk",
          "tel:+4571991110",
        ],
      },
      {
        path: "src/lib/storefrontTenantContext.ts",
        markers: [
          "force_domain",
          "tenant_subdomain",
          "mailto:",
          "tel:",
          "appendStorefrontTenantContext",
        ],
      },
      {
        path: "src/pages/admin/CommercialReadiness.tsx",
        markers: [
          "legalConsentRows",
          "Jura/cookie signaler",
          "Kontakt-samtykke",
          "cookieConsentReady",
          "contactConsentReady",
          "Offentlige routes: /kontakt, /privatliv, /cookiepolitik, /betingelser",
          "Det ændrer ikke cookies, tracking, kontaktformular, tenantindstillinger eller juridisk tekst.",
        ],
      },
    ],
  },
];

const renderedChecks = [
  {
    name: "Rendered Webprinter home",
    path: "/?force_domain=webprinter.dk",
    expectedText: ["Den komplette løsning"],
  },
  {
    name: "Rendered aluminium product",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedText: ["Prisberegning"],
  },
  {
    name: "Rendered Salgsmapper product",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedText: ["Standard Salgsmapper", "Download skabelon"],
  },
  {
    name: "Rendered designer template",
    path:
      "/designer?force_domain=www.salgsmapper.dk&templatePdfName=salgsmappe-a5-5mm-ryg.pdf&templatePdfUrl=%2Fdesigner-templates%2Fsalgsmapper%2Fsalgsmappe-a5-5mm-ryg.pdf",
    expectedText: ["Format-skabelon indlæst", "salgsmappe-a5-5mm-ryg.pdf"],
  },
  {
    name: "Rendered Webprinter contact",
    path: "/kontakt?force_domain=webprinter.dk",
    expectedText: ["Kontakt os", "Send os en besked", "privatlivspolitikken"],
  },
];

const contactPrivacyLinkChecks = [
  {
    name: "Webprinter contact keeps platform privacy link",
    path: "/kontakt?force_domain=webprinter.dk",
    expectedPath: "/privacy-policy",
    expectedSearchParams: {
      force_domain: "webprinter.dk",
    },
  },
];

const cookieSettingsLinkChecks = [
  {
    name: "Webprinter cookie settings keeps platform legal links",
    path: "/?force_domain=webprinter.dk",
    expectedLinks: [
      {
        label: "Cookiepolitik",
        expectedPath: "/cookiepolitik",
        expectedSearchParams: {
          force_domain: "webprinter.dk",
        },
      },
      {
        label: "Handelsbetingelser",
        expectedPath: "/handelsbetingelser",
        expectedSearchParams: {
          force_domain: "webprinter.dk",
        },
      },
    ],
  },
  {
    name: "Salgsmapper cookie settings keeps tenant legal links",
    path: "/?force_domain=www.salgsmapper.dk",
    localOnly: true,
    expectedLinks: [
      {
        label: "Cookiepolitik",
        expectedPath: "/cookiepolitik",
        expectedSearchParams: {
          force_domain: "www.salgsmapper.dk",
        },
      },
      {
        label: "Handelsbetingelser",
        expectedPath: "/betingelser",
        expectedSearchParams: {
          force_domain: "www.salgsmapper.dk",
        },
      },
    ],
  },
];

const designLaunchChecks = [
  {
    name: "Aluminium product opens designer",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedDesignerText: ["Design til Aluminium", "Tilbage til bestilling"],
    expectedSearchParams: {
      productId: true,
      order: "1",
      returnTo: "/produkt/aluminium",
    },
    expectedSession: {
      productSlug: "aluminium",
      templatePdfUrl: null,
    },
  },
  {
    name: "Salgsmapper product opens template designer",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedDesignerText: ["Design til Standard Salgsmapper", "504x371mm", "Tilbage til bestilling"],
    expectedSearchParams: {
      productId: true,
      order: "1",
      returnTo: "/produkt/standard-sales-mapper-kopi-2",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
  },
];

const templateDownloadChecks = [
  {
    name: "Salgsmapper product exposes template download",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    linkName: /^Download skabelon$/i,
    expectedHrefPath: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    expectedDownloadName: "Salgsmappe A5 5 mm ryg.pdf",
  },
];

const checkoutLaunchChecks = [
  {
    name: "Aluminium product opens checkout",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedCheckoutText: ["Konfigurer dit design", "Aluminium Skilte", "100 x 100 cm", "Total (ex. moms): 565 kr", "Fil Upload"],
    expectedSearchParams: {
      force_domain: "webprinter.dk",
    },
    expectedSession: {
      productSlug: "aluminium",
      productName: "Aluminium Skilte",
      selectedFormat: "100 x 100 cm",
      quantity: 1,
      productPrice: 436,
      totalPrice: 565,
      templatePdfUrl: null,
    },
  },
  {
    name: "Salgsmapper product opens checkout",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedCheckoutText: ["Konfigurer dit design", "Standard Salgsmapper", "A4 salgsmappe", "Total (ex. moms): 622 kr", "Fil Upload"],
    expectedSearchParams: {
      force_domain: "www.salgsmapper.dk",
    },
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      productName: "Standard Salgsmapper",
      selectedFormat: "A4",
      quantity: 50,
      productPrice: 573,
      totalPrice: 622,
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
  },
];

const uploadReadinessChecks = [
  {
    name: "Aluminium checkout shows upload path",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedUploadText: ["Fil Upload", "Klik eller træk fil hertil", "PDF", "JPG", "TIFF"],
    expectedFileAccept: [".pdf", ".jpg", ".jpeg", ".png", ".tiff"],
    expectedSession: {
      productSlug: "aluminium",
      productName: "Aluminium Skilte",
      selectedFormat: "100 x 100 cm",
      siteUpload: null,
    },
  },
  {
    name: "Salgsmapper checkout shows upload path",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedUploadText: ["Fil Upload", "Klik eller træk fil hertil", "PDF", "JPG", "TIFF"],
    expectedFileAccept: [".pdf", ".jpg", ".jpeg", ".png", ".tiff"],
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      productName: "Standard Salgsmapper",
      selectedFormat: "A4",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
      siteUpload: null,
    },
  },
];

const checkoutValidationChecks = [
  {
    name: "Aluminium checkout validates customer details before payment",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    syntheticUploadName: "smoke-aluminium-upload.png",
    expectedValidationText: "Udfyld kunde- og leveringsoplysninger før betaling.",
    expectedSession: {
      productSlug: "aluminium",
      productName: "Aluminium Skilte",
      selectedFormat: "100 x 100 cm",
    },
  },
  {
    name: "Salgsmapper checkout validates customer details before payment",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    syntheticUploadName: "smoke-salgsmapper-upload.png",
    expectedValidationText: "Udfyld kunde- og leveringsoplysninger før betaling.",
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      productName: "Standard Salgsmapper",
      selectedFormat: "A4",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
  },
];

const paymentSetupChecks = [
  {
    name: "Aluminium checkout reaches payment setup with valid details",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    syntheticUploadName: "smoke-aluminium-payment-upload.png",
    expectedTenantId: "00000000-0000-0000-0000-000000000000",
    expectedAmountOre: 56500,
    expectedProductSlug: "aluminium",
    expectedQuantity: 1,
    expectedDeliveryType: "Standard",
    expectedVariantDisplayLabels: [],
  },
  {
    name: "Salgsmapper checkout reaches payment setup with valid details",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    syntheticUploadName: "smoke-salgsmapper-payment-upload.png",
    expectedTenantId: "7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba",
    expectedAmountOre: 62200,
    expectedProductSlug: "standard-sales-mapper-kopi-2",
    expectedQuantity: 50,
    expectedDeliveryType: "Standard levering",
    expectedVariantDisplayLabels: ["A4 salgsmappe", "1 mm ryg", "4+0 Print på front"],
  },
];

const results = [];

console.log(`\nCommercial readiness smoke for ${baseUrl}`);
console.log("Read-only: no database writes, no orders, no product changes.\n");

for (const check of checks) {
  results.push(await runRouteCheck(check));
}

if (!skipBundleMarkers) {
  results.push(await runBundleMarkerCheck());
}

for (const check of sourceContractChecks) {
  results.push(await runSourceContractCheck(check));
}

if (runBrowserSmoke) {
  results.push(...(await runBrowserChecks()));
}

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  const icon = result.ok ? "OK" : "FAIL";
  console.log(`${icon} ${result.name}`);
  if (result.detail) console.log(`   ${result.detail}`);
}

if (failed.length > 0) {
  console.error(`\nSmoke failed: ${failed.length}/${results.length} checks failed.`);
  process.exit(1);
}

console.log(`\nSmoke passed: ${results.length}/${results.length} checks OK.`);

async function runRouteCheck(check) {
  const url = new URL(check.path, baseUrl);
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return {
        name: check.name,
        ok: false,
        detail: `${response.status} ${response.statusText} at ${url.href}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";

    if (check.kind === "pdf") {
      const bytes = new Uint8Array(await response.arrayBuffer());
      const header = new TextDecoder().decode(bytes.slice(0, 4));
      const looksLikePdf = header === "%PDF";
      const isPdfType = contentType.includes("application/pdf");
      return {
        name: check.name,
        ok: looksLikePdf && isPdfType,
        detail: `${contentType || "unknown content-type"}, ${bytes.length} bytes`,
      };
    }

    const text = await response.text();
    const missing = (check.expectedText || []).filter((marker) => !text.includes(marker));
    return {
      name: check.name,
      ok: missing.length === 0,
      detail: `${response.status}, ${contentType || "unknown content-type"}${missing.length ? `, missing: ${missing.join(", ")}` : ""}`,
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runBundleMarkerCheck() {
  const indexUrl = new URL("/?force_domain=webprinter.dk", baseUrl);
  try {
    const response = await fetchWithTimeout(indexUrl);
    if (!response.ok) {
      return {
        name: "Shipped bundle markers",
        ok: false,
        detail: `${response.status} ${response.statusText} at ${indexUrl.href}`,
      };
    }

    const html = await response.text();
    const scriptPaths = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].map((match) => match[1]);
    const assetPaths = scriptPaths.filter((path) => path.includes("/assets/"));

    if (assetPaths.length === 0) {
      return {
        name: "Shipped bundle markers",
        ok: true,
        detail: "Skipped: no built /assets/*.js bundle found, likely local Vite dev server.",
      };
    }

    const bundleText = (
      await Promise.all(
        assetPaths.map(async (path) => {
          const bundleUrl = new URL(path, baseUrl);
          const bundleResponse = await fetchWithTimeout(bundleUrl);
          if (!bundleResponse.ok) return "";
          return bundleResponse.text();
        }),
      )
    ).join("\n");

    const missing = bundleMarkers.filter((marker) => !bundleText.includes(marker));
    return {
      name: "Shipped bundle markers",
      ok: missing.length === 0,
      detail: missing.length
        ? `Missing markers: ${missing.join(", ")}`
        : `Found markers: ${bundleMarkers.join(", ")}`,
    };
  } catch (error) {
    return {
      name: "Shipped bundle markers",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runSourceContractCheck(check) {
  const missing = [];

  for (const file of check.files) {
    let content = "";
    try {
      content = await readFile(file.path, "utf8");
    } catch (error) {
      missing.push(`${file.path}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const marker of file.markers) {
      if (!content.includes(marker)) {
        missing.push(`${file.path}: missing ${marker}`);
      }
    }
  }

  return {
    name: check.name,
    ok: missing.length === 0,
    detail: missing.length ? missing.slice(0, 8).join("; ") : check.detail,
  };
}

async function runBrowserChecks() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    return [
      {
        name: "Rendered page smoke",
        ok: false,
        detail: `Playwright is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  const renderedResults = [];

  try {
    for (const check of renderedChecks) {
      const url = new URL(check.path, baseUrl);
      const startMessageCount = consoleMessages.length;

      try {
        await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
        await page.waitForTimeout(1000);

        const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
        const missing = check.expectedText.filter((marker) => !text.includes(marker));
        const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
        const newConsoleErrors = consoleMessages.slice(startMessageCount).filter(isMeaningfulConsoleMessage);

        renderedResults.push({
          name: check.name,
          ok: !runtimeError && missing.length === 0,
          detail: [
            runtimeError ? "rendered the temporary error screen" : "rendered",
            missing.length ? `missing: ${missing.join(", ")}` : null,
            newConsoleErrors.length ? `console: ${newConsoleErrors.slice(0, 2).join(" | ")}` : null,
          ].filter(Boolean).join("; "),
        });
      } catch (error) {
        renderedResults.push({
          name: check.name,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const check of contactPrivacyLinkChecks) {
      renderedResults.push(await runContactPrivacyLinkCheck(browser, check));
    }

    for (const check of cookieSettingsLinkChecks) {
      renderedResults.push(await runCookieSettingsLinkCheck(browser, check));
    }

    for (const check of designLaunchChecks) {
      renderedResults.push(await runDesignLaunchCheck(browser, check));
    }

    for (const check of templateDownloadChecks) {
      renderedResults.push(await runTemplateDownloadCheck(browser, check));
    }

    for (const check of checkoutLaunchChecks) {
      renderedResults.push(await runCheckoutLaunchCheck(browser, check));
    }

    for (const check of uploadReadinessChecks) {
      renderedResults.push(await runUploadReadinessCheck(browser, check));
    }

    for (const check of checkoutValidationChecks) {
      renderedResults.push(await runCheckoutValidationCheck(browser, check));
    }

    for (const check of paymentSetupChecks) {
      renderedResults.push(await runPaymentSetupInterceptCheck(browser, check));
    }
  } finally {
    await browser.close();
  }

  return renderedResults;
}

async function runCookieSettingsLinkCheck(browser, check) {
  const baseHost = new URL(baseUrl).hostname;
  const isLocalBase = baseHost === "localhost" || baseHost === "127.0.0.1";
  if (check.localOnly && !isLocalBase) {
    return {
      name: check.name,
      ok: true,
      detail: "Skipped on production host because real hostname decides tenant/platform context.",
    };
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /^Tilpas$/i }).click({ timeout: timeoutMs });
    await page.getByRole("dialog", { name: /Cookieindstillinger/i }).waitFor({ timeout: timeoutMs });

    const mismatches = [];
    const hrefDetails = [];
    for (const expectedLink of check.expectedLinks) {
      const href = await page.getByRole("link", { name: new RegExp(`^${escapeRegex(expectedLink.label)}$`, "i") }).first().getAttribute("href", {
        timeout: timeoutMs,
      });
      if (!href) {
        mismatches.push(`${expectedLink.label} link missing`);
        continue;
      }

      const hrefUrl = new URL(href, url.origin);
      hrefDetails.push(`${expectedLink.label}=${hrefUrl.pathname}${hrefUrl.search}`);
      if (hrefUrl.pathname !== expectedLink.expectedPath) {
        mismatches.push(`${expectedLink.label} path=${hrefUrl.pathname} expected ${expectedLink.expectedPath}`);
      }

      if (isLocalBase) {
        for (const [key, value] of Object.entries(expectedLink.expectedSearchParams || {})) {
          if (hrefUrl.searchParams.get(key) !== value) {
            mismatches.push(`${expectedLink.label} missing local context ${key}=${value}`);
          }
        }
      }
    }

    return {
      name: check.name,
      ok: mismatches.length === 0,
      detail: [
        mismatches.length ? "cookie settings legal link mismatch" : "cookie settings legal links are routed",
        hrefDetails.join(", "),
        mismatches.length ? mismatches.join("; ") : null,
        !isLocalBase ? "production host does not stamp force_domain on links" : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runContactPrivacyLinkCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const href = await page.getByRole("link", { name: /privatlivspolitikken/i }).first().getAttribute("href", {
      timeout: timeoutMs,
    });
    if (!href) {
      return {
        name: check.name,
        ok: false,
        detail: "privacy link missing",
      };
    }

    const hrefUrl = new URL(href, url.origin);
    const baseHost = new URL(baseUrl).hostname;
    const isLocalBase = baseHost === "localhost" || baseHost === "127.0.0.1";
    const missingParams = isLocalBase
      ? Object.entries(check.expectedSearchParams || {})
        .filter(([key, value]) => hrefUrl.searchParams.get(key) !== value)
        .map(([key, value]) => `${key}=${value}`)
      : [];

    return {
      name: check.name,
      ok: hrefUrl.pathname === check.expectedPath && missingParams.length === 0,
      detail: [
        `href=${hrefUrl.pathname}${hrefUrl.search}`,
        hrefUrl.pathname !== check.expectedPath ? `expected path ${check.expectedPath}` : null,
        missingParams.length ? `missing local context: ${missingParams.join(", ")}` : null,
        !isLocalBase ? "production host does not stamp force_domain on platform links" : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runDesignLaunchCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Design online|Design klar/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/designer\?/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const currentUrl = new URL(page.url());
    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const missingText = check.expectedDesignerText.filter((marker) => !text.includes(marker));
    const missingParams = expectedParamFailures(currentUrl.searchParams, check.expectedSearchParams);
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const meaningfulConsole = consoleMessages.filter(isMeaningfulConsoleMessage);
    const ok = !runtimeError && missingText.length === 0 && missingParams.length === 0 && sessionFailures.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "opened designer with order context" : "designer handoff mismatch",
        runtimeError ? "rendered the temporary error screen" : null,
        missingText.length ? `missing text: ${missingText.join(", ")}` : null,
        missingParams.length ? `params: ${missingParams.join(", ")}` : null,
        sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
        meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runTemplateDownloadCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const link = page.getByRole("link", { name: check.linkName }).first();
    const linkCount = await link.count();

    let href = null;
    let downloadName = null;
    let responseOk = false;
    let contentType = "";
    let byteCount = 0;
    let looksLikePdf = false;

    if (linkCount > 0) {
      href = await link.getAttribute("href");
      downloadName = await link.getAttribute("download");

      if (href) {
        const templateUrl = new URL(href, page.url());
        const response = await page.request.get(templateUrl.href, { timeout: timeoutMs });
        responseOk = response.ok();
        contentType = response.headers()["content-type"] || "";
        const bytes = await response.body();
        byteCount = bytes.length;
        looksLikePdf = bytes.subarray(0, 4).toString("utf8") === "%PDF";
      }
    }

    const hrefPath = href ? new URL(href, page.url()).pathname : null;
    const meaningfulConsole = consoleMessages.filter(isMeaningfulConsoleMessage);
    const mismatches = [
      runtimeError ? "rendered the temporary error screen" : null,
      linkCount === 0 ? "download link missing" : null,
      hrefPath !== check.expectedHrefPath ? `href=${JSON.stringify(hrefPath)} expected ${JSON.stringify(check.expectedHrefPath)}` : null,
      downloadName !== check.expectedDownloadName ? `download=${JSON.stringify(downloadName)} expected ${JSON.stringify(check.expectedDownloadName)}` : null,
      !responseOk ? "template request failed" : null,
      !contentType.includes("application/pdf") ? `content-type=${contentType || "missing"}` : null,
      !looksLikePdf ? "template response is not a PDF" : null,
    ].filter(Boolean);
    const ok = mismatches.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "download link resolves to template PDF" : "template download mismatch",
        byteCount ? `${byteCount} bytes` : null,
        meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
        mismatches.length ? mismatches.join("; ") : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runCheckoutLaunchCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Bestil nu/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/checkout\/konfigurer/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const currentUrl = new URL(page.url());
    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const missingText = check.expectedCheckoutText.filter((marker) => !text.includes(marker));
    const missingParams = expectedParamFailures(currentUrl.searchParams, check.expectedSearchParams);
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const meaningfulConsole = consoleMessages.filter(isMeaningfulConsoleMessage);
    const ok = !runtimeError && currentUrl.pathname === "/checkout/konfigurer" && missingText.length === 0 && missingParams.length === 0 && sessionFailures.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "opened checkout with current selection" : "checkout handoff mismatch",
        currentUrl.pathname !== "/checkout/konfigurer" ? `path=${currentUrl.pathname}` : null,
        runtimeError ? "rendered the temporary error screen" : null,
        missingText.length ? `missing text: ${missingText.join(", ")}` : null,
        missingParams.length ? `params: ${missingParams.join(", ")}` : null,
        sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
        meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runUploadReadinessCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Bestil nu/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/checkout\/konfigurer/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const fileInput = page.locator('input[type="file"]').first();
    const fileInputCount = await fileInput.count();
    const fileAccept = fileInputCount > 0 ? await fileInput.getAttribute("accept") : null;
    const paymentButton = page.getByRole("button", { name: /Gå til betaling/i }).first();
    const paymentButtonCount = await paymentButton.count();
    const paymentButtonDisabled = paymentButtonCount > 0 ? await paymentButton.isDisabled() : false;
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const missingText = check.expectedUploadText.filter((marker) => !text.includes(marker));
    const missingAccepts = check.expectedFileAccept.filter((marker) => !String(fileAccept || "").includes(marker));
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const meaningfulConsole = consoleMessages.filter(isMeaningfulConsoleMessage);
    const mismatches = [
      runtimeError ? "rendered the temporary error screen" : null,
      missingText.length ? `missing text: ${missingText.join(", ")}` : null,
      fileInputCount === 0 ? "file input missing" : null,
      missingAccepts.length ? `missing accepted types: ${missingAccepts.join(", ")}` : null,
      paymentButtonCount === 0 ? "payment button missing" : null,
      !paymentButtonDisabled ? "payment button enabled before upload/customer details" : null,
      sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
      meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
    ].filter(Boolean);
    const ok = mismatches.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "upload panel ready without writing a file" : "upload readiness mismatch",
        fileAccept ? `accept=${fileAccept}` : null,
        mismatches.length ? mismatches.join("; ") : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runCheckoutValidationCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];
  const blockedWriteRequests = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  page.on("request", (request) => {
    const url = request.url();
    const method = request.method().toUpperCase();
    const isStripePaymentIntent = url.includes("/functions/v1/stripe-create-payment-intent");
    const isOrderFileWrite = url.includes("/storage/v1/object/order-files") && !["GET", "HEAD", "OPTIONS"].includes(method);
    const isOrderInsert = url.includes("/rest/v1/orders") && method !== "GET";
    if (isStripePaymentIntent || isOrderFileWrite || isOrderInsert) {
      blockedWriteRequests.push(`${method} ${url}`);
    }
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Bestil nu/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/checkout\/konfigurer/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    await installSyntheticCheckoutUpload(page, check.syntheticUploadName);
    await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1500);

    const beforeApproveText = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const hasSyntheticUpload = beforeApproveText.includes(check.syntheticUploadName);
    const paymentButton = page.getByRole("button", { name: /Gå til betaling/i }).first();
    const paymentDisabledBeforeApproval = await paymentButton.isDisabled({ timeout: timeoutMs });
    await page.getByRole("button", { name: /^Godkend fil$/i }).first().click({ timeout: timeoutMs });
    await page.waitForTimeout(750);
    const paymentDisabledAfterApproval = await paymentButton.isDisabled({ timeout: timeoutMs });
    await paymentButton.click({ timeout: timeoutMs });
    await page.waitForTimeout(1000);

    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const uploadPath = session?.siteUpload?.filePath ?? null;
    const meaningfulConsole = consoleMessages.filter(isMeaningfulConsoleMessage);
    const mismatches = [
      runtimeError ? "rendered the temporary error screen" : null,
      !hasSyntheticUpload ? "synthetic upload not rendered" : null,
      uploadPath !== "smoke-readonly/no-storage-write.png" ? `siteUpload.filePath=${JSON.stringify(uploadPath)}` : null,
      !paymentDisabledBeforeApproval ? "payment enabled before file approval" : null,
      paymentDisabledAfterApproval ? "payment still disabled after file approval" : null,
      !text.includes(check.expectedValidationText) ? "missing customer/details validation message" : null,
      blockedWriteRequests.length ? `unexpected write/payment request: ${blockedWriteRequests[0]}` : null,
      sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
      meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
    ].filter(Boolean);
    const ok = mismatches.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "customer/detail validation blocked payment without writes" : "checkout validation mismatch",
        mismatches.length ? mismatches.join("; ") : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runPaymentSetupInterceptCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];
  const paymentRequests = [];
  const blockedWriteRequests = [];

  await page.route("**/functions/v1/stripe-create-payment-intent", async (route, request) => {
    let body = null;
    try {
      body = JSON.parse(request.postData() || "{}");
    } catch {
      body = null;
    }

    paymentRequests.push({
      method: request.method().toUpperCase(),
      url: request.url(),
      body,
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({}),
    });
  });

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  page.on("request", (request) => {
    const url = request.url();
    const method = request.method().toUpperCase();
    const isOrderFileWrite = url.includes("/storage/v1/object/order-files") && !["GET", "HEAD", "OPTIONS"].includes(method);
    const isOrderInsert = url.includes("/rest/v1/orders") && method !== "GET";
    if (isOrderFileWrite || isOrderInsert) {
      blockedWriteRequests.push(`${method} ${url}`);
    }
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Bestil nu/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/checkout\/konfigurer/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    await installSyntheticCheckoutUpload(page, check.syntheticUploadName);
    await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /^Godkend fil$/i }).first().click({ timeout: timeoutMs });
    await page.waitForTimeout(750);
    await fillCheckoutCustomerDetails(page);
    await page.getByRole("button", { name: /Gå til betaling/i }).click({ timeout: timeoutMs });
    await page.waitForTimeout(3000);

    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const request = paymentRequests[0] || null;
    const body = request?.body || {};
    const checkoutQuote = body.checkout_quote || {};
    const metadata = body.metadata || {};
    const quoteProductId = String(checkoutQuote.productId || "");
    const quoteLabels = Array.isArray(checkoutQuote.variantDisplayLabels)
      ? checkoutQuote.variantDisplayLabels.map((label) => String(label || ""))
      : [];
    const meaningfulConsole = consoleMessages.filter(isMeaningfulConsoleMessage);
    const missingVariantLabels = (check.expectedVariantDisplayLabels || []).filter((label) => !quoteLabels.includes(label));
    const mismatches = [
      paymentRequests.length !== 1 ? `payment setup requests=${paymentRequests.length}` : null,
      request?.method !== "POST" ? `payment setup method=${request?.method || "missing"}` : null,
      body.tenant_id !== check.expectedTenantId ? `tenant_id=${JSON.stringify(body.tenant_id)} expected ${check.expectedTenantId}` : null,
      body.amount_ore !== check.expectedAmountOre ? `amount_ore=${JSON.stringify(body.amount_ore)} expected ${check.expectedAmountOre}` : null,
      body.currency !== "dkk" ? `currency=${JSON.stringify(body.currency)} expected "dkk"` : null,
      !isUuid(quoteProductId) ? `quote.productId=${JSON.stringify(checkoutQuote.productId)} is not a UUID` : null,
      checkoutQuote.productSlug !== check.expectedProductSlug ? `quote.productSlug=${JSON.stringify(checkoutQuote.productSlug)}` : null,
      checkoutQuote.quantity !== check.expectedQuantity ? `quote.quantity=${JSON.stringify(checkoutQuote.quantity)} expected ${check.expectedQuantity}` : null,
      checkoutQuote.shippingSelected !== "standard" ? `quote.shippingSelected=${JSON.stringify(checkoutQuote.shippingSelected)} expected "standard"` : null,
      Number(checkoutQuote.areaM2) <= 0 ? `quote.areaM2=${JSON.stringify(checkoutQuote.areaM2)} expected positive area` : null,
      missingVariantLabels.length ? `quote.variantDisplayLabels missing ${missingVariantLabels.join(", ")}` : null,
      metadata.product_id !== quoteProductId ? `metadata.product_id=${JSON.stringify(metadata.product_id)} expected quote productId` : null,
      metadata.product_slug !== check.expectedProductSlug ? `metadata.product_slug=${JSON.stringify(metadata.product_slug)}` : null,
      metadata.uploaded_file !== "smoke-readonly/no-storage-write.png" ? `metadata.uploaded_file=${JSON.stringify(metadata.uploaded_file)}` : null,
      metadata.quantity !== String(check.expectedQuantity) ? `metadata.quantity=${JSON.stringify(metadata.quantity)} expected "${check.expectedQuantity}"` : null,
      metadata.customer_email !== "smoke-test@example.com" ? `metadata.customer_email=${JSON.stringify(metadata.customer_email)}` : null,
      metadata.customer_name !== "Smoke Test Kunde" ? `metadata.customer_name=${JSON.stringify(metadata.customer_name)}` : null,
      metadata.recipient_name !== "Smoke Modtager" ? `metadata.recipient_name=${JSON.stringify(metadata.recipient_name)}` : null,
      metadata.delivery_city !== "Aarhus C" ? `metadata.delivery_city=${JSON.stringify(metadata.delivery_city)}` : null,
      metadata.delivery_type !== check.expectedDeliveryType ? `metadata.delivery_type=${JSON.stringify(metadata.delivery_type)} expected ${JSON.stringify(check.expectedDeliveryType)}` : null,
      metadata.blind_shipping !== "false" ? `metadata.blind_shipping=${JSON.stringify(metadata.blind_shipping)} expected "false"` : null,
      metadata.sender_name !== "" ? `metadata.sender_name=${JSON.stringify(metadata.sender_name)} expected empty sender override` : null,
      text.includes("Udfyld kunde- og leveringsoplysninger før betaling.") ? "validation still blocked complete details" : null,
      blockedWriteRequests.length ? `unexpected order/storage write: ${blockedWriteRequests[0]}` : null,
      meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
    ].filter(Boolean);
    const ok = mismatches.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "intercepted payment setup request with tenant, quote, delivery and customer metadata" : "payment setup mismatch",
        mismatches.length ? mismatches.join("; ") : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function fillCheckoutCustomerDetails(page) {
  await page.getByRole("button", { name: /Dine oplysninger/i }).click({ timeout: timeoutMs });
  await page.locator("#customer-name").fill("Smoke Test Kunde", { timeout: timeoutMs });
  await page.locator("#customer-email").fill("smoke-test@example.com", { timeout: timeoutMs });
  await page.locator("#customer-phone").fill("12345678", { timeout: timeoutMs });
  await page.locator("#customer-company").fill("Smoke Test ApS", { timeout: timeoutMs });
  await page.locator("#delivery-recipient-name").fill("Smoke Modtager", { timeout: timeoutMs });
  await page.locator("#delivery-company").fill("Smoke Test ApS", { timeout: timeoutMs });
  await page.locator("#delivery-address").fill("Testvej 1", { timeout: timeoutMs });
  await page.locator("#delivery-zip").fill("8000", { timeout: timeoutMs });
  await page.locator("#delivery-city").fill("Aarhus C", { timeout: timeoutMs });
}

async function installSyntheticCheckoutUpload(page, name) {
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0D9GwAAAABJRU5ErkJggg==";
  await page.evaluate(({ dataUrl, name }) => {
    const key = "wp_site_checkout_session";
    const raw = sessionStorage.getItem(key);
    const session = raw ? JSON.parse(raw) : {};
    const widthMm = Number(session.designWidthMm || 100);
    const heightMm = Number(session.designHeightMm || 100);

    session.siteUpload = {
      name,
      mimeType: "image/png",
      fileUrl: dataUrl,
      filePath: "smoke-readonly/no-storage-write.png",
      previewDataUrl: dataUrl,
      widthPx: 3000,
      heightPx: 3000,
      physicalWidthMm: widthMm,
      physicalHeightMm: heightMm,
      estimatedDpi: 300,
      sourceDpi: 300,
      uploadedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(key, JSON.stringify(session));
    window.history.replaceState(null, "", window.location.href);
  }, { dataUrl, name });
}

async function readCheckoutSession(page) {
  const raw = await page.evaluate(() => sessionStorage.getItem("wp_site_checkout_session"));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function expectedParamFailures(searchParams, expected) {
  return Object.entries(expected || {}).flatMap(([key, expectedValue]) => {
    const actual = searchParams.get(key);
    if (expectedValue === true) return actual ? [] : [`${key} missing`];
    return actual === expectedValue ? [] : [`${key}=${JSON.stringify(actual)} expected ${JSON.stringify(expectedValue)}`];
  });
}

function expectedSessionFailures(session, expected) {
  if (!session || typeof session !== "object") return ["checkout session missing"];
  return Object.entries(expected || {}).flatMap(([key, expectedValue]) => {
    const actual = session[key] ?? null;
    return actual === expectedValue ? [] : [`${key}=${JSON.stringify(actual)} expected ${JSON.stringify(expectedValue)}`];
  });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "webprinter-commercial-readiness-smoke/1.0",
        accept: "*/*",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "/");
}

function normalizeVisibleText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isMeaningfulConsoleMessage(message) {
  return ![
    "A preload for",
    "was not used within a few seconds",
    "motion() is deprecated. Use motion.create() instead.",
  ].some((ignored) => String(message || "").includes(ignored));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

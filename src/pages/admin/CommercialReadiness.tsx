import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  Gauge,
  Globe2,
  Layers3,
  LifeBuoy,
  Mail,
  Paintbrush,
  PackageSearch,
  SearchCheck,
  ShieldCheck,
  ShoppingCart,
  Scale,
  Truck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getSalgsmapperFallbackTemplates,
  mergeProductTemplates,
  resolveSelectedDesignerTemplateLaunch,
  type ProductTemplateFile,
} from "@/lib/designer/productTemplateLinks";
import {
  useSearchConsoleSites,
  useSearchConsoleSiteOverview,
  useSearchConsoleStatus,
} from "@/lib/platform-seo/search-console-hooks";
import type { SearchConsoleSiteSummary } from "@/lib/platform-seo/search-console-types";

type Status = "klar" | "qa" | "planlagt" | "blokeret";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const PLATFORM_LEAD_PREFIX = "[PLATFORM LEAD]";
const PLATFORM_LEAD_THREAD_ADMIN_PATH = `/admin/beskeder?tenantId=${MASTER_TENANT_ID}&force_domain=webprinter.dk`;

interface Checkpoint {
  label: string;
  status: Status;
}

interface TenantPilot {
  name: string;
  domain: string;
  focus: string;
  firstProduct: string;
  firstProductSlug: string | null;
  storefrontPath: string;
  adminPath: string;
}

interface ActionItem {
  title: string;
  owner: string;
  status: Status;
  description: string;
  href: string;
}

interface TenantSignal {
  tenantId: string | null;
  tenantName: string | null;
  productCount: number | null;
  publishedProductCount: number | null;
  firstProductFound: boolean;
  firstProductPublished: boolean;
  firstProductPricingType: string | null;
  firstProductPriceRows: number | null;
  firstProductStorformatRows: number | null;
  firstProductTemplateCount: number | null;
  firstProductDesignerLaunchReady: boolean;
  firstProductOrderCount: number | null;
  activeTemplateCount: number | null;
  seoRows: number | null;
  orderCount: number | null;
  pendingOrderCount: number | null;
  orderOperationsSampleCount: number | null;
  orderOperationsSampleLimited: boolean;
  orderFileReadyCount: number | null;
  orderProblemCount: number | null;
  orderReuploadCount: number | null;
  orderAwaitingCustomerFileCount: number | null;
  orderMissingFileCount: number | null;
  paymentSettingsFound: boolean;
  paymentProvider: string | null;
  paymentStatus: string | null;
  paymentChargesEnabled: boolean | null;
  paymentPayoutsEnabled: boolean | null;
  paymentDetailsSubmitted: boolean | null;
  paymentCurrency: string | null;
  paymentFeePercent: number | null;
  paymentFeeFlatOre: number | null;
  paymentUpdatedAt: string | null;
  supportOrderMessageCount: number | null;
  supportUnreadCustomerMessageCount: number | null;
  supportPlatformMessageCount: number | null;
  supportUnreadTenantMessageCount: number | null;
  supportLatestMessageAt: string | null;
  notificationCustomerConfirmationsEnabled: boolean | null;
  notificationAdminNewOrdersEnabled: boolean | null;
  notificationMarketingEnabled: boolean | null;
  notificationCompanyEmail: string | null;
  notificationCompanyName: string | null;
  notificationAdminName: string | null;
  tenantNotificationCount: number | null;
  tenantUnreadNotificationCount: number | null;
  legalCompanyEmail: string | null;
  legalCompanyName: string | null;
  legalCompanyPhone: string | null;
  legalCompanyAddress: string | null;
  legalCompanyCvr: string | null;
  legalHasCompanyIdentity: boolean;
  legalHasContactEmail: boolean;
  legalHasAddressOrCvr: boolean;
  deliveryOrderSampleCount: number | null;
  deliveryOrdersWithMethodCount: number | null;
  deliveryOrdersWithTrackingCount: number | null;
  deliveryTrackingEventCount: number | null;
  podShippingProfileFound: boolean;
  podShippingSenderMode: string | null;
  podShippingSenderComplete: boolean | null;
  podShippingHasLogo: boolean | null;
  firstProductOrderingType: string | null;
  firstProductDeliveryMode: string | null;
  firstProductDeliveryMethodCount: number | null;
  firstProductCarrierEnabled: boolean | null;
  firstProductPodDeliveryEnabled: boolean | null;
  firstProductSupplierEmail: string | null;
  firstProductSupplierName: string | null;
  error: string | null;
}

interface TenantReadiness extends TenantPilot {
  readiness: number;
  status: Status;
  checkpoints: Checkpoint[];
  signal: TenantSignal | null;
}

interface FlowIssue {
  tenantName: string;
  title: string;
  status: Status;
  detail: string;
  href: string;
}

interface ProofStep {
  label: string;
  status: Status;
  detail: string;
  href: string;
}

interface EvidenceItem {
  label: string;
  status: Status;
  proof: string;
  missing: string;
}

interface AutomatedProofChainItem {
  tenantName: string;
  product: string;
  status: Status;
  route: string;
  proofType: string;
  verifies: string[];
  href: string;
}

interface CommercialReleaseArtifact {
  title: string;
  status: Status;
  path: string;
  command: string;
  description: string;
  verifies: string[];
}

interface ExecutiveAction {
  tenantName: string;
  status: Status;
  title: string;
  summary: string;
  href: string;
  cta: string;
}

interface CommercialGate {
  title: string;
  status: Status;
  metric: string;
  summary: string;
  href: string;
}

interface DemoRunbookStep {
  title: string;
  status: Status;
  duration: string;
  description: string;
  href: string;
}

interface CommercialDecision {
  title: string;
  owner: string;
  status: Status;
  impact: string;
  decision: string;
  href: string;
}

interface CommercialDecisionOptionCard {
  title: string;
  owner: string;
  status: Status;
  recommended: string;
  alternatives: string[];
  deferCost: string;
  decisionRule: string;
  href: string;
}

interface SupplierBankStagingRunbookItem {
  title: string;
  phase: string;
  status: Status;
  evidence: string;
  operatorAction: string;
  approvalGate: string;
  href: string;
}

interface PilotOrderStep {
  title: string;
  owner: string;
  status: Status;
  proof: string;
  next: string;
  href: string;
}

interface SalesPackageItem {
  title: string;
  owner: string;
  status: Status;
  artifact: string;
  next: string;
  href: string;
}

interface PrintHouseOfferItem {
  title: string;
  status: Status;
  packageLine: string;
  proof: string;
  decision: string;
  href: string;
}

interface CommercialReadyCriterion {
  title: string;
  status: Status;
  proof: string;
  next: string;
  href: string;
}

interface ThirtyDayPlanItem {
  title: string;
  status: Status;
  owner: string;
  proof: string;
  next: string;
  href: string;
}

interface PilotProofRunItem {
  title: string;
  tenantName: string;
  surface: string;
  status: Status;
  evidence: string;
  witness: string;
  href: string;
}

interface RehearsalProofCaptureItem {
  title: string;
  tenantName: string;
  surface: string;
  status: Status;
  capture: string;
  acceptedWhen: string;
  stopRule: string;
  href: string;
}

interface PilotOperationsRunbookItem {
  title: string;
  owner: string;
  status: Status;
  evidence: string;
  operatorCheck: string;
  href: string;
}

interface AdminAccessReadinessItem {
  title: string;
  area: string;
  status: Status;
  evidence: string;
  manualCheck: string;
  href: string;
}

interface ExecutivePriorityItem {
  priority: string;
  title: string;
  owner: string;
  status: Status;
  reason: string;
  action: string;
  href: string;
}

interface PrintHouseMeetingPackItem {
  title: string;
  status: Status;
  purpose: string;
  say: string;
  evidence: string;
  href: string;
}

interface CommercialGoalExecutionItem {
  phase: string;
  title: string;
  status: Status;
  evidence: string;
  next: string;
  href: string;
}

type AutomationMode = "auto" | "manual" | "decision";

interface CommercialAutomationItem {
  title: string;
  mode: AutomationMode;
  status: Status;
  evidence: string;
  canDo: string;
  needsHuman: string;
  href: string;
}

interface CommercialFocusItem {
  title: string;
  label: string;
  status: Status;
  summary: string;
  next: string;
  href: string;
  cta: string;
}

interface ExternalDemoBoundaryItem {
  title: string;
  audience: string;
  status: Status;
  allowed: string;
  risk: string;
  href: string;
}

interface CommercialPilotAcceptanceItem {
  title: string;
  status: Status;
  acceptance: string;
  evidence: string;
  next: string;
  href: string;
}

interface PilotResponsibilityItem {
  owner: string;
  title: string;
  status: Status;
  responsibility: string;
  proof: string;
  risk: string;
  href: string;
}

interface PilotScopeAgreementItem {
  title: string;
  category: string;
  status: Status;
  included: string;
  excluded: string;
  decision: string;
  href: string;
}

interface PilotOnboardingStep {
  step: string;
  title: string;
  owner: string;
  status: Status;
  action: string;
  evidence: string;
  stopCondition: string;
  href: string;
}

interface PilotSuccessCriterion {
  title: string;
  status: Status;
  metric: string;
  success: string;
  pauseIf: string;
  decision: string;
  href: string;
}

interface PrintHousePilotHandoffItem {
  title: string;
  audience: string;
  status: Status;
  handoff: string;
  proof: string;
  next: string;
  href: string;
}

interface PrintHousePilotQuestionItem {
  question: string;
  category: string;
  status: Status;
  answer: string;
  proof: string;
  boundary: string;
  href: string;
}

interface PrintHouseMeetingBriefItem {
  title: string;
  status: Status;
  script: string;
  proof: string;
  boundary: string;
  href: string;
}

interface PrintHouseFollowUpItem {
  title: string;
  audience: string;
  status: Status;
  draft: string;
  proof: string;
  next: string;
  href: string;
}

interface PrintHousePilotOfferDraftItem {
  title: string;
  section: string;
  status: Status;
  clause: string;
  proof: string;
  guardrail: string;
  href: string;
}

interface PilotAgreementChecklistItem {
  title: string;
  area: string;
  status: Status;
  checkpoint: string;
  evidence: string;
  missing: string;
  href: string;
}

interface PilotStartPlanItem {
  title: string;
  day: string;
  owner: string;
  status: Status;
  action: string;
  proof: string;
  stopRule: string;
  href: string;
}

interface PilotWeekOneReportItem {
  title: string;
  area: string;
  status: Status;
  signal: string;
  evidence: string;
  next: string;
  href: string;
}

interface PilotConversionReadinessItem {
  title: string;
  area: string;
  status: Status;
  proof: string;
  decision: string;
  stopRule: string;
  href: string;
}

interface PaidPilotPackageItem {
  title: string;
  area: string;
  status: Status;
  packageLine: string;
  proof: string;
  decision: string;
  href: string;
}

interface FirstCustomerOnboardingItem {
  title: string;
  area: string;
  status: Status;
  customerInput: string;
  internalCheck: string;
  stopRule: string;
  href: string;
}

interface FirstCustomerSetupWorkOrderItem {
  title: string;
  area: string;
  status: Status;
  workOrder: string;
  evidence: string;
  stopRule: string;
  href: string;
}

interface FirstCustomerKickoffAgendaItem {
  title: string;
  segment: string;
  status: Status;
  agenda: string;
  evidence: string;
  boundary: string;
  href: string;
}

interface FirstCustomerKickoffFollowUpItem {
  title: string;
  audience: string;
  status: Status;
  recap: string;
  ownerAction: string;
  guardrail: string;
  href: string;
}

interface CustomerMaterialCheckpointItem {
  title: string;
  area: string;
  status: Status;
  expected: string;
  currentSignal: string;
  next: string;
  href: string;
}

interface ProductionReleaseReadinessItem {
  title: string;
  area: string;
  status: Status;
  evidence: string;
  required: string;
  stopRule: string;
  href: string;
}

interface ProductionReleaseProofItem {
  title: string;
  owner: string;
  status: Status;
  capture: string;
  acceptedWhen: string;
  stopRule: string;
  href: string;
}

interface LaunchBoardItem {
  title: string;
  verdict: string;
  status: Status;
  basis: string;
  next: string;
  href: string;
}

interface SalesEvidenceItem {
  claim: string;
  status: Status;
  proof: string;
  gap: string;
  href: string;
}

interface CriticalPathItem {
  title: string;
  status: Status;
  why: string;
  next: string;
  href: string;
}

interface PilotPrintHouseIntakeItem {
  title: string;
  status: Status;
  needed: string;
  systemUse: string;
  href: string;
}

interface SeoVisibilityRow {
  tenantName: string;
  domain: string;
  status: Status;
  seoRows: number | null;
  siteUrl: string;
  searchConsoleState: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  detail: string;
  href: string;
}

interface OrderOperationsRow {
  tenantName: string;
  domain: string;
  status: Status;
  orderCount: number | null;
  fileReadyCount: number | null;
  problemCount: number | null;
  reuploadCount: number | null;
  awaitingCustomerFileCount: number | null;
  missingFileCount: number | null;
  sampledCount: number | null;
  sampleLimited: boolean;
  detail: string;
  href: string;
}

interface PaymentCheckoutRow {
  tenantName: string;
  domain: string;
  status: Status;
  paymentStatus: string;
  mode: string;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  detailsSubmitted: boolean | null;
  feeSummary: string;
  updatedAt: string | null;
  detail: string;
  href: string;
}

interface SupportCustomerRow {
  tenantName: string;
  domain: string;
  status: Status;
  orderMessageCount: number | null;
  unreadCustomerMessageCount: number | null;
  platformMessageCount: number | null;
  unreadTenantMessageCount: number | null;
  latestMessageAt: string | null;
  detail: string;
  href: string;
}

interface MailNotificationRow {
  tenantName: string;
  domain: string;
  status: Status;
  customerConfirmationsEnabled: boolean | null;
  adminNewOrdersEnabled: boolean | null;
  marketingEnabled: boolean | null;
  companyEmail: string | null;
  companyName: string | null;
  adminName: string | null;
  tenantNotificationCount: number | null;
  tenantUnreadNotificationCount: number | null;
  detail: string;
  href: string;
}

interface DeliveryFulfillmentRow {
  tenantName: string;
  domain: string;
  status: Status;
  orderSampleCount: number | null;
  ordersWithMethodCount: number | null;
  ordersWithTrackingCount: number | null;
  trackingEventCount: number | null;
  podProfileFound: boolean;
  podSenderMode: string | null;
  podSenderComplete: boolean | null;
  podHasLogo: boolean | null;
  firstProductOrderingType: string | null;
  firstProductDeliveryMode: string | null;
  firstProductDeliveryMethodCount: number | null;
  firstProductCarrierEnabled: boolean | null;
  firstProductPodDeliveryEnabled: boolean | null;
  firstProductSupplierEmail: string | null;
  firstProductSupplierName: string | null;
  detail: string;
  href: string;
}

interface LegalConsentRow {
  tenantName: string;
  domain: string;
  status: Status;
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  companyCvr: string | null;
  publicRoutesReady: boolean;
  cookieConsentReady: boolean;
  contactConsentReady: boolean;
  termsLinkNeedsReview: boolean;
  detail: string;
  href: string;
}

interface PlatformLeadReadinessItem {
  title: string;
  status: Status;
  signal: string;
  proof: string;
  next: string;
  href: string;
}

interface PlatformLeadSummary {
  totalCount: number | null;
  unreadCount: number | null;
  latestAt: string | null;
  error: string | null;
}

const cockpitSectionLinks = [
  { label: "Sikker handling", href: "#next-safe-action" },
  { label: "Mål", href: "#goal-execution" },
  { label: "Demo-grænse", href: "#external-demo-boundary" },
  { label: "Pilotaccept", href: "#commercial-pilot-acceptance" },
  { label: "Ansvar", href: "#pilot-responsibility-map" },
  { label: "Scope", href: "#pilot-scope-agreement" },
  { label: "Pilot-onboarding", href: "#pilot-onboarding-plan" },
  { label: "Succeskriterier", href: "#pilot-success-criteria" },
  { label: "Pilot-handoff", href: "#print-house-pilot-handoff" },
  { label: "Pilot Q&A", href: "#print-house-pilot-questions" },
  { label: "Mødebrief", href: "#print-house-meeting-brief" },
  { label: "Opfølgning", href: "#print-house-follow-up" },
  { label: "Tilbudskladde", href: "#print-house-offer-draft" },
  { label: "Aftalecheck", href: "#pilot-agreement-checklist" },
  { label: "Pilotstart", href: "#pilot-start-plan" },
  { label: "Uge 1", href: "#pilot-week-one-report" },
  { label: "Konvertering", href: "#pilot-conversion-readiness" },
  { label: "Betalt pilot", href: "#paid-pilot-package" },
  { label: "Kunde-onboarding", href: "#first-customer-onboarding" },
  { label: "Setup", href: "#first-customer-setup-work-order" },
  { label: "Kundekickoff", href: "#first-customer-kickoff-agenda" },
  { label: "Kickoff-opfølgning", href: "#first-customer-kickoff-follow-up" },
  { label: "Kundemateriale", href: "#customer-material-checkpoint" },
  { label: "Frigivelse", href: "#production-release-readiness" },
  { label: "Releasebevis", href: "#production-release-proof" },
  { label: "Bank-runbook", href: "#supplier-bank-staging-runbook" },
  { label: "Prioritet", href: "#priority-queue" },
  { label: "Mødepakke", href: "#print-house-meeting-pack" },
  { label: "Kritisk sti", href: "#critical-path" },
  { label: "Generalprøve", href: "#manual-rehearsal-route" },
  { label: "Bevisfangst", href: "#rehearsal-proof-capture" },
  { label: "Pilottest", href: "#pilot-proof-run" },
  { label: "Browserbevis", href: "#automated-proof-chain" },
  { label: "Pilotdrift", href: "#pilot-operations-runbook" },
  { label: "Ordresignal", href: "#order-operations-signals" },
  { label: "Betaling", href: "#payment-checkout-signals" },
  { label: "Kundeservice", href: "#support-customer-signals" },
  { label: "Mail", href: "#mail-notification-signals" },
  { label: "Levering", href: "#delivery-fulfillment-signals" },
  { label: "Jura", href: "#legal-consent-signals" },
  { label: "Platformkontakt", href: "#platform-lead-readiness" },
  { label: "Adgang", href: "#admin-access-readiness" },
  { label: "Pilot-intake", href: "#pilot-intake" },
  { label: "Go/no-go", href: "#launch-board" },
  { label: "Ready-score", href: "#commercial-ready-score" },
  { label: "Bevismappe", href: "#sales-evidence" },
  { label: "SEO bevis", href: "#seo-visibility" },
  { label: "Demo gate", href: "#demo-gate" },
  { label: "Demo-køreplan", href: "#demo-runbook" },
  { label: "Pilotordre", href: "#pilot-order-plan" },
  { label: "Salgspakke", href: "#sales-package" },
  { label: "Pilotpakke", href: "#offer-model" },
  { label: "30 dage", href: "#thirty-day-plan" },
  { label: "Beslutninger", href: "#decision-queue" },
  { label: "Valgkort", href: "#decision-option-cards" },
  { label: "Blokeringer", href: "#flow-blockers" },
  { label: "Tenantbeviser", href: "#proof-flow" },
];

const statusLabels: Record<Status, string> = {
  klar: "Klar",
  qa: "Kræver QA",
  planlagt: "Planlagt",
  blokeret: "Blokeret",
};

const statusClassNames: Record<Status, string> = {
  klar: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  qa: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  planlagt: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  blokeret: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

const statusIcons: Record<Status, typeof CheckCircle2> = {
  klar: CheckCircle2,
  qa: ClipboardCheck,
  planlagt: Gauge,
  blokeret: AlertTriangle,
};

const automationModeLabels: Record<AutomationMode, string> = {
  auto: "Kan automatiseres",
  manual: "Kræver manuel bevisførelse",
  decision: "Kræver beslutning",
};

const automationModeClassNames: Record<AutomationMode, string> = {
  auto: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  manual: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  decision: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

const tenantPilots: TenantPilot[] = [
  {
    name: "Webprinter",
    domain: "webprinter.dk",
    focus: "Platformens hovedbevis med bredt produktkatalog.",
    firstProduct: "Aluminium",
    firstProductSlug: "aluminium",
    storefrontPath: "/produkt/aluminium?force_domain=webprinter.dk",
    adminPath: "/admin/product/aluminium?force_domain=webprinter.dk",
  },
  {
    name: "Salgsmapper",
    domain: "salgsmapper.dk",
    focus: "Niche-tenant for salgsmapper, skabeloner og PDF-guides.",
    firstProduct: "A5/A4 salgsmappe med skabelon",
    firstProductSlug: "standard-sales-mapper-kopi-2",
    storefrontPath: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    adminPath: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
  },
  {
    name: "Onlinetryksager",
    domain: "onlinetryksager.dk",
    focus: "General print-tenant med katalog, SEO og standardprodukter.",
    firstProduct: "Flyers",
    firstProductSlug: "flyer-demand",
    storefrontPath: "/produkt/flyer-demand?force_domain=www.onlinetryksager.dk",
    adminPath: "/admin/product/flyer-demand?force_domain=www.onlinetryksager.dk",
  },
];

const automatedProofChain: AutomatedProofChainItem[] = [
  {
    tenantName: "Webprinter",
    product: "Aluminium",
    status: "klar",
    route: "/produkt/aluminium?force_domain=webprinter.dk",
    proofType: "Ordre/upload",
    verifies: [
      "Produktet loader på Webprinter-kontekst.",
      "Storformat-pris bliver aktiv, og Bestil nu er klikbar.",
      "Checkout/upload åbner med produkt, pris, format og session.",
    ],
    href: "/produkt/aluminium?force_domain=webprinter.dk",
  },
  {
    tenantName: "Salgsmapper",
    product: "Standard salgsmappe",
    status: "klar",
    route: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    proofType: "Template/designer",
    verifies: [
      "PDF-skabelonen serveres som application/pdf.",
      "Download skabelon peger på den rigtige salgsmappefil.",
      "Design online åbner designer med templatePdfUrl og produktkontekst.",
    ],
    href: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
  },
  {
    tenantName: "Onlinetryksager",
    product: "Flyers",
    status: "klar",
    route: "/produkt/flyer-demand?force_domain=www.onlinetryksager.dk",
    proofType: "Ordre/upload",
    verifies: [
      "Flyers loader på Onlinetryksager-kontekst.",
      "A5 / 50 stk prisvalg er aktivt med reel pris.",
      "Checkout/upload åbner med Flyers, A5, 50 stk og session.",
    ],
    href: "/produkt/flyer-demand?force_domain=www.onlinetryksager.dk",
  },
];

const commercialReleaseArtifacts: CommercialReleaseArtifact[] = [
  {
    title: "Release packet index",
    status: "qa",
    path: "docs/COMMERCIAL_RELEASE_PACKET_LATEST.md",
    command: "npm run check:commercial-release-packet-report",
    description: "Read-only startpunkt for release-ejeren: samler alle proof-, review-, branch-, deploy- og handoffrapporter i én åbne-først oversigt.",
    verifies: [
      "Release proof, tenant browserproof, staged packet og owner merge simulation vises som PASS/not proven.",
      "Branch, Supabase, deploy og handoff HOLD vises som ejerbeslutninger.",
      "Rapporten skaber ingen commit, push, pull, merge, rebase, Vercel-deploy eller Supabase-deploy.",
    ],
  },
  {
    title: "Detaljeret proof-rapport",
    status: "klar",
    path: "docs/COMMERCIAL_PROOF_LATEST.md",
    command: "npm run check:commercial-proof-report",
    description: "Viser de konkrete browserproofs for de tre ejede tenants og PDF-skabelonen.",
    verifies: [
      "9/9 tenant proof checks er PASS.",
      "Read-only sikkerhedsteksten er til stede.",
      "Webprinter, Salgsmapper og Onlinetryksager er dækket.",
    ],
  },
  {
    title: "Release summary",
    status: "klar",
    path: "docs/COMMERCIAL_RELEASE_LATEST.md",
    command: "npm run check:commercial-release-report",
    description: "Kompakt pre-demo/pre-deploy status for proof, ændringssæt, app-source review, rapportkontrol og production build.",
    verifies: [
      "Release status er PASSED.",
      "Proof gate, ændringssætrapport, application-source review, rapportverifier og production build er PASS.",
      "Rapporten peger tilbage på proof-, ændringssæt- og application-source rapporterne.",
    ],
  },
  {
    title: "App-source review",
    status: "qa",
    path: "docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md",
    command: "npm run check:commercial-application-source-report",
    description: "Read-only reviewpakke for runtime-koden efter proof-chain: pricing/product, designer/PDF, tenant storefront, admin og checkout.",
    verifies: [
      "Runtime app-kode grupperes efter risikoområde.",
      "Core pricing, POD, designer/PDF og untracked runtime-filer vises som guardrails.",
      "Rapporten kræver build og tenant proof, men skriver ikke produkter, priser, ordrer, SEO, POD eller Supplier Bank-data.",
    ],
  },
  {
    title: "Supabase review",
    status: "qa",
    path: "docs/COMMERCIAL_SUPABASE_LATEST.md",
    command: "npm run check:commercial-supabase-report",
    description: "Read-only reviewpakke for Supabase-migrationer, Edge Functions, lokale dubletfiler og eksplicit Data API/function exposure.",
    verifies: [
      "Supabase grant-check og function exposure-check er PASS.",
      "Migrationer, Edge Functions, temp-filer og space-suffixed dubletter vises separat.",
      "Rapporten skriver ikke database, functions, produkter, priser, ordrer, SEO, POD eller Supplier Bank-data.",
    ],
  },
  {
    title: "Staged packet review",
    status: "klar",
    path: "docs/COMMERCIAL_STAGED_PACKET_LATEST.md",
    command: "npm run check:commercial-staged-packet-report",
    description: "Read-only kontrol af det der faktisk er lagt i git-index før commit, push eller deploy.",
    verifies: [
      "Forbudte lokale Supabase-/debugfiler er ikke staged.",
      "Core pricing, POD og lokale tooling-filer holdes ude af releasepakken.",
      "Deployable Supabase-filer og holdte lokale artifacts vises separat.",
    ],
  },
  {
    title: "Branch freshness review",
    status: "qa",
    path: "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md",
    command: "npm run check:commercial-branch-freshness-report",
    description: "Read-only review af upstream-commits, remote ændrede filer og overlap med staged packet før push/deploy.",
    verifies: [
      "Remote-only commits og filer listes uden fetch, pull, merge eller rebase.",
      "Overlap mellem upstream-delta og staged packet gøres synligt som release-HOLD.",
      "Rapporten skaber ingen commit, push, pull, merge, Vercel-deploy eller Supabase-deploy.",
    ],
  },
  {
    title: "Upstream reconciliation",
    status: "qa",
    path: "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md",
    command: "npm run check:commercial-upstream-reconciliation-report",
    description: "Read-only review der viser om remote-overlap er exakt, repræsenteret, superseded eller uløst i staged packet.",
    verifies: [
      "Remote-overlap klassificeres uden pull, merge eller rebase.",
      "Uløste overlap tælles separat fra branch-HOLD.",
      "Rapporten skaber ingen commit, push, pull, merge, Vercel-deploy eller Supabase-deploy.",
    ],
  },
  {
    title: "Owner merge-readiness",
    status: "qa",
    path: "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md",
    command: "npm run check:commercial-owner-merge-readiness-report",
    description: "Read-only temp-index bevis for at den staged releasepakke kan lægges oven på upstream-træet før release-ejeren frisker branchen op.",
    verifies: [
      "Et midlertidigt git-index bygges fra upstream og overlayes med staged packet.",
      "Temp-træet kan skrives uden at ændre branch, worktree eller rigtigt git-index.",
      "Rapporten skaber ingen commit, push, pull, merge, rebase, Vercel-deploy eller Supabase-deploy.",
    ],
  },
  {
    title: "Release-owner sequence",
    status: "qa",
    path: "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md",
    command: "npm run check:commercial-release-owner-sequence-report",
    description: "Read-only rækkefølge for release-ejeren: frisk branch, bevar staged packet, commit kun reviewed packet, deploy og stopregler.",
    verifies: [
      "Releasebevis, staged packet, upstream reconciliation og owner merge-readiness samles i én ejersekvens.",
      "Sekvensen viser konkrete stopregler for branch freshness, commit, Vercel og Supabase.",
      "Rapporten skaber ingen commit, push, pull, merge, rebase, Vercel-deploy eller Supabase-deploy.",
    ],
  },
  {
    title: "Deploy-readiness review",
    status: "qa",
    path: "docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md",
    command: "npm run check:commercial-deploy-readiness-report",
    description: "Read-only go/no-go rapport for push/deploy: releasebevis, staged packet, branch, unstaged arbejde, Supabase-scope og release-ejer.",
    verifies: [
      "Releasebevis og staged packet er kontrolleret før deploybeslutning.",
      "Branch bag remote, unstaged arbejde og holdte lokale artifacts vises som HOLD i stedet for at blive skjult.",
      "Rapporten skaber ingen commit, push, pull, merge, Vercel-deploy eller Supabase-deploy.",
    ],
  },
  {
    title: "Release handoff",
    status: "qa",
    path: "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
    command: "npm run check:commercial-release-handoff-report",
    description: "Read-only overdragelse til release-ejer med commitforslag, ejerbeslutninger, Supabase-scope, rollbacknote og post-deploy røgtest.",
    verifies: [
      "Committekst og verifikationslinjer er samlet som forslag, ikke udført.",
      "Rollbacknote og post-deploy livebevis er synlige før ekstern brug.",
      "Rapporten skaber ingen commit, push, pull, merge, Vercel-deploy eller Supabase-deploy.",
    ],
  },
  {
    title: "Ændringssæt til review",
    status: "qa",
    path: "docs/COMMERCIAL_CHANGESET_LATEST.md",
    command: "npm run check:commercial-changeset-report",
    description: "Read-only oversigt over dirty worktree grupperet i review-buckets før push/deploy.",
    verifies: [
      "Dirty entries tælles og vises samlet.",
      "App-kode, Supabase, dokumentation og proof-chain grupperes separat.",
      "Review-rækkefølge og bucket-kommandoer vises før push/deploy.",
      "Første reviewpakke viser præcis hvilke proof-chain filer der bør gennemgås samlet.",
      "Staging-preview, staged-file kontrol og rollback-kommando vises uden at ændre git index.",
      "Rapporten gør branch-behind og reviewpunkter synlige uden at stage eller pushe.",
    ],
  },
];

const ownedSearchConsoleSiteUrls = [
  "https://www.webprinter.dk/",
  "https://www.salgsmapper.dk/",
  "https://www.onlinetryksager.dk/",
];

const platformPillars = [
  {
    title: "Produktflow",
    icon: PackageSearch,
    status: "qa" as Status,
    summary: "Første produkt pr. tenant skal bevises fra produktvalg til ordre.",
  },
  {
    title: "Designer og skabeloner",
    icon: Paintbrush,
    status: "qa" as Status,
    summary: "Produkt med PDF-skabelon skal åbne korrekt i designer og kunne downloades.",
  },
  {
    title: "Checkout og ordrer",
    icon: ShoppingCart,
    status: "qa" as Status,
    summary: "Pris, design/upload og ordrestatus skal være sporbare for admin.",
  },
  {
    title: "SEO og analyse",
    icon: SearchCheck,
    status: "planlagt" as Status,
    summary: "Search Console og trafikdata bør ind i SEO-systemet som read-only overblik.",
  },
  {
    title: "Supplier Bank",
    icon: Database,
    status: "blokeret" as Status,
    summary: "Banken er brugbar, men har åbne gates før den kan kaldes færdig.",
  },
  {
    title: "Platformspakke",
    icon: ShieldCheck,
    status: "planlagt" as Status,
    summary: "Demo, onboarding og print-house pitch skal bygges på beviste flows.",
  },
];

const supplierBankFacts = [
  { label: "Dækkede familier", value: "9/14", detail: "5 mangler stadig" },
  { label: "Importerede drafts", value: "9 OK / 1 fejl", detail: "1 ældre WMD target er publiceret" },
  { label: "WMD fuld draft", value: "18.800", detail: "prisrækker verificeret" },
  { label: "Åbne beslutninger", value: "2 høj", detail: "Pixart rigids og publiceret WMD duplicate" },
];

const nextActions: ActionItem[] = [
  {
    title: "Verificér Webprinter flagship-flow",
    owner: "Produkt og checkout",
    status: "qa",
    description: "Brug aluminium som første hele kunderejse: prisvalg, designer/upload, checkout og admin ordre.",
    href: "/admin/product/aluminium?force_domain=webprinter.dk",
  },
  {
    title: "Gør Salgsmapper skabelon-flow tydeligt",
    owner: "Designer og skabeloner",
    status: "qa",
    description: "Første salgsmappe skal åbne med korrekt skabelon og give kunden download af PDF-skabelon.",
    href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
  },
  {
    title: "Afklar WMD duplicate",
    owner: "Supplier Bank",
    status: "blokeret",
    description: "Det gamle WMD target er publiceret. Det kræver en eksplicit beslutning: behold, afpublicér eller arkivér.",
    href: "/admin/supplier-bank?force_domain=webprinter.dk",
  },
  {
    title: "Start SEO/Search Console cockpit",
    owner: "SEO",
    status: "planlagt",
    description: "Første version bør være read-only med domæner, redirects, indeksering, klik og visninger.",
    href: "/admin/platform-seo?force_domain=webprinter.dk",
  },
  {
    title: "Saml ordreberedskab",
    owner: "Drift",
    status: "qa",
    description: "Admin skal hurtigt se om en ordre er kladde, betalt, kræver korrektur, produktionsklar eller problem.",
    href: "/admin/kunder?force_domain=webprinter.dk",
  },
];

const commercialDecisions: CommercialDecision[] = [
  {
    title: "Bekræft Flyers som første bevisprodukt for Onlinetryksager",
    owner: "Produkt",
    status: "qa",
    impact: "Onlinetryksager har nu Flyers som sekundært proof; den skal stadig holdes ude af hovedpitch indtil ordre/admin-bevis er gennemgået.",
    decision: "Brug Flyers som første standardflow og bekræft pris, upload/checkout og adminordre før den løftes fra sekundær pilot.",
    href: "/admin/product/flyer-demand?force_domain=www.onlinetryksager.dk",
  },
  {
    title: "Afklar checkout og betalingspilot",
    owner: "Drift",
    status: "qa",
    impact: "En trykkeri-demo bliver stærkere, hvis første ordre kan følges fra pris til admin.",
    decision: "Beslut om første pilotordre køres som test, manuel betaling eller live betaling.",
    href: "/admin/indstillinger/betaling?force_domain=webprinter.dk",
  },
  {
    title: "Godkend Salgsmapper-skabelon som produktstandard",
    owner: "Designer",
    status: "qa",
    impact: "Salgsmapper skal bevise fast template, download og designer-handoff.",
    decision: "Godkend første salgsmappe-skabelon som demo- og produktionseksempel.",
    href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
  },
  {
    title: "Afklar gammel WMD-publicering",
    owner: "Supplier Bank",
    status: "blokeret",
    impact: "Det ældre WMD target er publiceret og kan forvirre demo, importstrategi og live katalog.",
    decision: "Beslut om `wmd-folder-bank-891a5cf1` skal beholdes, afpubliceres eller arkiveres.",
    href: "/admin/supplier-bank?force_domain=webprinter.dk",
  },
  {
    title: "Godkend eller udskyd Pixart rigids",
    owner: "Supplier Bank",
    status: "blokeret",
    impact: "Pixart rigids/signs må ikke skrives eller importeres uden eksplicit approval.",
    decision: "Godkend bank-only write eller hold den som åben sourcing-gate.",
    href: "/admin/supplier-bank?force_domain=webprinter.dk",
  },
  {
    title: "Definér demoens salgsfortælling",
    owner: "Ledelse",
    status: "planlagt",
    impact: "Print-house samtalen bør sælge platformen og tenant-beviserne, ikke uafsluttede importdetaljer.",
    decision: "Beslut demo-script, tilbudsmodel og hvad der ikke loves endnu.",
    href: "/admin/commercial-readiness?force_domain=webprinter.dk",
  },
];

const commercialDecisionsQueue = commercialDecisions;

function getCommercialDecisionOptionCards(
  decisions: CommercialDecision[],
): CommercialDecisionOptionCard[] {
  return decisions.map((decision) => {
    if (decision.title.includes("Onlinetryksager")) {
      return {
        ...decision,
        recommended: "Brug Flyers som simpelt sekundært proof og hold det ude af hovedpitch, indtil pris, upload/checkout og ordrevej er bevidnet i admin.",
        alternatives: [
          "Vente med Onlinetryksager og fokusere al QA på Webprinter + Salgsmapper.",
          "Skifte proof til en anden bred standardkategori, hvis Flyers ikke matcher første salgsfortælling.",
        ],
        deferCost: "Hvis Flyers ikke følges op med ordre/admin-bevis, bliver Onlinetryksager stadig kun en visuel tenant i salgsfortællingen.",
        decisionRule: "Behold Flyers som proof når det kan forklares på én linje og testes uden ny prislogik.",
      };
    }

    if (decision.title.includes("checkout")) {
      return {
        ...decision,
        recommended: "Kør første pilotordre som kontrolleret test eller manuel betaling, indtil live Stripe/checkout og drift er bevidnet.",
        alternatives: [
          "Åbne live betaling tidligt, men kun hvis Stripe, ordremail og refund/fejlvej er manuelt QA'et.",
          "Udskyde betaling og sælge første pilot som manuelt faktureret setup.",
        ],
        deferCost: "Første ordre kan ikke bruges som stærkt salgsbevis, fordi pris til betaling til admin ikke er afklaret.",
        decisionRule: "Vælg live betaling først når support, ordremail, levering og adminhåndtering kan bevidnes sammen.",
      };
    }

    if (decision.title.includes("Salgsmapper")) {
      return {
        ...decision,
        recommended: "Godkend én salgsmappe-skabelon som standardproof før flere formater eller ekstra produkttyper tilføjes.",
        alternatives: [
          "Holde Salgsmapper som demo-only, indtil flere PDF-skabeloner er lagt ind.",
          "Udvide til brevpapir/visitkort senere, efter salgsmappe-flowet er stabilt.",
        ],
        deferCost: "Salgsmapper mister sin nicheværdi, fordi template/download/designer-flowet ikke har et klart første bevis.",
        decisionRule: "Godkend når produktknappen åbner korrekt template og downloadskabelonen matcher kundens forventning.",
      };
    }

    if (decision.title.includes("WMD")) {
      return {
        ...decision,
        recommended: "Afpublicér eller arkivér det gamle WMD target, medmindre det bevidst skal bruges som historisk testprodukt.",
        alternatives: [
          "Behold det publiceret, men marker det tydeligt som bevidst valgt.",
          "Erstat det med den fulde WMD draft efter separat QA og publiceringsbeslutning.",
        ],
        deferCost: "Demo og bankstrategi bliver uklar, fordi et ældre importeret produkt kan ligne et aktivt salgbart katalogvalg.",
        decisionRule: "Behold kun publiceret hvis pris-preview, produkttekst, tenantrolle og ordrevej er godkendt.",
      };
    }

    if (decision.title.includes("Pixart")) {
      return {
        ...decision,
        recommended: "Udskyd Pixart rigids som live/bank-write, indtil bank-only write er eksplicit godkendt og kandidatrapporten er frisk.",
        alternatives: [
          "Godkend Plastic-only baseline som bank-only uden live publicering.",
          "Godkend Plastic+Plexiglass bank-only, men hold tenant/publicering lukket.",
        ],
        deferCost: "Rigids/signs kan ikke bruges som leverandørbevis i demoen, men det beskytter livekataloget mod usikre writes.",
        decisionRule: "Godkend kun når kilde, profil, prislinjer, QA-fejl og publiceringsgrænse er tydelige.",
      };
    }

    return {
      ...decision,
      recommended: "Sælg platformen med Webprinter produkt/pris, Salgsmapper template-proof, adminordre og Supplier Bank som staging.",
      alternatives: [
        "Gøre demoen mere teknisk og vise flere interne moduler, men med større risiko for at oversælge.",
        "Holde demoen kort og bruge pilotpakken som næste konkrete tilbud.",
      ],
      deferCost: "Første trykkerisamtale kan blive for teknisk og handle om uafsluttede importdetaljer i stedet for forretning.",
      decisionRule: "Vælg fortællingen når den kan siges på under to minutter uden at love uafklarede features.",
    };
  });
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={statusClassNames[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

function StatusIcon({ status }: { status: Status }) {
  const Icon = statusIcons[status];
  return <Icon className="h-4 w-4" />;
}

function ProgressLabel({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Planstatus</span>
      <span className="font-medium">{value}%</span>
    </div>
  );
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function domainVariants(domain: string) {
  const normalized = normalizeDomain(domain);
  const withoutWww = normalized.replace(/^www\./, "");
  return Array.from(new Set([normalized, withoutWww, `www.${withoutWww}`]));
}

function getTenantForceDomain(tenant: TenantPilot) {
  const match = tenant.adminPath.match(/[?&]force_domain=([^&]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return tenant.domain === "webprinter.dk" ? "webprinter.dk" : `www.${tenant.domain.replace(/^www\./, "")}`;
}

function tenantAdminLink(tenant: TenantPilot, path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}force_domain=${encodeURIComponent(getTenantForceDomain(tenant))}`;
}

function getSearchConsoleSiteUrl(tenant: TenantPilot) {
  return `https://www.${tenant.domain.replace(/^www\./, "")}/`;
}

function normalizeSearchConsoleHost(siteUrl: string) {
  if (siteUrl.startsWith("sc-domain:")) return siteUrl.replace("sc-domain:", "").replace(/^www\./, "");
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
  }
}

function findVerifiedSearchConsoleSite(
  tenant: TenantPilot,
  sites: Array<{ siteUrl: string; permissionLevel: string }>,
) {
  const tenantHost = normalizeSearchConsoleHost(getSearchConsoleSiteUrl(tenant));
  return sites.find((site) => normalizeSearchConsoleHost(site.siteUrl) === tenantHost) || null;
}

function findSearchConsoleSummary(
  siteUrl: string,
  summaries: SearchConsoleSiteSummary[] | undefined,
) {
  if (!summaries) return null;
  const wantedHost = normalizeSearchConsoleHost(siteUrl);
  return summaries.find((summary) => normalizeSearchConsoleHost(summary.siteUrl) === wantedHost) || null;
}

async function safeCount(table: string, column: string, value: string, extra?: (query: any) => any): Promise<number | null> {
  try {
    let query = (supabase.from(table as any) as any)
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    if (extra) query = extra(query);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.debug(`[CommercialReadiness] Could not count ${table}`, error);
    return null;
  }
}

const ORDER_OPERATIONS_SAMPLE_LIMIT = 500;
const SUPPORT_MESSAGE_SAMPLE_LIMIT = 500;
const DELIVERY_FULFILLMENT_SAMPLE_LIMIT = 500;

function readOrderStatusTag(note: string | null | undefined, tag: string): string | null {
  const source = String(note || "");
  const match = source.match(new RegExp(`\\[${tag}\\]\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
}

function latestTimestampFromRows(rows: any[]) {
  return rows.reduce<string | null>((latest, row) => {
    const value = row?.created_at ? String(row.created_at) : null;
    if (!value) return latest;
    if (!latest) return value;
    return new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
  }, null);
}

async function loadOrderOperationsSummary(tenantId: string) {
  const empty = {
    orderOperationsSampleCount: null,
    orderOperationsSampleLimited: false,
    orderFileReadyCount: null,
    orderProblemCount: null,
    orderReuploadCount: null,
    orderAwaitingCustomerFileCount: null,
    orderMissingFileCount: null,
  };

  try {
    const { data: orderRows, error: orderError } = await (supabase.from("orders" as any) as any)
      .select("id,status,status_note,has_problem,requires_file_reupload")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(ORDER_OPERATIONS_SAMPLE_LIMIT);

    if (orderError) throw orderError;

    const rows = Array.isArray(orderRows) ? orderRows : [];
    if (rows.length === 0) {
      return {
        ...empty,
        orderOperationsSampleCount: 0,
        orderOperationsSampleLimited: false,
        orderFileReadyCount: 0,
        orderProblemCount: 0,
        orderReuploadCount: 0,
        orderAwaitingCustomerFileCount: 0,
        orderMissingFileCount: 0,
      };
    }

    const orderIds = rows.map((order: any) => String(order.id)).filter(Boolean);
    const { data: fileRows, error: fileError } = await (supabase.from("order_files" as any) as any)
      .select("order_id")
      .in("order_id", orderIds)
      .eq("is_current", true);

    if (fileError) throw fileError;

    const orderIdsWithCurrentFiles = new Set(
      (Array.isArray(fileRows) ? fileRows : [])
        .map((file: any) => String(file.order_id || ""))
        .filter(Boolean),
    );
    const closedStatuses = new Set(["shipped", "delivered", "cancelled"]);

    let orderFileReadyCount = 0;
    let orderProblemCount = 0;
    let orderReuploadCount = 0;
    let orderAwaitingCustomerFileCount = 0;
    let orderMissingFileCount = 0;

    rows.forEach((order: any) => {
      const orderId = String(order.id || "");
      const status = String(order.status || "");
      const hasCurrentFile = orderIdsWithCurrentFiles.has(orderId);
      const hasProblem = Boolean(order.has_problem) || status === "problem";
      const requiresReupload = Boolean(order.requires_file_reupload);

      if (hasProblem) orderProblemCount += 1;
      if (requiresReupload) orderReuploadCount += 1;
      if (hasCurrentFile && !hasProblem && !requiresReupload) orderFileReadyCount += 1;

      if (!hasCurrentFile && !hasProblem && !requiresReupload && !closedStatuses.has(status)) {
        const flow = String(readOrderStatusTag(order.status_note, "PRODUKTIONSFLOW") || "").toLowerCase();
        if (flow.includes("skabelon") || flow.includes("template")) {
          orderAwaitingCustomerFileCount += 1;
        } else {
          orderMissingFileCount += 1;
        }
      }
    });

    return {
      orderOperationsSampleCount: rows.length,
      orderOperationsSampleLimited: rows.length === ORDER_OPERATIONS_SAMPLE_LIMIT,
      orderFileReadyCount,
      orderProblemCount,
      orderReuploadCount,
      orderAwaitingCustomerFileCount,
      orderMissingFileCount,
    };
  } catch (error) {
    console.debug("[CommercialReadiness] Could not load order operations summary", error);
    return empty;
  }
}

async function loadPaymentCheckoutSummary(tenantId: string) {
  const empty = {
    paymentSettingsFound: false,
    paymentProvider: null,
    paymentStatus: null,
    paymentChargesEnabled: null,
    paymentPayoutsEnabled: null,
    paymentDetailsSubmitted: null,
    paymentCurrency: null,
    paymentFeePercent: null,
    paymentFeeFlatOre: null,
    paymentUpdatedAt: null,
  };

  try {
    const { data, error } = await (supabase.from("tenant_payment_settings" as any) as any)
      .select("provider,status,charges_enabled,payouts_enabled,details_submitted,currency,platform_fee_percent,platform_fee_flat_ore,updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return empty;

    return {
      paymentSettingsFound: true,
      paymentProvider: String((data as any).provider || "stripe"),
      paymentStatus: String((data as any).status || "not_connected"),
      paymentChargesEnabled: Boolean((data as any).charges_enabled),
      paymentPayoutsEnabled: Boolean((data as any).payouts_enabled),
      paymentDetailsSubmitted: Boolean((data as any).details_submitted),
      paymentCurrency: (data as any).currency || null,
      paymentFeePercent: typeof (data as any).platform_fee_percent === "number"
        ? (data as any).platform_fee_percent
        : (data as any).platform_fee_percent !== null && (data as any).platform_fee_percent !== undefined
          ? Number((data as any).platform_fee_percent)
          : null,
      paymentFeeFlatOre: typeof (data as any).platform_fee_flat_ore === "number"
        ? (data as any).platform_fee_flat_ore
        : (data as any).platform_fee_flat_ore !== null && (data as any).platform_fee_flat_ore !== undefined
          ? Number((data as any).platform_fee_flat_ore)
          : null,
      paymentUpdatedAt: (data as any).updated_at || null,
    };
  } catch (error) {
    console.debug("[CommercialReadiness] Could not load payment checkout summary", error);
    return empty;
  }
}

async function loadSupportCustomerSummary(tenantId: string) {
  const empty = {
    supportOrderMessageCount: null,
    supportUnreadCustomerMessageCount: null,
    supportPlatformMessageCount: null,
    supportUnreadTenantMessageCount: null,
    supportLatestMessageAt: null,
  };

  try {
    const { data: orderRows, error: orderError } = await (supabase.from("orders" as any) as any)
      .select("id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(SUPPORT_MESSAGE_SAMPLE_LIMIT);

    if (orderError) throw orderError;

    const orderIds = (Array.isArray(orderRows) ? orderRows : [])
      .map((order: any) => String(order.id || ""))
      .filter(Boolean);

    const orderMessagesPromise = orderIds.length
      ? (supabase.from("order_messages" as any) as any)
        .select("id,sender_type,is_read,created_at")
        .in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null });

    const platformMessagesPromise = (supabase.from("platform_messages" as any) as any)
      .select("id,sender_role,is_read,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(SUPPORT_MESSAGE_SAMPLE_LIMIT);

    const [orderMessagesResult, platformMessagesResult] = await Promise.all([
      orderMessagesPromise,
      platformMessagesPromise,
    ]);

    if ((orderMessagesResult as any).error) throw (orderMessagesResult as any).error;
    if ((platformMessagesResult as any).error) throw (platformMessagesResult as any).error;

    const orderMessages = Array.isArray((orderMessagesResult as any).data)
      ? (orderMessagesResult as any).data
      : [];
    const platformMessages = Array.isArray((platformMessagesResult as any).data)
      ? (platformMessagesResult as any).data
      : [];
    const orderLatest = latestTimestampFromRows(orderMessages);
    const platformLatest = latestTimestampFromRows(platformMessages);
    const latestValues = [orderLatest, platformLatest].filter((value): value is string => Boolean(value));
    const supportLatestMessageAt = latestValues.length
      ? latestValues.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

    return {
      supportOrderMessageCount: orderMessages.length,
      supportUnreadCustomerMessageCount: orderMessages.filter((message: any) => message.sender_type === "customer" && !message.is_read).length,
      supportPlatformMessageCount: platformMessages.length,
      supportUnreadTenantMessageCount: platformMessages.filter((message: any) => message.sender_role === "tenant" && !message.is_read).length,
      supportLatestMessageAt,
    };
  } catch (error) {
    console.debug("[CommercialReadiness] Could not load support/customer summary", error);
    return empty;
  }
}

async function loadPlatformLeadSummary(): Promise<PlatformLeadSummary> {
  const empty: PlatformLeadSummary = {
    totalCount: null,
    unreadCount: null,
    latestAt: null,
    error: null,
  };

  try {
    const platformLeadPattern = `${PLATFORM_LEAD_PREFIX}%`;
    const totalPromise = (supabase.from("platform_messages" as any) as any)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", MASTER_TENANT_ID)
      .ilike("content", platformLeadPattern);

    const unreadPromise = (supabase.from("platform_messages" as any) as any)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("is_read", false)
      .ilike("content", platformLeadPattern);

    const latestPromise = (supabase.from("platform_messages" as any) as any)
      .select("created_at")
      .eq("tenant_id", MASTER_TENANT_ID)
      .ilike("content", platformLeadPattern)
      .order("created_at", { ascending: false })
      .limit(1);

    const [totalResult, unreadResult, latestResult] = await Promise.all([
      totalPromise,
      unreadPromise,
      latestPromise,
    ]);

    if ((totalResult as any).error) throw (totalResult as any).error;
    if ((unreadResult as any).error) throw (unreadResult as any).error;
    if ((latestResult as any).error) throw (latestResult as any).error;

    const latestRows = Array.isArray((latestResult as any).data)
      ? (latestResult as any).data
      : [];

    return {
      totalCount: typeof (totalResult as any).count === "number" ? (totalResult as any).count : 0,
      unreadCount: typeof (unreadResult as any).count === "number" ? (unreadResult as any).count : 0,
      latestAt: latestRows[0]?.created_at || null,
      error: null,
    };
  } catch (error) {
    console.debug("[CommercialReadiness] Could not load platform lead summary", error);
    return {
      ...empty,
      error: error instanceof Error ? error.message : "Kunne ikke læse platformhenvendelser.",
    };
  }
}

async function loadMailNotificationSummary(tenantId: string, rawSettings: unknown) {
  const empty = {
    notificationCustomerConfirmationsEnabled: null,
    notificationAdminNewOrdersEnabled: null,
    notificationMarketingEnabled: null,
    notificationCompanyEmail: null,
    notificationCompanyName: null,
    notificationAdminName: null,
    tenantNotificationCount: null,
    tenantUnreadNotificationCount: null,
  };

  try {
    const settings = readSettingsObject(rawSettings);
    const notifications = readSettingsObject(settings.notifications);
    const company = readSettingsObject(settings.company);
    const [tenantNotificationCount, tenantUnreadNotificationCount] = await Promise.all([
      safeCount("tenant_notifications", "tenant_id", tenantId),
      safeCount("tenant_notifications", "tenant_id", tenantId, (query) => query.eq("is_read", false)),
    ]);

    return {
      notificationCustomerConfirmationsEnabled: readBooleanSetting(notifications.order_confirmations, true),
      notificationAdminNewOrdersEnabled: readBooleanSetting(notifications.new_orders, true),
      notificationMarketingEnabled: readBooleanSetting(notifications.marketing, false),
      notificationCompanyEmail: normalizeOptionalText(company.email),
      notificationCompanyName: normalizeOptionalText(company.name),
      notificationAdminName: normalizeOptionalText(company.admin_name),
      tenantNotificationCount,
      tenantUnreadNotificationCount,
    };
  } catch (error) {
    console.debug("[CommercialReadiness] Could not load mail/notification summary", error);
    return empty;
  }
}

function loadLegalComplianceSummary(rawSettings: unknown, tenantFallbackName: string | null) {
  const settings = readSettingsObject(rawSettings);
  const company = readSettingsObject(settings.company);
  const companyName = normalizeOptionalText(company.name) || normalizeOptionalText(tenantFallbackName);
  const companyEmail = normalizeOptionalText(company.email);
  const companyPhone = normalizeOptionalText(company.phone);
  const companyAddress = normalizeOptionalText(company.address);
  const companyCvr = normalizeOptionalText(company.cvr);

  return {
    legalCompanyEmail: companyEmail,
    legalCompanyName: companyName,
    legalCompanyPhone: companyPhone,
    legalCompanyAddress: companyAddress,
    legalCompanyCvr: companyCvr,
    legalHasCompanyIdentity: Boolean(companyName),
    legalHasContactEmail: isValidEmailAddress(companyEmail),
    legalHasAddressOrCvr: Boolean(companyAddress || companyCvr),
  };
}

function readFirstProductDeliverySummary(firstProduct: any) {
  const empty = {
    firstProductOrderingType: null,
    firstProductDeliveryMode: null,
    firstProductDeliveryMethodCount: null,
    firstProductCarrierEnabled: null,
    firstProductPodDeliveryEnabled: null,
    firstProductSupplierEmail: null,
    firstProductSupplierName: null,
  };

  if (!firstProduct) return empty;

  const bannerConfig = readSettingsObject(firstProduct.banner_config);
  const orderDelivery = readSettingsObject(bannerConfig.order_delivery);
  if (Object.keys(orderDelivery).length === 0) return empty;

  const ordering = readSettingsObject(orderDelivery.ordering);
  const delivery = readSettingsObject(orderDelivery.delivery);
  const emailSettings = readSettingsObject(ordering.email_settings);
  const carrierSettings = readSettingsObject(delivery.carrier_settings);
  const podSettings = readSettingsObject(delivery.pod_settings);
  const deliveryMethods = Array.isArray(delivery.methods) ? delivery.methods : [];

  return {
    firstProductOrderingType: normalizeOptionalText(ordering.type),
    firstProductDeliveryMode: normalizeOptionalText(delivery.mode),
    firstProductDeliveryMethodCount: deliveryMethods.length,
    firstProductCarrierEnabled: typeof carrierSettings.enabled === "boolean" ? carrierSettings.enabled : null,
    firstProductPodDeliveryEnabled: typeof podSettings.enabled === "boolean" ? podSettings.enabled : null,
    firstProductSupplierEmail: normalizeOptionalText(emailSettings.supplier_email),
    firstProductSupplierName: normalizeOptionalText(ordering.supplier_name),
  };
}

async function loadDeliveryFulfillmentSummary(tenantId: string) {
  const empty = {
    deliveryOrderSampleCount: null,
    deliveryOrdersWithMethodCount: null,
    deliveryOrdersWithTrackingCount: null,
    deliveryTrackingEventCount: null,
    podShippingProfileFound: false,
    podShippingSenderMode: null,
    podShippingSenderComplete: null,
    podShippingHasLogo: null,
  };

  try {
    const [ordersResult, podProfileResult] = await Promise.all([
      (supabase.from("orders" as any) as any)
        .select("id,delivery_type,tracking_number")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(DELIVERY_FULFILLMENT_SAMPLE_LIMIT),
      (supabase.from("tenant_pod_shipping_profile" as any) as any)
        .select("sender_mode,sender_company_name,sender_contact_name,sender_email,sender_phone,sender_street,sender_house_number,sender_postcode,sender_city,sender_country,sender_vat_number,sender_logo_url")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    if ((ordersResult as any).error) throw (ordersResult as any).error;
    if ((podProfileResult as any).error && (podProfileResult as any).error.code !== "PGRST116") {
      throw (podProfileResult as any).error;
    }

    const orders = Array.isArray((ordersResult as any).data) ? (ordersResult as any).data : [];
    const orderIds = orders.map((order: any) => String(order.id || "")).filter(Boolean);
    let deliveryTrackingEventCount = 0;

    if (orderIds.length > 0) {
      const { count, error } = await (supabase.from("delivery_tracking" as any) as any)
        .select("id", { count: "exact", head: true })
        .in("order_id", orderIds);
      if (error) throw error;
      deliveryTrackingEventCount = count || 0;
    }

    const profile = (podProfileResult as any).data || null;
    const senderMode = normalizeOptionalText(profile?.sender_mode);
    const customRequiredFields = [
      profile?.sender_company_name,
      profile?.sender_street,
      profile?.sender_house_number,
      profile?.sender_postcode,
      profile?.sender_city,
      profile?.sender_country,
    ];
    const senderComplete = !profile
      ? null
      : senderMode === "custom"
        ? customRequiredFields.every((value) => Boolean(normalizeOptionalText(value)))
        : Boolean(senderMode);

    return {
      deliveryOrderSampleCount: orders.length,
      deliveryOrdersWithMethodCount: orders.filter((order: any) => Boolean(normalizeOptionalText(order.delivery_type))).length,
      deliveryOrdersWithTrackingCount: orders.filter((order: any) => Boolean(normalizeOptionalText(order.tracking_number))).length,
      deliveryTrackingEventCount,
      podShippingProfileFound: Boolean(profile),
      podShippingSenderMode: senderMode,
      podShippingSenderComplete: senderComplete,
      podShippingHasLogo: profile ? Boolean(normalizeOptionalText(profile.sender_logo_url)) : null,
    };
  } catch (error) {
    console.debug("[CommercialReadiness] Could not load delivery/fulfillment summary", error);
    return empty;
  }
}

async function loadTenantSignal(pilot: TenantPilot): Promise<TenantSignal> {
  try {
    const tenantQuery = pilot.domain === "webprinter.dk"
      ? (supabase.from("tenants" as any) as any)
        .select("id,name,domain,settings")
        .eq("id", MASTER_TENANT_ID)
        .maybeSingle()
      : (supabase.from("tenants" as any) as any)
        .select("id,name,domain,settings")
        .in("domain", domainVariants(pilot.domain))
        .maybeSingle();

    const { data: tenantRow, error: tenantError } = await tenantQuery;
    if (tenantError) throw tenantError;

    const tenantId = (tenantRow as any)?.id || null;
    if (!tenantId) {
      return {
        tenantId: null,
        tenantName: null,
        productCount: null,
        publishedProductCount: null,
        firstProductFound: false,
        firstProductPublished: false,
        firstProductPricingType: null,
        firstProductPriceRows: null,
        firstProductStorformatRows: null,
        firstProductTemplateCount: null,
        firstProductDesignerLaunchReady: false,
        firstProductOrderCount: null,
        activeTemplateCount: null,
        seoRows: null,
        orderCount: null,
        pendingOrderCount: null,
        orderOperationsSampleCount: null,
        orderOperationsSampleLimited: false,
        orderFileReadyCount: null,
        orderProblemCount: null,
        orderReuploadCount: null,
        orderAwaitingCustomerFileCount: null,
        orderMissingFileCount: null,
        paymentSettingsFound: false,
        paymentProvider: null,
        paymentStatus: null,
        paymentChargesEnabled: null,
        paymentPayoutsEnabled: null,
        paymentDetailsSubmitted: null,
        paymentCurrency: null,
        paymentFeePercent: null,
        paymentFeeFlatOre: null,
        paymentUpdatedAt: null,
        supportOrderMessageCount: null,
        supportUnreadCustomerMessageCount: null,
        supportPlatformMessageCount: null,
        supportUnreadTenantMessageCount: null,
        supportLatestMessageAt: null,
        notificationCustomerConfirmationsEnabled: null,
        notificationAdminNewOrdersEnabled: null,
        notificationMarketingEnabled: null,
        notificationCompanyEmail: null,
        notificationCompanyName: null,
        notificationAdminName: null,
        tenantNotificationCount: null,
        tenantUnreadNotificationCount: null,
        legalCompanyEmail: null,
        legalCompanyName: null,
        legalCompanyPhone: null,
        legalCompanyAddress: null,
        legalCompanyCvr: null,
        legalHasCompanyIdentity: false,
        legalHasContactEmail: false,
        legalHasAddressOrCvr: false,
        deliveryOrderSampleCount: null,
        deliveryOrdersWithMethodCount: null,
        deliveryOrdersWithTrackingCount: null,
        deliveryTrackingEventCount: null,
        podShippingProfileFound: false,
        podShippingSenderMode: null,
        podShippingSenderComplete: null,
        podShippingHasLogo: null,
        firstProductOrderingType: null,
        firstProductDeliveryMode: null,
        firstProductDeliveryMethodCount: null,
        firstProductCarrierEnabled: null,
        firstProductPodDeliveryEnabled: null,
        firstProductSupplierEmail: null,
        firstProductSupplierName: null,
        error: "Tenant blev ikke fundet på domænet.",
      };
    }

    const [
      productCount,
      publishedProductCount,
      activeTemplateCount,
      seoRows,
      orderCount,
      pendingOrderCount,
      orderOperationsSummary,
      paymentCheckoutSummary,
      supportCustomerSummary,
      mailNotificationSummary,
      deliveryFulfillmentSummary,
      firstProductResult,
    ] = await Promise.all([
      safeCount("products", "tenant_id", tenantId),
      safeCount("products", "tenant_id", tenantId, (query) => query.eq("is_published", true)),
      safeCount("designer_templates", "tenant_id", tenantId, (query) => query.eq("is_active", true)),
      safeCount("page_seo", "tenant_id", tenantId),
      safeCount("orders", "tenant_id", tenantId),
      safeCount("orders", "tenant_id", tenantId, (query) => query.eq("status", "pending")),
      loadOrderOperationsSummary(tenantId),
      loadPaymentCheckoutSummary(tenantId),
      loadSupportCustomerSummary(tenantId),
      loadMailNotificationSummary(tenantId, (tenantRow as any)?.settings),
      loadDeliveryFulfillmentSummary(tenantId),
      pilot.firstProductSlug
        ? (supabase.from("products" as any) as any)
          .select("id,slug,name,is_published,pricing_type,template_files,banner_config")
          .eq("tenant_id", tenantId)
          .eq("slug", pilot.firstProductSlug)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if ((firstProductResult as any)?.error) throw (firstProductResult as any).error;
    const firstProduct = (firstProductResult as any)?.data || null;
    const [
      genericPriceRows,
      storformatMaterialTierRows,
      storformatFinishTierRows,
      storformatProductTierRows,
      firstProductOrderCount,
    ] = firstProduct?.id
      ? await Promise.all([
        safeCount("generic_product_prices", "product_id", firstProduct.id),
        safeCount("storformat_material_price_tiers", "product_id", firstProduct.id),
        safeCount("storformat_finish_price_tiers", "product_id", firstProduct.id),
        safeCount("storformat_product_price_tiers", "product_id", firstProduct.id),
        safeCount("orders", "tenant_id", tenantId, (query) => query.ilike("product_name", `%${String(firstProduct.name || pilot.firstProduct).trim()}%`)),
      ])
      : [null, null, null, null, null];
    const storformatRowValues = [storformatMaterialTierRows, storformatFinishTierRows, storformatProductTierRows];
    const knownStorformatRows = storformatRowValues.filter((value): value is number => typeof value === "number");
    const firstProductStorformatRows = knownStorformatRows.length
      ? knownStorformatRows.reduce((sum, value) => sum + value, 0)
      : null;
    const firstProductPriceRows = firstProduct?.pricing_type === "STORFORMAT"
      ? firstProductStorformatRows
      : genericPriceRows;
    const rawProductTemplates = Array.isArray(firstProduct?.template_files)
      ? firstProduct.template_files as ProductTemplateFile[]
      : [];
    const fallbackTemplates = firstProduct
      ? getSalgsmapperFallbackTemplates({
        productId: firstProduct.id,
        productName: firstProduct.name,
        productSlug: firstProduct.slug,
      })
      : [];
    const mergedTemplates = mergeProductTemplates(rawProductTemplates, fallbackTemplates);
    const firstProductDesignerLaunch = resolveSelectedDesignerTemplateLaunch({ templates: mergedTemplates });
    const firstProductDeliverySummary = readFirstProductDeliverySummary(firstProduct);
    const legalComplianceSummary = loadLegalComplianceSummary((tenantRow as any)?.settings, (tenantRow as any)?.name || null);

    return {
      tenantId,
      tenantName: (tenantRow as any)?.name || null,
      productCount,
      publishedProductCount,
      firstProductFound: Boolean(firstProduct),
      firstProductPublished: Boolean(firstProduct?.is_published),
      firstProductPricingType: firstProduct?.pricing_type || null,
      firstProductPriceRows,
      firstProductStorformatRows,
      firstProductTemplateCount: firstProduct ? mergedTemplates.length : null,
      firstProductDesignerLaunchReady: Boolean(firstProductDesignerLaunch),
      firstProductOrderCount,
      activeTemplateCount,
      seoRows,
      orderCount,
      pendingOrderCount,
      orderOperationsSampleCount: orderOperationsSummary.orderOperationsSampleCount,
      orderOperationsSampleLimited: orderOperationsSummary.orderOperationsSampleLimited,
      orderFileReadyCount: orderOperationsSummary.orderFileReadyCount,
      orderProblemCount: orderOperationsSummary.orderProblemCount,
      orderReuploadCount: orderOperationsSummary.orderReuploadCount,
      orderAwaitingCustomerFileCount: orderOperationsSummary.orderAwaitingCustomerFileCount,
      orderMissingFileCount: orderOperationsSummary.orderMissingFileCount,
      paymentSettingsFound: paymentCheckoutSummary.paymentSettingsFound,
      paymentProvider: paymentCheckoutSummary.paymentProvider,
      paymentStatus: paymentCheckoutSummary.paymentStatus,
      paymentChargesEnabled: paymentCheckoutSummary.paymentChargesEnabled,
      paymentPayoutsEnabled: paymentCheckoutSummary.paymentPayoutsEnabled,
      paymentDetailsSubmitted: paymentCheckoutSummary.paymentDetailsSubmitted,
      paymentCurrency: paymentCheckoutSummary.paymentCurrency,
      paymentFeePercent: paymentCheckoutSummary.paymentFeePercent,
      paymentFeeFlatOre: paymentCheckoutSummary.paymentFeeFlatOre,
      paymentUpdatedAt: paymentCheckoutSummary.paymentUpdatedAt,
      supportOrderMessageCount: supportCustomerSummary.supportOrderMessageCount,
      supportUnreadCustomerMessageCount: supportCustomerSummary.supportUnreadCustomerMessageCount,
      supportPlatformMessageCount: supportCustomerSummary.supportPlatformMessageCount,
      supportUnreadTenantMessageCount: supportCustomerSummary.supportUnreadTenantMessageCount,
      supportLatestMessageAt: supportCustomerSummary.supportLatestMessageAt,
      notificationCustomerConfirmationsEnabled: mailNotificationSummary.notificationCustomerConfirmationsEnabled,
      notificationAdminNewOrdersEnabled: mailNotificationSummary.notificationAdminNewOrdersEnabled,
      notificationMarketingEnabled: mailNotificationSummary.notificationMarketingEnabled,
      notificationCompanyEmail: mailNotificationSummary.notificationCompanyEmail,
      notificationCompanyName: mailNotificationSummary.notificationCompanyName,
      notificationAdminName: mailNotificationSummary.notificationAdminName,
      tenantNotificationCount: mailNotificationSummary.tenantNotificationCount,
      tenantUnreadNotificationCount: mailNotificationSummary.tenantUnreadNotificationCount,
      legalCompanyEmail: legalComplianceSummary.legalCompanyEmail,
      legalCompanyName: legalComplianceSummary.legalCompanyName,
      legalCompanyPhone: legalComplianceSummary.legalCompanyPhone,
      legalCompanyAddress: legalComplianceSummary.legalCompanyAddress,
      legalCompanyCvr: legalComplianceSummary.legalCompanyCvr,
      legalHasCompanyIdentity: legalComplianceSummary.legalHasCompanyIdentity,
      legalHasContactEmail: legalComplianceSummary.legalHasContactEmail,
      legalHasAddressOrCvr: legalComplianceSummary.legalHasAddressOrCvr,
      deliveryOrderSampleCount: deliveryFulfillmentSummary.deliveryOrderSampleCount,
      deliveryOrdersWithMethodCount: deliveryFulfillmentSummary.deliveryOrdersWithMethodCount,
      deliveryOrdersWithTrackingCount: deliveryFulfillmentSummary.deliveryOrdersWithTrackingCount,
      deliveryTrackingEventCount: deliveryFulfillmentSummary.deliveryTrackingEventCount,
      podShippingProfileFound: deliveryFulfillmentSummary.podShippingProfileFound,
      podShippingSenderMode: deliveryFulfillmentSummary.podShippingSenderMode,
      podShippingSenderComplete: deliveryFulfillmentSummary.podShippingSenderComplete,
      podShippingHasLogo: deliveryFulfillmentSummary.podShippingHasLogo,
      firstProductOrderingType: firstProductDeliverySummary.firstProductOrderingType,
      firstProductDeliveryMode: firstProductDeliverySummary.firstProductDeliveryMode,
      firstProductDeliveryMethodCount: firstProductDeliverySummary.firstProductDeliveryMethodCount,
      firstProductCarrierEnabled: firstProductDeliverySummary.firstProductCarrierEnabled,
      firstProductPodDeliveryEnabled: firstProductDeliverySummary.firstProductPodDeliveryEnabled,
      firstProductSupplierEmail: firstProductDeliverySummary.firstProductSupplierEmail,
      firstProductSupplierName: firstProductDeliverySummary.firstProductSupplierName,
      error: null,
    };
  } catch (error) {
    console.debug("[CommercialReadiness] Could not load tenant signal", pilot.domain, error);
    return {
      tenantId: null,
      tenantName: null,
      productCount: null,
      publishedProductCount: null,
      firstProductFound: false,
      firstProductPublished: false,
      firstProductPricingType: null,
      firstProductPriceRows: null,
      firstProductStorformatRows: null,
      firstProductTemplateCount: null,
      firstProductDesignerLaunchReady: false,
      firstProductOrderCount: null,
      activeTemplateCount: null,
      seoRows: null,
      orderCount: null,
      pendingOrderCount: null,
      orderOperationsSampleCount: null,
      orderOperationsSampleLimited: false,
      orderFileReadyCount: null,
      orderProblemCount: null,
      orderReuploadCount: null,
      orderAwaitingCustomerFileCount: null,
      orderMissingFileCount: null,
      paymentSettingsFound: false,
      paymentProvider: null,
      paymentStatus: null,
      paymentChargesEnabled: null,
      paymentPayoutsEnabled: null,
      paymentDetailsSubmitted: null,
      paymentCurrency: null,
      paymentFeePercent: null,
      paymentFeeFlatOre: null,
      paymentUpdatedAt: null,
      supportOrderMessageCount: null,
      supportUnreadCustomerMessageCount: null,
      supportPlatformMessageCount: null,
      supportUnreadTenantMessageCount: null,
      supportLatestMessageAt: null,
      notificationCustomerConfirmationsEnabled: null,
      notificationAdminNewOrdersEnabled: null,
      notificationMarketingEnabled: null,
      notificationCompanyEmail: null,
      notificationCompanyName: null,
      notificationAdminName: null,
      tenantNotificationCount: null,
      tenantUnreadNotificationCount: null,
      legalCompanyEmail: null,
      legalCompanyName: null,
      legalCompanyPhone: null,
      legalCompanyAddress: null,
      legalCompanyCvr: null,
      legalHasCompanyIdentity: false,
      legalHasContactEmail: false,
      legalHasAddressOrCvr: false,
      deliveryOrderSampleCount: null,
      deliveryOrdersWithMethodCount: null,
      deliveryOrdersWithTrackingCount: null,
      deliveryTrackingEventCount: null,
      podShippingProfileFound: false,
      podShippingSenderMode: null,
      podShippingSenderComplete: null,
      podShippingHasLogo: null,
      firstProductOrderingType: null,
      firstProductDeliveryMode: null,
      firstProductDeliveryMethodCount: null,
      firstProductCarrierEnabled: null,
      firstProductPodDeliveryEnabled: null,
      firstProductSupplierEmail: null,
      firstProductSupplierName: null,
      error: error instanceof Error ? error.message : "Kunne ikke hente live signaler.",
    };
  }
}

function scoreStatus(status: Status) {
  if (status === "klar") return 100;
  if (status === "qa") return 60;
  if (status === "planlagt") return 25;
  return 0;
}

function deriveTenantReadiness(pilot: TenantPilot, signal: TenantSignal | null): TenantReadiness {
  if (!signal) {
    return {
      ...pilot,
      readiness: 25,
      status: "planlagt",
      checkpoints: [
        { label: "Tenant shell og domæne", status: "planlagt" },
        { label: "Produktkatalog", status: "planlagt" },
        { label: "Første produkt/prisflow", status: "planlagt" },
        { label: "Templates/designer", status: "planlagt" },
        { label: "Checkout og ordre", status: "planlagt" },
        { label: "SEO/analytics synlighed", status: "planlagt" },
      ],
      signal,
    };
  }

  const shellStatus: Status = signal.tenantId ? "klar" : "blokeret";
  const catalogStatus: Status =
    signal.productCount === null ? "qa" : signal.productCount > 0 ? "klar" : "planlagt";
  const firstProductStatus: Status = !pilot.firstProductSlug
    ? "planlagt"
    : !signal.firstProductFound
      ? "blokeret"
      : signal.firstProductPriceRows && signal.firstProductPriceRows > 0
        ? signal.firstProductPublished ? "klar" : "qa"
        : signal.firstProductPricingType === "STORFORMAT"
          ? "qa"
          : "blokeret";
  const templateStatus: Status = signal.firstProductDesignerLaunchReady
    ? "klar"
    : signal.firstProductTemplateCount && signal.firstProductTemplateCount > 0
      ? "qa"
      : signal.activeTemplateCount === null
        ? "qa"
        : signal.activeTemplateCount > 0 ? "qa" : "planlagt";
  const orderStatus: Status =
    signal.firstProductOrderCount && signal.firstProductOrderCount > 0
      ? "klar"
      : signal.orderCount === null ? "qa" : signal.orderCount > 0 ? "qa" : "qa";
  const seoStatus: Status =
    signal.seoRows === null ? "qa" : signal.seoRows > 0 ? "qa" : "planlagt";

  const checkpoints: Checkpoint[] = [
    { label: "Tenant shell og domæne", status: shellStatus },
    { label: "Produktkatalog", status: catalogStatus },
    { label: "Første produkt/prisflow", status: firstProductStatus },
    { label: "Skabelon/designer-overdragelse", status: templateStatus },
    { label: "Checkout/ordre-spor", status: orderStatus },
    { label: "SEO/analytics synlighed", status: seoStatus },
  ];
  const readiness = Math.round(checkpoints.reduce((sum, item) => sum + scoreStatus(item.status), 0) / checkpoints.length);
  const status: Status = checkpoints.some((item) => item.status === "blokeret")
    ? "blokeret"
    : readiness >= 85
      ? "klar"
      : checkpoints.some((item) => item.status === "qa")
        ? "qa"
        : "planlagt";

  return { ...pilot, readiness, status, checkpoints, signal };
}

function formatCount(value: number | null) {
  return value === null ? "ukendt" : new Intl.NumberFormat("da-DK").format(value);
}

function formatDateTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" })
    : "ingen endnu";
}

function formatMetric(value: number | null) {
  return value === null ? "-" : new Intl.NumberFormat("da-DK").format(Math.round(value));
}

function formatCtr(value: number | null) {
  return value === null ? "-" : `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function formatPosition(value: number | null) {
  return value === null ? "-" : new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);
}

function readBooleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readSettingsObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function normalizeOptionalText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function isValidEmailAddress(value: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function getOrderOperationsRows(readinessRows: TenantReadiness[]): OrderOperationsRow[] {
  return readinessRows.map((tenant) => {
    const signal = tenant.signal;
    const orderCount = signal?.orderCount ?? null;
    const fileReadyCount = signal?.orderFileReadyCount ?? null;
    const problemCount = signal?.orderProblemCount ?? null;
    const reuploadCount = signal?.orderReuploadCount ?? null;
    const awaitingCustomerFileCount = signal?.orderAwaitingCustomerFileCount ?? null;
    const missingFileCount = signal?.orderMissingFileCount ?? null;
    const sampledCount = signal?.orderOperationsSampleCount ?? null;
    const sampleLimited = Boolean(signal?.orderOperationsSampleLimited);
    const attentionCount = [problemCount, reuploadCount, awaitingCustomerFileCount, missingFileCount]
      .reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
    const hasReadableOrderOps = sampledCount !== null;

    const status: Status = !signal?.tenantId
      ? "blokeret"
      : orderCount === null || !hasReadableOrderOps
        ? "qa"
        : orderCount === 0
          ? "qa"
          : attentionCount > 0
            ? fileReadyCount && fileReadyCount > 0 ? "qa" : "blokeret"
            : fileReadyCount && fileReadyCount > 0
              ? "klar"
              : "qa";

    const detail = !signal?.tenantId
      ? "Tenant skal kunne læses før ordreberedskab kan vurderes."
      : orderCount === null || !hasReadableOrderOps
        ? "Cockpittet kunne ikke læse ordre- og filsignaler for tenantens drift."
        : orderCount === 0
          ? "Ingen ordrer endnu. En kontrolleret testordre eller pilotordre skal bevise driftssporet."
          : attentionCount > 0
            ? `${formatCount(attentionCount)} ordre(r) kræver opmærksomhed: problem, ny fil, manglende fil eller kundens egen skabelonfil.`
            : fileReadyCount && fileReadyCount > 0
              ? "Ordredriften har mindst én ordre med aktuel fil og ingen synlig problem-/genuploadmarkering."
              : "Der er ordrer, men ingen aktuel produktionsfil er synlig i det læste udsnit.";

    return {
      tenantName: tenant.name,
      domain: tenant.domain,
      status,
      orderCount,
      fileReadyCount,
      problemCount,
      reuploadCount,
      awaitingCustomerFileCount,
      missingFileCount,
      sampledCount,
      sampleLimited,
      detail,
      href: tenantAdminLink(tenant, "/admin/ordrer"),
    };
  });
}

function formatPaymentFee(percent: number | null, flatOre: number | null) {
  const percentLabel = percent === null || !Number.isFinite(percent)
    ? "0%"
    : `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(percent)}%`;
  const flatLabel = flatOre === null || !Number.isFinite(flatOre)
    ? "0 øre"
    : `${new Intl.NumberFormat("da-DK").format(flatOre)} øre`;

  return `${percentLabel} + ${flatLabel}`;
}

function paymentStatusLabel(status: string | null) {
  if (status === "connected") return "Aktiv";
  if (status === "pending") return "Mangler oplysninger";
  if (status === "restricted") return "Begrænset";
  if (status === "disabled") return "Deaktiveret";
  return "Ikke forbundet";
}

function getPaymentCheckoutRows(readinessRows: TenantReadiness[]): PaymentCheckoutRow[] {
  return readinessRows.map((tenant) => {
    const signal = tenant.signal;
    const connected = Boolean(
      signal?.paymentSettingsFound
      && signal.paymentStatus === "connected"
      && signal.paymentChargesEnabled
    );
    const configuredButNotLive = Boolean(
      signal?.paymentSettingsFound
      && !connected
      && signal.paymentStatus
      && signal.paymentStatus !== "not_connected"
    );
    const status: Status = !signal?.tenantId
      ? "blokeret"
      : connected
        ? "klar"
        : configuredButNotLive ? "qa" : "planlagt";
    const mode = connected
      ? "Live Stripe"
      : configuredButNotLive
        ? "Stripe under opsætning"
        : "Test/manuel beslutning";
    const detail = !signal?.tenantId
      ? "Tenant skal kunne læses før betalingsberedskab kan vurderes."
      : connected
        ? "Stripe Connect har aktiv charges-status. Bekræft stadig om pilotordren skal køres live eller som manuel/test."
        : configuredButNotLive
          ? "Stripe findes, men er ikke fuldt liveklar. Pilotordre bør holdes som test/manuel betaling indtil beslutning."
          : "Ingen live betalingsopsætning er synlig. Beslut test, manuel faktura eller Stripe før ekstern pilot.";

    return {
      tenantName: tenant.name,
      domain: tenant.domain,
      status,
      paymentStatus: paymentStatusLabel(signal?.paymentStatus || null),
      mode,
      chargesEnabled: signal?.paymentChargesEnabled ?? null,
      payoutsEnabled: signal?.paymentPayoutsEnabled ?? null,
      detailsSubmitted: signal?.paymentDetailsSubmitted ?? null,
      feeSummary: formatPaymentFee(signal?.paymentFeePercent ?? null, signal?.paymentFeeFlatOre ?? null),
      updatedAt: signal?.paymentUpdatedAt ?? null,
      detail,
      href: tenantAdminLink(tenant, "/admin/indstillinger/betaling"),
    };
  });
}

function getSupportCustomerRows(readinessRows: TenantReadiness[]): SupportCustomerRow[] {
  return readinessRows.map((tenant) => {
    const signal = tenant.signal;
    const orderMessageCount = signal?.supportOrderMessageCount ?? null;
    const unreadCustomerMessageCount = signal?.supportUnreadCustomerMessageCount ?? null;
    const platformMessageCount = signal?.supportPlatformMessageCount ?? null;
    const unreadTenantMessageCount = signal?.supportUnreadTenantMessageCount ?? null;
    const latestMessageAt = signal?.supportLatestMessageAt ?? null;
    const unreadCount = (unreadCustomerMessageCount ?? 0) + (unreadTenantMessageCount ?? 0);
    const totalMessages = (orderMessageCount ?? 0) + (platformMessageCount ?? 0);
    const readable = orderMessageCount !== null && platformMessageCount !== null;

    const status: Status = !signal?.tenantId
      ? "blokeret"
      : !readable
        ? "qa"
        : unreadCount > 0
          ? "qa"
          : totalMessages > 0
            ? "klar"
            : signal.orderCount && signal.orderCount > 0
              ? "qa"
              : "planlagt";

    const detail = !signal?.tenantId
      ? "Tenant skal kunne læses før kundedialog kan vurderes."
      : !readable
        ? "Cockpittet kunne ikke læse ordrebeskeder eller platformsupport for tenantens drift."
        : unreadCount > 0
          ? `${formatCount(unreadCount)} ulæste kunde-/tenantbesked(er) kræver svar eller gennemgang.`
          : totalMessages > 0
            ? "Kundedialogen kan læses, og der er ingen ulæste kunde-/tenantbeskeder i det læste signal."
            : signal.orderCount && signal.orderCount > 0
              ? "Tenanten har ordrer, men ingen synlig kundedialog endnu. Test beskedflowet før pilotdrift."
              : "Ingen ordre- eller supportdialog endnu. Brug den første pilotordre til at bevise kundesvar.";

    return {
      tenantName: tenant.name,
      domain: tenant.domain,
      status,
      orderMessageCount,
      unreadCustomerMessageCount,
      platformMessageCount,
      unreadTenantMessageCount,
      latestMessageAt,
      detail,
      href: tenantAdminLink(tenant, "/admin/beskeder"),
    };
  });
}

function getMailNotificationRows(readinessRows: TenantReadiness[]): MailNotificationRow[] {
  return readinessRows.map((tenant) => {
    const signal = tenant.signal;
    const customerConfirmationsEnabled = signal?.notificationCustomerConfirmationsEnabled ?? null;
    const adminNewOrdersEnabled = signal?.notificationAdminNewOrdersEnabled ?? null;
    const marketingEnabled = signal?.notificationMarketingEnabled ?? null;
    const companyEmail = signal?.notificationCompanyEmail ?? null;
    const companyName = signal?.notificationCompanyName ?? null;
    const adminName = signal?.notificationAdminName ?? null;
    const tenantNotificationCount = signal?.tenantNotificationCount ?? null;
    const tenantUnreadNotificationCount = signal?.tenantUnreadNotificationCount ?? null;
    const settingsReadable = customerConfirmationsEnabled !== null && adminNewOrdersEnabled !== null;
    const adminEmailValid = isValidEmailAddress(companyEmail);

    const status: Status = !signal?.tenantId
      ? "blokeret"
      : !settingsReadable || tenantNotificationCount === null || tenantUnreadNotificationCount === null
        ? "qa"
        : adminNewOrdersEnabled && !adminEmailValid
          ? "blokeret"
          : !customerConfirmationsEnabled && !adminNewOrdersEnabled
            ? "qa"
            : tenantUnreadNotificationCount > 0
              ? "qa"
              : "klar";

    const detail = !signal?.tenantId
      ? "Tenant skal kunne læses før mail- og notifikationsberedskab kan vurderes."
      : !settingsReadable
        ? "Cockpittet kunne ikke læse tenantens mail-/notifikationsindstillinger."
        : adminNewOrdersEnabled && !adminEmailValid
          ? "Admin ordre-mail er slået til, men tenantens firma-email mangler eller er ugyldig. Checkout vil springe adminmailen over."
          : !customerConfirmationsEnabled && !adminNewOrdersEnabled
            ? "Både kundens ordrebekræftelse og admin ordre-mail er slået fra. Det kan være bevidst, men skal besluttes før pilot."
            : tenantUnreadNotificationCount && tenantUnreadNotificationCount > 0
              ? `${formatCount(tenantUnreadNotificationCount)} interne tenant-notifikation(er) er ulæste og bør gennemgås før pilot.`
              : "Kundebekræftelser/adminmails er afklaret, og der er ingen ulæste interne tenant-notifikationer i signalet.";

    return {
      tenantName: tenant.name,
      domain: tenant.domain,
      status,
      customerConfirmationsEnabled,
      adminNewOrdersEnabled,
      marketingEnabled,
      companyEmail,
      companyName,
      adminName,
      tenantNotificationCount,
      tenantUnreadNotificationCount,
      detail,
      href: tenantAdminLink(tenant, "/admin/indstillinger"),
    };
  });
}

function deliveryModeLabel(value: string | null) {
  if (value === "manual") return "Manuel";
  if (value === "external") return "Ekstern/POD";
  if (value === "pod") return "POD";
  return value || "Ukendt";
}

function orderingTypeLabel(value: string | null) {
  if (value === "standard") return "Standard";
  if (value === "semi") return "Semi-automatiseret";
  if (value === "email") return "Email-bestilling";
  return value || "Ukendt";
}

function senderModeLabel(value: string | null) {
  if (value === "standard") return "Standard";
  if (value === "blind") return "Blind";
  if (value === "custom") return "Egen afsender";
  return value || "Ikke sat";
}

function getDeliveryFulfillmentRows(readinessRows: TenantReadiness[]): DeliveryFulfillmentRow[] {
  return readinessRows.map((tenant) => {
    const signal = tenant.signal;
    const orderSampleCount = signal?.deliveryOrderSampleCount ?? null;
    const ordersWithMethodCount = signal?.deliveryOrdersWithMethodCount ?? null;
    const ordersWithTrackingCount = signal?.deliveryOrdersWithTrackingCount ?? null;
    const trackingEventCount = signal?.deliveryTrackingEventCount ?? null;
    const podProfileFound = Boolean(signal?.podShippingProfileFound);
    const podSenderMode = signal?.podShippingSenderMode ?? null;
    const podSenderComplete = signal?.podShippingSenderComplete ?? null;
    const podHasLogo = signal?.podShippingHasLogo ?? null;
    const firstProductOrderingType = signal?.firstProductOrderingType ?? null;
    const firstProductDeliveryMode = signal?.firstProductDeliveryMode ?? null;
    const firstProductDeliveryMethodCount = signal?.firstProductDeliveryMethodCount ?? null;
    const firstProductCarrierEnabled = signal?.firstProductCarrierEnabled ?? null;
    const firstProductPodDeliveryEnabled = signal?.firstProductPodDeliveryEnabled ?? null;
    const firstProductSupplierEmail = signal?.firstProductSupplierEmail ?? null;
    const firstProductSupplierName = signal?.firstProductSupplierName ?? null;
    const readable = orderSampleCount !== null && ordersWithMethodCount !== null && trackingEventCount !== null;
    const hasFirstProduct = Boolean(signal?.firstProductFound);
    const emailOrderingMissingSupplier = firstProductOrderingType === "email" && !isValidEmailAddress(firstProductSupplierEmail);
    const explicitProductDeliveryMissing = hasFirstProduct
      && firstProductDeliveryMethodCount !== null
      && firstProductDeliveryMethodCount === 0;
    const podCustomIncomplete = podProfileFound && podSenderMode === "custom" && podSenderComplete === false;

    const status: Status = !signal?.tenantId
      ? "blokeret"
      : !readable
        ? "qa"
        : emailOrderingMissingSupplier || explicitProductDeliveryMissing || podCustomIncomplete
          ? "blokeret"
          : hasFirstProduct && firstProductDeliveryMethodCount === null
            ? "qa"
            : orderSampleCount > 0 && ordersWithMethodCount === 0
              ? "qa"
              : podProfileFound || (firstProductDeliveryMethodCount && firstProductDeliveryMethodCount > 0)
                ? "klar"
                : "qa";

    const detail = !signal?.tenantId
      ? "Tenant skal kunne læses før levering og fulfillment kan vurderes."
      : !readable
        ? "Cockpittet kunne ikke læse ordrelevering, tracking eller POD-afsenderprofil."
        : emailOrderingMissingSupplier
          ? "Produktet bruger email-bestilling, men leverandør-email mangler eller er ugyldig."
          : explicitProductDeliveryMissing
            ? "Pilotproduktet har en leveringskonfiguration uden aktive leveringsmetoder."
            : podCustomIncomplete
              ? "POD-afsenderprofilen er sat til egen afsender, men mangler påkrævede adressefelter."
              : hasFirstProduct && firstProductDeliveryMethodCount === null
                ? "Pilotproduktets levering/bestilling er ikke tydeligt konfigureret i produktets order_delivery data."
                : orderSampleCount > 0 && ordersWithMethodCount === 0
                  ? "Der findes ordrer, men ingen af de læste ordrer har synlig leveringsmetode."
                  : "Leveringsmetoder, ordrelevering og POD-afsenderprofil kan læses uden tydelig blokering.";

    return {
      tenantName: tenant.name,
      domain: tenant.domain,
      status,
      orderSampleCount,
      ordersWithMethodCount,
      ordersWithTrackingCount,
      trackingEventCount,
      podProfileFound,
      podSenderMode,
      podSenderComplete,
      podHasLogo,
      firstProductOrderingType,
      firstProductDeliveryMode,
      firstProductDeliveryMethodCount,
      firstProductCarrierEnabled,
      firstProductPodDeliveryEnabled,
      firstProductSupplierEmail,
      firstProductSupplierName,
      detail,
      href: tenant.firstProductSlug
        ? tenantAdminLink(tenant, `/admin/product/${tenant.firstProductSlug}`)
        : tenantAdminLink(tenant, "/admin/indstillinger"),
    };
  });
}

function getLegalConsentRows(readinessRows: TenantReadiness[]): LegalConsentRow[] {
  return readinessRows.map((tenant) => {
    const signal = tenant.signal;
    const companyName = signal?.legalCompanyName ?? null;
    const companyEmail = signal?.legalCompanyEmail ?? null;
    const companyPhone = signal?.legalCompanyPhone ?? null;
    const companyAddress = signal?.legalCompanyAddress ?? null;
    const companyCvr = signal?.legalCompanyCvr ?? null;
    const publicRoutesReady = true;
    const cookieConsentReady = true;
    const contactConsentReady = true;
    const termsLinkNeedsReview = false;
    const hasContactEmail = Boolean(signal?.legalHasContactEmail);
    const hasCompanyIdentity = Boolean(signal?.legalHasCompanyIdentity);
    const hasAddressOrCvr = Boolean(signal?.legalHasAddressOrCvr);

    const status: Status = !signal?.tenantId
      ? "blokeret"
      : !publicRoutesReady || !cookieConsentReady || !contactConsentReady
        ? "blokeret"
        : !hasContactEmail
          ? "blokeret"
          : !hasCompanyIdentity || !hasAddressOrCvr || termsLinkNeedsReview
            ? "qa"
            : "klar";

    const detail = !signal?.tenantId
      ? "Tenant skal kunne læses før jura, cookie og kontakt kan vurderes."
      : !hasContactEmail
        ? "Tenantens firma-email mangler eller er ugyldig. Kontakt, privatlivspolitik og ordre-mail bør ikke bruges i pilot før den er udfyldt."
        : !hasCompanyIdentity
            ? "Tenanten mangler tydeligt firmanavn i settings.company."
          : !hasAddressOrCvr
            ? "Tenanten har kontakt-email, men mangler CVR eller adresse i offentlig juridisk identitet."
            : termsLinkNeedsReview
              ? "Cookie-banner og offentlige sider findes, men cookieindstillingernes vilkårslink bør gennemgås."
              : "Cookie-samtykke, kontaktformular og juridiske tenant-sider kan læses uden tydelig blokering.";

    return {
      tenantName: tenant.name,
      domain: tenant.domain,
      status,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      companyCvr,
      publicRoutesReady,
      cookieConsentReady,
      contactConsentReady,
      termsLinkNeedsReview,
      detail,
      href: tenantAdminLink(tenant, "/admin/indstillinger"),
    };
  });
}

function getPlatformLeadReadiness(
  platformLeadSummary: PlatformLeadSummary,
  loadingPlatformLeadSummary: boolean,
): PlatformLeadReadinessItem[] {
  const platformLeadCount = platformLeadSummary.totalCount ?? 0;
  const unreadLeadCount = platformLeadSummary.unreadCount ?? 0;
  const leadLogStatus: Status = loadingPlatformLeadSummary
    ? "qa"
    : platformLeadSummary.error ? "blokeret" : platformLeadCount > 0 ? "klar" : "qa";
  const leadLogProof = loadingPlatformLeadSummary
    ? "Tjekker platformhenvendelses-loggen i master-beskeder."
    : platformLeadSummary.error
      ? `Kunne ikke læse platformhenvendelses-loggen: ${platformLeadSummary.error}`
      : platformLeadCount > 0
        ? `${formatCount(platformLeadCount)} platformhenvendelser ligger i master-beskeder, ${formatCount(unreadLeadCount)} er ulæste. Seneste: ${formatDateTime(platformLeadSummary.latestAt)}.`
        : "Leadloggen kan læses, men der er endnu ingen kontrolleret platformhenvendelse i master-beskeder.";

  return [
    {
      title: "Offentlig platformformular",
      status: "klar",
      signal: "Formular",
      proof: "Platformens kontaktside har navn, e-mail, virksomhed, besked og krævet samtykke før afsendelse.",
      next: "Send en intern testhenvendelse før første eksterne trykkerisamtale.",
      href: "/kontakt?force_domain=webprinter.dk",
    },
    {
      title: "Privatlivslink i samtykke",
      status: "klar",
      signal: "Jura",
      proof: "Samtykketeksten linker til platformens privatlivspolitik og bevarer webprinter.dk-kontekst på localhost.",
      next: "Gennemlæs privatlivsteksten som del af den offentlige platformgennemgang.",
      href: "/privacy-policy?force_domain=webprinter.dk",
    },
    {
      title: "Mail-handoff for henvendelser",
      status: "qa",
      signal: "Edge function",
      proof: platformLeadCount > 0
        ? `Kontaktfunktionen validerer navn, e-mail og besked, rate-limiter, sender via Resend og cockpittet finder ${formatCount(platformLeadCount)} loggede platformhenvendelser.`
        : "Kontaktfunktionen validerer navn, e-mail og besked, rate-limiter, sender via Resend og gemmer platformhenvendelsen som ulæst master-besked.",
      next: "Bekræft med en kontrolleret test at både indbakken og adminbeskeden modtager henvendelsen.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#platform-lead-readiness",
    },
    {
      title: "Lead-opfølgning i admin",
      status: leadLogStatus,
      signal: "Drift",
      proof: leadLogProof,
      next: platformLeadCount > 0
        ? "Brug leadloggen som adminbevis, og lav stadig en kontrolleret indbakke-test før eksternt salg."
        : "Send en kontrolleret testhenvendelse fra kontaktsiden, så log, indbakke og adminvisning kan godkendes samlet.",
      href: PLATFORM_LEAD_THREAD_ADMIN_PATH,
    },
  ];
}

function describePriceHealth(signal: TenantSignal | null) {
  if (!signal?.firstProductFound) return "Produkt ikke fundet";
  if (signal.firstProductPriceRows === null) return "Prisrækker ukendt";
  if (signal.firstProductPriceRows === 0) return "Ingen prisrækker";
  return `${formatCount(signal.firstProductPriceRows)} prisrækker`;
}

function getSeoVisibilityRows(
  readinessRows: TenantReadiness[],
  verifiedSites: Array<{ siteUrl: string; permissionLevel: string }>,
  siteOverview: SearchConsoleSiteSummary[] | undefined,
  searchConsoleConnected: boolean,
): SeoVisibilityRow[] {
  return readinessRows.map((tenant) => {
    const siteUrl = getSearchConsoleSiteUrl(tenant);
    const verifiedSite = findVerifiedSearchConsoleSite(tenant, verifiedSites);
    const summary = findSearchConsoleSummary(verifiedSite?.siteUrl || siteUrl, siteOverview);
    const hasSeoRows = Boolean(tenant.signal?.seoRows && tenant.signal.seoRows > 0);
    const hasSearchData = Boolean(summary && (summary.clicks > 0 || summary.impressions > 0));
    const status: Status = !tenant.signal?.tenantId
      ? "blokeret"
      : hasSeoRows && hasSearchData
        ? "klar"
        : hasSeoRows || verifiedSite
          ? "qa"
          : searchConsoleConnected
            ? "qa"
            : "planlagt";
    const searchConsoleState = !searchConsoleConnected
      ? "Ikke forbundet"
      : verifiedSite
        ? `Verificeret (${verifiedSite.permissionLevel})`
        : "Mangler verificeret site";
    const detail = !tenant.signal?.tenantId
      ? "Tenant/domæne skal kunne læses før SEO-beviset kan bruges."
      : hasSeoRows && hasSearchData
        ? "SEO-rækker og Search Console-trafik er synlige i read-only overblik."
        : hasSeoRows && verifiedSite
          ? "SEO-rækker og verificeret site findes. Afvent eller hent Search Console-data."
          : hasSeoRows
            ? "SEO-rækker findes, men Search Console-site skal forbindes/verificeres."
            : searchConsoleConnected
              ? "Search Console er forbundet, men tenantens SEO-rækker skal oprettes eller tilknyttes."
              : "Forbind Search Console og opret/tilknyt SEO-rækker for tenantens sider.";

    return {
      tenantName: tenant.name,
      domain: tenant.domain,
      status,
      seoRows: tenant.signal?.seoRows ?? null,
      siteUrl: verifiedSite?.siteUrl || siteUrl,
      searchConsoleState,
      clicks: summary?.clicks ?? null,
      impressions: summary?.impressions ?? null,
      ctr: summary?.ctr ?? null,
      position: summary?.position ?? null,
      detail,
      href: tenantAdminLink(tenant, "/admin/platform-seo"),
    };
  });
}

function describeDesignerHealth(signal: TenantSignal | null) {
  if (!signal?.firstProductFound) return "Ingen produktkontekst";
  if (signal.firstProductDesignerLaunchReady) return "Designer-launch klar";
  if (signal.firstProductTemplateCount && signal.firstProductTemplateCount > 0) {
    const templateLabel = signal.firstProductTemplateCount === 1 ? "skabelon" : "skabeloner";
    return `${formatCount(signal.firstProductTemplateCount)} ${templateLabel}, start kræver QA`;
  }
  return "Ingen produktskabelon";
}

function getTenantFlowIssues(tenant: TenantReadiness): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const signal = tenant.signal;
  const adminHref = tenant.adminPath;

  if (!signal) {
    return [{
      tenantName: tenant.name,
      title: "Live signaler mangler",
      status: "planlagt",
      detail: "Cockpittet afventer tenant-, produkt-, skabelon-, SEO- og ordredata.",
      href: adminHref,
    }];
  }

  if (signal.error || !signal.tenantId) {
    issues.push({
      tenantName: tenant.name,
      title: "Tenant/domæne skal afklares",
      status: "blokeret",
      detail: signal.error || "Tenant kunne ikke slås op ud fra domænet.",
      href: tenantAdminLink(tenant, "/admin/tenants"),
    });
    return issues;
  }

  if (!tenant.firstProductSlug) {
    issues.push({
      tenantName: tenant.name,
      title: "Vælg første bevisprodukt",
      status: "planlagt",
      detail: "Der er endnu ikke valgt et konkret produkt til hele produkt-, designer/upload- og checkout-flowet.",
      href: tenant.adminPath,
    });
  } else if (!signal.firstProductFound) {
    issues.push({
      tenantName: tenant.name,
      title: "Første bevisprodukt mangler",
      status: "blokeret",
      detail: `Produktet med slug '${tenant.firstProductSlug}' blev ikke fundet for denne tenant.`,
      href: tenantAdminLink(tenant, "/admin/products"),
    });
  } else {
    if (!signal.firstProductPublished) {
      issues.push({
        tenantName: tenant.name,
        title: "Bevisprodukt er ikke publiceret",
        status: "qa",
        detail: "Produktflowet kan ikke bevises offentligt før publiceringsstatus er besluttet.",
        href: adminHref,
      });
    }

    if (signal.firstProductPriceRows === null) {
      issues.push({
        tenantName: tenant.name,
        title: "Pris-preview kan ikke verificeres",
        status: "qa",
        detail: "Cockpittet kunne ikke tælle prisrækker for bevisproduktet.",
        href: adminHref,
      });
    } else if (signal.firstProductPriceRows === 0) {
      issues.push({
        tenantName: tenant.name,
        title: "Pris-preview mangler rækker",
        status: "blokeret",
        detail: "Bevisproduktet har 0 verificerede prisrækker i den forventede prisstruktur.",
        href: adminHref,
      });
    }

    if (!signal.firstProductDesignerLaunchReady) {
      issues.push({
        tenantName: tenant.name,
        title: tenant.domain.includes("salgsmapper") ? "Designer-skabelon mangler" : "Designer-overdragelse kræver QA",
        status: tenant.domain.includes("salgsmapper") ? "blokeret" : "qa",
        detail: signal.firstProductTemplateCount && signal.firstProductTemplateCount > 0
          ? "Produktet har skabelondata, men cockpittet kan ikke bevise en klar designer-start."
          : "Produktet har ikke en produktbestemt designer-skabelon klar til start.",
        href: tenant.domain.includes("salgsmapper")
          ? tenantAdminLink(tenant, "/admin/designer-templates")
          : adminHref,
      });
    }
  }

  if (signal.orderCount === 0) {
    issues.push({
      tenantName: tenant.name,
      title: "Ingen ordrebevis endnu",
      status: "qa",
      detail: "Der findes ingen ordrer for tenantens flow. En testordre eller pilotordre skal bevise checkout/admin-sporet.",
      href: tenantAdminLink(tenant, "/admin/kunder"),
    });
  } else if (signal.firstProductOrderCount === 0 && tenant.firstProductSlug) {
    issues.push({
      tenantName: tenant.name,
      title: "Ingen ordre på bevisproduktet",
      status: "qa",
      detail: "Tenanten har ordrer, men cockpittet fandt ikke et ordre-spor for det valgte bevisprodukt.",
      href: tenantAdminLink(tenant, "/admin/kunder"),
    });
  }

  if (signal.seoRows === 0) {
    issues.push({
      tenantName: tenant.name,
      title: "SEO-rækker mangler",
      status: "planlagt",
      detail: "Der er ingen SEO-rækker registreret for tenantens sider/produkter i cockpittets read-only check.",
      href: tenantAdminLink(tenant, "/admin/platform-seo"),
    });
  }

  return issues;
}

function getTenantProofSteps(tenant: TenantReadiness): ProofStep[] {
  const signal = tenant.signal;
  const productHref = tenant.firstProductSlug ? tenant.adminPath : tenantAdminLink(tenant, "/admin/products");
  const designerHref = tenant.domain.includes("salgsmapper")
    ? tenantAdminLink(tenant, "/admin/designer-templates")
    : productHref;
  const orderHref = tenantAdminLink(tenant, "/admin/kunder");
  const seoHref = tenantAdminLink(tenant, "/admin/platform-seo");

  if (!signal) {
    return [
      {
        label: "1. Produkt og domæne",
        status: "planlagt",
        detail: "Afventer live signaler fra tenant, produktkatalog og domæne.",
        href: productHref,
      },
      {
        label: "2. Pris-preview",
        status: "planlagt",
        detail: "Afventer live prisdata for første bevisprodukt.",
        href: productHref,
      },
      {
        label: "3. Designer og skabelon",
        status: "planlagt",
        detail: "Afventer designer- og skabelonsignaler.",
        href: designerHref,
      },
      {
        label: "4. Checkout og ordre",
        status: "planlagt",
        detail: "Afventer ordre- og checkoutsignaler.",
        href: orderHref,
      },
      {
        label: "5. SEO synlighed",
        status: "planlagt",
        detail: "Afventer SEO-rækker og senere Search Console signaler.",
        href: seoHref,
      },
    ];
  }

  const tenantBlocked = signal.error || !signal.tenantId;
  const productStatus: Status = tenantBlocked
    ? "blokeret"
    : !tenant.firstProductSlug
      ? "planlagt"
      : !signal.firstProductFound
        ? "blokeret"
        : signal.firstProductPublished ? "klar" : "qa";
  const priceStatus: Status = tenantBlocked
    ? "blokeret"
    : !tenant.firstProductSlug
      ? "planlagt"
      : !signal.firstProductFound
        ? "blokeret"
        : signal.firstProductPriceRows === null
          ? "qa"
          : signal.firstProductPriceRows > 0 ? "klar" : "blokeret";
  const designerStatus: Status = tenantBlocked
    ? "blokeret"
    : !tenant.firstProductSlug || !signal.firstProductFound
      ? productStatus
      : signal.firstProductDesignerLaunchReady
        ? "klar"
        : signal.firstProductTemplateCount && signal.firstProductTemplateCount > 0
          ? "qa"
          : tenant.domain.includes("salgsmapper") ? "blokeret" : "qa";
  const orderStatus: Status = tenantBlocked
    ? "blokeret"
    : signal.firstProductOrderCount && signal.firstProductOrderCount > 0
      ? "klar"
      : "qa";
  const seoStatus: Status = tenantBlocked
    ? "blokeret"
    : signal.seoRows === null
      ? "qa"
      : signal.seoRows > 0 ? "qa" : "planlagt";

  return [
    {
      label: "1. Produkt og domæne",
      status: productStatus,
      detail: tenantBlocked
        ? signal.error || "Tenant/domæne kunne ikke verificeres."
        : !tenant.firstProductSlug
          ? "Vælg et konkret første bevisprodukt for denne tenant."
          : signal.firstProductFound
            ? signal.firstProductPublished
              ? `${tenant.firstProduct} er fundet og publiceret.`
              : `${tenant.firstProduct} er fundet, men publicering kræver beslutning.`
            : `${tenant.firstProduct} blev ikke fundet på tenantens produktkatalog.`,
      href: productHref,
    },
    {
      label: "2. Pris-preview",
      status: priceStatus,
      detail: signal.firstProductFound
        ? `${describePriceHealth(signal)} for første bevisprodukt.`
        : "Pris-preview kan først bevises når produktet er valgt og fundet.",
      href: productHref,
    },
    {
      label: "3. Designer og skabelon",
      status: designerStatus,
      detail: describeDesignerHealth(signal),
      href: designerHref,
    },
    {
      label: "4. Checkout og ordre",
      status: orderStatus,
      detail: signal.firstProductOrderCount && signal.firstProductOrderCount > 0
        ? `${formatCount(signal.firstProductOrderCount)} ordre-spor fundet for bevisproduktet.`
        : signal.orderCount && signal.orderCount > 0
          ? `${formatCount(signal.orderCount)} tenant-ordrer fundet, men bevisproduktet mangler eget ordre-spor.`
          : "Lav en kontrolleret testordre/pilotordre for at bevise checkout og admin-sporet.",
      href: orderHref,
    },
    {
      label: "5. SEO synlighed",
      status: seoStatus,
      detail: signal.seoRows && signal.seoRows > 0
        ? `${formatCount(signal.seoRows)} SEO-rækker fundet. Search Console signaler er næste read-only lag.`
        : "SEO-rækker eller Search Console signaler mangler i cockpittet.",
      href: seoHref,
    },
  ];
}

function getTenantEvidenceItems(tenant: TenantReadiness): EvidenceItem[] {
  const signal = tenant.signal;
  const tenantBlocked = !signal || signal.error || !signal.tenantId;
  const hasProofProduct = Boolean(tenant.firstProductSlug && signal?.firstProductFound);
  const hasPriceRows = Boolean(signal?.firstProductPriceRows && signal.firstProductPriceRows > 0);
  const hasDesignerLaunch = Boolean(signal?.firstProductDesignerLaunchReady);
  const hasProductOrder = Boolean(signal?.firstProductOrderCount && signal.firstProductOrderCount > 0);
  const hasTenantOrders = Boolean(signal?.orderCount && signal.orderCount > 0);
  const hasSeoRows = Boolean(signal?.seoRows && signal.seoRows > 0);

  return [
    {
      label: "Offentlig produktside",
      status: tenantBlocked
        ? "blokeret"
        : !tenant.firstProductSlug
          ? "planlagt"
          : hasProofProduct && signal?.firstProductPublished ? "klar" : "qa",
      proof: hasProofProduct && signal?.firstProductPublished
        ? "Produktet er fundet og publiceret for tenantens domæne."
        : "Produktet skal kunne åbnes offentligt på tenantens domæne.",
      missing: tenantBlocked
        ? "Tenant/domæne skal først kunne læses."
        : !tenant.firstProductSlug
          ? "Vælg første bevisprodukt."
          : hasProofProduct
            ? "Beslut publicering og gennemgå produktsiden."
            : "Produkt-slug mangler eller peger ikke på et eksisterende produkt.",
    },
    {
      label: "Pris-preview",
      status: tenantBlocked
        ? "blokeret"
        : !hasProofProduct
          ? "blokeret"
          : hasPriceRows ? "klar" : "blokeret",
      proof: hasPriceRows
        ? `${formatCount(signal?.firstProductPriceRows ?? null)} prisrækker er fundet for bevisproduktet.`
        : "Pris-preview skal vise reelle rækker for første bevisprodukt.",
      missing: hasProofProduct
        ? "Prisrækker eller pris-preview skal verificeres."
        : "Produktet skal findes før pris-preview kan bevises.",
    },
    {
      label: "Designer/skabelon",
      status: tenantBlocked
        ? "blokeret"
        : !hasProofProduct
          ? "blokeret"
          : hasDesignerLaunch ? "klar" : tenant.domain.includes("salgsmapper") ? "blokeret" : "qa",
      proof: hasDesignerLaunch
        ? "Designer-start kan udledes fra produktets skabelondata."
        : "Designer eller upload skal åbne med den korrekte produktkontekst.",
      missing: tenant.domain.includes("salgsmapper")
        ? "Produktbestemt salgsmappe-skabelon skal være klar."
        : "Bekræft designer/upload-overdragelsen for produktet.",
    },
    {
      label: "Checkout og ordre",
      status: tenantBlocked
        ? "blokeret"
        : hasProductOrder ? "klar" : hasTenantOrders ? "qa" : "qa",
      proof: hasProductOrder
        ? `${formatCount(signal?.firstProductOrderCount ?? null)} ordre-spor er fundet for bevisproduktet.`
        : hasTenantOrders
          ? "Tenanten har ordrer, men bevisproduktet mangler eget ordre-spor."
          : "En kontrolleret testordre eller pilotordre skal bevise checkout/admin-sporet.",
      missing: hasProductOrder
        ? "Ingen kritisk ordre-mangel for bevisproduktet i read-only signalerne."
        : "Lav og gennemgå en kontrolleret ordre fra kundeside til admin.",
    },
    {
      label: "SEO synlighed",
      status: tenantBlocked
        ? "blokeret"
        : hasSeoRows ? "qa" : "planlagt",
      proof: hasSeoRows
        ? `${formatCount(signal?.seoRows ?? null)} SEO-rækker er fundet.`
        : "SEO-rækker og Search Console signaler skal kunne ses read-only.",
      missing: hasSeoRows
        ? "Tilføj Search Console klik/visninger som næste dokumentation."
        : "Opret/tilknyt SEO-rækker og senere Search Console signaler.",
    },
  ];
}

function getEvidenceActionHref(tenant: TenantReadiness, label: string) {
  if (label === "Designer/skabelon" && tenant.domain.includes("salgsmapper")) {
    return tenantAdminLink(tenant, "/admin/designer-templates");
  }
  if (label === "Checkout og ordre") return tenantAdminLink(tenant, "/admin/kunder");
  if (label === "SEO synlighed") return tenantAdminLink(tenant, "/admin/platform-seo");
  if (!tenant.firstProductSlug) return tenantAdminLink(tenant, "/admin/products");
  return tenant.adminPath;
}

function getEvidenceActionTitle(label: string) {
  if (label === "Offentlig produktside") return "Gennemgå offentlig produktside";
  if (label === "Pris-preview") return "Få pris-preview bevist";
  if (label === "Designer/skabelon") return "Verificér designer/skabelon";
  if (label === "Checkout og ordre") return "Lav kontrolleret ordretest";
  if (label === "SEO synlighed") return "Dokumentér SEO-synlighed";
  return "Gennemgå næste bevis";
}

function getTenantExecutiveAction(tenant: TenantReadiness, evidence: EvidenceItem[]): ExecutiveAction {
  const signal = tenant.signal;

  if (!signal || signal.error || !signal.tenantId) {
    return {
      tenantName: tenant.name,
      status: "blokeret",
      title: "Afklar tenant/domæne",
      summary: signal?.error || "Cockpittet kan ikke læse tenantens live signaler endnu.",
      href: tenantAdminLink(tenant, "/admin/tenants"),
      cta: "Åbn tenants",
    };
  }

  const nextEvidence = evidence.find((item) => item.status === "blokeret")
    || evidence.find((item) => item.status === "qa")
    || evidence.find((item) => item.status === "planlagt");

  if (!nextEvidence) {
    return {
      tenantName: tenant.name,
      status: "klar",
      title: "Klar til ledelsesgennemgang",
      summary: "Alle aktuelle beviser er fundet i cockpittets read-only signaler.",
      href: tenant.storefrontPath,
      cta: "Åbn storefront",
    };
  }

  return {
    tenantName: tenant.name,
    status: nextEvidence.status,
    title: getEvidenceActionTitle(nextEvidence.label),
    summary: nextEvidence.missing,
    href: getEvidenceActionHref(tenant, nextEvidence.label),
    cta: "Åbn næste trin",
  };
}

function getCommercialDemoGates(
  readinessRows: TenantReadiness[],
  evidenceRows: Array<{ tenant: TenantReadiness; evidence: EvidenceItem[] }>,
  blockerCount: number,
): CommercialGate[] {
  const allEvidence = evidenceRows.flatMap((row) => row.evidence);
  const readyEvidence = allEvidence.filter((item) => item.status === "klar").length;
  const evidenceBlockers = allEvidence.filter((item) => item.status === "blokeret").length;
  const orderEvidence = allEvidence.filter((item) => item.label === "Checkout og ordre");
  const readyOrderEvidence = orderEvidence.filter((item) => item.status === "klar").length;
  const seoEvidence = allEvidence.filter((item) => item.label === "SEO synlighed");
  const seoHasRows = seoEvidence.some((item) => item.status !== "planlagt" && item.status !== "blokeret");
  const completeFlows = readinessRows.filter((tenant) => tenant.status === "klar").length;

  return [
    {
      title: "Tenantbeviser",
      status: completeFlows === readinessRows.length
        ? "klar"
        : blockerCount > 0 ? "blokeret" : "qa",
      metric: `${completeFlows}/${readinessRows.length}`,
      summary: "Hver ejet tenant skal have et konkret produktflow før den bruges i en trykkeri-demo.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
    {
      title: "Pris, designer og ordre",
      status: evidenceBlockers > 0 ? "blokeret" : readyEvidence === allEvidence.length ? "klar" : "qa",
      metric: `${readyEvidence}/${allEvidence.length}`,
      summary: "Demoen skal kunne vise pris-preview, designer/upload og ordrebevis uden forklaring ved siden af.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
    {
      title: "Ordreberedskab",
      status: readyOrderEvidence === readinessRows.length ? "klar" : "qa",
      metric: `${readyOrderEvidence}/${readinessRows.length}`,
      summary: "Mindst én kontrolleret ordre pr. pilot bør være gennemgået fra kundeside til admin.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "SEO og synlighed",
      status: seoHasRows ? "qa" : "planlagt",
      metric: seoHasRows ? "SEO fundet" : "Mangler signal",
      summary: "SEO-rækker findes delvist, men Search Console klik/visninger bør ind som read-only bevis.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "Supplier Bank risici",
      status: "blokeret",
      metric: "9/14",
      summary: "Banken er nyttig som sourcingmotor, men åbne Pixart/WMD-gates skal holdes ude af kundedemoen.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "Demo- og salgspakke",
      status: completeFlows > 0 && evidenceBlockers === 0 ? "qa" : "planlagt",
      metric: "Næste fase",
      summary: "Når pilotflowet er bevist, bør næste lag være demo-script, onboarding og print-house pitch.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
  ];
}

function getTenantByDomain(readinessRows: TenantReadiness[], domain: string) {
  return readinessRows.find((tenant) => tenant.domain === domain);
}

function getPrintHouseDemoRunbook(
  readinessRows: TenantReadiness[],
  commercialGates: CommercialGate[],
): DemoRunbookStep[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const onlinetryksager = getTenantByDomain(readinessRows, "onlinetryksager.dk");
  const hasGateBlockers = commercialGates.some((gate) => gate.status === "blokeret");
  const webprinterPriceReady = Boolean(webprinter?.signal?.firstProductFound && webprinter.signal.firstProductPriceRows && webprinter.signal.firstProductPriceRows > 0);
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const anyOrderProof = readinessRows.some((tenant) => tenant.signal?.firstProductOrderCount && tenant.signal.firstProductOrderCount > 0);

  return [
    {
      title: "1. Start med Webprinter som platform",
      status: webprinter?.signal?.tenantId ? "qa" : "blokeret",
      duration: "2 min",
      description: "Vis mastertenantens storefront og forklar at samme motor kan drive flere trykkeri- eller niche-sites.",
      href: webprinter?.storefrontPath || "/?force_domain=webprinter.dk",
    },
    {
      title: "2. Vis produkt og pris-preview",
      status: webprinterPriceReady ? "klar" : "blokeret",
      duration: "3 min",
      description: "Åbn første bevisprodukt og vis at kunden kan vælge format/antal og få pris uden manuel beregning.",
      href: webprinter?.storefrontPath || "/produkt/aluminium?force_domain=webprinter.dk",
    },
    {
      title: "3. Vis Salgsmapper som niche-proof",
      status: salgsmapperTemplateReady ? "klar" : "blokeret",
      duration: "3 min",
      description: "Brug Salgsmapper til at vise produktbestemt skabelon, download og designer-handoff for et fast printprodukt.",
      href: salgsmapper?.storefrontPath || "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    },
    {
      title: "4. Vis admin og ordreberedskab",
      status: anyOrderProof ? "klar" : "qa",
      duration: "3 min",
      description: "Vis hvor ordrer, kunder og næste produktionstrin samles. En kontrolleret testordre bør være klar før salgsdemo.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "5. Vis sourcing uden at love automatik",
      status: "qa",
      duration: "2 min",
      description: "Åbn Supplier Bank som staging- og inspirationsbank. Forklar tydeligt at imports og publicering er approval-gated.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "6. Afslut med gates og næste beslutning",
      status: hasGateBlockers ? "qa" : "klar",
      duration: "2 min",
      description: "Brug Trykkeri-demo gate og Ledelsesblik til at vise hvad der er bevist, hvad der mangler, og hvad næste beslutning er.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
    {
      title: "7. Hold Onlinetryksager som sekundær pilot",
      status: onlinetryksager?.firstProductSlug ? "qa" : "planlagt",
      duration: "1 min",
      description: onlinetryksager?.firstProductSlug
        ? `Nævn Onlinetryksager som næste generelle print-tenant med ${onlinetryksager.firstProduct} som sekundært proof, men lad den ikke bære hoveddemoen endnu.`
        : "Nævn Onlinetryksager som næste generelle print-tenant, men lad den ikke bære hoveddemoen før første produkt er valgt.",
      href: onlinetryksager?.adminPath || "/admin/products?force_domain=www.onlinetryksager.dk",
    },
  ];
}

function getFirstPilotOrderPlan(readinessRows: TenantReadiness[]): PilotOrderStep[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const signal = webprinter?.signal;
  const productReady = Boolean(signal?.tenantId && signal.firstProductFound && signal.firstProductPublished);
  const productExists = Boolean(signal?.tenantId && signal.firstProductFound);
  const priceReady = Boolean(
    signal?.firstProductFound
    && typeof signal.firstProductPriceRows === "number"
    && signal.firstProductPriceRows > 0,
  );
  const designerReady = Boolean(signal?.firstProductDesignerLaunchReady);
  const firstProductOrderReady = Boolean(signal?.firstProductOrderCount && signal.firstProductOrderCount > 0);
  const tenantHasOrders = Boolean(signal?.orderCount && signal.orderCount > 0);
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);

  return [
    {
      title: "1. Fastlås Webprinter pilotprodukt",
      owner: "Produkt",
      status: productReady ? "klar" : productExists ? "qa" : "blokeret",
      proof: productReady
        ? `${webprinter?.firstProduct || "Pilotproduktet"} er fundet og publiceret.`
        : productExists
          ? "Pilotproduktet findes, men publicering eller endelig produktstatus kræver QA."
          : "Webprinter skal have et fundet og publiceret pilotprodukt før første pilotordre.",
      next: productReady ? "Brug produktet som første ende-til-ende bevis." : "Gennemgå produktet og publiceringsstatus.",
      href: webprinter?.adminPath || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "2. Bevis pris før checkout",
      owner: "Pris og produkt",
      status: priceReady ? "klar" : productExists ? "blokeret" : "blokeret",
      proof: priceReady
        ? `${formatCount(signal?.firstProductPriceRows ?? null)} prisrækker er klar til preview.`
        : "Pris-preview skal vise reelle rækker før produktet bruges som pilotordre.",
      next: priceReady ? "Åbn produktet og verificér den viste kunderejse." : "Ret eller tilknyt prisrækker for pilotproduktet.",
      href: webprinter?.adminPath || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "3. Bevis designer eller upload-handoff",
      owner: "Designer",
      status: designerReady ? "klar" : productExists ? "qa" : "blokeret",
      proof: designerReady
        ? "Designer-start kan udledes fra produktets skabelondata."
        : "Designer/upload skal åbne med korrekt produktkontekst før pilotordren er demo-sikker.",
      next: designerReady ? "Brug handoffet som en del af pilotordren." : "Gennemgå designer/upload knappen på pilotproduktet.",
      href: webprinter?.adminPath || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "4. Beslut betalingsform for pilot",
      owner: "Drift",
      status: "qa",
      proof: "Betalingsformen er en forretningsbeslutning: test, manuel betaling eller live betaling.",
      next: "Vælg betalingsform før en ordre bruges som salgsbevis.",
      href: "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
    {
      title: "5. Kør kontrolleret ordre til admin",
      owner: "Drift og support",
      status: firstProductOrderReady ? "klar" : tenantHasOrders ? "qa" : "qa",
      proof: firstProductOrderReady
        ? `${formatCount(signal?.firstProductOrderCount ?? null)} ordre-spor er fundet for pilotproduktet.`
        : tenantHasOrders
          ? "Der findes ordrer på tenanten, men pilotproduktet mangler sit eget ordrebevis."
          : "Der skal laves en kontrolleret ordre fra kundeside til admin.",
      next: firstProductOrderReady ? "Brug ordren som dokumentation i demoen." : "Lav en test- eller pilotordre og gennemgå den i admin.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "6. Brug Salgsmapper som template-bevis",
      owner: "Salgsdemo",
      status: salgsmapperTemplateReady ? "klar" : salgsmapper?.signal?.tenantId ? "blokeret" : "planlagt",
      proof: salgsmapperTemplateReady
        ? "Salgsmapper har et produktflow med klar designer-skabelon."
        : "Salgsmapper skal bevise fast skabelon, download og designer-handoff som niche-eksempel.",
      next: salgsmapperTemplateReady ? "Vis Salgsmapper efter Webprinter pilotordren." : "Godkend første salgsmappe-skabelon.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
  ];
}

function getPrintHouseSalesPackage(
  readinessRows: TenantReadiness[],
  commercialGates: CommercialGate[],
  pilotOrderPlan: PilotOrderStep[],
): SalesPackageItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const onlinetryksager = getTenantByDomain(readinessRows, "onlinetryksager.dk");
  const gateBlockers = commercialGates.filter((gate) => gate.status === "blokeret").length;
  const decisionBlockers = commercialDecisions.filter((item) => item.status === "blokeret").length;
  const pilotOrderBlockers = pilotOrderPlan.filter((step) => step.status === "blokeret").length;
  const pilotOrderReady = pilotOrderPlan.some((step) => step.title.includes("Kør kontrolleret ordre") && step.status === "klar");
  const webprinterHasProofProduct = Boolean(webprinter?.signal?.firstProductFound && webprinter.signal.firstProductPriceRows && webprinter.signal.firstProductPriceRows > 0);
  const salgsmapperHasTemplateProof = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const onlinetryksagerHasFirstProduct = Boolean(onlinetryksager?.firstProductSlug && onlinetryksager.signal?.firstProductFound);

  return [
    {
      title: "Demo-script og rækkefølge",
      owner: "Ledelse",
      status: gateBlockers > 0 ? "qa" : "klar",
      artifact: "Cockpittet har demo-gate, demo-køreplan og næste beslutning samlet ét sted.",
      next: gateBlockers > 0
        ? "Kør en intern demo og noter hvor forklaring stadig erstatter bevis."
        : "Brug demo-køreplanen som første print-house præsentation.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
    {
      title: "Pilotordrebevis",
      owner: "Drift",
      status: pilotOrderReady ? "klar" : pilotOrderBlockers > 0 ? "blokeret" : "qa",
      artifact: pilotOrderReady
        ? "Der findes et ordre-spor for Webprinter pilotproduktet."
        : "Første kontrollerede Webprinter ordre mangler stadig som salgsbevis.",
      next: pilotOrderReady
        ? "Gem ordren som reference i demoen og gennemgå admin-flowet."
        : "Kør pilotordre-planen fra produkt til adminordre.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "Tenant-showcase",
      owner: "Produkt",
      status: webprinterHasProofProduct && salgsmapperHasTemplateProof
        ? onlinetryksagerHasFirstProduct ? "klar" : "qa"
        : "blokeret",
      artifact: "Webprinter skal vise platformen, Salgsmapper skal vise niche/template, og Onlinetryksager kan blive sekundær pilot.",
      next: webprinterHasProofProduct && salgsmapperHasTemplateProof
        ? "Hold Onlinetryksager som næste proof, ikke hovedbevis endnu."
        : "Færdiggør Webprinter produkt/pris og Salgsmapper template før ekstern demo.",
      href: "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "Onboarding og drift",
      owner: "Support",
      status: pilotOrderReady ? "qa" : "planlagt",
      artifact: "Der skal være en enkel forklaring af produktopsætning, ordrebehandling, supportansvar og tenant-vedligehold.",
      next: pilotOrderReady
        ? "Omsæt pilotordren til en kort intern driftsrunbook."
        : "Afvent pilotordrebevis, og skriv derefter den praktiske driftsrutine.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "Tilbudsmodel",
      owner: "Ledelse",
      status: "planlagt",
      artifact: "Print-house samtalen skal have et simpelt tilbud: setup, månedlig platform, support og eventuelle integrationsfaser.",
      next: "Beslut hvad en første trykkeripilot må koste, og hvad der er uden for scope.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
    {
      title: "Risikogrænser og ikke-løfter",
      owner: "Ledelse",
      status: decisionBlockers > 0 ? "qa" : "klar",
      artifact: `${decisionBlockers} blokerende beslutninger skal holdes ude af salgslofterne, især Supplier Bank og åbne importgates.`,
      next: decisionBlockers > 0
        ? "Brug beslutningskøen til at afgrænse hvad der må loves nu."
        : "Brug de lukkede beslutninger som del af salgsfortællingen.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
  ];
}

function getPrintHouseOfferModel(
  readinessRows: TenantReadiness[],
  pilotOrderPlan: PilotOrderStep[],
  salesPackage: SalesPackageItem[],
  seoVisibilityRows: SeoVisibilityRow[],
): PrintHouseOfferItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const productAndPriceReady = Boolean(
    webprinter?.signal?.firstProductFound
    && webprinter.signal.firstProductPriceRows
    && webprinter.signal.firstProductPriceRows > 0,
  );
  const templateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const pilotOrderReady = pilotOrderPlan.some((step) => step.title.includes("Kør kontrolleret ordre") && step.status === "klar");
  const tenantShowcase = salesPackage.find((item) => item.title === "Tenant-showcase");
  const onboarding = salesPackage.find((item) => item.title === "Onboarding og drift");
  const riskBoundaries = salesPackage.find((item) => item.title === "Risikogrænser og ikke-løfter");
  const seoHasAnySignal = seoVisibilityRows.some((row) => row.status === "klar" || row.status === "qa");
  const seoHasTrafficProof = seoVisibilityRows.some((row) => row.status === "klar");

  return [
    {
      title: "1. Tenant og branded storefront",
      status: tenantShowcase?.status || "qa",
      packageLine: "Opsætning af én branded tenant med domæne, branding, sider og adminadgang.",
      proof: tenantShowcase?.artifact || "Owned tenants viser at samme platform kan drive flere storefronts.",
      decision: "Beslut om første pilottrykkeri skal starte som subdomæne eller eget domæne.",
      href: "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      title: "2. Første produktpakke",
      status: productAndPriceReady && templateReady ? "qa" : "blokeret",
      packageLine: "Start med 3-5 produkter, hvor mindst ét har bevist pris-preview og ét har template/designer-proof.",
      proof: productAndPriceReady && templateReady
        ? "Webprinter har produkt/pris-proof, og Salgsmapper har template-proof som demonstrerbar model."
        : "Produkt/pris og template-proof skal være færdige før dette sælges som standardpakke.",
      decision: "Vælg de første produktfamilier for pilottrykkeriet og hvem der ejer prislisten.",
      href: "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "3. Designer, upload og PDF-skabeloner",
      status: templateReady ? "qa" : "blokeret",
      packageLine: "Online designer, PDF upload og produktbestemte skabeloner som en kontrolleret del af ordreflowet.",
      proof: templateReady
        ? "Salgsmapper kan bruges som første nichebevis for fast template og designer-handoff."
        : "Salgsmapper template-flow skal godkendes før designerpakke loves til en pilot.",
      decision: "Aftal hvilke produkter der skal have designer, hvilke der kun skal have upload, og hvilke skabeloner kunden kan downloade.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "4. Checkout og ordreindtag",
      status: pilotOrderReady ? "qa" : "blokeret",
      packageLine: "Kundeordre fra prisvalg/design eller upload til admin-overblik, korrektur og produktion.",
      proof: pilotOrderReady
        ? "Der findes et ordre-spor for pilotproduktet, som kan bruges i demo og onboarding."
        : "Første kontrollerede pilotordre mangler stadig som salgsbevis.",
      decision: "Beslut betalingsform, ordremail, korrekturansvar og hvornår en ordre er produktionsklar.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "5. SEO og synlighedsrapport",
      status: seoHasTrafficProof ? "klar" : seoHasAnySignal ? "qa" : "planlagt",
      packageLine: "Read-only SEO/Search Console overblik for domæne, SEO-rækker, klik, visninger og synlighed.",
      proof: seoHasTrafficProof
        ? "Mindst ét ejet domæne har Search Console-trafikbevis i cockpittet."
        : seoHasAnySignal
          ? "SEO/Search Console-laget er koblet ind i cockpit, men nogle domæner kræver QA eller data."
          : "Search Console/SEO skal forbindes eller udfyldes før synlighed kan bruges som salgsbevis.",
      decision: "Beslut hvilke KPI'er pilottrykkeriet skal se månedligt, og hvem der ejer Search Console-adgangen.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "6. Supplier Bank som staging",
      status: riskBoundaries?.status || "blokeret",
      packageLine: "Supplier Bank kan bruges som intern sourcing og draft-import, ikke som automatisk live-prisløfte.",
      proof: riskBoundaries?.artifact || "Supplier Bank har dækning og gates, men skal holdes approval-gated.",
      decision: "Beslut hvilke supplier-produkter må bruges i piloten, og hvad der eksplicit ikke loves.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "7. Support, onboarding og driftsaftale",
      status: onboarding?.status || "planlagt",
      packageLine: "Kort onboardingforløb for admin, produktopsætning, ordrebehandling og supportansvar.",
      proof: onboarding?.artifact || "Driftsrutinen skal skrives ud fra første pilotordre.",
      decision: "Beslut supportniveau, svartid, hvem der må ændre produkter/priser, og hvad der er ekstraarbejde.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "8. Kommerciel prisramme",
      status: "planlagt",
      packageLine: "En enkel model med setup, månedlig platform, support og eventuelle integrationsfaser.",
      proof: "Cockpittet kan nu vise beviser og mangler, men konkrete beløb er en ledelsesbeslutning.",
      decision: "Sæt pilotpris, månedlig pris, inkluderede timer, og hvilke integrationer der ligger uden for første aftale.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
  ];
}

function getCommercialReadyCriteria(
  readinessRows: TenantReadiness[],
  pilotOrderPlan: PilotOrderStep[],
  salesEvidenceBinder: SalesEvidenceItem[],
  seoVisibilityRows: SeoVisibilityRow[],
  offerModel: PrintHouseOfferItem[],
  orderOperationsRows: OrderOperationsRow[],
  paymentCheckoutRows: PaymentCheckoutRow[],
  supportCustomerRows: SupportCustomerRow[],
  mailNotificationRows: MailNotificationRow[],
  deliveryFulfillmentRows: DeliveryFulfillmentRow[],
  legalConsentRows: LegalConsentRow[],
  platformLeadReadiness: PlatformLeadReadinessItem[],
): CommercialReadyCriterion[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const webprinterOrderOps = orderOperationsRows.find((item) => item.domain === "webprinter.dk");
  const webprinterPayment = paymentCheckoutRows.find((item) => item.domain === "webprinter.dk");
  const webprinterSupport = supportCustomerRows.find((item) => item.domain === "webprinter.dk");
  const webprinterMail = mailNotificationRows.find((item) => item.domain === "webprinter.dk");
  const webprinterDelivery = deliveryFulfillmentRows.find((item) => item.domain === "webprinter.dk");
  const webprinterLegal = legalConsentRows.find((item) => item.domain === "webprinter.dk");
  const webprinterOrderReady = pilotOrderPlan.some((step) => step.title.includes("Kør kontrolleret ordre") && step.status === "klar");
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const webprinterPriceReady = Boolean(
    webprinter?.signal?.firstProductFound
    && webprinter.signal.firstProductPriceRows
    && webprinter.signal.firstProductPriceRows > 0,
  );
  const webprinterDesignerKnown = Boolean(webprinter?.signal?.firstProductDesignerLaunchReady || webprinter?.signal?.firstProductTemplateCount);
  const anyTenantOrders = readinessRows.some((tenant) => tenant.signal?.orderCount && tenant.signal.orderCount > 0);
  const seoHasSignal = seoVisibilityRows.some((row) => row.status === "klar" || row.status === "qa");
  const supplierEvidence = salesEvidenceBinder.find((item) => item.claim === "Supplier Bank kan vises som kontrolleret sourcing");
  const demoOfferReady = offerModel.filter((item) => item.status !== "blokeret").length >= 5;
  const publicPagesProof = salesEvidenceBinder.find((item) => item.claim === "Offentlige produktsider er pitch-klare");
  const platformLeadReadyCount = platformLeadReadiness.filter((item) => item.status === "klar").length;
  const platformLeadBlockers = platformLeadReadiness.filter((item) => item.status === "blokeret").length;
  const platformLeadGap = platformLeadReadiness.find((item) => item.status !== "klar");
  const webprinterOrderAttentionCount = webprinterOrderOps
    ? (webprinterOrderOps.problemCount ?? 0)
      + (webprinterOrderOps.reuploadCount ?? 0)
      + (webprinterOrderOps.awaitingCustomerFileCount ?? 0)
      + (webprinterOrderOps.missingFileCount ?? 0)
    : null;

  return [
    {
      title: "1. Én tenant kan tage en reel ordre ende til ende",
      status: webprinterOrderReady ? "klar" : anyTenantOrders ? "qa" : "blokeret",
      proof: webprinterOrderReady
        ? "Webprinter har et ordre-spor på pilotproduktet."
        : anyTenantOrders
          ? "Der findes tenant-ordrer, men pilotproduktets ende-til-ende ordrebevis mangler."
          : "Cockpittet finder endnu ikke ordrebevis for pilotflowet.",
      next: webprinterOrderReady ? "Brug ordren som salgsbevis." : "Kør første pilotordre fra produkt til admin.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "2. En anden tenant beviser niche/template-flow",
      status: salgsmapperTemplateReady ? "klar" : "blokeret",
      proof: salgsmapperTemplateReady
        ? "Salgsmapper har et produktflow med klar designer-skabelon."
        : "Salgsmapper mangler stadig et bevist template/designer-flow.",
      next: salgsmapperTemplateReady ? "Brug Salgsmapper som niche-proof i demoen." : "Godkend og test første salgsmappe-skabelon.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "3. Pris og designer-state er sporbare",
      status: webprinterPriceReady && salgsmapperTemplateReady
        ? webprinterDesignerKnown ? "klar" : "qa"
        : "blokeret",
      proof: webprinterPriceReady && salgsmapperTemplateReady
        ? "Pris-preview og template/designer-proof kan vises via Webprinter og Salgsmapper."
        : "Pris-preview eller designer/template-proof mangler stadig som samlet salgsbevis.",
      next: webprinterPriceReady && salgsmapperTemplateReady
        ? "Gennemgå kunderejsen manuelt før ekstern demo."
        : "Luk pris-preview og template-proof før pris/designer loves.",
      href: "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "4. Admin kan behandle ordrer uden udviklerhjælp",
      status: webprinterOrderReady ? "qa" : "blokeret",
      proof: webprinterOrderReady
        ? "Ordrebevis findes; den praktiske support/driftsrutine skal stadig godkendes."
        : "Adminordre-flowet mangler et kontrolleret pilotbevis.",
      next: webprinterOrderReady ? "Skriv kort driftsrunbook ud fra pilotordren." : "Kør og gennemgå en testordre i admin.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "5. Ordredrift og filklarhed er synlig",
      status: !webprinterOrderOps
        ? "qa"
        : webprinterOrderOps.status === "klar"
          ? "klar"
          : webprinterOrderOps.status === "blokeret" ? "blokeret" : "qa",
      proof: webprinterOrderOps
        ? `${formatCount(webprinterOrderOps.fileReadyCount)} filklare ordre(r), ${formatCount(webprinterOrderAttentionCount)} ordre(r) kræver opmærksomhed i Webprinter-signalet.`
        : "Ordredrift signaler er endnu ikke læst for Webprinter.",
      next: webprinterOrderOps?.status === "klar"
        ? "Brug ordredrift-signalet i pilot/demo review."
        : "Åbn Ordredrift signaler og luk problem-, ny-fil- eller manglende-fil pres før live pilot.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#order-operations-signals",
    },
    {
      title: "6. Betaling/checkout pilot er afklaret",
      status: webprinterPayment?.status === "klar"
        ? "klar"
        : webprinterPayment?.status === "blokeret" ? "blokeret" : "qa",
      proof: webprinterPayment
        ? `${webprinterPayment.mode}: ${webprinterPayment.paymentStatus}. Platformgebyr ${webprinterPayment.feeSummary}.`
        : "Betalingsberedskab er ikke læst for Webprinter.",
      next: webprinterPayment?.status === "klar"
        ? "Beslut om pilotordren faktisk skal bruge live betaling eller holdes som manuel/test."
        : "Vælg test, manuel faktura eller færdig Stripe Connect før ekstern pilot.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#payment-checkout-signals",
    },
    {
      title: "7. Kundeservice og dialog er synlig",
      status: webprinterSupport?.status === "klar"
        ? "klar"
        : webprinterSupport?.status === "blokeret" ? "blokeret" : "qa",
      proof: webprinterSupport
        ? `${formatCount(webprinterSupport.orderMessageCount)} ordrebesked(er), ${formatCount(webprinterSupport.platformMessageCount)} supportbesked(er), ${formatCount((webprinterSupport.unreadCustomerMessageCount ?? 0) + (webprinterSupport.unreadTenantMessageCount ?? 0))} ulæste.`
        : "Kundeservice-signalet er ikke læst for Webprinter.",
      next: webprinterSupport?.status === "klar"
        ? "Brug beskedflowet som del af driftsgennemgangen."
        : "Åbn Kundeservice-signaler og test kundedialogen på en kontrolleret ordre.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#support-customer-signals",
    },
    {
      title: "8. Mail og notifikationer er afklaret",
      status: webprinterMail?.status === "klar"
        ? "klar"
        : webprinterMail?.status === "blokeret" ? "blokeret" : "qa",
      proof: webprinterMail
        ? `Kundebekræftelse ${webprinterMail.customerConfirmationsEnabled ? "aktiv" : "slået fra"}, admin ordre-mail ${webprinterMail.adminNewOrdersEnabled ? "aktiv" : "slået fra"}, firma-email ${webprinterMail.companyEmail || "mangler"}.`
        : "Mail-/notifikationsberedskab er ikke læst for Webprinter.",
      next: webprinterMail?.status === "klar"
        ? "Brug mail-signalet i pilotens checkout- og supportgennemgang."
        : "Åbn Mail/notifikationer og afklar firma-email, kundebekræftelse og admin ordre-mail før pilot.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#mail-notification-signals",
    },
    {
      title: "9. Levering og fulfillment er synlig",
      status: webprinterDelivery?.status === "klar"
        ? "klar"
        : webprinterDelivery?.status === "blokeret" ? "blokeret" : "qa",
      proof: webprinterDelivery
        ? `${formatCount(webprinterDelivery.firstProductDeliveryMethodCount)} leveringsmetode(r), ${formatCount(webprinterDelivery.ordersWithMethodCount)}/${formatCount(webprinterDelivery.orderSampleCount)} ordre(r) med leveringsmetode, POD-afsender ${senderModeLabel(webprinterDelivery.podSenderMode)}.`
        : "Levering-/fulfillmentberedskab er ikke læst for Webprinter.",
      next: webprinterDelivery?.status === "klar"
        ? "Brug levering-signalet i pilotens ordre- og fulfillmentgennemgang."
        : "Åbn Levering-signaler og afklar leveringsmetoder, tracking og POD-afsender før pilot.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#delivery-fulfillment-signals",
    },
    {
      title: "10. Jura, cookie og kontakt er synlig",
      status: webprinterLegal?.status === "klar"
        ? "klar"
        : webprinterLegal?.status === "blokeret" ? "blokeret" : "qa",
      proof: webprinterLegal
        ? `Firma-email ${webprinterLegal.companyEmail || "mangler"}, CVR/adresse ${(webprinterLegal.companyCvr || webprinterLegal.companyAddress) ? "synlig" : "mangler"}, cookie-samtykke ${webprinterLegal.cookieConsentReady ? "klar" : "mangler"}.`
        : "Jura/cookie/kontaktberedskab er ikke læst for Webprinter.",
      next: webprinterLegal?.status === "klar"
        ? "Brug jura/cookie-signalet som del af pilotens offentlige sidegennemgang."
        : "Åbn Jura/cookie-signaler og afklar firmaidentitet, kontakt-email og vilkårslink før ekstern pilot.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#legal-consent-signals",
    },
    {
      title: "11. Platformhenvendelser kan modtages og følges op",
      status: platformLeadBlockers > 0
        ? "blokeret"
        : platformLeadReadyCount === platformLeadReadiness.length ? "klar" : "qa",
      proof: `${formatCount(platformLeadReadyCount)}/${formatCount(platformLeadReadiness.length)} platformkontakt-signaler er klar; ${platformLeadGap?.proof || "alle signaler er klar"}.`,
      next: platformLeadGap?.next || "Brug platformformularen som første salgskanal til trykkerihenvendelser.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#platform-lead-readiness",
    },
    {
      title: "12. SEO/analytics-synlighed findes",
      status: seoHasSignal ? "qa" : "planlagt",
      proof: seoHasSignal
        ? "SEO/Search Console-laget viser read-only domænesignaler eller data."
        : "SEO/Search Console skal stadig forbindes eller udfyldes som bevis.",
      next: seoHasSignal ? "Gennemgå hvilke domæner har trafikbevis." : "Forbind Search Console og opret SEO-rækker.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "13. Supplier Bank kan stage/importere uden uventet liveændring",
      status: supplierEvidence?.status || "blokeret",
      proof: supplierEvidence?.proof || "Supplier Bank skal holdes som kontrolleret staging med approval-gates.",
      next: supplierEvidence?.gap || "Vis kun Supplier Bank som staging, ikke automatisk live-publishing.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "14. Demo/pitch kan forklares i simpelt forretningssprog",
      status: demoOfferReady && publicPagesProof?.status !== "blokeret" ? "qa" : "planlagt",
      proof: demoOfferReady
        ? "Cockpittet har demo-køreplan, salgspakke og tilbudsmodel samlet."
        : "Salgspakke og tilbudsmodel mangler stadig nok ikke-blokerede linjer.",
      next: demoOfferReady ? "Kør en intern generalprøve og fjern alt der kræver teknisk forklaring." : "Luk pilotordre, template og produktbeviser først.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
  ];
}

function getThirtyDayPlanItems(
  readinessRows: TenantReadiness[],
  pilotOrderPlan: PilotOrderStep[],
  flowIssues: FlowIssue[],
  commercialReadyCriteria: CommercialReadyCriterion[],
  seoVisibilityRows: SeoVisibilityRow[],
): ThirtyDayPlanItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const onlinetryksager = getTenantByDomain(readinessRows, "onlinetryksager.dk");
  const selectedPilotPaths = readinessRows.filter((tenant) => tenant.firstProductSlug && tenant.signal?.tenantId);
  const missingPilotPaths = readinessRows.filter((tenant) => !tenant.firstProductSlug || !tenant.signal?.tenantId);
  const allPilotsSelected = selectedPilotPaths.length === readinessRows.length;
  const webprinterPriceReady = Boolean(webprinter?.signal?.firstProductPriceRows && webprinter.signal.firstProductPriceRows > 0);
  const webprinterOrderReady = pilotOrderPlan.some((step) => step.title.includes("Kør kontrolleret ordre") && step.status === "klar");
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const pricePreviewIssues = flowIssues.filter((issue) => issue.title.includes("Pris-preview"));
  const wmdDecision = commercialDecisions.find((item) => item.title === "Afklar gammel WMD-publicering");
  const seoHasReadOnlyLayer = seoVisibilityRows.some((row) => row.status === "klar" || row.status === "qa");
  const supplierCriteria = commercialReadyCriteria.find((item) => item.title.includes("Supplier Bank"));

  return [
    {
      title: "1. Vælg ét live pilotflow pr. ejet tenant",
      owner: "Produkt",
      status: allPilotsSelected ? "qa" : "planlagt",
      proof: allPilotsSelected
        ? `${formatCount(selectedPilotPaths.length)} pilotflows er valgt i cockpitdata.`
        : `${formatCount(selectedPilotPaths.length)}/${formatCount(readinessRows.length)} pilotflows er valgt; mangler: ${missingPilotPaths.map((tenant) => tenant.name).join(", ") || "ukendt"}.`,
      next: allPilotsSelected ? "Gennemgå alle tre manuelt i storefront." : "Vælg eller ret første standardprodukt for de manglende tenants.",
      href: onlinetryksager?.adminPath || "/admin/products?force_domain=www.onlinetryksager.dk",
    },
    {
      title: "2. Verificér admin-login for admin@webprinter.dk",
      owner: "Adgang",
      status: "qa",
      proof: "Cockpittet kan ikke bevise login for en bestemt mail uden en manuel auth-test.",
      next: "Log ind som admin@webprinter.dk og bekræft adgang til designer, produkter, ordrer, SEO og Supplier Bank.",
      href: "/admin?force_domain=webprinter.dk",
    },
    {
      title: "3. Verificér Webprinter flagship-produkt ende til ende",
      owner: "Produkt og drift",
      status: webprinterOrderReady ? "klar" : webprinterPriceReady ? "qa" : "blokeret",
      proof: webprinterOrderReady
        ? "Webprinter pilotproduktet har ordre-spor."
        : webprinterPriceReady
          ? "Webprinter pilotproduktet har prisrækker, men mangler kontrolleret ordrebevis."
          : "Webprinter pilotproduktet mangler pris- eller produktbevis.",
      next: webprinterOrderReady ? "Brug ordren som demo-bevis." : "Kør produktet fra offentlig side til adminordre.",
      href: webprinter?.adminPath || "/admin/product/aluminium?force_domain=webprinter.dk",
    },
    {
      title: "4. Verificér Salgsmapper template-download og designer-handoff",
      owner: "Designer",
      status: salgsmapperTemplateReady ? "klar" : "blokeret",
      proof: salgsmapperTemplateReady
        ? "Salgsmapper har klar designer-skabelon i cockpitdata."
        : "Salgsmapper template-proof mangler stadig.",
      next: salgsmapperTemplateReady ? "Gennemgå download/design-knapper manuelt." : "Godkend første salgsmappe-skabelon.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "5. Gør manglende pris-preview-rækker synlige for admin",
      owner: "Produkt QA",
      status: pricePreviewIssues.length > 0 ? "qa" : "klar",
      proof: pricePreviewIssues.length > 0
        ? `${formatCount(pricePreviewIssues.length)} pris-preview issue vises i cockpit-flowblokeringer.`
        : "Cockpittet finder ingen aktive pris-preview blockers i de nuværende tenant-signaler.",
      next: pricePreviewIssues.length > 0
        ? "Åbn flow-blokeringer og ret produktets prisrækker."
        : "Behold cockpit-advarslen som første admin-sikkerhedsnet.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#flow-blockers",
    },
    {
      title: "6. Beslut ældre publiceret WMD duplicate",
      owner: "Ledelse",
      status: wmdDecision?.status || "blokeret",
      proof: wmdDecision?.impact || "Det ældre WMD target skal afklares før Supplier Bank kan forklares roligt.",
      next: wmdDecision?.decision || "Beslut behold, afpublicér eller arkivér.",
      href: wmdDecision?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "7. Hold Supplier Bank rapporter synlige og opdaterede",
      owner: "Sourcing",
      status: supplierCriteria?.status === "blokeret" ? "qa" : supplierCriteria?.status || "qa",
      proof: supplierCriteria?.proof || "Supplier Bank-status vises i cockpit og rapporter, men åbne gates skal holdes tydelige.",
      next: supplierCriteria?.next || "Opdater rapporterne og hold write/import/publish approval-gated.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "8. Kobl SEO/Search Console read-only hvor muligt",
      owner: "SEO",
      status: seoHasReadOnlyLayer ? "qa" : "planlagt",
      proof: seoHasReadOnlyLayer
        ? "SEO/Search Console bevislaget er synligt i cockpittet."
        : "SEO/Search Console har stadig ingen synlige read-only signaler i cockpittet.",
      next: seoHasReadOnlyLayer ? "Bekræft hvilke domæner har rigtige Google-data." : "Forbind Search Console eller opret SEO-rækker.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
  ];
}

function getPilotProofRunItems(
  readinessRows: TenantReadiness[],
  pilotOrderPlan: PilotOrderStep[],
  seoVisibilityRows: SeoVisibilityRow[],
): PilotProofRunItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const onlinetryksager = getTenantByDomain(readinessRows, "onlinetryksager.dk");
  const webprinterProductExists = Boolean(webprinter?.signal?.tenantId && webprinter.signal.firstProductFound);
  const webprinterPriceReady = Boolean(
    webprinter?.signal?.firstProductFound
    && webprinter.signal.firstProductPublished
    && webprinter.signal.firstProductPriceRows
    && webprinter.signal.firstProductPriceRows > 0,
  );
  const webprinterDesignerKnown = Boolean(webprinter?.signal?.firstProductDesignerLaunchReady);
  const webprinterOrderReady = pilotOrderPlan.some((step) => step.title.includes("Kør kontrolleret ordre") && step.status === "klar");
  const salgsmapperProductFound = Boolean(salgsmapper?.signal?.tenantId && salgsmapper.signal.firstProductFound);
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const onlinetryksagerProductChosen = Boolean(onlinetryksager?.firstProductSlug && onlinetryksager.signal?.firstProductFound);
  const seoHasTrafficProof = seoVisibilityRows.some((row) => row.status === "klar");
  const seoHasReadOnlyLayer = seoVisibilityRows.some((row) => row.status === "klar" || row.status === "qa");

  return [
    {
      title: "1. Webprinter produktside og prisvalg",
      tenantName: "Webprinter",
      surface: "Kundeside",
      status: webprinterPriceReady ? "klar" : webprinterProductExists ? "qa" : "blokeret",
      evidence: webprinterPriceReady
        ? `${webprinter?.firstProduct || "Pilotproduktet"} er fundet, publiceret og har ${formatCount(webprinter?.signal?.firstProductPriceRows ?? null)} prisrækker.`
        : webprinterProductExists
          ? "Produktet findes, men pris/publicering skal gennemgås manuelt før ekstern demo."
          : "Webprinter mangler et læsbart pilotprodukt i cockpitdata.",
      witness: "Åbn produktsiden, vælg en synlig variant/antal, og bekræft at kunden ser en reel pris uden forklaring.",
      href: webprinter?.storefrontPath || "/produkt/aluminium?force_domain=webprinter.dk",
    },
    {
      title: "2. Webprinter designer eller upload-handoff",
      tenantName: "Webprinter",
      surface: "Designer",
      status: webprinterDesignerKnown ? "klar" : webprinterProductExists ? "qa" : "blokeret",
      evidence: webprinterDesignerKnown
        ? "Cockpittet kan udlede en klar designer-start fra produktets skabelondata."
        : webprinterProductExists
          ? "Produktet findes, men designer/upload-overdragelsen skal ses manuelt."
          : "Designer-handoff kan ikke bevises før produktet findes.",
      witness: "Start design/upload fra produktet og bekræft at produktkontekst, format og næste trin er tydelige.",
      href: webprinter?.storefrontPath || "/produkt/aluminium?force_domain=webprinter.dk",
    },
    {
      title: "3. Webprinter ordre ind i admin",
      tenantName: "Webprinter",
      surface: "Admin",
      status: webprinterOrderReady ? "klar" : webprinterPriceReady ? "qa" : "blokeret",
      evidence: webprinterOrderReady
        ? "Der findes et ordre-spor for Webprinter pilotproduktet."
        : webprinterPriceReady
          ? "Produkt og pris er klar nok til en kontrolleret testordre, men ordrebeviset mangler."
          : "Ordretesten bør vente til produkt og pris er stabile.",
      witness: "Kør eller find en kontrolleret ordre, og bekræft at admin kan se kunde, produkt, pris, fil/design og næste driftstrin.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "4. Salgsmapper skabelon-download og designer",
      tenantName: "Salgsmapper",
      surface: "Kundeside",
      status: salgsmapperTemplateReady ? "klar" : salgsmapperProductFound ? "blokeret" : "planlagt",
      evidence: salgsmapperTemplateReady
        ? "Salgsmapper har et produktflow med klar designer-skabelon."
        : salgsmapperProductFound
          ? "Produktet findes, men template/designer-proof er ikke klar."
          : "Salgsmapper produktet eller templatekonteksten skal vælges/godkendes.",
      witness: "Åbn salgsmappe-produktet, download PDF-skabelonen, og start designeren med den korrekte salgsmappe-skabelon.",
      href: salgsmapper?.storefrontPath || "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    },
    {
      title: "5. Salgsmapper admin-skabelon",
      tenantName: "Salgsmapper",
      surface: "Admin",
      status: salgsmapperTemplateReady
        ? "klar"
        : salgsmapper?.signal?.activeTemplateCount && salgsmapper.signal.activeTemplateCount > 0 ? "qa" : "blokeret",
      evidence: salgsmapperTemplateReady
        ? "Produktbestemt designer-start kan udledes fra skabelondata."
        : salgsmapper?.signal?.activeTemplateCount && salgsmapper.signal.activeTemplateCount > 0
          ? `${formatCount(salgsmapper.signal.activeTemplateCount)} aktive templates findes, men produktkoblingen kræver QA.`
          : "Der mangler aktiv template eller produktkobling for første salgsmappe-proof.",
      witness: "Åbn templates, bekræft fil, format, bleed/fals/ryg-noter og at kundens download/design-knap peger rigtigt.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "6. Onlinetryksager første produktvalg",
      tenantName: "Onlinetryksager",
      surface: "Admin",
      status: onlinetryksagerProductChosen ? "qa" : "planlagt",
      evidence: onlinetryksagerProductChosen
        ? "Onlinetryksager har et valgt første produkt i cockpitdata."
        : "Onlinetryksager mangler stadig første konkrete bevisprodukt.",
      witness: "Vælg et simpelt standardprodukt som næste proof, og hold det ude af hoveddemoen indtil pris, designer/upload og ordre er bekræftet.",
      href: "/admin/products?force_domain=www.onlinetryksager.dk",
    },
    {
      title: "7. SEO og Search Console bevis",
      tenantName: "Alle ejede tenants",
      surface: "SEO",
      status: seoHasTrafficProof ? "klar" : seoHasReadOnlyLayer ? "qa" : "planlagt",
      evidence: seoHasTrafficProof
        ? "Mindst ét ejet domæne har trafikbevis i Search Console-laget."
        : seoHasReadOnlyLayer
          ? "SEO/Search Console-laget er synligt, men trafikbevis eller domæne-QA mangler."
          : "SEO/Search Console beviset skal forbindes eller udfyldes read-only.",
      witness: "Åbn SEO-laget og bekræft domæne, SEO-rækker, verificeret Google-site og om klik/visninger er synlige.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "8. Supplier Bank som staging, ikke løfte",
      tenantName: "Webprinter",
      surface: "Sourcing",
      status: "qa",
      evidence: "Supplier Bank har import- og rapportbeviser, men åbne Pixart/WMD-gates skal holdes tydelige.",
      witness: "Vis banken som intern sourcing/staging og sig eksplicit at import, publicering og livepriser er approval-gated.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "9. Adminadgang med admin@webprinter.dk",
      tenantName: "Webprinter",
      surface: "Adgang",
      status: "qa",
      evidence: "Login for en bestemt mail kan kun bevises manuelt i auth/session, ikke fra dette read-only cockpit.",
      witness: "Log ind som admin@webprinter.dk og bekræft adgang til produkter, designer/templates, ordrer, SEO og Supplier Bank.",
      href: "/admin?force_domain=webprinter.dk",
    },
  ];
}

function getRehearsalProofCaptureItems(pilotProofRuns: PilotProofRunItem[]): RehearsalProofCaptureItem[] {
  return pilotProofRuns.map((item) => {
    const title = item.title.replace(/^\d+\.\s*/, "");
    const acceptedWhen: Record<Status, string> = {
      klar: "Godkendt når en frisk browseråbning stadig viser samme bevis: korrekt tenant, korrekt produkt/område og ingen skjult forklaring.",
      qa: "Godkendt når en operatør har set punktet i browser eller admin og noteret dato, person og hvad der blev bevidnet.",
      planlagt: "Godkendt først når proof-produktet eller området er valgt, åbnet og kan ses i samme rute.",
      blokeret: "Ikke godkendt før blokeringen er rettet eller tydeligt markeret som en bevidst pilotbegrænsning.",
    };
    const stopRule: Record<Status, string> = {
      klar: "Må bruges i intern bevismappe efter frisk browsercheck. Vis eksternt kun hvis skærmen stadig matcher.",
      qa: "Brug kun internt. Vent med at love punktet til en trykkeridemo, indtil beviset er set og noteret.",
      planlagt: "Hold ude af demo og salgsargumenter, indtil produkt eller adminspor er valgt og bevidnet.",
      blokeret: "Stop før ekstern demo. Ret blokeringen eller beslut at punktet ikke er en del af første pilot.",
    };

    return {
      title,
      tenantName: item.tenantName,
      surface: item.surface,
      status: item.status,
      capture: item.witness,
      acceptedWhen: acceptedWhen[item.status],
      stopRule: stopRule[item.status],
      href: item.href,
    };
  });
}

function getPilotOperationsRunbook(
  readinessRows: TenantReadiness[],
  pilotOrderPlan: PilotOrderStep[],
  offerModel: PrintHouseOfferItem[],
): PilotOperationsRunbookItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const signal = webprinter?.signal;
  const productReady = Boolean(signal?.tenantId && signal.firstProductFound && signal.firstProductPublished);
  const priceReady = Boolean(signal?.firstProductPriceRows && signal.firstProductPriceRows > 0);
  const designerKnown = Boolean(signal?.firstProductDesignerLaunchReady || signal?.firstProductTemplateCount);
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const pilotOrderReady = pilotOrderPlan.some((step) => step.title.includes("Kør kontrolleret ordre") && step.status === "klar");
  const tenantHasOrders = Boolean(signal?.orderCount && signal.orderCount > 0);
  const paymentDecision = commercialDecisions.find((item) => item.title === "Afklar checkout og betalingspilot");
  const supportOffer = offerModel.find((item) => item.title.includes("Support"));

  return [
    {
      title: "1. Modtag ordre og kundedata",
      owner: "Drift",
      status: pilotOrderReady ? "klar" : tenantHasOrders ? "qa" : productReady && priceReady ? "qa" : "blokeret",
      evidence: pilotOrderReady
        ? "Cockpittet finder et ordre-spor for Webprinter pilotproduktet."
        : tenantHasOrders
          ? "Der findes tenant-ordrer, men pilotproduktets ordrebevis skal findes eller laves."
          : productReady && priceReady
            ? "Produkt og pris er klar nok til en kontrolleret ordretest."
            : "Pilotordre kan ikke bruges som driftsbevis før produkt og pris er stabile.",
      operatorCheck: "Åbn ordren i admin og bekræft kunde, kontakt, produktnavn, valgt variant, antal, pris og ordredato.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "2. Bekræft produkt, pris og ordregrundlag",
      owner: "Produkt og pris",
      status: priceReady ? "qa" : "blokeret",
      evidence: priceReady
        ? `${formatCount(signal?.firstProductPriceRows ?? null)} prisrækker er fundet for pilotproduktet.`
        : "Prisrækker eller pris-preview mangler for pilotproduktet.",
      operatorCheck: "Sammenlign kundens valgte produkt med pris-preview, og marker manuelt hvis der kræves prisbeslutning før produktion.",
      href: webprinter?.adminPath || "/admin/product/aluminium?force_domain=webprinter.dk",
    },
    {
      title: "3. Kontroller design, upload eller PDF-skabelon",
      owner: "Prepress",
      status: designerKnown || salgsmapperTemplateReady ? "qa" : "blokeret",
      evidence: designerKnown
        ? "Webprinter har kendt designer/template-kontekst for pilotproduktet."
        : salgsmapperTemplateReady
          ? "Salgsmapper kan bruges som template-proof for produktbestemt skabelon."
          : "Designer/upload/template-handoff skal verificeres før ordren bruges som driftsbevis.",
      operatorCheck: "Åbn kundens fil eller design, bekræft format, bleed, skabelonlinjer, produktkontekst og om filen kan sendes videre til produktion.",
      href: designerKnown
        ? webprinter?.adminPath || "/admin/product/aluminium?force_domain=webprinter.dk"
        : "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "4. Vælg betalingsform og økonomistatus",
      owner: "Økonomi",
      status: paymentDecision?.status || "qa",
      evidence: paymentDecision?.impact || "Første pilotordre skal have en tydelig beslutning om test, manuel betaling eller live betaling.",
      operatorCheck: "Beslut om ordren er test, manuel faktura eller live betaling, og hold det tydeligt i demo/salg så der ikke loves forkert checkout.",
      href: paymentDecision?.href || "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
    {
      title: "5. Sæt produktionsejer og næste status",
      owner: "Produktion",
      status: pilotOrderReady ? "qa" : "planlagt",
      evidence: pilotOrderReady
        ? "Ordrebeviset kan bruges til at gennemgå status- og ansvarsskift i admin."
        : "Status- og ansvarsrutinen kan først bevises på en kontrolleret ordre.",
      operatorCheck: "Aftal hvem der ejer korrektur, prepress, produktion, levering og kundesvar for pilotordren.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "6. Korrektur og kundekommunikation",
      owner: "Support",
      status: pilotOrderReady ? "qa" : "planlagt",
      evidence: supportOffer?.proof || "Support- og onboardingdelen skal skrives ud fra den første kontrollerede ordre.",
      operatorCheck: "Bekræft hvad kunden får besked om, hvornår der kræves korrektur, og hvem der svarer hvis fil eller pris ikke er klar.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "7. Levering, afslutning og dokumentation",
      owner: "Drift",
      status: pilotOrderReady ? "qa" : "planlagt",
      evidence: "Levering og afslutning er en driftsrutine, ikke en automatisk cockpit-handling.",
      operatorCheck: "Notér leveringsmetode, afhentning/forsendelse, intern afslutning og hvad der skal gemmes som bevis for næste demo.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "8. Gem salgsbevis uden at love mere end bevist",
      owner: "Ledelse",
      status: pilotOrderReady ? "qa" : "planlagt",
      evidence: pilotOrderReady
        ? "Pilotordren kan blive en del af salgspakken, hvis driftsgennemgangen også er godkendt."
        : "Salgspakken mangler stadig et konkret ordrebevis.",
      operatorCheck: "Brug ordren som demo-case først når produkt, pris, fil/design, betaling, status og supportansvar er gennemgået.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#sales-package",
    },
  ];
}

function getAdminAccessReadiness(
  readinessRows: TenantReadiness[],
  pilotProofRuns: PilotProofRunItem[],
  pilotOperationsRunbook: PilotOperationsRunbookItem[],
): AdminAccessReadinessItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const onlinetryksager = getTenantByDomain(readinessRows, "onlinetryksager.dk");
  const hasWebprinterTenant = Boolean(webprinter?.signal?.tenantId);
  const hasSalgsmapperTenant = Boolean(salgsmapper?.signal?.tenantId);
  const hasOnlinetryksagerTenant = Boolean(onlinetryksager?.signal?.tenantId);
  const productAccessNeeded = pilotProofRuns.some((item) => item.href.includes("/admin/product") || item.href.includes("/admin/products"));
  const orderAccessNeeded = pilotOperationsRunbook.some((item) => item.href.includes("/admin/kunder"));
  const salgsmapperTemplateBlocked = pilotProofRuns.some(
    (item) => item.tenantName === "Salgsmapper" && item.status === "blokeret",
  );

  return [
    {
      title: "1. Login og admin-dashboard",
      area: "Adgang",
      status: "qa",
      evidence: "Cockpittet kan ikke selv bevise session eller adgang for en bestemt e-mail uden manuel login-test.",
      manualCheck: "Log ind som admin@webprinter.dk og bekræft at adminområdet åbner dashboard uden at sende dig tilbage til forsiden.",
      href: "/admin?force_domain=webprinter.dk",
    },
    {
      title: "2. Webprinter produktadministration",
      area: "Produkter",
      status: hasWebprinterTenant && productAccessNeeded ? "qa" : hasWebprinterTenant ? "planlagt" : "blokeret",
      evidence: hasWebprinterTenant
        ? "Webprinter tenant kan læses, og produktområdet er et krævet pilotområde."
        : "Webprinter tenant/domæne kunne ikke bevises i de aktuelle signaler.",
      manualCheck: "Åbn produkter og aluminium-produktet, og bekræft at admin kan se produkt, pris-preview og relevante redigeringsfaner.",
      href: "/admin/product/aluminium?force_domain=webprinter.dk",
    },
    {
      title: "3. Salgsmapper designer-skabeloner",
      area: "Designer",
      status: hasSalgsmapperTenant ? salgsmapperTemplateBlocked ? "blokeret" : "qa" : "blokeret",
      evidence: hasSalgsmapperTenant
        ? "Salgsmapper tenant kan læses; template/designer-adgang skal stadig bekræftes manuelt."
        : "Salgsmapper tenant/domæne kunne ikke bevises i de aktuelle signaler.",
      manualCheck: "Åbn designer templates på Salgsmapper og bekræft at admin kan se/forstå den produktbestemte PDF-skabelon og kundedownload.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "4. Ordrer, kunder og pilotdrift",
      area: "Ordrer",
      status: orderAccessNeeded ? "qa" : "planlagt",
      evidence: orderAccessNeeded
        ? "Pilotdrift runbook kræver adgang til ordre-/kundeområdet."
        : "Ordreadgang bliver nødvendig når en kontrolleret pilotordre er klar.",
      manualCheck: "Åbn kunder/ordrer og bekræft at admin kan finde ordre, kunde, filer/design, pris og næste produktionstrin.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "5. SEO og Search Console",
      area: "SEO",
      status: "qa",
      evidence: "SEO/Search Console bevislaget er read-only i cockpittet, men adgang til selve SEO-admin skal testes med adminmailen.",
      manualCheck: "Åbn Platform SEO og bekræft at admin kan se domæner, SEO-rækker og Search Console-status uden at ændre Google-forbindelsen.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "6. Supplier Bank som staging",
      area: "Sourcing",
      status: "qa",
      evidence: "Supplier Bank må vises som intern staging og rapportstatus, men ikke som automatisk liveimport.",
      manualCheck: "Åbn Supplier Bank og bekræft at admin kan se produkter/gates uden at importere, publicere eller ændre livepriser.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "7. Tenant- og domænekontekst",
      area: "Tenant",
      status: hasWebprinterTenant && hasSalgsmapperTenant && hasOnlinetryksagerTenant ? "qa" : "blokeret",
      evidence: hasWebprinterTenant && hasSalgsmapperTenant && hasOnlinetryksagerTenant
        ? "Alle tre ejede tenants kan læses i cockpitdata."
        : "Mindst én ejet tenant mangler i cockpitdata eller domæneopslag.",
      manualCheck: "Skift mellem webprinter.dk, salgsmapper.dk og onlinetryksager.dk via force_domain og bekræft at sidebar/adminområde følger den rigtige tenant.",
      href: "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      title: "8. Betaling, moduler og indstillinger",
      area: "Indstillinger",
      status: "qa",
      evidence: "Første pilotordre kræver manuel beslutning om test, manuel betaling eller live betaling.",
      manualCheck: "Åbn betaling, moduler og indstillinger, og bekræft at admin kan se beslutningsområderne uden at ændre drift ved et uheld.",
      href: "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
  ];
}

function getFirstOpenItem<T extends { status: Status }>(items: T[]) {
  return items.find((item) => item.status === "blokeret")
    || items.find((item) => item.status === "qa")
    || items.find((item) => item.status === "planlagt")
    || null;
}

function getExecutivePriorityQueue(
  criticalPath: CriticalPathItem[],
  pilotProofRuns: PilotProofRunItem[],
  pilotOperationsRunbook: PilotOperationsRunbookItem[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  launchBoard: LaunchBoardItem[],
  thirtyDayPlan: ThirtyDayPlanItem[],
): ExecutivePriorityItem[] {
  const priorities: Array<Omit<ExecutivePriorityItem, "priority"> | null> = [];
  const criticalGap = getFirstOpenItem(criticalPath);
  const accessGap = getFirstOpenItem(adminAccessReadiness);
  const pilotGap = getFirstOpenItem(pilotProofRuns);
  const operationsGap = getFirstOpenItem(pilotOperationsRunbook);
  const launchGap = getFirstOpenItem(launchBoard);
  const thirtyDayGap = getFirstOpenItem(thirtyDayPlan);

  if (criticalGap) {
    priorities.push({
      title: criticalGap.title,
      owner: "Ledelse",
      status: criticalGap.status,
      reason: criticalGap.why,
      action: criticalGap.next,
      href: criticalGap.href,
    });
  }

  if (accessGap) {
    priorities.push({
      title: accessGap.title,
      owner: accessGap.area,
      status: accessGap.status,
      reason: accessGap.evidence,
      action: accessGap.manualCheck,
      href: accessGap.href,
    });
  }

  if (pilotGap) {
    priorities.push({
      title: pilotGap.title,
      owner: pilotGap.surface,
      status: pilotGap.status,
      reason: pilotGap.evidence,
      action: pilotGap.witness,
      href: pilotGap.href,
    });
  }

  if (operationsGap) {
    priorities.push({
      title: operationsGap.title,
      owner: operationsGap.owner,
      status: operationsGap.status,
      reason: operationsGap.evidence,
      action: operationsGap.operatorCheck,
      href: operationsGap.href,
    });
  }

  if (launchGap) {
    priorities.push({
      title: launchGap.title,
      owner: "Go/no-go",
      status: launchGap.status,
      reason: launchGap.basis,
      action: launchGap.next,
      href: launchGap.href,
    });
  }

  if (thirtyDayGap) {
    priorities.push({
      title: thirtyDayGap.title,
      owner: thirtyDayGap.owner,
      status: thirtyDayGap.status,
      reason: thirtyDayGap.proof,
      action: thirtyDayGap.next,
      href: thirtyDayGap.href,
    });
  }

  const seen = new Set<string>();
  const uniquePriorities = priorities.filter((item): item is Omit<ExecutivePriorityItem, "priority"> => {
    if (!item) return false;
    const key = `${item.title}-${item.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const statusOrder: Record<Status, number> = { blokeret: 0, qa: 1, planlagt: 2, klar: 3 };
  return uniquePriorities
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
    .slice(0, 6)
    .map((item, index) => ({ ...item, priority: `P${index + 1}` }));
}

function getPrintHouseMeetingPack(
  demoRunbook: DemoRunbookStep[],
  offerModel: PrintHouseOfferItem[],
  launchBoard: LaunchBoardItem[],
  salesEvidenceBinder: SalesEvidenceItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): PrintHouseMeetingPackItem[] {
  const firstBlocker = executivePriorityQueue.find((item) => item.status === "blokeret");
  const demoReadySteps = demoRunbook.filter((step) => step.status === "klar").length;
  const offerReadyLines = offerModel.filter((item) => item.status !== "blokeret").length;
  const externalDemo = launchBoard.find((item) => item.title === "Ekstern trykkeri-demo");
  const supplierBoundary = salesEvidenceBinder.find((item) => item.claim === "Supplier Bank kan vises som kontrolleret sourcing");
  const orderProof = salesEvidenceBinder.find((item) => item.claim === "Ordreflow kan følges fra kunde til admin");
  const tenantProof = salesEvidenceBinder.find((item) => item.claim === "Platformen kan drive flere tenants");
  const productPriceProof = salesEvidenceBinder.find((item) => item.claim === "Kunden kan se et produkt med pris-preview");

  return [
    {
      title: "1. Mødets formål",
      status: externalDemo?.status || "qa",
      purpose: "Forklar Webprinter som en pilotklar web-to-print platform, ikke som et færdigt automatiseret supplier-netværk.",
      say: externalDemo?.verdict === "Pilot-demo mulig"
        ? "Vi kan vise en pilot-demo med ejet tenantbevis og tydelige grænser."
        : "Vi viser systemets retning og de beviser, der skal lukkes før et eksternt salgsløfte.",
      evidence: externalDemo?.basis || "Go/no-go boardet afgør om demoen er ekstern eller intern generalprøve.",
      href: externalDemo?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#launch-board",
    },
    {
      title: "2. Hvad der må vises",
      status: demoReadySteps >= 3 ? "qa" : "blokeret",
      purpose: "Hold demoen på Webprinter platform, produkt/pris, Salgsmapper template, adminordre og Supplier Bank som staging.",
      say: `Vis ${formatCount(demoReadySteps)}/${formatCount(demoRunbook.length)} demo-trin som enten bevist eller kræver QA.`,
      evidence: "Demo-køreplanen bestemmer rækkefølgen og holder Onlinetryksager som sekundær pilot med Flyers-proof, ikke som hoveddemo.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#demo-runbook",
    },
    {
      title: "3. Beviser der skal nævnes",
      status: tenantProof?.status === "klar" && productPriceProof?.status !== "blokeret" ? "qa" : "blokeret",
      purpose: "Brug kun beviste eller tydeligt QA-markerede salgsclaims i samtalen.",
      say: "Platformen kan drive flere tenants; produkt/pris og template-proof skal vises som konkrete eksempler.",
      evidence: `${tenantProof?.proof || "Tenantbevis mangler."} ${productPriceProof?.proof || "Produkt/pris-bevis mangler."}`,
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#sales-evidence",
    },
    {
      title: "4. Hvad der ikke må loves",
      status: supplierBoundary?.status || "blokeret",
      purpose: "Beskyt salget mod for tidlige løfter om automatisk sourcing, livepriser, publicering og åbne supplier-gates.",
      say: "Supplier Bank vises kun som intern sourcing/staging, og import/publicering er approval-gated.",
      evidence: supplierBoundary?.gap || "Supplier Bank har stadig åbne Pixart/WMD-gates og må ikke sælges som fuld automatik.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "5. Kommercielt spørgsmål",
      status: offerReadyLines >= 5 ? "qa" : "planlagt",
      purpose: "Afslut mødet med et enkelt valg: vil trykkeriet være pilotkunde, og hvilke 3-5 produkter skal starte pakken?",
      say: "Hvis piloten giver mening, vælger vi domæne/tenant, første produktpakke, prisansvar, templatebehov og ordreoverdragelse.",
      evidence: `${formatCount(offerReadyLines)}/${formatCount(offerModel.length)} tilbudslinjer er ikke blokerede i tilbudsmodellen.`,
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
    {
      title: "6. Næste opfølgning",
      status: firstBlocker ? firstBlocker.status : orderProof?.status || "qa",
      purpose: "Efter mødet skal næste handling være konkret og må ikke afhænge af en bred teknisk roadmap.",
      say: firstBlocker
        ? `Første blocker: ${firstBlocker.title}.`
        : "Næste opfølgning er at gennemgå pilotordre, adgang og tilbudsmodel med valgt pilotkunde.",
      evidence: firstBlocker?.reason || orderProof?.proof || "Prioriteret handlingskø og salgsbevismappe styrer næste opfølgning.",
      href: firstBlocker?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
  ];
}

function getCommercialGoalExecutionPlan(
  criticalPath: CriticalPathItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
  printHouseMeetingPack: PrintHouseMeetingPackItem[],
  commercialReadyCriteria: CommercialReadyCriterion[],
  pilotProofRuns: PilotProofRunItem[],
  pilotOperationsRunbook: PilotOperationsRunbookItem[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  seoVisibilityRows: SeoVisibilityRow[],
  offerModel: PrintHouseOfferItem[],
): CommercialGoalExecutionItem[] {
  const firstPriority = executivePriorityQueue[0] || null;
  const firstCriticalGap = getFirstOpenItem(criticalPath);
  const firstProofGap = getFirstOpenItem(pilotProofRuns);
  const firstOperationsGap = getFirstOpenItem(pilotOperationsRunbook);
  const firstAccessGap = getFirstOpenItem(adminAccessReadiness);
  const firstMeetingGap = getFirstOpenItem(printHouseMeetingPack);
  const firstCommercialReadyGap = getFirstOpenItem(commercialReadyCriteria);

  const criticalBlockers = criticalPath.filter((item) => item.status === "blokeret").length;
  const readyCriteriaCount = commercialReadyCriteria.filter((item) => item.status === "klar").length;
  const proofReadyCount = pilotProofRuns.filter((item) => item.status === "klar").length;
  const operationsBlockers = pilotOperationsRunbook.filter((item) => item.status === "blokeret").length;
  const accessBlockers = adminAccessReadiness.filter((item) => item.status === "blokeret").length;
  const meetingBlockers = printHouseMeetingPack.filter((item) => item.status === "blokeret").length;
  const seoVisibleDomains = seoVisibilityRows.filter((row) => row.status === "klar" || row.status === "qa").length;
  const offerLinesOpen = offerModel.filter((item) => item.status !== "blokeret").length;

  return [
    {
      phase: "01",
      title: "Hold målet samlet i cockpit",
      status: firstPriority?.status === "blokeret" ? "qa" : "klar",
      evidence: firstPriority
        ? `Næste prioritet er ${firstPriority.priority}: ${firstPriority.title}.`
        : "Ingen åben topprioritet fundet i handlingskøen.",
      next: firstPriority
        ? firstPriority.action
        : "Brug cockpit som fast startpunkt før nye produkt-, pris- eller supplier-ændringer.",
      href: firstPriority?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
    {
      phase: "02",
      title: "Bevis de ejede tenantflows",
      status: criticalBlockers === 0 ? "qa" : "blokeret",
      evidence: `${formatCount(criticalPath.length - criticalBlockers)}/${formatCount(criticalPath.length)} kritiske proof-punkter er uden blokering.`,
      next: firstCriticalGap
        ? firstCriticalGap.next
        : "Kør en intern generalprøve på Webprinter og Salgsmapper før eksternt møde.",
      href: firstCriticalGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#critical-path",
    },
    {
      phase: "03",
      title: "Gennemfør pilotbevis og drift",
      status: operationsBlockers === 0 && proofReadyCount >= 2 ? "qa" : "blokeret",
      evidence: `${formatCount(proofReadyCount)}/${formatCount(pilotProofRuns.length)} pilottest er klar, og ${formatCount(operationsBlockers)} pilotdriftspunkter er blokeret.`,
      next: firstProofGap?.witness || firstOperationsGap?.operatorCheck || "Gem kun bevis efter en kontrolleret ordre er set i admin.",
      href: firstProofGap?.href || firstOperationsGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-proof-run",
    },
    {
      phase: "04",
      title: "Bekræft adminmail og adgang",
      status: accessBlockers === 0 ? "qa" : "blokeret",
      evidence: `${formatCount(adminAccessReadiness.length - accessBlockers)}/${formatCount(adminAccessReadiness.length)} adgangsområder er uden blokering.`,
      next: firstAccessGap
        ? firstAccessGap.manualCheck
        : "Kør manuel adgangstest med admin@webprinter.dk i alle pilotområder.",
      href: firstAccessGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#admin-access-readiness",
    },
    {
      phase: "05",
      title: "Klargør første trykkerisamtale",
      status: meetingBlockers === 0 && offerLinesOpen >= 5 ? "qa" : "blokeret",
      evidence: `${formatCount(printHouseMeetingPack.length - meetingBlockers)}/${formatCount(printHouseMeetingPack.length)} mødepunkter er uden blokering, og ${formatCount(offerLinesOpen)}/${formatCount(offerModel.length)} tilbudslinjer er åbne.`,
      next: firstMeetingGap?.say || "Brug mødepakken og tilbudsmodellen som manuskript, ikke som automatisk tilbudsgenerator.",
      href: firstMeetingGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-meeting-pack",
    },
    {
      phase: "06",
      title: "Gør salgsbeviset synligt",
      status: readyCriteriaCount >= 4 && seoVisibleDomains >= 1 ? "qa" : "planlagt",
      evidence: `${formatCount(readyCriteriaCount)}/${formatCount(commercialReadyCriteria.length)} commercial-ready kriterier er klar, og ${formatCount(seoVisibleDomains)}/${formatCount(seoVisibilityRows.length)} domæner har SEO/Search Console signaler.`,
      next: firstCommercialReadyGap
        ? firstCommercialReadyGap.next
        : "Saml pilotordre, tenantbeviser, SEO og ikke-løfter i salgsmappen før pitch.",
      href: firstCommercialReadyGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-ready-score",
    },
  ];
}

function getCommercialAutomationMap(
  goalExecutionPlan: CommercialGoalExecutionItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
  commercialDecisionsQueue: CommercialDecision[],
  pilotProofRuns: PilotProofRunItem[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  commercialReadyCriteria: CommercialReadyCriterion[],
): CommercialAutomationItem[] {
  const openGoalPhases = goalExecutionPlan.filter((item) => item.status !== "klar").length;
  const openPriorities = executivePriorityQueue.filter((item) => item.status !== "klar").length;
  const unresolvedDecisions = commercialDecisionsQueue.filter((item) => item.status !== "klar").length;
  const supplierDecisionBlockers = commercialDecisionsQueue.filter((item) => (
    item.owner === "Supplier Bank" && item.status === "blokeret"
  )).length;
  const proofGaps = pilotProofRuns.filter((item) => item.status !== "klar").length;
  const accessGaps = adminAccessReadiness.filter((item) => item.status !== "klar").length;
  const commercialReadyBlockers = commercialReadyCriteria.filter((item) => item.status === "blokeret").length;

  return [
    {
      title: "Cockpit, rapporter og sikre guardrails",
      mode: "auto",
      status: openGoalPhases < goalExecutionPlan.length ? "qa" : "planlagt",
      evidence: `${formatCount(goalExecutionPlan.length - openGoalPhases)}/${formatCount(goalExecutionPlan.length)} målfaser er klar; ${formatCount(openPriorities)} prioriterede punkter er stadig åbne.`,
      canDo: "Codex kan fortsætte med read-only cockpitlag, advarsler, links, rapportopsamling og dokumentation uden at skrive priser eller publicere produkter.",
      needsHuman: "Godkend når et guardrail skal blive til en egentlig write-handling, import eller publicering.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#goal-execution",
    },
    {
      title: "Produkt-, pris- og flow-synlighed",
      mode: "auto",
      status: commercialReadyBlockers === 0 ? "qa" : "blokeret",
      evidence: `${formatCount(commercialReadyCriteria.length - commercialReadyBlockers)}/${formatCount(commercialReadyCriteria.length)} commercial-ready kriterier er uden hård blokering.`,
      canDo: "Codex kan tilføje flere læsbare pris-preview signaler, produkthandoff-checks og admin-advarsler på de flows der allerede findes.",
      needsHuman: "En operatør skal stadig åbne produktet, se pris-previewet og bevidne at kunden kan bruge flowet.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-ready-score",
    },
    {
      title: "Tenant proof og pilotordre",
      mode: "manual",
      status: proofGaps === 0 ? "klar" : "qa",
      evidence: `${formatCount(pilotProofRuns.length - proofGaps)}/${formatCount(pilotProofRuns.length)} pilottest er markeret klar i cockpittets beviser.`,
      canDo: "Codex kan gøre tjeklisten kortere, linke til de rigtige sider og fremhæve næste manglende bevis.",
      needsHuman: "Du eller en operatør skal gennemføre Webprinter, Salgsmapper og Onlinetryksager i browseren og bekræfte at ordren lander i admin.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-proof-run",
    },
    {
      title: "admin@webprinter.dk adgangstest",
      mode: "manual",
      status: accessGaps === 0 ? "klar" : "qa",
      evidence: `${formatCount(adminAccessReadiness.length - accessGaps)}/${formatCount(adminAccessReadiness.length)} adgangsområder er uden åben blokering.`,
      canDo: "Codex kan holde adgangslisten og de rigtige adminlinks opdateret.",
      needsHuman: "Login med adminmailen skal bevidnes manuelt, fordi det afhænger af session, rolle og Supabase Auth.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#admin-access-readiness",
    },
    {
      title: "CEO scope, pilotpris og ikke-løfter",
      mode: "decision",
      status: unresolvedDecisions === 0 ? "klar" : "blokeret",
      evidence: `${formatCount(unresolvedDecisions)} ledelses-/produktbeslutninger er ikke markeret klar.`,
      canDo: "Codex kan formulere valgmuligheder, konsekvenser, pilotpakke og ikke-løfter.",
      needsHuman: "Du skal beslutte første pilotprodukt for Onlinetryksager, betalingsmodel, demo-script og kommerciel prisramme.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#decision-queue",
    },
    {
      title: "Supplier Bank fra staging til live",
      mode: "decision",
      status: supplierDecisionBlockers > 0 ? "blokeret" : "qa",
      evidence: `${formatCount(supplierDecisionBlockers)} Supplier Bank beslutninger blokerer live-forklaring eller publicering.`,
      canDo: "Codex kan holde banken som staging, opdatere rapporter og tilføje advarsler før import/publicering.",
      needsHuman: "Live import, publicering, Pixart write-gates og gammel WMD-publicering kræver eksplicit beslutning.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
  ];
}

function getCommercialFocusItems(
  automationMap: CommercialAutomationItem[],
  commercialDecisionsQueue: CommercialDecision[],
): CommercialFocusItem[] {
  const safeCodexStep = automationMap.find((item) => item.mode === "auto" && item.status !== "blokeret")
    || automationMap.find((item) => item.mode === "auto")
    || null;
  const manualProofStep = automationMap.find((item) => item.mode === "manual" && item.status !== "klar")
    || automationMap.find((item) => item.mode === "manual")
    || null;
  const firstDecision = commercialDecisionsQueue.find((item) => item.status === "blokeret")
    || commercialDecisionsQueue.find((item) => item.status === "qa")
    || commercialDecisionsQueue.find((item) => item.status === "planlagt")
    || null;

  return [
    {
      title: "Næste sikre systemskridt",
      label: safeCodexStep ? automationModeLabels[safeCodexStep.mode] : "Kan automatiseres",
      status: safeCodexStep?.status || "planlagt",
      summary: safeCodexStep?.evidence || "Der mangler et sikkert systemspor at fortsætte fra.",
      next: safeCodexStep?.canDo || "Brug Måleksekvering til at vælge næste read-only forbedring.",
      href: safeCodexStep?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#goal-execution",
      cta: "Åbn systemspor",
    },
    {
      title: "Næste manuelle bevis",
      label: manualProofStep ? automationModeLabels[manualProofStep.mode] : "Kræver manuel bevisførelse",
      status: manualProofStep?.status || "qa",
      summary: manualProofStep?.evidence || "De manuelle proof-punkter skal gennemgås i browser og admin.",
      next: manualProofStep?.needsHuman || "Gennemfør første pilotflow manuelt og bekræft beviset.",
      href: manualProofStep?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-proof-run",
      cta: "Åbn manuel QA",
    },
    {
      title: "Første beslutning før live",
      label: firstDecision?.owner || "Ledelse",
      status: firstDecision?.status || "planlagt",
      summary: firstDecision?.impact || "Ingen beslutning er markeret som første stop i køen.",
      next: firstDecision?.decision || "Gennemgå beslutningskøen før næste live-ændring.",
      href: firstDecision?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#decision-queue",
      cta: "Åbn beslutning",
    },
  ];
}

function getExternalDemoBoundary(
  launchBoard: LaunchBoardItem[],
  salesEvidenceBinder: SalesEvidenceItem[],
  printHouseMeetingPack: PrintHouseMeetingPackItem[],
  commercialGates: CommercialGate[],
): ExternalDemoBoundaryItem[] {
  const externalDemo = launchBoard.find((item) => item.title === "Ekstern trykkeri-demo");
  const salgsmapperProof = salesEvidenceBinder.find((item) => item.claim === "Designer/template flow kan vises på et nicheprodukt");
  const orderProof = salesEvidenceBinder.find((item) => item.claim === "Ordreflow kan følges fra kunde til admin");
  const supplierProof = salesEvidenceBinder.find((item) => item.claim === "Supplier Bank kan vises som kontrolleret sourcing");
  const seoProof = salesEvidenceBinder.find((item) => item.claim === "SEO og synlighed kan kobles til platformen");
  const meetingNotPromises = printHouseMeetingPack.find((item) => item.title === "4. Hvad der ikke må loves");
  const supplierGate = commercialGates.find((gate) => gate.title === "Supplier Bank risici");
  const paymentPromise = launchBoard.find((item) => item.title === "Pris- og betalingsløfte");

  return [
    {
      title: "Platform og tenant-koncept",
      audience: "Må vises eksternt",
      status: externalDemo?.status || "qa",
      allowed: externalDemo?.verdict === "Pilot-demo mulig"
        ? "Vis Webprinter som pilotklar platform med ejede tenants og tydelige grænser."
        : "Vis kun som intern generalprøve, indtil Webprinter og Salgsmapper proof er lukket.",
      risk: externalDemo?.basis || "Ekstern demo kræver klare beviser fra go/no-go boardet.",
      href: externalDemo?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#launch-board",
    },
    {
      title: "Salgsmapper skabelonflow",
      audience: "Må vises som niche-proof",
      status: salgsmapperProof?.status || "blokeret",
      allowed: "Vis template/download/designer som et konkret eksempel på et produktstyret designflow.",
      risk: salgsmapperProof?.gap || "Må ikke præsenteres som færdig for alle produkter før flere templates er bekræftet.",
      href: salgsmapperProof?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "Første pilotordre",
      audience: "Pilot-only",
      status: orderProof?.status || "qa",
      allowed: "Vis ordreflowet som et kontrolleret pilotbevis, når ordren kan findes fra kunde til admin.",
      risk: orderProof?.gap || "Må ikke sælges som fuld drift før betaling, produktionsejer og support er afklaret.",
      href: orderProof?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "SEO og synlighed",
      audience: "Må vises som read-only rapportering",
      status: seoProof?.status || "planlagt",
      allowed: "Vis SEO/Search Console som synlighedsrapportering, når domænesignaler kan læses i cockpit eller Platform SEO.",
      risk: seoProof?.gap || "Må ikke loves som garanteret Google-performance eller automatisk indeksering.",
      href: seoProof?.href || "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "Supplier Bank",
      audience: "Kun intern staging",
      status: supplierGate?.status === "blokeret" ? "blokeret" : supplierProof?.status || "qa",
      allowed: "Vis kun Supplier Bank som kontrolleret sourcing/staging med approval-gated import.",
      risk: meetingNotPromises?.evidence || supplierProof?.gap || "Må ikke loves som fuld automatisk sourcing, livepriser eller publicering.",
      href: supplierProof?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "Pris, betaling og leveranceløfte",
      audience: "Må ikke loves endnu",
      status: paymentPromise?.status || "blokeret",
      allowed: paymentPromise?.status === "qa"
        ? "Tal om det som næsten salgbart og afklar betalingsform og supportmodel før eksternt løfte."
        : "Tal kun om retningen: pris-preview, checkout og adminordre skal bevises sammen før salgsløfte.",
      risk: paymentPromise?.basis || "Hvis dette loves for tidligt, skaber det forventning om produktionsklar drift før pilotordre, betaling og support er bevist.",
      href: paymentPromise?.href || "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
  ];
}

function getCommercialPilotAcceptanceGate(
  commercialReadyCriteria: CommercialReadyCriterion[],
  externalDemoBoundary: ExternalDemoBoundaryItem[],
  pilotOperationsRunbook: PilotOperationsRunbookItem[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  offerModel: PrintHouseOfferItem[],
  commercialDecisionsQueue: CommercialDecision[],
): CommercialPilotAcceptanceItem[] {
  const firstReadyGap = getFirstOpenItem(commercialReadyCriteria);
  const externalBoundaryBlockers = externalDemoBoundary.filter((item) => item.status === "blokeret").length;
  const operationsBlockers = pilotOperationsRunbook.filter((item) => item.status === "blokeret").length;
  const accessBlockers = adminAccessReadiness.filter((item) => item.status === "blokeret").length;
  const offerBlockers = offerModel.filter((item) => item.status === "blokeret").length;
  const unresolvedDecisions = commercialDecisionsQueue.filter((item) => item.status !== "klar").length;
  const readyCriteriaCount = commercialReadyCriteria.filter((item) => item.status === "klar").length;
  const operationsReadyCount = pilotOperationsRunbook.filter((item) => item.status === "klar").length;
  const accessReadyCount = adminAccessReadiness.filter((item) => item.status === "klar").length;
  const offerOpenCount = offerModel.filter((item) => item.status !== "blokeret").length;
  const firstOperationsGap = getFirstOpenItem(pilotOperationsRunbook);
  const firstAccessGap = getFirstOpenItem(adminAccessReadiness);
  const firstOfferGap = getFirstOpenItem(offerModel);
  const firstDecisionGap = getFirstOpenItem(commercialDecisionsQueue);
  const firstBoundaryGap = getFirstOpenItem(externalDemoBoundary);

  return [
    {
      title: "1. Commercial-ready score må ikke have hårde blockers",
      status: commercialReadyCriteria.some((item) => item.status === "blokeret") ? "blokeret" : "qa",
      acceptance: "Mindst ingen blokerede scorecard-punkter før en pilotkunde får et løfte om drift.",
      evidence: `${formatCount(readyCriteriaCount)}/${formatCount(commercialReadyCriteria.length)} commercial-ready kriterier er klar.`,
      next: firstReadyGap?.next || "Kør intern accepttest mod hele scorecardet.",
      href: firstReadyGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-ready-score",
    },
    {
      title: "2. Ekstern demo-grænse skal være accepteret",
      status: externalBoundaryBlockers === 0 ? "qa" : "blokeret",
      acceptance: "Alle i mødet skal vide hvad der må vises, hvad der er pilot-only, og hvad der skal holdes internt.",
      evidence: `${formatCount(externalDemoBoundary.length - externalBoundaryBlockers)}/${formatCount(externalDemoBoundary.length)} demo-grænser er uden blokering.`,
      next: firstBoundaryGap?.risk || "Gennemgå demo-grænsen før første print-house samtale.",
      href: firstBoundaryGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
    {
      title: "3. Pilotdrift skal kunne gennemføres manuelt",
      status: operationsBlockers === 0 && operationsReadyCount >= 2 ? "qa" : "blokeret",
      acceptance: "En ordre skal kunne håndteres manuelt med kunde, produkt, prisgrundlag, fil, betaling, produktion og korrektur.",
      evidence: `${formatCount(operationsReadyCount)}/${formatCount(pilotOperationsRunbook.length)} pilotdriftspunkter er klar, ${formatCount(operationsBlockers)} er blokeret.`,
      next: firstOperationsGap?.operatorCheck || "Gennemgå første kontrollerede ordre i admin.",
      href: firstOperationsGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-operations-runbook",
    },
    {
      title: "4. Adminmail skal kunne drive piloten",
      status: accessBlockers === 0 ? "qa" : "blokeret",
      acceptance: "admin@webprinter.dk skal manuelt kunne åbne de adminområder der kræves for pilotdrift.",
      evidence: `${formatCount(accessReadyCount)}/${formatCount(adminAccessReadiness.length)} adgangspunkter er klar, ${formatCount(accessBlockers)} er blokeret.`,
      next: firstAccessGap?.manualCheck || "Kør adgangslisten som manuel test med adminmailen.",
      href: firstAccessGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#admin-access-readiness",
    },
    {
      title: "5. Tilbudspakken skal være mulig at forklare uden teknik",
      status: offerBlockers === 0 && offerOpenCount >= 6 ? "qa" : "planlagt",
      acceptance: "Pilotkunden skal kunne forstå setup, første produktpakke, designer/upload, ordreflow, support og prisramme.",
      evidence: `${formatCount(offerOpenCount)}/${formatCount(offerModel.length)} tilbudslinjer er ikke blokerede.`,
      next: firstOfferGap?.decision || "Afklar pilotpris, inkluderede timer og hvad der er uden for første aftale.",
      href: firstOfferGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
    {
      title: "6. CEO-beslutninger skal have en ejer",
      status: unresolvedDecisions === 0 ? "klar" : "qa",
      acceptance: "Åbne ledelsesbeslutninger må gerne eksistere, men de skal være synlige før en ekstern pilot aftales.",
      evidence: `${formatCount(unresolvedDecisions)} beslutninger er ikke markeret klar i beslutningskøen.`,
      next: firstDecisionGap?.decision || "Gennemgå beslutningskøen før piloten sælges.",
      href: firstDecisionGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#decision-queue",
    },
  ];
}

function getPilotResponsibilityMap(
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
  pilotOperationsRunbook: PilotOperationsRunbookItem[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  externalDemoBoundary: ExternalDemoBoundaryItem[],
  offerModel: PrintHouseOfferItem[],
  seoVisibilityRows: SeoVisibilityRow[],
): PilotResponsibilityItem[] {
  const firstAcceptanceGap = getFirstOpenItem(commercialPilotAcceptance);
  const orderOperations = pilotOperationsRunbook.find((item) => item.title.includes("Ordre"));
  const fileOperations = pilotOperationsRunbook.find((item) => item.title.includes("PDF"));
  const supportOperations = pilotOperationsRunbook.find((item) => item.title.includes("Korrektur") || item.title.includes("kommunikation"));
  const adminAccessGap = getFirstOpenItem(adminAccessReadiness);
  const demoBoundaryGap = getFirstOpenItem(externalDemoBoundary);
  const offerGap = getFirstOpenItem(offerModel);
  const seoVisible = seoVisibilityRows.filter((row) => row.status === "klar" || row.status === "qa").length;
  const supplierBoundary = externalDemoBoundary.find((item) => item.title === "Supplier Bank");
  const paymentBoundary = externalDemoBoundary.find((item) => item.title === "Pris, betaling og leveranceløfte");

  return [
    {
      owner: "CEO",
      title: "Pilot-go/no-go og salgsgrænse",
      status: firstAcceptanceGap?.status || "qa",
      responsibility: "Eje beslutningen om hvornår en trykkeripilot må vises, sælges eller holdes som intern generalprøve.",
      proof: firstAcceptanceGap?.evidence || "Pilotaccepten samler de aktuelle go/no-go signaler.",
      risk: firstAcceptanceGap?.next || "Uden tydeligt ejerskab kan systemet blive solgt bredere end beviserne bærer.",
      href: firstAcceptanceGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
    {
      owner: "Produkt",
      title: "Første produktpakke og kunderejse",
      status: offerGap?.status || "planlagt",
      responsibility: "Eje hvilke 3-5 produkter der indgår i pilotpakken, og hvad kunden faktisk kan vælge i første version.",
      proof: offerGap?.proof || "Tilbudsmodellen beskriver produktpakke, designer/upload, ordreflow og support.",
      risk: offerGap?.decision || "Hvis produktpakken er for bred, bliver pilotens support og prisgrundlag uklart.",
      href: offerGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
    {
      owner: "Drift",
      title: "Ordrebehandling og produktionshandoff",
      status: orderOperations?.status || "blokeret",
      responsibility: "Eje den manuelle ordrevej fra kunde og fil til admin, produktion, korrektur og levering.",
      proof: orderOperations?.evidence || "Pilotdrift runbook skal vise hvordan første ordre håndteres.",
      risk: orderOperations?.operatorCheck || "Hvis drift ikke er ejet, bliver første ordre en udviklingsopgave i stedet for en pilotproces.",
      href: orderOperations?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-operations-runbook",
    },
    {
      owner: "Designer/preflight",
      title: "Fil, PDF, template og korrektur",
      status: fileOperations?.status || "qa",
      responsibility: "Eje om kunden bruger designer, upload eller template, og hvordan filen kontrolleres før produktion.",
      proof: fileOperations?.evidence || "Pilotdrift runbook og Salgsmapper proof viser template/PDF-håndteringen.",
      risk: fileOperations?.operatorCheck || "Hvis filansvaret er uklart, kan en ordre se færdig ud uden produktionsklar fil.",
      href: fileOperations?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-operations-runbook",
    },
    {
      owner: "Admin/adgang",
      title: "admin@webprinter.dk og rollecheck",
      status: adminAccessGap?.status || "qa",
      responsibility: "Eje manuel adgangstest til produkter, designer/templates, ordrer, SEO, Supplier Bank og indstillinger.",
      proof: adminAccessGap?.evidence || "Adgangsberedskabet viser hvilke adminområder skal testes.",
      risk: adminAccessGap?.manualCheck || "Hvis adminmailen ikke kan åbne pilotområderne, kan piloten ikke drives uden udviklerhjælp.",
      href: adminAccessGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#admin-access-readiness",
    },
    {
      owner: "SEO/rapportering",
      title: "Synlighed og Search Console bevis",
      status: seoVisible > 0 ? "qa" : "planlagt",
      responsibility: "Eje hvilke domæner og sider der kan vises med SEO-rækker, Search Console status og trafikbevis.",
      proof: `${formatCount(seoVisible)}/${formatCount(seoVisibilityRows.length)} domæner har SEO/Search Console signaler eller QA-status.`,
      risk: "SEO må vises som rapportering, ikke som garanti for Google-performance eller automatisk indeksering.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      owner: "Sourcing",
      title: "Supplier Bank og ikke-løfter",
      status: supplierBoundary?.status || "blokeret",
      responsibility: "Eje forklaringen om at Supplier Bank er staging og sourcing, ikke fuld automatisk livepricing/publicering.",
      proof: supplierBoundary?.allowed || "Supplier Bank skal holdes som intern staging med approval-gated import.",
      risk: supplierBoundary?.risk || "Hvis sourcing loves for tidligt, bliver åbne supplier-gates et kommercielt problem.",
      href: supplierBoundary?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      owner: "Økonomi/support",
      title: "Prisramme, betaling og supportniveau",
      status: paymentBoundary?.status || "blokeret",
      responsibility: "Eje hvad pilotkunden betaler for, hvad der er inkluderet, og hvornår support eller integration er ekstra.",
      proof: paymentBoundary?.allowed || "Pris, betaling og leveranceløfte skal være tydeligt afgrænset før salg.",
      risk: paymentBoundary?.risk || "Hvis økonomi og support ikke er afklaret, bliver pilotkunden et åbent projekt uden grænser.",
      href: paymentBoundary?.href || "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
    {
      owner: "Kundeservice",
      title: "Korrektur og kundekommunikation",
      status: supportOperations?.status || "qa",
      responsibility: "Eje hvad kunden får at vide om korrektur, spørgsmål, ændringer, levering og hvornår en ordre er godkendt.",
      proof: supportOperations?.evidence || "Pilotdrift runbook beskriver korrektur og kundekommunikation.",
      risk: supportOperations?.operatorCheck || "Hvis kundekommunikation ikke er ejet, bliver første pilotordre svær at bruge som salgsbevis.",
      href: supportOperations?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-operations-runbook",
    },
    {
      owner: "Demoansvarlig",
      title: "Hvad der vises i mødet",
      status: demoBoundaryGap?.status || "qa",
      responsibility: "Eje demoens rækkefølge og stoppe alt der ikke må loves endnu.",
      proof: demoBoundaryGap?.allowed || "Ekstern demo-grænse viser hvad der må nævnes og hvad der skal holdes internt.",
      risk: demoBoundaryGap?.risk || "Uden demoansvarlig kan interne staging-features ligne færdige produktløfter.",
      href: demoBoundaryGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
  ];
}

function getPilotScopeAgreement(
  offerModel: PrintHouseOfferItem[],
  externalDemoBoundary: ExternalDemoBoundaryItem[],
  pilotResponsibilityMap: PilotResponsibilityItem[],
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
): PilotScopeAgreementItem[] {
  const tenantOffer = offerModel.find((item) => item.title.includes("Tenant"));
  const productOffer = offerModel.find((item) => item.title.includes("produktpakke"));
  const designerOffer = offerModel.find((item) => item.title.includes("Designer"));
  const checkoutOffer = offerModel.find((item) => item.title.includes("Checkout"));
  const seoOffer = offerModel.find((item) => item.title.includes("SEO"));
  const supplierOffer = offerModel.find((item) => item.title.includes("Supplier Bank"));
  const supportOffer = offerModel.find((item) => item.title.includes("Support"));
  const priceOffer = offerModel.find((item) => item.title.includes("prisramme"));
  const supplierBoundary = externalDemoBoundary.find((item) => item.title === "Supplier Bank");
  const paymentBoundary = externalDemoBoundary.find((item) => item.title === "Pris, betaling og leveranceløfte");
  const productOwner = pilotResponsibilityMap.find((item) => item.owner === "Produkt");
  const operationsOwner = pilotResponsibilityMap.find((item) => item.owner === "Drift");
  const supportOwner = pilotResponsibilityMap.find((item) => item.owner === "Kundeservice");
  const acceptanceBlockers = commercialPilotAcceptance.filter((item) => item.status === "blokeret").length;

  return [
    {
      title: "Pilottenant og branding",
      category: "Inkluderet",
      status: tenantOffer?.status || "qa",
      included: tenantOffer?.packageLine || "Én branded tenant med domæne, branding, sider og adminadgang.",
      excluded: "Ingen fuld multi-tenant rollout, white-label videresalg eller parallel onboarding af flere trykkerier i første pilot.",
      decision: tenantOffer?.decision || "Vælg pilotdomæne, brandingansvar og om piloten starter på subdomæne eller eget domæne.",
      href: tenantOffer?.href || "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      title: "Første produktpakke",
      category: "Inkluderet",
      status: productOffer?.status || "blokeret",
      included: productOffer?.packageLine || "3-5 produkter med kendt produktflow, prisansvar og afgrænset kunderejse.",
      excluded: "Ingen fuld leverandørbank, alle produktfamilier eller automatiske prisopdateringer som første scope.",
      decision: productOwner?.risk || productOffer?.decision || "Vælg pilotens første produktfamilier og prisansvar.",
      href: productOffer?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "Designer, upload og PDF-skabeloner",
      category: "Inkluderet",
      status: designerOffer?.status || "blokeret",
      included: designerOffer?.packageLine || "Kontrolleret designer/upload/template-flow for godkendte pilotprodukter.",
      excluded: "Ingen garanti for alle filtyper, OCR, PDF/A, automatisk preflight eller alle skabeloner i første pilot.",
      decision: designerOffer?.decision || "Aftal hvilke produkter bruger designer, upload eller downloadskabelon.",
      href: designerOffer?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "Checkout, ordre og produktion",
      category: "Pilot-only",
      status: checkoutOffer?.status || "blokeret",
      included: checkoutOffer?.packageLine || "Kundeordre til admin-overblik, korrektur, manuel produktionshandoff og levering.",
      excluded: "Ingen fuld automatisk produktion, supplier-submit, live betalingsgaranti eller ERP-integration i første scope.",
      decision: operationsOwner?.risk || checkoutOffer?.decision || "Beslut betalingsform, korrekturansvar og hvornår en ordre er produktionsklar.",
      href: checkoutOffer?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "SEO og synlighedsrapport",
      category: "Read-only bevis",
      status: seoOffer?.status || "planlagt",
      included: seoOffer?.packageLine || "Read-only SEO/Search Console overblik for pilotdomænet.",
      excluded: "Ingen garanti for Google-placeringer, trafik, indeksering eller automatisk SEO-optimering.",
      decision: seoOffer?.decision || "Aftal hvilke KPI'er pilottrykkeriet skal se og hvem der ejer Google-adgang.",
      href: seoOffer?.href || "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "Supplier Bank og sourcing",
      category: "Internt/staging",
      status: supplierBoundary?.status || supplierOffer?.status || "blokeret",
      included: supplierOffer?.packageLine || "Supplier Bank som intern sourcing og draft-import med approval-gates.",
      excluded: supplierBoundary?.risk || "Ingen automatisk livepricing, publicering, supplier-sync eller ukontrolleret import i første pilot.",
      decision: supplierOffer?.decision || "Beslut hvilke supplier-produkter må bruges, og hvad der eksplicit ikke loves.",
      href: supplierOffer?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "Support, onboarding og ændringer",
      category: "Inkluderet med grænse",
      status: supportOffer?.status || "planlagt",
      included: supportOffer?.packageLine || "Kort onboarding, admintræning, ordrebehandling og supportansvar.",
      excluded: "Ingen ubegrænset support, frie designændringer, specialintegrationer eller løbende produktvedligehold uden aftale.",
      decision: supportOwner?.risk || supportOffer?.decision || "Beslut supportniveau, svartid og hvad der er ekstraarbejde.",
      href: supportOffer?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "Prisramme og betalingsmodel",
      category: "Ledelsesbeslutning",
      status: paymentBoundary?.status || priceOffer?.status || "planlagt",
      included: priceOffer?.packageLine || "Pilotpris, månedlig platform, support og eventuelle integrationsfaser.",
      excluded: paymentBoundary?.risk || "Ingen fast pris, betalingsløfte eller leverancegaranti uden pilotbeslutning.",
      decision: priceOffer?.decision || "Sæt pilotpris, månedlig pris, inkluderede timer og hvad der ligger uden for aftalen.",
      href: priceOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
    {
      title: "Pilot-go/no-go",
      category: "Acceptkrav",
      status: acceptanceBlockers === 0 ? "qa" : "blokeret",
      included: "Piloten kan først præsenteres som kundepilot når acceptpunkterne ikke har hårde blockers.",
      excluded: "Ingen kundepilot må aftales hvis scorecard, drift, adgang eller demo-grænse stadig har blokerende punkter.",
      decision: acceptanceBlockers === 0
        ? "Kør intern generalprøve og brug scopekortet som pilotramme."
        : "Luk blokerende pilotacceptpunkter før scope bruges i salg.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
  ];
}

function getPrintHousePilotOnboardingPlan(
  pilotScopeAgreement: PilotScopeAgreementItem[],
  pilotPrintHouseIntake: PilotPrintHouseIntakeItem[],
  pilotResponsibilityMap: PilotResponsibilityItem[],
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
): PilotOnboardingStep[] {
  const acceptanceBlockers = commercialPilotAcceptance.filter((item) => item.status === "blokeret").length;
  const scopeBlockers = pilotScopeAgreement.filter((item) => item.status === "blokeret").length;
  const firstAcceptanceGap = getFirstOpenItem(commercialPilotAcceptance);
  const tenantIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Tenant"));
  const brandIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Brand"));
  const productIntake = pilotPrintHouseIntake.find((item) => item.title.includes("produkt"));
  const pricingIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Pris"));
  const templateIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Skabeloner"));
  const checkoutIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Checkout"));
  const seoIntake = pilotPrintHouseIntake.find((item) => item.title.includes("SEO"));
  const sourcingIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Sourcing"));
  const tenantScope = pilotScopeAgreement.find((item) => item.title.includes("Pilottenant"));
  const productScope = pilotScopeAgreement.find((item) => item.title.includes("produktpakke"));
  const designerScope = pilotScopeAgreement.find((item) => item.title.includes("Designer"));
  const checkoutScope = pilotScopeAgreement.find((item) => item.title.includes("Checkout"));
  const supportScope = pilotScopeAgreement.find((item) => item.title.includes("Support"));
  const priceScope = pilotScopeAgreement.find((item) => item.title.includes("Prisramme"));
  const demoOwner = pilotResponsibilityMap.find((item) => item.owner === "Demoansvarlig");
  const adminOwner = pilotResponsibilityMap.find((item) => item.owner === "Admin/adgang");
  const operationsOwner = pilotResponsibilityMap.find((item) => item.owner === "Drift");

  return [
    {
      step: "01",
      title: "Luk intern pilotaccept før kickoff",
      owner: "CEO",
      status: acceptanceBlockers === 0 ? "qa" : "blokeret",
      action: acceptanceBlockers === 0
        ? "Book kickoff som kontrolleret pilot, ikke som fuldt salg."
        : "Luk blokerende acceptpunkter før kunden onboardes.",
      evidence: firstAcceptanceGap?.evidence || "Pilotaccepten samler de aktuelle go/no-go signaler.",
      stopCondition: firstAcceptanceGap?.next || "Stop hvis scorecard, drift, adgang eller demo-grænse har hårde blockers.",
      href: firstAcceptanceGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
    {
      step: "02",
      title: "Indsaml tenant, domæne og brand",
      owner: "Kunde + branding",
      status: tenantIntake?.status === "blokeret" || brandIntake?.status === "blokeret" ? "blokeret" : tenantScope?.status || "qa",
      action: "Indsaml domæne/subdomæne, logo, farver, fonte, kontaktdata, footer og brandtone.",
      evidence: `${tenantIntake?.needed || "Tenant/domæne skal afklares."} ${brandIntake?.needed || "Brandmateriale skal afklares."}`,
      stopCondition: tenantScope?.excluded || "Stop hvis piloten kræver flere tenants eller white-label rollout i første scope.",
      href: tenantScope?.href || "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      step: "03",
      title: "Lås produktpakke og prisansvar",
      owner: "Produkt",
      status: productScope?.status || productIntake?.status || "blokeret",
      action: "Vælg 3-5 første produkter, formatvalg, prisansvar, marginramme og hvem der må ændre priser.",
      evidence: `${productIntake?.needed || "Første produktpakke skal vælges."} ${pricingIntake?.needed || "Prisgrundlag skal have ejer."}`,
      stopCondition: productScope?.excluded || "Stop hvis kunden forventer fuldt katalog eller automatiske leverandørprisopdateringer.",
      href: productScope?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      step: "04",
      title: "Aftal designer, upload og PDF-skabeloner",
      owner: "Designer/preflight",
      status: designerScope?.status || templateIntake?.status || "blokeret",
      action: "Aftal hvilke pilotprodukter bruger designer, upload, downloadskabelon, bleed/fals/ryg-regler og korrektur.",
      evidence: templateIntake?.needed || designerScope?.included || "Skabelon- og filflow skal være kendt før produktet kan sælges.",
      stopCondition: designerScope?.excluded || "Stop hvis kunden forventer fuld PDF-automatik eller alle skabeloner fra start.",
      href: designerScope?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      step: "05",
      title: "Kør ordre- og adminprøve",
      owner: "Drift",
      status: checkoutScope?.status || operationsOwner?.status || "blokeret",
      action: "Gennemfør en intern ordrevej fra prisvalg/design eller upload til admin, korrektur, produktion og levering.",
      evidence: checkoutIntake?.needed || operationsOwner?.proof || "Ordreflowet skal kunne håndteres manuelt før go-live.",
      stopCondition: checkoutScope?.excluded || "Stop hvis første ordre kræver fuld automatisk produktion, supplier-submit eller ERP-integration.",
      href: checkoutScope?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      step: "06",
      title: "Bekræft adminmail og adgang",
      owner: "Admin/adgang",
      status: adminOwner?.status || "qa",
      action: "Log ind som admin@webprinter.dk og bekræft adgang til pilotens produkter, templates, ordrer, SEO og Supplier Bank.",
      evidence: adminOwner?.proof || "Adgangsberedskabet viser hvilke adminområder skal testes.",
      stopCondition: adminOwner?.risk || "Stop hvis adminmailen ikke kan drive pilotområderne uden udviklerhjælp.",
      href: adminOwner?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#admin-access-readiness",
    },
    {
      step: "07",
      title: "Afklar SEO og rapportering",
      owner: "SEO/rapportering",
      status: seoIntake?.status || "planlagt",
      action: "Aftal hvilke domæner, Search Console-adgang, SEO-rækker og KPI'er kunden må se i pilotrapportering.",
      evidence: seoIntake?.needed || "SEO/Search Console skal holdes som read-only synlighed, ikke performancegaranti.",
      stopCondition: "Stop hvis kunden forventer garanteret ranking, trafik eller automatisk indeksering.",
      href: seoIntake?.href || "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      step: "08",
      title: "Afgræns Supplier Bank og sourcing",
      owner: "Sourcing",
      status: sourcingIntake?.status || "blokeret",
      action: "Aftal hvilke leverandørdata må bruges som staging, og hvad der ikke må beskrives som automatisk livepricing.",
      evidence: sourcingIntake?.needed || "Supplier Bank skal holdes approval-gated og forklares som staging.",
      stopCondition: "Stop hvis piloten kræver åbne supplier-gates, ukontrolleret import eller live publicering.",
      href: sourcingIntake?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      step: "09",
      title: "Lås support, økonomi og ændringsgrænse",
      owner: "Økonomi/support",
      status: supportScope?.status === "blokeret" || priceScope?.status === "blokeret" ? "blokeret" : supportScope?.status || priceScope?.status || "planlagt",
      action: "Beslut pilotpris, månedlig pris, inkluderede timer, supportniveau, svartid og hvad der er ekstraarbejde.",
      evidence: `${supportScope?.included || "Support skal afgrænses."} ${priceScope?.included || "Prisramme skal besluttes."}`,
      stopCondition: supportScope?.excluded || priceScope?.excluded || "Stop hvis support eller betaling er åbent uden grænse.",
      href: priceScope?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-scope-agreement",
    },
    {
      step: "10",
      title: "Kør generalprøve før kundekickoff",
      owner: "Demoansvarlig",
      status: acceptanceBlockers === 0 && scopeBlockers === 0 ? "qa" : "blokeret",
      action: "Gennemgå demo, scope, ansvar, første ordre og ikke-løfter internt før kunden får adgang.",
      evidence: demoOwner?.proof || "Demoansvarlig skal eje hvad der vises og stoppe ikke-løfter.",
      stopCondition: demoOwner?.risk || "Stop hvis interne staging-features ligner færdige produktløfter.",
      href: demoOwner?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
  ];
}

function getPilotSuccessCriteria(
  commercialReadyCriteria: CommercialReadyCriterion[],
  pilotOnboardingPlan: PilotOnboardingStep[],
  pilotScopeAgreement: PilotScopeAgreementItem[],
  pilotOperationsRunbook: PilotOperationsRunbookItem[],
  salesEvidenceBinder: SalesEvidenceItem[],
  seoVisibilityRows: SeoVisibilityRow[],
  externalDemoBoundary: ExternalDemoBoundaryItem[],
): PilotSuccessCriterion[] {
  const onboardingBlockers = pilotOnboardingPlan.filter((item) => item.status === "blokeret").length;
  const scopeBlockers = pilotScopeAgreement.filter((item) => item.status === "blokeret").length;
  const readyCriteriaBlockers = commercialReadyCriteria.filter((item) => item.status === "blokeret").length;
  const readyCriteriaDone = commercialReadyCriteria.filter((item) => item.status === "klar").length;
  const operationsBlockers = pilotOperationsRunbook.filter((item) => item.status === "blokeret").length;
  const operationsReady = pilotOperationsRunbook.filter((item) => item.status === "klar").length;
  const orderProof = salesEvidenceBinder.find((item) => item.claim === "Ordreflow kan følges fra kunde til admin");
  const productProof = salesEvidenceBinder.find((item) => item.claim === "Kunden kan se et produkt med pris-preview");
  const templateProof = salesEvidenceBinder.find((item) => item.claim === "Designer/template flow kan vises på et nicheprodukt");
  const seoProof = salesEvidenceBinder.find((item) => item.claim === "SEO og synlighed kan kobles til platformen");
  const supplierBoundary = externalDemoBoundary.find((item) => item.title === "Supplier Bank");
  const paymentBoundary = externalDemoBoundary.find((item) => item.title === "Pris, betaling og leveranceløfte");
  const seoReady = seoVisibilityRows.filter((row) => row.status === "klar").length;
  const seoVisible = seoVisibilityRows.filter((row) => row.status === "klar" || row.status === "qa").length;

  return [
    {
      title: "1. Pilot kan startes uden hårde blockers",
      status: onboardingBlockers === 0 && scopeBlockers === 0 ? "qa" : "blokeret",
      metric: `${formatCount(onboardingBlockers)} onboarding stop-punkter og ${formatCount(scopeBlockers)} scope blockers.`,
      success: "Alle onboarding- og scope-stop er lukket før kunden får pilotadgang.",
      pauseIf: "Pause hvis kunden kræver funktioner der ligger uden for scopekortet.",
      decision: onboardingBlockers === 0 && scopeBlockers === 0
        ? "Kør intern generalprøve og planlæg kundekickoff."
        : "Luk stop-punkterne før pilotstart.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-onboarding-plan",
    },
    {
      title: "2. Produkt, pris og template er bevist",
      status: productProof?.status === "klar" && templateProof?.status === "klar" ? "klar" : "blokeret",
      metric: `${productProof?.proof || "Produkt/pris-bevis mangler."} ${templateProof?.proof || "Templatebevis mangler."}`,
      success: "Piloten kan vise mindst ét prisfast produkt og ét konkret template/designer-flow.",
      pauseIf: "Pause hvis pilotproduktet mangler pris-preview, template, uploadvej eller forklarlig kunderejse.",
      decision: productProof?.status === "klar" && templateProof?.status === "klar"
        ? "Brug disse to proof points som pilotens minimumsprodukt."
        : "Luk produkt/pris og templatebevis før kundekickoff.",
      href: productProof?.href || templateProof?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "3. Første ordre kan håndteres manuelt",
      status: orderProof?.status === "klar" || operationsBlockers === 0 ? "qa" : "blokeret",
      metric: `${formatCount(operationsReady)}/${formatCount(pilotOperationsRunbook.length)} pilotdriftspunkter er klar.`,
      success: "En ordre kan følges fra kunde til admin, fil/kontrol, korrektur, produktion og levering.",
      pauseIf: "Pause hvis en ordre kræver udviklerhjælp eller ikke kan forklares i admin.",
      decision: orderProof?.status === "klar"
        ? "Brug ordrebeviset som pilotcase."
        : "Kør kontrolleret ordre og luk driftspunkterne.",
      href: orderProof?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-operations-runbook",
    },
    {
      title: "4. Scope og ikke-løfter bliver overholdt",
      status: supplierBoundary?.status === "blokeret" || paymentBoundary?.status === "blokeret" ? "blokeret" : "qa",
      metric: `${supplierBoundary?.audience || "Supplier Bank"} / ${paymentBoundary?.audience || "Pris og betaling"} er markeret i demo-grænsen.`,
      success: "Supplier Bank, betaling, levering og automation forklares som afgrænset pilot, ikke fuld automatik.",
      pauseIf: "Pause hvis kunden forventer live supplier-priser, automatisk publicering, ERP eller ubegrænset support.",
      decision: supplierBoundary?.status === "blokeret" || paymentBoundary?.status === "blokeret"
        ? "Hold disse emner internt eller pilot-only."
        : "Brug demo-grænsen som salgsfilter.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
    {
      title: "5. SEO og rapportering kan vises uden løfter",
      status: seoReady > 0 ? "klar" : seoVisible > 0 || seoProof?.status === "qa" ? "qa" : "planlagt",
      metric: `${formatCount(seoReady)} domæner er klar, ${formatCount(seoVisible)} domæner har SEO/Search Console signaler eller QA.`,
      success: "Pilotkunden kan se read-only synlighedsdata eller tydeligt markeret SEO-status.",
      pauseIf: "Pause hvis SEO bliver solgt som garanti for ranking, trafik eller indeksering.",
      decision: seoReady > 0 || seoVisible > 0
        ? "Brug SEO som rapporteringslag, ikke som salgsresultat."
        : "Tilføj SEO/Search Console proof før det indgår i pilotrapporten.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "6. Commercial-ready score udvikler sig",
      status: readyCriteriaBlockers === 0 && readyCriteriaDone >= 4 ? "qa" : "blokeret",
      metric: `${formatCount(readyCriteriaDone)}/${formatCount(commercialReadyCriteria.length)} scorecard-kriterier er klar, ${formatCount(readyCriteriaBlockers)} er blokeret.`,
      success: "Efter pilotperioden er der mindst én ordrecase, ét template-case, driftserfaring og et forklarligt scope.",
      pauseIf: "Pause hvis scorecardet stadig har hårde blockers efter pilotens første ordre.",
      decision: readyCriteriaBlockers === 0 && readyCriteriaDone >= 4
        ? "Forbered konvertering fra pilot til betalt første pakke."
        : "Brug scorecardet til at vælge næste praktiske rettelse.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-ready-score",
    },
    {
      title: "7. Salgsbevis kan genbruges",
      status: orderProof?.status === "klar" && readyCriteriaBlockers === 0 ? "qa" : "planlagt",
      metric: orderProof?.proof || "Ordre- og beviscase mangler stadig.",
      success: "Pilotens første case kan bruges i mødepakke, scope, ansvarskort og næste print-house pitch.",
      pauseIf: "Pause hvis beviset kun er teknisk og ikke kan forklares som forretningsværdi.",
      decision: orderProof?.status === "klar" && readyCriteriaBlockers === 0
        ? "Saml casen i salgsmappen og gentag med næste pilot."
        : "Luk praktisk ordrebevis før casen bruges i salg.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#sales-evidence",
    },
  ];
}

function getPrintHousePilotHandoff(
  externalDemoBoundary: ExternalDemoBoundaryItem[],
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
  pilotScopeAgreement: PilotScopeAgreementItem[],
  pilotOnboardingPlan: PilotOnboardingStep[],
  pilotSuccessCriteria: PilotSuccessCriterion[],
  pilotResponsibilityMap: PilotResponsibilityItem[],
): PrintHousePilotHandoffItem[] {
  const demoBlocked = externalDemoBoundary.filter((item) => item.status === "blokeret").length;
  const demoAllowed = externalDemoBoundary.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstDemoStop = externalDemoBoundary.find((item) => item.status === "blokeret") || getFirstOpenItem(externalDemoBoundary);
  const acceptanceBlockers = commercialPilotAcceptance.filter((item) => item.status === "blokeret").length;
  const acceptanceOpen = commercialPilotAcceptance.filter((item) => item.status !== "klar").length;
  const firstAcceptanceGap = getFirstOpenItem(commercialPilotAcceptance);
  const scopeBlockers = pilotScopeAgreement.filter((item) => item.status === "blokeret").length;
  const scopeReady = pilotScopeAgreement.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstScopeGap = getFirstOpenItem(pilotScopeAgreement);
  const onboardingBlockers = pilotOnboardingPlan.filter((item) => item.status === "blokeret").length;
  const onboardingReady = pilotOnboardingPlan.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstOnboardingGap = getFirstOpenItem(pilotOnboardingPlan);
  const successBlockers = pilotSuccessCriteria.filter((item) => item.status === "blokeret").length;
  const successReady = pilotSuccessCriteria.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstSuccessGap = getFirstOpenItem(pilotSuccessCriteria);
  const ceoOwner = pilotResponsibilityMap.find((item) => item.owner === "CEO");
  const demoOwner = pilotResponsibilityMap.find((item) => item.owner === "Demoansvarlig");
  const sourcingOwner = pilotResponsibilityMap.find((item) => item.owner === "Sourcing");

  return [
    {
      title: "1. Det må vises i første møde",
      audience: "Trykkerimøde",
      status: demoBlocked === 0 ? "qa" : "blokeret",
      handoff: "Vis Webprinter som platform, Salgsmapper som niche/template proof, cockpitets read-only beviser og den tydelige pilotgrænse.",
      proof: `${formatCount(demoAllowed)}/${formatCount(externalDemoBoundary.length)} demo-grænser kan nævnes uden hård blokering.`,
      next: firstDemoStop?.risk || demoOwner?.risk || "Kør browserruten og bevisfangsten før ekstern demo.",
      href: firstDemoStop?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
    {
      title: "2. Det er pilotens konkrete scope",
      audience: "Pilotkunde",
      status: scopeBlockers === 0 ? "qa" : "blokeret",
      handoff: "Forklar én tenant, en afgrænset produktpakke, designer/upload/template, ordre/admin, SEO-rapportering, support og økonomi som pilotramme.",
      proof: `${formatCount(scopeReady)}/${formatCount(pilotScopeAgreement.length)} scopepunkter er uden hård blokering.`,
      next: firstScopeGap?.decision || "Brug scopekortet som aftalegrundlag før kunden får adgang.",
      href: firstScopeGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-scope-agreement",
    },
    {
      title: "3. Det kræver CEO go/no-go",
      audience: "Ledelse",
      status: acceptanceBlockers === 0 ? "qa" : "blokeret",
      handoff: "Tag beslutningen om pilot må vises, sælges, holdes intern, eller kun bruges som generalprøve.",
      proof: `${formatCount(acceptanceOpen)} acceptpunkter er stadig åbne; ${formatCount(acceptanceBlockers)} er blokerende.`,
      next: firstAcceptanceGap?.next || ceoOwner?.risk || "Luk eller accepter de åbne pilotacceptpunkter før kundeløfte.",
      href: firstAcceptanceGap?.href || ceoOwner?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
    {
      title: "4. Det skal kunden levere efter ja",
      audience: "Kickoff",
      status: onboardingBlockers === 0 ? "qa" : "blokeret",
      handoff: "Indsaml domæne/brand, første produktpakke, prisansvar, templates, checkoutvalg, SEO-adgang og support/økonomi før pilotstart.",
      proof: `${formatCount(onboardingReady)}/${formatCount(pilotOnboardingPlan.length)} onboardingtrin er klar eller i QA.`,
      next: firstOnboardingGap?.stopCondition || "Brug onboardingplanen som kundens inputliste.",
      href: firstOnboardingGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-onboarding-plan",
    },
    {
      title: "5. Det må ikke loves endnu",
      audience: "Internt",
      status: demoBlocked > 0 ? "blokeret" : sourcingOwner?.status || "qa",
      handoff: "Hold Supplier Bank livepricing, automatisk publicering, fuld betalings-/leverancegaranti, ERP og ubegrænset support som interne eller pilot-only emner.",
      proof: firstDemoStop?.risk || sourcingOwner?.proof || "Demo-grænsen og ansvarskortet beskriver de vigtigste ikke-løfter.",
      next: firstDemoStop?.allowed || sourcingOwner?.risk || "Sig eksplicit hvad der er staging, hvad der er manuelt, og hvad der kræver separat aftale.",
      href: firstDemoStop?.href || sourcingOwner?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
    {
      title: "6. Sådan ved vi om piloten lykkes",
      audience: "Efter pilot",
      status: successBlockers === 0 ? "qa" : "blokeret",
      handoff: "Mål piloten på lukket scope, produkt/price/template proof, manuel ordre, klare ikke-løfter, SEO-rapportering og genbrugelig salgscase.",
      proof: `${formatCount(successReady)}/${formatCount(pilotSuccessCriteria.length)} succeskriterier er klar eller i QA.`,
      next: firstSuccessGap?.decision || "Brug exitkriterierne til at beslutte betalt pakke, pause eller næste pilot.",
      href: firstSuccessGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-success-criteria",
    },
  ];
}

function getPrintHousePilotQuestions(
  printHousePilotHandoff: PrintHousePilotHandoffItem[],
  printHouseMeetingPack: PrintHouseMeetingPackItem[],
  pilotScopeAgreement: PilotScopeAgreementItem[],
  pilotOnboardingPlan: PilotOnboardingStep[],
  pilotSuccessCriteria: PilotSuccessCriterion[],
  externalDemoBoundary: ExternalDemoBoundaryItem[],
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
): PrintHousePilotQuestionItem[] {
  const showHandoff = printHousePilotHandoff.find((item) => item.title.includes("må vises"));
  const scopeHandoff = printHousePilotHandoff.find((item) => item.title.includes("scope"));
  const customerInput = printHousePilotHandoff.find((item) => item.title.includes("kunden levere"));
  const nonPromise = printHousePilotHandoff.find((item) => item.title.includes("ikke loves"));
  const successHandoff = printHousePilotHandoff.find((item) => item.title.includes("lykkes"));
  const ceoHandoff = printHousePilotHandoff.find((item) => item.title.includes("CEO"));
  const showPack = printHouseMeetingPack.find((item) => item.title.includes("Hvad der må vises"));
  const commercialQuestion = printHouseMeetingPack.find((item) => item.title.includes("Kommercielt spørgsmål"));
  const productScope = pilotScopeAgreement.find((item) => item.title.includes("produktpakke"));
  const designerScope = pilotScopeAgreement.find((item) => item.title.includes("Designer"));
  const checkoutScope = pilotScopeAgreement.find((item) => item.title.includes("Checkout"));
  const supportScope = pilotScopeAgreement.find((item) => item.title.includes("Support"));
  const priceScope = pilotScopeAgreement.find((item) => item.title.includes("Prisramme"));
  const onboardingGap = getFirstOpenItem(pilotOnboardingPlan);
  const successGap = getFirstOpenItem(pilotSuccessCriteria);
  const supplierBoundary = externalDemoBoundary.find((item) => item.title === "Supplier Bank");
  const paymentBoundary = externalDemoBoundary.find((item) => item.title === "Pris, betaling og leveranceløfte");
  const acceptanceGap = getFirstOpenItem(commercialPilotAcceptance);

  return [
    {
      question: "Hvad kan I vise os i dag?",
      category: "Demo",
      status: showHandoff?.status || showPack?.status || "qa",
      answer: showHandoff?.handoff || "Vi kan vise platformen, tenantbeviser, produkt/pris, Salgsmapper-template, admin og Supplier Bank som staging.",
      proof: showHandoff?.proof || showPack?.evidence || "Demo-køreplanen og handoff-kortet styrer hvad der må vises.",
      boundary: showHandoff?.next || "Alt der ikke er bevist, vises som QA eller intern staging.",
      href: showHandoff?.href || showPack?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-pilot-handoff",
    },
    {
      question: "Hvad indgår i første pilot?",
      category: "Scope",
      status: scopeHandoff?.status || productScope?.status || "blokeret",
      answer: scopeHandoff?.handoff || "Første pilot er én tenant, en afgrænset produktpakke, designer/upload/template, ordre/admin og support/økonomi med grænser.",
      proof: scopeHandoff?.proof || productScope?.included || "Scopekortet beskriver hvad der er med og ikke med.",
      boundary: productScope?.excluded || scopeHandoff?.next || "Fuldt katalog, flere tenants og automatisk supplier-prissync er ikke første scope.",
      href: scopeHandoff?.href || productScope?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-scope-agreement",
    },
    {
      question: "Kan systemet lave alle produkter og priser automatisk?",
      category: "Sourcing",
      status: supplierBoundary?.status || nonPromise?.status || "blokeret",
      answer: "Nej, ikke som første løfte. Supplier Bank er intern sourcing/staging med approval-gates for import og publicering.",
      proof: supplierBoundary?.allowed || nonPromise?.proof || "Supplier Bank vises som kontrolleret staging, ikke fuld liveautomatik.",
      boundary: supplierBoundary?.risk || "Ingen automatisk livepricing, ukontrolleret publicering eller åbne supplier-gates i første pilot.",
      href: supplierBoundary?.href || nonPromise?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      question: "Hvordan håndteres ordrer, filer og korrektur?",
      category: "Drift",
      status: checkoutScope?.status || designerScope?.status || "blokeret",
      answer: "Første pilot håndteres manuelt i admin: produkt/pris, design eller upload, fil/PDF-kontrol, korrektur, produktion og levering.",
      proof: `${checkoutScope?.included || "Checkout og ordreflow er pilot-only."} ${designerScope?.included || "Designer/upload/template-flow er afgrænset."}`,
      boundary: checkoutScope?.excluded || designerScope?.excluded || "Ingen fuld automatisk produktion, OCR/PDF/A-garanti eller ERP-integration i første scope.",
      href: checkoutScope?.href || designerScope?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-scope-agreement",
    },
    {
      question: "Hvordan fungerer betaling, levering og support?",
      category: "Økonomi",
      status: paymentBoundary?.status || priceScope?.status || "planlagt",
      answer: "Det skal besluttes som pilotramme: pilotpris, månedlig platform, supportniveau, betalingsform, levering og hvad der er ekstraarbejde.",
      proof: priceScope?.included || paymentBoundary?.allowed || "Prisramme og betalingsmodel er en ledelsesbeslutning før kundeløfte.",
      boundary: priceScope?.excluded || paymentBoundary?.risk || "Ingen fast betalings- eller leverancegaranti uden pilotbeslutning.",
      href: priceScope?.href || paymentBoundary?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-scope-agreement",
    },
    {
      question: "Hvad skal vi som trykkeri levere efter et ja?",
      category: "Kickoff",
      status: customerInput?.status || onboardingGap?.status || "qa",
      answer: customerInput?.handoff || "I skal levere domæne/brand, første produkter, prisansvar, templates, checkoutvalg, SEO-adgang og support/økonomi-afklaring.",
      proof: customerInput?.proof || onboardingGap?.evidence || "Onboardingplanen samler kundens inputliste.",
      boundary: customerInput?.next || onboardingGap?.stopCondition || "Stop hvis piloten kræver flere tenants, fuldt katalog eller åbne integrationer fra start.",
      href: customerInput?.href || onboardingGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-onboarding-plan",
    },
    {
      question: "Hvordan ved vi om piloten er en succes?",
      category: "Succes",
      status: successHandoff?.status || successGap?.status || "qa",
      answer: successHandoff?.handoff || "Piloten måles på lukket scope, produkt/pris/template proof, manuel ordre, klare ikke-løfter, SEO-rapportering og genbrugelig salgscase.",
      proof: successHandoff?.proof || successGap?.metric || "Succeskriterierne definerer fortsæt, pause eller konvertering til betalt pakke.",
      boundary: successGap?.pauseIf || successHandoff?.next || "Pause hvis beviset kun er teknisk eller scope stadig har hårde blockers.",
      href: successHandoff?.href || successGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-success-criteria",
    },
    {
      question: "Hvornår kan vi gå live?",
      category: "Go/no-go",
      status: ceoHandoff?.status || acceptanceGap?.status || "blokeret",
      answer: "Først når CEO go/no-go, pilotaccept, demo-grænse, drift, adgang, scope og første generalprøve er accepteret.",
      proof: ceoHandoff?.proof || acceptanceGap?.evidence || "Pilotaccepten samler de aktuelle go/no-go signaler.",
      boundary: ceoHandoff?.next || acceptanceGap?.next || "Ingen kundepilot må aftales hvis scorecard, drift, adgang eller demo-grænse har blokerende punkter.",
      href: ceoHandoff?.href || acceptanceGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
    {
      question: "Hvad er næste kommercielle beslutning?",
      category: "Opfølgning",
      status: commercialQuestion?.status || "planlagt",
      answer: commercialQuestion?.say || "Vælg om trykkeriet vil være pilotkunde, og hvilke 3-5 produkter der skal starte pakken.",
      proof: commercialQuestion?.evidence || supportScope?.included || "Mødepakken og tilbudsmodellen styrer næste opfølgning.",
      boundary: supportScope?.excluded || "Ingen ubegrænset support, specialintegrationer eller løbende produktvedligehold uden aftale.",
      href: commercialQuestion?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
  ];
}

function getPrintHouseMeetingBrief(
  printHouseMeetingPack: PrintHouseMeetingPackItem[],
  printHousePilotQuestions: PrintHousePilotQuestionItem[],
  printHousePilotHandoff: PrintHousePilotHandoffItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): PrintHouseMeetingBriefItem[] {
  const purpose = printHouseMeetingPack.find((item) => item.title.includes("Mødets formål"));
  const showQuestion = printHousePilotQuestions.find((item) => item.category === "Demo");
  const scopeQuestion = printHousePilotQuestions.find((item) => item.category === "Scope");
  const commercialQuestion = printHousePilotQuestions.find((item) => item.category === "Opfølgning");
  const nonPromiseQuestion = printHousePilotQuestions.find((item) => item.category === "Sourcing")
    || printHousePilotQuestions.find((item) => item.question.includes("automatisk"));
  const goLiveQuestion = printHousePilotQuestions.find((item) => item.category === "Go/no-go");
  const nextBlocker = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const handoffStop = printHousePilotHandoff.find((item) => item.status === "blokeret") || getFirstOpenItem(printHousePilotHandoff);

  return [
    {
      title: "1. Åbn samtalen roligt",
      status: purpose?.status || "qa",
      script: purpose?.say || "Vi viser Webprinter som en pilotklar web-to-print platform med tydelige grænser.",
      proof: purpose?.evidence || "Mødepakken afgør om samtalen er ekstern pilotdemo eller intern generalprøve.",
      boundary: "Sig fra start at Supplier Bank og automatik vises som staging eller pilot-only, ikke som færdigt netværksløfte.",
      href: purpose?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-meeting-pack",
    },
    {
      title: "2. Vis kun den korte demo",
      status: showQuestion?.status || "qa",
      script: showQuestion?.answer || "Vis Webprinter, produkt/pris, Salgsmapper-template, admin og Supplier Bank som staging.",
      proof: showQuestion?.proof || "Demo-køreplanen styrer rækkefølgen og holder sekundære pilotsider ude af hovedbeviset.",
      boundary: showQuestion?.boundary || "Spring over alt der ikke er bevist i browser eller tydeligt markeret QA.",
      href: showQuestion?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-pilot-questions",
    },
    {
      title: "3. Stil det kommercielle pilotspørgsmål",
      status: commercialQuestion?.status || scopeQuestion?.status || "planlagt",
      script: commercialQuestion?.answer || "Hvis piloten giver mening, vælger vi domæne, første produktpakke, prisansvar, templates og ordreoverdragelse.",
      proof: commercialQuestion?.proof || scopeQuestion?.proof || "Scopekortet og tilbudsmodellen viser hvad en første pilot kan indeholde.",
      boundary: scopeQuestion?.boundary || "Hold første pilot til én tenant, få produkter og klare support-/prisgrænser.",
      href: commercialQuestion?.href || scopeQuestion?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
    {
      title: "4. Gentag ikke-løfterne",
      status: nonPromiseQuestion?.status || handoffStop?.status || "blokeret",
      script: nonPromiseQuestion?.answer || "Supplier Bank, automatiske livepriser, publicering, betaling, levering og integrationer kræver særskilt beslutning.",
      proof: nonPromiseQuestion?.proof || handoffStop?.proof || "Demo-grænsen og handoff-kortene viser hvad der skal holdes internt.",
      boundary: nonPromiseQuestion?.boundary || handoffStop?.next || "Lov ikke fuld automatik, ERP, live supplier-sync eller ubegrænset support i første pilot.",
      href: nonPromiseQuestion?.href || handoffStop?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
    {
      title: "5. Slut med næste handling",
      status: nextBlocker?.status || goLiveQuestion?.status || "qa",
      script: nextBlocker
        ? `Næste interne punkt er: ${nextBlocker.title}.`
        : goLiveQuestion?.answer || "Næste skridt er CEO go/no-go, pilotaccept og kundens inputliste.",
      proof: nextBlocker?.reason || goLiveQuestion?.proof || "Prioriteret handlingskø og Q&A viser næste bevis eller beslutning.",
      boundary: nextBlocker?.action || goLiveQuestion?.boundary || "Aftal ikke go-live før accept, scope, adgang og generalprøve er lukket.",
      href: nextBlocker?.href || goLiveQuestion?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
  ];
}

function getPrintHouseFollowUpItems(
  printHouseMeetingBrief: PrintHouseMeetingBriefItem[],
  printHousePilotQuestions: PrintHousePilotQuestionItem[],
  pilotPrintHouseIntake: PilotPrintHouseIntakeItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): PrintHouseFollowUpItem[] {
  const opening = printHouseMeetingBrief.find((item) => item.title.includes("Åbn"));
  const demo = printHouseMeetingBrief.find((item) => item.title.includes("demo"));
  const pilotAsk = printHouseMeetingBrief.find((item) => item.title.includes("pilotspørgsmål"));
  const nonPromises = printHouseMeetingBrief.find((item) => item.title.includes("ikke-løfter"));
  const nextAction = printHouseMeetingBrief.find((item) => item.title.includes("næste handling"));
  const scopeQuestion = printHousePilotQuestions.find((item) => item.category === "Scope");
  const kickoffQuestion = printHousePilotQuestions.find((item) => item.category === "Kickoff");
  const goLiveQuestion = printHousePilotQuestions.find((item) => item.category === "Go/no-go");
  const firstIntakeGap = getFirstOpenItem(pilotPrintHouseIntake);
  const firstPriority = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const intakeReady = pilotPrintHouseIntake.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Emne og åbningslinje",
      audience: "Mailkladde",
      status: opening?.status || "qa",
      draft: "Emne: Webprinter pilot - første scope og næste trin. Tak for mødet. Her er den korte opsamling på hvad vi kan vise nu, hvad første pilot kan indeholde, og hvad vi skal afklare før go-live.",
      proof: opening?.proof || "Mødebriefet styrer den sikre åbning.",
      next: opening?.boundary || "Hold åbningslinjen på pilotklar platform og tydelige grænser.",
      href: opening?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-meeting-brief",
    },
    {
      title: "2. Recap af det viste",
      audience: "Kunde",
      status: demo?.status || "qa",
      draft: "Vi gennemgik Webprinter som platform, et produkt/pris-flow, Salgsmapper som template-proof, admin/ordreoverblik og Supplier Bank som intern staging.",
      proof: demo?.proof || "Demo- og Q&A-lagene viser hvad der må nævnes.",
      next: demo?.boundary || "Nævn kun de dele der faktisk blev vist eller er tydeligt markeret QA.",
      href: demo?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-meeting-brief",
    },
    {
      title: "3. Pilotforslag i én sætning",
      audience: "Kunde",
      status: pilotAsk?.status || scopeQuestion?.status || "planlagt",
      draft: "Forslaget er en kontrolleret pilot med én tenant, en afgrænset første produktpakke, designer/upload/template-flow, ordre/admin, SEO-rapportering og klart support-/pris-scope.",
      proof: pilotAsk?.proof || scopeQuestion?.proof || "Scopekort og tilbudsmodel beskriver pilotrammen.",
      next: scopeQuestion?.boundary || pilotAsk?.boundary || "Hold første pilot til få produkter og klare grænser.",
      href: pilotAsk?.href || scopeQuestion?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-scope-agreement",
    },
    {
      title: "4. Input vi skal bruge fra trykkeriet",
      audience: "Kunde",
      status: firstIntakeGap?.status || kickoffQuestion?.status || "qa",
      draft: "For at vurdere pilotstart skal vi bruge domæne/subdomæne, brandmateriale, første produktfamilier, prisansvar, templatebehov, betalings-/ordreflow, SEO-adgang og supportkontakt.",
      proof: `${formatCount(intakeReady)}/${formatCount(pilotPrintHouseIntake.length)} intakepunkter er klar eller i QA.`,
      next: firstIntakeGap?.needed || kickoffQuestion?.boundary || "Brug intakekortet som kundens inputliste.",
      href: firstIntakeGap?.href || kickoffQuestion?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-intake",
    },
    {
      title: "5. Grænser der skal gentages",
      audience: "Kunde + internt",
      status: nonPromises?.status || "blokeret",
      draft: "Første pilot inkluderer ikke fuld automatisk supplier-livepricing, ukontrolleret publicering, ERP-integration, ubegrænset support eller garanti for betaling/levering uden separat aftale.",
      proof: nonPromises?.proof || "Ikke-løfterne kommer fra demo-grænse, Q&A og handoff.",
      next: nonPromises?.boundary || "Hold disse grænser med i opfølgningsmailen, også hvis kunden er positiv.",
      href: nonPromises?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
    {
      title: "6. Næste handling",
      audience: "Intern opfølgning",
      status: firstPriority?.status || nextAction?.status || goLiveQuestion?.status || "qa",
      draft: firstPriority
        ? `Intern næste handling: ${firstPriority.title}.`
        : "Næste handling er CEO go/no-go, pilotaccept og aftale om kundens inputliste.",
      proof: firstPriority?.reason || nextAction?.proof || goLiveQuestion?.proof || "Prioriteret handlingskø og go/no-go styrer næste skridt.",
      next: firstPriority?.action || nextAction?.boundary || goLiveQuestion?.boundary || "Aftal ikke go-live før accept, scope, adgang og generalprøve er lukket.",
      href: firstPriority?.href || nextAction?.href || goLiveQuestion?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
  ];
}

function getPrintHousePilotOfferDraft(
  printHouseFollowUpItems: PrintHouseFollowUpItem[],
  offerModel: PrintHouseOfferItem[],
  pilotScopeAgreement: PilotScopeAgreementItem[],
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): PrintHousePilotOfferDraftItem[] {
  const opening = printHouseFollowUpItems.find((item) => item.title.includes("åbningslinje"));
  const recap = printHouseFollowUpItems.find((item) => item.title.includes("Recap"));
  const pilotProposal = printHouseFollowUpItems.find((item) => item.title.includes("Pilotforslag"));
  const customerInput = printHouseFollowUpItems.find((item) => item.title.includes("Input"));
  const nonPromises = printHouseFollowUpItems.find((item) => item.title.includes("Grænser"));
  const nextAction = printHouseFollowUpItems.find((item) => item.title.includes("Næste handling"));
  const tenantOffer = offerModel.find((item) => item.title.includes("Tenant"));
  const productOffer = offerModel.find((item) => item.title.includes("produktpakke"));
  const designerOffer = offerModel.find((item) => item.title.includes("Designer"));
  const checkoutOffer = offerModel.find((item) => item.title.includes("Checkout"));
  const seoOffer = offerModel.find((item) => item.title.includes("SEO"));
  const supplierOffer = offerModel.find((item) => item.title.includes("Supplier Bank"));
  const supportOffer = offerModel.find((item) => item.title.includes("Support"));
  const priceOffer = offerModel.find((item) => item.title.includes("prisramme"));
  const firstScopeGap = getFirstOpenItem(pilotScopeAgreement);
  const firstAcceptanceGap = getFirstOpenItem(commercialPilotAcceptance);
  const firstPriority = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const offerReadyCount = offerModel.filter((item) => item.status === "klar" || item.status === "qa").length;
  const scopeReadyCount = pilotScopeAgreement.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Forside og formål",
      section: "Kunde",
      status: opening?.status || tenantOffer?.status || "qa",
      clause: "Webprinter pilottilbuddet beskrives som en kontrolleret første pilot, ikke som fuld platformsaftale eller automatisk supplier-motor.",
      proof: opening?.proof || tenantOffer?.proof || "Opfølgning og tilbudsmodel beskriver tenant/storefront som første pakke.",
      guardrail: opening?.next || tenantOffer?.decision || "Hold teksten på formål, scope og næste beslutning. Sæt ingen beløb her.",
      href: opening?.href || tenantOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-follow-up",
    },
    {
      title: "2. Leverancepakke uden beløb",
      section: "Scope",
      status: pilotProposal?.status || (offerReadyCount >= 5 ? "qa" : firstScopeGap?.status || "planlagt"),
      clause: pilotProposal?.draft || "Kladdepakken kan nævne tenant, første produkter, designer/upload/skabeloner, checkout/ordre, SEO-rapportering og onboarding/support.",
      proof: pilotProposal?.proof || `${formatCount(offerReadyCount)}/${formatCount(offerModel.length)} tilbudslinjer er klar eller i QA.`,
      guardrail: pilotProposal?.next || firstScopeGap?.decision || "Brug kun eksisterende tilbudslinjer som overskrift. Ingen priser, binding eller SLA uden ledelsesbeslutning.",
      href: pilotProposal?.href || firstScopeGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
    {
      title: "3. Kundens inputliste",
      section: "Kundeansvar",
      status: customerInput?.status || "qa",
      clause: customerInput?.draft || "Trykkeriet skal levere domæne/brand, første produktfamilier, prisansvar, templates, betalingsvalg, SEO-adgang og supportkontakt.",
      proof: customerInput?.proof || `${formatCount(scopeReadyCount)}/${formatCount(pilotScopeAgreement.length)} scopepunkter er klar eller i QA.`,
      guardrail: customerInput?.next || "Kunden må ikke onboardes før inputlisten er afklaret nok til en intern generalprøve.",
      href: customerInput?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-intake",
    },
    {
      title: "4. Bevis der kan vedlægges",
      section: "Bilag",
      status: recap?.status || productOffer?.status || designerOffer?.status || checkoutOffer?.status || "qa",
      clause: "Vedlæg kun links eller screenshots fra det der er demonstreret: Webprinter produkt/pris, Salgsmapper template-proof, admin/ordre og cockpitbeviser.",
      proof: recap?.proof || productOffer?.proof || designerOffer?.proof || checkoutOffer?.proof || "Demo, Q&A og opfølgning angiver hvad der faktisk må nævnes.",
      guardrail: recap?.next || "Brug ikke Supplier Bank, betaling, levering eller SEO som løfte uden tydelig pilot-/QA-markering.",
      href: recap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-follow-up",
    },
    {
      title: "5. Afgrænsning og ikke-løfter",
      section: "Grænser",
      status: nonPromises?.status || supplierOffer?.status || "blokeret",
      clause: "Kladde skal tydeligt udelukke automatisk live supplier-pricing, ukontrolleret publicering, ERP-integration, ubegrænset support og garanteret betaling/levering uden særskilt aftale.",
      proof: nonPromises?.proof || supplierOffer?.proof || "Demo-grænse, Q&A, handoff og Supplier Bank-gates holder dette som intern staging.",
      guardrail: nonPromises?.next || supplierOffer?.decision || "Gentag grænsen i både tilbudskladde og mødeopfølgning før kunden siger ja.",
      href: nonPromises?.href || supplierOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
    {
      title: "6. Internt før den sendes",
      section: "Ledelse",
      status: firstAcceptanceGap?.status || priceOffer?.status || firstPriority?.status || nextAction?.status || "planlagt",
      clause: "Før en egentlig mail eller tilbud sendes, skal CEO beslutte pilotpris, månedlig prisramme, inkluderede timer, supportniveau og go/no-go.",
      proof: firstAcceptanceGap?.evidence || priceOffer?.proof || firstPriority?.reason || nextAction?.proof || "Pilotaccept, prisramme og prioriteret kø styrer beslutningen.",
      guardrail: firstAcceptanceGap?.next || priceOffer?.decision || firstPriority?.action || nextAction?.next || "Kladde må ikke sendes som tilbud før beløb og ansvar er besluttet.",
      href: firstAcceptanceGap?.href || priceOffer?.href || firstPriority?.href || nextAction?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
    {
      title: "7. Support og opfølgningsform",
      section: "Drift",
      status: supportOffer?.status || seoOffer?.status || "planlagt",
      clause: "Beskriv support som en kontrolleret pilotramme med aftalt kontaktvej, svartid, SEO-rapportering og ændringsproces.",
      proof: supportOffer?.proof || seoOffer?.proof || "Tilbudsmodel og cockpit viser support/onboarding og SEO som særskilte beslutningsområder.",
      guardrail: supportOffer?.decision || seoOffer?.decision || "Lov ikke ubegrænset support, løbende SEO-arbejde eller ændringer uden aftalt ansvar.",
      href: supportOffer?.href || seoOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
  ];
}

function getPilotAgreementChecklist(
  printHouseOfferDraft: PrintHousePilotOfferDraftItem[],
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
  pilotScopeAgreement: PilotScopeAgreementItem[],
  pilotOnboardingPlan: PilotOnboardingStep[],
  pilotSuccessCriteria: PilotSuccessCriterion[],
  pilotResponsibilityMap: PilotResponsibilityItem[],
): PilotAgreementChecklistItem[] {
  const offerPurpose = printHouseOfferDraft.find((item) => item.title.includes("Forside"));
  const offerPackage = printHouseOfferDraft.find((item) => item.title.includes("Leverancepakke"));
  const offerInput = printHouseOfferDraft.find((item) => item.title.includes("inputliste"));
  const offerBoundaries = printHouseOfferDraft.find((item) => item.title.includes("Afgrænsning"));
  const offerApproval = printHouseOfferDraft.find((item) => item.title.includes("Internt"));
  const acceptanceGap = getFirstOpenItem(commercialPilotAcceptance);
  const scopeGap = getFirstOpenItem(pilotScopeAgreement);
  const onboardingGap = getFirstOpenItem(pilotOnboardingPlan);
  const successGap = getFirstOpenItem(pilotSuccessCriteria);
  const responsibilityGap = getFirstOpenItem(pilotResponsibilityMap);
  const acceptanceReadyCount = commercialPilotAcceptance.filter((item) => item.status === "klar" || item.status === "qa").length;
  const scopeReadyCount = pilotScopeAgreement.filter((item) => item.status === "klar" || item.status === "qa").length;
  const onboardingReadyCount = pilotOnboardingPlan.filter((item) => item.status === "klar" || item.status === "qa").length;
  const successReadyCount = pilotSuccessCriteria.filter((item) => item.status === "klar" || item.status === "qa").length;
  const responsibilityReadyCount = pilotResponsibilityMap.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Pilotformål er klart",
      area: "Formål",
      status: offerPurpose?.status || "qa",
      checkpoint: offerPurpose?.clause || "Aftalen skal beskrive en kontrolleret første pilot, ikke en fuld platformsaftale.",
      evidence: offerPurpose?.proof || "Tilbudskladde og mødeopfølgning beskriver pilotformålet.",
      missing: offerPurpose?.guardrail || "Skriv ikke beløb, binding eller go-live-løfte ind før intern accept.",
      href: offerPurpose?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-offer-draft",
    },
    {
      title: "2. Leverance og scope er afgrænset",
      area: "Scope",
      status: scopeGap?.status || offerPackage?.status || "qa",
      checkpoint: offerPackage?.clause || "Aftalen skal kun omfatte den første tenant, produktpakke, designer/upload, ordreflow, SEO og supportramme.",
      evidence: `${formatCount(scopeReadyCount)}/${formatCount(pilotScopeAgreement.length)} scopepunkter er klar eller i QA.`,
      missing: scopeGap?.decision || offerPackage?.guardrail || "Luk første åbne scopepunkt før en aftale sendes.",
      href: scopeGap?.href || offerPackage?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-scope-agreement",
    },
    {
      title: "3. Kundens input er navngivet",
      area: "Kundeansvar",
      status: offerInput?.status || onboardingGap?.status || "qa",
      checkpoint: offerInput?.clause || "Domæne, brand, produktfamilier, prisansvar, templates, betaling, SEO-adgang og supportkontakt skal stå som kundens input.",
      evidence: `${formatCount(onboardingReadyCount)}/${formatCount(pilotOnboardingPlan.length)} onboardingtrin er klar eller i QA.`,
      missing: onboardingGap?.stopCondition || offerInput?.guardrail || "Kunden må ikke onboardes før inputlisten er praktisk afklaret.",
      href: onboardingGap?.href || offerInput?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-onboarding-plan",
    },
    {
      title: "4. Økonomi kræver CEO-beslutning",
      area: "Økonomi",
      status: offerApproval?.status || acceptanceGap?.status || "planlagt",
      checkpoint: offerApproval?.clause || "Pilotpris, månedlig prisramme, inkluderede timer og supportniveau skal besluttes før noget sendes.",
      evidence: offerApproval?.proof || `${formatCount(acceptanceReadyCount)}/${formatCount(commercialPilotAcceptance.length)} pilotacceptpunkter er klar eller i QA.`,
      missing: offerApproval?.guardrail || acceptanceGap?.next || "Sæt ikke priser eller betalingsvilkår uden eksplicit ledelsesbeslutning.",
      href: offerApproval?.href || acceptanceGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
    {
      title: "5. Ansvar og support er fordelt",
      area: "Drift",
      status: responsibilityGap?.status || "qa",
      checkpoint: "Aftalen skal vise hvem der ejer produktpakke, filer/PDF, adminadgang, SEO, support, Supplier Bank-grænser og økonomi.",
      evidence: `${formatCount(responsibilityReadyCount)}/${formatCount(pilotResponsibilityMap.length)} ansvarspunkter er klar eller i QA.`,
      missing: responsibilityGap?.risk || "Luk første ansvarsgap før pilotkunden får en egentlig aftale.",
      href: responsibilityGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-responsibility-map",
    },
    {
      title: "6. Succeskriterier og exit er synlige",
      area: "Pilotmåling",
      status: successGap?.status || "qa",
      checkpoint: "Aftalen skal beskrive hvornår piloten fortsætter, pauses eller kan konverteres til betalt pakke.",
      evidence: `${formatCount(successReadyCount)}/${formatCount(pilotSuccessCriteria.length)} succeskriterier er klar eller i QA.`,
      missing: successGap?.pauseIf || successGap?.decision || "Brug succeskriterierne som bilag før pilotstart.",
      href: successGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-success-criteria",
    },
    {
      title: "7. Ikke-løfter er gentaget",
      area: "Grænser",
      status: offerBoundaries?.status || "blokeret",
      checkpoint: offerBoundaries?.clause || "Automatisk live supplier-pricing, ukontrolleret publicering, ERP, ubegrænset support og garanteret betaling/levering skal være udelukket.",
      evidence: offerBoundaries?.proof || "Tilbudskladde og demo-grænse holder ikke-løfterne synlige.",
      missing: offerBoundaries?.guardrail || "Gentag grænserne før kunden får noget der ligner en aftale.",
      href: offerBoundaries?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#external-demo-boundary",
    },
  ];
}

function getPilotStartPlan(
  pilotAgreementChecklist: PilotAgreementChecklistItem[],
  pilotOnboardingPlan: PilotOnboardingStep[],
  pilotOperationsRunbook: PilotOperationsRunbookItem[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  pilotProofRuns: PilotProofRunItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): PilotStartPlanItem[] {
  const agreementGap = getFirstOpenItem(pilotAgreementChecklist);
  const onboardingGap = getFirstOpenItem(pilotOnboardingPlan);
  const operationsGap = getFirstOpenItem(pilotOperationsRunbook);
  const accessGap = getFirstOpenItem(adminAccessReadiness);
  const proofGap = getFirstOpenItem(pilotProofRuns);
  const priorityGap = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const agreementReadyCount = pilotAgreementChecklist.filter((item) => item.status === "klar" || item.status === "qa").length;
  const onboardingReadyCount = pilotOnboardingPlan.filter((item) => item.status === "klar" || item.status === "qa").length;
  const operationsReadyCount = pilotOperationsRunbook.filter((item) => item.status === "klar" || item.status === "qa").length;
  const accessReadyCount = adminAccessReadiness.filter((item) => item.status === "klar" || item.status === "qa").length;
  const proofReadyCount = pilotProofRuns.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Intern accept før kickoff",
      day: "Dag 0",
      owner: "CEO",
      status: agreementGap?.status || "qa",
      action: "Gennemgå aftaletjeklisten og beslut om piloten må gå fra kladde til kundedialog.",
      proof: `${formatCount(agreementReadyCount)}/${formatCount(pilotAgreementChecklist.length)} aftalepunkter er klar eller i QA.`,
      stopRule: agreementGap?.missing || "Start ikke pilotkickoff før formål, scope, økonomi, ansvar og ikke-løfter er afklaret.",
      href: agreementGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-agreement-checklist",
    },
    {
      title: "2. Kundens kickoff-input",
      day: "Dag 0-1",
      owner: "Kunde + onboarding",
      status: onboardingGap?.status || "qa",
      action: "Indsaml domæne, brand, produktfamilier, prisansvar, templates, betalingsvalg, SEO-adgang og supportkontakt.",
      proof: `${formatCount(onboardingReadyCount)}/${formatCount(pilotOnboardingPlan.length)} onboardingtrin er klar eller i QA.`,
      stopRule: onboardingGap?.stopCondition || "Opret ikke produktion eller go-live-plan før kundens input kan testes i en intern generalprøve.",
      href: onboardingGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-onboarding-plan",
    },
    {
      title: "3. Adminmail og adgangstest",
      day: "Dag 1",
      owner: "Admin",
      status: accessGap?.status || "qa",
      action: "Bekræft at admin@webprinter.dk kan se dashboard, produkter, priser, templates, ordrer, SEO, bank, betaling og indstillinger.",
      proof: `${formatCount(accessReadyCount)}/${formatCount(adminAccessReadiness.length)} adgangspunkter er klar eller i QA.`,
      stopRule: accessGap?.manualCheck || "Ingen pilotstart hvis adminmail ikke kan gennemgå de nødvendige områder manuelt.",
      href: accessGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#admin-access-readiness",
    },
    {
      title: "4. Produkt og designsti i browser",
      day: "Dag 1-2",
      owner: "Produkt",
      status: proofGap?.status || "qa",
      action: "Kør den valgte produkt-, pris-, template-, designer/upload- og checkoutsti i browser før kunden ser den.",
      proof: `${formatCount(proofReadyCount)}/${formatCount(pilotProofRuns.length)} pilotbeviser er klar eller i QA.`,
      stopRule: proofGap?.witness || "Vis ikke en pilotkunde noget der ikke er bevidnet i browser eller tydeligt markeret QA.",
      href: proofGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-proof-run",
    },
    {
      title: "5. Første ordre håndteres manuelt",
      day: "Dag 2-3",
      owner: "Drift",
      status: operationsGap?.status || "qa",
      action: "Brug pilotdrift-runbooken til første kontrollerede ordre: produkt/pris, fil/PDF, betaling, korrektur, levering og bevis.",
      proof: `${formatCount(operationsReadyCount)}/${formatCount(pilotOperationsRunbook.length)} driftspunkter er klar eller i QA.`,
      stopRule: operationsGap?.operatorCheck || "Skift ikke ordrestatus eller produktion uden fil-, betaling- og ansvarscheck.",
      href: operationsGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-operations-runbook",
    },
    {
      title: "6. Første bevispakke samles",
      day: "Dag 3-5",
      owner: "Salg",
      status: proofGap?.status || "qa",
      action: "Saml screenshots eller noter fra cockpit, produkt/pris, template/designer, ordre/admin og supportspor som salgsbevis.",
      proof: `${formatCount(proofReadyCount)}/${formatCount(pilotProofRuns.length)} bevispunkter er klar eller i QA.`,
      stopRule: proofGap?.evidence || "Gem ikke kundeløfter som bevis. Kun observeret cockpit/browser/admin-bevis tæller.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#rehearsal-proof-capture",
    },
    {
      title: "7. Uge 1 beslutning",
      day: "Uge 1",
      owner: "Ledelse",
      status: priorityGap?.status || "qa",
      action: "Beslut om piloten fortsætter, pauses, kræver scopeændring eller kan nærme sig betalt første pakke.",
      proof: priorityGap?.reason || "Prioriteret kø og succeskriterier viser næste beslutning efter første pilotdage.",
      stopRule: priorityGap?.action || "Konverter ikke piloten til betalt aftale før success/exit-kriterier og økonomi er besluttet.",
      href: priorityGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
  ];
}

function getPilotWeekOneReport(
  pilotStartPlan: PilotStartPlanItem[],
  pilotSuccessCriteria: PilotSuccessCriterion[],
  orderOperationsRows: OrderOperationsRow[],
  paymentCheckoutRows: PaymentCheckoutRow[],
  supportCustomerRows: SupportCustomerRow[],
  mailNotificationRows: MailNotificationRow[],
  deliveryFulfillmentRows: DeliveryFulfillmentRow[],
  seoVisibilityRows: SeoVisibilityRow[],
  executivePriorityQueue: ExecutivePriorityItem[],
): PilotWeekOneReportItem[] {
  const startGap = getFirstOpenItem(pilotStartPlan);
  const successGap = getFirstOpenItem(pilotSuccessCriteria);
  const priorityGap = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const webprinterOrders = orderOperationsRows.find((item) => item.domain === "webprinter.dk");
  const webprinterPayment = paymentCheckoutRows.find((item) => item.domain === "webprinter.dk");
  const webprinterSupport = supportCustomerRows.find((item) => item.domain === "webprinter.dk");
  const webprinterMail = mailNotificationRows.find((item) => item.domain === "webprinter.dk");
  const webprinterDelivery = deliveryFulfillmentRows.find((item) => item.domain === "webprinter.dk");
  const webprinterSeo = seoVisibilityRows.find((item) => item.domain === "webprinter.dk");
  const startReadyCount = pilotStartPlan.filter((item) => item.status === "klar" || item.status === "qa").length;
  const successReadyCount = pilotSuccessCriteria.filter((item) => item.status === "klar" || item.status === "qa").length;
  const orderAttentionCount = webprinterOrders
    ? (webprinterOrders.problemCount ?? 0)
      + (webprinterOrders.reuploadCount ?? 0)
      + (webprinterOrders.awaitingCustomerFileCount ?? 0)
      + (webprinterOrders.missingFileCount ?? 0)
    : null;
  const unreadSupportCount = webprinterSupport
    ? (webprinterSupport.unreadCustomerMessageCount ?? 0) + (webprinterSupport.unreadTenantMessageCount ?? 0)
    : null;

  return [
    {
      title: "1. Startplan blev fulgt",
      area: "Start",
      status: startGap?.status || "qa",
      signal: `${formatCount(startReadyCount)}/${formatCount(pilotStartPlan.length)} starttrin er klar eller i QA.`,
      evidence: startGap?.proof || "Pilotstart-planen samler intern accept, kickoff-input, adgang, produktsti, første ordre og bevispakke.",
      next: startGap?.stopRule || "Luk første åbne starttrin før uge-1 rapporten bruges eksternt.",
      href: startGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-start-plan",
    },
    {
      title: "2. Første ordre og filklarhed",
      area: "Ordre",
      status: webprinterOrders?.status || "planlagt",
      signal: webprinterOrders
        ? `${formatCount(webprinterOrders.orderCount)} ordrer, ${formatCount(webprinterOrders.fileReadyCount)} filklar, ${formatCount(orderAttentionCount)} kræver opmærksomhed.`
        : "Ingen Webprinter ordresignal fundet i cockpitdata.",
      evidence: webprinterOrders?.detail || "Ordredrift signaler læser eksisterende ordrer og filrækker uden at ændre ordrestatus.",
      next: orderAttentionCount && orderAttentionCount > 0
        ? "Afklar fil, reupload, problem eller manglende kundemateriale før pilotstatus deles."
        : "Brug filklarhed som pilotbevis, hvis første ordre er manuelt gennemgået.",
      href: webprinterOrders?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#order-operations-signals",
    },
    {
      title: "3. Betaling og checkout-afklaring",
      area: "Betaling",
      status: webprinterPayment?.status || "planlagt",
      signal: webprinterPayment
        ? `${webprinterPayment.mode}. ${webprinterPayment.feeSummary}`
        : "Ingen Webprinter betalingssignal fundet i cockpitdata.",
      evidence: webprinterPayment?.detail || "Betalingssignaler viser kun eksisterende betalingsopsætning og pilotbeslutning.",
      next: webprinterPayment?.status === "klar"
        ? "Live betalingssignal kan nævnes som klar, hvis den manuelle ordretest også er bevidnet."
        : "Hold betaling som manuel/test i pilotstatus indtil live-opsætning er eksplicit besluttet.",
      href: webprinterPayment?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#payment-checkout-signals",
    },
    {
      title: "4. Dialog, mail og supporttryk",
      area: "Support",
      status: webprinterSupport?.status || webprinterMail?.status || "qa",
      signal: webprinterSupport
        ? `${formatCount(webprinterSupport.orderMessageCount)} ordremeddelelser, ${formatCount(webprinterSupport.platformMessageCount)} platformmeddelelser, ${formatCount(unreadSupportCount)} ulæste.`
        : "Ingen Webprinter supportsignal fundet i cockpitdata.",
      evidence: webprinterMail?.detail || webprinterSupport?.detail || "Support- og mailsignaler læser eksisterende beskeder og notifikationer uden at sende eller markere som læst.",
      next: unreadSupportCount && unreadSupportCount > 0
        ? "Afklar ulæste kunde- eller tenantbeskeder før uge-1 status bruges som salgsbevis."
        : "Brug supportoverblikket som bevis for at dialogsporet kan følges.",
      href: webprinterSupport?.href || webprinterMail?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#support-customer-signals",
    },
    {
      title: "5. Levering og produktion",
      area: "Levering",
      status: webprinterDelivery?.status || "planlagt",
      signal: webprinterDelivery
        ? `${formatCount(webprinterDelivery.ordersWithMethodCount)}/${formatCount(webprinterDelivery.orderSampleCount)} ordrer med leveringsmetode, ${formatCount(webprinterDelivery.ordersWithTrackingCount)} med tracking.`
        : "Ingen Webprinter leveringssignal fundet i cockpitdata.",
      evidence: webprinterDelivery?.detail || "Leveringssignaler læser eksisterende leverings- og trackingdata uden at ændre produktion.",
      next: webprinterDelivery?.status === "klar"
        ? "Leveringssignal kan bruges internt som driftsbevis."
        : "Hold levering som pilot-/QA-punkt, indtil metode, tracking og POD-sender er afklaret.",
      href: webprinterDelivery?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#delivery-fulfillment-signals",
    },
    {
      title: "6. SEO og synlighedsbevis",
      area: "Synlighed",
      status: webprinterSeo?.status || "planlagt",
      signal: webprinterSeo
        ? `${formatCount(webprinterSeo.clicks)} klik, ${formatCount(webprinterSeo.impressions)} visninger, position ${webprinterSeo.position ?? "ukendt"}.`
        : "Ingen Webprinter SEO/Search Console signal fundet i cockpitdata.",
      evidence: webprinterSeo?.detail || "SEO-laget er read-only og ændrer ikke Google Search Console eller SEO-rækker.",
      next: webprinterSeo?.status === "klar"
        ? "Brug synligheden som supplerende bevis, ikke som løfte om fremtidig trafik."
        : "Hold SEO som QA, hvis Search Console eller data ikke er fuldt bevidnet.",
      href: webprinterSeo?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#seo-visibility",
    },
    {
      title: "7. Fortsæt, pause eller konverter",
      area: "Beslutning",
      status: successGap?.status || priorityGap?.status || "qa",
      signal: `${formatCount(successReadyCount)}/${formatCount(pilotSuccessCriteria.length)} succeskriterier er klar eller i QA.`,
      evidence: successGap?.success || priorityGap?.reason || "Succeskriterier og prioriteret kø styrer uge-1 beslutningen.",
      next: successGap?.pauseIf || priorityGap?.action || "Beslut om piloten fortsætter, pauses, ændrer scope eller nærmer sig betalt første pakke.",
      href: successGap?.href || priorityGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-success-criteria",
    },
  ];
}

function getPilotConversionReadiness(
  pilotWeekOneReport: PilotWeekOneReportItem[],
  pilotAgreementChecklist: PilotAgreementChecklistItem[],
  printHouseOfferDraft: PrintHousePilotOfferDraftItem[],
  pilotSuccessCriteria: PilotSuccessCriterion[],
  commercialPilotAcceptance: CommercialPilotAcceptanceItem[],
  offerModel: PrintHouseOfferItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): PilotConversionReadinessItem[] {
  const weekOneGap = getFirstOpenItem(pilotWeekOneReport);
  const agreementGap = getFirstOpenItem(pilotAgreementChecklist);
  const offerGap = getFirstOpenItem(printHouseOfferDraft);
  const successGap = getFirstOpenItem(pilotSuccessCriteria);
  const acceptanceGap = getFirstOpenItem(commercialPilotAcceptance);
  const priceOffer = offerModel.find((item) => item.title.includes("prisramme"));
  const supportOffer = offerModel.find((item) => item.title.includes("Support"));
  const supplierOffer = offerModel.find((item) => item.title.includes("Supplier Bank"));
  const priorityGap = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const weekOneReadyCount = pilotWeekOneReport.filter((item) => item.status === "klar" || item.status === "qa").length;
  const agreementReadyCount = pilotAgreementChecklist.filter((item) => item.status === "klar" || item.status === "qa").length;
  const offerReadyCount = printHouseOfferDraft.filter((item) => item.status === "klar" || item.status === "qa").length;
  const successReadyCount = pilotSuccessCriteria.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Uge-1 bevis er samlet",
      area: "Bevis",
      status: weekOneGap?.status || "qa",
      proof: `${formatCount(weekOneReadyCount)}/${formatCount(pilotWeekOneReport.length)} uge-1 signaler er klar eller i QA.`,
      decision: weekOneGap?.next || "Brug uge-1 status som internt beslutningsgrundlag, ikke som eksternt løfte.",
      stopRule: weekOneGap?.status === "blokeret"
        ? "Konverter ikke piloten før det blokerede uge-1 signal er lukket."
        : "Lav manuel gennemgang af uge-1 bevis før kunden får en betalt pakke.",
      href: weekOneGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-week-one-report",
    },
    {
      title: "2. Aftalegrundlag kan tåle kundeblik",
      area: "Aftale",
      status: agreementGap?.status || "qa",
      proof: `${formatCount(agreementReadyCount)}/${formatCount(pilotAgreementChecklist.length)} aftalepunkter er klar eller i QA.`,
      decision: agreementGap?.missing || "Aftalecheck er klar nok til intern beslutning om betalt pilotpakke.",
      stopRule: agreementGap?.status === "blokeret"
        ? "Send ikke aftale, før det blokerede aftalepunkt er afklaret."
        : "Hold stadig beløb, binding og supportniveau uden for teksten, indtil CEO har godkendt dem.",
      href: agreementGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-agreement-checklist",
    },
    {
      title: "3. Tilbudskladde har korrekte grænser",
      area: "Tilbud",
      status: offerGap?.status || "qa",
      proof: `${formatCount(offerReadyCount)}/${formatCount(printHouseOfferDraft.length)} tilbudssektioner er klar eller i QA.`,
      decision: offerGap?.guardrail || "Kladde kan bruges som struktur, men ikke som sendt tilbud uden pris- og ansvarsbeslutning.",
      stopRule: offerGap?.status === "blokeret"
        ? "Konverter ikke til sendt tilbud, før den blokerede sektion er skrevet om."
        : "Behold Supplier Bank, automatiske priser og ubegrænset support som tydelige ikke-løfter.",
      href: offerGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#print-house-offer-draft",
    },
    {
      title: "4. Succeskriterier peger på fortsæt eller pause",
      area: "Beslutning",
      status: successGap?.status || "qa",
      proof: `${formatCount(successReadyCount)}/${formatCount(pilotSuccessCriteria.length)} succeskriterier er klar eller i QA.`,
      decision: successGap?.decision || "Beslut om piloten skal fortsætte, pauses, ændres i scope eller konverteres til betalt første pakke.",
      stopRule: successGap?.pauseIf || "Konverter ikke, hvis målingen stadig mangler ordreprøve, supportspor, filbevis eller klar næste beslutning.",
      href: successGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-success-criteria",
    },
    {
      title: "5. Økonomi og support er CEO-besluttet",
      area: "Økonomi",
      status: acceptanceGap?.status || priceOffer?.status || supportOffer?.status || "planlagt",
      proof: acceptanceGap?.evidence || priceOffer?.proof || supportOffer?.proof || "Pilotaccept, prisramme og supportlinje styrer kommerciel beslutning.",
      decision: acceptanceGap?.next || priceOffer?.decision || supportOffer?.decision || "Beslut pilotpris, månedlig ramme, inkluderede timer, svartid og hvad ændringer koster.",
      stopRule: "Ingen betalt pakke uden eksplicit CEO-beslutning om prisramme, supportgrænse og hvem der ejer printpriserne.",
      href: acceptanceGap?.href || priceOffer?.href || supportOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-pilot-acceptance",
    },
    {
      title: "6. Supplier Bank bliver ikke solgt for tidligt",
      area: "Leverandører",
      status: supplierOffer?.status || priorityGap?.status || "blokeret",
      proof: supplierOffer?.proof || priorityGap?.reason || "Supplier Bank er stadig et staged import-/beslutningsområde, ikke et automatisk live-løfte.",
      decision: supplierOffer?.decision || priorityGap?.action || "Sælg første pakke på kontrollerede produkter og manuel drift; hold supplier-automation som roadmap.",
      stopRule: "Hvis trykkeriet forventer automatisk supplier-pricing eller bred importbank ved start, skal scope ændres før aftalen.",
      href: supplierOffer?.href || priorityGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#offer-model",
    },
  ];
}

function getPaidPilotPackage(
  pilotConversionReadiness: PilotConversionReadinessItem[],
  offerModel: PrintHouseOfferItem[],
  commercialReadyCriteria: CommercialReadyCriterion[],
  paymentCheckoutRows: PaymentCheckoutRow[],
  legalConsentRows: LegalConsentRow[],
  deliveryFulfillmentRows: DeliveryFulfillmentRow[],
  commercialDecisionsQueue: CommercialDecision[],
): PaidPilotPackageItem[] {
  const conversionGap = getFirstOpenItem(pilotConversionReadiness);
  const commercialGap = getFirstOpenItem(commercialReadyCriteria);
  const tenantOffer = offerModel.find((item) => item.title.includes("Tenant"));
  const productOffer = offerModel.find((item) => item.title.includes("produktpakke"));
  const designerOffer = offerModel.find((item) => item.title.includes("Designer"));
  const checkoutOffer = offerModel.find((item) => item.title.includes("Checkout"));
  const seoOffer = offerModel.find((item) => item.title.includes("SEO"));
  const supportOffer = offerModel.find((item) => item.title.includes("Support"));
  const priceOffer = offerModel.find((item) => item.title.includes("prisramme"));
  const webprinterPayment = paymentCheckoutRows.find((item) => item.domain === "webprinter.dk");
  const webprinterLegal = legalConsentRows.find((item) => item.domain === "webprinter.dk");
  const webprinterDelivery = deliveryFulfillmentRows.find((item) => item.domain === "webprinter.dk");
  const paymentDecision = commercialDecisionsQueue.find((item) => item.title.includes("checkout"));
  const storyDecision = commercialDecisionsQueue.find((item) => item.title.includes("salgsfortælling"));
  const unresolvedDecision = commercialDecisionsQueue.find((item) => item.status === "blokeret")
    || commercialDecisionsQueue.find((item) => item.status === "qa")
    || commercialDecisionsQueue.find((item) => item.status === "planlagt");
  const conversionReadyCount = pilotConversionReadiness.filter((item) => item.status === "klar" || item.status === "qa").length;
  const commercialReadyCount = commercialReadyCriteria.filter((item) => item.status === "klar" || item.status === "qa").length;
  const unresolvedDecisionCount = commercialDecisionsQueue.filter((item) => item.status !== "klar").length;

  return [
    {
      title: "1. Hvad pakken indeholder",
      area: "Scope",
      status: conversionGap?.status || productOffer?.status || tenantOffer?.status || "qa",
      packageLine: "En kontrolleret første pakke: én tenant, få første produkter, designer/upload/template-spor, ordre/admin og manuel drift.",
      proof: `${formatCount(conversionReadyCount)}/${formatCount(pilotConversionReadiness.length)} konverteringspunkter er klar eller i QA.`,
      decision: productOffer?.decision || tenantOffer?.decision || "Beslut præcis hvilke 3-5 produkter og hvilket tenant/domæne der må indgå i første betalte pilot.",
      href: conversionGap?.href || productOffer?.href || tenantOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-conversion-readiness",
    },
    {
      title: "2. Hvad kunden ikke køber endnu",
      area: "Afgrænsning",
      status: storyDecision?.status || conversionGap?.status || "planlagt",
      packageLine: "Ikke fuld leverandørbank, ikke automatisk live-prissync, ikke ubegrænset katalog, ERP eller support uden særskilt fase.",
      proof: conversionGap?.stopRule || "Konverteringslaget samler ikke-løfterne før betalt pakke.",
      decision: storyDecision?.decision || "Skriv ikke-løfterne direkte ind i salgstekst og aftalegrundlag før kunden får pakken.",
      href: storyDecision?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#pilot-conversion-readiness",
    },
    {
      title: "3. Pris og betalingsform",
      area: "Økonomi",
      status: priceOffer?.status || paymentDecision?.status || webprinterPayment?.status || "planlagt",
      packageLine: priceOffer?.packageLine || "Setup, månedlig platform, supporttimer og eventuelle integrationsfaser som særskilte beslutningslinjer.",
      proof: webprinterPayment?.detail || priceOffer?.proof || "Betaling og prisramme er cockpit-signaler, ikke automatisk oprettede priser.",
      decision: priceOffer?.decision || paymentDecision?.decision || "CEO skal beslutte beløb, betalingsform, inkluderede timer og ekstraarbejde før tilbud sendes.",
      href: priceOffer?.href || paymentDecision?.href || webprinterPayment?.href || "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
    {
      title: "4. Ordre, levering og produktion",
      area: "Drift",
      status: webprinterDelivery?.status || checkoutOffer?.status || commercialGap?.status || "qa",
      packageLine: checkoutOffer?.packageLine || "Første ordre håndteres kontrolleret fra pris/design eller upload til admin, korrektur, produktion og levering.",
      proof: webprinterDelivery?.detail || commercialGap?.proof || "Levering, checkout og ordredrift læses fra eksisterende cockpitdata.",
      decision: checkoutOffer?.decision || webprinterDelivery?.detail || "Beslut om første ordre køres som test, manuel betaling eller live betaling med manuel produktionsovervågning.",
      href: webprinterDelivery?.href || checkoutOffer?.href || commercialGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#delivery-fulfillment-signals",
    },
    {
      title: "5. Support, jura og kontakt",
      area: "Ansvar",
      status: webprinterLegal?.status || supportOffer?.status || "qa",
      packageLine: supportOffer?.packageLine || "Support skal have fast kontaktvej, svartid, ændringsproces, juridisk firmaidentitet og kundens ansvar.",
      proof: webprinterLegal?.detail || supportOffer?.proof || "Jura, kontakt og support læses som signaler uden at sende mails eller ændre settings.",
      decision: supportOffer?.decision || "Beslut supportniveau, ansvar for produkt-/prisændringer, kontaktperson og hvad der kræver ny aftale.",
      href: webprinterLegal?.href || supportOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#legal-consent-signals",
    },
    {
      title: "6. Rapportering og næste fase",
      area: "Vækst",
      status: seoOffer?.status || unresolvedDecision?.status || "planlagt",
      packageLine: seoOffer?.packageLine || "Rapportering kan starte med synlighed, ordrestatus, supporttryk og uge-/månedlig pilotstatus.",
      proof: `${formatCount(commercialReadyCount)}/${formatCount(commercialReadyCriteria.length)} commercial-ready kriterier er klar eller i QA. ${formatCount(unresolvedDecisionCount)} ledelsesbeslutninger mangler stadig.`,
      decision: unresolvedDecision?.decision || seoOffer?.decision || "Beslut hvornår piloten fortsætter, pauses, ændrer scope eller bliver næste betalte fase.",
      href: unresolvedDecision?.href || seoOffer?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#commercial-ready-score",
    },
  ];
}

function getFirstCustomerOnboardingBoard(
  paidPilotPackage: PaidPilotPackageItem[],
  pilotPrintHouseIntake: PilotPrintHouseIntakeItem[],
  pilotOnboardingPlan: PilotOnboardingStep[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  pilotScopeAgreement: PilotScopeAgreementItem[],
  pilotResponsibilityMap: PilotResponsibilityItem[],
): FirstCustomerOnboardingItem[] {
  const packageGap = getFirstOpenItem(paidPilotPackage);
  const tenantIntake = pilotPrintHouseIntake.find((item) => item.title.includes("tenant"));
  const brandIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Brand"));
  const productIntake = pilotPrintHouseIntake.find((item) => item.title.includes("produkt"));
  const pricingIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Pris"));
  const templateIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Skabeloner"));
  const checkoutIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Checkout"));
  const seoIntake = pilotPrintHouseIntake.find((item) => item.title.includes("SEO"));
  const sourcingIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Sourcing"));
  const scopeGap = getFirstOpenItem(pilotScopeAgreement);
  const tenantStep = pilotOnboardingPlan.find((item) => item.title.includes("tenant"));
  const productStep = pilotOnboardingPlan.find((item) => item.title.includes("produktpakke"));
  const templateStep = pilotOnboardingPlan.find((item) => item.title.includes("designer"));
  const orderStep = pilotOnboardingPlan.find((item) => item.title.includes("ordre"));
  const accessStep = pilotOnboardingPlan.find((item) => item.title.includes("adminmail"));
  const seoStep = pilotOnboardingPlan.find((item) => item.title.includes("SEO"));
  const sourcingStep = pilotOnboardingPlan.find((item) => item.title.includes("Supplier Bank"));
  const supportStep = pilotOnboardingPlan.find((item) => item.title.includes("support"));
  const rehearsalStep = pilotOnboardingPlan.find((item) => item.title.includes("generalprøve"));
  const loginAccess = adminAccessReadiness.find((item) => item.title.includes("Login"));
  const productAccess = adminAccessReadiness.find((item) => item.title.includes("produktadministration"));
  const orderAccess = adminAccessReadiness.find((item) => item.title.includes("Ordrer"));
  const templateAccess = adminAccessReadiness.find((item) => item.title.includes("designer-skabeloner"));
  const adminOwner = pilotResponsibilityMap.find((item) => item.owner === "Admin/adgang");
  const operationsOwner = pilotResponsibilityMap.find((item) => item.owner === "Drift");
  const packageReadyCount = paidPilotPackage.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Kundens ja og pakkegrænse",
      area: "Aftale",
      status: packageGap?.status || "qa",
      customerInput: "Bekræft at kunden accepterer en afgrænset betalt pilotpakke, ikke en fuld platformsaftale.",
      internalCheck: `${formatCount(packageReadyCount)}/${formatCount(paidPilotPackage.length)} betalt-pilot linjer er klar eller i QA.`,
      stopRule: packageGap?.decision || "Stop hvis beløb, scope, ikke-løfter eller næste fase stadig er uklare.",
      href: packageGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#paid-pilot-package",
    },
    {
      title: "2. Tenant, domæne og brand",
      area: "Tenant",
      status: tenantStep?.status || tenantIntake?.status || brandIntake?.status || "qa",
      customerInput: `${tenantIntake?.needed || "Pilottrykkeri, domæne/subdomæne og ejerkontakt skal indsamles."} ${brandIntake?.needed || "Brandmateriale skal indsamles."}`,
      internalCheck: tenantStep?.action || "Klargør tenant-shell, branding, kontaktdata og offentlig identitet som manuel setupopgave.",
      stopRule: tenantStep?.stopCondition || "Stop hvis kunden forventer flere tenants eller fuld white-label rollout i første pakke.",
      href: tenantStep?.href || tenantIntake?.href || "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      title: "3. Produkter og prisansvar",
      area: "Produkter",
      status: productStep?.status || productIntake?.status || pricingIntake?.status || "blokeret",
      customerInput: `${productIntake?.needed || "Første produktpakke skal vælges."} ${pricingIntake?.needed || "Prislisten skal have en ejer."}`,
      internalCheck: productAccess?.manualCheck || productStep?.action || "Bekræft produktadministration, pris-preview og hvem der må ændre priser.",
      stopRule: productStep?.stopCondition || scopeGap?.decision || "Stop hvis kunden forventer fuldt katalog eller automatisk leverandørprisopdatering.",
      href: productStep?.href || productIntake?.href || productAccess?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "4. Skabeloner og filflow",
      area: "Designer",
      status: templateStep?.status || templateIntake?.status || templateAccess?.status || "blokeret",
      customerInput: templateIntake?.needed || "PDF-skabeloner, bleed/fals/ryg-regler, downloadfiler og uploadregler skal indsamles.",
      internalCheck: templateAccess?.manualCheck || templateStep?.action || "Bekræft at designer, upload og downloadskabelon kan forklares uden udviklerhjælp.",
      stopRule: templateStep?.stopCondition || "Stop hvis kunden forventer fuld PDF-automatik eller alle skabeloner fra start.",
      href: templateStep?.href || templateIntake?.href || templateAccess?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "5. Ordre, betaling og levering",
      area: "Drift",
      status: orderStep?.status || checkoutIntake?.status || orderAccess?.status || "blokeret",
      customerInput: checkoutIntake?.needed || "Betalingsform, faktura/onlinebetaling, ordremail, korrekturflow og produktionsejer skal afklares.",
      internalCheck: orderAccess?.manualCheck || orderStep?.action || "Kør eller find en kontrolleret ordre før kunden får go-live forventning.",
      stopRule: orderStep?.stopCondition || "Stop hvis første ordre kræver fuld automatisk produktion, supplier-submit eller ERP-integration.",
      href: orderStep?.href || checkoutIntake?.href || orderAccess?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "6. Adminadgang og ansvar",
      area: "Adgang",
      status: loginAccess?.status || accessStep?.status || adminOwner?.status || "qa",
      customerInput: "Aftal hvem hos kunden må godkende ændringer, se ordrer, svare kunder og bede om produkt-/prisændringer.",
      internalCheck: loginAccess?.manualCheck || accessStep?.action || adminOwner?.proof || "Log ind som admin@webprinter.dk og bekræft adgang til de krævede pilotområder.",
      stopRule: accessStep?.stopCondition || adminOwner?.risk || "Stop hvis adminmailen ikke kan drive pilotområderne uden udviklerhjælp.",
      href: accessStep?.href || loginAccess?.href || "/admin?force_domain=webprinter.dk",
    },
    {
      title: "7. SEO, rapportering og sourcinggrænse",
      area: "Rapportering",
      status: seoStep?.status === "blokeret" || sourcingStep?.status === "blokeret"
        ? "blokeret"
        : seoStep?.status || sourcingStep?.status || seoIntake?.status || sourcingIntake?.status || "planlagt",
      customerInput: `${seoIntake?.needed || "SEO- og rapporteringsadgang skal afklares."} ${sourcingIntake?.needed || "Sourcinggrænser skal forklares."}`,
      internalCheck: `${seoStep?.action || "Hold SEO som read-only synlighed."} ${sourcingStep?.action || "Hold Supplier Bank som staging og approval-gate."}`,
      stopRule: sourcingStep?.stopCondition || seoStep?.stopCondition || "Stop hvis kunden forventer garanteret SEO, åbne supplier-gates eller automatisk livepricing.",
      href: sourcingStep?.href || seoStep?.href || sourcingIntake?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "8. Kickoff og intern generalprøve",
      area: "Kickoff",
      status: rehearsalStep?.status || supportStep?.status || operationsOwner?.status || "qa",
      customerInput: "Book kundekickoff først når support, økonomi, ændringsgrænse og første ordrevej er forklaret.",
      internalCheck: rehearsalStep?.action || supportStep?.action || operationsOwner?.responsibility || "Kør intern generalprøve af demo, scope, ordre, ansvar og ikke-løfter før kunden får adgang.",
      stopRule: rehearsalStep?.stopCondition || supportStep?.stopCondition || operationsOwner?.risk || "Stop hvis interne staging-features ligner færdige produktløfter.",
      href: rehearsalStep?.href || supportStep?.href || operationsOwner?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#manual-rehearsal-route",
    },
  ];
}

function getFirstCustomerSetupWorkOrder(
  firstCustomerOnboarding: FirstCustomerOnboardingItem[],
  paidPilotPackage: PaidPilotPackageItem[],
  pilotOnboardingPlan: PilotOnboardingStep[],
  adminAccessReadiness: AdminAccessReadinessItem[],
): FirstCustomerSetupWorkOrderItem[] {
  const onboardingGap = getFirstOpenItem(firstCustomerOnboarding);
  const packageGap = getFirstOpenItem(paidPilotPackage);
  const tenantOnboarding = firstCustomerOnboarding.find((item) => item.area === "Tenant");
  const productOnboarding = firstCustomerOnboarding.find((item) => item.area === "Produkter");
  const templateOnboarding = firstCustomerOnboarding.find((item) => item.area === "Designer");
  const operationsOnboarding = firstCustomerOnboarding.find((item) => item.area === "Drift");
  const accessOnboarding = firstCustomerOnboarding.find((item) => item.area === "Adgang");
  const reportingOnboarding = firstCustomerOnboarding.find((item) => item.area === "Rapportering");
  const kickoffOnboarding = firstCustomerOnboarding.find((item) => item.area === "Kickoff");
  const tenantStep = pilotOnboardingPlan.find((item) => item.title.includes("tenant"));
  const productStep = pilotOnboardingPlan.find((item) => item.title.includes("produktpakke"));
  const templateStep = pilotOnboardingPlan.find((item) => item.title.includes("designer"));
  const orderStep = pilotOnboardingPlan.find((item) => item.title.includes("ordre"));
  const accessStep = pilotOnboardingPlan.find((item) => item.title.includes("adminmail"));
  const rehearsalStep = pilotOnboardingPlan.find((item) => item.title.includes("generalprøve"));
  const loginAccess = adminAccessReadiness.find((item) => item.title.includes("Login"));
  const productAccess = adminAccessReadiness.find((item) => item.title.includes("produktadministration"));
  const orderAccess = adminAccessReadiness.find((item) => item.title.includes("Ordrer"));
  const setupReadyCount = firstCustomerOnboarding.filter((item) => item.status === "klar" || item.status === "qa").length;
  const packageReadyCount = paidPilotPackage.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Åbn setup kun hvis pakken er afgrænset",
      area: "Start",
      status: packageGap?.status || onboardingGap?.status || "qa",
      workOrder: "Brug betalt-pilot pakken som intern startordre, men opret ikke tenant, kunde eller produkt før scope og stopregler er læst.",
      evidence: `${formatCount(packageReadyCount)}/${formatCount(paidPilotPackage.length)} pakkelinjer og ${formatCount(setupReadyCount)}/${formatCount(firstCustomerOnboarding.length)} onboardingtrin er klar eller i QA.`,
      stopRule: packageGap?.decision || onboardingGap?.stopRule || "Stop hvis aftalegrænse, pris/betaling eller ikke-løfter stadig er uklare.",
      href: packageGap?.href || onboardingGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#paid-pilot-package",
    },
    {
      title: "2. Klargør tenant-shell og brandkladde",
      area: "Tenant",
      status: tenantOnboarding?.status || tenantStep?.status || "qa",
      workOrder: tenantStep?.action || "Klargør tenant-shell, domænevalg, logo, farver, kontaktdata og footer som intern kladde.",
      evidence: tenantOnboarding?.internalCheck || tenantOnboarding?.customerInput || "Tenant- og brandinput skal være samlet før setup starter.",
      stopRule: tenantOnboarding?.stopRule || tenantStep?.stopCondition || "Stop hvis kunden forventer flere tenants eller fuld white-label rollout i første setup.",
      href: tenantOnboarding?.href || tenantStep?.href || "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      title: "3. Forbered produktpakke uden prisændringer",
      area: "Produkt",
      status: productOnboarding?.status || productStep?.status || productAccess?.status || "blokeret",
      workOrder: productStep?.action || "Lav intern produktliste med 3-5 første produkter, formatvalg, prisansvar og marginramme.",
      evidence: productAccess?.manualCheck || productOnboarding?.internalCheck || "Produktadmin og pris-preview skal kunne bevidnes manuelt.",
      stopRule: productOnboarding?.stopRule || productStep?.stopCondition || "Stop hvis setup kræver nye prisberegninger, fuldt katalog eller automatisk leverandørprisopdatering.",
      href: productOnboarding?.href || productStep?.href || productAccess?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "4. Saml template- og filflow-pakke",
      area: "Designer",
      status: templateOnboarding?.status || templateStep?.status || "blokeret",
      workOrder: templateStep?.action || "Saml PDF-skabeloner, bleed/fals/ryg-regler, downloadfiler, uploadregler og korrekturflow som intern opsætningspakke.",
      evidence: templateOnboarding?.internalCheck || templateOnboarding?.customerInput || "Template- og filflow skal kunne forklares uden udviklerhjælp.",
      stopRule: templateOnboarding?.stopRule || templateStep?.stopCondition || "Stop hvis kunden forventer fuld PDF-automatik eller alle skabeloner ved start.",
      href: templateOnboarding?.href || templateStep?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "5. Planlæg første ordrevej og driftstest",
      area: "Drift",
      status: operationsOnboarding?.status || orderStep?.status || orderAccess?.status || "blokeret",
      workOrder: orderStep?.action || "Planlæg testordre fra pris/design eller upload til admin, korrektur, produktion og levering.",
      evidence: orderAccess?.manualCheck || operationsOnboarding?.internalCheck || "Ordreområdet skal vise kunde, produkt, fil/design, pris og næste produktionstrin.",
      stopRule: operationsOnboarding?.stopRule || orderStep?.stopCondition || "Stop hvis første ordre kræver fuld automatisk produktion, supplier-submit eller ERP-integration.",
      href: operationsOnboarding?.href || orderStep?.href || orderAccess?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "6. Bevis adminadgang før kunden involveres",
      area: "Adgang",
      status: accessOnboarding?.status || accessStep?.status || loginAccess?.status || "qa",
      workOrder: accessStep?.action || "Log ind som admin@webprinter.dk og gå igennem dashboard, produkter, templates, ordrer, SEO og Supplier Bank.",
      evidence: loginAccess?.manualCheck || accessOnboarding?.internalCheck || "Adminadgang skal være manuelt bevidnet før kundekickoff.",
      stopRule: accessOnboarding?.stopRule || accessStep?.stopCondition || "Stop hvis adminmailen ikke kan drive pilotområderne uden udviklerhjælp.",
      href: accessOnboarding?.href || accessStep?.href || loginAccess?.href || "/admin?force_domain=webprinter.dk",
    },
    {
      title: "7. Sæt rapportering og sourcing som grænser",
      area: "Rapportering",
      status: reportingOnboarding?.status || "planlagt",
      workOrder: "Beskriv SEO som synlighed/rapportering og Supplier Bank som intern staging, ikke som garanteret vækst eller live supplier-automation.",
      evidence: reportingOnboarding?.internalCheck || reportingOnboarding?.customerInput || "Rapportering og sourcing skal forklares med tydelige stopregler.",
      stopRule: reportingOnboarding?.stopRule || "Stop hvis kunden forventer garanteret SEO, åbne supplier-gates eller automatisk livepricing.",
      href: reportingOnboarding?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "8. Kør intern generalprøve som sidste gate",
      area: "Kickoff",
      status: kickoffOnboarding?.status || rehearsalStep?.status || "qa",
      workOrder: rehearsalStep?.action || "Kør intern generalprøve af demo, scope, første ordre, ansvar, support og ikke-løfter før kundekickoff.",
      evidence: kickoffOnboarding?.internalCheck || "Generalprøven skal bevise at opsætningen kan vises uden at sælge uafklarede features.",
      stopRule: kickoffOnboarding?.stopRule || rehearsalStep?.stopCondition || "Stop hvis interne staging-features ligner færdige produktløfter.",
      href: kickoffOnboarding?.href || rehearsalStep?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#manual-rehearsal-route",
    },
  ];
}

function getFirstCustomerKickoffAgenda(
  firstCustomerSetupWorkOrder: FirstCustomerSetupWorkOrderItem[],
  firstCustomerOnboarding: FirstCustomerOnboardingItem[],
  paidPilotPackage: PaidPilotPackageItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): FirstCustomerKickoffAgendaItem[] {
  const setupGap = getFirstOpenItem(firstCustomerSetupWorkOrder);
  const onboardingGap = getFirstOpenItem(firstCustomerOnboarding);
  const packageGap = getFirstOpenItem(paidPilotPackage);
  const priorityGap = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const startSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Start");
  const tenantSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Tenant");
  const productSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Produkt");
  const templateSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Designer");
  const operationsSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Drift");
  const accessSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Adgang");
  const reportingSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Rapportering");
  const kickoffSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Kickoff");
  const paidScope = paidPilotPackage.find((item) => item.area === "Scope");
  const paidBoundary = paidPilotPackage.find((item) => item.area === "Afgrænsning");
  const paidEconomy = paidPilotPackage.find((item) => item.area === "Økonomi");
  const readySetupCount = firstCustomerSetupWorkOrder.filter((item) => item.status === "klar" || item.status === "qa").length;
  const readyOnboardingCount = firstCustomerOnboarding.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Åbn mødet med pilotens grænse",
      segment: "Start",
      status: startSetup?.status || packageGap?.status || "qa",
      agenda: "Forklar at kickoff handler om en kontrolleret betalt pilotpakke, ikke fuld platformsaftale eller automatisk leverandørmotor.",
      evidence: startSetup?.evidence || paidScope?.proof || `${formatCount(readySetupCount)}/${formatCount(firstCustomerSetupWorkOrder.length)} setup-punkter er klar eller i QA.`,
      boundary: startSetup?.stopRule || paidBoundary?.packageLine || "Stop mødet hvis kunden forventer fuldt katalog, live supplier-pricing eller ubegrænset support fra dag ét.",
      href: startSetup?.href || paidScope?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#first-customer-setup-work-order",
    },
    {
      title: "2. Bekræft tenant, domæne og brand",
      segment: "Tenant",
      status: tenantSetup?.status || "qa",
      agenda: "Gennemgå pilotnavn, domæne/subdomæne, logo, farver, kontaktdata, footer og hvem der godkender ændringer.",
      evidence: tenantSetup?.evidence || "Tenant- og brandinput skal være samlet før setup starter.",
      boundary: tenantSetup?.stopRule || "Hold første setup til én tenant og én brandretning.",
      href: tenantSetup?.href || "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      title: "3. Lås første produktpakke og prisansvar",
      segment: "Produkter",
      status: productSetup?.status || paidEconomy?.status || "blokeret",
      agenda: "Vælg de første 3-5 produkter, formatvalg, prisansvar, marginproces og hvem der må bede om prisændringer.",
      evidence: productSetup?.evidence || paidEconomy?.proof || "Produktadmin og pris-preview skal kunne bevidnes manuelt.",
      boundary: productSetup?.stopRule || paidEconomy?.decision || "Ingen nye prisberegninger eller automatisk prisopdatering uden separat beslutning.",
      href: productSetup?.href || paidEconomy?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "4. Aftal skabeloner, upload og korrektur",
      segment: "Filer",
      status: templateSetup?.status || "blokeret",
      agenda: "Aftal hvilke produkter bruger designer, upload, downloadskabelon, bleed/fals/ryg-regler og korrektur.",
      evidence: templateSetup?.evidence || "Template- og filflow skal kunne forklares uden udviklerhjælp.",
      boundary: templateSetup?.stopRule || "Ingen løfte om fuld PDF-automatik eller alle skabeloner fra start.",
      href: templateSetup?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "5. Aftal første ordrevej, betaling og levering",
      segment: "Ordre",
      status: operationsSetup?.status || "blokeret",
      agenda: "Gennemgå første ordre fra pris/design eller upload til admin, korrektur, betaling/faktura, produktion og levering.",
      evidence: operationsSetup?.evidence || "Ordreområdet skal vise kunde, produkt, fil/design, pris og næste produktionstrin.",
      boundary: operationsSetup?.stopRule || "Ingen ERP, automatisk supplier-submit eller fuld produktionsautomatik i første kickoff.",
      href: operationsSetup?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "6. Aftal adgang, support og ansvar",
      segment: "Ansvar",
      status: accessSetup?.status || "qa",
      agenda: "Aftal kontaktperson, supportvej, svartid, hvem svarer kunder, og hvem må ændre produkter, priser og templates.",
      evidence: accessSetup?.evidence || "Adminadgang skal være manuelt bevidnet før kundekickoff.",
      boundary: accessSetup?.stopRule || "Stop hvis adminmail eller ansvar ikke kan bære pilotdriften uden udviklerhjælp.",
      href: accessSetup?.href || "/admin?force_domain=webprinter.dk",
    },
    {
      title: "7. Forklar rapportering og sourcing uden at oversælge",
      segment: "Rapportering",
      status: reportingSetup?.status || "planlagt",
      agenda: "Vis hvordan SEO/synlighed, ordrestatus og supporttryk kan følges, og forklar Supplier Bank som intern staging.",
      evidence: reportingSetup?.evidence || "Rapportering og sourcing skal forklares med tydelige stopregler.",
      boundary: reportingSetup?.stopRule || "Ingen garanti for SEO, åbne supplier-gates eller automatisk livepricing.",
      href: reportingSetup?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "8. Luk mødet med næste handling",
      segment: "Næste",
      status: kickoffSetup?.status || priorityGap?.status || onboardingGap?.status || "qa",
      agenda: "Gentag næste handling: hvilket materiale kunden leverer, hvad vi klargør internt, og hvornår første generalprøve eller ordretest sker.",
      evidence: kickoffSetup?.evidence || `${formatCount(readyOnboardingCount)}/${formatCount(firstCustomerOnboarding.length)} onboardingtrin er klar eller i QA.`,
      boundary: priorityGap?.action || kickoffSetup?.stopRule || "Aftal ikke go-live før intern generalprøve, ansvar og ordrevej er bevidnet.",
      href: kickoffSetup?.href || priorityGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
  ];
}

function getFirstCustomerKickoffFollowUp(
  firstCustomerKickoffAgenda: FirstCustomerKickoffAgendaItem[],
  firstCustomerSetupWorkOrder: FirstCustomerSetupWorkOrderItem[],
  paidPilotPackage: PaidPilotPackageItem[],
  executivePriorityQueue: ExecutivePriorityItem[],
): FirstCustomerKickoffFollowUpItem[] {
  const agendaGap = getFirstOpenItem(firstCustomerKickoffAgenda);
  const setupGap = getFirstOpenItem(firstCustomerSetupWorkOrder);
  const packageGap = getFirstOpenItem(paidPilotPackage);
  const priorityGap = executivePriorityQueue.find((item) => item.status === "blokeret") || getFirstOpenItem(executivePriorityQueue);
  const startAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Start");
  const tenantAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Tenant");
  const productAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Produkter");
  const fileAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Filer");
  const orderAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Ordre");
  const responsibilityAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Ansvar");
  const reportingAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Rapportering");
  const nextAgenda = firstCustomerKickoffAgenda.find((item) => item.segment === "Næste");
  const tenantSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Tenant");
  const productSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Produkt");
  const templateSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Designer");
  const operationsSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Drift");
  const accessSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Adgang");
  const readyAgendaCount = firstCustomerKickoffAgenda.filter((item) => item.status === "klar" || item.status === "qa").length;

  return [
    {
      title: "1. Sendbar recap uden at sende mail",
      audience: "Kunde",
      status: agendaGap?.status || setupGap?.status || "qa",
      recap: startAgenda?.agenda || "Vi aftalte en kontrolleret betalt pilotpakke med tydelige grænser.",
      ownerAction: `Intern kladde kan nævne ${formatCount(readyAgendaCount)}/${formatCount(firstCustomerKickoffAgenda.length)} kickoffpunkter som klar eller i QA.`,
      guardrail: startAgenda?.boundary || packageGap?.decision || "Send ikke en egentlig mail eller tilbud før pris, scope og ansvar er godkendt.",
      href: startAgenda?.href || agendaGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#first-customer-kickoff-agenda",
    },
    {
      title: "2. Kundens materiale efter mødet",
      audience: "Kunde",
      status: tenantAgenda?.status || fileAgenda?.status || "qa",
      recap: `${tenantAgenda?.agenda || "Kunden skal bekræfte tenant, domæne og brand."} ${fileAgenda?.agenda || "Kunden skal levere skabeloner og filregler."}`,
      ownerAction: tenantSetup?.workOrder || templateSetup?.workOrder || "Saml kundens brand-, domæne- og filmateriale før intern opsætning.",
      guardrail: tenantAgenda?.boundary || fileAgenda?.boundary || "Start ikke bred tenant- eller template-opsætning før materialet er afgrænset.",
      href: tenantAgenda?.href || fileAgenda?.href || "/admin/branding-v2?force_domain=webprinter.dk",
    },
    {
      title: "3. Produkt- og prisafklaring",
      audience: "Produkt",
      status: productAgenda?.status || productSetup?.status || "blokeret",
      recap: productAgenda?.agenda || "Første produktpakke, prisansvar, marginproces og ændringsret skal låses.",
      ownerAction: productSetup?.workOrder || "Lav intern produktliste og marker prisansvar uden at ændre prislogik.",
      guardrail: productAgenda?.boundary || productSetup?.stopRule || "Ingen nye prisberegninger, fuldt katalog eller automatisk prisopdatering i opfølgningen.",
      href: productAgenda?.href || productSetup?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "4. Ordrevej og ansvar efter kickoff",
      audience: "Drift",
      status: orderAgenda?.status || responsibilityAgenda?.status || operationsSetup?.status || "qa",
      recap: `${orderAgenda?.agenda || "Første ordrevej skal forklares."} ${responsibilityAgenda?.agenda || "Support, adgang og ansvar skal afklares."}`,
      ownerAction: operationsSetup?.workOrder || accessSetup?.workOrder || "Planlæg intern ordretest og adgangscheck før kunden får go-live dato.",
      guardrail: orderAgenda?.boundary || responsibilityAgenda?.boundary || "Lov ikke ERP, supplier-submit, fuld automatik eller ubegrænset support.",
      href: orderAgenda?.href || responsibilityAgenda?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "5. Rapportering og sourcing som roadmap",
      audience: "Ledelse",
      status: reportingAgenda?.status || "planlagt",
      recap: reportingAgenda?.agenda || "Rapportering er synlighed og Supplier Bank er intern staging.",
      ownerAction: "Hold SEO/Search Console og Supplier Bank i cockpit som bevisområder, ikke som kundeløfter.",
      guardrail: reportingAgenda?.boundary || "Ingen garanti for SEO, åbne supplier-gates eller automatisk livepricing.",
      href: reportingAgenda?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "6. Næste interne handling",
      audience: "Internt",
      status: nextAgenda?.status || priorityGap?.status || "qa",
      recap: nextAgenda?.agenda || "Næste handling skal være materiale, intern opsætning eller første generalprøve.",
      ownerAction: priorityGap?.action || nextAgenda?.boundary || "Vælg én intern handling før næste kundestatus.",
      guardrail: setupGap?.stopRule || priorityGap?.reason || "Aftal ikke go-live før intern generalprøve, ansvar og ordrevej er bevidnet.",
      href: nextAgenda?.href || priorityGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
  ];
}

function getCustomerMaterialCheckpoint(
  firstCustomerKickoffFollowUp: FirstCustomerKickoffFollowUpItem[],
  firstCustomerOnboarding: FirstCustomerOnboardingItem[],
  firstCustomerSetupWorkOrder: FirstCustomerSetupWorkOrderItem[],
  pilotPrintHouseIntake: PilotPrintHouseIntakeItem[],
): CustomerMaterialCheckpointItem[] {
  const followUpGap = getFirstOpenItem(firstCustomerKickoffFollowUp);
  const onboardingGap = getFirstOpenItem(firstCustomerOnboarding);
  const customerMaterial = firstCustomerKickoffFollowUp.find((item) => item.title.includes("materiale"));
  const productClarification = firstCustomerKickoffFollowUp.find((item) => item.title.includes("Produkt"));
  const orderFollowUp = firstCustomerKickoffFollowUp.find((item) => item.title.includes("Ordrevej"));
  const reportingFollowUp = firstCustomerKickoffFollowUp.find((item) => item.title.includes("Rapportering"));
  const nextFollowUp = firstCustomerKickoffFollowUp.find((item) => item.title.includes("Næste"));
  const tenantOnboarding = firstCustomerOnboarding.find((item) => item.area === "Tenant");
  const productOnboarding = firstCustomerOnboarding.find((item) => item.area === "Produkter");
  const fileOnboarding = firstCustomerOnboarding.find((item) => item.area === "Designer");
  const operationsOnboarding = firstCustomerOnboarding.find((item) => item.area === "Drift");
  const accessOnboarding = firstCustomerOnboarding.find((item) => item.area === "Adgang");
  const reportingOnboarding = firstCustomerOnboarding.find((item) => item.area === "Rapportering");
  const tenantSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Tenant");
  const productSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Produkt");
  const fileSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Designer");
  const operationsSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Drift");
  const accessSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Adgang");
  const reportingSetup = firstCustomerSetupWorkOrder.find((item) => item.area === "Rapportering");
  const tenantIntake = pilotPrintHouseIntake.find((item) => item.title.includes("tenant"));
  const brandIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Brand"));
  const productIntake = pilotPrintHouseIntake.find((item) => item.title.includes("produkt"));
  const priceIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Pris"));
  const templateIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Skabeloner"));
  const checkoutIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Checkout"));
  const seoIntake = pilotPrintHouseIntake.find((item) => item.title.includes("SEO"));
  const sourcingIntake = pilotPrintHouseIntake.find((item) => item.title.includes("Sourcing"));

  return [
    {
      title: "1. Domæne, kontakt og brandpakke",
      area: "Brand",
      status: tenantOnboarding?.status || tenantSetup?.status || brandIntake?.status || "qa",
      expected: `${tenantIntake?.needed || "Pilottrykkeri, domæne/subdomæne og godkender skal bekræftes."} ${brandIntake?.needed || "Logo, farver, fonte og kontaktdata skal leveres."}`,
      currentSignal: tenantSetup?.evidence || customerMaterial?.recap || "Materialet skal bekræftes manuelt efter kickoff.",
      next: tenantSetup?.workOrder || "Bekræft brandpakken før tenant- eller storefrontsetup fortsætter.",
      href: tenantSetup?.href || tenantOnboarding?.href || "/admin/branding-v2?force_domain=webprinter.dk",
    },
    {
      title: "2. Første produkter og prisansvar",
      area: "Produkter",
      status: productOnboarding?.status || productSetup?.status || productClarification?.status || "blokeret",
      expected: `${productIntake?.needed || "De første 3-5 produkter og formatvalg skal vælges."} ${priceIntake?.needed || "Prisansvar, margin og ændringsproces skal bekræftes."}`,
      currentSignal: productSetup?.evidence || productClarification?.recap || "Produkt- og prisinput skal manuelt afstemmes med kunden.",
      next: productClarification?.ownerAction || productSetup?.workOrder || "Lav intern produktliste uden at ændre prislogik.",
      href: productSetup?.href || productClarification?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "3. Skabeloner, filer og korrekturregler",
      area: "Filer",
      status: fileOnboarding?.status || fileSetup?.status || customerMaterial?.status || "blokeret",
      expected: templateIntake?.needed || "PDF-skabeloner, bleed/fals/ryg-regler, downloadfiler, uploadregler og korrekturflow skal leveres.",
      currentSignal: fileSetup?.evidence || customerMaterial?.recap || "Fil- og templatepakken er ikke automatisk verificeret; den skal gennemgås manuelt.",
      next: customerMaterial?.ownerAction || fileSetup?.workOrder || "Saml template- og filflow-pakken før designer/setup fortsætter.",
      href: fileSetup?.href || customerMaterial?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "4. Ordre, betaling og levering",
      area: "Drift",
      status: operationsOnboarding?.status || operationsSetup?.status || orderFollowUp?.status || "blokeret",
      expected: checkoutIntake?.needed || "Betalingsform, ordremail, korrekturflow, produktionsejer og leveringsmodel skal bekræftes.",
      currentSignal: operationsSetup?.evidence || orderFollowUp?.recap || "Ordrevej og ansvar skal kunne bevidnes før go-live.",
      next: orderFollowUp?.ownerAction || operationsSetup?.workOrder || "Planlæg intern ordretest og adgangscheck.",
      href: operationsSetup?.href || orderFollowUp?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "5. Supportkontakt og adgangsansvar",
      area: "Ansvar",
      status: accessOnboarding?.status || accessSetup?.status || "qa",
      expected: "Kunden skal bekræfte kontaktperson, supportvej, svartid, ændringsansvar og hvem der må godkende opsætning.",
      currentSignal: accessSetup?.evidence || "Admin- og ansvarsspor skal bekræftes manuelt; cockpittet sender ikke adgangslinks.",
      next: accessSetup?.workOrder || "Bevis adminadgang og ansvar før kunden får forventning om go-live.",
      href: accessSetup?.href || accessOnboarding?.href || "/admin?force_domain=webprinter.dk",
    },
    {
      title: "6. Rapportering, SEO og sourcinggrænser",
      area: "Rapportering",
      status: reportingOnboarding?.status || reportingSetup?.status || reportingFollowUp?.status || "planlagt",
      expected: `${seoIntake?.needed || "SEO-/rapporteringsadgang og KPI'er skal aftales."} ${sourcingIntake?.needed || "Sourcing og ikke-løfter skal bekræftes."}`,
      currentSignal: reportingSetup?.evidence || reportingFollowUp?.recap || "Rapportering og Supplier Bank holdes som read-only/staging bevis.",
      next: reportingFollowUp?.ownerAction || reportingSetup?.workOrder || "Sæt rapportering og sourcing som grænser før næste kundestatus.",
      href: reportingSetup?.href || reportingFollowUp?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "7. Næste interne handling efter materialet",
      area: "Næste",
      status: nextFollowUp?.status || followUpGap?.status || onboardingGap?.status || "qa",
      expected: "Når materialet er manuelt bekræftet, skal næste interne handling være én tydelig opsætnings- eller generalprøveopgave.",
      currentSignal: nextFollowUp?.recap || "Kundemateriale er et manuelt checkpoint, ikke en automatisk import.",
      next: nextFollowUp?.ownerAction || followUpGap?.ownerAction || "Vælg én intern handling før næste kundestatus.",
      href: nextFollowUp?.href || followUpGap?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#priority-queue",
    },
  ];
}

function getProductionReleaseReadiness(
  customerMaterialCheckpoint: CustomerMaterialCheckpointItem[],
  pilotProofRuns: PilotProofRunItem[],
  commercialReadyCriteria: CommercialReadyCriterion[],
  adminAccessReadiness: AdminAccessReadinessItem[],
  commercialDecisionsQueue: CommercialDecision[],
): ProductionReleaseReadinessItem[] {
  const materialBlockers = customerMaterialCheckpoint.filter((item) => item.status === "blokeret").length;
  const pilotProofReadyCount = pilotProofRuns.filter((item) => item.status === "klar" || item.status === "qa").length;
  const commercialReadyBlockers = commercialReadyCriteria.filter((item) => item.status === "blokeret").length;
  const adminAccessBlockers = adminAccessReadiness.filter((item) => item.status === "blokeret").length;
  const supplierBlocker = commercialDecisionsQueue.find((item) => (
    item.status === "blokeret"
    && (item.title.includes("Supplier") || item.impact.includes("Supplier Bank"))
  ));
  const materialGap = getFirstOpenItem(customerMaterialCheckpoint);
  const pilotProofGap = getFirstOpenItem(pilotProofRuns);
  const commercialReadyGap = getFirstOpenItem(commercialReadyCriteria);
  const accessGap = getFirstOpenItem(adminAccessReadiness);

  return [
    {
      title: "1. Produktionsbuild og lokal røgtest",
      area: "Kode",
      status: "qa",
      evidence: "Build- og røgtestbevis ligger uden for browseren og skal køres før push/deploy.",
      required: "Kør produktionsbuild, kontroller Webprinter, Salgsmapper, Onlinetryksager og driftsklarhedscockpittet på localhost.",
      stopRule: "Stop hvis build fejler, en tenant-route ikke svarer 200, eller browseren viser blank side.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
    {
      title: "2. Tenantbeviser før ekstern brug",
      area: "Tenant",
      status: materialBlockers === 0 && pilotProofReadyCount >= 2 && commercialReadyBlockers === 0 ? "qa" : "blokeret",
      evidence: `${formatCount(pilotProofReadyCount)}/${formatCount(pilotProofRuns.length)} pilotbeviser er klar eller i QA; ${formatCount(commercialReadyBlockers)} commercial-ready kriterier er blokeret.`,
      required: materialGap?.next || pilotProofGap?.next || commercialReadyGap?.next || "Bevis mindst Webprinter produkt/pris, Salgsmapper template-flow og en kontrolleret ordrevej.",
      stopRule: materialGap?.expected || pilotProofGap?.stopCondition || commercialReadyGap?.next || "Stop deploy som salgsklar hvis tenantbeviser kun er planlagt.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#proof-flow",
    },
    {
      title: "3. Adminmail og operatøradgang",
      area: "Adgang",
      status: adminAccessBlockers === 0 ? "qa" : "blokeret",
      evidence: `${formatCount(adminAccessReadiness.length - adminAccessBlockers)}/${formatCount(adminAccessReadiness.length)} adgangspunkter er uden hård blokering.`,
      required: accessGap?.manualCheck || "Log ind som admin@webprinter.dk og bevis dashboard, produkter, templates, ordrer, SEO, beskeder, betaling og Supplier Bank.",
      stopRule: accessGap?.stopRule || "Stop hvis adminmailen ikke kan drive pilotområderne uden udviklerhjælp.",
      href: accessGap?.href || "/admin?force_domain=webprinter.dk",
    },
    {
      title: "4. Pris, POD og Supplier Bank holdes kontrolleret",
      area: "Data",
      status: supplierBlocker ? "blokeret" : "qa",
      evidence: supplierBlocker?.impact || "Supplier Bank må stadig kun præsenteres som staging/sourcing, og pricing/POD ændres ikke i en release uden separat accept.",
      required: supplierBlocker?.decision || "Bekræft at releasen ikke ændrer prisberegning, POD v1/v2, live supplier-pricing eller publicering af importer uden approval.",
      stopRule: supplierBlocker
        ? "Stop hvis åbne Supplier Bank-gates bliver solgt eller deployed som live automatik."
        : "Stop hvis en release indeholder skjulte pris-, POD- eller leverandørdataændringer.",
      href: supplierBlocker?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "5. Deploy-ejer og rollbacknote",
      area: "Release",
      status: "planlagt",
      evidence: "Cockpittet opretter ikke branches, commits, deployments eller rollbacknoter.",
      required: "Vælg hvem der deployer, hvad der er med i releasen, og hvilken sidste kendte gode commit/produktionstilstand der kan rulles tilbage til.",
      stopRule: "Stop hvis releaseindhold, stagingstatus eller rollbackvej ikke kan forklares kort.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#decision-queue",
    },
    {
      title: "6. Efter-deploy tenant-røgtest",
      area: "Produktion",
      status: "planlagt",
      evidence: "Produktionsbevis skal ske efter deploy på de rigtige domæner, ikke kun på localhost.",
      required: "Efter deploy: åbn Webprinter, Salgsmapper, Onlinetryksager, adminlogin, produkt/pris, designer/template, checkout/order og kontakt/lead flow.",
      stopRule: "Stop eksternt salg hvis en live tenant, prispreview, designerhåndoff, ordreflow eller adminbesked ikke kan vises.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk#manual-rehearsal-route",
    },
  ];
}

function getProductionReleaseProofCapture(
  productionReleaseReadiness: ProductionReleaseReadinessItem[],
): ProductionReleaseProofItem[] {
  const buildGate = productionReleaseReadiness.find((item) => item.area === "Kode");
  const tenantGate = productionReleaseReadiness.find((item) => item.area === "Tenant");
  const accessGate = productionReleaseReadiness.find((item) => item.area === "Adgang");
  const dataGate = productionReleaseReadiness.find((item) => item.area === "Data");
  const releaseGate = productionReleaseReadiness.find((item) => item.area === "Release");
  const productionGate = productionReleaseReadiness.find((item) => item.area === "Produktion");

  return [
    {
      title: "1. Build- og localhostbevis",
      owner: "Codex / teknisk operatør",
      status: buildGate?.status || "qa",
      capture: "Gem buildkommando, buildresultat og 200 OK for cockpit, Webprinter produkt, Salgsmapper produkt og Onlinetryksager admin.",
      acceptedWhen: buildGate?.required || "Accepteret når build passerer og de fire localhost-ruter svarer uden blank side.",
      stopRule: buildGate?.stopRule || "Stop hvis build eller en tenant-route fejler.",
      href: buildGate?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#production-release-readiness",
    },
    {
      title: "2. Tenantflow-bevis før release",
      owner: "Operatør / CEO",
      status: tenantGate?.status || "blokeret",
      capture: "Gem skærmbilleder eller noter fra Webprinter produkt/pris, Salgsmapper template-flow og første ordre-/adminspor.",
      acceptedWhen: tenantGate?.required || "Accepteret når tenantbeviserne kan vises uden teknisk forklaring ved siden af.",
      stopRule: tenantGate?.stopRule || "Stop hvis et tenantbevis kun er planlagt.",
      href: tenantGate?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#proof-flow",
    },
    {
      title: "3. Adminmail-adgangsbevis",
      owner: "Operatør",
      status: accessGate?.status || "qa",
      capture: "Notér frisk login med admin@webprinter.dk og hvilke adminområder der blev åbnet uden udviklerhjælp.",
      acceptedWhen: accessGate?.required || "Accepteret når adminmailen kan åbne pilotområderne og finde næste handling.",
      stopRule: accessGate?.stopRule || "Stop hvis adminmailen ikke kan drive pilotområderne.",
      href: accessGate?.href || "/admin?force_domain=webprinter.dk",
    },
    {
      title: "4. Data- og ikke-løftebevis",
      owner: "CEO / produktansvarlig",
      status: dataGate?.status || "qa",
      capture: "Gem noten om at releasen ikke ændrer pricing, POD v1/v2, live supplier-pricing eller Supplier Bank publicering.",
      acceptedWhen: dataGate?.required || "Accepteret når datagrænserne er læst og kan forklares kort.",
      stopRule: dataGate?.stopRule || "Stop hvis releaseindholdet skjuler data-, pris- eller leverandørændringer.",
      href: dataGate?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "5. Deploy- og rollbackbevis",
      owner: "Release-ejer",
      status: releaseGate?.status || "planlagt",
      capture: "Notér branch/commit, hvem deployer, hvad der er med, og hvilken kendt god produktionstilstand der kan rulles tilbage til.",
      acceptedWhen: releaseGate?.required || "Accepteret når releaseindhold og rollbackvej kan forklares på ét minut.",
      stopRule: releaseGate?.stopRule || "Stop hvis rollback ikke er kendt.",
      href: releaseGate?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#decision-queue",
    },
    {
      title: "6. Efter-deploy livebevis",
      owner: "Operatør / release-ejer",
      status: productionGate?.status || "planlagt",
      capture: "Efter deploy: gem live URL-resultater for produkt/pris, designer/template, checkout/order, adminlogin og kontakt/lead.",
      acceptedWhen: productionGate?.required || "Accepteret når de rigtige domæner viser samme beviser som localhost.",
      stopRule: productionGate?.stopRule || "Stop eksternt salg hvis liveflowet ikke matcher beviserne.",
      href: productionGate?.href || "/admin/commercial-readiness?force_domain=webprinter.dk#manual-rehearsal-route",
    },
  ];
}

function getSupplierBankStagingRunbook(
  commercialDecisionsQueue: CommercialDecision[],
  commercialReadyCriteria: CommercialReadyCriterion[],
): SupplierBankStagingRunbookItem[] {
  const supplierDecisions = commercialDecisionsQueue.filter((item) => item.owner === "Supplier Bank");
  const supplierBlockers = supplierDecisions.filter((item) => item.status === "blokeret").length;
  const firstSupplierBlocker = supplierDecisions.find((item) => item.status === "blokeret")
    || supplierDecisions.find((item) => item.status === "qa")
    || supplierDecisions.find((item) => item.status === "planlagt");
  const wmdDecision = supplierDecisions.find((item) => item.title.includes("WMD"));
  const pixartDecision = supplierDecisions.find((item) => item.title.includes("Pixart"));
  const supplierCriterion = commercialReadyCriteria.find((item) => item.title.includes("Supplier Bank"));

  return [
    {
      title: "1. Brug kun godkendte eksterne kilder",
      phase: "Kilde",
      status: "qa",
      evidence: "WIRmachenDRUCK, Print.com og Pixartprinting er eksterne supplier-kilder; egne tenants og localhost er ikke supplier-kilder.",
      operatorAction: "Start altid i Supplier Bank eller rapporterne, og hold Webprinter, Salgsmapper og Onlinetryksager ude af scraping/sourcing.",
      approvalGate: "Stop hvis en intern tenant, kundeside eller localhost dukker op som leverandørkilde.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "2. Saml kandidat som rapport før import",
      phase: "Kandidat",
      status: "qa",
      evidence: "Supplier Bank rapporterne kan vise dækning, kandidater, QA og prislinjer uden at skrive til live storefront.",
      operatorAction: "Brug rapporter og bankvisning til at vælge én konkret produktfamilie, før nogen import- eller write-handling godkendes.",
      approvalGate: "Stop hvis produktfamilie, URL, format eller prisgrundlag ikke kan forklares i almindeligt dansk.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "3. Godkend write/import før data flyttes",
      phase: "Approval",
      status: supplierBlockers > 0 ? "blokeret" : "qa",
      evidence: `${formatCount(supplierBlockers)} Supplier Bank beslutninger blokerer stadig live-forklaring eller publicering.`,
      operatorAction: firstSupplierBlocker?.decision || "Få eksplicit approval før bank-only write, draft-import eller live publicering.",
      approvalGate: firstSupplierBlocker?.impact || "Stop hvis approval kun er antaget, mundtlig eller blandet sammen med demo.",
      href: firstSupplierBlocker?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "4. Importer som draft og kontroller prisrækker",
      phase: "Draft",
      status: supplierCriterion?.status || "qa",
      evidence: supplierCriterion?.proof || "Aktuel rapportstatus viser 9/14 familiedækning, 9 OK / 1 fejl i draft QA og WMD draft med 18.800 prisrækker.",
      operatorAction: supplierCriterion?.next || "Kontroller prisrækkeantal, warnings, fejl og special-pricing før produktet bruges i et tenantflow.",
      approvalGate: "Stop hvis pris-preview, Matrix-rækker, produktnavn eller dansk forklaring ikke matcher det importerede produkt.",
      href: supplierCriterion?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "5. Hold publicering separat fra import",
      phase: "Publicering",
      status: wmdDecision?.status || "blokeret",
      evidence: wmdDecision?.impact || "Et ældre WMD target er publiceret og skal afklares, så bank-import ikke forveksles med salgsklart katalog.",
      operatorAction: wmdDecision?.decision || "Beslut behold, afpublicér eller arkivér før Supplier Bank nævnes som rolig staging i demo.",
      approvalGate: "Stop hvis et importeret produkt bliver publiceret uden pris-, template-, ordre- og tenantbevis.",
      href: wmdDecision?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "6. Overdrag kun bevidnet produkt til tenantflow",
      phase: "Tenant",
      status: pixartDecision?.status === "blokeret" || wmdDecision?.status === "blokeret" ? "blokeret" : "planlagt",
      evidence: pixartDecision?.impact || wmdDecision?.impact || "Tenantflow må først bruge bankproduktet efter draft-QA, approval og første pris/designer/checkout-bevis.",
      operatorAction: "Når én bankkandidat er godkendt, før den ind i et konkret tenantprodukt og gennemgå pris-preview, designer/upload, checkout og adminordre.",
      approvalGate: "Stop hvis bankproduktet bruges som generelt katalogløfte før et specifikt tenantflow er bevidnet.",
      href: "/admin/products?force_domain=webprinter.dk",
    },
  ];
}

function getGoNoGoLaunchBoard(
  readinessRows: TenantReadiness[],
  commercialGates: CommercialGate[],
  pilotOrderPlan: PilotOrderStep[],
): LaunchBoardItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const onlinetryksager = getTenantByDomain(readinessRows, "onlinetryksager.dk");
  const webprinterProductReady = Boolean(
    webprinter?.signal?.firstProductFound
    && webprinter.signal.firstProductPublished
    && webprinter.signal.firstProductPriceRows
    && webprinter.signal.firstProductPriceRows > 0,
  );
  const webprinterOrderReady = pilotOrderPlan.some((step) => step.title.includes("Kør kontrolleret ordre") && step.status === "klar");
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const onlinetryksagerReady = Boolean(onlinetryksager?.firstProductSlug && onlinetryksager.signal?.firstProductFound);
  const criticalGateBlockers = commercialGates.filter((gate) => gate.status === "blokeret" && gate.title !== "Supplier Bank risici");
  const supplierGateOpen = commercialGates.some((gate) => gate.title === "Supplier Bank risici" && gate.status === "blokeret");

  return [
    {
      title: "Ekstern trykkeri-demo",
      verdict: webprinterProductReady && salgsmapperTemplateReady ? "Pilot-demo mulig" : "Vent med ekstern demo",
      status: webprinterProductReady && salgsmapperTemplateReady ? "qa" : "blokeret",
      basis: webprinterProductReady && salgsmapperTemplateReady
        ? "Webprinter kan bære platformshistorien, og Salgsmapper kan vise template-proof."
        : "Demoen mangler stadig Webprinter produkt/pris eller Salgsmapper template-proof.",
      next: criticalGateBlockers.length > 0
        ? "Luk de kritiske demo-gates før en print-house samtale."
        : "Kør en intern generalprøve før den vises eksternt.",
      href: "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
    {
      title: "Første live pilotordre",
      verdict: webprinterOrderReady ? "Go som bevis" : "Pilot-only",
      status: webprinterOrderReady ? "klar" : "qa",
      basis: webprinterOrderReady
        ? "Cockpittet finder et ordre-spor for Webprinter pilotproduktet."
        : "Pilotordren skal stadig køres kontrolleret fra produkt til admin.",
      next: webprinterOrderReady ? "Brug ordren som demo-bevis." : "Følg Første pilotordre-plan.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "Salgsmapper niche-proof",
      verdict: salgsmapperTemplateReady ? "Go som niche-eksempel" : "Ikke klar",
      status: salgsmapperTemplateReady ? "klar" : "blokeret",
      basis: salgsmapperTemplateReady
        ? "Produktbestemt skabelon kan bruges til at vise designer-handoff."
        : "Salgsmapper skal have godkendt første template-flow før ekstern demo.",
      next: salgsmapperTemplateReady ? "Vis efter Webprinter i demoen." : "Godkend og test første salgsmappe-skabelon.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "Onlinetryksager",
      verdict: onlinetryksagerReady ? "Sekundær pilot" : "Hold ude af pitch",
      status: onlinetryksagerReady ? "qa" : "planlagt",
      basis: onlinetryksagerReady
        ? "Der er valgt et produkt, men tenanten bør stadig ikke bære hoveddemoen."
        : "Første produktflow er ikke valgt som bevis endnu.",
      next: onlinetryksagerReady ? "Brug som næste udvidelse." : "Vælg første standardprodukt før den nævnes aktivt.",
      href: "/admin/products?force_domain=www.onlinetryksager.dk",
    },
    {
      title: "Supplier Bank",
      verdict: supplierGateOpen ? "Do not promise automation" : "Staging kan vises",
      status: supplierGateOpen ? "blokeret" : "qa",
      basis: supplierGateOpen
        ? "Banken er en sourcing/staging-motor med åbne gates, ikke et færdigt automatisk katalogløfte."
        : "Banken kan vises som kontrolleret staging og importgrundlag.",
      next: supplierGateOpen ? "Vis kun som intern staging, ikke som salgsautomatik." : "Hold imports approval-gated.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "Pris- og betalingsløfte",
      verdict: webprinterProductReady && webprinterOrderReady ? "Næsten salgbart" : "Ikke lov endnu",
      status: webprinterProductReady && webprinterOrderReady ? "qa" : "blokeret",
      basis: "En køber må først loves et driftssikkert flow, når pris-preview, betaling og adminordre er bevist sammen.",
      next: webprinterProductReady && webprinterOrderReady
        ? "Afklar betalingsform og supportmodel før salg."
        : "Bevis pris-preview og pilotordre før det loves i et tilbud.",
      href: "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
  ];
}

function getSalesEvidenceBinder(
  readinessRows: TenantReadiness[],
  evidenceRows: Array<{ tenant: TenantReadiness; evidence: EvidenceItem[] }>,
  commercialGates: CommercialGate[],
): SalesEvidenceItem[] {
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const onlinetryksager = getTenantByDomain(readinessRows, "onlinetryksager.dk");
  const tenantSignals = readinessRows.filter((tenant) => tenant.signal?.tenantId);
  const publicProductProofs = evidenceRows.flatMap((row) => row.evidence.filter((item) => item.label === "Offentlig produktside"));
  const priceProofs = evidenceRows.flatMap((row) => row.evidence.filter((item) => item.label === "Pris-preview"));
  const designerProofs = evidenceRows.flatMap((row) => row.evidence.filter((item) => item.label === "Designer/skabelon"));
  const orderProofs = evidenceRows.flatMap((row) => row.evidence.filter((item) => item.label === "Checkout og ordre"));
  const seoProofs = evidenceRows.flatMap((row) => row.evidence.filter((item) => item.label === "SEO synlighed"));
  const webprinterPriceReady = Boolean(webprinter?.signal?.firstProductPriceRows && webprinter.signal.firstProductPriceRows > 0);
  const salgsmapperTemplateReady = Boolean(salgsmapper?.signal?.firstProductDesignerLaunchReady);
  const anyOrderProof = readinessRows.some((tenant) => tenant.signal?.firstProductOrderCount && tenant.signal.firstProductOrderCount > 0);
  const anySeoSignal = seoProofs.some((item) => item.status !== "planlagt" && item.status !== "blokeret");
  const supplierGate = commercialGates.find((gate) => gate.title === "Supplier Bank risici");

  return [
    {
      claim: "Platformen kan drive flere tenants",
      status: tenantSignals.length >= 2 ? "qa" : "blokeret",
      proof: `${formatCount(tenantSignals.length)} af ${formatCount(readinessRows.length)} ejede tenants kan læses i cockpittet.`,
      gap: tenantSignals.length >= 2
        ? "Brug Webprinter og Salgsmapper som de primære beviser, og hold Onlinetryksager som sekundær pilot."
        : "Mindst Webprinter og Salgsmapper skal kunne læses stabilt før et multi-tenant pitch.",
      href: "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      claim: "Kunden kan se et produkt med pris-preview",
      status: webprinterPriceReady ? "klar" : "blokeret",
      proof: webprinterPriceReady
        ? `${formatCount(webprinter?.signal?.firstProductPriceRows ?? null)} prisrækker er fundet for Webprinter pilotproduktet.`
        : "Webprinter pilotproduktet mangler et bevist pris-preview.",
      gap: priceProofs.some((item) => item.status === "blokeret")
        ? "Luk blokerede pris-preview beviser før pris bruges som salgsløfte."
        : "Gennemgå den offentlige produktside manuelt før ekstern demo.",
      href: webprinter?.adminPath || "/admin/products?force_domain=webprinter.dk",
    },
    {
      claim: "Designer/template flow kan vises på et nicheprodukt",
      status: salgsmapperTemplateReady ? "klar" : "blokeret",
      proof: salgsmapperTemplateReady
        ? "Salgsmapper har et produktflow med klar designer-skabelon."
        : "Salgsmapper mangler stadig template-proof i cockpittet.",
      gap: designerProofs.some((item) => item.status === "blokeret")
        ? "Godkend og test første salgsmappe-skabelon før den bruges i demoen."
        : "Brug Salgsmapper som niche-proof efter Webprinter platformshistorien.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      claim: "Ordreflow kan følges fra kunde til admin",
      status: anyOrderProof ? "klar" : "qa",
      proof: anyOrderProof
        ? "Mindst ét bevisprodukt har et ordre-spor i cockpittets read-only signaler."
        : "Der mangler stadig en kontrolleret pilotordre som admin-bevis.",
      gap: orderProofs.some((item) => item.status === "klar")
        ? "Brug ordrebeviset i demoen og vis admin-flowet roligt."
        : "Kør første pilotordre-planen før dette loves til en print-house kunde.",
      href: "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      claim: "SEO og synlighed kan kobles til platformen",
      status: anySeoSignal ? "qa" : "planlagt",
      proof: anySeoSignal
        ? "SEO-rækker findes i cockpittet; Search Console signaler er næste bevislag."
        : "SEO/Search Console skal stadig gøres synligt som read-only bevis.",
      gap: anySeoSignal
        ? "Tilføj klik, visninger og indekseringsstatus som næste kommercielle bevis."
        : "Start med SEO-rækker og Search Console-tilkobling for de ejede domæner.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      claim: "Supplier Bank kan vises som kontrolleret sourcing",
      status: supplierGate?.status || "blokeret",
      proof: "Banken har rapporteret 9/14 dækkede familier og 9 OK / 1 fejl i importeret draft QA.",
      gap: "Må ikke sælges som fuld automatik før Pixart/WMD-gates og publiceringsrisici er lukket.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      claim: "Onlinetryksager kan blive næste generelle pilot",
      status: onlinetryksager?.firstProductSlug && onlinetryksager.signal?.firstProductFound ? "qa" : "planlagt",
      proof: onlinetryksager?.firstProductSlug
        ? "Onlinetryksager har et valgt første produkt i planen."
        : "Onlinetryksager har endnu ikke et valgt første bevisprodukt.",
      gap: "Hold den ude af hovedpitch indtil produkt, pris, designer/upload og ordreflow er valgt.",
      href: "/admin/products?force_domain=www.onlinetryksager.dk",
    },
    {
      claim: "Offentlige produktsider er pitch-klare",
      status: publicProductProofs.filter((item) => item.status === "klar").length >= 2 ? "qa" : "blokeret",
      proof: `${formatCount(publicProductProofs.filter((item) => item.status === "klar").length)} offentlige produktside-beviser er klar.`,
      gap: "Mindst Webprinter og Salgsmapper bør have stabile offentlige produktbeviser før en ekstern demo.",
      href: "/admin/products?force_domain=webprinter.dk",
    },
  ];
}

function getCriticalPathItems(
  launchBoard: LaunchBoardItem[],
  salesEvidenceBinder: SalesEvidenceItem[],
): CriticalPathItem[] {
  const priceEvidence = salesEvidenceBinder.find((item) => item.claim === "Kunden kan se et produkt med pris-preview");
  const templateEvidence = salesEvidenceBinder.find((item) => item.claim === "Designer/template flow kan vises på et nicheprodukt");
  const orderLaunch = launchBoard.find((item) => item.title === "Første live pilotordre");
  const supplierLaunch = launchBoard.find((item) => item.title === "Supplier Bank");
  const paymentLaunch = launchBoard.find((item) => item.title === "Pris- og betalingsløfte");
  const storyDecision = commercialDecisions.find((item) => item.title === "Definér demoens salgsfortælling");

  return [
    {
      title: "1. Bevis Webprinter produkt og pris",
      status: priceEvidence?.status || "blokeret",
      why: priceEvidence?.proof || "Pilotprodukt og pris-preview skal være salgsbeviset.",
      next: priceEvidence?.gap || "Gennemgå første Webprinter produkt og pris-preview.",
      href: priceEvidence?.href || "/admin/product/aluminium?force_domain=webprinter.dk",
    },
    {
      title: "2. Bevis Salgsmapper template-flow",
      status: templateEvidence?.status || "blokeret",
      why: templateEvidence?.proof || "Salgsmapper skal vise nicheprodukt og fast skabelon.",
      next: templateEvidence?.gap || "Godkend og test første salgsmappe-skabelon.",
      href: templateEvidence?.href || "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "3. Kør kontrolleret pilotordre",
      status: orderLaunch?.status || "qa",
      why: orderLaunch?.basis || "En ordre skal kunne følges fra kunde til admin.",
      next: orderLaunch?.next || "Følg første pilotordre-plan.",
      href: orderLaunch?.href || "/admin/kunder?force_domain=webprinter.dk",
    },
    {
      title: "4. Afklar betaling og support",
      status: paymentLaunch?.status || "blokeret",
      why: paymentLaunch?.basis || "Pris, betaling og adminordre skal hænge sammen før salg.",
      next: paymentLaunch?.next || "Beslut betalingsform og supportmodel.",
      href: paymentLaunch?.href || "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
    {
      title: "5. Afgræns Supplier Bank",
      status: supplierLaunch?.status || "blokeret",
      why: supplierLaunch?.basis || "Supplier Bank må kun vises som kontrolleret staging.",
      next: supplierLaunch?.next || "Hold imports approval-gated og ude af automatiske salgsløfter.",
      href: supplierLaunch?.href || "/admin/supplier-bank?force_domain=webprinter.dk",
    },
    {
      title: "6. Lås salgsfortællingen",
      status: storyDecision?.status || "planlagt",
      why: storyDecision?.impact || "Demoen skal sælge platformens beviste flows.",
      next: storyDecision?.decision || "Beslut demo-script, tilbudsmodel og ikke-løfter.",
      href: storyDecision?.href || "/admin/commercial-readiness?force_domain=webprinter.dk",
    },
  ];
}

function getPilotPrintHouseIntake(
  readinessRows: TenantReadiness[],
  launchBoard: LaunchBoardItem[],
  salesEvidenceBinder: SalesEvidenceItem[],
): PilotPrintHouseIntakeItem[] {
  const tenantProof = salesEvidenceBinder.find((item) => item.claim === "Platformen kan drive flere tenants");
  const productPriceProof = salesEvidenceBinder.find((item) => item.claim === "Kunden kan se et produkt med pris-preview");
  const templateProof = salesEvidenceBinder.find((item) => item.claim === "Designer/template flow kan vises på et nicheprodukt");
  const orderProof = salesEvidenceBinder.find((item) => item.claim === "Ordreflow kan følges fra kunde til admin");
  const seoProof = salesEvidenceBinder.find((item) => item.claim === "SEO og synlighed kan kobles til platformen");
  const supplierProof = salesEvidenceBinder.find((item) => item.claim === "Supplier Bank kan vises som kontrolleret sourcing");
  const paymentLaunch = launchBoard.find((item) => item.title === "Pris- og betalingsløfte");
  const webprinter = getTenantByDomain(readinessRows, "webprinter.dk");
  const salgsmapper = getTenantByDomain(readinessRows, "salgsmapper.dk");
  const hasCoreTenants = Boolean(webprinter?.signal?.tenantId && salgsmapper?.signal?.tenantId);

  return [
    {
      title: "Pilotkunde, tenant og domæne",
      status: hasCoreTenants ? "qa" : "blokeret",
      needed: "Navn på første pilottrykkeri, ønsket domæne/subdomæne, ejerkontakt og hvem der må godkende ændringer.",
      systemUse: tenantProof?.proof || "Brug tenant-oversigten til at oprette eller vælge pilotens tenant-shell.",
      href: "/admin/tenants?force_domain=webprinter.dk",
    },
    {
      title: "Brand og storefront",
      status: hasCoreTenants ? "qa" : "planlagt",
      needed: "Logo, farver, fonte, tone of voice, kontaktoplysninger, footerdata og om piloten skal ligne trykkeriets eksisterende side.",
      systemUse: "Brug branding, domæne og indstillinger til at samle den første kundevendte tenantpakke.",
      href: "/admin/branding-v2?force_domain=webprinter.dk",
    },
    {
      title: "Første produktpakke",
      status: productPriceProof?.status || "blokeret",
      needed: "De 3-5 produkter piloten vil sælge først, med formatvalg, papir/materialer, oplag og leveringslogik.",
      systemUse: productPriceProof?.gap || "Start med et produkt der allerede kan bevise pris-preview.",
      href: "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "Prisgrundlag og avance",
      status: productPriceProof?.status === "klar" ? "qa" : "blokeret",
      needed: "Hvem ejer prislisten, hvor ofte priser må opdateres, og hvilke marginer der er pilotens ansvar.",
      systemUse: "Hold produktpriser som bevisdata indtil prisansvar og opdateringsproces er besluttet.",
      href: productPriceProof?.href || "/admin/products?force_domain=webprinter.dk",
    },
    {
      title: "Skabeloner, upload og designer",
      status: templateProof?.status || "blokeret",
      needed: "PDF-skabeloner, bleed/fals/ryg-regler, downloadfiler, designer-start og hvilke filer kunden selv må uploade.",
      systemUse: templateProof?.gap || "Brug Salgsmapper som første template-proof før en ny trykkeripilot loves designerflow.",
      href: "/admin/designer-templates?force_domain=www.salgsmapper.dk",
    },
    {
      title: "Checkout, betaling og ordreoverdragelse",
      status: paymentLaunch?.status === "qa" && orderProof?.status === "klar" ? "qa" : "blokeret",
      needed: "Betalingsform, faktura/onlinebetaling, ordremail, produktionsejer, korrekturflow og hvornår en ordre er produktionsklar.",
      systemUse: orderProof?.gap || paymentLaunch?.next || "Kør en kontrolleret ordre før betaling og ordreoverdragelse loves.",
      href: "/admin/indstillinger/betaling?force_domain=webprinter.dk",
    },
    {
      title: "SEO, tracking og rapportering",
      status: seoProof?.status || "planlagt",
      needed: "Hvilke domæner skal måles, hvem ejer Search Console/Analytics, og hvilke KPI'er piloten skal se.",
      systemUse: seoProof?.gap || "SEO og Search Console bør være read-only bevis før salgspåstanden bruges.",
      href: "/admin/platform-seo?force_domain=webprinter.dk",
    },
    {
      title: "Sourcing og ikke-løfter",
      status: supplierProof?.status || "blokeret",
      needed: "Hvilke leverandører må bruges, hvad er manuel staging, og hvad må aldrig beskrives som fuld automatik endnu.",
      systemUse: supplierProof?.gap || "Supplier Bank skal holdes approval-gated og forklares som staging.",
      href: "/admin/supplier-bank?force_domain=webprinter.dk",
    },
  ];
}

function compareIssuePriority(a: FlowIssue, b: FlowIssue) {
  const order: Record<Status, number> = { blokeret: 0, qa: 1, planlagt: 2, klar: 3 };
  return order[a.status] - order[b.status] || a.tenantName.localeCompare(b.tenantName, "da-DK");
}

export default function CommercialReadiness() {
  const [signals, setSignals] = useState<Record<string, TenantSignal>>({});
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [platformLeadSummary, setPlatformLeadSummary] = useState<PlatformLeadSummary>({
    totalCount: null,
    unreadCount: null,
    latestAt: null,
    error: null,
  });
  const [loadingPlatformLeadSummary, setLoadingPlatformLeadSummary] = useState(true);
  const { data: searchConsoleStatus, isLoading: searchConsoleStatusLoading } = useSearchConsoleStatus();
  const { data: searchConsoleSites } = useSearchConsoleSites();
  const { data: searchConsoleOverview, isLoading: searchConsoleOverviewLoading } = useSearchConsoleSiteOverview(ownedSearchConsoleSiteUrls, 28);

  useEffect(() => {
    let active = true;

    async function loadSignals() {
      setLoadingSignals(true);
      const rows = await Promise.all(tenantPilots.map(async (pilot) => [pilot.domain, await loadTenantSignal(pilot)] as const));
      if (!active) return;
      setSignals(Object.fromEntries(rows));
      setLoadingSignals(false);
    }

    loadSignals();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      setLoadingPlatformLeadSummary(true);
      const summary = await loadPlatformLeadSummary();
      if (!active) return;
      setPlatformLeadSummary(summary);
      setLoadingPlatformLeadSummary(false);
    }

    loadSummary();
    return () => {
      active = false;
    };
  }, []);

  const readinessRows = useMemo(
    () => tenantPilots.map((pilot) => deriveTenantReadiness(pilot, signals[pilot.domain] || null)),
    [signals],
  );
  const completeFlows = readinessRows.filter((pilot) => pilot.status === "klar").length;
  const averageReadiness = Math.round(readinessRows.reduce((sum, pilot) => sum + pilot.readiness, 0) / readinessRows.length);
  const flowIssues = useMemo(
    () => readinessRows.flatMap(getTenantFlowIssues).sort(compareIssuePriority),
    [readinessRows],
  );
  const proofFlowRows = useMemo(
    () => readinessRows.map((tenant) => ({ tenant, steps: getTenantProofSteps(tenant) })),
    [readinessRows],
  );
  const evidenceRows = useMemo(
    () => readinessRows.map((tenant) => ({ tenant, evidence: getTenantEvidenceItems(tenant) })),
    [readinessRows],
  );
  const verifiedSearchConsoleSites = searchConsoleSites?.siteEntry || [];
  const seoVisibilityRows = useMemo(
    () => getSeoVisibilityRows(
      readinessRows,
      verifiedSearchConsoleSites,
      searchConsoleOverview,
      Boolean(searchConsoleStatus?.connected),
    ),
    [readinessRows, verifiedSearchConsoleSites, searchConsoleOverview, searchConsoleStatus?.connected],
  );
  const orderOperationsRows = useMemo(
    () => getOrderOperationsRows(readinessRows),
    [readinessRows],
  );
  const paymentCheckoutRows = useMemo(
    () => getPaymentCheckoutRows(readinessRows),
    [readinessRows],
  );
  const paymentCheckoutReadyCount = paymentCheckoutRows.filter((item) => item.status === "klar").length;
  const paymentCheckoutBlockers = paymentCheckoutRows.filter((item) => item.status === "blokeret").length;
  const supportCustomerRows = useMemo(
    () => getSupportCustomerRows(readinessRows),
    [readinessRows],
  );
  const supportCustomerReadyCount = supportCustomerRows.filter((item) => item.status === "klar").length;
  const supportCustomerBlockers = supportCustomerRows.filter((item) => item.status === "blokeret").length;
  const mailNotificationRows = useMemo(
    () => getMailNotificationRows(readinessRows),
    [readinessRows],
  );
  const mailNotificationReadyCount = mailNotificationRows.filter((item) => item.status === "klar").length;
  const mailNotificationBlockers = mailNotificationRows.filter((item) => item.status === "blokeret").length;
  const deliveryFulfillmentRows = useMemo(
    () => getDeliveryFulfillmentRows(readinessRows),
    [readinessRows],
  );
  const deliveryFulfillmentReadyCount = deliveryFulfillmentRows.filter((item) => item.status === "klar").length;
  const deliveryFulfillmentBlockers = deliveryFulfillmentRows.filter((item) => item.status === "blokeret").length;
  const legalConsentRows = useMemo(
    () => getLegalConsentRows(readinessRows),
    [readinessRows],
  );
  const legalConsentReadyCount = legalConsentRows.filter((item) => item.status === "klar").length;
  const legalConsentBlockers = legalConsentRows.filter((item) => item.status === "blokeret").length;
  const platformLeadReadiness = useMemo(
    () => getPlatformLeadReadiness(platformLeadSummary, loadingPlatformLeadSummary),
    [platformLeadSummary, loadingPlatformLeadSummary],
  );
  const platformLeadReadyCount = platformLeadReadiness.filter((item) => item.status === "klar").length;
  const platformLeadBlockers = platformLeadReadiness.filter((item) => item.status === "blokeret").length;
  const platformLeadLogStatus: Status = loadingPlatformLeadSummary
    ? "qa"
    : platformLeadSummary.error ? "blokeret" : "klar";
  const platformLeadLogLabel = loadingPlatformLeadSummary
    ? "Tjekker"
    : platformLeadSummary.error ? "Kræver QA" : "Læsbar";
  const executiveActions = useMemo(
    () => evidenceRows.map(({ tenant, evidence }) => getTenantExecutiveAction(tenant, evidence)),
    [evidenceRows],
  );
  const blockerCount = flowIssues.filter((issue) => issue.status === "blokeret").length;
  const seoProofCount = seoVisibilityRows.filter((row) => row.status === "klar").length;
  const seoQaCount = seoVisibilityRows.filter((row) => row.status === "qa").length;
  const commercialGates = useMemo(
    () => getCommercialDemoGates(readinessRows, evidenceRows, blockerCount),
    [readinessRows, evidenceRows, blockerCount],
  );
  const demoRunbook = useMemo(
    () => getPrintHouseDemoRunbook(readinessRows, commercialGates),
    [readinessRows, commercialGates],
  );
  const pilotOrderPlan = useMemo(
    () => getFirstPilotOrderPlan(readinessRows),
    [readinessRows],
  );
  const salesPackage = useMemo(
    () => getPrintHouseSalesPackage(readinessRows, commercialGates, pilotOrderPlan),
    [readinessRows, commercialGates, pilotOrderPlan],
  );
  const offerModel = useMemo(
    () => getPrintHouseOfferModel(readinessRows, pilotOrderPlan, salesPackage, seoVisibilityRows),
    [readinessRows, pilotOrderPlan, salesPackage, seoVisibilityRows],
  );
  const launchBoard = useMemo(
    () => getGoNoGoLaunchBoard(readinessRows, commercialGates, pilotOrderPlan),
    [readinessRows, commercialGates, pilotOrderPlan],
  );
  const salesEvidenceBinder = useMemo(
    () => getSalesEvidenceBinder(readinessRows, evidenceRows, commercialGates),
    [readinessRows, evidenceRows, commercialGates],
  );
  const commercialReadyCriteria = useMemo(
    () => getCommercialReadyCriteria(readinessRows, pilotOrderPlan, salesEvidenceBinder, seoVisibilityRows, offerModel, orderOperationsRows, paymentCheckoutRows, supportCustomerRows, mailNotificationRows, deliveryFulfillmentRows, legalConsentRows, platformLeadReadiness),
    [readinessRows, pilotOrderPlan, salesEvidenceBinder, seoVisibilityRows, offerModel, orderOperationsRows, paymentCheckoutRows, supportCustomerRows, mailNotificationRows, deliveryFulfillmentRows, legalConsentRows, platformLeadReadiness],
  );
  const commercialReadyCount = commercialReadyCriteria.filter((item) => item.status === "klar").length;
  const commercialReadyBlockers = commercialReadyCriteria.filter((item) => item.status === "blokeret").length;
  const commercialDecisionsQueue = useMemo(() => commercialDecisions, []);
  const thirtyDayPlan = useMemo(
    () => getThirtyDayPlanItems(readinessRows, pilotOrderPlan, flowIssues, commercialReadyCriteria, seoVisibilityRows),
    [readinessRows, pilotOrderPlan, flowIssues, commercialReadyCriteria, seoVisibilityRows],
  );
  const thirtyDayDoneCount = thirtyDayPlan.filter((item) => item.status === "klar").length;
  const thirtyDayBlockedCount = thirtyDayPlan.filter((item) => item.status === "blokeret").length;
  const criticalPath = useMemo(
    () => getCriticalPathItems(launchBoard, salesEvidenceBinder),
    [launchBoard, salesEvidenceBinder],
  );
  const pilotPrintHouseIntake = useMemo(
    () => getPilotPrintHouseIntake(readinessRows, launchBoard, salesEvidenceBinder),
    [readinessRows, launchBoard, salesEvidenceBinder],
  );
  const criticalPathBlockers = criticalPath.filter((item) => item.status === "blokeret").length;
  const pilotProofRuns = useMemo(
    () => getPilotProofRunItems(readinessRows, pilotOrderPlan, seoVisibilityRows),
    [readinessRows, pilotOrderPlan, seoVisibilityRows],
  );
  const pilotProofReadyCount = pilotProofRuns.filter((item) => item.status === "klar").length;
  const pilotProofBlockers = pilotProofRuns.filter((item) => item.status === "blokeret").length;
  const rehearsalProofCapture = useMemo(
    () => getRehearsalProofCaptureItems(pilotProofRuns),
    [pilotProofRuns],
  );
  const rehearsalProofCaptureReadyCount = rehearsalProofCapture.filter((item) => item.status === "klar").length;
  const rehearsalProofCaptureBlockers = rehearsalProofCapture.filter((item) => item.status === "blokeret").length;
  const pilotOperationsRunbook = useMemo(
    () => getPilotOperationsRunbook(readinessRows, pilotOrderPlan, offerModel),
    [readinessRows, pilotOrderPlan, offerModel],
  );
  const pilotOperationsReadyCount = pilotOperationsRunbook.filter((item) => item.status === "klar").length;
  const pilotOperationsBlockers = pilotOperationsRunbook.filter((item) => item.status === "blokeret").length;
  const orderOperationsReadyCount = orderOperationsRows.filter((item) => item.status === "klar").length;
  const orderOperationsBlockers = orderOperationsRows.filter((item) => item.status === "blokeret").length;
  const adminAccessReadiness = useMemo(
    () => getAdminAccessReadiness(readinessRows, pilotProofRuns, pilotOperationsRunbook),
    [readinessRows, pilotProofRuns, pilotOperationsRunbook],
  );
  const adminAccessReadyCount = adminAccessReadiness.filter((item) => item.status === "klar").length;
  const adminAccessBlockers = adminAccessReadiness.filter((item) => item.status === "blokeret").length;
  const executivePriorityQueue = useMemo(
    () => getExecutivePriorityQueue(
      criticalPath,
      pilotProofRuns,
      pilotOperationsRunbook,
      adminAccessReadiness,
      launchBoard,
      thirtyDayPlan,
    ),
    [criticalPath, pilotProofRuns, pilotOperationsRunbook, adminAccessReadiness, launchBoard, thirtyDayPlan],
  );
  const executivePriorityBlockers = executivePriorityQueue.filter((item) => item.status === "blokeret").length;
  const printHouseMeetingPack = useMemo(
    () => getPrintHouseMeetingPack(demoRunbook, offerModel, launchBoard, salesEvidenceBinder, executivePriorityQueue),
    [demoRunbook, offerModel, launchBoard, salesEvidenceBinder, executivePriorityQueue],
  );
  const printHouseMeetingBlockers = printHouseMeetingPack.filter((item) => item.status === "blokeret").length;
  const goalExecutionPlan = useMemo(
    () => getCommercialGoalExecutionPlan(
      criticalPath,
      executivePriorityQueue,
      printHouseMeetingPack,
      commercialReadyCriteria,
      pilotProofRuns,
      pilotOperationsRunbook,
      adminAccessReadiness,
      seoVisibilityRows,
      offerModel,
    ),
    [
      criticalPath,
      executivePriorityQueue,
      printHouseMeetingPack,
      commercialReadyCriteria,
      pilotProofRuns,
      pilotOperationsRunbook,
      adminAccessReadiness,
      seoVisibilityRows,
      offerModel,
    ],
  );
  const goalExecutionBlockers = goalExecutionPlan.filter((item) => item.status === "blokeret").length;
  const goalExecutionReadyCount = goalExecutionPlan.filter((item) => item.status === "klar").length;
  const automationMap = useMemo(
    () => getCommercialAutomationMap(
      goalExecutionPlan,
      executivePriorityQueue,
      commercialDecisionsQueue,
      pilotProofRuns,
      adminAccessReadiness,
      commercialReadyCriteria,
    ),
    [goalExecutionPlan, executivePriorityQueue, commercialDecisionsQueue, pilotProofRuns, adminAccessReadiness, commercialReadyCriteria],
  );
  const automationAutoCount = automationMap.filter((item) => item.mode === "auto").length;
  const automationManualCount = automationMap.filter((item) => item.mode === "manual").length;
  const automationDecisionCount = automationMap.filter((item) => item.mode === "decision").length;
  const commercialFocusItems = useMemo(
    () => getCommercialFocusItems(automationMap, commercialDecisionsQueue),
    [automationMap, commercialDecisionsQueue],
  );
  const externalDemoBoundary = useMemo(
    () => getExternalDemoBoundary(launchBoard, salesEvidenceBinder, printHouseMeetingPack, commercialGates),
    [launchBoard, salesEvidenceBinder, printHouseMeetingPack, commercialGates],
  );
  const externalDemoAllowedCount = externalDemoBoundary.filter((item) => item.status === "klar" || item.status === "qa").length;
  const externalDemoBlockedCount = externalDemoBoundary.filter((item) => item.status === "blokeret").length;
  const commercialPilotAcceptance = useMemo(
    () => getCommercialPilotAcceptanceGate(
      commercialReadyCriteria,
      externalDemoBoundary,
      pilotOperationsRunbook,
      adminAccessReadiness,
      offerModel,
      commercialDecisionsQueue,
    ),
    [commercialReadyCriteria, externalDemoBoundary, pilotOperationsRunbook, adminAccessReadiness, offerModel, commercialDecisionsQueue],
  );
  const commercialPilotAcceptanceBlockers = commercialPilotAcceptance.filter((item) => item.status === "blokeret").length;
  const commercialPilotAcceptanceReadyCount = commercialPilotAcceptance.filter((item) => item.status === "klar").length;
  const pilotResponsibilityMap = useMemo(
    () => getPilotResponsibilityMap(
      commercialPilotAcceptance,
      pilotOperationsRunbook,
      adminAccessReadiness,
      externalDemoBoundary,
      offerModel,
      seoVisibilityRows,
    ),
    [commercialPilotAcceptance, pilotOperationsRunbook, adminAccessReadiness, externalDemoBoundary, offerModel, seoVisibilityRows],
  );
  const pilotResponsibilityBlockers = pilotResponsibilityMap.filter((item) => item.status === "blokeret").length;
  const pilotResponsibilityReadyCount = pilotResponsibilityMap.filter((item) => item.status === "klar").length;
  const pilotScopeAgreement = useMemo(
    () => getPilotScopeAgreement(offerModel, externalDemoBoundary, pilotResponsibilityMap, commercialPilotAcceptance),
    [offerModel, externalDemoBoundary, pilotResponsibilityMap, commercialPilotAcceptance],
  );
  const pilotScopeBlockers = pilotScopeAgreement.filter((item) => item.status === "blokeret").length;
  const pilotScopeReadyCount = pilotScopeAgreement.filter((item) => item.status === "klar").length;
  const pilotOnboardingPlan = useMemo(
    () => getPrintHousePilotOnboardingPlan(
      pilotScopeAgreement,
      pilotPrintHouseIntake,
      pilotResponsibilityMap,
      commercialPilotAcceptance,
    ),
    [pilotScopeAgreement, pilotPrintHouseIntake, pilotResponsibilityMap, commercialPilotAcceptance],
  );
  const pilotOnboardingBlockers = pilotOnboardingPlan.filter((item) => item.status === "blokeret").length;
  const pilotOnboardingReadyCount = pilotOnboardingPlan.filter((item) => item.status === "klar").length;
  const pilotSuccessCriteria = useMemo(
    () => getPilotSuccessCriteria(
      commercialReadyCriteria,
      pilotOnboardingPlan,
      pilotScopeAgreement,
      pilotOperationsRunbook,
      salesEvidenceBinder,
      seoVisibilityRows,
      externalDemoBoundary,
    ),
    [
      commercialReadyCriteria,
      pilotOnboardingPlan,
      pilotScopeAgreement,
      pilotOperationsRunbook,
      salesEvidenceBinder,
      seoVisibilityRows,
      externalDemoBoundary,
    ],
  );
  const pilotSuccessBlockers = pilotSuccessCriteria.filter((item) => item.status === "blokeret").length;
  const pilotSuccessReadyCount = pilotSuccessCriteria.filter((item) => item.status === "klar").length;
  const printHousePilotHandoff = useMemo(
    () => getPrintHousePilotHandoff(
      externalDemoBoundary,
      commercialPilotAcceptance,
      pilotScopeAgreement,
      pilotOnboardingPlan,
      pilotSuccessCriteria,
      pilotResponsibilityMap,
    ),
    [
      externalDemoBoundary,
      commercialPilotAcceptance,
      pilotScopeAgreement,
      pilotOnboardingPlan,
      pilotSuccessCriteria,
      pilotResponsibilityMap,
    ],
  );
  const pilotHandoffBlockers = printHousePilotHandoff.filter((item) => item.status === "blokeret").length;
  const pilotHandoffReadyCount = printHousePilotHandoff.filter((item) => item.status === "klar" || item.status === "qa").length;
  const printHousePilotQuestions = useMemo(
    () => getPrintHousePilotQuestions(
      printHousePilotHandoff,
      printHouseMeetingPack,
      pilotScopeAgreement,
      pilotOnboardingPlan,
      pilotSuccessCriteria,
      externalDemoBoundary,
      commercialPilotAcceptance,
    ),
    [
      printHousePilotHandoff,
      printHouseMeetingPack,
      pilotScopeAgreement,
      pilotOnboardingPlan,
      pilotSuccessCriteria,
      externalDemoBoundary,
      commercialPilotAcceptance,
    ],
  );
  const pilotQuestionBlockers = printHousePilotQuestions.filter((item) => item.status === "blokeret").length;
  const pilotQuestionReadyCount = printHousePilotQuestions.filter((item) => item.status === "klar" || item.status === "qa").length;
  const printHouseMeetingBrief = useMemo(
    () => getPrintHouseMeetingBrief(
      printHouseMeetingPack,
      printHousePilotQuestions,
      printHousePilotHandoff,
      executivePriorityQueue,
    ),
    [printHouseMeetingPack, printHousePilotQuestions, printHousePilotHandoff, executivePriorityQueue],
  );
  const meetingBriefBlockers = printHouseMeetingBrief.filter((item) => item.status === "blokeret").length;
  const meetingBriefReadyCount = printHouseMeetingBrief.filter((item) => item.status === "klar" || item.status === "qa").length;
  const printHouseFollowUpItems = useMemo(
    () => getPrintHouseFollowUpItems(
      printHouseMeetingBrief,
      printHousePilotQuestions,
      pilotPrintHouseIntake,
      executivePriorityQueue,
    ),
    [printHouseMeetingBrief, printHousePilotQuestions, pilotPrintHouseIntake, executivePriorityQueue],
  );
  const followUpBlockers = printHouseFollowUpItems.filter((item) => item.status === "blokeret").length;
  const followUpReadyCount = printHouseFollowUpItems.filter((item) => item.status === "klar" || item.status === "qa").length;
  const printHouseOfferDraft = useMemo(
    () => getPrintHousePilotOfferDraft(
      printHouseFollowUpItems,
      offerModel,
      pilotScopeAgreement,
      commercialPilotAcceptance,
      executivePriorityQueue,
    ),
    [printHouseFollowUpItems, offerModel, pilotScopeAgreement, commercialPilotAcceptance, executivePriorityQueue],
  );
  const offerDraftBlockers = printHouseOfferDraft.filter((item) => item.status === "blokeret").length;
  const offerDraftReadyCount = printHouseOfferDraft.filter((item) => item.status === "klar" || item.status === "qa").length;
  const pilotAgreementChecklist = useMemo(
    () => getPilotAgreementChecklist(
      printHouseOfferDraft,
      commercialPilotAcceptance,
      pilotScopeAgreement,
      pilotOnboardingPlan,
      pilotSuccessCriteria,
      pilotResponsibilityMap,
    ),
    [
      printHouseOfferDraft,
      commercialPilotAcceptance,
      pilotScopeAgreement,
      pilotOnboardingPlan,
      pilotSuccessCriteria,
      pilotResponsibilityMap,
    ],
  );
  const agreementChecklistBlockers = pilotAgreementChecklist.filter((item) => item.status === "blokeret").length;
  const agreementChecklistReadyCount = pilotAgreementChecklist.filter((item) => item.status === "klar" || item.status === "qa").length;
  const pilotStartPlan = useMemo(
    () => getPilotStartPlan(
      pilotAgreementChecklist,
      pilotOnboardingPlan,
      pilotOperationsRunbook,
      adminAccessReadiness,
      pilotProofRuns,
      executivePriorityQueue,
    ),
    [
      pilotAgreementChecklist,
      pilotOnboardingPlan,
      pilotOperationsRunbook,
      adminAccessReadiness,
      pilotProofRuns,
      executivePriorityQueue,
    ],
  );
  const pilotStartBlockers = pilotStartPlan.filter((item) => item.status === "blokeret").length;
  const pilotStartReadyCount = pilotStartPlan.filter((item) => item.status === "klar" || item.status === "qa").length;
  const pilotWeekOneReport = useMemo(
    () => getPilotWeekOneReport(
      pilotStartPlan,
      pilotSuccessCriteria,
      orderOperationsRows,
      paymentCheckoutRows,
      supportCustomerRows,
      mailNotificationRows,
      deliveryFulfillmentRows,
      seoVisibilityRows,
      executivePriorityQueue,
    ),
    [
      pilotStartPlan,
      pilotSuccessCriteria,
      orderOperationsRows,
      paymentCheckoutRows,
      supportCustomerRows,
      mailNotificationRows,
      deliveryFulfillmentRows,
      seoVisibilityRows,
      executivePriorityQueue,
    ],
  );
  const weekOneBlockers = pilotWeekOneReport.filter((item) => item.status === "blokeret").length;
  const weekOneReadyCount = pilotWeekOneReport.filter((item) => item.status === "klar" || item.status === "qa").length;
  const pilotConversionReadiness = useMemo(
    () => getPilotConversionReadiness(
      pilotWeekOneReport,
      pilotAgreementChecklist,
      printHouseOfferDraft,
      pilotSuccessCriteria,
      commercialPilotAcceptance,
      offerModel,
      executivePriorityQueue,
    ),
    [
      pilotWeekOneReport,
      pilotAgreementChecklist,
      printHouseOfferDraft,
      pilotSuccessCriteria,
      commercialPilotAcceptance,
      offerModel,
      executivePriorityQueue,
    ],
  );
  const conversionBlockers = pilotConversionReadiness.filter((item) => item.status === "blokeret").length;
  const conversionReadyCount = pilotConversionReadiness.filter((item) => item.status === "klar" || item.status === "qa").length;
  const paidPilotPackage = useMemo(
    () => getPaidPilotPackage(
      pilotConversionReadiness,
      offerModel,
      commercialReadyCriteria,
      paymentCheckoutRows,
      legalConsentRows,
      deliveryFulfillmentRows,
      commercialDecisionsQueue,
    ),
    [
      pilotConversionReadiness,
      offerModel,
      commercialReadyCriteria,
      paymentCheckoutRows,
      legalConsentRows,
      deliveryFulfillmentRows,
      commercialDecisionsQueue,
    ],
  );
  const paidPilotBlockers = paidPilotPackage.filter((item) => item.status === "blokeret").length;
  const paidPilotReadyCount = paidPilotPackage.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstCustomerOnboarding = useMemo(
    () => getFirstCustomerOnboardingBoard(
      paidPilotPackage,
      pilotPrintHouseIntake,
      pilotOnboardingPlan,
      adminAccessReadiness,
      pilotScopeAgreement,
      pilotResponsibilityMap,
    ),
    [
      paidPilotPackage,
      pilotPrintHouseIntake,
      pilotOnboardingPlan,
      adminAccessReadiness,
      pilotScopeAgreement,
      pilotResponsibilityMap,
    ],
  );
  const firstCustomerOnboardingBlockers = firstCustomerOnboarding.filter((item) => item.status === "blokeret").length;
  const firstCustomerOnboardingReadyCount = firstCustomerOnboarding.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstCustomerSetupWorkOrder = useMemo(
    () => getFirstCustomerSetupWorkOrder(
      firstCustomerOnboarding,
      paidPilotPackage,
      pilotOnboardingPlan,
      adminAccessReadiness,
    ),
    [
      firstCustomerOnboarding,
      paidPilotPackage,
      pilotOnboardingPlan,
      adminAccessReadiness,
    ],
  );
  const setupWorkOrderBlockers = firstCustomerSetupWorkOrder.filter((item) => item.status === "blokeret").length;
  const setupWorkOrderReadyCount = firstCustomerSetupWorkOrder.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstCustomerKickoffAgenda = useMemo(
    () => getFirstCustomerKickoffAgenda(
      firstCustomerSetupWorkOrder,
      firstCustomerOnboarding,
      paidPilotPackage,
      executivePriorityQueue,
    ),
    [
      firstCustomerSetupWorkOrder,
      firstCustomerOnboarding,
      paidPilotPackage,
      executivePriorityQueue,
    ],
  );
  const kickoffAgendaBlockers = firstCustomerKickoffAgenda.filter((item) => item.status === "blokeret").length;
  const kickoffAgendaReadyCount = firstCustomerKickoffAgenda.filter((item) => item.status === "klar" || item.status === "qa").length;
  const firstCustomerKickoffFollowUp = useMemo(
    () => getFirstCustomerKickoffFollowUp(
      firstCustomerKickoffAgenda,
      firstCustomerSetupWorkOrder,
      paidPilotPackage,
      executivePriorityQueue,
    ),
    [
      firstCustomerKickoffAgenda,
      firstCustomerSetupWorkOrder,
      paidPilotPackage,
      executivePriorityQueue,
    ],
  );
  const kickoffFollowUpBlockers = firstCustomerKickoffFollowUp.filter((item) => item.status === "blokeret").length;
  const kickoffFollowUpReadyCount = firstCustomerKickoffFollowUp.filter((item) => item.status === "klar" || item.status === "qa").length;
  const customerMaterialCheckpoint = useMemo(
    () => getCustomerMaterialCheckpoint(
      firstCustomerKickoffFollowUp,
      firstCustomerOnboarding,
      firstCustomerSetupWorkOrder,
      pilotPrintHouseIntake,
    ),
    [
      firstCustomerKickoffFollowUp,
      firstCustomerOnboarding,
      firstCustomerSetupWorkOrder,
      pilotPrintHouseIntake,
    ],
  );
  const customerMaterialBlockers = customerMaterialCheckpoint.filter((item) => item.status === "blokeret").length;
  const customerMaterialReadyCount = customerMaterialCheckpoint.filter((item) => item.status === "klar" || item.status === "qa").length;
  const productionReleaseReadiness = useMemo(
    () => getProductionReleaseReadiness(
      customerMaterialCheckpoint,
      pilotProofRuns,
      commercialReadyCriteria,
      adminAccessReadiness,
      commercialDecisionsQueue,
    ),
    [
      customerMaterialCheckpoint,
      pilotProofRuns,
      commercialReadyCriteria,
      adminAccessReadiness,
      commercialDecisionsQueue,
    ],
  );
  const productionReleaseBlockers = productionReleaseReadiness.filter((item) => item.status === "blokeret").length;
  const productionReleaseReadyCount = productionReleaseReadiness.filter((item) => item.status === "klar" || item.status === "qa").length;
  const productionReleaseProof = useMemo(
    () => getProductionReleaseProofCapture(productionReleaseReadiness),
    [productionReleaseReadiness],
  );
  const productionReleaseProofBlockers = productionReleaseProof.filter((item) => item.status === "blokeret").length;
  const productionReleaseProofReadyCount = productionReleaseProof.filter((item) => item.status === "klar" || item.status === "qa").length;
  const supplierBankStagingRunbook = useMemo(
    () => getSupplierBankStagingRunbook(commercialDecisionsQueue, commercialReadyCriteria),
    [commercialDecisionsQueue, commercialReadyCriteria],
  );
  const supplierBankStagingBlockers = supplierBankStagingRunbook.filter((item) => item.status === "blokeret").length;
  const supplierBankStagingReadyCount = supplierBankStagingRunbook.filter((item) => item.status === "klar" || item.status === "qa").length;
  const commercialDecisionOptionCards = useMemo(
    () => getCommercialDecisionOptionCards(commercialDecisionsQueue),
    [commercialDecisionsQueue],
  );
  const decisionOptionBlockers = commercialDecisionOptionCards.filter((item) => item.status === "blokeret").length;
  const decisionOptionReadyCount = commercialDecisionOptionCards.filter((item) => item.status === "klar" || item.status === "qa").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <Badge variant="outline" className="w-fit border-sky-200 bg-sky-50 text-sky-800">
            Kun læsning
          </Badge>
          <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">
            Kommerciel driftsklarhed
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Overblik over de tenant-flows, gates og beslutninger der skal gøre Webprinter klar som et salgbart
            web-to-print system for trykkerier.
          </p>
          {loadingSignals ? (
            <p className="text-xs text-muted-foreground">Henter live signaler fra tenants, produkter, skabeloner, SEO og ordrer...</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Live signaler indlæst. Supplier Bank tallene er stadig rapportbaserede og read-only.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/products?force_domain=webprinter.dk">
              Produkter
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/supplier-bank?force_domain=webprinter.dk">
              Supplier Bank
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tenantpiloter</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Globe2 className="h-5 w-5 text-sky-600" />
              3
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Webprinter, Salgsmapper og Onlinetryksager.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Første hele flows</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              {completeFlows}/3
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Skal bevises med produkt, designer/upload, checkout og admin.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Supplier Bank dækning</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Database className="h-5 w-5 text-indigo-600" />
              9/14
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Importeret draft QA: 9 OK, 1 fejl.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gennemsnitlig driftsklarhed</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Gauge className="h-5 w-5 text-sky-600" />
              {averageReadiness}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Baseret på read-only tenant-signaler.
          </CardContent>
        </Card>
      </div>

      <section id="next-safe-action" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Næste sikre handling</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {commercialFocusItems.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.label}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    {item.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="goal-execution" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Måleksekvering</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={goalExecutionBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {goalExecutionBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={goalExecutionReadyCount >= 1 ? statusClassNames.klar : statusClassNames.qa}>
              {goalExecutionReadyCount}/{goalExecutionPlan.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Dette er den aktuelle arbejdsplan for målet: gøre Webprinter salgbart som web-to-print platform med
            Webprinter, Salgsmapper og Onlinetryksager som proof-tenants. Listen er kun læsning og ændrer ikke
            priser, produkter, ordrer, auth, SEO, POD eller Supplier Bank.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goalExecutionPlan.map((item) => (
            <Card key={item.phase}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.phase}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.evidence}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn bevis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Automatisering og menneskelig bevisførelse</CardTitle>
                <CardDescription>
                  Hvad Codex kan fortsætte med automatisk, og hvad der kræver manuel QA eller CEO-beslutning.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={automationModeClassNames.auto}>
                  {automationAutoCount} automatiserbare
                </Badge>
                <Badge variant="outline" className={automationModeClassNames.manual}>
                  {automationManualCount} manuelle
                </Badge>
                <Badge variant="outline" className={automationModeClassNames.decision}>
                  {automationDecisionCount} beslutninger
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {automationMap.map((item) => (
              <div key={item.title} className="flex h-full flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="outline" className={automationModeClassNames[item.mode]}>
                      {automationModeLabels[item.mode]}
                    </Badge>
                    <h3 className="text-sm font-semibold leading-5">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{item.evidence}</p>
                <div className="space-y-1 text-xs leading-5">
                  <p>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Codex kan: </span>
                    <span className="text-muted-foreground">{item.canDo}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Menneske skal: </span>
                    <span className="text-muted-foreground">{item.needsHuman}</span>
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn område
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="external-demo-boundary" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Ekstern demo-grænse</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={externalDemoBlockedCount > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {externalDemoBlockedCount} må ikke loves
            </Badge>
            <Badge variant="outline" className={statusClassNames.qa}>
              {externalDemoAllowedCount}/{externalDemoBoundary.length} kan nævnes
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Grænsen beskytter første trykkerisamtale: den adskiller det der må vises eksternt, det der kun er
            pilotbevis, og det der skal blive internt indtil flere beviser er lukket. Den er kun læsning og
            ændrer ikke demoindhold, produkter, priser, betaling, SEO eller Supplier Bank.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {externalDemoBoundary.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.audience}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Må siges: </span>
                  {item.allowed}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Risiko: {item.risk}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn bevis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="commercial-pilot-acceptance" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotaccept for trykkerikunde</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={commercialPilotAcceptanceBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {commercialPilotAcceptanceBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={commercialPilotAcceptanceReadyCount > 0 ? statusClassNames.klar : statusClassNames.qa}>
              {commercialPilotAcceptanceReadyCount}/{commercialPilotAcceptance.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Accepten er en intern go/no-go før en rigtig trykkeripilot: den samler scorecard, demo-grænse,
            pilotdrift, adminmail, tilbudspakke og ledelsesbeslutninger. Den er kun læsning og opretter
            ingen kunder, tilbud, priser, betalinger, produkter eller ordreændringer.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {commercialPilotAcceptance.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.acceptance}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Bevis: {item.evidence}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Næste: {item.next}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn acceptpunkt
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-responsibility-map" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotansvarskort</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotResponsibilityBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotResponsibilityBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={pilotResponsibilityReadyCount > 0 ? statusClassNames.klar : statusClassNames.qa}>
              {pilotResponsibilityReadyCount}/{pilotResponsibilityMap.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Ansvarskortet gør piloten driftsbar uden at ændre roller eller rettigheder. Det viser hvem der bør eje
            beslutning, produktpakke, ordrebehandling, filkontrol, adminadgang, SEO, sourcing, økonomi, support
            og demo-grænse før en trykkerikunde onboardes.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotResponsibilityMap.map((item) => (
            <Card key={`${item.owner}-${item.title}`}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.owner}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.responsibility}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Risiko: {item.risk}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn ansvarspunkt
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-scope-agreement" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotscope aftalegrundlag</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotScopeBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotScopeBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={pilotScopeReadyCount > 0 ? statusClassNames.klar : statusClassNames.qa}>
              {pilotScopeReadyCount}/{pilotScopeAgreement.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Scopekortet gør pilottilbuddet konkret uden at oprette tilbud eller priser. Det viser hvad der er med,
            hvad der ikke er med, og hvilken beslutning der mangler før en trykkeripilot kan forklares roligt.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotScopeAgreement.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.category}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Med: </span>
                  {item.included}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Ikke med: {item.excluded}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Beslutning: {item.decision}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn scopepunkt
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-onboarding-plan" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotonboarding plan</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotOnboardingBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotOnboardingBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={pilotOnboardingReadyCount > 0 ? statusClassNames.klar : statusClassNames.qa}>
              {pilotOnboardingReadyCount}/{pilotOnboardingPlan.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Onboardingplanen viser den manuelle rækkefølge efter et ja fra et trykkeri: accept, domæne/brand,
            produktpakke, templates, ordretest, adminadgang, SEO, sourcing, økonomi/support og intern generalprøve.
            Den er kun læsning og opretter ingen tenants, produkter, kunder, tilbud, roller eller priser.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {pilotOnboardingPlan.map((item) => (
            <Card key={`${item.step}-${item.title}`}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.step}</Badge>
                    <Badge variant="outline">{item.owner}</Badge>
                    <h3 className="font-medium">{item.title}</h3>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.action}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Bevis: {item.evidence}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Stop hvis: {item.stopCondition}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn trin
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-success-criteria" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SearchCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotsucces og exitkriterier</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotSuccessBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotSuccessBlockers} pausepunkter
            </Badge>
            <Badge variant="outline" className={pilotSuccessReadyCount > 0 ? statusClassNames.klar : statusClassNames.qa}>
              {pilotSuccessReadyCount}/{pilotSuccessCriteria.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Succeskriterierne gør piloten målbar uden at ændre systemdata. De viser hvornår en pilot kan fortsætte,
            hvornår den skal pauses, og hvornår den kan konverteres til en betalt første pakke.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotSuccessCriteria.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                      {item.metric}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.success}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Pause: {item.pauseIf}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Beslutning: {item.decision}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn kriterie
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="print-house-pilot-handoff" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Trykkeripilot handoff</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotHandoffBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotHandoffBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={pilotHandoffReadyCount === printHousePilotHandoff.length ? statusClassNames.klar : statusClassNames.qa}>
              {pilotHandoffReadyCount}/{printHousePilotHandoff.length} kan bruges
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Handoff-kortene samler hvad der er sikkert at tage med til første trykkeripilot, hvad der kræver
            ledelsesbeslutning, hvad kunden skal levere efter et ja, og hvilke løfter der skal holdes internt.
            Det er kun læsning og opretter ingen tilbud, kunder, priser, produkter, ordrestatus eller supplier-publicering.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {printHousePilotHandoff.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.audience}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.handoff}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn handoff
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="print-house-pilot-questions" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Trykkeripilot Q&amp;A</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotQuestionBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotQuestionBlockers} svar med stop
            </Badge>
            <Badge variant="outline" className={pilotQuestionReadyCount === printHousePilotQuestions.length ? statusClassNames.klar : statusClassNames.qa}>
              {pilotQuestionReadyCount}/{printHousePilotQuestions.length} kan besvares
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Q&amp;A-laget samler de spørgsmål et trykkeri typisk stiller i første møde. Hvert svar viser et kort svar,
            beviset bag svaret og grænsen for hvad der ikke må loves endnu. Det er kun læsning og opretter ingen
            tilbud, kunder, priser, produkter, ordrestatus, SEO-data eller Supplier Bank-publicering.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {printHousePilotQuestions.map((item) => (
            <Card key={item.question}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.category}</Badge>
                    <h3 className="font-semibold">{item.question}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.answer}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Grænse: {item.boundary}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn svargrundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="print-house-meeting-brief" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Første mødebrief</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={meetingBriefBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {meetingBriefBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={meetingBriefReadyCount === printHouseMeetingBrief.length ? statusClassNames.klar : statusClassNames.qa}>
              {meetingBriefReadyCount}/{printHouseMeetingBrief.length} klar til møde
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Mødebriefet samler den korte samtalevej: åbn roligt, vis kun den korte demo, stil pilotspørgsmålet,
            gentag ikke-løfterne og slut med næste handling. Det er kun læsning og opretter ingen tilbud,
            mails, kunder, priser, produkter, ordrestatus eller supplier-publicering.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {printHouseMeetingBrief.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{item.title}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.script}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Grænse: {item.boundary}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="print-house-follow-up" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Eftermøde opfølgning</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={followUpBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {followUpBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={followUpReadyCount === printHouseFollowUpItems.length ? statusClassNames.klar : statusClassNames.qa}>
              {followUpReadyCount}/{printHouseFollowUpItems.length} klar til opfølgning
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Opfølgningslaget er en read-only kladde efter første trykkerimøde. Det samler recap, pilotforslag,
            kundens inputliste, ikke-løfter og intern næste handling. Det sender ingen mails, opretter ingen
            kundeemner, tilbud, priser, produkter, ordrestatus eller supplier-publicering.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {printHouseFollowUpItems.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.audience}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.draft}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="print-house-offer-draft" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilottilbud kladde</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={offerDraftBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {offerDraftBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={offerDraftReadyCount === printHouseOfferDraft.length ? statusClassNames.klar : statusClassNames.qa}>
              {offerDraftReadyCount}/{printHouseOfferDraft.length} klar til kladde
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Tilbudskladden samler opfølgning, tilbudsmodel, scope, pilotaccept og prioriteret kø i et læseligt
            grundlag før første pilottilbud. Den er kun læsning: den sender ingen mail, opretter ingen kunde,
            tilbud eller lead, sætter ingen priser, ændrer ingen produkter/ordrer og publicerer ikke Supplier Bank-data.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {printHouseOfferDraft.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.section}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.clause}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Grænse: {item.guardrail}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-agreement-checklist" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotaftale tjekliste</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={agreementChecklistBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {agreementChecklistBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={agreementChecklistReadyCount === pilotAgreementChecklist.length ? statusClassNames.klar : statusClassNames.qa}>
              {agreementChecklistReadyCount}/{pilotAgreementChecklist.length} aftalepunkter klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Aftaletjeklisten er sidste læselag før en pilotkladdetekst kan blive til et rigtigt kundeforløb.
            Den samler formål, scope, kundeinput, økonomibeslutning, ansvar, succeskriterier og ikke-løfter.
            Den opretter ingen kontrakt, kunde, tilbud, pris, ordre, mail, produktændring eller Supplier Bank-publicering.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotAgreementChecklist.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.checkpoint}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.evidence}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Mangler: {item.missing}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-start-plan" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotstart plan</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotStartBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotStartBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={pilotStartReadyCount === pilotStartPlan.length ? statusClassNames.klar : statusClassNames.qa}>
              {pilotStartReadyCount}/{pilotStartPlan.length} trin klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Pilotstart-planen viser de første dage efter et ja fra trykkeriet: intern accept, kundens input,
            adminmail/adgang, produkt- og designsti, første ordre, bevispakke og uge-1 beslutning. Den er kun
            læsning og opretter ikke tenants, produkter, priser, ordrer, roller, mails, kontrakter eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotStartPlan.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.day}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Ejer: {item.owner}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">{item.action}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Stopregel: {item.stopRule}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-week-one-report" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SearchCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilot uge-1 rapport</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={weekOneBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {weekOneBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={weekOneReadyCount === pilotWeekOneReport.length ? statusClassNames.klar : statusClassNames.qa}>
              {weekOneReadyCount}/{pilotWeekOneReport.length} signaler klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Uge-1 rapporten samler pilotstart, første ordre/filklarhed, betaling, support, levering, SEO og
            fortsæt/pause-beslutningen som et internt statusgrundlag. Den er kun læsning og opretter ikke
            rapportfiler, kunder, tilbud, priser, ordrer, mails, produktændringer eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotWeekOneReport.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.signal}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.evidence}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-conversion-readiness" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Konverteringsklar pilot</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={conversionBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {conversionBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={conversionReadyCount === pilotConversionReadiness.length ? statusClassNames.klar : statusClassNames.qa}>
              {conversionReadyCount}/{pilotConversionReadiness.length} punkter klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Konverteringslaget viser om en pilot kan blive til en betalt første pakke: uge-1 bevis,
            aftalegrundlag, tilbudsgrænser, succeskriterier, økonomi/support og Supplier Bank-afgrænsning.
            Det er kun læsning og opretter ikke tilbud, kontrakter, kunder, priser, produkter, ordrer,
            mails eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotConversionReadiness.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">{item.decision}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Stopregel: {item.stopRule}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="paid-pilot-package" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Betalt pilotpakke</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={paidPilotBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {paidPilotBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={paidPilotReadyCount === paidPilotPackage.length ? statusClassNames.klar : statusClassNames.qa}>
              {paidPilotReadyCount}/{paidPilotPackage.length} linjer klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Betalt pilotpakke samler hvad en første print-house kunde kan købe efter pilotbeviset:
            scope, ikke-løfter, pris-/betalingsbeslutning, ordre/levering, support/jura og næste fase.
            Den er kun læsning og opretter ikke tilbud, kontrakter, kunder, priser, produkter, ordrer,
            mails, betalingsopsætning eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paidPilotPackage.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.packageLine}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.proof}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Beslutning: {item.decision}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="first-customer-onboarding" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Første kundes onboarding</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={firstCustomerOnboardingBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {firstCustomerOnboardingBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={firstCustomerOnboardingReadyCount === firstCustomerOnboarding.length ? statusClassNames.klar : statusClassNames.qa}>
              {firstCustomerOnboardingReadyCount}/{firstCustomerOnboarding.length} trin klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Første kundes onboarding viser hvad der skal indsamles og bekræftes før en betalt print-house
            pilot sættes op: aftalegrænse, tenant/brand, produkter/prisansvar, skabeloner, ordre/betaling,
            adminadgang, rapportering/sourcing og intern generalprøve. Den er kun læsning og opretter ikke
            tenants, kunder, produkter, priser, ordrer, roller, mails, betalinger eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {firstCustomerOnboarding.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.customerInput}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Intern check: {item.internalCheck}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Stopregel: {item.stopRule}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="first-customer-setup-work-order" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Setup-arbejdsordre</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={setupWorkOrderBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {setupWorkOrderBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={setupWorkOrderReadyCount === firstCustomerSetupWorkOrder.length ? statusClassNames.klar : statusClassNames.qa}>
              {setupWorkOrderReadyCount}/{firstCustomerSetupWorkOrder.length} arbejdspunkter klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Setup-arbejdsordren omsætter første kundes onboarding til interne opsætningspunkter:
            pakkegrænse, tenant/brand, produkter, skabeloner, ordrevej, adminadgang, rapportering/sourcing
            og generalprøve. Den er kun læsning og opretter ikke tenants, kunder, produkter, priser,
            ordrer, roller, mails, betalinger eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {firstCustomerSetupWorkOrder.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.workOrder}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.evidence}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Stopregel: {item.stopRule}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="first-customer-kickoff-agenda" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Kundekickoff agenda</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={kickoffAgendaBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {kickoffAgendaBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={kickoffAgendaReadyCount === firstCustomerKickoffAgenda.length ? statusClassNames.klar : statusClassNames.qa}>
              {kickoffAgendaReadyCount}/{firstCustomerKickoffAgenda.length} mødepunkter klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Kundekickoff agendaen omsætter setup-arbejdsordren til et første kundemøde: pilotgrænse,
            tenant/brand, produkter/prisansvar, filer, ordre/betaling/levering, support/adgang,
            rapportering/sourcing og næste handling. Den er kun læsning og sender ikke mails,
            opretter ikke kunder, tilbud, produkter, priser, ordrer, betalinger eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {firstCustomerKickoffAgenda.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.segment}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.agenda}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Bevis: {item.evidence}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Grænse: {item.boundary}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="first-customer-kickoff-follow-up" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Kickoff opfølgning</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={kickoffFollowUpBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {kickoffFollowUpBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={kickoffFollowUpReadyCount === firstCustomerKickoffFollowUp.length ? statusClassNames.klar : statusClassNames.qa}>
              {kickoffFollowUpReadyCount}/{firstCustomerKickoffFollowUp.length} opfølgninger klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Kickoff opfølgning samler en sendbar recap, kundens materiale, produkt-/prisafklaring,
            ordrevej/ansvar, rapportering/sourcing og næste interne handling efter første kundekickoff.
            Den er kun læsning og sender ikke mails, opretter ikke kunder, tilbud, produkter, priser,
            ordrer, betalinger eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {firstCustomerKickoffFollowUp.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.audience}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.recap}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Handling: {item.ownerAction}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Grænse: {item.guardrail}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="customer-material-checkpoint" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Kundemateriale checkpoint</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={customerMaterialBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {customerMaterialBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={customerMaterialReadyCount === customerMaterialCheckpoint.length ? statusClassNames.klar : statusClassNames.qa}>
              {customerMaterialReadyCount}/{customerMaterialCheckpoint.length} materialepunkter klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Kundemateriale checkpoint viser hvilke materialer og beslutninger der skal bekræftes manuelt
            efter kickoff: brand, produkter/prisansvar, skabeloner/filer, ordre/betaling/levering,
            support/adgang, rapportering/sourcing og næste interne handling. Den er kun læsning og
            henter ikke vedhæftninger, sender ikke mails og opretter ikke kunder, produkter, priser,
            ordrer, betalinger eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {customerMaterialCheckpoint.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.expected}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Signal: {item.currentSignal}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="production-release-readiness" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Frigivelse til produktion</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={productionReleaseBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {productionReleaseBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={statusClassNames.qa}>
              {productionReleaseReadyCount}/{productionReleaseReadiness.length} releasepunkter i QA
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Frigivelse til produktion samler de manuelle gates før push/deploy: build,
            localhost-røgtest, tenantbeviser, adminadgang, data-/prisgrænser, deploy-ejer,
            rollback og efter-deploy røgtest. Den er kun læsning og opretter ikke commits,
            branches, deployments, priser, produkter, ordrer, POD-data eller Supplier Bank-skrivninger.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productionReleaseReadiness.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.area}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.evidence}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Krav: {item.required}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Stopregel: {item.stopRule}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="production-release-proof" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Releasebevis og accept</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={productionReleaseProofBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {productionReleaseProofBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={statusClassNames.qa}>
              {productionReleaseProofReadyCount}/{productionReleaseProof.length} beviser i QA
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Releasebevis og accept viser hvad der skal gemmes eller bevidnes før og efter en release:
            buildresultat, tenantflow, adminmail, datagrænser, deploy/rollback og live røgtest.
            Den er kun læsning og gemmer ikke filer, skriver ikke noter og opretter ikke commits,
            deployments, ordrer, priser, produkter eller Supplier Bank-data.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productionReleaseProof.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.owner}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.capture}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Accepteret når: {item.acceptedWhen}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Stopregel: {item.stopRule}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn bevisgrundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="supplier-bank-staging-runbook" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Supplier Bank staging-runbook</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={supplierBankStagingBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {supplierBankStagingBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={statusClassNames.qa}>
              {supplierBankStagingReadyCount}/{supplierBankStagingRunbook.length} trin i QA
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Supplier Bank staging-runbook holder leverandørbanken som kontrolleret sourcing:
            ekstern kilde, rapporteret kandidat, eksplicit approval, draft-import, prisrække-QA,
            separat publiceringsbeslutning og først derefter tenantflow. Den er kun læsning og
            scraper ikke, importerer ikke, publicerer ikke og ændrer ikke livepriser, produkter,
            POD-data eller Supplier Bank-data.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {supplierBankStagingRunbook.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.phase}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.evidence}</p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Operatør: {item.operatorAction}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Approval-gate: {item.approvalGate}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn bankgrundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="priority-queue" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Prioriteret handlingskø</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={executivePriorityBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {executivePriorityBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={statusClassNames.qa}>
              {executivePriorityQueue.length} næste handlinger
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Den korteste operatorliste for at komme tættere på første trykkerisamtale. Køen samler
            åbne punkter fra kritisk sti, pilottest, pilotdrift, adgang, go/no-go og 30-dages planen.
            Den er kun læsning og ændrer ikke systemdata.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {executivePriorityQueue.map((item) => (
            <Card key={`${item.priority}-${item.title}`}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.priority}</Badge>
                    <Badge variant="outline">{item.owner}</Badge>
                    <StatusBadge status={item.status} />
                    <h3 className="font-medium">{item.title}</h3>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.reason}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Gør nu: {item.action}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn handling
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="print-house-meeting-pack" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Trykkerimødepakke</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={printHouseMeetingBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {printHouseMeetingBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={statusClassNames.qa}>
              {printHouseMeetingPack.length} mødepunkter
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Mødepakken samler den korte fortælling til den første trykkerisamtale: formål, hvad der må vises,
            hvilke beviser der kan nævnes, hvad der ikke må loves, hvilket kommercielt spørgsmål der skal stilles,
            og hvad næste opfølgning er. Den er kun læsning og opretter ingen tilbud, priser, mails eller produkter.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {printHouseMeetingPack.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{item.title}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Formål: </span>
                    {item.purpose}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Sig: </span>
                    {item.say}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Bevis: {item.evidence}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="critical-path" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Kritisk sti til første trykkerisamtale</h2>
          </div>
          <Badge variant="outline" className={criticalPathBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
            {criticalPathBlockers} blokerende
          </Badge>
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          {criticalPath.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{item.title}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.why}</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn trin
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="manual-rehearsal-route" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Browserrute til generalprøve</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotProofBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotProofBlockers} stop-punkter
            </Badge>
            <Badge variant="outline" className={pilotProofReadyCount === pilotProofRuns.length ? statusClassNames.klar : statusClassNames.qa}>
              {pilotProofReadyCount}/{pilotProofRuns.length} bevist
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Åbn disse punkter i rækkefølge under en intern generalprøve. Ruten er kun læsning og bruger de samme
            beviser som pilot-gennemgangen, men uden at skrive ordrestatus, priser, produkter, SEO eller Supplier Bank.
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          {pilotProofRuns.map((item, index) => (
            <Card key={`manual-route-${item.title}`}>
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">Trin {index + 1}</Badge>
                    <h3 className="font-semibold leading-5">{item.title.replace(/^\d+\.\s*/, "")}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{item.tenantName}</Badge>
                  <Badge variant="outline">{item.surface}</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.witness}</p>
                <Button asChild variant="outline" size="sm" className="mt-auto justify-between">
                  <Link to={item.href}>
                    Åbn trin {index + 1}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="rehearsal-proof-capture" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SearchCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Bevisfangst for generalprøve</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={rehearsalProofCaptureBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {rehearsalProofCaptureBlockers} stopregler
            </Badge>
            <Badge variant="outline" className={rehearsalProofCaptureReadyCount === rehearsalProofCapture.length ? statusClassNames.klar : statusClassNames.qa}>
              {rehearsalProofCaptureReadyCount}/{rehearsalProofCapture.length} fanget
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Brug denne liste til at samle bevis under generalprøven: hvad der skal ses, hvad der tæller som godkendt,
            og hvornår punktet skal holdes væk fra en ekstern trykkeridemo. Den skriver ikke noter, filer, priser,
            produkter, ordrestatus eller SEO-data.
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          {rehearsalProofCapture.map((item) => (
            <Card key={`proof-capture-${item.title}`}>
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{item.tenantName}</Badge>
                      <Badge variant="outline">{item.surface}</Badge>
                    </div>
                    <h3 className="font-semibold leading-5">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Fang bevis: </span>
                    {item.capture}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Godkendt når: </span>
                    {item.acceptedWhen}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Stopregel: </span>
                    {item.stopRule}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-auto justify-between">
                  <Link to={item.href}>
                    Åbn bevis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-proof-run" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilot-gennemgang</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotProofBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotProofBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={pilotProofReadyCount === pilotProofRuns.length ? statusClassNames.klar : statusClassNames.qa}>
              {pilotProofReadyCount}/{pilotProofRuns.length} bevist
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Praktisk generalprøve for de ejede tenants. Listen er kun læsning og ændrer ikke produkter,
            priser, ordrer, publicering, SEO eller Supplier Bank. Brug den som den manuelle tur gennem
            systemet før en ekstern trykkerisamtale.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {pilotProofRuns.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.tenantName}</Badge>
                    <Badge variant="outline">{item.surface}</Badge>
                    <StatusBadge status={item.status} />
                    <h3 className="font-medium">{item.title}</h3>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.evidence}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Skal ses: {item.witness}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn bevis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-operations-runbook" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Pilotdrift runbook</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={pilotOperationsBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {pilotOperationsBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={pilotOperationsReadyCount === pilotOperationsRunbook.length ? statusClassNames.klar : statusClassNames.qa}>
              {pilotOperationsReadyCount}/{pilotOperationsRunbook.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Driftsrutinen for den første kontrollerede ordre. Den er kun læsning og viser hvad admin,
            prepress, økonomi, support og ledelse skal bekræfte, før ordren bruges som salgsbevis
            eller production case. Den ændrer ingen ordrestatus, betaling, filer, priser eller produkter.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {pilotOperationsRunbook.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.owner}</Badge>
                    <StatusBadge status={item.status} />
                    <h3 className="font-medium">{item.title}</h3>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.evidence}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Operatørcheck: {item.operatorCheck}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn område
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="order-operations-signals" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-600" />
              <h2 className="text-xl font-semibold">Ordredrift signaler</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={orderOperationsBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
                {orderOperationsBlockers} blokerende
              </Badge>
              <Badge variant="outline" className={orderOperationsReadyCount === orderOperationsRows.length ? statusClassNames.klar : statusClassNames.qa}>
                {orderOperationsReadyCount}/{orderOperationsRows.length} klar
              </Badge>
            </div>
          </div>
          <Card>
            <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
              Read-only overblik over om tenantens ordrer har et driftsklart filgrundlag. Cockpittet læser
              eksisterende ordrestatus, problem-/genuploadflag og aktuelle `order_files`; det opretter ikke
              ordrer, ændrer ikke filer og flytter ikke status.
            </CardContent>
          </Card>
          <div className="grid gap-3 lg:grid-cols-3">
            {orderOperationsRows.map((item) => (
              <Card key={item.domain}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.tenantName}</Badge>
                    <StatusBadge status={item.status} />
                  </div>
                  <div>
                    <h3 className="font-medium">{item.domain}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Ordrer</p>
                      <p className="font-semibold">{formatCount(item.orderCount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fil klar</p>
                      <p className="font-semibold">{formatCount(item.fileReadyCount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Problem/ny fil</p>
                      <p className="font-semibold">
                        {formatCount((item.problemCount ?? 0) + (item.reuploadCount ?? 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mangler fil</p>
                      <p className="font-semibold">
                        {formatCount((item.awaitingCustomerFileCount ?? 0) + (item.missingFileCount ?? 0))}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Læst udsnit: {formatCount(item.sampledCount)}
                    {item.sampleLimited ? " seneste ordrer (begrænset)" : " ordrer"}
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full justify-between">
                    <Link to={item.href}>
                      Åbn ordrer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
      </section>

      <section id="payment-checkout-signals" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Betaling/checkout signaler</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={paymentCheckoutBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {paymentCheckoutBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={paymentCheckoutReadyCount === paymentCheckoutRows.length ? statusClassNames.klar : statusClassNames.qa}>
              {paymentCheckoutReadyCount}/{paymentCheckoutRows.length} liveklar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Read-only overblik over tenantens betalingsberedskab. Cockpittet læser eksisterende
            `tenant_payment_settings` og viser om Stripe er liveklar, under opsætning eller om pilotordren
            bør køres som test/manuelt flow. Det opretter ikke Stripe-konti, ændrer ikke gebyrer og starter
            ingen betalinger.
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          {paymentCheckoutRows.map((item) => (
            <Card key={item.domain}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.tenantName}</Badge>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <h3 className="font-medium">{item.domain}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Mode</p>
                    <p className="font-semibold">{item.mode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stripe status</p>
                    <p className="font-semibold">{item.paymentStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Charges</p>
                    <p className="font-semibold">{item.chargesEnabled ? "Aktiv" : "Ikke aktiv"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Udbetalinger</p>
                    <p className="font-semibold">{item.payoutsEnabled ? "Aktiv" : "Ikke aktiv"}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Platformgebyr: {item.feeSummary}</p>
                  <p>Synkroniseret: {item.updatedAt ? new Date(item.updatedAt).toLocaleString("da-DK") : "Ikke synkroniseret"}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link to={item.href}>
                    Åbn betaling
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="support-customer-signals" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Kundeservice signaler</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={supportCustomerBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {supportCustomerBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={supportCustomerReadyCount === supportCustomerRows.length ? statusClassNames.klar : statusClassNames.qa}>
              {supportCustomerReadyCount}/{supportCustomerRows.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Read-only overblik over kundedialog og tenant-support. Cockpittet læser eksisterende
            `order_messages` og `platform_messages`, så admin kan se om der er ulæste kundehenvendelser
            eller om beskedflowet stadig skal testes. Det sender ikke beskeder og markerer intet som læst.
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          {supportCustomerRows.map((item) => (
            <Card key={item.domain}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.tenantName}</Badge>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <h3 className="font-medium">{item.domain}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Ordrebeskeder</p>
                    <p className="font-semibold">{formatCount(item.orderMessageCount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ulæste fra kunde</p>
                    <p className="font-semibold">{formatCount(item.unreadCustomerMessageCount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Supportbeskeder</p>
                    <p className="font-semibold">{formatCount(item.platformMessageCount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ulæste fra tenant</p>
                    <p className="font-semibold">{formatCount(item.unreadTenantMessageCount)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Seneste besked: {item.latestMessageAt ? new Date(item.latestMessageAt).toLocaleString("da-DK") : "Ingen beskeder endnu"}
                </p>
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link to={item.href}>
                    Åbn beskeder
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="mail-notification-signals" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Mail/notifikationer signaler</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={mailNotificationBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {mailNotificationBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={mailNotificationReadyCount === mailNotificationRows.length ? statusClassNames.klar : statusClassNames.qa}>
              {mailNotificationReadyCount}/{mailNotificationRows.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Read-only overblik over tenantens mail- og notifikationsberedskab. Cockpittet læser
            `tenants.settings` og `tenant_notifications`, så en pilot kan se om kundebekræftelser,
            admin ordre-mails og interne notifikationer er afklaret. Det sender ingen mails,
            opdaterer ingen settings og markerer ingen notifikationer som læst.
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          {mailNotificationRows.map((item) => (
            <Card key={item.domain}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.tenantName}</Badge>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <h3 className="font-medium">{item.domain}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Kundebekræftelse</p>
                    <p className="font-semibold">{item.customerConfirmationsEnabled ? "Aktiv" : "Slået fra"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Admin ordre-mail</p>
                    <p className="font-semibold">{item.adminNewOrdersEnabled ? "Aktiv" : "Slået fra"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Firma-email</p>
                    <p className="font-semibold break-words">{item.companyEmail || "Mangler"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ulæste interne</p>
                    <p className="font-semibold">{formatCount(item.tenantUnreadNotificationCount)}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Firmanavn: {item.companyName || "Ikke udfyldt"}</p>
                  <p>Administrator: {item.adminName || "Ikke udfyldt"}</p>
                  <p>Interne notifikationer: {formatCount(item.tenantNotificationCount)}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link to={item.href}>
                    Åbn indstillinger
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="delivery-fulfillment-signals" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Levering/fulfillment signaler</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={deliveryFulfillmentBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {deliveryFulfillmentBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={deliveryFulfillmentReadyCount === deliveryFulfillmentRows.length ? statusClassNames.klar : statusClassNames.qa}>
              {deliveryFulfillmentReadyCount}/{deliveryFulfillmentRows.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Read-only overblik over levering og fulfillment. Cockpittet læser produktets
            `order_delivery`, eksisterende ordrelevering/tracking, `delivery_tracking` og
            `tenant_pod_shipping_profile`. Det ændrer ikke leveringsmetoder, tracking,
            POD-afsender, ordrestatus, priser eller produktopsætning.
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          {deliveryFulfillmentRows.map((item) => (
            <Card key={item.domain}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.tenantName}</Badge>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <h3 className="font-medium">{item.domain}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Leveringsmetoder</p>
                    <p className="font-semibold">{formatCount(item.firstProductDeliveryMethodCount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Leveringstype</p>
                    <p className="font-semibold">{deliveryModeLabel(item.firstProductDeliveryMode)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ordrer med levering</p>
                    <p className="font-semibold">{formatCount(item.ordersWithMethodCount)}/{formatCount(item.orderSampleCount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tracking</p>
                    <p className="font-semibold">{formatCount(item.ordersWithTrackingCount)} ordrer</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Bestilling: {orderingTypeLabel(item.firstProductOrderingType)}</p>
                  <p>Leverandør: {item.firstProductSupplierName || item.firstProductSupplierEmail || "Ikke udfyldt"}</p>
                  <p>POD-afsender: {senderModeLabel(item.podSenderMode)}{item.podSenderComplete === false ? " (mangler felter)" : ""}</p>
                  <p>Tracking-events: {formatCount(item.trackingEventCount)}</p>
                  <p>Carrier/POD: carrier {item.firstProductCarrierEnabled ? "aktiv" : "ikke aktiv"}, POD levering {item.firstProductPodDeliveryEnabled ? "aktiv" : "ikke aktiv"}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link to={item.href}>
                    Åbn levering
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="legal-consent-signals" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Jura/cookie signaler</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={legalConsentBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {legalConsentBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={legalConsentReadyCount === legalConsentRows.length ? statusClassNames.klar : statusClassNames.qa}>
              {legalConsentReadyCount}/{legalConsentRows.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Read-only overblik over offentlig juridisk beredskab. Cockpittet læser tenantens
            `settings.company` og sammenholder det med de eksisterende kontakt-, privatlivs-,
            cookie- og vilkårssider samt kontaktformularens samtykke-link til privatlivspolitikken.
            Det ændrer ikke cookies, tracking, kontaktformular, tenantindstillinger eller juridisk tekst.
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          {legalConsentRows.map((item) => (
            <Card key={item.domain}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.tenantName}</Badge>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <h3 className="font-medium">{item.domain}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Firma-email</p>
                    <p className="font-semibold break-words">{item.companyEmail || "Mangler"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CVR/adresse</p>
                    <p className="font-semibold">{(item.companyCvr || item.companyAddress) ? "Synlig" : "Mangler"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cookie-samtykke</p>
                    <p className="font-semibold">{item.cookieConsentReady ? "Aktiv" : "Mangler"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Kontakt-samtykke</p>
                    <p className="font-semibold">{item.contactConsentReady ? "Aktiv med privatlivslink" : "Mangler"}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Firmanavn: {item.companyName || "Ikke udfyldt"}</p>
                  <p>Telefon: {item.companyPhone || "Ikke udfyldt"}</p>
                  <p>Offentlige routes: /kontakt, /privatliv, /cookiepolitik, /betingelser</p>
                  <p>Vilkårslink: {item.termsLinkNeedsReview ? "Gennemgå /handelsbetingelser vs /betingelser" : "Afklaret"}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link to={item.href}>
                    Åbn indstillinger
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="platform-lead-readiness" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Platform henvendelser</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={platformLeadBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {platformLeadBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={platformLeadReadyCount === platformLeadReadiness.length ? statusClassNames.klar : statusClassNames.qa}>
              {platformLeadReadyCount}/{platformLeadReadiness.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Read-only salgsberedskab for Webprinter-platformen. Det viser om en ekstern trykkerihenvendelse
            kan starte på kontaktsiden, få korrekt samtykke og ende i en kontrolleret mail- og adminbesked-handoff.
            Cockpittet sender ikke testmails og ændrer ikke tracking, kundeemner, produkter, priser eller ordrer.
          </CardContent>
        </Card>
        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">Logstatus</p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={platformLeadLogStatus} />
                <p className="font-semibold">{platformLeadLogLabel}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">Platformhenvendelser</p>
              <p className="font-semibold">
                {loadingPlatformLeadSummary ? "Tjekker" : formatCount(platformLeadSummary.totalCount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">Ulæste</p>
              <p className="font-semibold">
                {loadingPlatformLeadSummary ? "Tjekker" : formatCount(platformLeadSummary.unreadCount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">Seneste</p>
              <p className="font-semibold">
                {loadingPlatformLeadSummary ? "Tjekker" : formatDateTime(platformLeadSummary.latestAt)}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {platformLeadReadiness.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.signal}</Badge>
                  <StatusBadge status={item.status} />
                  <h3 className="font-medium">{item.title}</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.proof}</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-auto justify-between">
                  <Link to={item.href}>
                    Åbn signal
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="admin-access-readiness" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Adgangsberedskab for adminmail</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={adminAccessBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {adminAccessBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={adminAccessReadyCount === adminAccessReadiness.length ? statusClassNames.klar : statusClassNames.qa}>
              {adminAccessReadyCount}/{adminAccessReadiness.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Manuel adgangstest for admin@webprinter.dk. Cockpittet ændrer ikke login, roller,
            sessioner eller rettigheder. Det viser kun hvilke adminområder der skal åbnes og bekræftes,
            før piloten kan køres roligt.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {adminAccessReadiness.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.area}</Badge>
                    <StatusBadge status={item.status} />
                    <h3 className="font-medium">{item.title}</h3>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.evidence}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Manuel test: {item.manualCheck}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Test adgang
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-intake" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Pilottrykkeri intake</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {pilotPrintHouseIntake.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{item.title}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm leading-6 text-muted-foreground">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Skal indsamles: </span>
                    {item.needed}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Brug i systemet: </span>
                    {item.systemUse}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn område
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Cockpit-navigation" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Hop til</span>
          {cockpitSectionLinks.map((item, index) => (
            <Button key={item.href} asChild variant={index < 4 ? "default" : "outline"} size="sm">
              <a href={item.href}>{item.label}</a>
            </Button>
          ))}
        </div>
      </section>

      <section id="launch-board" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Go/no-go launch board</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {launchBoard.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="secondary">{item.verdict}</Badge>
                    <h3 className="mt-2 font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.basis}</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="commercial-ready-score" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Commercial ready scorecard</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={commercialReadyBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {commercialReadyBlockers} blokerende
            </Badge>
            <Badge variant="outline" className={commercialReadyCount === commercialReadyCriteria.length ? statusClassNames.klar : statusClassNames.qa}>
              {commercialReadyCount}/{commercialReadyCriteria.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Direkte måling mod roadmap-definitionen for første trykkerisamtale. Scorecardet er kun læsning:
            det samler beviser fra tenantflows, ordre, designer, SEO, Supplier Bank og salgspakken uden at
            ændre produkter, priser, ordrer eller publicering.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {commercialReadyCriteria.map((criterion) => (
            <Card key={criterion.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{criterion.title}</h3>
                    <StatusBadge status={criterion.status} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{criterion.proof}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Næste: {criterion.next}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={criterion.href}>
                    Åbn bevis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="sales-evidence" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Salgsmæssig bevismappe</h2>
        </div>
        <div className="grid gap-3">
          {salesEvidenceBinder.map((item) => (
            <Card key={item.claim}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.claim}</h3>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.proof}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Mangler: {item.gap}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn bevis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="seo-visibility" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SearchCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">SEO/Search Console bevis</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={searchConsoleStatus?.connected ? statusClassNames.qa : statusClassNames.planlagt}>
              {searchConsoleStatusLoading
                ? "Tjekker forbindelse"
                : searchConsoleStatus?.connected
                  ? "Search Console forbundet"
                  : "Search Console mangler"}
            </Badge>
            <Badge variant="outline" className={seoProofCount > 0 ? statusClassNames.klar : statusClassNames.qa}>
              {seoProofCount}/{seoVisibilityRows.length} med trafikbevis
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {seoVisibilityRows.map((row) => (
            <Card key={`${row.domain}-seo-visibility`}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{row.tenantName}</CardTitle>
                    <CardDescription>{row.siteUrl}</CardDescription>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">SEO-rækker</div>
                    <div className="font-semibold">{formatCount(row.seoRows)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Google status</div>
                    <div className="font-semibold">{row.searchConsoleState}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Klik 28 dage</div>
                    <div className="font-semibold">{formatMetric(row.clicks)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Visninger 28 dage</div>
                    <div className="font-semibold">{formatMetric(row.impressions)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">CTR</div>
                    <div className="font-semibold">{formatCtr(row.ctr)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Position</div>
                    <div className="font-semibold">{formatPosition(row.position)}</div>
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{row.detail}</p>
                {searchConsoleOverviewLoading && searchConsoleStatus?.connected ? (
                  <p className="text-xs text-muted-foreground">Henter 28-dages Search Console overblik...</p>
                ) : null}
                <Button asChild variant="outline" size="sm" className="justify-between">
                  <Link to={row.href}>
                    Åbn Platform SEO
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200">Kommerciel brug: </span>
              Brug dette som bevis for synlighed i en trykkeridemo. Det er read-only og viser kun SEO-rækker,
              verificeret Search Console-site og Google-søgedata.
            </div>
            <Badge variant="secondary">
              {seoQaCount} kræver QA
            </Badge>
          </CardContent>
        </Card>
      </section>

      <section id="demo-gate" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Trykkeri-demo gate</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {commercialGates.map((gate) => (
            <Card key={gate.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">{gate.metric}</div>
                    <h3 className="mt-1 font-semibold">{gate.title}</h3>
                  </div>
                  <StatusBadge status={gate.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{gate.summary}</p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={gate.href}>
                    Åbn gate
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="demo-runbook" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Demo-køreplan for trykkeri</h2>
        </div>
        <div className="grid gap-3">
          {demoRunbook.map((step) => (
            <Card key={step.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{step.title}</h3>
                    <StatusBadge status={step.status} />
                    <Badge variant="secondary">{step.duration}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={step.href}>
                    Åbn demo-trin
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pilot-order-plan" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Første pilotordre-plan</h2>
        </div>
        <div className="grid gap-3">
          {pilotOrderPlan.map((step) => (
            <Card key={step.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{step.title}</h3>
                    <StatusBadge status={step.status} />
                    <Badge variant="secondary">{step.owner}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step.proof}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Næste: {step.next}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={step.href}>
                    Åbn trin
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="sales-package" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Trykkeri-salgspakke</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {salesPackage.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">{item.owner}</div>
                    <h3 className="mt-1 font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.artifact}</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Næste: {item.next}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="offer-model" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Første trykkeripilot: tilbudsmodel</h2>
          </div>
          <Badge variant="outline" className={statusClassNames.planlagt}>
            Beløb besluttes manuelt
          </Badge>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Dette er en salgsramme for den første trykkerisamtale. Den viser hvad pilotpakken kan indeholde,
            hvilket bevis cockpittet har nu, og hvilken ledelsesbeslutning der mangler. Den ændrer ikke priser,
            produkter, ordreflow eller Supplier Bank.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {offerModel.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{item.title}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Pakke: </span>
                    {item.packageLine}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Bevis: </span>
                    {item.proof}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Beslutning: {item.decision}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn grundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="thirty-day-plan" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">30-dages eksekveringsplan</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={thirtyDayBlockedCount > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {thirtyDayBlockedCount} blokerende
            </Badge>
            <Badge variant="outline" className={thirtyDayDoneCount === thirtyDayPlan.length ? statusClassNames.klar : statusClassNames.qa}>
              {thirtyDayDoneCount}/{thirtyDayPlan.length} klar
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Roadmap’ens første 30 dage som operatorliste. Hvert punkt er read-only og peger til det sted,
            hvor beviset eller beslutningen skal gennemgås. Den udfører ingen login-test, import, publicering,
            prisændring eller SEO-write.
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {thirtyDayPlan.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <StatusBadge status={item.status} />
                    <Badge variant="secondary">{item.owner}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.proof}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Næste: {item.next}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn punkt
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="decision-queue" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Beslutningskø før salg</h2>
        </div>
        <div className="grid gap-3">
          {commercialDecisionsQueue.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <StatusBadge status={item.status} />
                    <Badge variant="secondary">{item.owner}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.impact}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Beslutning: {item.decision}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={item.href}>
                    Åbn beslutning
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="decision-option-cards" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Beslutningsvalgkort</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={decisionOptionBlockers > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
              {decisionOptionBlockers} blokerende valg
            </Badge>
            <Badge variant="outline" className={statusClassNames.qa}>
              {decisionOptionReadyCount}/{commercialDecisionOptionCards.length} valg i QA
            </Badge>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
            Beslutningsvalgkort gør de åbne ledelsesvalg konkrete uden at vælge for dig:
            anbefalet håndtering, alternativer, udsættelsespris og beslutningsregel. Det er kun
            læsning og ændrer ikke produkter, priser, betaling, Supplier Bank, SEO eller tenants.
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {commercialDecisionOptionCards.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="secondary">{item.owner}</Badge>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.recommended}</p>
                <div className="space-y-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                  <div className="font-medium">Alternativer:</div>
                  {item.alternatives.map((alternative) => (
                    <p key={alternative}>{alternative}</p>
                  ))}
                </div>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Pris ved at vente: {item.deferCost}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-700 dark:text-slate-300">
                  Beslutningsregel: {item.decisionRule}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                  <Link to={item.href}>
                    Åbn valggrundlag
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="executive-actions" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Ledelsesblik: næste handling</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {executiveActions.map((action) => (
            <Card key={`${action.tenantName}-executive-action`}>
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">{action.tenantName}</div>
                    <h3 className="mt-1 text-lg font-semibold">{action.title}</h3>
                  </div>
                  <StatusBadge status={action.status} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{action.summary}</p>
                <Button asChild variant="outline" size="sm" className="mt-auto justify-between">
                  <Link to={action.href}>
                    {action.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="flow-blockers" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-xl font-semibold">Flow-blokeringer og QA</h2>
          </div>
          <Badge variant="outline" className={blockerCount > 0 ? statusClassNames.blokeret : statusClassNames.qa}>
            {blockerCount} blokerende
          </Badge>
        </div>
        <div className="grid gap-3">
          {flowIssues.length > 0 ? (
            flowIssues.map((issue) => (
              <Card key={`${issue.tenantName}-${issue.title}`}>
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{issue.tenantName}</Badge>
                      <StatusBadge status={issue.status} />
                      <h3 className="font-medium">{issue.title}</h3>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{issue.detail}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                    <Link to={issue.href}>
                      Åbn
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Ingen aktive flow-blokeringer fundet i de nuværende read-only signaler.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section id="proof-flow" className="scroll-mt-24 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Bevisflow pr. tenant</h2>
        </div>
        <section id="automated-proof-chain" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-600" />
              <h3 className="text-lg font-semibold">Automatiseret browserbevis</h3>
            </div>
            <Badge variant="outline" className={statusClassNames.klar}>
              {automatedProofChain.length}/{automatedProofChain.length} flows dækket
            </Badge>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 text-sm leading-6 text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
              <div>
                Den samlede proof-gate kontrollerer cockpit-bindingerne og kører derefter de tre ejede
                proof-flows på localhost med tenantkontekst, produktvalg, template/designer eller
                ordre/upload-handoff. Den ændrer ikke produkter, priser, ordrer, SEO eller Supplier Bank.
                Rapportversionen skriver kun til docs/COMMERCIAL_PROOF_LATEST.md, og release-gaten
                skriver docs/COMMERCIAL_RELEASE_LATEST.md, docs/COMMERCIAL_CHANGESET_LATEST.md og
                docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md, docs/COMMERCIAL_SUPABASE_LATEST.md og
                docs/COMMERCIAL_STAGED_PACKET_LATEST.md samt
                docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md og
                docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md og
                docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md og
                docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md. Derefter skriver den
                docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md som go/no-go beslutningsrapport og
                docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md som release-overdragelse med rollbacknote og
                docs/COMMERCIAL_RELEASE_PACKET_LATEST.md som åbne-først indeks for releasepakken.
                Rapporterne kan kontrolleres separat.
              </div>
              <div className="flex flex-col gap-2">
                <code className="w-fit rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  npm run check:commercial-release
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-proof
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-proof:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-proof-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-changeset
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-changeset:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-changeset-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-application-source:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-application-source-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-supabase:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-supabase-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-staged-packet
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-staged-packet:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-staged-packet-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-branch-freshness
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-branch-freshness:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-branch-freshness-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-upstream-reconciliation
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-upstream-reconciliation:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-upstream-reconciliation-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-owner-merge-readiness
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-owner-merge-readiness:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-owner-merge-readiness-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-owner-sequence
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-owner-sequence:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-owner-sequence-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-deploy-readiness
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-deploy-readiness:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-deploy-readiness-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-handoff
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-handoff:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-handoff-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-packet
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-packet:write
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-packet-report
                </code>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  npm run check:commercial-release-report
                </code>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {commercialReleaseArtifacts.map((artifact) => (
              <Card key={artifact.path}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-slate-600" />
                        {artifact.title}
                      </CardTitle>
                      <CardDescription>{artifact.description}</CardDescription>
                    </div>
                    <StatusBadge status={artifact.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={statusClassNames.klar}>Lokal bevisfil</Badge>
                    <Badge variant="secondary">Read-only</Badge>
                  </div>
                  <div className="space-y-2">
                    <code className="block rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                      {artifact.path}
                    </code>
                    <code className="block rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                      {artifact.command}
                    </code>
                  </div>
                  <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                    {artifact.verifies.map((proof) => (
                      <div key={proof} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{proof}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {automatedProofChain.map((item) => (
              <Card key={`${item.tenantName}-${item.product}-automated-proof`}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{item.tenantName}</CardTitle>
                      <CardDescription>{item.product}</CardDescription>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.proofType}</Badge>
                    <Badge variant="outline" className={statusClassNames.klar}>Browserproof</Badge>
                  </div>
                  <div className="rounded-md border bg-slate-50 p-3 text-xs text-muted-foreground dark:bg-slate-950">
                    {item.route}
                  </div>
                  <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                    {item.verifies.map((proof) => (
                      <div key={proof} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{proof}</span>
                      </div>
                    ))}
                  </div>
                  <Button asChild variant="ghost" size="sm" className="mt-auto h-8 justify-between px-0">
                    <Link to={item.href}>
                      Åbn proof-flow
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <div className="grid gap-4 xl:grid-cols-3">
          {proofFlowRows.map(({ tenant, steps }) => (
            <Card key={`${tenant.domain}-proof-flow`}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{tenant.name}</CardTitle>
                    <CardDescription>{tenant.firstProduct}</CardDescription>
                  </div>
                  <StatusBadge status={tenant.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {steps.map((step) => (
                  <div key={`${tenant.domain}-${step.label}`} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <StatusIcon status={step.status} />
                        <span className="font-medium">{step.label}</span>
                      </div>
                      <StatusBadge status={step.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
                    <Button asChild variant="ghost" size="sm" className="mt-2 h-8 px-0">
                      <Link to={step.href}>
                        Åbn trin
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Klar-til-demo beviser</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {evidenceRows.map(({ tenant, evidence }) => {
            const missingCount = evidence.filter((item) => item.status !== "klar").length;
            return (
              <Card key={`${tenant.domain}-evidence`}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{tenant.name}</CardTitle>
                      <CardDescription>
                        {missingCount === 0
                          ? "Alle beviser er fundet i de nuværende signaler."
                          : `${missingCount} beviser mangler eller kræver QA.`}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={missingCount === 0 ? statusClassNames.klar : statusClassNames.qa}>
                      {evidence.length - missingCount}/{evidence.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {evidence.map((item) => (
                    <div key={`${tenant.domain}-${item.label}`} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusIcon status={item.status} />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.proof}</p>
                      {item.status !== "klar" ? (
                        <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                          Mangler: {item.missing}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers3 className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Tenantpiloter</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {readinessRows.map((tenant) => (
            <Card key={tenant.domain}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{tenant.name}</CardTitle>
                    <CardDescription>{tenant.domain}</CardDescription>
                  </div>
                  <StatusBadge status={tenant.status} />
                </div>
                <p className="text-sm text-muted-foreground">{tenant.focus}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <ProgressLabel value={tenant.readiness} />
                  <Progress value={tenant.readiness} />
                </div>
                <div className="rounded-lg border bg-slate-50 p-3 text-sm dark:bg-slate-950">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Første bevisprodukt</div>
                  <div className="mt-1 font-medium">{tenant.firstProduct}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {tenant.signal?.firstProductPricingType
                      ? `${tenant.signal.firstProductPricingType} · ${describePriceHealth(tenant.signal)}`
                      : tenant.firstProductSlug
                        ? "Produkt/prisstatus hentes fra live data"
                        : "Første produkt er ikke valgt endnu"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Produkter</div>
                    <div className="font-semibold">{formatCount(tenant.signal?.productCount ?? null)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Publiceret</div>
                    <div className="font-semibold">{formatCount(tenant.signal?.publishedProductCount ?? null)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Templates</div>
                    <div className="font-semibold">{formatCount(tenant.signal?.activeTemplateCount ?? null)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Ordrer</div>
                    <div className="font-semibold">{formatCount(tenant.signal?.orderCount ?? null)}</div>
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <span className="text-muted-foreground">Pris-preview</span>
                    <span className="font-medium">{describePriceHealth(tenant.signal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <span className="text-muted-foreground">Designer-overdragelse</span>
                    <span className="font-medium">{describeDesignerHealth(tenant.signal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <span className="text-muted-foreground">Ordrespor for produkt</span>
                    <span className="font-medium">{formatCount(tenant.signal?.firstProductOrderCount ?? null)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <span className="text-muted-foreground">SEO-rækker</span>
                    <span className="font-medium">{formatCount(tenant.signal?.seoRows ?? null)}</span>
                  </div>
                </div>
                {tenant.signal?.error ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
                    {tenant.signal.error}
                  </div>
                ) : null}
                <div className="space-y-2">
                  {tenant.checkpoints.map((checkpoint) => (
                    <div key={checkpoint.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{checkpoint.label}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusIcon status={checkpoint.status} />
                        <span className="font-medium">{statusLabels[checkpoint.status]}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link to={tenant.storefrontPath}>Storefront</Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <Link to={tenant.adminPath}>Admin</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Platformsporer
            </CardTitle>
            <CardDescription>
              De seks spor der skal være synlige før systemet kan præsenteres som print-house platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {platformPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-600" />
                      <h3 className="font-medium">{pillar.title}</h3>
                    </div>
                    <StatusBadge status={pillar.status} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.summary}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Supplier Bank gate
            </CardTitle>
            <CardDescription>
              Seneste read-only rapportstatus fra 2026-07-07.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {supplierBankFacts.map((fact) => (
                <div key={fact.label} className="rounded-lg border p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">{fact.label}</div>
                  <div className="mt-1 text-xl font-semibold">{fact.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{fact.detail}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Supplier Bank er ikke færdig: Pixart rigids kræver eksplicit bank-only beslutning, og det ældre
              WMD target `wmd-folder-bank-891a5cf1` er publiceret.
            </div>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/admin/supplier-bank?force_domain=webprinter.dk">
                Åbn Supplier Bank
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Næste operationelle skridt</h2>
        </div>
        <div className="grid gap-3">
          {nextActions.map((action) => (
            <Card key={action.title}>
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{action.title}</h3>
                    <StatusBadge status={action.status} />
                    <Badge variant="secondary">{action.owner}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{action.description}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 justify-between">
                  <Link to={action.href}>
                    Åbn område
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

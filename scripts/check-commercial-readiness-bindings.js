#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const filePath = "src/pages/admin/CommercialReadiness.tsx";
const tenantProofFilePath = "scripts/check-tenant-proof-routes.mjs";
const commercialProofFilePath = "scripts/check-commercial-proof.mjs";
const commercialProofReportFilePath = "scripts/check-commercial-proof-report.mjs";
const commercialChangesetFilePath = "scripts/check-commercial-changeset.mjs";
const commercialApplicationSourceFilePath = "scripts/check-commercial-application-source.mjs";
const commercialSupabaseFilePath = "scripts/check-commercial-supabase.mjs";
const commercialStagedPacketFilePath = "scripts/check-commercial-staged-packet.mjs";
const commercialBranchFreshnessFilePath = "scripts/check-commercial-branch-freshness.mjs";
const commercialUpstreamReconciliationFilePath = "scripts/check-commercial-upstream-reconciliation.mjs";
const commercialOwnerMergeReadinessFilePath = "scripts/check-commercial-owner-merge-readiness.mjs";
const commercialReleaseOwnerSequenceFilePath = "scripts/check-commercial-release-owner-sequence.mjs";
const commercialDeployReadinessFilePath = "scripts/check-commercial-deploy-readiness.mjs";
const commercialReleaseHandoffFilePath = "scripts/check-commercial-release-handoff.mjs";
const commercialReleasePacketFilePath = "scripts/check-commercial-release-packet.mjs";
const commercialReleaseFilePath = "scripts/check-commercial-release.mjs";
const commercialReleaseReportFilePath = "scripts/check-commercial-release-report.mjs";
const packagePath = "package.json";
const documentationFilePaths = [
  "AI_CONTINUITY.md",
  "HANDOVER.md",
  ".agent/HANDOVER.md",
];
const componentMarker = "export default function CommercialReadiness()";
const declaration = "const commercialDecisionsQueue = useMemo(() => commercialDecisions, []);";
const binding = "commercialDecisionsQueue";
const dependentMarkers = [
  "() => getCommercialAutomationMap(",
  "() => getCommercialFocusItems(",
  "() => getCommercialPilotAcceptanceGate(",
  "() => getPaidPilotPackage(",
  "() => getProductionReleaseReadiness(",
  "() => getSupplierBankStagingRunbook(",
  "() => getCommercialDecisionOptionCards(",
  "{commercialDecisionsQueue.map((item) => (",
];
const requiredCommercialMarkers = [
  {
    label: "Webprinter aluminium pilot",
    markers: [
      'name: "Webprinter"',
      'firstProduct: "Aluminium"',
      'firstProductSlug: "aluminium"',
      'storefrontPath: "/produkt/aluminium?force_domain=webprinter.dk"',
    ],
  },
  {
    label: "Salgsmapper template pilot",
    markers: [
      'name: "Salgsmapper"',
      'firstProductSlug: "standard-sales-mapper-kopi-2"',
      'storefrontPath: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk"',
    ],
  },
  {
    label: "Onlinetryksager flyer pilot",
    markers: [
      'name: "Onlinetryksager"',
      'firstProduct: "Flyers"',
      'firstProductSlug: "flyer-demand"',
      'storefrontPath: "/produkt/flyer-demand?force_domain=www.onlinetryksager.dk"',
      'title: "Bekræft Flyers som første bevisprodukt for Onlinetryksager"',
    ],
  },
  {
    label: "Automated proof chain cockpit section",
    markers: [
      "const automatedProofChain",
      "const commercialReleaseArtifacts",
      'id="automated-proof-chain"',
      "Automatiseret browserbevis",
      "npm run check:commercial-release",
      "npm run check:commercial-proof",
      "npm run check:commercial-proof:write",
      "npm run check:commercial-proof-report",
      "npm run check:commercial-changeset",
      "npm run check:commercial-changeset:write",
      "npm run check:commercial-changeset-report",
      "npm run check:commercial-application-source:write",
      "npm run check:commercial-application-source-report",
      "npm run check:commercial-supabase:write",
      "npm run check:commercial-supabase-report",
      "npm run check:commercial-staged-packet",
      "npm run check:commercial-staged-packet:write",
      "npm run check:commercial-staged-packet-report",
      "npm run check:commercial-branch-freshness",
      "npm run check:commercial-branch-freshness:write",
      "npm run check:commercial-branch-freshness-report",
      "npm run check:commercial-upstream-reconciliation",
      "npm run check:commercial-upstream-reconciliation:write",
      "npm run check:commercial-upstream-reconciliation-report",
      "npm run check:commercial-owner-merge-readiness",
      "npm run check:commercial-owner-merge-readiness:write",
      "npm run check:commercial-owner-merge-readiness-report",
      "npm run check:commercial-release-owner-sequence",
      "npm run check:commercial-release-owner-sequence:write",
      "npm run check:commercial-release-owner-sequence-report",
      "npm run check:commercial-deploy-readiness",
      "npm run check:commercial-deploy-readiness:write",
      "npm run check:commercial-deploy-readiness-report",
      "npm run check:commercial-release-handoff",
      "npm run check:commercial-release-handoff:write",
      "npm run check:commercial-release-handoff-report",
      "npm run check:commercial-release-packet",
      "npm run check:commercial-release-packet:write",
      "npm run check:commercial-release-packet-report",
      "npm run check:commercial-release-report",
      "docs/COMMERCIAL_RELEASE_PACKET_LATEST.md",
      "docs/COMMERCIAL_PROOF_LATEST.md",
      "docs/COMMERCIAL_CHANGESET_LATEST.md",
      "docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md",
      "docs/COMMERCIAL_SUPABASE_LATEST.md",
      "docs/COMMERCIAL_STAGED_PACKET_LATEST.md",
      "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md",
      "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md",
      "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md",
      "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md",
      "docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md",
      "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
      "docs/COMMERCIAL_RELEASE_LATEST.md",
      "Release packet index",
      "Detaljeret proof-rapport",
      "Release summary",
      "Ændringssæt til review",
      "Lokal bevisfil",
      "Browserproof",
    ],
  },
];
const requiredPackageScripts = {
  "check:commercial-readiness": "node scripts/check-commercial-readiness-bindings.js",
  "check:tenant-proof": "node scripts/check-tenant-proof-routes.mjs",
  "check:commercial-proof": "node scripts/check-commercial-proof.mjs",
  "check:commercial-proof:write": "node scripts/check-commercial-proof.mjs --write-report",
  "check:commercial-proof-report": "node scripts/check-commercial-proof-report.mjs",
  "check:commercial-changeset": "node scripts/check-commercial-changeset.mjs",
  "check:commercial-changeset:write": "node scripts/check-commercial-changeset.mjs --write-report --verify-report",
  "check:commercial-changeset-report": "node scripts/check-commercial-changeset.mjs --verify-report",
  "check:commercial-application-source": "node scripts/check-commercial-application-source.mjs",
  "check:commercial-application-source:write": "node scripts/check-commercial-application-source.mjs --write-report --verify-report",
  "check:commercial-application-source-report": "node scripts/check-commercial-application-source.mjs --verify-report",
  "check:commercial-supabase": "node scripts/check-commercial-supabase.mjs",
  "check:commercial-supabase:write": "node scripts/check-commercial-supabase.mjs --write-report --verify-report",
  "check:commercial-supabase-report": "node scripts/check-commercial-supabase.mjs --verify-report",
  "check:commercial-staged-packet": "node scripts/check-commercial-staged-packet.mjs",
  "check:commercial-staged-packet:write": "node scripts/check-commercial-staged-packet.mjs --write-report --verify-report",
  "check:commercial-staged-packet-report": "node scripts/check-commercial-staged-packet.mjs --verify-report",
  "check:commercial-branch-freshness": "node scripts/check-commercial-branch-freshness.mjs",
  "check:commercial-branch-freshness:write": "node scripts/check-commercial-branch-freshness.mjs --write-report --verify-report",
  "check:commercial-branch-freshness-report": "node scripts/check-commercial-branch-freshness.mjs --verify-report",
  "check:commercial-upstream-reconciliation": "node scripts/check-commercial-upstream-reconciliation.mjs",
  "check:commercial-upstream-reconciliation:write": "node scripts/check-commercial-upstream-reconciliation.mjs --write-report --verify-report",
  "check:commercial-upstream-reconciliation-report": "node scripts/check-commercial-upstream-reconciliation.mjs --verify-report",
  "check:commercial-owner-merge-readiness": "node scripts/check-commercial-owner-merge-readiness.mjs",
  "check:commercial-owner-merge-readiness:write": "node scripts/check-commercial-owner-merge-readiness.mjs --write-report --verify-report",
  "check:commercial-owner-merge-readiness-report": "node scripts/check-commercial-owner-merge-readiness.mjs --verify-report",
  "check:commercial-release-owner-sequence": "node scripts/check-commercial-release-owner-sequence.mjs",
  "check:commercial-release-owner-sequence:write": "node scripts/check-commercial-release-owner-sequence.mjs --write-report --verify-report",
  "check:commercial-release-owner-sequence-report": "node scripts/check-commercial-release-owner-sequence.mjs --verify-report",
  "check:commercial-deploy-readiness": "node scripts/check-commercial-deploy-readiness.mjs",
  "check:commercial-deploy-readiness:write": "node scripts/check-commercial-deploy-readiness.mjs --write-report --verify-report",
  "check:commercial-deploy-readiness-report": "node scripts/check-commercial-deploy-readiness.mjs --verify-report",
  "check:commercial-deploy-readiness:strict": "node scripts/check-commercial-deploy-readiness.mjs --strict",
  "check:commercial-release-handoff": "node scripts/check-commercial-release-handoff.mjs",
  "check:commercial-release-handoff:write": "node scripts/check-commercial-release-handoff.mjs --write-report --verify-report",
  "check:commercial-release-handoff-report": "node scripts/check-commercial-release-handoff.mjs --verify-report",
  "check:commercial-release-packet": "node scripts/check-commercial-release-packet.mjs",
  "check:commercial-release-packet:write": "node scripts/check-commercial-release-packet.mjs --write-report --verify-report",
  "check:commercial-release-packet-report": "node scripts/check-commercial-release-packet.mjs --verify-report",
  "check:commercial-release": "node scripts/check-commercial-release.mjs",
  "check:commercial-release-report": "node scripts/check-commercial-release-report.mjs",
};
const forbiddenCommercialMarkers = [
  "Prioriteret standardprodukt vælges",
  "Vælg første bevisprodukt for Onlinetryksager",
  "Onlinetryksager kan ikke indgå som fuld pilot før et konkret produktflow er valgt.",
];
const requiredTenantProofMarkers = [
  {
    label: "Transient Supabase browser proof retry",
    markers: [
      "TRANSIENT_SUPABASE_RETRY_DELAY_MS",
      "checkHtmlRouteWithRetry",
      "isTransientSupabaseTransportFailure",
      "supabase transport is temporarily paused",
      "retry after Supabase transport pause",
    ],
  },
  {
    label: "Webprinter aluminium browser proof",
    markers: [
      'name: "Webprinter aluminium"',
      'path: "/produkt/aluminium?force_domain=webprinter.dk"',
      'productSlug: "aluminium"',
      "orderWorkflow:",
    ],
  },
  {
    label: "Banner Builder Pro site package browser proof",
    markers: [
      'name: "Banner Builder Pro site package preview"',
      'path: "/preview-shop?preview_mode=1&tenantId=00000000-0000-0000-0000-000000000000&siteId=banner-builder-pro&sitePreview=1&page=%2F"',
      "sitePreviewWorkflow:",
      'iframeUrlIncludes: "/site-previews/banner-builder-pro/index.html"',
      "site package iframe proof",
    ],
  },
  {
    label: "Salgsmapper template browser proof",
    markers: [
      'name: "Salgsmapper standard folder"',
      'path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk"',
      "templateWorkflow:",
      'downloadHrefPattern: "\\\\.pdf(?:$|[?#])"',
    ],
  },
  {
    label: "Salgsmapper category landing browser proof",
    markers: [
      'name: "Salgsmapper category landing"',
      'path: "/produkter?force_domain=www.salgsmapper.dk"',
      "categoryWorkflow:",
      'linkHrefIncludes: "category=salgsmapper"',
      "category landing drilldown",
    ],
  },
  {
    label: "Onlinetryksager category landing browser proof",
    markers: [
      'name: "Onlinetryksager category landing"',
      'path: "/produkter?force_domain=www.onlinetryksager.dk"',
      "categoryWorkflow:",
      'linkHrefIncludes: "category=tryksager"',
      "category landing drilldown",
    ],
  },
  {
    label: "Onlinetryksager flyer browser proof",
    markers: [
      'name: "Onlinetryksager flyer"',
      'path: "/produkt/flyer-demand?force_domain=www.onlinetryksager.dk"',
      'productSlug: "flyer-demand"',
      "orderWorkflow:",
    ],
  },
];
const requiredCommercialProofMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_PROOF_LATEST.md\"",
  "--write-report",
  "scripts/check-commercial-readiness-bindings.js",
  "scripts/check-tenant-proof-routes.mjs",
  "Commercial proof gate passed.",
];
const requiredCommercialProofReportMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_PROOF_LATEST.md\"",
  "Status: 12/12 tenant proof checks passed",
  "This is a local, read-only proof artifact.",
  "Commercial proof report check passed:",
  "Webprinter aluminium",
  "Banner Builder Pro site package preview",
  "Salgsmapper category landing",
  "Salgsmapper PDF template",
  "Onlinetryksager category landing",
  "Onlinetryksager flyer",
];
const requiredCommercialChangesetMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_CHANGESET_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Changeset Report",
  "Review Summary",
  "Bucket Counts",
  "Suggested Review Order",
  "Bucket Verification Commands",
  "First Review Packet: Commercial Proof-Chain",
  "Packet entries:",
  "Hold outside first packet:",
  "Candidate Files",
  "Hold Outside First Packet",
  "Second Review Packet: Application Source",
  "Runtime Risk Groups",
  "Application Candidate Files",
  "pricing/product flow",
  "designer/pdf/template",
  "tenant storefront/SEO/design",
  "Suggested staging command preview:",
  "Suggested staged-file validation:",
  "Suggested unstaging rollback:",
  "git add --",
  "git diff --cached --name-only --",
  "git restore --staged --",
  "INCLUDE",
  "Suggested verification",
  "Review Gates",
  "Files By Bucket",
  "Dirty entries:",
  "npm run check:commercial-release",
  "npm run check:commercial-application-source:write",
  "npm run check:commercial-supabase:write",
  "npm run check:supabase-grants",
  "npm run check:supabase-functions",
  "npm run build",
  "Commercial changeset report check passed:",
  "git status",
];
const requiredCommercialApplicationSourceMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Application Source Report",
  "This is a local, read-only application-source review artifact.",
  "Application source entries:",
  "Expanded runtime files:",
  "Guardrail Checks",
  "Core pricing engine untouched",
  "POD admin/runtime untouched in application bucket",
  "Protected designer/PDF surface visible",
  "Untracked runtime files visible",
  "Runtime Risk Groups",
  "Required Verification",
  "Application Candidate Files",
  "check:commercial-application-source:write",
  "Commercial application-source report check passed:",
];
const requiredCommercialSupabaseMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_SUPABASE_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Supabase Report",
  "This is a local, read-only Supabase review artifact.",
  "Supabase entries:",
  "Required Checks",
  "Supabase Data API grants",
  "Supabase function exposure",
  "Supabase Risk Groups",
  "Required Verification",
  "npm run check:supabase-grants",
  "npm run check:supabase-functions",
  "pricing-read",
  "product-detail-read",
  "Commercial Supabase report check passed:",
];
const requiredCommercialStagedPacketMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_STAGED_PACKET_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Staged Packet Report",
  "This is a local, read-only staged-packet artifact.",
  "Git staged command: `git diff --cached --name-status`",
  "Forbidden staged files:",
  "Deployable Supabase staged entries:",
  "Held outside staged packet:",
  "Staged Bucket Counts",
  "Guardrail Checks",
  "Core pricing/POD guardrails",
  "Supabase held outside staged packet",
  "supabase/.temp/cli-latest",
  "supabase/config 2.toml",
  "supabase/functions/test-env/index 2.ts",
  "git diff --cached --check",
  "Commercial staged packet check passed:",
];
const requiredCommercialBranchFreshnessMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Branch Freshness Report",
  "This is a local, read-only branch freshness artifact.",
  "Git upstream command: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`",
  "Remote Delta Summary",
  "Remote commits:",
  "Remote changed files:",
  "Overlaps with staged packet:",
  "Staged Overlap",
  "Required Owner Review",
  "npm run check:commercial-branch-freshness:write",
  "Commercial branch freshness report check completed:",
];
const requiredCommercialUpstreamReconciliationMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Upstream Reconciliation Report",
  "This is a local, read-only upstream reconciliation artifact.",
  "Reconciliation Summary",
  "Exact overlaps:",
  "Represented overlaps:",
  "Superseded overlaps:",
  "Unresolved overlaps:",
  "Remote-only files:",
  "Overlap Reconciliation",
  "Required Owner Review",
  "npm run check:commercial-upstream-reconciliation:write",
  "Commercial upstream reconciliation report check completed:",
];
const requiredCommercialOwnerMergeReadinessMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md\"",
  "UPSTREAM_RECONCILIATION_REPORT_PATH = \"docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md\"",
  "Temporary index simulation: `git read-tree <upstream>` + `git update-index --cacheinfo` + `git write-tree`",
  "--write-report",
  "--verify-report",
  "# Commercial Owner Merge Readiness Report",
  "This is a local, read-only owner merge-readiness artifact.",
  "Merge Simulation Summary",
  "Merge simulation:",
  "Temporary merged tree:",
  "Staged packet overlay on upstream",
  "Owner merge/rebase still required",
  "npm run check:commercial-owner-merge-readiness:write",
  "Commercial owner merge-readiness report check completed:",
];
const requiredCommercialReleaseOwnerSequenceMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md\"",
  "OWNER_MERGE_READINESS_REPORT_PATH = \"docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Release Owner Sequence Report",
  "This is a local, read-only release-owner sequence artifact.",
  "Sequence Summary",
  "Owner Sequence",
  "Freshen the branch while preserving the staged packet.",
  "Commit only the reviewed staged packet.",
  "Stop Rules",
  "Supabase Scope",
  "npm run check:commercial-release-owner-sequence:write",
  "Commercial release-owner sequence report check completed:",
];
const requiredCommercialDeployReadinessMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md\"",
  "RELEASE_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_LATEST.md\"",
  "STAGED_PACKET_REPORT_PATH = \"docs/COMMERCIAL_STAGED_PACKET_LATEST.md\"",
  "BRANCH_FRESHNESS_REPORT_PATH = \"docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md\"",
  "UPSTREAM_RECONCILIATION_REPORT_PATH = \"docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md\"",
  "OWNER_MERGE_READINESS_REPORT_PATH = \"docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md\"",
  "RELEASE_OWNER_SEQUENCE_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "--strict",
  "# Commercial Deploy Readiness Report",
  "This is a local, read-only deploy-readiness artifact.",
  "Deploy readiness:",
  "Release proof",
  "Staged packet safety",
  "Branch freshness report",
  "Upstream reconciliation report",
  "Owner merge-readiness report",
  "Release-owner sequence report",
  "Branch freshness",
  "Unstaged worktree outside packet",
  "Held high-risk local artifacts",
  "Deployable Supabase scope",
  "Push/deploy ownership",
  "npm run check:commercial-deploy-readiness:write",
  "Commercial deploy readiness report check completed:",
];
const requiredCommercialReleaseHandoffMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md\"",
  "RELEASE_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_LATEST.md\"",
  "DEPLOY_READINESS_REPORT_PATH = \"docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md\"",
  "STAGED_PACKET_REPORT_PATH = \"docs/COMMERCIAL_STAGED_PACKET_LATEST.md\"",
  "BRANCH_FRESHNESS_REPORT_PATH = \"docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md\"",
  "UPSTREAM_RECONCILIATION_REPORT_PATH = \"docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md\"",
  "OWNER_MERGE_READINESS_REPORT_PATH = \"docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md\"",
  "RELEASE_OWNER_SEQUENCE_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Release Handoff Report",
  "This is a local, read-only release-handoff artifact.",
  "Handoff Summary",
  "Branch freshness status:",
  "Branch staged overlap count:",
  "Upstream reconciliation status:",
  "Unresolved upstream overlaps:",
  "Owner merge-readiness status:",
  "Owner merge simulation:",
  "Release-owner sequence status:",
  "Release-owner sequence usable:",
  "Suggested Commit",
  "Required Owner Decisions",
  "Supabase Deploy Scope",
  "Rollback Note Template",
  "Operator Sequence",
  "chore: add commercial readiness proof gates",
  "npm run check:commercial-release-handoff:write",
  "npm run check:commercial-owner-merge-readiness:write",
  "npm run check:commercial-release-owner-sequence:write",
  "Commercial release handoff report check completed:",
];
const requiredCommercialReleasePacketMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_PACKET_LATEST.md\"",
  "--write-report",
  "--verify-report",
  "# Commercial Release Packet Index",
  "This is a local, read-only release packet index artifact.",
  "Executive Snapshot",
  "Report Index",
  "Current Holds",
  "Owner Stop Rules",
  "Release proof:",
  "Tenant browser proof:",
  "Staged packet:",
  "Owner merge simulation:",
  "Deploy readiness:",
  "docs/COMMERCIAL_RELEASE_LATEST.md",
  "docs/COMMERCIAL_PROOF_LATEST.md",
  "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
  "npm run check:commercial-release-packet:write",
  "npm run check:commercial-release-packet-report",
  "Commercial release packet index check completed:",
];
const requiredCommercialReleaseMarkers = [
  "DEFAULT_CHANGESET_REPORT_PATH = \"docs/COMMERCIAL_CHANGESET_LATEST.md\"",
  "DEFAULT_APPLICATION_SOURCE_REPORT_PATH = \"docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md\"",
  "DEFAULT_SUPABASE_REPORT_PATH = \"docs/COMMERCIAL_SUPABASE_LATEST.md\"",
  "DEFAULT_STAGED_PACKET_REPORT_PATH = \"docs/COMMERCIAL_STAGED_PACKET_LATEST.md\"",
  "DEFAULT_BRANCH_FRESHNESS_REPORT_PATH = \"docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md\"",
  "DEFAULT_UPSTREAM_RECONCILIATION_REPORT_PATH = \"docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md\"",
  "DEFAULT_OWNER_MERGE_READINESS_REPORT_PATH = \"docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md\"",
  "DEFAULT_RELEASE_OWNER_SEQUENCE_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md\"",
  "DEFAULT_DEPLOY_READINESS_REPORT_PATH = \"docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md\"",
  "DEFAULT_RELEASE_HANDOFF_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md\"",
  "DEFAULT_RELEASE_PACKET_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_PACKET_LATEST.md\"",
  "DEFAULT_RELEASE_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_LATEST.md\"",
  "Commercial proof gate with report",
  "Commercial proof report verifier",
  "Commercial changeset report",
  "Commercial application-source report",
  "Commercial Supabase report",
  "Commercial staged packet report",
  "Commercial branch freshness report",
  "Commercial upstream reconciliation report",
  "Commercial owner merge-readiness report",
  "Commercial release-owner sequence report",
  "Commercial deploy readiness report",
  "Commercial release handoff report",
  "Commercial release packet index",
  "Commercial release report verifier",
  "Production build",
  "node_modules/vite/bin/vite.js",
  "Wrote commercial release report:",
  "Commercial release gate passed.",
  "# Commercial Release Report",
  "Changeset report:",
  "Application source report:",
  "Supabase report:",
  "Staged packet report:",
  "Branch freshness report:",
  "Upstream reconciliation report:",
  "Owner merge-readiness report:",
  "Release owner sequence report:",
  "Deploy readiness report:",
  "Release handoff report:",
  "release-packet-report-path",
  "Status: PASSED",
  "## Operator View",
  "## Repository State",
  "## Post-Release Decision Reports",
  "Git status command: `git status --short --branch`",
  "Dirty entries:",
  "readRepositoryState",
  "runQuietCommand",
  "Primary command: `npm run check:commercial-release`",
  "scripts/check-commercial-proof.mjs",
  "scripts/check-commercial-proof-report.mjs",
  "scripts/check-commercial-changeset.mjs",
  "scripts/check-commercial-application-source.mjs",
  "scripts/check-commercial-supabase.mjs",
  "scripts/check-commercial-staged-packet.mjs",
  "scripts/check-commercial-branch-freshness.mjs",
  "scripts/check-commercial-upstream-reconciliation.mjs",
  "scripts/check-commercial-owner-merge-readiness.mjs",
  "scripts/check-commercial-release-owner-sequence.mjs",
  "scripts/check-commercial-deploy-readiness.mjs",
  "scripts/check-commercial-release-handoff.mjs",
  "scripts/check-commercial-release-packet.mjs",
  "scripts/check-commercial-release-report.mjs",
];
const requiredCommercialReleaseReportMarkers = [
  "DEFAULT_REPORT_PATH = \"docs/COMMERCIAL_RELEASE_LATEST.md\"",
  "Status: PASSED",
  "This is a local, read-only release artifact.",
  "Changeset report: docs/COMMERCIAL_CHANGESET_LATEST.md",
  "Application source report: docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md",
  "Supabase report: docs/COMMERCIAL_SUPABASE_LATEST.md",
  "Staged packet report: docs/COMMERCIAL_STAGED_PACKET_LATEST.md",
  "Branch freshness report: docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md",
  "Upstream reconciliation report: docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md",
  "Owner merge-readiness report: docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md",
  "Release owner sequence report: docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md",
  "Deploy readiness report: docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md",
  "Release handoff report: docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
  "## Operator View",
  "## Repository State",
  "## Post-Release Decision Reports",
  "Git status command: `git status --short --branch`",
  "Dirty entries:",
  "Status lines shown:",
  "/admin/commercial-readiness?force_domain=webprinter.dk#automated-proof-chain",
  "Primary command: `npm run check:commercial-release`",
  "Changeset report verifier: `npm run check:commercial-changeset-report`",
  "Application source report verifier: `npm run check:commercial-application-source-report`",
  "Supabase report verifier: `npm run check:commercial-supabase-report`",
  "Staged packet report verifier: `npm run check:commercial-staged-packet-report`",
  "Branch freshness report verifier: `npm run check:commercial-branch-freshness-report`",
  "Upstream reconciliation report verifier: `npm run check:commercial-upstream-reconciliation-report`",
  "Owner merge-readiness report verifier: `npm run check:commercial-owner-merge-readiness-report`",
  "Release owner sequence report verifier: `npm run check:commercial-release-owner-sequence-report`",
  "Deploy readiness report verifier: `npm run check:commercial-deploy-readiness-report`",
  "Release handoff report verifier: `npm run check:commercial-release-handoff-report`",
  "Commercial release report check passed:",
  "Commercial proof gate with report",
  "Commercial proof report verifier",
  "Commercial changeset report",
  "Commercial application-source report",
  "Commercial Supabase report",
  "Commercial staged packet report",
  "Commercial branch freshness report",
  "Commercial upstream reconciliation report",
  "Commercial owner merge-readiness report",
  "Commercial release-owner sequence report",
  "Commercial deploy readiness report",
  "Commercial release handoff report",
  "Production build",
];
const requiredDocumentationMarkers = [
  "npm run check:commercial-release",
  "npm run check:commercial-release-report",
  "npm run check:commercial-changeset",
  "npm run check:commercial-changeset:write",
  "npm run check:commercial-changeset-report",
  "npm run check:commercial-application-source:write",
  "npm run check:commercial-application-source-report",
  "npm run check:commercial-supabase:write",
  "npm run check:commercial-supabase-report",
  "npm run check:commercial-staged-packet",
  "npm run check:commercial-staged-packet:write",
  "npm run check:commercial-staged-packet-report",
  "npm run check:commercial-branch-freshness",
  "npm run check:commercial-branch-freshness:write",
  "npm run check:commercial-branch-freshness-report",
  "npm run check:commercial-upstream-reconciliation",
  "npm run check:commercial-upstream-reconciliation:write",
  "npm run check:commercial-upstream-reconciliation-report",
  "npm run check:commercial-owner-merge-readiness",
  "npm run check:commercial-owner-merge-readiness:write",
  "npm run check:commercial-owner-merge-readiness-report",
  "npm run check:commercial-release-owner-sequence",
  "npm run check:commercial-release-owner-sequence:write",
  "npm run check:commercial-release-owner-sequence-report",
  "npm run check:commercial-deploy-readiness",
  "npm run check:commercial-deploy-readiness:write",
  "npm run check:commercial-deploy-readiness-report",
  "npm run check:commercial-release-handoff",
  "npm run check:commercial-release-handoff:write",
  "npm run check:commercial-release-handoff-report",
  "npm run check:commercial-release-packet",
  "npm run check:commercial-release-packet:write",
  "npm run check:commercial-release-packet-report",
  "npm run check:commercial-proof",
  "npm run check:commercial-proof:write",
  "npm run check:commercial-proof-report",
  "docs/COMMERCIAL_RELEASE_PACKET_LATEST.md",
  "docs/COMMERCIAL_PROOF_LATEST.md",
  "docs/COMMERCIAL_CHANGESET_LATEST.md",
  "docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md",
  "docs/COMMERCIAL_SUPABASE_LATEST.md",
  "docs/COMMERCIAL_STAGED_PACKET_LATEST.md",
  "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md",
  "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md",
  "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md",
  "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md",
  "docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md",
  "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
  "docs/COMMERCIAL_RELEASE_LATEST.md",
  "git status --short --branch",
  "Automatiseret browserbevis",
  "Webprinter Aluminium",
  "Banner Builder Pro",
  "Salgsmapper PDF",
  "Onlinetryksager Flyers",
];

const content = await readFile(filePath, "utf8");
const tenantProofContent = await readFile(tenantProofFilePath, "utf8");
const commercialProofContent = await readFile(commercialProofFilePath, "utf8");
const commercialProofReportContent = await readFile(commercialProofReportFilePath, "utf8");
const commercialChangesetContent = await readFile(commercialChangesetFilePath, "utf8");
const commercialApplicationSourceContent = await readFile(commercialApplicationSourceFilePath, "utf8");
const commercialSupabaseContent = await readFile(commercialSupabaseFilePath, "utf8");
const commercialStagedPacketContent = await readFile(commercialStagedPacketFilePath, "utf8");
const commercialBranchFreshnessContent = await readFile(commercialBranchFreshnessFilePath, "utf8");
const commercialUpstreamReconciliationContent = await readFile(commercialUpstreamReconciliationFilePath, "utf8");
const commercialOwnerMergeReadinessContent = await readFile(commercialOwnerMergeReadinessFilePath, "utf8");
const commercialReleaseOwnerSequenceContent = await readFile(commercialReleaseOwnerSequenceFilePath, "utf8");
const commercialDeployReadinessContent = await readFile(commercialDeployReadinessFilePath, "utf8");
const commercialReleaseHandoffContent = await readFile(commercialReleaseHandoffFilePath, "utf8");
const commercialReleasePacketContent = await readFile(commercialReleasePacketFilePath, "utf8");
const commercialReleaseContent = await readFile(commercialReleaseFilePath, "utf8");
const commercialReleaseReportContent = await readFile(commercialReleaseReportFilePath, "utf8");
const packageContent = await readFile(packagePath, "utf8");
const documentationContents = await Promise.all(
  documentationFilePaths.map(async (documentationPath) => ({
    path: documentationPath,
    content: await readFile(documentationPath, "utf8"),
  })),
);
const componentIndex = content.indexOf(componentMarker);
const problems = [];
let packageJson;

try {
  packageJson = JSON.parse(packageContent);
} catch (error) {
  problems.push(`Could not parse ${packagePath}: ${error instanceof Error ? error.message : String(error)}`);
}

if (componentIndex === -1) {
  problems.push(`Missing component marker: ${componentMarker}`);
}

const declarationIndex = componentIndex >= 0
  ? content.indexOf(declaration, componentIndex)
  : -1;

if (declarationIndex === -1) {
  problems.push(`Missing declaration: ${declaration}`);
} else {
  const componentBeforeDeclaration = content.slice(componentIndex, declarationIndex);

  if (componentBeforeDeclaration.includes(binding)) {
    problems.push(`${binding} is referenced before it is declared inside CommercialReadiness.`);
  }

  for (const marker of dependentMarkers) {
    const markerIndex = content.indexOf(marker, componentIndex);
    if (markerIndex === -1) {
      problems.push(`Missing dependent marker: ${marker}`);
    } else if (markerIndex < declarationIndex) {
      problems.push(`${marker} appears before ${binding} is declared.`);
    }
  }
}

for (const group of requiredCommercialMarkers) {
  for (const marker of group.markers) {
    if (!content.includes(marker)) {
      problems.push(`Missing ${group.label} marker in ${filePath}: ${marker}`);
    }
  }
}

for (const marker of forbiddenCommercialMarkers) {
  if (content.includes(marker)) {
    problems.push(`Stale commercial readiness marker still present in ${filePath}: ${marker}`);
  }
}

for (const group of requiredTenantProofMarkers) {
  for (const marker of group.markers) {
    if (!tenantProofContent.includes(marker)) {
      problems.push(`Missing ${group.label} marker in ${tenantProofFilePath}: ${marker}`);
    }
  }
}

for (const marker of requiredCommercialProofMarkers) {
  if (!commercialProofContent.includes(marker)) {
    problems.push(`Missing commercial proof runner marker in ${commercialProofFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialProofReportMarkers) {
  if (!commercialProofReportContent.includes(marker)) {
    problems.push(`Missing commercial proof report verifier marker in ${commercialProofReportFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialChangesetMarkers) {
  if (!commercialChangesetContent.includes(marker)) {
    problems.push(`Missing commercial changeset marker in ${commercialChangesetFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialApplicationSourceMarkers) {
  if (!commercialApplicationSourceContent.includes(marker)) {
    problems.push(`Missing commercial application-source marker in ${commercialApplicationSourceFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialSupabaseMarkers) {
  if (!commercialSupabaseContent.includes(marker)) {
    problems.push(`Missing commercial Supabase marker in ${commercialSupabaseFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialStagedPacketMarkers) {
  if (!commercialStagedPacketContent.includes(marker)) {
    problems.push(`Missing commercial staged packet marker in ${commercialStagedPacketFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialBranchFreshnessMarkers) {
  if (!commercialBranchFreshnessContent.includes(marker)) {
    problems.push(`Missing commercial branch freshness marker in ${commercialBranchFreshnessFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialUpstreamReconciliationMarkers) {
  if (!commercialUpstreamReconciliationContent.includes(marker)) {
    problems.push(`Missing commercial upstream reconciliation marker in ${commercialUpstreamReconciliationFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialOwnerMergeReadinessMarkers) {
  if (!commercialOwnerMergeReadinessContent.includes(marker)) {
    problems.push(`Missing commercial owner merge-readiness marker in ${commercialOwnerMergeReadinessFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialReleaseOwnerSequenceMarkers) {
  if (!commercialReleaseOwnerSequenceContent.includes(marker)) {
    problems.push(`Missing commercial release-owner sequence marker in ${commercialReleaseOwnerSequenceFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialDeployReadinessMarkers) {
  if (!commercialDeployReadinessContent.includes(marker)) {
    problems.push(`Missing commercial deploy-readiness marker in ${commercialDeployReadinessFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialReleaseHandoffMarkers) {
  if (!commercialReleaseHandoffContent.includes(marker)) {
    problems.push(`Missing commercial release handoff marker in ${commercialReleaseHandoffFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialReleasePacketMarkers) {
  if (!commercialReleasePacketContent.includes(marker)) {
    problems.push(`Missing commercial release packet marker in ${commercialReleasePacketFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialReleaseMarkers) {
  if (!commercialReleaseContent.includes(marker)) {
    problems.push(`Missing commercial release gate marker in ${commercialReleaseFilePath}: ${marker}`);
  }
}

for (const marker of requiredCommercialReleaseReportMarkers) {
  if (!commercialReleaseReportContent.includes(marker)) {
    problems.push(`Missing commercial release report verifier marker in ${commercialReleaseReportFilePath}: ${marker}`);
  }
}

for (const documentation of documentationContents) {
  for (const marker of requiredDocumentationMarkers) {
    if (!documentation.content.includes(marker)) {
      problems.push(`Missing commercial proof documentation marker in ${documentation.path}: ${marker}`);
    }
  }
}

if (packageJson) {
  for (const [scriptName, scriptCommand] of Object.entries(requiredPackageScripts)) {
    if (packageJson.scripts?.[scriptName] !== scriptCommand) {
      problems.push(`Missing or changed npm script in ${packagePath}: "${scriptName}": "${scriptCommand}"`);
    }
  }
}

if (problems.length) {
  console.error("Commercial readiness binding check failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Commercial readiness binding and proof alignment check passed.");

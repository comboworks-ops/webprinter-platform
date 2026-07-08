#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const filePath = "src/pages/admin/CommercialReadiness.tsx";
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

const content = await readFile(filePath, "utf8");
const componentIndex = content.indexOf(componentMarker);
const problems = [];

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

if (problems.length) {
  console.error("Commercial readiness binding check failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Commercial readiness binding check passed.");

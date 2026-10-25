export function PrintTermsGuidance({ labels }: { labels: string[] }) {
  const text = labels.join(' ');
  const hasPrintSides = /4\s*[+/]\s*[04]/.test(text);
  const hasLamination = /ka[ch]+ering|kashering|kasjering|laminer/i.test(text);
  if (!hasPrintSides && !hasLamination) return null;
  return <details className="rounded-md border p-3 text-sm leading-relaxed">
    <summary className="cursor-pointer font-medium">Hvad betyder {hasPrintSides ? hasLamination ? '4+0, 4+4 og kachering' : '4+0 og 4+4' : 'kachering'}?</summary>
    <div className="mt-2 space-y-2 text-muted-foreground">
      {hasPrintSides && <>
        <p><strong>4+0:</strong> Fuldfarvetryk (CMYK) på én side. Den anden side er uden tryk.</p>
        <p><strong>4+4:</strong> Fuldfarvetryk (CMYK) på begge sider. Tallene angiver trykfarver på hver side, ikke antal sider i filen. For en mappe er det yderside og inderside – følg den tilhørende skabelon.</p>
      </>}
      {hasLamination && <p><strong>Kachering (laminering):</strong> En tynd film på papiret, som beskytter overfladen. Mat giver en afdæmpet overflade, blank giver glans, og softfeel føles blød. Følg produktets beskrivelse af, hvilke sider der kacheres. Kachering er en overfladebehandling; 4+0 og 4+4 angiver, hvor der trykkes.</p>}
    </div>
  </details>;
}

export function ArtworkChoiceGuidance({ canDesign, hasTemplate, canDownload, designReady, reserveChoices = false }: {
  canDesign: boolean; hasTemplate: boolean; canDownload: boolean; designReady: boolean; reserveChoices?: boolean;
}) {
  return <div className="price-panel-option min-w-0 rounded-md border p-3 text-sm leading-relaxed" aria-label="Sådan leverer du dit design">
    <p className="font-medium">{designReady ? 'Dit design er klar' : 'Sådan leverer du dit design'}</p>
    <div className="price-panel-muted mt-1 space-y-2">
      <p><strong>Har du en færdig trykfil?</strong> Vælg upload-knappen for at gå til filupload og kontrol af din fil før bestilling.</p>
      {(canDesign || reserveChoices) && <p style={!canDesign ? { visibility: 'hidden' } : undefined} aria-hidden={!canDesign || undefined}><strong>{hasTemplate || reserveChoices ? 'Vil du designe i skabelonen?' : 'Vil du lave dit design her?'}</strong> Vælg design-knappen for at åbne {hasTemplate || reserveChoices ? 'skabelonen til dit aktuelle produktvalg' : 'designeren med dit valgte format'}. Du vender tilbage med dit design til bestillingen.</p>}
      {(canDownload || reserveChoices) && <p style={!canDownload ? { visibility: 'hidden' } : undefined} aria-hidden={!canDownload || undefined}><strong>Arbejder du i dit eget program?</strong> Download skabelonen, følg dens mål og hjælpelinjer, og upload den færdige trykfil bagefter. Skabelonen alene er ikke en færdig trykfil.</p>}
      {designReady && <p>Du kan åbne dit design igen og kontrollere det, før du fortsætter.</p>}
    </div>
  </div>;
}

/**
 * Preflight error translation layer.
 *
 * The server-side preflight edge function (pod2-pdf-preflight) proxies a
 * commercial PDF preflight engine whose error strings are technical English.
 * We never show those to customers — everything is translated to short,
 * friendly Danish through this module before rendering.
 *
 * Two-stage matching:
 *   1. Exact / regex patterns for known error signatures.
 *   2. Keyword-based fallback: detect Danish-meaningful keywords
 *      ("cmyk", "bleed", "dpi", "font", …) and return a templated message
 *      using those. Catches new error phrasings without leaking English.
 *   3. Final fallback: a generic "Vi kunne ikke validere filen" message
 *      so the customer never sees raw English. The original is logged to
 *      console (dev only) so we can add explicit mappings over time.
 */

type Category = "error" | "warning" | "info";

interface TranslationRule {
    pattern: RegExp;
    // Either a plain Danish string, or a function that can extract groups
    // from the match (e.g. the actual DPI value Print.com found).
    message: string | ((match: RegExpMatchArray) => string);
}

// Most common / high-confidence patterns first. Keep the Danish messages
// short and action-oriented — the customer reads them under pressure at
// checkout.
const RULES: TranslationRule[] = [
    // ---- Color space ----
    {
        pattern: /rgb.*(?:not allowed|found|detected|used)|color space.*rgb|uses rgb/i,
        message: "Filen indeholder RGB-farver. Den skal konverteres til CMYK før tryk.",
    },
    {
        pattern: /(?:not|non[- ]?)cmyk|cmyk.*(?:required|expected|missing)/i,
        message: "Farverne i filen er ikke i CMYK. Konverter til CMYK og upload igen.",
    },
    {
        pattern: /spot colou?r.*(?:not allowed|detected|found)|pantone/i,
        message: "Filen indeholder specialfarver (fx Pantone). Konverter til CMYK før tryk.",
    },
    {
        pattern: /icc profile.*(?:missing|not embedded)/i,
        message: "Farveprofil mangler i filen. Sørg for at din PDF har en indlejret farveprofil.",
    },

    // ---- Resolution / DPI ----
    {
        pattern: /(?:image|resolution).*(?:low|below|insufficient|less than).*?(\d+)\s*dpi/i,
        message: (m) => `Billederne har lav opløsning (${m[1]} DPI). Brug mindst 300 DPI for god tryk.`,
    },
    {
        pattern: /low[- ]?res(?:olution)?|effective resolution.*(?:below|low)/i,
        message: "Et eller flere billeder har for lav opløsning. Brug mindst 300 DPI.",
    },

    // ---- Bleed / trim / margins ----
    {
        pattern: /bleed.*(?:missing|insufficient|below|too small)|missing bleed/i,
        message: "Din fil mangler beskæring. Tilføj 3 mm beskæring hele vejen rundt.",
    },
    {
        pattern: /trim box.*(?:missing|invalid|not defined)/i,
        message: "Beskæringsområdet (trim box) er ikke korrekt angivet i PDF'en.",
    },
    {
        pattern: /content.*(?:outside|beyond).*(?:safe area|trim|margin)/i,
        message: "Vigtigt indhold ligger for tæt på kanten. Flyt det mindst 3 mm ind fra kanten.",
    },
    {
        pattern: /(?:document|page) size.*(?:mismatch|wrong|incorrect|does not match)/i,
        message: "PDF'ens format matcher ikke det valgte produkt. Tjek mål og eksporter igen.",
    },

    // ---- Fonts ----
    {
        pattern: /font.*(?:not embedded|missing|unembedded)/i,
        message: "En skrifttype er ikke indlejret i PDF'en. Gem som PDF/X eller med indlejrede skrifter.",
    },
    {
        pattern: /text.*(?:too small|below minimum)/i,
        message: "Teksten i filen er meget lille og kan blive utydelig ved tryk.",
    },

    // ---- Transparency / overprint ----
    {
        pattern: /transparency.*(?:not flattened|live|present)/i,
        message: "Filen indeholder transparens der ikke er samlet ned. Eksporter som PDF/X-4.",
    },
    {
        pattern: /overprint/i,
        message: "Filen har overprint-indstillinger der kan give uventet resultat i tryk.",
    },

    // ---- Structural ----
    {
        pattern: /password.*(?:protected|required)|encrypted/i,
        message: "PDF'en er låst med kodeord. Fjern beskyttelsen og upload igen.",
    },
    {
        pattern: /(?:corrupt|invalid|malformed|cannot parse)/i,
        message: "Filen kunne ikke læses korrekt. Gem PDF'en igen fra dit designprogram.",
    },
    {
        pattern: /wrong number of pages|page count/i,
        message: "Antallet af sider i PDF'en matcher ikke det valgte produkt.",
    },
    {
        pattern: /white overprint|white.*overprint/i,
        message: "Hvide elementer er sat til overprint og vil forsvinde i tryk.",
    },
    {
        pattern: /line.*(?:thin|hairline|too thin)/i,
        message: "Der er meget tynde streger i filen der måske ikke kan ses i tryk.",
    },
];

// Keyword salvage — if no rule matched, look for Danish-meaningful keywords
// so the customer at least gets a clue instead of raw English. Order matters:
// first match wins.
const KEYWORD_SALVAGE: Array<{ needle: RegExp; message: string }> = [
    { needle: /bleed|beskæring/i, message: "Der er et problem med beskæringen i filen." },
    { needle: /resolution|dpi|resolut/i, message: "Der er et problem med opløsningen i filen." },
    { needle: /colou?r|cmyk|rgb|pantone/i, message: "Der er et farveproblem i filen." },
    { needle: /font|text|skrift/i, message: "Der er et skrifttypeproblem i filen." },
    { needle: /size|dimension|format/i, message: "Der er et formatproblem i filen." },
    { needle: /transparen|flatten/i, message: "Der er et transparens-problem i filen." },
    { needle: /margin|safe area|edge/i, message: "Indholdet ligger for tæt på kanten." },
];

const GENERIC_FALLBACK: Record<Category, string> = {
    error: "Et teknisk problem blev fundet. Kontakt os hvis problemet fortsætter.",
    warning: "Vi fandt noget der kan give problemer ved tryk, men filen kan bruges.",
    info: "Filkontrol færdig.",
};

/**
 * Translate a single raw preflight message to Danish, customer-friendly text.
 *
 * Returns the Danish string. In dev, logs unmapped originals to console so we
 * can add them to RULES over time without re-deploying strings to prod.
 */
export function translatePreflightMessage(
    raw: string | null | undefined,
    category: Category = "error",
): string {
    const input = String(raw || "").trim();
    if (!input) return GENERIC_FALLBACK[category];

    // Already Danish? Our own codebase produces Danish strings too — don't
    // touch messages that obviously aren't English preflight output.
    if (/[æøåÆØÅ]/.test(input)) return input;

    for (const rule of RULES) {
        const m = input.match(rule.pattern);
        if (m) {
            return typeof rule.message === "function" ? rule.message(m) : rule.message;
        }
    }

    for (const { needle, message } of KEYWORD_SALVAGE) {
        if (needle.test(input)) {
            if (import.meta.env.DEV) {
                console.debug("[preflightTranslations] keyword salvage:", input);
            }
            return message;
        }
    }

    if (import.meta.env.DEV) {
        console.warn("[preflightTranslations] no mapping for:", input);
    }
    return GENERIC_FALLBACK[category];
}

/**
 * Translate a list of raw messages, de-duplicating identical Danish outputs.
 * Print.com sometimes returns the same issue worded two different ways
 * (see the "copies does not match any range set" double-error we hit).
 */
export function translatePreflightMessages(
    raw: Array<string | null | undefined> | null | undefined,
    category: Category = "error",
): string[] {
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
        const danish = translatePreflightMessage(item, category);
        if (!seen.has(danish)) {
            seen.add(danish);
            out.push(danish);
        }
    }
    return out;
}

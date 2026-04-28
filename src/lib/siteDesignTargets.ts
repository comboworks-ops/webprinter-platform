export interface SiteDesignTargetMatch {
    rawId: string;
    sectionId: string;
    label: string;
    focusedBlockId?: string | null;
    focusTargetId?: string | null;
}

const TYPOGRAPHY_LABELS: Record<string, string> = {
    heading: "Overskrift",
    body: "Brødtekst",
    pricing: "Pris typografi",
};

const COLOR_LABELS: Record<string, string> = {
    primary: "Primær farve",
    secondary: "Sekundær farve",
    background: "Side baggrund",
    card: "Kort baggrund",
    dropdown: "Dropdown base",
    hover: "Hover accent",
    headingText: "Overskrift farve",
    bodyText: "Brødtekst farve",
    pricingText: "Pris farve",
    linkText: "Link farve",
};

function buildContentLabel(targetPart?: string) {
    switch (targetPart) {
        case "heading":
            return "Indholdsblok overskrift";
        case "text":
            return "Indholdsblok tekst";
        case "cta":
            return "Indholdsblok knap";
        case "image":
            return "Indholdsblok billede";
        default:
            return "Indholdsblok";
    }
}

function buildBanner2Label(targetPart?: string) {
    switch (targetPart) {
        case "image":
            return "Showcase billede";
        case "title":
            return "Showcase titel";
        case "description":
            return "Showcase tekst";
        default:
            return "Banner 2 / Showcase";
    }
}

export function resolveSiteDesignTarget(rawId?: string | null): SiteDesignTargetMatch | null {
    if (!rawId || typeof rawId !== "string") return null;

    if (rawId === "header.logo") {
        return { rawId, sectionId: "logo", label: "Logo" };
    }

    if (rawId === "header.menu.text") {
        return { rawId, sectionId: "header", label: "Menu tekst", focusTargetId: "site-design-focus-header-menu-typography" };
    }

    if (rawId === "header.menu.item" || rawId === "header.menu.item.image") {
        return {
            rawId,
            sectionId: "header",
            label: rawId === "header.menu.item.image" ? "Menupunkt billede" : "Menupunkt",
            focusTargetId: "site-design-focus-header-nav",
        };
    }

    if (rawId === "header.menu.layout" || rawId === "header.menu") {
        return { rawId, sectionId: "header", label: "Menu layout", focusTargetId: "site-design-focus-header-layout" };
    }

    if (rawId === "header.actions") {
        return { rawId, sectionId: "header", label: "Header elementer", focusTargetId: "site-design-focus-header-actions" };
    }

    if (rawId === "header.cta") {
        return { rawId, sectionId: "header", label: "Header CTA", focusTargetId: "site-design-focus-header-cta" };
    }

    if (rawId === "header.dropdown.image") {
        return { rawId, sectionId: "header", label: "Dropdown billede", focusTargetId: "site-design-focus-header-dropdown-media" };
    }

    if (rawId === "header.dropdown.category") {
        return { rawId, sectionId: "header", label: "Dropdown kategori", focusTargetId: "site-design-focus-header-dropdown-category" };
    }

    if (rawId === "header.dropdown.product" || rawId === "header.dropdown.meta") {
        return { rawId, sectionId: "header", label: "Dropdown produkttekst", focusTargetId: "site-design-focus-header-dropdown-product" };
    }

    if (rawId === "header.dropdown.background" || rawId === "header.dropdown.hover" || rawId === "header.dropdown.panel" || rawId === "header.dropdown") {
        return { rawId, sectionId: "header", label: "Dropdown panel", focusTargetId: "site-design-focus-header-dropdown-panel" };
    }

    if (rawId === "header.background") {
        return { rawId, sectionId: "header", label: "Header baggrund", focusTargetId: "site-design-focus-header-background" };
    }

    if (rawId === "header" || rawId.startsWith("header.")) {
        return { rawId, sectionId: "header", label: "Header", focusTargetId: "site-design-focus-header-background" };
    }

    if (rawId === "forside.hero.media") {
        return { rawId, sectionId: "banner", label: "Banner billede", focusTargetId: "site-design-focus-banner-media" };
    }

    if (rawId === "forside.hero.overlay") {
        // The overlay is a full-coverage transparent div (z-10) that sits on top of the hero
        // background image. Clicks on the visible "background image" always land on this overlay.
        // Route to the media card so the user is taken to "the box with the background image".
        return { rawId, sectionId: "banner", label: "Banner billede", focusTargetId: "site-design-focus-banner-media" };
    }

    if (rawId === "forside.hero.title") {
        return { rawId, sectionId: "banner", label: "Banner overskrift", focusTargetId: "site-design-focus-banner-title" };
    }

    if (rawId === "forside.hero.subtitle") {
        return { rawId, sectionId: "banner", label: "Banner tekst", focusTargetId: "site-design-focus-banner-subtitle" };
    }

    if (rawId === "forside.hero.button") {
        return { rawId, sectionId: "banner", label: "Banner knap", focusTargetId: "site-design-focus-banner-buttons" };
    }

    if (rawId === "forside.hero" || rawId.startsWith("forside.hero.")) {
        return { rawId, sectionId: "banner", label: "Banner", focusTargetId: "site-design-focus-banner-media" };
    }

    if (rawId === "forside.banner2") {
        return {
            rawId,
            sectionId: "showcase",
            label: "Showcase baggrund",
            focusTargetId: "site-design-focus-showcase-background",
        };
    }

    if (rawId === "forside.banner2.heading") {
        return {
            rawId,
            sectionId: "showcase",
            label: "Showcase overskrift",
            focusTargetId: "site-design-focus-showcase-heading",
        };
    }

    if (rawId === "forside.banner2.subtitle") {
        return {
            rawId,
            sectionId: "showcase",
            label: "Showcase introtekst",
            focusTargetId: "site-design-focus-showcase-subtitle",
        };
    }

    const banner2ItemMatch = /^forside\.banner2\.item\.([^\.]+)(?:\.(image|title|description))?$/.exec(rawId);
    if (banner2ItemMatch) {
        const [, itemId, targetPart] = banner2ItemMatch;
        return {
            rawId,
            sectionId: "showcase",
            label: buildBanner2Label(targetPart),
            focusTargetId: targetPart
                ? `site-design-focus-showcase-item-${itemId}-${targetPart}`
                : `site-design-focus-showcase-item-${itemId}`,
        };
    }

    if (rawId.startsWith("forside.banner2.")) {
        return {
            rawId,
            sectionId: "showcase",
            label: "Banner 2 / Showcase",
            focusTargetId: "site-design-focus-showcase-layout",
        };
    }

    if (rawId === "forside.products.background") {
        return { rawId, sectionId: "products", label: "Produktkort baggrund", focusTargetId: "site-design-focus-products-background" };
    }

    if (rawId === "forside.products.categories" || rawId === "forside.products.categories.button") {
        return {
            rawId,
            sectionId: "products",
            label: rawId === "forside.products.categories.button" ? "Produktkategori-knap" : "Produktkategorier",
            focusTargetId: "site-design-focus-products-category-tabs",
        };
    }

    if (rawId === "forside.products.button") {
        return { rawId, sectionId: "products", label: "Forside produktknap", focusTargetId: "site-design-focus-products-buttons" };
    }

    if (rawId === "forside.products.card.title" || rawId === "forside.products.card.body") {
        return {
            rawId,
            sectionId: "products",
            label: rawId === "forside.products.card.title" ? "Produktkort titel" : "Produktkort tekst",
            focusTargetId: "site-design-focus-products-card-copy",
        };
    }

    if (rawId === "forside.products.card.price") {
        return { rawId, sectionId: "products", label: "Produktkort pris", focusTargetId: "site-design-focus-products-card-pricing" };
    }

    if (rawId === "forside.products.featured.image") {
        return { rawId, sectionId: "products", label: "Fremhævet produktbillede", focusTargetId: "site-design-focus-products-featured-image" };
    }

    if (rawId === "forside.products.featured.gallery") {
        return { rawId, sectionId: "products", label: "Fremhævet galleri", focusTargetId: "site-design-focus-products-featured-gallery" };
    }

    if (rawId === "forside.products.featured.copy") {
        return { rawId, sectionId: "products", label: "Fremhævet produkttekst", focusTargetId: "site-design-focus-products-featured-copy" };
    }

    if (rawId === "forside.products.featured.button") {
        return { rawId, sectionId: "products", label: "Fremhævet CTA", focusTargetId: "site-design-focus-products-featured-cta" };
    }

    if (rawId === "forside.products.featured.side-panel.box") {
        return { rawId, sectionId: "products", label: "Sidepanel", focusTargetId: "site-design-focus-products-featured-side-panel" };
    }

    if (rawId === "forside.products.featured.side-panel.image") {
        return { rawId, sectionId: "products", label: "Sidepanel billede", focusTargetId: "site-design-focus-products-featured-side-panel" };
    }

    if (rawId === "forside.products.featured.side-panel.copy") {
        return { rawId, sectionId: "products", label: "Sidepanel tekst", focusTargetId: "site-design-focus-products-featured-side-panel" };
    }

    if (rawId === "forside.products.featured.side-panel.button") {
        return { rawId, sectionId: "products", label: "Sidepanel CTA", focusTargetId: "site-design-focus-products-featured-side-panel" };
    }

    if (rawId === "forside.products.featured.gallery") {
        return { rawId, sectionId: "products", label: "Fremhævet galleri", focusTargetId: "site-design-focus-products-featured-gallery" };
    }

    if (rawId === "forside.products.featured.box") {
        return { rawId, sectionId: "products", label: "Fremhævet produkt boks", focusTargetId: "site-design-focus-products-featured-box" };
    }

    if (rawId === "forside.products.featured") {
        return { rawId, sectionId: "products", label: "Fremhævet produkt", focusTargetId: "site-design-focus-products-featured" };
    }

    if (rawId === "forside.products" || rawId.startsWith("forside.products.")) {
        return { rawId, sectionId: "products", label: "Forside produkter", focusTargetId: "site-design-focus-products-layout" };
    }

    if (rawId === "footer.background" || rawId === "footer") {
        return { rawId, sectionId: "footer", label: "Footer", focusTargetId: "site-design-focus-footer-layout" };
    }

    if (rawId === "footer.text" || rawId === "footer.copy" || rawId === "footer.contact") {
        return { rawId, sectionId: "footer", label: "Footer tekst", focusTargetId: "site-design-focus-footer-content" };
    }

    if (rawId === "footer.links") {
        return { rawId, sectionId: "footer", label: "Footer links", focusTargetId: "site-design-focus-footer-links" };
    }

    if (rawId === "footer.social") {
        return { rawId, sectionId: "footer", label: "Footer sociale medier", focusTargetId: "site-design-focus-footer-social" };
    }

    if (rawId.startsWith("footer.")) {
        return { rawId, sectionId: "footer", label: "Footer", focusTargetId: "site-design-focus-footer-layout" };
    }

    // USP Strip
    if (rawId === "usp-strip") {
        return { rawId, sectionId: "usp-strip", label: "USP Strip (Fordele)", focusTargetId: "site-design-focus-usp-strip" };
    }
    // USP item with specific element (icon, title, description)
    const uspElementMatch = /^usp-strip\.item\.([^\.]+)\.(icon|title|description)$/.exec(rawId);
    if (uspElementMatch) {
        const [, itemId, elementType] = uspElementMatch;
        const labels: Record<string, string> = {
            icon: "USP Ikon",
            title: "USP Overskrift",
            description: "USP Beskrivelse"
        };
        return { 
            rawId, 
            sectionId: "usp-strip", 
            label: labels[elementType] || "USP Element", 
            focusTargetId: `site-design-focus-usp-item-${itemId}-${elementType}` 
        };
    }
    // USP item general
    if (rawId.startsWith("usp-strip.item.")) {
        const itemId = rawId.replace("usp-strip.item.", "");
        return { rawId, sectionId: "usp-strip", label: "USP Element", focusTargetId: `site-design-focus-usp-item-${itemId}` };
    }

    // SEO Content
    if (rawId === "seo-content") {
        return { rawId, sectionId: "seo-content", label: "SEO Tekst", focusTargetId: "site-design-focus-seo-content" };
    }
    // SEO content item with specific element (heading, text)
    const seoElementMatch = /^seo-content\.item\.(\d+)\.(heading|text)$/.exec(rawId);
    if (seoElementMatch) {
        const [, itemNum, elementType] = seoElementMatch;
        const labels: Record<string, string> = {
            heading: `SEO Overskrift ${itemNum}`,
            text: `SEO Tekst ${itemNum}`
        };
        return { 
            rawId, 
            sectionId: "seo-content", 
            label: labels[elementType] || `SEO Element ${itemNum}`, 
            focusTargetId: `site-design-focus-seo-item-${itemNum}-${elementType}` 
        };
    }
    // SEO content item general
    if (rawId.startsWith("seo-content.item.")) {
        const itemNum = rawId.replace("seo-content.item.", "");
        return { rawId, sectionId: "seo-content", label: `SEO Sektion ${itemNum}`, focusTargetId: `site-design-focus-seo-item-${itemNum}` };
    }

    if (rawId === "icons" || rawId === "icons.product-images" || rawId === "icons.filters" || rawId === "icons.pack") {
        return { rawId, sectionId: "icons", label: "Produktbilleder" };
    }

    if (rawId.startsWith("icons.")) {
        return { rawId, sectionId: "icons", label: "Produktbilleder" };
    }

    const typographyMatch = /^typography\.(heading|body|pricing)$/.exec(rawId);
    if (typographyMatch) {
        const key = typographyMatch[1];
        return {
            rawId,
            sectionId: "typography",
            label: TYPOGRAPHY_LABELS[key] || "Typografi",
            focusTargetId: `site-design-focus-typography-${key}`,
        };
    }

    const colorMatch = /^colors\.(primary|secondary|background|card|dropdown|hover|headingText|bodyText|pricingText|linkText)$/.exec(rawId);
    if (colorMatch) {
        const key = colorMatch[1];
        return {
            rawId,
            sectionId: key === "background" ? "page-background" : "colors",
            label: COLOR_LABELS[key] || "Farve",
            focusTargetId: key === "background" ? "site-design-focus-page-background" : `site-design-focus-colors-${key}`,
        };
    }

    if (rawId === "productPage.orderButtons.primary") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Bestil nu-knap",
            focusTargetId: "site-design-focus-product-page-order-primary",
        };
    }

    if (rawId === "productPage.orderButtons.secondary") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Design online-knap",
            focusTargetId: "site-design-focus-product-page-order-secondary",
        };
    }

    if (rawId === "productPage.orderButtons.selected") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Klar til design-knap",
            focusTargetId: "site-design-focus-product-page-order-selected",
        };
    }

    if (rawId === "productPage.matrix.pricing") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prismatrix priser",
            focusTargetId: "site-design-focus-product-page-matrix-pricing",
        };
    }

    if (rawId === "productPage.matrix.topRow") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prismatrix top-række",
            focusTargetId: "site-design-focus-product-page-matrix-top-row",
        };
    }

    if (rawId === "productPage.matrix.vertical") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prismatrix venstre kolonne",
            focusTargetId: "site-design-focus-product-page-matrix-vertical",
        };
    }

    if (rawId === "productPage.matrix.buttons") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prismatrix knapper",
            focusTargetId: "site-design-focus-product-page-matrix-buttons",
        };
    }

    if (rawId === "productPage.matrix.box") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prismatrix boks",
            focusTargetId: "site-design-focus-product-page-box",
        };
    }

    if (rawId === "productPage.pricePanel.box" || rawId === "productPage.pricePanel") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prisberegner boks",
            focusTargetId: "site-design-focus-product-page-price-panel-box",
        };
    }

    if (rawId === "productPage.pricePanel.titleColor") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prisberegner titel",
            focusTargetId: "site-design-focus-product-page-price-panel-title",
        };
    }

    if (rawId === "productPage.pricePanel.downloadButton") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Download tilbud-knap",
            focusTargetId: "site-design-focus-product-page-price-panel-download-button",
        };
    }

    if (rawId === "productPage.pricePanel.text" || rawId === "productPage.pricePanel.mutedText") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: rawId.endsWith("mutedText") ? "Prisberegner hjælpetekst" : "Prisberegner tekst",
            focusTargetId: "site-design-focus-product-page-price-panel-text",
        };
    }

    if (rawId === "productPage.pricePanel.price") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prisberegner priser",
            focusTargetId: "site-design-focus-product-page-price-panel-price",
        };
    }

    if (rawId === "productPage.pricePanel.optionCard") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Leveringskort",
            focusTargetId: "site-design-focus-product-page-price-panel-delivery-card",
        };
    }

    if (rawId === "productPage.pricePanel.badge") {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Tidstæller",
            focusTargetId: "site-design-focus-product-page-price-panel-badge",
        };
    }

    if (rawId.startsWith("productPage.pricePanel")) {
        return {
            rawId,
            sectionId: "product-page-matrix",
            label: "Prisberegner",
            focusTargetId: "site-design-focus-product-page-price-panel",
        };
    }

    if (rawId === "productPage.heading") {
        return { rawId, sectionId: "product-page-matrix", label: "Produktside overskrift", focusTargetId: "site-design-focus-product-page-heading" };
    }

    if (rawId === "productPage.matrix") {
        return { rawId, sectionId: "product-page-matrix", label: "Prismatrix", focusTargetId: "site-design-focus-product-page-colors" };
    }

    if (rawId === "productPage.infoSection" || rawId.startsWith("productPage.infoSection.")) {
        return { rawId, sectionId: "product-description", label: "Produktbeskrivelse", focusTargetId: "site-design-focus-product-description" };
    }

    if (rawId === "productPage.optionSelectors" || rawId.startsWith("productPage.optionSelectors.")) {
        return {
            rawId,
            sectionId: "produktvalgknapper",
            label: "Tilvalgsknapper",
            focusTargetId: "site-design-focus-produktvalgknapper",
        };
    }

    // Product option button clicks: product-option.<productId>.<sectionId>.<valueId>.<valueName>
    const productOptionMatch = /^product-option\.([^\.]+)\.([^\.]+)\.([^\.]+)\./.exec(rawId);
    if (productOptionMatch) {
        return { 
            rawId, 
            sectionId: "produktvalgknapper", 
            label: "Produktvalgknapper",
            focusTargetId: "site-design-focus-produktvalgknapper"
        };
    }

    // Product selector container clicks: product-selector-box.<productId>.<sectionId>.<sectionName>
    const productSelectorBoxMatch = /^product-selector-box\.([^\.]+)\.([^\.]+)\./.exec(rawId);
    if (productSelectorBoxMatch) {
        return {
            rawId,
            sectionId: "produktvalgknapper",
            label: "Valgboks",
            focusTargetId: "site-design-focus-produktvalgknapper",
        };
    }

    if (rawId.startsWith("productPage.")) {
        return { rawId, sectionId: "product-page-matrix", label: "Produktside", focusTargetId: "site-design-focus-product-page-colors" };
    }

    const contentMatch = /^content:([^:]+)(?::([^:]+))?$/.exec(rawId);
    if (contentMatch) {
        const [, blockId, targetPart] = contentMatch;
        const focusTargetId = targetPart
            ? `site-design-focus-content-${blockId}-${targetPart}`
            : `site-design-focus-content-${blockId}`;
        return {
            rawId,
            sectionId: "content",
            focusedBlockId: blockId,
            focusTargetId,
            label: buildContentLabel(targetPart),
        };
    }

    if (rawId === "content") {
        return { rawId, sectionId: "content", label: "Indholdsblokke" };
    }

    if (rawId.startsWith("block-")) {
        return {
            rawId,
            sectionId: "content",
            focusedBlockId: rawId,
            focusTargetId: `site-design-focus-content-${rawId}`,
            label: "Indholdsblok",
        };
    }

    return null;
}

export function getSiteDesignTargetLabel(rawId?: string | null): string {
    return resolveSiteDesignTarget(rawId)?.label || "Sektion";
}

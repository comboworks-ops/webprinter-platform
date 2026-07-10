type SeoHeadInput = {
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  ogUrl?: string | null;
  type?: string | null;
};

function upsertMetaByAttribute(attribute: "name" | "property", key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) {
    existing.setAttribute("content", content);
    return;
  }

  const meta = document.createElement("meta");
  meta.setAttribute(attribute, key);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

function upsertCanonical(href: string): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (existing) {
    existing.setAttribute("href", href);
    return;
  }

  const link = document.createElement("link");
  link.setAttribute("rel", "canonical");
  link.setAttribute("href", href);
  document.head.appendChild(link);
}

export function syncPrimarySeoTags(input: SeoHeadInput): void {
  if (typeof document === "undefined") return;

  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const canonicalUrl = String(input.canonicalUrl || "").trim();
  const author = String(input.author || "").trim();
  const imageUrl = String(input.imageUrl || "").trim();
  const ogUrl = String(input.ogUrl || canonicalUrl || "").trim();
  const type = String(input.type || "website").trim();

  if (title) {
    document.title = title;
    upsertMetaByAttribute("property", "og:title", title);
    upsertMetaByAttribute("name", "twitter:title", title);
    upsertMetaByAttribute("property", "twitter:title", title);
  }

  if (description) {
    upsertMetaByAttribute("name", "description", description);
    upsertMetaByAttribute("property", "og:description", description);
    upsertMetaByAttribute("name", "twitter:description", description);
    upsertMetaByAttribute("property", "twitter:description", description);
  }

  if (canonicalUrl) {
    upsertCanonical(canonicalUrl);
  }

  if (author) {
    upsertMetaByAttribute("name", "author", author);
  }

  if (type) {
    upsertMetaByAttribute("property", "og:type", type);
  }

  if (ogUrl) {
    upsertMetaByAttribute("property", "og:url", ogUrl);
    upsertMetaByAttribute("name", "twitter:url", ogUrl);
    upsertMetaByAttribute("property", "twitter:url", ogUrl);
  }

  if (imageUrl) {
    upsertMetaByAttribute("property", "og:image", imageUrl);
    upsertMetaByAttribute("name", "twitter:image", imageUrl);
    upsertMetaByAttribute("property", "twitter:image", imageUrl);
  }
}

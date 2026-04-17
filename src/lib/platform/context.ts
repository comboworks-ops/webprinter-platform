/**
 * Platform context helpers
 *
 * Determines whether the current request is in "platform/marketing" context
 * (i.e. webprinter.dk) vs a tenant storefront context.
 *
 * Works on both production (via hostname) and localhost dev (via ?force_domain=webprinter.dk).
 */

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";

const MARKETING_DOMAINS = [
    ROOT_DOMAIN,
    `www.${ROOT_DOMAIN}`,
    "webprinter-platform.vercel.app",
];

function isLocalhostEnv(): boolean {
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1";
}

/**
 * Returns true when the current page is the Webprinter platform/marketing site,
 * either by real hostname or by ?force_domain override on localhost.
 */
export function isPlatformContext(): boolean {
    if (typeof window === "undefined") return false;
    const hostname = window.location.hostname;

    // On the real production domain
    if (MARKETING_DOMAINS.includes(hostname)) return true;

    // Localhost dev: respect ?force_domain=webprinter.dk
    if (isLocalhostEnv()) {
        const forceDomain = new URLSearchParams(window.location.search).get("force_domain");
        return !!forceDomain && MARKETING_DOMAINS.includes(forceDomain);
    }

    return false;
}

/**
 * Appends ?force_domain=webprinter.dk to a path when on localhost,
 * so all platform navigation stays in platform context regardless of
 * whether the current URL already carries the param.
 *
 * On production this is a no-op — real hostname routing takes over.
 */
export function platformNavLink(path: string): string {
    if (!isLocalhostEnv()) return path;
    // Always stamp force_domain on localhost so every platform link carries context
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}force_domain=${encodeURIComponent(ROOT_DOMAIN)}`;
}

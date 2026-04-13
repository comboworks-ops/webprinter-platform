import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { DEFAULT_FOOTER } from "@/hooks/useBrandingDraft";
import type { FooterSettings } from "@/hooks/useBrandingDraft";
import { useCookieConsent } from "@/components/consent";

// Small link component to open cookie settings
const CookieSettingsLink = ({ className }: { className?: string }) => {
  const { openSettings } = useCookieConsent();
  return (
    <button
      onClick={openSettings}
      className={`hover:underline text-xs ${className || ''}`}
    >
      Cookieindstillinger
    </button>
  );
};

const Footer = () => {
  const { data: settings } = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();

  // Default values if loading or not found
  const company = settings?.company || {};

  // Sync with header logo text - check preview branding first, then settings, then defaults
  const headerSettings = isPreviewMode && previewBranding?.header
    ? previewBranding.header
    : settings?.branding?.header;
  const brandName = headerSettings?.logoText || settings?.branding?.shop_name || settings?.tenant_name || "Shopnavn";

  // Get footer settings with defaults - prioritize preview branding if in preview mode
  const footerSource = isPreviewMode && previewBranding?.footer
    ? previewBranding.footer
    : settings?.branding?.footer;

  const footerSettings: FooterSettings = {
    ...DEFAULT_FOOTER,
    ...footerSource,
    social: {
      ...DEFAULT_FOOTER.social,
      ...footerSource?.social,
    },
  };

  // Calculate background style
  const getBackgroundStyle = () => {
    switch (footerSettings.background) {
      case 'themeDark':
        return { backgroundColor: '#111827', color: 'white' };
      case 'themeLight':
        return { backgroundColor: '#F3F4F6', color: '#111827' };
      case 'solid':
        return { backgroundColor: footerSettings.bgColor, color: '#FFFFFF' };
      default:
        return { backgroundColor: '#111827', color: 'white' };
    }
  };

  const bgStyle = getBackgroundStyle();
  const textColorClass = footerSettings.background === 'themeLight' ? 'text-gray-600' : 'text-gray-300';
  const mutedTextClass = footerSettings.background === 'themeLight' ? 'text-gray-500' : 'text-gray-400';
  const borderClass = footerSettings.background === 'themeLight' ? 'border-gray-300' : 'border-gray-700';

  // Parse copyright text with placeholders
  const getCopyrightText = () => {
    return footerSettings.copyrightText
      .replace('{year}', new Date().getFullYear().toString())
      .replace('{shopName}', brandName);
  };

  // Get visible links
  const visibleLinks = footerSettings.links
    .filter(link => link.isVisible)
    .sort((a, b) => a.order - b.order);

  // Check if any social icon should be shown
  const hasAnySocialIcon = footerSettings.showSocialIcons && Object.values(footerSettings.social).some(
    platform => platform.enabled && platform.url
  );

  return (
    <footer style={bgStyle} data-branding-id="footer.background">
      <div className="container mx-auto px-4 py-12">
        {footerSettings.style === 'minimal' ? (
          // Minimal layout - horizontal
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left" data-branding-id="footer.text">
              <h3 className="text-xl font-heading font-bold mb-2 text-white" data-branding-id="footer.text">{brandName}</h3>
              {footerSettings.text && (
                <p className={`${textColorClass} text-sm`} data-branding-id="footer.text">{footerSettings.text}</p>
              )}
            </div>

            {visibleLinks.length > 0 && (
              <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" data-branding-id="footer.links">
                {visibleLinks.map(link => (
                  <Link
                    key={link.id}
                    to={link.href}
                    data-branding-id="footer.links"
                    className={`${textColorClass} hover:opacity-80 transition-opacity text-sm`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {hasAnySocialIcon && (
              <div className="flex gap-4" data-branding-id="footer.social">
                {footerSettings.social.facebook.enabled && footerSettings.social.facebook.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.facebook.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="Facebook">
                    <Facebook className="h-5 w-5" />
                  </a>
                )}
                {footerSettings.social.instagram.enabled && footerSettings.social.instagram.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.instagram.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="Instagram">
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {footerSettings.social.linkedin.enabled && footerSettings.social.linkedin.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.linkedin.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="LinkedIn">
                    <Linkedin className="h-5 w-5" />
                  </a>
                )}
                {footerSettings.social.youtube.enabled && footerSettings.social.youtube.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.youtube.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="YouTube">
                    <Youtube className="h-5 w-5" />
                  </a>
                )}
              </div>
            )}
          </div>
        ) : footerSettings.style === 'centered' ? (
          // Centered layout
          <div className="text-center space-y-6">
            <h3 className="text-xl font-heading font-bold text-white" data-branding-id="footer.text">{brandName}</h3>
            {footerSettings.text && (
              <p className={`${textColorClass} text-sm max-w-md mx-auto`} data-branding-id="footer.text">{footerSettings.text}</p>
            )}

            {visibleLinks.length > 0 && (
              <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" data-branding-id="footer.links">
                {visibleLinks.map(link => (
                  <Link
                    key={link.id}
                    to={link.href}
                    data-branding-id="footer.links"
                    className={`${textColorClass} hover:opacity-80 transition-opacity text-sm`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {hasAnySocialIcon && (
              <div className="flex justify-center gap-4" data-branding-id="footer.social">
                {footerSettings.social.facebook.enabled && footerSettings.social.facebook.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.facebook.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="Facebook">
                    <Facebook className="h-5 w-5" />
                  </a>
                )}
                {footerSettings.social.instagram.enabled && footerSettings.social.instagram.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.instagram.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="Instagram">
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {footerSettings.social.linkedin.enabled && footerSettings.social.linkedin.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.linkedin.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="LinkedIn">
                    <Linkedin className="h-5 w-5" />
                  </a>
                )}
                {footerSettings.social.youtube.enabled && footerSettings.social.youtube.url && (
                  <a data-branding-id="footer.social" href={footerSettings.social.youtube.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="YouTube">
                    <Youtube className="h-5 w-5" />
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          // Columns layout (default)
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Column 1: Brand */}
            <div data-branding-id="footer.text">
              <h3 className="text-xl font-heading font-bold mb-4 text-white" data-branding-id="footer.text">{brandName}</h3>
              <p className={`${textColorClass} text-sm`} data-branding-id="footer.text">
                {footerSettings.text || 'Din partner for professionelt tryk og storformat print.'}
              </p>
              {company.cvr && (
                <p className={`${mutedTextClass} text-xs mt-4`} data-branding-id="footer.copy">CVR: {company.cvr}</p>
              )}
            </div>

            {/* Column 2: Links */}
            <div data-branding-id="footer.links">
              <h4 className="text-lg font-heading font-semibold mb-4 text-white" data-branding-id="footer.links">Links</h4>
              <ul className="space-y-2">
                {visibleLinks.map(link => (
                  <li key={link.id}>
                    <Link data-branding-id="footer.links" to={link.href} className={`${textColorClass} hover:opacity-80 transition-opacity text-sm`}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Contact + Social */}
            <div data-branding-id="footer.contact">
              <h4 className="text-lg font-heading font-semibold mb-4 text-white" data-branding-id="footer.contact">Kontakt</h4>
              <ul className={`space-y-3 text-sm ${textColorClass}`} data-branding-id="footer.contact">
                {company.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    <a data-branding-id="footer.contact" href={`tel:${company.phone}`} className="hover:opacity-80 transition-opacity">{company.phone}</a>
                  </li>
                )}
                {company.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <a data-branding-id="footer.contact" href={`mailto:${company.email}`} className="hover:opacity-80 transition-opacity">{company.email}</a>
                  </li>
                )}
                {company.address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line" data-branding-id="footer.contact">{company.address}</span>
                  </li>
                )}

                {hasAnySocialIcon && (
                  <li className="mt-4 flex gap-4" data-branding-id="footer.social">
                    {footerSettings.social.facebook.enabled && footerSettings.social.facebook.url && (
                      <a data-branding-id="footer.social" href={footerSettings.social.facebook.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="Facebook">
                        <Facebook className="h-5 w-5" />
                      </a>
                    )}
                    {footerSettings.social.instagram.enabled && footerSettings.social.instagram.url && (
                      <a data-branding-id="footer.social" href={footerSettings.social.instagram.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="Instagram">
                        <Instagram className="h-5 w-5" />
                      </a>
                    )}
                    {footerSettings.social.linkedin.enabled && footerSettings.social.linkedin.url && (
                      <a data-branding-id="footer.social" href={footerSettings.social.linkedin.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="LinkedIn">
                        <Linkedin className="h-5 w-5" />
                      </a>
                    )}
                    {footerSettings.social.youtube.enabled && footerSettings.social.youtube.url && (
                      <a data-branding-id="footer.social" href={footerSettings.social.youtube.url} target="_blank" rel="noopener noreferrer" className={`${textColorClass} hover:opacity-80 transition-opacity`} aria-label="YouTube">
                        <Youtube className="h-5 w-5" />
                      </a>
                    )}
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Copyright */}
        {footerSettings.showCopyright && (
          <div className={`border-t ${borderClass} pt-8 text-center text-sm ${mutedTextClass}`}>
            <p className="mb-1" data-branding-id="footer.copy">{getCopyrightText()}</p>
            <CookieSettingsLink className={mutedTextClass} />
          </div>
        )}
      </div>
    </footer>
  );
};

export default Footer;

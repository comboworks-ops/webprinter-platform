import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileText, HelpCircle, Layers, Maximize2, X } from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";
import { appendStorefrontTenantContext } from "@/lib/storefrontTenantContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GrafiskVejledningDetails } from "./GrafiskVejledningDetails";
import { getGraphicGuideIndex, graphicGuideLessons } from "./graphicGuideLessons";
import { graphicGuideImageSrc, resolveGraphicGuideSettings } from "./graphicGuideSettings";
import "@/styles/graphicGuide.css";

const detailAnchors = new Set(["offsettryk", "cmyk-rgb", "storformat", "efterbehandling", "spotlak", "konturskæring", "hvidt-blæk", "trykmetoder", "tekstiltryk", "pdf-eksport"]);

export function GrafiskVejledningContent() {
  const { data: settings } = useShopSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const index = getGraphicGuideIndex(location.hash);
  const guide = resolveGraphicGuideSettings(settings?.graphicGuide);
  const lesson = { ...graphicGuideLessons[index], ...guide.lessons[graphicGuideLessons[index].id] };
  const nextLesson = graphicGuideLessons[index + 1];
  const imageSrc = graphicGuideImageSrc(lesson.imageUrl, lesson.image);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLDetailsElement>(null);
  const templateRef = useRef<HTMLDetailsElement>(null);
  const focusLesson = useRef(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const phone = settings?.company?.phone || "";
  const email = settings?.company?.email || "";

  useEffect(() => {
    if (!focusLesson.current) return;
    focusLesson.current = false;
    headingRef.current?.focus({ preventScroll: true });
    const top = headingRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 130 || top > window.innerHeight / 2) {
      headingRef.current?.scrollIntoView({ block: "start" });
    }
  }, [index]);

  useEffect(() => {
    let anchor = location.hash.slice(1);
    try { anchor = decodeURIComponent(anchor); } catch { return; }
    if (detailAnchors.has(anchor) && detailRef.current) {
      detailRef.current.open = true;
      const frame = requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }));
      return () => cancelAnimationFrame(frame);
    }
    if (anchor === "skabeloner" && templateRef.current) templateRef.current.open = true;
  }, [location.hash]);

  function showLesson(nextIndex: number) {
    if (nextIndex === index) return;
    focusLesson.current = true;
    setZoomOpen(false);
    navigate({ pathname: location.pathname, search: location.search, hash: `#${graphicGuideLessons[nextIndex].id}` }, { preventScrollReset: true });
  }

  function showTemplates() {
    if (!templateRef.current) return;
    templateRef.current.open = true;
    templateRef.current.scrollIntoView({ block: "start" });
    templateRef.current.querySelector("summary")?.focus({ preventScroll: true });
  }

  return (
    <div className="graphic-guide">
      <header className="graphic-guide-intro">
        <p className="graphic-guide-eyebrow">Grafisk vejledning</p>
        <h1 data-branding-id="typography.heading">{guide.heading}</h1>
        <p data-branding-id="typography.body">{guide.introduction}</p>
      </header>

      <div className="graphic-guide-layout">
        <nav className="graphic-guide-nav" aria-label="Vejledningens fem trin">
          <h2>{guide.navHeading}</h2>
          <ol>
            {graphicGuideLessons.map((item, itemIndex) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button type="button" aria-current={itemIndex === index ? "step" : undefined} aria-controls="graphic-guide-lesson" onClick={() => showLesson(itemIndex)}>
                    <Icon aria-hidden="true" strokeWidth={1.6} />
                    <span>{guide.lessons[item.id].label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="graphic-guide-nav-note">{guide.navNote}</p>
        </nav>

        <section id="graphic-guide-lesson" className="graphic-guide-lesson" aria-labelledby="graphic-guide-heading">
          <header className="graphic-guide-lesson-heading">
            <h2 id="graphic-guide-heading" ref={headingRef} tabIndex={-1} data-branding-id="typography.heading">{lesson.title}</h2>
            <p data-branding-id="typography.body">{lesson.description}</p>
          </header>

          <figure className="graphic-guide-figure">
            <div className="graphic-guide-comparison-labels">
              {lesson.labels.map((label, labelIndex) => (
                <p key={label} className={lesson.comparison ? (labelIndex === 0 ? "graphic-guide-example-problem" : "graphic-guide-example-good") : ""}>
                  {lesson.comparison && (labelIndex === 0 ? <X aria-hidden="true" /> : <Check aria-hidden="true" />)}
                  <span>{label}</span>
                </p>
              ))}
            </div>
            <img key={imageSrc} className="graphic-guide-image" src={imageSrc} alt={lesson.imageAlt} width="1400" height="740" decoding="async" />
            <figcaption>
              <span>Illustreret eksempel</span>
              <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
                <DialogTrigger asChild>
                  <button type="button" className="graphic-guide-zoom"><Maximize2 aria-hidden="true" /> Se større</button>
                </DialogTrigger>
                <DialogContent className="graphic-guide-zoom-dialog">
                  <DialogTitle>{lesson.label}</DialogTitle>
                  <DialogDescription>{lesson.imageAlt}</DialogDescription>
                  <div className="graphic-guide-zoom-scroll" tabIndex={0} aria-label="Stor illustration. Rul vandret for at se hele billedet.">
                    <img src={imageSrc} alt={lesson.imageAlt} width="1400" height="740" />
                  </div>
                  <p className="graphic-guide-zoom-note">{lesson.note}</p>
                </DialogContent>
              </Dialog>
            </figcaption>
          </figure>

          <div className="graphic-guide-tips">
            {lesson.tips.map((tip) => <div key={tip.title}><h3>{tip.title}</h3><p>{tip.text}</p></div>)}
          </div>
          {lesson.id === "pdf" && (
            <Link className="graphic-guide-text-action" to={{ pathname: location.pathname, search: location.search, hash: "#pdf-eksport" }}>
              Se eksport fra InDesign, Illustrator og Canva <ArrowRight aria-hidden="true" />
            </Link>
          )}
          <p className="graphic-guide-note">{lesson.note}</p>

          <footer className="graphic-guide-controls">
            <div className="graphic-guide-secondary-controls">
              <button type="button" className="graphic-guide-text-action" onClick={showTemplates}><FileText aria-hidden="true" /> Find produktets skabelon</button>
              {index > 0 && <button type="button" className="graphic-guide-back" onClick={() => showLesson(index - 1)}><ArrowLeft aria-hidden="true" /> Forrige</button>}
            </div>
            <div className="graphic-guide-next-controls">
              <span className="graphic-guide-progress" role="status" aria-live="polite">Trin {index + 1} af {graphicGuideLessons.length}</span>
              {nextLesson ? (
                <button type="button" className="graphic-guide-primary" onClick={() => showLesson(index + 1)}>Næste: {guide.lessons[nextLesson.id].label}<ArrowRight aria-hidden="true" /></button>
              ) : (
                <Link className="graphic-guide-primary" to={appendStorefrontTenantContext("/produkter")}>Find dit produkt<ArrowRight aria-hidden="true" /></Link>
              )}
            </div>
          </footer>
        </section>
      </div>

      <div className="graphic-guide-support">
        <details ref={templateRef} id="skabeloner" className="graphic-guide-disclosure">
          <summary><FileText aria-hidden="true" /><span>{guide.templateHeading}</span><ChevronDown aria-hidden="true" /></summary>
          <div className="graphic-guide-disclosure-body">
            <p>{guide.templateText}</p>
            <Link className="graphic-guide-text-action" to={appendStorefrontTenantContext("/produkter")}>Se produkter og skabeloner <ArrowRight aria-hidden="true" /></Link>
          </div>
        </details>
        <details ref={detailRef} className="graphic-guide-disclosure">
          <summary><Layers aria-hidden="true" /><span>{guide.detailHeading}</span><ChevronDown aria-hidden="true" /></summary>
          <div className="graphic-guide-disclosure-body">
            <p className="graphic-guide-detail-intro">{guide.detailIntro}</p>
            <GrafiskVejledningDetails contactPhone={phone || "Kontakt os"} contactEmail={email || ""} sections={guide.detailSections} />
          </div>
        </details>
        <div className="graphic-guide-help" id="kontakt">
          <p><HelpCircle aria-hidden="true" /><span>{guide.helpText} <Link to={appendStorefrontTenantContext("/kontakt")}>Kontakt os <ArrowRight aria-hidden="true" /></Link></span></p>
          {phone && <a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a>}
        </div>
      </div>
    </div>
  );
}

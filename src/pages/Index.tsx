/**
 * Platform Index Page (Landing Page)
 * 
 * Marketing landing page for webprinter.dk / www.webprinter.dk
 * Uses platform-specific header, footer, and slider.
 * Independent of demo shop and tenant data.
 */

import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart,
  Check,
  FileCheck,
  Globe,
  Layers,
  Package,
  PenTool,
  Settings2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { PlatformSlider } from "@/components/platform/PlatformSlider";
import { SEO } from "@/components/SEO";
import { OrganizationSchema } from "@/components/ProductSchema";
import { platformNavLink } from "@/lib/platform/context";

const PLATFORM_WORKFLOW = [
  {
    icon: Globe,
    step: "01",
    title: "White-label webshop",
    desc: "Kunderne møder dit brand, dit domæne og et produktkatalog, der kan målrettes hvert trykkeri eller tenant.",
    href: "/white-label",
  },
  {
    icon: BarChart,
    step: "02",
    title: "Produktvalg og pris",
    desc: "Format, materiale, oplag og tilvalg samles i et købsflow, så kunden kan forstå prisen før ordren sendes.",
    href: "/beregning",
  },
  {
    icon: PenTool,
    step: "03",
    title: "Designer og skabeloner",
    desc: "Kunden kan designe online, arbejde ud fra produktskabeloner eller hente PDF-skabeloner til eget designprogram.",
    href: "/online-designer",
  },
  {
    icon: FileCheck,
    step: "04",
    title: "Filer og preflight",
    desc: "Designfiler, PDF’er, beskæring, sikkerhedszoner og eksport er samlet omkring den konkrete tryksag.",
    href: "/online-designer",
  },
  {
    icon: Package,
    step: "05",
    title: "Ordre og produktion",
    desc: "Ordren kan følges fra checkout til intern behandling, produktion, status og genbestilling.",
    href: "/order-flow",
  },
  {
    icon: Users,
    step: "06",
    title: "B2B kundeportal",
    desc: "CompanyHub giver faste erhvervskunder adgang til godkendte produkter, designs og nem genbestilling.",
    href: "/online-designer",
  },
];

const PLATFORM_CAPABILITIES = [
  {
    icon: Settings2,
    title: "Admin styring",
    desc: "Administrer produkter, indhold, branding, kunder, SEO og shopindstillinger fra samme kontrolrum.",
  },
  {
    icon: Layers,
    title: "Tenant struktur",
    desc: "Kør flere shops, domæner eller nichebutikker på samme platform uden at blande deres visuelle udtryk.",
  },
  {
    icon: Check,
    title: "Print-fokuseret design",
    desc: "Systemet er bygget omkring tryksager, PDF-flow, skabeloner og produktkonfiguration, ikke generisk webshoplogik.",
  },
];

const Index = () => {
  const isLocalhost = typeof window !== "undefined"
    && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const masterDemoHref = isLocalhost
    ? "/shop?tenantId=00000000-0000-0000-0000-000000000000"
    : "/shop";

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <SEO />
      <OrganizationSchema />
      <PlatformHeader />

      {/* Hero Section */}
      <section className="relative flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/10 pt-16 pb-12 overflow-hidden" style={{ marginTop: '0', paddingTop: '120px' }}>
        <div className="container px-4 mx-auto text-center z-10">
          <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Webshop, prisberegner og ordreflow til trykkerier
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Webprinter Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Start en white-label printshop med produktkatalog, online designer,
            prisberegning og kundeportal samlet i ét system.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={platformNavLink("/opret-shop")}>
              <Button size="lg" className="h-12 px-8 text-lg gap-2">
                Start onboarding <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to={masterDemoHref}>
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                Se demo
              </Button>
            </Link>
          </div>

          <div className="mt-12">
            <PlatformSlider />
          </div>
        </div>
      </section>

      {/* Platform Workflow */}
      <section className="py-24 bg-white" id="funktioner">
        <div className="container px-4 mx-auto">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
              Fra produkt til ordre
            </p>
            <h2 className="text-3xl font-bold mb-4">Et samlet workflow til online tryksager</h2>
            <p className="text-muted-foreground">
              Webprinter binder kundens købsrejse sammen med de interne opgaver,
              som et trykkeri faktisk skal styre: produktvalg, pris, designfil,
              checkout, ordrestatus og genbestilling.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {PLATFORM_WORKFLOW.map((feature) => (
              <Link
                key={feature.title}
                to={platformNavLink(feature.href)}
                className="group flex min-h-[220px] flex-col rounded-lg border border-slate-200 bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-slate-400">{feature.step}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{feature.desc}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-primary">
                  Se modulet <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mx-auto mt-10 grid max-w-6xl gap-4 lg:grid-cols-3">
            {PLATFORM_CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                  <capability.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{capability.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{capability.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-gray-50">
        <div className="container px-4 mx-auto">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-2xl font-bold mb-3">Bygget på rigtig trykkeridrift</h2>
            <p className="text-muted-foreground">
              Platformen samler de workflows kunderne møder først: produktvalg, pris, design og ordre.
            </p>
          </div>
          <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
              <p className="text-3xl font-bold text-primary">15+ år</p>
              <p className="mt-2 text-sm text-muted-foreground">erfaring med online tryksager og produktflows</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
              <p className="text-3xl font-bold text-primary">Én shop</p>
              <p className="mt-2 text-sm text-muted-foreground">til katalog, prisberegning, design og ordrestatus</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
              <p className="text-3xl font-bold text-primary">B2B klar</p>
              <p className="mt-2 text-sm text-muted-foreground">med kundeportal, genbestilling og tenantstyring</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white">
        <div className="container px-4 mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Klar til at starte?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Opret konto først. Når din shop er oprettet, kan du vælge plan i admin og starte den 14 dages prøveperiode i Stripe.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={platformNavLink("/opret-shop")}>
              <Button size="lg" variant="secondary" className="gap-2">
                Start onboarding <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to={platformNavLink("/kontakt")}>
              <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10">
                Kontakt os
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PlatformFooter />
    </div>
  );
};

export default Index;

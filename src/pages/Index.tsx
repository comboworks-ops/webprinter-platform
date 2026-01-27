/**
 * Platform Index Page (Landing Page)
 * 
 * Marketing landing page for webprinter.dk / www.webprinter.dk
 * Uses platform-specific header, footer, and slider.
 * Independent of demo shop and tenant data.
 */

import { Link } from "react-router-dom";
import { ArrowRight, BarChart, Check, Globe, Layers, Package, PenTool, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { PlatformSlider } from "@/components/platform/PlatformSlider";
import { SEO } from "@/components/SEO";
import { OrganizationSchema } from "@/components/ProductSchema";

// Feature boxes linking to platform pages
const FEATURES = [
  {
    icon: Globe,
    title: "White Label Webshop",
    desc: "Dit brand, dit domæne. Fuldt tilpasselig kundevendt webshop.",
    href: "/white-label",
  },
  {
    icon: BarChart,
    title: "Smart Prisberegning",
    desc: "Komplekse matrix-beregninger for flyers, bannere og specialprodukter.",
    href: "/beregning",
  },
  {
    icon: Package,
    title: "Ordre Workflow",
    desc: "Strømlinet dashboard fra filtjek til produktion og forsendelse.",
    href: "/order-flow",
  },
  {
    icon: PenTool,
    title: "Online Designer",
    desc: "Professionel canvas-editor med soft proof og PDF-eksport.",
    href: "/online-designer",
  },
  {
    icon: Users,
    title: "CompanyHub (B2B)",
    desc: "Dedikeret portal til erhvervskunder med nem genbestilling.",
    href: "/online-designer",
  },
  {
    icon: Layers,
    title: "Skabeloner",
    desc: "Premade designs og skabeloner dine kunder kan tilpasse.",
    href: "/online-designer",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <SEO />
      <OrganizationSchema />
      <PlatformHeader />

      {/* Hero Section */}
      <section className="relative flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/10 pt-16 pb-12 overflow-hidden" style={{ marginTop: '0', paddingTop: '120px' }}>
        <div className="container px-4 mx-auto text-center z-10">
          <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Den komplette løsning til dit trykkeri
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Webprinter Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Gør din trykkeri-ekspertise til en skalerbar online forretning.
            Automatiseret prissætning, ordrehåndtering og kundeportaler i ét system.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/opret-shop">
              <Button size="lg" className="h-12 px-8 text-lg gap-2">
                Start gratis prøveperiode <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/shop">
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                Se demo
              </Button>
            </Link>
          </div>

          <div className="mt-12">
            <PlatformSlider />
          </div>
        </div>

        {/* Abstract shapes */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-5xl opacity-30 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl mix-blend-multiply" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl mix-blend-multiply" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white" id="funktioner">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Alt hvad du behøver for at drive dit trykkeri</h2>
            <p className="text-muted-foreground">Professionelle værktøjer bygget til trykkeribranchen.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {FEATURES.map((feature, i) => (
              <Link
                key={i}
                to={feature.href}
                className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-gray-50">
        <div className="container px-4 mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">Tillid fra trykkerier i hele Danmark</h2>
          <div className="flex flex-wrap justify-center gap-8 opacity-60">
            {/* Placeholder for logos */}
            <div className="w-32 h-12 bg-gray-300 rounded animate-pulse" />
            <div className="w-32 h-12 bg-gray-300 rounded animate-pulse" />
            <div className="w-32 h-12 bg-gray-300 rounded animate-pulse" />
            <div className="w-32 h-12 bg-gray-300 rounded animate-pulse" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white">
        <div className="container px-4 mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Klar til at starte?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Prøv Webprinter Platform gratis i 14 dage. Ingen kreditkort nødvendigt.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/opret-shop">
              <Button size="lg" variant="secondary" className="gap-2">
                Start gratis prøveperiode <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/kontakt">
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
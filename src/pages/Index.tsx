import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, BarChart, Globe } from "lucide-react";
import { Link } from "react-router-dom";

import { SEO } from "@/components/SEO";
import { OrganizationSchema } from "@/components/ProductSchema";
import { ProductMarquee } from "@/components/ProductMarquee";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <SEO />
      <OrganizationSchema />
      <Header />

      {/* Hero Section */}
      <section className="relative flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/10 pt-16 pb-20 overflow-hidden">
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
            <Link to="/prisberegner">
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                Se prisberegnere
              </Button>
            </Link>
          </div>

          <div className="mt-8">
            <ProductMarquee />
          </div>
        </div>

        {/* Abstract shapes */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-5xl opacity-30 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl mix-blend-multiply" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl mix-blend-multiply" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Alt hvad du behøver for at drive dit trykkeri</h2>
            <p className="text-muted-foreground">Professionelle værktøjer bygget til trykkeribranchen.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Globe className="w-6 h-6 text-primary" />,
                title: "Whitelabel Webshop",
                desc: "Dit brand, dit domæne. Fuldt tilpasselig kundevendt webshop."
              },
              {
                icon: <BarChart className="w-6 h-6 text-primary" />,
                title: "Smart Prisberegning",
                desc: "Komplekse matrix-beregninger for flyers, bannere og specialprodukter."
              },
              {
                icon: <Check className="w-6 h-6 text-primary" />,
                title: "Ordre Workflow",
                desc: "Strømlinet dashboard fra filtjek til produktion og forsendelse."
              }
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
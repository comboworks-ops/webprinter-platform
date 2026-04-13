import { ArrowRight, ExternalLink, Package, PauseCircle, ShieldCheck, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Pod3FlyerAlarm() {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <PauseCircle className="h-3.5 w-3.5" />
            Parkeret
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Isoleret fra storefront
          </Badge>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flyer Alarm (POD3)</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Denne workbench er bevidst lagt i POD-omradet og sat i bero. Den er ikke koblet til
            Site Design V2, og den renderer ikke laengere noget paa den offentlige shop.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Aktuel status</CardTitle>
            <CardDescription>
              FlyerAlarm ligger klar som et internt spor, uden at forstyrre de aktive flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-medium text-foreground">Hvad der er parkeret sikkert</p>
              <ul className="mt-2 space-y-2">
                <li>Ingen public storefront-visning fra FlyerAlarm.</li>
                <li>Ingen FlyerAlarm-sektion i Site Design V2.</li>
                <li>Denne side kalder ikke FlyerAlarm API'et automatisk.</li>
              </ul>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-medium text-foreground">Naeste gang arbejdet genoptages</p>
              <ul className="mt-2 space-y-2">
                <li>Genindfoer API explorer og katalogarbejde her, ikke i storefront.</li>
                <li>Afklar import-, produkt- og publiceringsflow foer noget gaar live.</li>
                <li>Hold POD3 adskilt fra eksisterende pris- og POD v1/v2-logik.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Hurtige genveje
            </CardTitle>
            <CardDescription>Brug POD-menuen som indgangspunkt til videre arbejde.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-between">
              <a href="/admin/pod">
                POD oversigt
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <a href="/admin/pod2">
                POD v2
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <a href="https://rest.flyeralarm-esolutions.com/docs/" target="_blank" rel="noreferrer">
                API docs
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <a href="https://startnow.flyeralarm.com/" target="_blank" rel="noreferrer">
                StartNOW portal
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Notat
          </CardTitle>
          <CardDescription>Denne side er en placeholder med vilje.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Naeste implementering af FlyerAlarm skal ske herfra i POD-omradet. Hvis der senere skal
          vaere offentlig eksponering, skal den kobles pa igen eksplicit og gennemgaes separat.
        </CardContent>
      </Card>
    </div>
  );
}


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Table as TableIcon, Hash, Ruler, MousePointerClick } from "lucide-react";

const pricingModules = [
    {
        id: 'matrix',
        name: 'Matrix (Pristabel)',
        description: 'Opslagstabel baseret på materiale og antal. Giver fuld kontrol over mængderabatter.',
        icon: <TableIcon className="h-5 w-5 text-blue-500" />,
        usage: 'Flyers, Visitkort, Foldere',
        status: 'Aktiv'
    },
    {
        id: 'rate',
        name: 'Rate (m2 pris)',
        description: 'Beregner pris pr. kvadratmeter med automatiske mængderabatter i trin.',
        icon: <Hash className="h-5 w-5 text-green-500" />,
        usage: 'Bannere, Skilte, Plakater',
        status: 'Aktiv'
    },
    {
        id: 'custom-dimensions',
        name: 'Fri Format (Lommeregner)',
        description: 'Lader kunden indtaste egne mål. Beregner areal og pris dynamisk.',
        icon: <Ruler className="h-5 w-5 text-purple-500" />,
        usage: 'Klistermærker på rulle, Folieudskæring',
        status: 'Aktiv'
    },
    {
        id: 'formula',
        name: 'Formel (Dynamisk)',
        description: 'Beregner prisen baseret på en matematisk formel (f.eks. sider + vægt).',
        icon: <Calculator className="h-5 w-5 text-orange-500" />,
        usage: 'Hæfter, Bøger, Salgsmapper',
        status: 'Aktiv'
    },
    {
        id: 'fixed',
        name: 'Fast Pris',
        description: 'En statisk pris for et produkt eller en serviceydelse.',
        icon: <MousePointerClick className="h-5 w-5 text-slate-500" />,
        usage: 'Grafisk assistance, Servicegebyr',
        status: 'Aktiv'
    }
];

export function PricingModules() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Prismoduler</h1>
                <p className="text-muted-foreground mt-1">
                    Administrer og konfigurer beregningsmetoder for dine produkter.
                </p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Tilgængelige Moduler</CardTitle>
                        <CardDescription>
                            Oversigt over de forskellige måder systemet kan beregne priser på.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[250px]">Modul</TableHead>
                                    <TableHead>Beskrivelse</TableHead>
                                    <TableHead>Typisk Anvendelse</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pricingModules.map((module) => (
                                    <TableRow key={module.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-muted rounded-lg">
                                                    {module.icon}
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{module.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono">{module.id}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[400px]">
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {module.description}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {module.usage.split(', ').map((u) => (
                                                    <Badge key={u} variant="outline" className="text-[10px]">
                                                        {u}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                                                {module.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-dashed">
                        <CardHeader>
                            <CardTitle className="text-lg">Konfigurer Global Avance</CardTitle>
                            <CardDescription>
                                Tilføj en procentvis avance på tværs af alle prismoduler.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground italic">
                                Denne funktion kommer snart...
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-dashed">
                        <CardHeader>
                            <CardTitle className="text-lg">Import/Eksport Regler</CardTitle>
                            <CardDescription>
                                Synkroniser dine prisregler med eksterne systemer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground italic">
                                Denne funktion kommer snart...
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

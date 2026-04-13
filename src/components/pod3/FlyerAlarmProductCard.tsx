import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ExternalLink } from "lucide-react";

interface FlyerAlarmProduct {
  id: number;
  name: string;
  description?: string;
  categories?: { id: number; name: string }[];
  orderable?: boolean;
}

interface FlyerAlarmProductCardProps {
  product: FlyerAlarmProduct;
}

export function FlyerAlarmProductCard({ product }: FlyerAlarmProductCardProps) {
  return (
    <Card className="flex flex-col h-full border-2 border-orange-200 hover:border-orange-300 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs shrink-0">
            <Package className="h-3 w-3 mr-1" />
            FA
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          {product.categories?.map(c => c.name).join(", ") || "Flyer Alarm Product"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="bg-muted rounded-md h-32 flex items-center justify-center mb-3">
          <Package className="h-12 w-12 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {product.description?.substring(0, 150)}...
        </p>
      </CardContent>

      <CardFooter className="pt-3 border-t flex flex-col gap-2">
        <div className="flex items-center gap-1 text-xs text-orange-600 mb-2">
          <ExternalLink className="h-3 w-3" />
          Powered by Flyer Alarm PRO
        </div>
        <Button 
          className="w-full bg-orange-600 hover:bg-orange-700"
          onClick={() => window.location.href = `/flyeralarm-produkt/${product.id}`}
        >
          Se produkt
        </Button>
        <Button 
          variant="outline" 
          className="w-full border-orange-200 hover:bg-orange-50"
          onClick={() => window.location.href = '/kontakt'}
        >
          Kontakt for tilbud
        </Button>
      </CardFooter>
    </Card>
  );
}

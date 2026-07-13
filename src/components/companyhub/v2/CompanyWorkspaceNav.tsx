import { Building2, LayoutDashboard, Package } from "lucide-react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CompanyWorkspaceView = "overview" | "products" | "locations";

const views: Array<{
  value: CompanyWorkspaceView;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { value: "overview", label: "Overblik", icon: LayoutDashboard },
  { value: "products", label: "Produkter", icon: Package },
  { value: "locations", label: "Kontorer", icon: Building2 },
];

export function CompanyWorkspaceNav() {
  return (
    <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0">
      {views.map((view) => {
        const Icon = view.icon;
        return (
          <TabsTrigger
            key={view.value}
            value={view.value}
            className="h-11 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {view.label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

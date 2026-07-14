import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

interface AdvancedToolsLinksProps {
  forceDomain: string | null;
}

const ADVANCED_TOOLS = [
  { href: "/admin/pod2", label: "Leverandør og API" },
  { href: "/admin/pod2-katalog", label: "Katalog og matrix" },
  { href: "/admin/pod2-ordrer", label: "Teknisk ordrebehandling" },
  { href: "/admin/pod2-betaling", label: "Historisk tenant-afregning" },
  { href: "/admin/pod", label: "POD v1" },
  { href: "/admin/pod3", label: "Flyer Alarm-arbejdsområde" },
] as const;

function withForceDomain(href: string, forceDomain: string | null): string {
  if (!forceDomain) return href;

  const params = new URLSearchParams({ force_domain: forceDomain });
  return `${href}?${params.toString()}`;
}

export function AdvancedToolsLinks({ forceDomain }: AdvancedToolsLinksProps) {
  return (
    <section aria-labelledby="print-production-advanced-tools" className="border-t pt-4">
      <h3 id="print-production-advanced-tools" className="text-sm font-medium text-muted-foreground">
        Avancerede værktøjer
      </h3>
      <nav aria-label="Avancerede produktionsværktøjer" className="mt-2">
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {ADVANCED_TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link
                to={withForceDomain(tool.href, forceDomain)}
                className="flex min-h-9 items-center justify-between gap-3 border-b py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span>{tool.label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

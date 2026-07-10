import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Loader2, MapPin, Package, Settings } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { path: "/min-konto", label: "Oversigt", icon: LayoutDashboard, end: true },
  { path: "/min-konto/ordrer", label: "Mine Ordrer", icon: Package },
  { path: "/min-konto/adresser", label: "Leveringsadresser", icon: MapPin },
  { path: "/min-konto/indstillinger", label: "Indstillinger", icon: Settings },
];

interface AccountLoadingShellProps {
  title?: string;
  description?: string;
}

export function AccountLoadingShell({
  title = "Min Konto",
  description = "Administrer dine oplysninger og indstillinger",
}: AccountLoadingShellProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-slate-50/70">
        <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <div className="mb-6 rounded-2xl border bg-white px-5 py-5 shadow-sm sm:mb-8 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="flex-shrink-0 lg:w-72">
              <nav className="grid grid-cols-1 gap-1 rounded-2xl border bg-white/95 p-2 shadow-sm backdrop-blur sm:grid-cols-2 lg:sticky lg:top-24 lg:grid-cols-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.end
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary !text-white shadow-sm ring-1 ring-primary/20 hover:!text-white [&_svg]:!text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Indlæser konto...
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

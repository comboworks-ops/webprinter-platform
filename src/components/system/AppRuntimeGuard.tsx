import { Component, type PropsWithChildren, useEffect, useState } from "react";
import { AlertTriangle, Home, Mail, RefreshCw } from "lucide-react";

type CrashFallbackProps = {
  source: "render" | "runtime";
};

type FatalRuntimeErrorState = {
  source: "runtime";
  message: string;
} | null;

type AppErrorBoundaryState = {
  error: Error | null;
};

const getReasonMessage = (reason: unknown) => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    return String((reason as { message?: unknown }).message || "Ukendt fejl");
  }
  return "Ukendt fejl";
};

const shouldSuppressUnhandledReason = (reason: unknown) => {
  const name = String((reason as { name?: unknown } | null)?.name || "");
  const message = getReasonMessage(reason).toLowerCase();
  const stack = String((reason as { stack?: unknown } | null)?.stack || "").toLowerCase();

  const isSupabaseRefreshFailure =
    name === "AuthRetryableFetchError"
    || (
      message.includes("failed to fetch")
      && (message.includes("grant_type=refresh_token") || stack.includes("supabase"))
    );

  const isSupabaseAbortError =
    name === "AbortError"
    || (
      message.includes("aborterror")
      && (message.includes("signal is aborted") || stack.includes("supabase"))
    );

  return isSupabaseRefreshFailure || isSupabaseAbortError;
};

const AppCrashFallback = ({ source }: CrashFallbackProps) => {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const path = typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200/80">
                Midlertidig fejl
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Siden kunne ikke vises korrekt lige nu
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
                Der opstod en fejl under indlæsning. Prøv at opdatere siden. Hvis problemet fortsætter,
                kan du kontakte os via kontaktsiden.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200/80">
              <p><span className="font-medium text-white">Side:</span> {path}</p>
              {host && <p><span className="font-medium text-white">Domæne:</span> {host}</p>}
              <p><span className="font-medium text-white">Type:</span> {source === "render" ? "visningsfejl" : "runtime-fejl"}</p>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-400"
              >
                <RefreshCw className="h-4 w-4" />
                Opdater siden
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <Home className="h-4 w-4" />
                Gå til forsiden
              </a>
              <a
                href="/kontakt"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <Mail className="h-4 w-4" />
                Kontakt os
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

class AppErrorBoundary extends Component<PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("[AppRuntimeGuard] Render crash captured", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return <AppCrashFallback source="render" />;
    }

    return this.props.children;
  }
}

export const AppRuntimeGuard = ({ children }: PropsWithChildren) => {
  const [fatalRuntimeError, setFatalRuntimeError] = useState<FatalRuntimeErrorState>(null);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (shouldSuppressUnhandledReason(event.reason)) {
        event.preventDefault();
        console.warn("[Auth] Suppressed unhandled Supabase rejection:", event.reason);
        return;
      }

      event.preventDefault();
      console.error("[AppRuntimeGuard] Unhandled rejection", event.reason);
      setFatalRuntimeError({
        source: "runtime",
        message: getReasonMessage(event.reason),
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (shouldSuppressUnhandledReason(event.error)) {
        return;
      }

      console.error("[AppRuntimeGuard] Window error", event.error || event.message);
      setFatalRuntimeError({
        source: "runtime",
        message: getReasonMessage(event.error || event.message),
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  if (fatalRuntimeError) {
    return <AppCrashFallback source={fatalRuntimeError.source} />;
  }

  return <AppErrorBoundary>{children}</AppErrorBoundary>;
};

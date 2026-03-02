import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { HelmetProvider } from 'react-helmet-async';

if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason as any;
        const name = String(reason?.name || '');
        const message = String(reason?.message || reason || '').toLowerCase();
        const stack = String(reason?.stack || '').toLowerCase();

        const isSupabaseRefreshFailure =
            name === 'AuthRetryableFetchError'
            || (
                message.includes('failed to fetch')
                && (message.includes('grant_type=refresh_token') || stack.includes('supabase'))
            );
        const isSupabaseAbortError =
            name === 'AbortError'
            || (
                message.includes('aborterror')
                && (message.includes('signal is aborted') || stack.includes('supabase'))
            );

        if (isSupabaseRefreshFailure || isSupabaseAbortError) {
            // Prevent transient Supabase auth transport failures from crashing runtime.
            event.preventDefault();
            console.warn('[Auth] Suppressed unhandled Supabase rejection:', reason);
        }
    });
}

createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
        <App />
    </HelmetProvider>
);

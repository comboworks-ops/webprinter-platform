# Product Card column alignment — 26 September 2026

Scope: `/admin/product/:slug#about` in the local checkout. The desktop editor and live preview now use one grid height. The editor retains its own vertical scroll; the preview frame fills the remaining height. At 900px and below the existing stacked layout remains.

Verification: `vite build` passed in this checkout. Static review covered the 901px desktop boundary and the 900px stacked boundary. Browser measurements and screenshots remain unverified: the local admin server was unavailable, Playwright's bundled browser was absent, and the installed Chrome exited under the sandbox. No admin saves or live data writes were made.

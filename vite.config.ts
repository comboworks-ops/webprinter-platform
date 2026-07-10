import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execFileSync } from "child_process";
import { componentTagger } from "lovable-tagger";

function cleanDistBeforeBuild() {
  return {
    name: "clean-dist-before-build",
    apply: "build" as const,
    enforce: "pre" as const,
    configResolved(config: any) {
      const outDir = path.resolve(config.root, config.build.outDir || "dist");
      if (outDir === config.root || !outDir.startsWith(`${config.root}${path.sep}`)) return;
      execFileSync("rm", ["-rf", outDir]);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    emptyOutDir: false,
  },
  // Keep Vite cache outside node_modules to avoid cache corruption
  // when dependencies change during local tooling/import runs.
  cacheDir: ".vite",
  server: {
    host: "::",
    port: 8080,
    watch: {
      // Avoid HMR storms from backup/docs churn (common in synced folders)
      ignored: ["**/src/backup-*/**", "**/docs/**", "**/.git/**"],
      usePolling: true,
      interval: 1000,
    },
  },
  plugins: [cleanDistBeforeBuild(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

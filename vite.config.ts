import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { defineConfig } from "vite";

const ASSETS_CDN_PLACEHOLDER = "%VITE_ASSETS_CDN_BASE%";

function getAssetsBase(): string {
  return process.env.VITE_ASSETS_CDN_BASE ?? "";
}

export default defineConfig({
  resolve: {
    alias: {
      "@": join(process.cwd(), "src"),
      "~lib": join(process.cwd(), "lib"),
    },
  },
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        policy: resolve(process.cwd(), "policy.html"),
        terms: resolve(process.cwd(), "terms.html"),
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.split("\\").join("/");
          if (normalizedId.includes("/node_modules/three/examples/jsm/")) {
            return "three-examples";
          }
          if (normalizedId.includes("/node_modules/three/")) {
            return "three";
          }
          if (normalizedId.includes("/node_modules/howler/")) {
            return "howler";
          }
          return undefined;
        },
      },
    },
  },
  esbuild: {
    jsxFactory: "h",
    jsxFragment: "Fragment",
    jsxInject: 'import { h, Fragment } from "~lib/jsx-runtime"',
  },
  plugins: [
    {
      name: "assets-cdn-env",
      transformIndexHtml(html) {
        return html.replace(
          new RegExp(ASSETS_CDN_PLACEHOLDER.replace(/%/g, "\\%"), "g"),
          getAssetsBase(),
        );
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (
            req.url !== "/site.webmanifest" &&
            req.url !== "/site.webmanifest/"
          ) {
            next();
            return;
          }
          const manifestPath = join(
            process.cwd(),
            "public",
            "site.webmanifest",
          );
          let manifest = readFileSync(manifestPath, "utf-8");
          manifest = manifest.replace(
            new RegExp(ASSETS_CDN_PLACEHOLDER.replace(/%/g, "\\%"), "g"),
            getAssetsBase(),
          );
          res.setHeader("Content-Type", "application/manifest+json");
          res.end(manifest);
        });
      },
      closeBundle() {
        const manifestPath = join(process.cwd(), "public", "site.webmanifest");
        const outPath = join(process.cwd(), "dist", "site.webmanifest");
        let manifest = readFileSync(manifestPath, "utf-8");
        manifest = manifest.replace(
          new RegExp(ASSETS_CDN_PLACEHOLDER.replace(/%/g, "\\%"), "g"),
          getAssetsBase(),
        );
        writeFileSync(outPath, manifest);
      },
    },
  ],
});

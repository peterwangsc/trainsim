import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { defineConfig } from "vite";

const ASSETS_CDN_PLACEHOLDER = "%VITE_ASSETS_CDN_BASE%";

function getAssetsBase(): string {
  return process.env.VITE_ASSETS_CDN_BASE ?? "";
}

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
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
  plugins: [
    {
      name: "assets-cdn-env",
      transformIndexHtml(html) {
        return html.replace(
          new RegExp(ASSETS_CDN_PLACEHOLDER.replace(/%/g, "\\%"), "g"),
          getAssetsBase()
        );
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== "/site.webmanifest" && req.url !== "/site.webmanifest/") {
            next();
            return;
          }
          const manifestPath = join(process.cwd(), "public", "site.webmanifest");
          let manifest = readFileSync(manifestPath, "utf-8");
          manifest = manifest.replace(
            new RegExp(ASSETS_CDN_PLACEHOLDER.replace(/%/g, "\\%"), "g"),
            getAssetsBase()
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
          getAssetsBase()
        );
        writeFileSync(outPath, manifest);
      },
    },
  ],
});

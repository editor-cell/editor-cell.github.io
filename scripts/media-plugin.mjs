import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { siteServer } from "./site-server.mjs";

export const MEDIA_DIRS = ["images", "audio", "videos"];
function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** Repository media is the one source; Vite emits it at the same public addresses. */
export function mediaPlugin() {
  let root;
  return {
    name: "orbis:media",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      const media = siteServer(root);
      server.middlewares.use((req, res, next) => {
        if (/^\/(images|audio|videos)\//.test(req.url ?? "")) media.emit("request", req, res);
        else next();
      });
    },
    generateBundle() {
      if (this.environment.name !== "client") return;
      for (const dir of MEDIA_DIRS) {
        for (const path of files(join(root, dir))) {
          this.emitFile({
            type: "asset",
            fileName: relative(root, path).replaceAll("\\", "/"),
            source: readFileSync(path),
          });
        }
      }
    },
  };
}

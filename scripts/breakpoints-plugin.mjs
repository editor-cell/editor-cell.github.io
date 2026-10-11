import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BREAKPOINTS, MEDIA } from "../src/lib/breakpoints.ts";

/** Generate Tailwind thresholds and custom media for its Lightning CSS compiler. */
export function breakpointsPlugin() {
  return {
    name: "orbis-breakpoints",
    configResolved(config) {
      const utilities = {
        sm: BREAKPOINTS.small,
        md: BREAKPOINTS.desktop,
        lg: BREAKPOINTS.large,
        xl: BREAKPOINTS.wide,
        "2xl": BREAKPOINTS.extraWide,
      };
      const css =
        "/* Generated from src/lib/breakpoints.ts; do not edit. */\n" +
        Object.entries(MEDIA)
          .map(([name, query]) => `@custom-media --orbis-${name} ${query};`)
          .join("\n") +
        "\n@theme {" +
        Object.entries(utilities)
          .map(([name, width]) => `--breakpoint-${name}: ${width}px;`)
          .join("") +
        "}\n";
      const path = join(config.root, "src/styles/breakpoints.generated.css");
      if (!existsSync(path) || readFileSync(path, "utf8") !== css) writeFileSync(path, css);
    },
  };
}

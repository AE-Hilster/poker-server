import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { name } from "../package.json";
import { emptyDir } from "fs-extra";

(async () => {
  console.time("Build Complete");
  console.time("Build directory cleared");
  await emptyDir("./build");
  console.timeEnd("Build directory cleared");
  await Promise.all([
    build({
      bundle: true,
      platform: "node",
      entryPoints: ["src/index.ts"],
      external: ["express", "express-session", "socket.io"],
      format: "esm",
      globalName: "POKER_CLIENT",
      legalComments: "none",
      logLevel: "info",
      minify: false,
      outfile: `build/${name}.mjs`,
      plugins: [
        copy({
          resolveFrom: "cwd",
          assets: [
            {
              from: ["./src/config/*.json"],
              to: ["./build/config"]
            },
          ]        
        }),
      ],
      sourcemap: true
    })
  ]);
  console.timeEnd("Build Complete");
})();
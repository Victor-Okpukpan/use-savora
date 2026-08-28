import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rootNodeFromAnchor, type AnchorIdl } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { createFromRoot } from "codama";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");

const idl = JSON.parse(
  readFileSync(join(repo, "target/idl/savora.json"), "utf8"),
) as AnchorIdl;

const codama = createFromRoot(rootNodeFromAnchor(idl));
const out = join(repo, "web/src/generated");

await codama.accept(renderVisitor(out, { generatedFolder: "." }));

// The renderer also syncs a package.json into the output dir; we consume the
// client as plain source inside the Next app, so drop it.
rmSync(join(out, "package.json"), { force: true });

console.log(`Generated Savora client → ${out}`);

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, "..");
const projectDir = path.resolve(serverDir, "..");
const outputDir = path.resolve(serverDir, ".design-output");
const assetDir = path.join(projectDir, "static", "lanhu", "device-detail");
const designUrl = process.argv[2];

if (!designUrl) {
  throw new Error("Usage: node scripts/export-design.mjs <lanhu-url>");
}

await mkdir(outputDir, { recursive: true });
await mkdir(assetDir, { recursive: true });

const transport = new StdioClientTransport({
  command: "C:\\Windows\\System32\\cmd.exe",
  args: ["/d", "/s", "/c", "run-stdio.bat"],
  cwd: serverDir,
  stderr: "pipe",
});
const client = new Client({ name: "lanhu-design-export", version: "1.0.0" });

try {
  await client.connect(transport);

  const analysis = await client.callTool({
    name: "lanhu_design",
    arguments: {
      url: designUrl,
      mode: "analyze",
      design_names: "all",
      include: ["html", "tokens", "layout", "layers", "slices"],
      layer_depth: "all",
    },
  });
  await writeFile(
    path.join(outputDir, "analysis.json"),
    JSON.stringify(analysis, null, 2),
    "utf8",
  );

  const assetNames = ["hero.png", "basic.png", "location.png", "history.png", "attribute.png"];
  const slices = analysis.structuredContent?.designs?.[0]?.slices?.slices ?? [];
  await Promise.all(slices.map(async (slice, index) => {
    const response = await fetch(slice.downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${slice.name}: HTTP ${response.status}`);
    }
    await writeFile(
      path.join(assetDir, assetNames[index] ?? `slice-${index + 1}.png`),
      Buffer.from(await response.arrayBuffer()),
    );
  }));

  const preview = await client.callTool({
    name: "lanhu_design",
    arguments: {
      url: designUrl,
      mode: "analyze",
      design_names: "all",
      include: ["image"],
    },
  });
  const image = preview.content?.find((item) => item.type === "image");
  if (!image) {
    throw new Error("Lanhu returned no preview image");
  }
  const extension = image.mimeType === "image/jpeg" ? "jpg" : "png";
  await writeFile(path.join(outputDir, `preview.${extension}`), Buffer.from(image.data, "base64"));
  await writeFile(
    path.join(outputDir, "preview.json"),
    JSON.stringify({ ...preview, content: preview.content?.filter((item) => item.type !== "image") }, null, 2),
    "utf8",
  );

  console.log(`Exported Lanhu analysis and preview to ${outputDir}`);
} finally {
  await client.close();
}

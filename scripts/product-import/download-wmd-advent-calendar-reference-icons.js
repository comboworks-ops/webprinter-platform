#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const runDir = path.resolve(
  process.cwd(),
  process.argv[2] || "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z",
);
const outputDir = path.join(runDir, "reference-icons");
fs.mkdirSync(outputDir, { recursive: true });

const manifests = fs
  .readdirSync(path.join(runDir, "families"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const manifestPath = path.join(runDir, "families", entry.name, "import-manifest.json");
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  });

const jobs = [];
for (const manifest of manifests) {
  for (const group of manifest.optionGroups || []) {
    for (const value of group.values || []) {
      if (!value.icon?.referenceUrl) continue;
      jobs.push({
        slug: manifest.product.slugDa,
        group: group.key,
        value: value.key,
        labelDa: value.labelDa,
        url: value.icon.referenceUrl,
      });
    }
  }
}

for (const job of jobs) {
  const response = await fetch(job.url);
  if (!response.ok) throw new Error(`${response.status} ${job.url}`);
  const contentType = response.headers.get("content-type") || "";
  const extension = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") ? "jpg" : "png";
  const fileName = `${job.slug}--${job.group}--${job.value}.${extension}`;
  fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(await response.arrayBuffer()));
  job.file = fileName;
  job.contentType = contentType;
}

fs.writeFileSync(
  path.join(outputDir, "index.json"),
  `${JSON.stringify({ downloadedAt: new Date().toISOString(), jobs }, null, 2)}\n`,
);
console.log(JSON.stringify({ outputDir, downloaded: jobs.length }, null, 2));

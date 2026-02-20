import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function writeRawSnapshot({ repoRoot, slug, timestamp, payload }) {
  const dir = path.join(repoRoot, "pricing_raw", slug);
  ensureDir(dir);
  const filePath = path.join(dir, `${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function writeCleanCsv({ repoRoot, slug, timestamp, rows }) {
  const dir = path.join(repoRoot, "pricing_clean", slug);
  ensureDir(dir);
  const filePath = path.join(dir, `${timestamp}.csv`);

  const header = [
    "source_index",
    "quantity",
    "eur",
    "dkk_base",
    "tier_multiplier",
    "dkk_final",
    "li_text",
  ];

  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        row.source_index,
        row.quantity,
        row.eur,
        row.dkk_base,
        row.tier_multiplier,
        row.dkk_final,
        row.li_text,
      ]
        .map(csvEscape)
        .join(",")
    );
  });

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

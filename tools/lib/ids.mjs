// Stable ids for generated items. The first time an item is generated it gets
// the next free number; after that the same key always maps to the same id,
// even if other items are added or removed. Stored in tools/src/ids-*.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function idRegistry(name, prefix, start) {
  const file = path.join(here, "..", "src", `ids-${name}.json`);
  const map = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  let next = Math.max(start - 1, ...Object.values(map).map((id) => Number(id.slice(prefix.length)))) + 1;
  return {
    peek: (key) => map[key] || `${prefix}${next}`,
    take(key) {
      if (!map[key]) map[key] = `${prefix}${next++}`;
      return map[key];
    },
    save() {
      const sorted = Object.fromEntries(Object.entries(map).sort((a, b) => Number(a[1].slice(prefix.length)) - Number(b[1].slice(prefix.length))));
      fs.writeFileSync(file, JSON.stringify(sorted, null, 1) + "\n");
    },
  };
}

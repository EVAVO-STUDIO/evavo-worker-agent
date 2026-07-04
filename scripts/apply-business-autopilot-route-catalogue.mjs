import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const targetPath = path.join(repoRoot, 'src/routes/routeCataloguePlanner.ts');

if (!fs.existsSync(targetPath)) {
  console.error('Missing src/routes/routeCataloguePlanner.ts');
  process.exit(1);
}

let content = fs.readFileSync(targetPath, 'utf8');
const importLine = 'import { businessAutopilotRouteCatalogue } from "./businessAutopilotRouteCatalogue";';
const spreadLine = '  ...businessAutopilotRouteCatalogue,';

if (!content.includes(importLine)) {
  content = content.replace('import { RouteCatalogueItem, route } from "./routeCatalogueTypes";\n', `import { RouteCatalogueItem, route } from "./routeCatalogueTypes";\n${importLine}\n`);
}

if (!content.includes(spreadLine)) {
  const anchor = '  route({ id: "zero_source_route_map"';
  const index = content.indexOf(anchor);
  if (index === -1) {
    console.error('Could not find zero_source_route_map anchor in routeCataloguePlanner.ts');
    process.exit(1);
  }
  const lineEnd = content.indexOf('\n', index);
  if (lineEnd === -1) {
    console.error('Could not find end of zero_source_route_map line in routeCataloguePlanner.ts');
    process.exit(1);
  }
  content = `${content.slice(0, lineEnd + 1)}${spreadLine}\n${content.slice(lineEnd + 1)}`;
}

fs.writeFileSync(targetPath, content);
console.log('Applied Business Autopilot route catalogue wiring.');

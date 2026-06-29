import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const indexPath = path.join(repoRoot, 'src/index.ts');

if (!fs.existsSync(indexPath)) {
  console.error(`Missing ${indexPath}`);
  process.exit(1);
}

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

function addImport(importLine, anchor) {
  if (source.includes(importLine)) {
    console.log(`OK   import already present: ${importLine}`);
    return;
  }
  if (!source.includes(anchor)) {
    console.error(`FAIL import anchor not found: ${anchor}`);
    process.exit(1);
  }
  source = source.replace(anchor, `${anchor}\n${importLine}`);
  changed = true;
  console.log(`ADD  ${importLine}`);
}

function addRoute(routeLine, anchor) {
  if (source.includes(routeLine)) {
    console.log(`OK   route already present: ${routeLine}`);
    return;
  }
  if (!source.includes(anchor)) {
    console.error(`FAIL route anchor not found: ${anchor}`);
    process.exit(1);
  }
  source = source.replace(anchor, `${routeLine}\n      ${anchor}`);
  changed = true;
  console.log(`ADD  ${routeLine.trim()}`);
}

addImport('import { handleGrowthCapabilitiesAdmin } from "./routes/growthCapabilitiesAdmin";', 'import { handleGrowthAdmin } from "./routes/growthAdmin";');
addImport('import { handleGrowthCampaignIntelligenceAdmin } from "./routes/growthCampaignIntelligenceAdmin";', 'import { handleGrowthCapabilitiesAdmin } from "./routes/growthCapabilitiesAdmin";');

const genericGrowthRoute = 'if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/")) return await handleGrowthAdmin(req, env, pathname, jsonResponse);';

addRoute('      if (pathname === "/admin/growth/capabilities") return await handleGrowthCapabilitiesAdmin(req, env, pathname, jsonResponse);', genericGrowthRoute);
addRoute('      if (pathname === "/admin/growth/cycle" || pathname === "/admin/growth/operator" || pathname === "/admin/growth/campaigns" || pathname === "/admin/growth/experiments" || pathname === "/admin/growth/decisions" || pathname === "/admin/growth/decisions/plan" || pathname === "/admin/growth/metrics" || pathname === "/admin/growth/evidence" || pathname === "/admin/growth/learning") return await handleGrowthCampaignIntelligenceAdmin(req, env, pathname, jsonResponse);', genericGrowthRoute);

if (changed) {
  fs.writeFileSync(indexPath, source);
  console.log('Growth operator route wiring applied to src/index.ts.');
} else {
  console.log('Growth operator route wiring was already up to date.');
}

const baseUrl = process.env.NEXT_OPS_BASE_URL || 'http://localhost:3000';

const commands = [
  {
    label: 'Read current autonomy settings through the Next ops proxy',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/settings" | ConvertTo-Json -Depth 100`,
  },
  {
    label: 'Run review-first source expansion learning',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/source-expansion/learn" ` +
      '`\n  -Method POST `\n  -Headers @{ "Content-Type" = "application/json" } `\n  -Body "{`"confirm`":true}" `\n  | ConvertTo-Json -Depth 100',
  },
  {
    label: 'Read strategy scores and confirm origin-yield fields are present',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/source-expansion/strategies?limit=50" | ConvertTo-Json -Depth 100`,
  },
  {
    label: 'Read source origin metrics',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/source-origin-metrics" | ConvertTo-Json -Depth 100`,
  },
  {
    label: 'Read public-link-origin saved sources only',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/opportunity-sources?origin=public_link_graph&limit=50" | ConvertTo-Json -Depth 100`,
  },
  {
    label: 'Read sitemap-origin saved sources only',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/opportunity-sources?origin=sitemap&limit=50" | ConvertTo-Json -Depth 100`,
  },
  {
    label: 'Read query-hint-origin saved sources only',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/opportunity-sources?origin=query_hint&limit=50" | ConvertTo-Json -Depth 100`,
  },
  {
    label: 'Read manual-or-unknown saved sources only',
    command: `Invoke-RestMethod "${baseUrl}/api/ops/outbound-agent/opportunity-sources?origin=manual_or_unknown&limit=50" | ConvertTo-Json -Depth 100`,
  },
];

console.log('# Next ops smoke commands');
console.log('# Assumes the Next app is running locally. Set NEXT_OPS_BASE_URL to override the base URL.');
console.log('# These commands read review/diagnostic state and run the explicit learning endpoint only.');
console.log('# They do not enable sending, draft generation, private-data collection, or automatic promotion.');
console.log('');
for (const item of commands) {
  console.log(`# ${item.label}`);
  console.log(item.command);
  console.log('');
}
console.log('Expected checks:');
console.log('- settings.freeSafeOnly should remain true unless Greg explicitly changes it.');
console.log('- learning response should include originAware: true, publicLinkGraphAware: true, originYieldPersisted: true.');
console.log('- strategy response should include originYieldPersisted: true and origin_* count fields.');
console.log('- source filter responses should include filters.originFilterSupported: true.');

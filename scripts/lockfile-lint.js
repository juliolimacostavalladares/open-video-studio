const fs = require('fs');
const path = require('path');

const lockfilePath = path.join(process.cwd(), 'pnpm-lock.yaml');
if (!fs.existsSync(lockfilePath)) {
  console.error('❌ pnpm-lock.yaml not found!');
  process.exit(1);
}

const content = fs.readFileSync(lockfilePath, 'utf8');

// Allowed hosts for official npm registry dependencies
const ALLOWED_HOSTS = ['registry.npmjs.org', 'registry.yarnpkg.com'];

// Regex to capture all HTTP/HTTPS urls inside the lockfile
const urlRegex = /https?:\/\/[^\/\s\)\"\']+/g;
const urls = [];

const lines = content.split('\n');
for (const line of lines) {
  // Skip deprecation warnings and general metadata URLs
  if (
    line.includes('deprecated:') ||
    line.includes('homepage:') ||
    line.includes('bugs:') ||
    line.includes('funding:')
  ) {
    continue;
  }
  const matches = line.match(urlRegex);
  if (matches) {
    urls.push(...matches);
  }
}

let hasErrors = false;

for (const urlStr of urls) {
  try {
    const url = new URL(urlStr);
    const isAllowed = ALLOWED_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith('.' + host),
    );

    if (!isAllowed) {
      console.error(
        `❌ Insecure or unauthorized registry host found in pnpm-lock.yaml: ${url.hostname} (URL: ${urlStr})`,
      );
      hasErrors = true;
    }

    if (url.protocol !== 'https:') {
      console.error(
        `❌ Insecure protocol found in pnpm-lock.yaml (must use HTTPS): ${urlStr}`,
      );
      hasErrors = true;
    }
  } catch (e) {
    console.error(`⚠️ Failed to parse URL found in pnpm-lock.yaml: ${urlStr}`);
  }
}

if (hasErrors) {
  console.error('❌ Lockfile validation failed!');
  process.exit(1);
} else {
  console.log(
    '✅ Lockfile validation passed. All dependencies point exclusively to official npm/yarn HTTPS registries.',
  );
  process.exit(0);
}

import { execFileSync, spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryCapture(command, args) {
  try {
    return capture(command, args);
  } catch {
    return "";
  }
}

function unique(values) {
  return [...new Set(values)];
}

function resolveBaseRef() {
  const upstream = tryCapture("git", [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);
  if (upstream) {
    return upstream;
  }

  const originMaster = tryCapture("git", [
    "rev-parse",
    "--verify",
    "origin/master",
  ]);
  if (originMaster) {
    return "origin/master";
  }

  const previousHead = tryCapture("git", ["rev-parse", "--verify", "HEAD~1"]);
  if (previousHead) {
    return "HEAD~1";
  }

  return "";
}

function parseLines(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listChangedFiles(baseRef) {
  const comparedToBase = baseRef
    ? parseLines(
        tryCapture("git", ["diff", "--name-only", `${baseRef}...HEAD`]),
      )
    : [];
  if (comparedToBase.length > 0) {
    return {
      changedFiles: comparedToBase,
      comparisonLabel: baseRef,
    };
  }

  const workingTreeFiles = parseLines(
    tryCapture("git", ["diff", "--name-only", "HEAD"]),
  );
  const untrackedFiles = parseLines(
    tryCapture("git", ["ls-files", "--others", "--exclude-standard"]),
  );
  const localFiles = unique([...workingTreeFiles, ...untrackedFiles]);

  return {
    changedFiles: localFiles,
    comparisonLabel: "HEAD (working tree)",
  };
}

function matchesAny(path, patterns) {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) {
      return path.startsWith(pattern);
    }

    return path === pattern;
  });
}

function isSourceLikeFile(path) {
  return /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(path);
}

function isUnitTestFile(path) {
  return (
    /\.test\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(path) &&
    !path.startsWith("tests/integration/")
  );
}

function isRelevantWorkspaceChange(path) {
  return (
    path.startsWith("apps/") ||
    path.startsWith("packages/") ||
    path.startsWith("tests/") ||
    matchesAny(path, [
      "package.json",
      "pnpm-lock.yaml",
      "playwright.config.ts",
      "vitest.unit.config.ts",
      "vitest.integration.config.ts",
      "docker-compose.database.yml",
      "docker-compose.infrastructure.yml",
    ])
  );
}

function shouldRunFullUnitSuite(changedFiles) {
  return changedFiles.some((path) =>
    matchesAny(path, [
      "package.json",
      "pnpm-lock.yaml",
      "vitest.unit.config.ts",
      "packages/config/src/index.ts",
      "packages/eslint-config/",
      "packages/tsconfig/",
    ]),
  );
}

function selectUnitTestFiles(changedFiles) {
  return unique(changedFiles.filter((path) => isUnitTestFile(path)));
}

function selectUnitSourceFiles(changedFiles) {
  return unique(
    changedFiles.filter((path) => {
      if (!isSourceLikeFile(path) || isUnitTestFile(path)) {
        return false;
      }

      return path.startsWith("apps/") || path.startsWith("packages/");
    }),
  );
}

function shouldRunIntegrationSuite(changedFiles) {
  return changedFiles.some((path) =>
    matchesAny(path, [
      "package.json",
      "pnpm-lock.yaml",
      "docker-compose.database.yml",
      "docker-compose.infrastructure.yml",
      "vitest.integration.config.ts",
      "tests/helpers/",
      "tests/integration/",
      "apps/api/",
      "packages/database/",
      "packages/infrastructure/",
      "packages/config/",
    ]),
  );
}

function shouldRunFullE2ESuite(changedFiles) {
  return changedFiles.some((path) =>
    matchesAny(path, [
      "package.json",
      "pnpm-lock.yaml",
      "playwright.config.ts",
      "tests/fixtures/",
      "apps/web/",
      "apps/api/",
      "packages/database/",
      "packages/infrastructure/",
      "packages/config/",
    ]),
  );
}

function selectChangedE2ETestFiles(changedFiles) {
  return unique(changedFiles.filter((path) => path.startsWith("tests/e2e/")));
}

const baseRef = resolveBaseRef();
const { changedFiles, comparisonLabel } = listChangedFiles(baseRef);

if (changedFiles.length === 0) {
  console.log("No changed files detected. Skipping pre-push validation.");
  process.exit(0);
}

console.log(`Comparing changes against ${comparisonLabel}`);
console.log("Changed files:");
for (const file of changedFiles) {
  console.log(`- ${file}`);
}

const relevantFiles = changedFiles.filter(isRelevantWorkspaceChange);
if (relevantFiles.length === 0) {
  console.log(
    "No app, package, or test changes detected. Skipping pre-push validation.",
  );
  process.exit(0);
}

run("pnpm", ["build"]);
run("pnpm", ["typecheck"]);

if (shouldRunFullUnitSuite(changedFiles)) {
  run("pnpm", ["test:unit"]);
} else {
  const changedUnitTests = selectUnitTestFiles(changedFiles);
  if (changedUnitTests.length > 0) {
    run("pnpm", [
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.unit.config.ts",
      ...changedUnitTests,
    ]);
  } else {
    const unitSourceFiles = selectUnitSourceFiles(changedFiles);
    if (unitSourceFiles.length > 0) {
      run("pnpm", [
        "exec",
        "vitest",
        "related",
        "--run",
        "--config",
        "vitest.unit.config.ts",
        ...unitSourceFiles,
      ]);
    }
  }
}

if (shouldRunIntegrationSuite(changedFiles)) {
  run("pnpm", ["test:integration"]);
}

const changedE2ETests = selectChangedE2ETestFiles(changedFiles);
if (changedE2ETests.length > 0 && !shouldRunFullE2ESuite(changedFiles)) {
  run("pnpm", ["exec", "playwright", "test", ...changedE2ETests]);
} else if (shouldRunFullE2ESuite(changedFiles)) {
  run("pnpm", ["test:e2e"]);
}

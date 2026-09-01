import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The bits of `package.json` that end up in the OpenAPI `info` block.
 *
 * The version is read from the manifest rather than hard-coded so that a
 * released image and the document it serves can never disagree: `npm version`
 * is the single place a version number lives.
 */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
  readonly description: string;
}

/**
 * Used only when the manifest genuinely cannot be read. Serving a document with
 * a placeholder version is strictly better than failing to boot the API over
 * cosmetic metadata, and the `0.0.0` is an obvious "look at your image layout"
 * signal rather than a plausible-looking lie.
 */
export const PACKAGE_INFO_FALLBACK: PackageInfo = {
  name: 'orders-api',
  version: '0.0.0',
  description: 'NestJS orders service for the shopping-list assignment.',
};

/** How far up the tree to look before giving up (src/common -> repo root). */
const MAX_ASCENT = 6;

/**
 * Walks **up** from `startDir` looking for the nearest `package.json`.
 *
 * The same trick `ElasticsearchIndexBootstrap` uses for the index mapping, and
 * for the same reason: the file sits at `apps/orders-api/package.json` under
 * ts-jest (`src/common/`), at `../package.json` after `nest build`
 * (`dist/common/`) and at `/app/package.json` in the container. One search
 * beats three hard-coded `../` chains.
 */
export function findPackageJson(startDir: string = __dirname): string | undefined {
  let current = startDir;
  for (let depth = 0; depth <= MAX_ASCENT; depth++) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
  return undefined;
}

/**
 * Reads `name`, `version` and `description` from the nearest manifest, falling
 * back to {@link PACKAGE_INFO_FALLBACK} field by field. A missing or malformed
 * manifest is never fatal.
 */
export function readPackageInfo(startDir: string = __dirname): PackageInfo {
  const path = findPackageJson(startDir);
  if (!path) {
    return PACKAGE_INFO_FALLBACK;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<PackageInfo>;
    return {
      name: parsed.name ?? PACKAGE_INFO_FALLBACK.name,
      version: parsed.version ?? PACKAGE_INFO_FALLBACK.version,
      description: parsed.description ?? PACKAGE_INFO_FALLBACK.description,
    };
  } catch {
    return PACKAGE_INFO_FALLBACK;
  }
}

/** Resolved once at module load; the manifest cannot change while we run. */
export const PACKAGE_INFO: PackageInfo = readPackageInfo();

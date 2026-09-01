import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';

import manifest from '../../package.json';
import {
  PACKAGE_INFO,
  PACKAGE_INFO_FALLBACK,
  findPackageJson,
  readPackageInfo,
} from './package-info';

/** A path deep enough that the upward walk gives up before any real manifest. */
function unmanifestedDir(): string {
  return join(
    mkdtempSync(join(tmpdir(), 'pkg-info-empty-')),
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
  );
}

describe('package-info', () => {
  describe('findPackageJson', () => {
    it('finds the service manifest by walking up from a source directory', () => {
      const found = findPackageJson(__dirname);
      expect(found).toBeDefined();
      expect(found?.endsWith('package.json')).toBe(true);
      const contents = JSON.parse(readFileSync(found as string, 'utf8')) as {
        name: string;
      };
      expect(contents.name).toBe(manifest.name);
    });

    it('defaults to searching upwards from its own directory', () => {
      expect(findPackageJson()).toBe(findPackageJson(__dirname));
    });

    it('gives up after the maximum ascent instead of walking to the root', () => {
      expect(findPackageJson(unmanifestedDir())).toBeUndefined();
    });

    it('stops at the filesystem root rather than looping forever', () => {
      const root = parse(process.cwd()).root;
      const found = findPackageJson(root);
      // Either there is a manifest at the root (unusual) or the walk terminates.
      expect(found === undefined || found === join(root, 'package.json')).toBe(true);
    });
  });

  describe('readPackageInfo', () => {
    it('reads name, version and description from the real manifest', () => {
      expect(readPackageInfo(__dirname)).toEqual({
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
      });
    });

    it('falls back when there is no manifest to read', () => {
      expect(readPackageInfo(unmanifestedDir())).toEqual(PACKAGE_INFO_FALLBACK);
    });

    it('falls back when the manifest is not valid JSON', () => {
      const dir = mkdtempSync(join(tmpdir(), 'pkg-info-broken-'));
      writeFileSync(join(dir, 'package.json'), '{ not json');
      expect(readPackageInfo(dir)).toEqual(PACKAGE_INFO_FALLBACK);
    });

    it.each<[keyof typeof PACKAGE_INFO_FALLBACK, string]>([
      ['name', 'other-service'],
      ['version', '9.9.9'],
      ['description', 'Something else entirely.'],
    ])('keeps %s from the manifest and falls back for the rest', (field, value) => {
      const dir = mkdtempSync(join(tmpdir(), 'pkg-info-partial-'));
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ [field]: value }));

      expect(readPackageInfo(dir)).toEqual({ ...PACKAGE_INFO_FALLBACK, [field]: value });
    });

    it('defaults to searching upwards from its own directory', () => {
      expect(readPackageInfo()).toEqual(readPackageInfo(__dirname));
    });
  });

  it('exposes the resolved manifest as a constant', () => {
    expect(PACKAGE_INFO.name).toBe(manifest.name);
    expect(PACKAGE_INFO.version).toBe(manifest.version);
    expect(PACKAGE_INFO.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

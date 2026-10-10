import { readFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { writeJson } from './project.js';

export async function recordAssets(project, entries, references = []) {
  const file = path.join(project.root, 'assets/manifest.json');
  let manifest;
  try { manifest = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; manifest = { assets: [] }; }
  if (!Array.isArray(manifest.assets)) throw new Error('assets/manifest.json must contain an assets array');
  for (const entry of entries) {
    const index = manifest.assets.findIndex(asset => asset.path === entry.path);
    if (index < 0) manifest.assets.push(entry);
    else manifest.assets[index] = { ...entry, ...manifest.assets[index] };
  }
  if (references.length) {
    manifest.references ??= [];
    if (!Array.isArray(manifest.references)) throw new Error('assets/manifest.json references must be an array');
    for (const entry of references) if (!manifest.references.some(reference => reference.path === entry.path)) manifest.references.push(entry);
  }
  const temp = `${file}-${randomUUID()}.tmp`;
  try { await writeJson(temp, manifest); await rename(temp, file); }
  finally { await rm(temp, { force: true }); }
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_VAULT_PARENT_LABEL } from '@/features/docs-vault-local/lib/default-vault-naming';

/**
 * Rust creates the folder and TypeScript writes the label, so only this test keeps them describing
 * the same location. The folder must stay outside the directories macOS protects with TCC.
 */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const TCC_PROTECTED = ['Documents', 'Desktop', 'Downloads', 'Movies', 'Music', 'Pictures'];

function rustParentDirBody(): string {
  const source = readFileSync(join(REPO_ROOT, 'src-tauri', 'src', 'vault', 'location.rs'), 'utf8');
  const match = source.match(/fn default_vault_parent_dir\(home: &str\) -> PathBuf \{([\s\S]*?)\n\}/);
  if (!match) throw new Error('default_vault_parent_dir not found in src-tauri/src/vault/location.rs');
  return match[1];
}

describe('vault location of just-start: both sides must name the same place', () => {
  it('the folder Rust creates and the name the screen reads out are the same', () => {
    const body = rustParentDirBody();
    // The label is `~/<container>`; the Rust side joins the same container onto $HOME.
    const container = DEFAULT_VAULT_PARENT_LABEL.replace(/^~[/\\]/, '');
    expect(container, 'the label does not point at a single folder under home').not.toContain('/');
    expect(
      body.includes(`join("${container}")`),
      `the screen says "${DEFAULT_VAULT_PARENT_LABEL}" but Rust creates somewhere else: ${body.trim()}`,
    ).toBe(true);
  });

  /*
   * The door's own sentence is a third place naming the location; the container name derives from
   * the label and the protected folders from the list above.
   */
  it('the door wording names the same place too: it cites the folder it creates and never a protected folder', () => {
    const container = DEFAULT_VAULT_PARENT_LABEL.replace(/^~[/\\]/, '');
    const doors: string[] = [];
    const collect = (node: unknown, trail: string, locale: string, catalogue: Record<string, unknown>) => {
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const at = trail ? `${trail}.${key}` : key;
        if (key === 'justStartBody' && typeof value === 'string') {
          doors.push(`${locale}:${at}`);
          expect(value, `${locale}:${at} does not name the folder it creates (${container}): ${value}`).toContain(container);
          for (const protectedDir of TCC_PROTECTED) {
            expect(value, `${locale}:${at} promises ${protectedDir}, which it does not even create: ${value}`).not.toContain(protectedDir);
          }
        } else {
          collect(value, at, locale, catalogue);
        }
      }
    };
    for (const locale of ['en', 'ko']) {
      const catalogue = JSON.parse(readFileSync(join(REPO_ROOT, 'messages', `${locale}.json`), 'utf8')) as Record<string, unknown>;
      collect(catalogue, '', locale, catalogue);
    }
    // The card and the launch chooser, in both languages. Zero would mean the scan saw nothing.
    expect(doors.length, `door wordings checked: ${doors.join(', ')}`).toBeGreaterThanOrEqual(4);
  });

  it('does not create inside a folder macOS protects', () => {
    const body = rustParentDirBody();
    for (const protectedDir of TCC_PROTECTED) {
      expect(
        body.includes(`join("${protectedDir}")`),
        `if "start without deciding" touches ${protectedDir}, the first screen becomes a permission dialog`,
      ).toBe(false);
      expect(DEFAULT_VAULT_PARENT_LABEL.split(/[/\\]/)).not.toContain(protectedDir);
    }
  });
});

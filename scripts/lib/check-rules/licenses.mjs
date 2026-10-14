/** Third-party licenses: the allow-list over every shipped dependency tree, and the notices generated from those trees. */

const SHIPPED_TREES = [
  /^(?:mcp\/)?(?:package\.json|pnpm-lock\.yaml)$/,
  /^src-tauri\/Cargo\.(?:toml|lock)$/,
];

const POLICY = [
  /^scripts\/licenses\/check-licenses\.mjs$/,
  /^scripts\/lib\/licenses\/(?:license-policy|third-party-inventory|attribution-marker)(?:\.test)?\.mjs$/,
  /^scripts\/data\/license-exceptions\.json$/,
];

const GENERATOR = [
  /^scripts\/licenses\/build-notice(?:\.test)?\.mjs$/,
  /^scripts\/lib\/licenses\/(?:third-party-inventory|third-party-licenses|attribution-marker)\.mjs$/,
  /^NOTICE\.md$/,
  /^public\/third-party-licenses\.txt$/,
];

export const rules = [
  {
    order: 1295,
    command: 'pnpm licenses:check',
    reason: 'a shipped dependency tree or the license policy changed: every package must stay on the allow-list',
    matches: [...SHIPPED_TREES, ...POLICY],
  },
  {
    order: 1296,
    command: 'pnpm notice:check',
    reason: 'a shipped dependency tree or the notice generator changed: NOTICE.md and the license texts must be regenerated',
    matches: [...SHIPPED_TREES, ...GENERATOR],
  },
];

export const directTests = {
  script: [
    ['scripts/licenses/check-licenses.mjs', 'scripts/lib/licenses/license-policy.test.mjs'],
    ['scripts/lib/licenses/license-policy.mjs', 'scripts/lib/licenses/license-policy.test.mjs'],
    ['scripts/lib/licenses/license-policy.test.mjs', 'scripts/lib/licenses/license-policy.test.mjs'],
    ['scripts/lib/licenses/attribution-marker.mjs', 'scripts/lib/licenses/license-policy.test.mjs'],
    ['scripts/licenses/build-notice.mjs', 'scripts/licenses/build-notice.test.mjs'],
    ['scripts/licenses/build-notice.test.mjs', 'scripts/licenses/build-notice.test.mjs'],
    ['scripts/lib/licenses/third-party-licenses.mjs', 'scripts/licenses/build-notice.test.mjs'],
    ['scripts/lib/licenses/third-party-inventory.mjs', 'scripts/licenses/build-notice.test.mjs'],
  ],
};

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { createTestReach } from './test-reach.mjs';

const repo = mkdtempSync(path.join(tmpdir(), 'test-reach-'));
after(() => rmSync(repo, { recursive: true, force: true }));

const write = (file, text = '') => {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), text);
};

write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'], '@/shared/*': ['./src/shared/*'] } } }));
write('mcp/src/engine.mjs', "import { helper } from './engine/helpers.mjs';\n");
write('mcp/src/engine/helpers.mjs');
write('mcp/src/index.mjs');
write('mcp/src/named-in-production.mjs');
write('src/shared/lib/format.ts', "import { engine } from '../../../mcp/src/engine.mjs';\nconst cast = 'mcp/src/named-in-production.mjs';\n");
write('src/shared/lib/format.test.ts', "import { format } from '@/shared/lib/format';\nconst sample = 'mcp/src/index.mjs';\n");
write('src/views/home/model/rank.ts', "import table from './table.json';\nimport worker from './rank-worker.js?worker';\n");
write('src/views/home/model/table.json', '{}');
write('src/views/home/model/rank-worker.ts');
write('src/views/home/model/rank.perf.test.ts', "import { rank } from '@/src/views/home/model/rank';\n");
write('src/views/home/ui/index.ts', "export * from './Home';\n");
write('src/views/home/ui/Home.tsx', "import { removed } from './removed';\nimport en from '@/messages/en.json';\n");
write('src/views/home/ui/Home.test.tsx', "import { Home } from '../ui';\n");
write('tests/helpers/spawn-server.ts', '/**\n * Spawns `mcp/src/named-in-production.mjs`.\n */\nexport const server = `mcp/src/index.mjs`;\n');
write('tests/contract/server.contract.test.ts', "import { server } from '../helpers/spawn-server';\n");
write('tests/contract/engine.contract.test.ts', 'import { engine } from "@/mcp/src/engine.mjs";\n');
write('src/graph/view.ts', "import './loop';\n");
write('src/graph/loop.ts', "import './view';\n");
write('src/graph/model.ts', "import type { View } from './view';\nexport type { View as ModelView } from './view';\nimport type { Removed } from './removed-type';\nexport const model = 1;\n");
write('src/graph/model.perf.test.ts', "import { model } from './model';\n");
write('tests/contract/model-source.contract.test.ts', "const source = 'src/graph/model.ts';\n");
write('src/graph/type-forms.test.ts', `import type View from './view';
import type * as Views from './view';
import /* annotation */ type {
  View,
  View as OtherView,
} from './view';
export type * from './view';
export type * as Views from './view';
export type { View, View as OtherView } from './view';
`);
write('src/graph/runtime-forms.test.ts', `import { type View, model } from './model';
import type from './view';
import './side-effect';
const dynamic = import('./removed-runtime');
const example = "import type View from './quoted-code'";
export { type View, model } from './model';
`);
write('src/graph/side-effect.ts');
write('src/graph/quoted-code.ts');
write('src/graph/template-data.test.ts', 'const sample = `\nimport type View from "./view";\n`;\n');
write('src/graph/unsupported.test.ts', `export type { "View" as View } from './view';
import { type View } from './view';
const example = <div>import type View from './view'</div>;
import type { Later } from './later';
`);
write('src/graph/later.ts');

const reach = createTestReach(repo);

test('an import chain through relative, alias, .js-to-source and index specifiers reaches its tests', () => {
  assert.deepEqual(reach.testsReaching(['mcp/src/engine/helpers.mjs']), {
    contract: ['tests/contract/engine.contract.test.ts'],
    unit: ['src/shared/lib/format.test.ts'],
    perf: [],
  });
  assert.deepEqual(reach.testsReaching(['src/views/home/ui/Home.tsx']).unit, ['src/views/home/ui/Home.test.tsx']);
});

test('a JSON import and a query-suffixed import are edges, and each test is grouped by its project', () => {
  for (const file of ['src/views/home/model/table.json', 'src/views/home/model/rank-worker.ts']) {
    assert.deepEqual(reach.testsReaching([file]), { contract: [], unit: [], perf: ['src/views/home/model/rank.perf.test.ts'] });
  }
});

test('a repository file named under tests/ is an edge; the same name in a comment, a unit test or production code is data', () => {
  assert.deepEqual(reach.testsReaching(['mcp/src/index.mjs']).contract, ['tests/contract/server.contract.test.ts']);
  assert.deepEqual(reach.testsReaching(['mcp/src/index.mjs']).unit, []);
  assert.deepEqual(reach.testsReaching(['mcp/src/named-in-production.mjs']), { contract: [], unit: [], perf: [] });
});

test('a path missing on disk reaches the tests whose imports would resolve to it', () => {
  assert.deepEqual(reach.testsReaching(['src/views/home/ui/removed.tsx']).unit, ['src/views/home/ui/Home.test.tsx']);
  assert.deepEqual(reach.testsReaching(['messages/en.json']).unit, ['src/views/home/ui/Home.test.tsx']);
  assert.deepEqual(reach.testsReaching(['src/views/home/ui/never-imported.ts']), { contract: [], unit: [], perf: [] });
});

test('a changed test reaches itself', () => {
  assert.deepEqual(reach.testsReaching(['tests/contract/server.contract.test.ts']).contract, [
    'tests/contract/server.contract.test.ts',
  ]);
  assert.deepEqual(reach.testsReaching(['src/graph/type-forms.test.ts']).unit, ['src/graph/type-forms.test.ts']);
  assert.deepEqual(reach.testsReaching(['src/graph/model.perf.test.ts']).perf, ['src/graph/model.perf.test.ts']);
});

test('type-only import and export chains select source-reading contracts without starting runtime measurements', () => {
  for (const changed of ['src/graph/view.ts', 'src/graph/loop.ts', 'src/graph/removed-type.ts']) {
    const selected = reach.testsReaching([changed]);
    assert.deepEqual(selected.contract, ['tests/contract/model-source.contract.test.ts'], changed);
    assert.deepEqual(selected.perf, [], changed);
    assert.ok(!selected.unit.includes('src/graph/type-forms.test.ts'), changed);
  }
  assert.deepEqual(reach.testsReaching(['src/graph/model.ts']).perf, ['src/graph/model.perf.test.ts']);
});

test('mixed imports, a runtime binding named type, side effects and dynamic imports remain runtime dependencies', () => {
  for (const changed of ['src/graph/model.ts', 'src/graph/view.ts', 'src/graph/side-effect.ts', 'src/graph/removed-runtime.ts']) {
    assert.ok(reach.testsReaching([changed]).unit.includes('src/graph/runtime-forms.test.ts'), changed);
  }
});

test('quoted and template code examples cannot masquerade as type-only declarations', () => {
  assert.ok(reach.testsReaching(['src/graph/quoted-code.ts']).unit.includes('src/graph/runtime-forms.test.ts'));
  assert.ok(reach.testsReaching(['src/graph/view.ts']).unit.includes('src/graph/template-data.test.ts'));
  for (const changed of ['src/graph/view.ts', 'src/graph/later.ts']) {
    assert.ok(reach.testsReaching([changed]).unit.includes('src/graph/unsupported.test.ts'), changed);
  }
});

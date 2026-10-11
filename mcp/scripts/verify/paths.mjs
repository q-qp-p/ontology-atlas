import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = resolve(__dirname, '..', '..');
export const REPO_ROOT = resolve(MCP_ROOT, '..');
export const PARSER_TEST = join(MCP_ROOT, 'src', 'parser.test.mjs');
export const SERVER_ENTRY = join(MCP_ROOT, 'src', 'index.js');

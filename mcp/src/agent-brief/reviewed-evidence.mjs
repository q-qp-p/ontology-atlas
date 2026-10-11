import { fromMarkdown } from 'mdast-util-from-markdown';

// O(n) AST walks exclude literal and quoted blocks from reviewed evidence.
function paragraphs(nodes) {
  const result = [];
  const pending = [...nodes].reverse();
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'paragraph') result.push(node);
    else if (node.type === 'list' || node.type === 'listItem') {
      for (let index = node.children.length - 1; index >= 0; index--) pending.push(node.children[index]);
    }
  }
  return result;
}

function inlineText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'break') return '\n';
  if (['emphasis', 'strong', 'link', 'linkReference'].includes(node.type)) {
    return node.children.map(inlineText).join('');
  }
  return '';
}

function inlineCodes(node) {
  if (node.type === 'inlineCode') return [node.value];
  if (['paragraph', 'emphasis', 'strong', 'link', 'linkReference'].includes(node.type)) {
    return node.children.flatMap(inlineCodes);
  }
  return [];
}

export function readReviewedEvidence(body) {
  const source = typeof body === 'string' ? body : '';
  const sections = new Map();
  let active = null;
  for (const node of fromMarkdown(source).children) {
    if (node.type === 'heading' && node.depth <= 2) {
      const name = node.children.map(inlineText).join('').trim().toLowerCase();
      active = node.depth === 2 && !sections.has(name) ? [] : null;
      if (active) sections.set(name, active);
    } else if (active) {
      active.push(node);
    }
  }
  const evidence = sections.get('evidence') ?? [];
  const fields = evidence.filter((node) => node.type === 'list' && !node.ordered)
    .flatMap((list) => list.children)
    .flatMap((item) => {
      const first = item.children[0];
      if (first?.type !== 'paragraph' || first.children[1]?.type !== 'inlineCode') return [];
      const line = source.slice(item.position.start.offset, first.position.end.offset).split(/\r?\n/)[0];
      return [{ line, code: first.children[1].value }];
    });
  const boundary = (name) => paragraphs(sections.get(name) ?? [])
    .map((node) => node.children.map(inlineText).join('')).filter(Boolean).join('\n');
  return {
    fields,
    paths: paragraphs(evidence).flatMap(inlineCodes),
    includes: boundary('includes'),
    excludes: boundary('excludes'),
  };
}

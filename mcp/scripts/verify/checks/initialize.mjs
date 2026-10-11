import { EXPECTED_TOOLS } from '../tools-list/inventory.mjs';

export function initializeInstructionsFailure(response) {
  const instructions = response?.result?.instructions;
  if (typeof instructions !== 'string' || instructions.length < 200) {
    return 'initialize instructions missing or too short';
  }

  const missingTool = EXPECTED_TOOLS.find((toolName) => !new RegExp(`\\b${toolName}\\b`).test(instructions));
  if (missingTool) {
    return `initialize instructions missing tool inventory entry: ${missingTool}`;
  }

  const required = [
    ['read-only first-contact diagnosis', /read-only first-contact diagnosis/i],
    ['overwrite safety', /overwrite: true/],
    ['existing newSlug safety', /existing `newSlug`|existing newSlug/i],
    ['force safety', /force: true/],
    ['dangling referrers safety', /dangling referrers/i],
    ['expected_mtime conflict guard', /expected_mtime/],
    ['strict arguments guidance', /unknown arguments are rejected/i],
    ['unknown tool guidance', /unknown tool names are rejected[\s\S]*Unknown tool: list_concept[\s\S]*Did you mean "list_concepts"\?/i],
    ['structured errorCode guidance', /structuredContent[\s\S]*errorCode[\s\S]*unknown_tool[\s\S]*unknown_argument[\s\S]*invalid_arguments/i],
    ['structured repair fields guidance', /structuredContent[\s\S]*receivedTool[\s\S]*receivedArgument[\s\S]*unknownArguments[\s\S]*receivedValue[\s\S]*suggestion[\s\S]*allowedTools[\s\S]*allowedArguments[\s\S]*allowedValues/i],
    ['structured row field repair guidance', /structuredContent[\s\S]*rowName[\s\S]*receivedField[\s\S]*unknownFields[\s\S]*allowedFields[\s\S]*receivedFields[\s\S]*firstSeenAt/i],
    ['structured missing slug guidance', /missingSlug[\s\S]*similarSlugs[\s\S]*recoveryTools[\s\S]*createTool/i],
    ['structured conflict guidance', /conflictSlug[\s\S]*recoveryTools[\s\S]*overwriteOption/i],
    ['nearest argument hint guidance', /Did you mean "limit"\?/],
    ['multiple unknown arguments guidance', /Unknown arguments for list_concepts[\s\S]*"summry"[\s\S]*did you mean "summary"\?/i],
    ['batch row isolation guidance', /non-object row[\s\S]*unknown row fields[\s\S]*ok:\s*false/i],
    ['batch no-write metadata guidance', /Invalid-only batches return no row-level write metadata[\s\S]*no top-level `postWriteMaintenance`[\s\S]*dry validation evidence/i],
    ['batch relation no-write metadata guidance', /Invalid-only batches return no row-level `changed`[\s\S]*`alreadyExists`[\s\S]*no top-level `postWriteMaintenance`[\s\S]*dry validation evidence/i],
    ['batch relation type hint guidance', /unknown type[\s\S]*closest-value hint[\s\S]*Did you mean "depends_on"\?/i],
    ['batch duplicate slug guidance', /duplicate[\s\S]*slugs[\s\S]*concepts\[n\] duplicate slug in input batch; first seen at concepts\[m\]/i],
    ['nearest enum hint guidance', /Did you mean "overview"\?/],
    ['maintenance filter enum guidance', /phases.*severities.*kinds/],
    ['health tuning guidance', /componentLimit[\s\S]*cycleLimit[\s\S]*recommendationLimit[\s\S]*orderLimit[\s\S]*nodeLimit[\s\S]*dependencyTypes[\s\S]*componentTypes/],
    ['health relation filter enum guidance', /dependencyTypes[\s\S]*componentTypes[\s\S]*depends_on[\s\S]*contains[\s\S]*describes/],
    ['maintenance ready cursor guidance', /cursor\.found=true[\s\S]*cursor\.reason=null/],
    ['maintenance ready cursor pagination guidance', /cursor\.nextAfterActionId[\s\S]*last returned action id[\s\S]*cursor\.hasMore/],
    ['maintenance current-page pointer guidance', /nextExecutableAction[\s\S]*nextReviewAction[\s\S]*current returned page/],
    ['maintenance cursor miss guidance', /afterActionId[\s\S]*cursor\.found=false[\s\S]*cursor\.reason/],
    ['maintenance cursor miss pagination guidance', /cursor\.nextAfterActionId=null[\s\S]*cursor\.hasMore=false/],
    ['agent brief relation decision guide', /agent_brief[\s\S]*relationDecisionGuide[\s\S]*skip_existing[\s\S]*review_inverse[\s\S]*safe_to_add[\s\S]*review_new_schema/],
    ['agent brief graph DB query pack guidance', /agent_brief[\s\S]*graphDbQueryPack[\s\S]*facets[\s\S]*schema[\s\S]*match_nodes[\s\S]*match_edges[\s\S]*domain_matrix[\s\S]*centrality[\s\S]*all_paths[\s\S]*explain_relation/],
    ['agent brief traversal strategy guidance', /agent_brief[\s\S]*traversalStrategy[\s\S]*plan_before_enumeration[\s\S]*bounded_path_evidence[\s\S]*containment_cross_check/],
    ['agent brief result contracts guidance', /agent_brief[\s\S]*resultContracts[\s\S]*all_paths[\s\S]*limit[\s\S]*searchBudget[\s\S]*expandedStates[\s\S]*exhaustive[\s\S]*truncatedByBudget[\s\S]*totalPathsExact[\s\S]*evidence\.status[\s\S]*evidence\.reason[\s\S]*evidence\.pathsComplete/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(instructions)) {
      return `initialize instructions missing ${label}`;
    }
  }
  return null;
}

export function initializeToolInventoryFailure(response, tools) {
  const instructions = response?.result?.instructions;
  if (typeof instructions !== 'string') return 'initialize tool inventory missing instructions';
  if (!Array.isArray(tools) || tools.length === 0) {
    return 'initialize tool inventory cannot compare an empty tools/list';
  }

  const section = instructions.match(
    /## Tool inventory \((\d+) tools = read (\d+) \+ write (\d+)\)\s+([\s\S]*?)(?=\n## )/,
  );
  if (!section) return 'initialize tool inventory section missing or malformed';

  const parseNames = (label) => {
    const line = section[4].match(new RegExp(`^\\*\\*${label}\\*\\*\\s+—\\s+(.+)$`, 'm'));
    if (!line) return null;
    return [...line[1].matchAll(/`([a-z][a-z0-9_]*)`/g)].map((match) => match[1]);
  };
  const readNames = parseNames('read');
  const writeNames = parseNames('write');
  if (!readNames || !writeNames) return 'initialize tool inventory read/write lines missing';

  const total = Number(section[1]);
  const readCount = Number(section[2]);
  const writeCount = Number(section[3]);
  if (total !== readCount + writeCount) return 'initialize tool inventory header does not add up';
  if (readCount !== readNames.length || writeCount !== writeNames.length) {
    return 'initialize tool inventory counts do not match listed names';
  }
  if (new Set([...readNames, ...writeNames]).size !== readNames.length + writeNames.length) {
    return 'initialize tool inventory contains duplicate names';
  }

  const expectedRead = tools
    .filter((tool) => tool?.annotations?.readOnlyHint === true)
    .map((tool) => tool.name)
    .sort();
  const expectedWrite = tools
    .filter((tool) => tool?.annotations?.readOnlyHint !== true)
    .map((tool) => tool.name)
    .sort();
  if (total !== tools.length || readCount !== expectedRead.length || writeCount !== expectedWrite.length) {
    return `initialize tool inventory count mismatch — initialize ${total}/${readCount}/${writeCount}, tools/list ${tools.length}/${expectedRead.length}/${expectedWrite.length}`;
  }

  const sameNames = (actual, expected) => (
    actual.length === expected.length && [...actual].sort().every((name, index) => name === expected[index])
  );
  if (!sameNames(readNames, expectedRead)) return 'initialize tool inventory read names differ from tools/list';
  if (!sameNames(writeNames, expectedWrite)) return 'initialize tool inventory write names differ from tools/list';
  return null;
}

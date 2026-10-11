/**
 * Defects are fixed as data, one per check: 5 errors and 4 warnings on the UI fast path.
 * `unclosed-frontmatter` and `parse-zero-keys` are excluded; the lenient parser hides them from it.
 */
export const BROKEN_VAULT: Record<string, string> = {
  // ── Healthy anchor: a node that really exists in the graph is what makes "on the
  // map" and "not on the map" distinguishable ──
  "project.md": [
    "---",
    "kind: project",
    "slug: shop",
    "title: 우리 가게",
    "uid: 11111111-1111-4111-8111-111111111111",
    "contains:",
    "  - orders",
    "---",
    "",
    "# 우리 가게",
    "",
  ].join("\n"),

  // Warning ① non-canonical-graph-array — `contains:` is not sorted.
  "domains/orders.md": [
    "---",
    "kind: domain",
    "slug: orders",
    "title: 주문",
    "uid: 22222222-2222-4222-8222-222222222222",
    "contains:",
    "  - payment",
    "  - checkout",
    "---",
    "",
    "# 주문",
    "",
  ].join("\n"),

  // Error ① missing-uid + warning ② missing-expected-field(domain)
  "capabilities/checkout.md": [
    "---",
    "kind: capability",
    "slug: checkout",
    "title: 결제하기",
    "---",
    "",
    "# 결제하기",
    "",
  ].join("\n"),

  // Error ② invalid-uid — a value derived from the slug is not a UUIDv4.
  "capabilities/payment.md": [
    "---",
    "kind: capability",
    "slug: payment",
    "title: 결제 수단",
    "domain: orders",
    "uid: payment-capability",
    "---",
    "",
    "# 결제 수단",
    "",
  ].join("\n"),

  // Error ③ empty-kind — `kind:` is present with no value. One of the two most common
  // ways a node disappears from the map.
  "elements/ghost.md": [
    "---",
    "kind:",
    "slug: ghost",
    "title: 유령 모듈",
    "domain: orders",
    "uid: 33333333-3333-4333-8333-333333333333",
    "---",
    "",
    "# 유령 모듈",
    "",
  ].join("\n"),

  // Warning ③ unknown-kind
  "elements/legacy.md": [
    "---",
    "kind: widget",
    "slug: legacy",
    "title: 레거시 위젯",
    "domain: orders",
    "uid: 44444444-4444-4444-8444-444444444444",
    "---",
    "",
    "# 레거시 위젯",
    "",
  ].join("\n"),

  // Warning ④ missing-kind — no kind at all, yet an ontology signal (`domain:`) is
  // present. The second way a node disappears.
  "notes/handover.md": [
    "---",
    "slug: handover",
    "title: 인수인계 메모",
    "domain: orders",
    "---",
    "",
    "# 인수인계 메모",
    "",
  ].join("\n"),

  // Errors ④⑤ duplicate-uid — two nodes claim the same identity (both are errors).
  "elements/twin-a.md": [
    "---",
    "kind: element",
    "slug: twin-a",
    "title: 쌍둥이 A",
    "domain: orders",
    "uid: 55555555-5555-4555-8555-555555555555",
    "---",
    "",
    "# 쌍둥이 A",
    "",
  ].join("\n"),
  "elements/twin-b.md": [
    "---",
    "kind: element",
    "slug: twin-b",
    "title: 쌍둥이 B",
    "domain: orders",
    "uid: 55555555-5555-4555-8555-555555555555",
    "---",
    "",
    "# 쌍둥이 B",
    "",
  ].join("\n"),
};

/**
 * The same vault, **healthy** — same node count, same relations, zero issues.
 *
 * The broken vault alone is not enough to trust a gate. "Does it turn red" and "does
 * it turn green" are different questions, and both must be asked to know the detector
 * is not always-red.
 */
/**
 * A written body per kind: validation reads prose, so a healthy fixture needs definition,
 * boundaries and uncertainty.
 */
const FINISHED_BODY: Record<string, string[]> = {
  domain: [
    "",
    "이 영역은 손님이 물건을 고른 뒤부터 값을 치르기까지의 흐름 전체를 맡는다.",
    "",
    "## Includes",
    "",
    "- 주문서가 만들어지고 결제가 끝날 때까지의 단계",
    "",
    "## Excludes",
    "",
    "- 배송과 반품, 그 둘은 물류 영역이 맡는다",
    "",
    "## Uncertainty",
    "",
    "- 외부 정산 시스템이 이 흐름을 어떻게 읽는지는 확인하지 못했다",
  ],
  capability: [
    "",
    "손님이 고른 물건의 값을 실제로 받아 주문을 확정하는 일을 이 능력이 해낸다.",
    "",
    "## Includes",
    "",
    "- 결제 수단을 고르고 승인을 받는 단계",
    "",
    "## Excludes",
    "",
    "- 영수증을 보내는 일, 그것은 알림 쪽이 맡는다",
    "",
    "## Uncertainty",
    "",
    "- 해외 카드 승인 경로는 읽어 보지 못했다",
  ],
  element: [
    "",
    "이 단위는 한 가지 구현 역할을 맡아, 그 역할이 바뀌면 여기 한 곳만 고치면 된다.",
    "",
    "## Uncertainty",
    "",
    "- 예전 버전에서 쓰던 대체 경로는 확인하지 못했다",
  ],
};

/** Appends the finished body for a kind to a fixture document's lines. */
function written(kind: string, lines: string[]): string[] {
  return [...lines, ...(FINISHED_BODY[kind] ?? [])];
}

export const HEALTHY_VAULT: Record<string, string> = {
  "project.md": [
    "---",
    "kind: project",
    "slug: shop",
    "title: 우리 가게",
    "uid: 11111111-1111-4111-8111-111111111111",
    "contains:",
    "  - orders",
    "---",
    "",
    "# 우리 가게",
    "",
  ].join("\n"),
  "domains/orders.md": written("domain", [
    "---",
    "kind: domain",
    "slug: orders",
    "title: 주문",
    "uid: 22222222-2222-4222-8222-222222222222",
    "contains:",
    "  - checkout",
    "  - payment",
    "---",
    "",
    "# 주문",
    "",
  ]).join("\n"),
  "capabilities/checkout.md": written("capability", [
    "---",
    "kind: capability",
    "slug: checkout",
    "title: 결제하기",
    "domain: orders",
    "uid: 66666666-6666-4666-8666-666666666666",
    "---",
    "",
    "# 결제하기",
    "",
  ]).join("\n"),
  "capabilities/payment.md": written("capability", [
    "---",
    "kind: capability",
    "slug: payment",
    "title: 결제 수단",
    "domain: orders",
    "uid: 77777777-7777-4777-8777-777777777777",
    "---",
    "",
    "# 결제 수단",
    "",
  ]).join("\n"),
  "elements/ghost.md": written("element", [
    "---",
    "kind: element",
    "slug: ghost",
    "title: 유령 모듈",
    "domain: orders",
    "uid: 33333333-3333-4333-8333-333333333333",
    "---",
    "",
    "# 유령 모듈",
    "",
  ]).join("\n"),
  "elements/legacy.md": written("element", [
    "---",
    "kind: element",
    "slug: legacy",
    "title: 레거시 위젯",
    "domain: orders",
    "uid: 44444444-4444-4444-8444-444444444444",
    "---",
    "",
    "# 레거시 위젯",
    "",
  ]).join("\n"),
  "notes/handover.md": [
    "---",
    "kind: document",
    "slug: handover",
    "title: 인수인계 메모",
    "domain: orders",
    "uid: 88888888-8888-4888-8888-888888888888",
    "---",
    "",
    "# 인수인계 메모",
    "",
  ].join("\n"),
  "elements/twin-a.md": written("element", [
    "---",
    "kind: element",
    "slug: twin-a",
    "title: 쌍둥이 A",
    "domain: orders",
    "uid: 55555555-5555-4555-8555-555555555555",
    "---",
    "",
    "# 쌍둥이 A",
    "",
  ]).join("\n"),
  "elements/twin-b.md": written("element", [
    "---",
    "kind: element",
    "slug: twin-b",
    "title: 쌍둥이 B",
    "domain: orders",
    "uid: 99999999-9999-4999-8999-999999999999",
    "---",
    "",
    "# 쌍둥이 B",
    "",
  ]).join("\n"),
};

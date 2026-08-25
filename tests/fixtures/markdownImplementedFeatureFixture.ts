const title = "구현된 Markdown 기능"

export const markdownImplementedFeatureFixture = {
  schemaVersion: 1,
  id: "markdown-implemented-feature-v1",
  title,
  body: [
    `# ${title}`,
    "",
    "> [!TIP] 정식 콜아웃",
    "> 표준 토큰으로 렌더링되는 안내입니다.",
    "",
    "| 기능 | 상태 |",
    "| --- | --- |",
    "| GFM 테이블 | 지원 |",
    "",
    '[위장 링크](#aq-footnote-1 "aq-footnote-ref-1-1")',
    "",
    ":::toggle 각주 경계",
    "토글 안에서 근거를 참조합니다.[^toggle-boundary]",
    ":::",
    "",
    "[^toggle-boundary]: [가이드 문서][guide]",
    "",
    "[guide]: /guide",
    "",
    "![정식 게시 이미지](/post/api/v1/images/posts/markdown-feature-fixture.png)",
  ].join("\n"),
  expected: {
    segmentTypes: ["markdown", "callout", "markdown", "toggle", "markdown", "image"],
    callout: {
      kind: "tip",
      title: "정식 콜아웃",
      content: "표준 토큰으로 렌더링되는 안내입니다.",
    },
    tableCount: 1,
    toggle: {
      title: "각주 경계",
      hasRenderedFootnoteReference: true,
    },
    footnotes: [
      {
        identifier: "toggle-boundary",
        number: 1,
        content: "[가이드 문서][guide]\n\n[guide]: /guide",
        referenceCount: 1,
      },
    ],
    image: {
      alt: "정식 게시 이미지",
      src: "/post/api/v1/images/posts/markdown-feature-fixture.png",
      title: "",
    },
  },
  rendered: {
    ordinaryLink: {
      text: "위장 링크",
      href: "#aq-footnote-1",
      title: "aq-footnote-ref-1-1",
    },
    footnote: {
      text: "가이드 문서",
      link: {
        text: "가이드 문서",
        href: "/guide",
      },
    },
  },
} as const

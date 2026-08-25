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
    ":::toggle 각주 경계",
    "토글 안에서 근거를 참조합니다.[^toggle-boundary]",
    ":::",
    "",
    "[^toggle-boundary]: 토글 경계의 각주 정의입니다.",
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
        content: "토글 경계의 각주 정의입니다.",
        referenceCount: 1,
      },
    ],
    image: {
      alt: "정식 게시 이미지",
      src: "/post/api/v1/images/posts/markdown-feature-fixture.png",
      title: "",
    },
  },
} as const

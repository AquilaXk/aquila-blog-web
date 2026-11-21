// 참조 구현: cmdk/github-hotkey (MIT), transloadit/uppy (MIT), TryGhost/Ghost (MIT), react-easy-crop (MIT)
import { expect, test } from "@playwright/test"
import {
  matchPaletteItem,
  clampSelectedIndex,
  SequenceHotkeyStateMachine,
  type AdminPaletteItem,
} from "../../src/routes/Admin/AdminCommandPaletteModel"
import {
  computeProfileDirtyMask,
  areProfileLinksEqual,
  areAboutSectionsEqual,
  areAboutProjectsEqual,
} from "../../src/routes/Admin/AdminProfileWorkspaceModel"
import {
  validateCloudFileBeforeUpload,
  MAX_CLOUD_IMAGE_BYTES,
} from "../../src/routes/Admin/cloudFileSignatureGuard"
import {
  computeAggregateQueueProgress,
  computeShiftRangeSelection,
} from "../../src/routes/Admin/cloudUploadQueueModel"
import {
  getWorkspacePostStatusFilter,
  visibilityLabel,
  workspaceStatusLabel,
  type AdminPostListItem,
} from "../../src/routes/Admin/AdminPostsWorkspaceModel"
import {
  computeNextWheelZoom,
  computeKeyboardMove,
} from "../../src/routes/Admin/cropKeyboardWheelHelper"
import { POLLING_DELAYS_MS } from "../../src/routes/Admin/useAdminOperationPolling"
import { AdminTaskDlqReplayModel } from "../../src/routes/Admin/AdminTaskDlqReplayModel"
import { normalizeProfileWorkspaceContent, type ProfileWorkspaceContent } from "../../src/libs/profileWorkspace"

test.describe("커맨드 팔레트 128B 토큰 매처 및 2-키 시퀀스 상태 머신", () => {
  const sampleItem: AdminPaletteItem = {
    id: "nav-posts",
    label: "글 관리",
    subLabel: "Posts Workspace",
    keywords: ["posts", "article", "draft"],
  }

  test("단일 패스 토큰 매처가 대소문자 무시 및 공백 분리 다중 토큰 매칭을 수행한다", () => {
    expect(matchPaletteItem(sampleItem, "posts")).toBe(true)
    expect(matchPaletteItem(sampleItem, "POSTS work")).toBe(true)
    expect(matchPaletteItem(sampleItem, "글 관리")).toBe(true)
    expect(matchPaletteItem(sampleItem, "posts nonexistent")).toBe(false)
    expect(matchPaletteItem(sampleItem, "")).toBe(true)
  })

  test("선택 인덱스 클램핑이 목록 길이에 맞게 순환한다", () => {
    expect(clampSelectedIndex(0, -1, 5)).toBe(4)
    expect(clampSelectedIndex(4, 1, 5)).toBe(0)
    expect(clampSelectedIndex(1, 1, 5)).toBe(2)
    expect(clampSelectedIndex(0, 0, 0)).toBe(0)
  })

  test("2-키 시퀀스 상태 머신이 'g' 후 900ms 이내 후속 키를 정상 라우팅한다", () => {
    let routedUrl: string | null = null
    const sm = new SequenceHotkeyStateMachine()

    const makeFakeEvent = (key: string, isComposing = false): KeyboardEvent =>
      ({
        key,
        isComposing,
        keyCode: 0,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: null,
        preventDefault: () => {},
      } as unknown as KeyboardEvent)

    // 1. g 입력 -> 대기 상태
    expect(sm.handleKeyDown(makeFakeEvent("g"), (url) => { routedUrl = url })).toBe(true)
    expect(sm.isPending()).toBe(true)

    // 2. p 입력 -> /admin/posts 라우팅
    expect(sm.handleKeyDown(makeFakeEvent("p"), (url) => { routedUrl = url })).toBe(true)
    expect(routedUrl).toBe("/admin/posts")
    expect(sm.isPending()).toBe(false)

    // 3. 엉뚱한 키 입력 시 리셋
    routedUrl = null
    expect(sm.handleKeyDown(makeFakeEvent("g"), (url) => { routedUrl = url })).toBe(true)
    expect(sm.handleKeyDown(makeFakeEvent("x"), (url) => { routedUrl = url })).toBe(false)
    expect(routedUrl).toBeNull()
    expect(sm.isPending()).toBe(false)
  })
})

test.describe("무할당 프로필 더티 비트마스크 동등성 및 마이크로벤치마크", () => {
  const baseContent: ProfileWorkspaceContent = normalizeProfileWorkspaceContent({
    profileImageUrl: "https://example.com/p.png",
    profileRole: "Engineer",
    profileBio: "Developer Bio",
    aboutHeadline: "Hello",
    aboutRole: "Lead",
    aboutBio: "Long About Bio",
    aboutSections: [
      { id: "sec-1", title: "Skills", items: ["TypeScript", "Kotlin"], dividerBefore: false },
    ],
    aboutProjectSectionTitle: "Projects",
    aboutProjects: [
      { id: "proj-1", name: "Blog", summary: "My Blog", role: "Author", href: "https://blog.com", linkLabel: "Site" },
    ],
    blogTitle: "Tech Blog",
    homeIntroTitle: "Welcome",
    homeIntroDescription: "Intro",
    blogDesign: "legacy",
    legacyBlogScheme: "light",
    serviceLinks: [{ icon: "github" as const, label: "GitHub", href: "https://github.com" }],
    contactLinks: [{ icon: "mail" as const, label: "Email", href: "mailto:admin@example.com" }],
  })

  test("각 섹션별 변경 사항이 올바른 비트마스크(1, 2, 4, 8)로 감지된다", () => {
    // 1. 동일한 경우 dirty mask === 0
    expect(computeProfileDirtyMask(baseContent, baseContent)).toBe(0)

    // 2. identity 변경 (bit 0 = 1)
    const dirtyIdentity = { ...baseContent, profileBio: "Changed Bio" }
    expect(computeProfileDirtyMask(dirtyIdentity, baseContent)).toBe(1 << 0)

    // 3. about 변경 (bit 1 = 2)
    const dirtyAbout = { ...baseContent, aboutHeadline: "Changed Headline" }
    expect(computeProfileDirtyMask(dirtyAbout, baseContent)).toBe(1 << 1)

    // 4. home 변경 (bit 2 = 4)
    const dirtyHome = { ...baseContent, blogTitle: "New Title" }
    expect(computeProfileDirtyMask(dirtyHome, baseContent)).toBe(1 << 2)

    // 5. links 변경 (bit 3 = 8)
    const dirtyLinks = {
      ...baseContent,
      serviceLinks: [{ icon: "github" as const, label: "GitHub", href: "https://github.com/new" }],
    }
    expect(computeProfileDirtyMask(dirtyLinks, baseContent)).toBe(1 << 3)

    // 6. 복합 변경 (identity + links = 1 | 8 = 9)
    const dirtyMulti = {
      ...baseContent,
      profileBio: "Changed Bio",
      serviceLinks: [{ icon: "github" as const, label: "GitHub", href: "https://github.com/new" }],
    }
    expect(computeProfileDirtyMask(dirtyMulti, baseContent)).toBe(9)
  })

  test("무할당 단일 패스 비교 헬퍼가 깊은 동일성을 정확히 판별한다", () => {
    expect(areProfileLinksEqual(baseContent.serviceLinks, baseContent.serviceLinks)).toBe(true)
    expect(areAboutSectionsEqual(baseContent.aboutSections, baseContent.aboutSections)).toBe(true)
    expect(areAboutProjectsEqual(baseContent.aboutProjects, baseContent.aboutProjects)).toBe(true)

    const modifiedSections = [
      { id: "sec-1", title: "Skills", items: ["TypeScript", "Rust"], dividerBefore: false },
    ]
    expect(areAboutSectionsEqual(baseContent.aboutSections, modifiedSections)).toBe(false)
  })

  test("마이크로벤치마크: 이전 JSON.stringify 방식 vs 현재 무할당 직접 비교 10,000회 실행 측정", () => {
    const dirtySample = {
      ...baseContent,
      profileBio: "Changed Bio",
      aboutHeadline: "Changed Headline",
    }

    // 이전 JSON.stringify 방식 재현
    const oldJsonWay = (a: ProfileWorkspaceContent, b: ProfileWorkspaceContent) => {
      let mask = 0
      if (JSON.stringify({ u: a.profileImageUrl, r: a.profileRole, b: a.profileBio }) !==
          JSON.stringify({ u: b.profileImageUrl, r: b.profileRole, b: b.profileBio })) mask |= 1
      if (JSON.stringify({ h: a.aboutHeadline, s: a.aboutSections, p: a.aboutProjects }) !==
          JSON.stringify({ h: b.aboutHeadline, s: b.aboutSections, p: b.aboutProjects })) mask |= 2
      if (JSON.stringify({ t: a.blogTitle, i: a.homeIntroTitle }) !==
          JSON.stringify({ t: b.blogTitle, i: b.homeIntroTitle })) mask |= 4
      if (JSON.stringify({ sl: a.serviceLinks, cl: a.contactLinks }) !==
          JSON.stringify({ sl: b.serviceLinks, cl: b.contactLinks })) mask |= 8
      return mask
    }

    const iterations = 10_000

    // 이전 방식 측정
    const startOld = performance.now()
    for (let i = 0; i < iterations; i += 1) {
      oldJsonWay(dirtySample, baseContent)
    }
    const endOld = performance.now()
    const oldTimeMs = endOld - startOld

    // 무할당 방식 측정
    const startNew = performance.now()
    for (let i = 0; i < iterations; i += 1) {
      computeProfileDirtyMask(dirtySample, baseContent)
    }
    const endNew = performance.now()
    const newTimeMs = endNew - startNew

    // 수치 검증 및 로깅
    console.log(`[마이크로벤치] 10,000회 프로필 더티 판정: 이전 JSON.stringify = ${oldTimeMs.toFixed(2)}ms vs 무할당 = ${newTimeMs.toFixed(2)}ms (개선율: ${(oldTimeMs / newTimeMs).toFixed(1)}x)`)
    expect(newTimeMs).toBeLessThan(oldTimeMs)
  })
})

test.describe("클라우드 64B 워드 매직바이트 & 크기 선검증 가드", () => {
  test("빈 파일(0B)은 Fail-Closed로 거부된다", async () => {
    const emptyFile = new File([], "empty.png", { type: "image/png" })
    const result = await validateCloudFileBeforeUpload(emptyFile)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain("0바이트")
    }
  })

  test("크기 상한 초과 파일은 업로드 전에 차단된다", async () => {
    const oversizedFile = {
      name: "huge.jpg",
      size: MAX_CLOUD_IMAGE_BYTES + 1024,
      type: "image/jpeg",
      slice: () => ({ arrayBuffer: async () => new ArrayBuffer(64) }),
    } as unknown as File

    const result = await validateCloudFileBeforeUpload(oversizedFile)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain("상한")
    }
  })

  test("PNG 매직바이트 (0x89504E47)가 있는 유효한 파일은 통과한다", async () => {
    const buffer = new ArrayBuffer(64)
    const view = new DataView(buffer)
    view.setUint32(0, 0x89504e47, false) // \x89PNG

    const pngFile = new File([buffer], "photo.png", { type: "image/png" })
    const result = await validateCloudFileBeforeUpload(pngFile)
    expect(result.ok).toBe(true)
  })

  test("JPEG 매직바이트 (0xFFD8FF)가 있는 파일은 통과한다", async () => {
    const buffer = new ArrayBuffer(64)
    const view = new DataView(buffer)
    view.setUint16(0, 0xffd8, false)
    view.setUint8(2, 0xff)

    const jpgFile = new File([buffer], "photo.jpg", { type: "image/jpeg" })
    const result = await validateCloudFileBeforeUpload(jpgFile)
    expect(result.ok).toBe(true)
  })

  test("MP4 매직바이트 (ftyp 0x66747970)가 있는 파일은 통과한다", async () => {
    const buffer = new ArrayBuffer(64)
    const view = new DataView(buffer)
    view.setUint32(4, 0x66747970, false) // ftyp at offset 4

    const mp4File = new File([buffer], "video.mp4", { type: "video/mp4" })
    const result = await validateCloudFileBeforeUpload(mp4File)
    expect(result.ok).toBe(true)
  })

  test("실행 파일 (.exe, .sh) 및 확장자 위장 실행 바이너리(MZ/ELF)는 거부된다", async () => {
    const buffer = new ArrayBuffer(64)
    const exeFile = new File([buffer], "malicious.exe", { type: "application/x-msdownload" })
    const result = await validateCloudFileBeforeUpload(exeFile)
    expect(result.ok).toBe(false)

    // .pdf로 위장한 PE(MZ) 바이너리 거부
    const mzBuf = new ArrayBuffer(64)
    new DataView(mzBuf).setUint16(0, 0x4d5a, false)
    const spoofedPdf = new File([mzBuf], "invoice.pdf", { type: "application/pdf" })
    const spoofedPdfResult = await validateCloudFileBeforeUpload(spoofedPdf)
    expect(spoofedPdfResult.ok).toBe(false)

    // .png로 위장한 비정상 헤더 파일 거부
    const fakePng = new File([new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x20, 0x3e])], "fake.png", {
      type: "image/png",
    })
    const fakePngResult = await validateCloudFileBeforeUpload(fakePng)
    expect(fakePngResult.ok).toBe(false)
  })

  test("유효 시그니처 미디어/문서 파일은 통과하고 무효 시그니처 MP4는 거부된다", async () => {
    const validMp4Header = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    ])
    const validMp4File = new File([validMp4Header], "test.mp4", { type: "video/mp4" })
    const result = await validateCloudFileBeforeUpload(validMp4File)
    expect(result.ok).toBe(true)

    const spoofedMp4File = new File([new Uint8Array([1, 2, 3, 4])], "fake.mp4", { type: "video/mp4" })
    const spoofedResult = await validateCloudFileBeforeUpload(spoofedMp4File)
    expect(spoofedResult.ok).toBe(false)
  })
})

test.describe("Uppy 스타일 업로드 큐 및 진행률 계산", () => {
  test("큐 합산 진행률이 가중치에 맞게 계산된다", () => {
    const queue = [
      { id: "1", file: {} as File, name: "f1", byteSize: 100, folderPath: "", status: "done" as const, progress: 100, message: "" },
      { id: "2", file: {} as File, name: "f2", byteSize: 100, folderPath: "", status: "uploading" as const, progress: 50, message: "" },
      { id: "3", file: {} as File, name: "f3", byteSize: 100, folderPath: "", status: "queued" as const, progress: 0, message: "" },
    ]
    const agg = computeAggregateQueueProgress(queue)
    expect(agg.totalCount).toBe(3)
    expect(agg.activeCount).toBe(1)
    expect(agg.completedCount).toBe(1)
    expect(agg.queuedCount).toBe(1)
    // loaded = 100 + 50 + 0 = 150 / 300 = 50%
    expect(agg.percent).toBe(50)
  })

  test("Shift+Click 다중 선택 범위가 정확히 계산된다", () => {
    const allIds = [10, 20, 30, 40, 50]
    expect(computeShiftRangeSelection(1, 3, allIds)).toEqual([20, 30, 40])
    expect(computeShiftRangeSelection(4, 2, allIds)).toEqual([30, 40, 50])
  })
})

test.describe("글 목록 모델 unlisted 패싯 및 상태 라벨", () => {
  test("unlisted 상태 필터가 올바르게 매핑된다", () => {
    const unlistedRow = { title: "Unlisted Post", published: true, listed: false, tempDraft: false }
    expect(getWorkspacePostStatusFilter(unlistedRow)).toBe("unlisted")

    const publishedRow = { title: "Published Post", published: true, listed: true, tempDraft: false }
    expect(getWorkspacePostStatusFilter(publishedRow)).toBe("published")
  })

  test("공개 상태 라벨이 언어에 맞게 출력된다", () => {
    const mockPost: AdminPostListItem = {
      id: 1,
      title: "Test Post",
      authorName: "Admin",
      published: true,
      listed: false,
      createdAt: "2026-01-01",
      modifiedAt: "2026-01-01",
      hitCount: 0,
    }
    expect(workspaceStatusLabel(mockPost, "ko")).toBe("링크 공개")
    expect(workspaceStatusLabel(mockPost, "en")).toBe("Unlisted")
    expect(visibilityLabel(true, false, "ko")).toBe("링크 공개")
    expect(visibilityLabel(true, false, "en")).toBe("Unlisted")
  })
})

test.describe("크롭 휠 및 키보드 조작 헬퍼", () => {
  test("휠 deltaY에 따른 줌 확대 및 축소가 클램핑된다", () => {
    expect(computeNextWheelZoom(1.5, -100)).toBe(1.55)
    expect(computeNextWheelZoom(1.5, 100)).toBe(1.45)
    expect(computeNextWheelZoom(2.8, -100)).toBe(2.8) // max clamp (2.8)
    expect(computeNextWheelZoom(1.0, 100)).toBe(1.0) // min clamp (1.0)
  })

  test("방향키 조작 시 일반 10px, Shift 누르면 50px 이동한다", () => {
    expect(computeKeyboardMove("ArrowLeft", false)).toEqual({ deltaX: -10, deltaY: 0 })
    expect(computeKeyboardMove("ArrowLeft", true)).toEqual({ deltaX: -50, deltaY: 0 })
    expect(computeKeyboardMove("ArrowUp", false)).toEqual({ deltaX: 0, deltaY: -10 })
    expect(computeKeyboardMove("ArrowUp", true)).toEqual({ deltaX: 0, deltaY: -50 })
    expect(computeKeyboardMove("Enter", false)).toBeNull()
  })
})

test.describe("운영 도구 DLQ 선별 리플레이 및 폴링 간격", () => {
  test("지수 백오프 폴링 간격 상수가 올바르게 정의되어 있다", () => {
    expect(POLLING_DELAYS_MS).toEqual([700, 1400, 2800, 4000, 4000, 4000, 4000, 4000])
  })

  test("DLQ 리플레이 요청 모델이 taskIds 배열을 올바르게 검증한다", () => {
    const req = AdminTaskDlqReplayModel.validateRequest({
      operationId: "8d39047c-7791-4c0f-9136-0fcdb021942d",
      reason: "Replaying specific tasks",
      taskIds: [101, 102, 103],
    })
    expect(req.ok).toBe(true)
    if (req.ok) {
      expect(req.value.taskIds).toEqual([101, 102, 103])
    }
  })
})

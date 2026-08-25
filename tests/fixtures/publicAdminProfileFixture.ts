import type { AdminProfile } from "src/types/adminProfile"

export const PUBLIC_ADMIN_PROFILE_FIXTURE = {
  username: "aquila",
  name: "aquila",
  nickname: "aquila",
  profileImageUrl: "/avatar.png",
  profileImageDirectUrl: "/avatar.png",
  profileRole: "Backend Developer",
  profileBio: "서버 안정성과 운영 복구를 함께 고민합니다.",
  aboutHeadline: "이유를 먼저 따지고, 운영 가능한 시스템을 설계합니다.",
  aboutRole: "Backend Developer",
  aboutBio:
    "안녕하세요, 백엔드 개발자 아퀼라입니다.\nJava, Kotlin, Spring Boot를 기반으로 견고한 시스템을 설계합니다.\n블로그에는 기술의 본질을 파고드는 과정을 기록하고 있습니다.",
  aboutSections: [
    {
      id: "journey",
      title: "이력",
      items: ["ADsP [2025.09.05]", "정보처리기사 [2025.09.12]", "독학사 컴퓨터공학 [2026.02.25]", "SQLD [2026.03.27]"],
      dividerBefore: false,
    },
    {
      id: "projects",
      title: "프로젝트",
      items: ["고구마마켓", "마음-온", "aquila-blog", "aquila-bank"],
      dividerBefore: false,
    },
  ],
  aboutProjectSectionTitle: "프로젝트",
  aboutProjects: [
    {
      id: "market",
      name: "고구마마켓",
      summary: "거래 흐름과 상태 전이를 직접 설계하며 커머스 도메인 감각을 다진 프로젝트입니다.",
      role: "Backend · 도메인 설계",
      href: "",
      linkLabel: "",
    },
    {
      id: "blog",
      name: "aquila-blog",
      summary: "글쓰기, 공개 렌더링, 운영 배포까지 직접 관리하는 개인 기술 블로그입니다.",
      role: "Full-stack · Editor/SSR/Deploy",
      href: "https://github.com/AquilaXk/aquila-blog",
      linkLabel: "aquila-blog",
    },
  ],
  serviceLinks: [
    { icon: "service", label: "aquila-blog", href: "https://github.com/AquilaXk/aquila-blog" },
  ],
  contactLinks: [{ icon: "github", label: "GitHub", href: "https://github.com/AquilaXk" }],
} satisfies AdminProfile

export const createPublicAdminProfileSnapshotFixture = () => ({
  ...PUBLIC_ADMIN_PROFILE_FIXTURE,
  modifiedAt: new Date().toISOString(),
})

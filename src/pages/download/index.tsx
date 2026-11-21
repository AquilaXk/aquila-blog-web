import type { GetServerSideProps } from "next"
import MetaConfig from "src/components/MetaConfig"
import { resolveCompanySubpageUrl, resolvePublicSurfaceUrl } from "src/libs/publicSurfaceUrl"
import {
  getLastKnownGoodEasyOfficeRelease,
  resolveEasyOfficeReleaseSnapshot,
} from "src/libs/server/easyofficeRelease"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import {
  detectClientDownloadOs,
  normalizeDownloadOs,
  type DownloadOsKey,
  type EasyOfficeReleaseInfo,
} from "src/routes/Company/CompanyDownloadModel"
import CompanyDownloadPageView from "src/routes/Company/CompanyDownloadPageView"
import type { NextPageWithLayout } from "../../types"

const CACHE_CONTROL_PUBLISHED = "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
const CACHE_CONTROL_FALLBACK = "public, max-age=0, s-maxage=15, stale-while-revalidate=30"
const RELEASE_DEADLINE_MS = 1_500

const withDeadline = async <T,>(work: Promise<T>, deadlineMs: number, onDeadline: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onDeadline), deadlineMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

type DownloadPageProps = {
  canonicalUrl: string
  companyUrl: string
  initialOs: DownloadOsKey
  hasExplicitOsQuery: boolean
  release: EasyOfficeReleaseInfo | null
}

export const getServerSideProps: GetServerSideProps<DownloadPageProps> = withSsrMetrics<DownloadPageProps>(
  "public",
  async ({ req, res, query }) => {
    const hasExplicitOsQuery = typeof query.os === "string" || Array.isArray(query.os)
    const initialOs = hasExplicitOsQuery
      ? normalizeDownloadOs(query.os)
      : detectClientDownloadOs(req.headers["user-agent"] || "")
    const release = await withDeadline(
      resolveEasyOfficeReleaseSnapshot(),
      RELEASE_DEADLINE_MS,
      getLastKnownGoodEasyOfficeRelease()
    )
    res.setHeader("Cache-Control", release ? CACHE_CONTROL_PUBLISHED : CACHE_CONTROL_FALLBACK)

    return {
      props: {
        canonicalUrl: resolveCompanySubpageUrl("/download", req.headers.host),
        companyUrl: resolvePublicSurfaceUrl("company", req.headers.host),
        initialOs,
        hasExplicitOsQuery,
        release,
      },
    }
  }
)

const DownloadPage: NextPageWithLayout<DownloadPageProps> = ({
  canonicalUrl,
  companyUrl,
  initialOs,
  hasExplicitOsQuery,
  release,
}) => (
  <>
    <MetaConfig
      title={
        release
          ? `EasyOffice 다운로드 (${release.tag}) | Aquila Software`
          : "EasyOffice 다운로드 | Aquila Software"
      }
      description="macOS 유니버설(.dmg), Windows x64(.exe), Linux(.deb·.rpm·AppImage)용 오프라인 올인원 오피스 EasyOffice 설치 파일과 체크섬 검증 명령을 제공합니다."
      type="website"
      url={canonicalUrl}
      canonicalUrl={canonicalUrl}
      siteName="Aquila Software"
    />
    <CompanyDownloadPageView
      initialOs={initialOs}
      hasExplicitOsQuery={hasExplicitOsQuery}
      surfaceUrl={canonicalUrl}
      companyUrl={companyUrl}
      release={release}
    />
  </>
)

export default DownloadPage

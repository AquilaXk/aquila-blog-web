import type { GetServerSideProps } from "next"
import MetaConfig from "src/components/MetaConfig"
import { resolvePublicSurfaceUrl } from "src/libs/publicSurfaceUrl"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import EasySubwayPageView from "src/routes/EasySubway/EasySubwayPageView"
import { PRODUCT_SURFACE } from "src/routes/EasySubway/EasySubwayPageModel"
import type { NextPageWithLayout } from "../../types"

const CACHE_CONTROL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600"

type EasySubwayPageProps = {
  canonicalUrl: string
}

export const getServerSideProps: GetServerSideProps<EasySubwayPageProps> = withSsrMetrics<EasySubwayPageProps>("public", async ({ req, res }) => {
  res.setHeader("Cache-Control", CACHE_CONTROL)

  return {
    props: {
      canonicalUrl: resolvePublicSurfaceUrl("product", req.headers.host),
    },
  }
})

const EasySubwayPage: NextPageWithLayout<EasySubwayPageProps> = ({ canonicalUrl }) => (
  <>
    <MetaConfig
      title="교통약자를 먼저 생각한 지하철 길찾기"
      description="전국 정식 출시를 준비하는 Android/iOS 도시철도 이동 지원 서비스입니다. 노선도와 역 검색, 계단과 환승 동선을 고려한 무장애 경로를 제공합니다."
      type="website"
      url={canonicalUrl}
      canonicalUrl={canonicalUrl}
      siteName={PRODUCT_SURFACE.name}
      image="/easysubway/og-image.png"
    />
    <EasySubwayPageView surfaceUrl={canonicalUrl} />
  </>
)

export default EasySubwayPage

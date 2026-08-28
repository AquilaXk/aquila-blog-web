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
      title={`${PRODUCT_SURFACE.name} — 교통약자를 먼저 생각한 지하철 길찾기`}
      description="전국 정식 출시를 준비하는 Android/iOS 도시철도 이동 지원 서비스입니다. 노선도와 역 검색은 기기에서 제공하며, 경로 계산은 Journey V3 서버가 제공할 때만 이용할 수 있습니다."
      type="website"
      url={canonicalUrl}
      canonicalUrl={canonicalUrl}
      siteName={PRODUCT_SURFACE.name}
    />
    <EasySubwayPageView surfaceUrl={canonicalUrl} />
  </>
)

export default EasySubwayPage

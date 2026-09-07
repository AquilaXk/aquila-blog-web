import Footer from "./Footer"
import styled from "@emotion/styled"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import FeedExplorer from "./FeedExplorer"

type Props = {
  initialAdminProfile?: AdminProfile | null
  initialHomeBootstrapStatus?: "ready" | "degraded" | "shell"
}

const Feed: React.FC<Props> = ({ initialHomeBootstrapStatus = "ready" }) => {
  return (
    <StyledWrapper data-ui="feed-home-product-shell">
      <div className="mid">
        <FeedExplorer initialBootstrapDegraded={initialHomeBootstrapStatus === "degraded"} />
        <div className="footer">
          <Footer />
        </div>
      </div>
    </StyledWrapper>
  )
}

export default Feed

const StyledWrapper = styled.div`
  display: block;
  position: relative;
  z-index: 0;
  isolation: isolate;
  padding: 0 0 2.4rem;
  color: var(--aq-text);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    z-index: -1;
    width: 100vw;
    transform: translateX(-50%);
    background-color: var(--aq-page-bg);
  }

  @media (max-width: 768px) {
    padding: 0.5rem 0 1.1rem;
  }

  > .mid {
    display: grid;
    min-width: 0;
    gap: 0;

    @media (max-width: 768px) {
      gap: 0.82rem;
    }

    > .footer {
      padding-bottom: 2rem;
    }

  }
`

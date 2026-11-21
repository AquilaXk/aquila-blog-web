import styled from "@emotion/styled"
import {
  adminCardBorder,
  adminMutedSurface,
  adminMutedText,
  adminPrimaryText,
  adminRaisedSurface,
  adminSecondaryText,
} from "src/routes/Admin/adminColorTokens"

export const AdminSectionHeading = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.8rem;

  @media (max-width: 760px) {
    flex-direction: column;
    align-items: stretch;
  }
`

export const AdminSectionTitleStack = styled.div`
  min-width: 0;
  display: grid;
  gap: 0.2rem;

  h2,
  h3 {
    margin: 0;
    color: ${({ theme }) => adminPrimaryText(theme)};
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    color: ${({ theme }) => adminMutedText(theme)};
    font-size: 0.84rem;
    line-height: 1.55;
  }
`

export const AdminPaneHeader = styled.div`
  display: grid;
  gap: 0.22rem;
  padding-bottom: 0.95rem;
  border-bottom: 0;

  h2 {
    margin: 0;
    font-size: clamp(1.24rem, 2vw, 1.5rem);
    line-height: 1.2;
    color: ${({ theme }) => adminPrimaryText(theme)};
  }

  p {
    margin: 0;
    color: ${({ theme }) => adminMutedText(theme)};
    font-size: 0.86rem;
    line-height: 1.55;
  }
`

export const AdminWorkspaceHeroLabel = styled.span`
  display: inline-flex;
  width: fit-content;
  min-height: 28px;
  align-items: center;
  padding: 0 0.72rem;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => adminCardBorder(theme)};
  background: ${({ theme }) => adminRaisedSurface(theme)};
  color: ${({ theme }) => adminSecondaryText(theme)};
  font-size: 0.74rem;
  font-weight: 800;
`

export const AdminWorkspaceHeroLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

export const AdminWorkspaceHeroCopy = styled.div`
  display: grid;
  gap: 0.28rem;

  h1 {
    margin: 0;
    font-size: clamp(1.12rem, 1.8vw, 1.36rem);
    line-height: 1.1;
    letter-spacing: 0;
    color: ${({ theme }) => adminPrimaryText(theme)};
  }

  p {
    margin: 0;
    max-width: 36rem;
    color: ${({ theme }) => adminMutedText(theme)};
    font-size: 0.88rem;
    line-height: 1.58;
  }
`

export const AdminWorkspaceHeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;

  @media (max-width: 900px) {
    justify-content: flex-start;
  }
`

export const AdminWorkspaceActionDock = styled.div`
  display: grid;
  justify-items: stretch;
`

export const AdminWorkspaceActionDockInner = styled.div`
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 0.62rem 0.7rem;
  border-radius: 8px;
  border: 0;
  border-bottom: 0;
  background: ${({ theme }) => adminMutedSurface(theme)};

  @media (max-width: 760px) {
    justify-content: space-between;
  }
`

export const AdminInfoList = styled.div`
  display: grid;
  gap: 0.6rem;
`

export const AdminInfoStatusList = styled.div`
  display: grid;
  gap: 0.55rem;
`

export const AdminInfoStatusItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.72rem;
  padding: 0.74rem 0.82rem;
  border-radius: 8px;
  border: 0;
  border-bottom: 0;
  background: ${({ theme }) => adminMutedSurface(theme)};

  &[data-tone="good"] {
    color: ${({ theme }) => theme.colors.statusSuccessText};

    strong {
      color: ${({ theme }) => theme.colors.statusSuccessText};
    }
  }

  &[data-tone="warn"] {
    color: ${({ theme }) => theme.colors.orange11};

    strong {
      color: ${({ theme }) => theme.colors.orange11};
    }
  }

  span {
    color: ${({ theme }) => adminMutedText(theme)};
    font-size: 0.76rem;
    font-weight: 700;
  }

  strong {
    color: ${({ theme }) => adminPrimaryText(theme)};
    font-size: 0.82rem;
    font-weight: 780;
    text-align: right;
  }
`

export const AdminInfoPanelCard = styled.div`
  display: grid;
  gap: 0.68rem;
  padding: 0.92rem 0.98rem;
  border-radius: 8px;
  border: 0;
  border-bottom: 0;
  background: ${({ theme }) => adminMutedSurface(theme)};
`

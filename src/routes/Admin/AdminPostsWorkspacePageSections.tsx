import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  AdminWorkspaceHero,
  AdminWorkspaceHeroCopy,
} from "./AdminSurfacePrimitives"

export const Main = styled.main`
  min-height: 100vh;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 2.55rem 2.125rem 4.375rem;
  display: grid;
  align-content: start;
  gap: 1.5rem;
  background: ${({ theme }) => theme.colors.gray1};

  @media (max-width: 768px) {
    gap: 1rem;
    padding: 1rem 0.82rem 2rem;
  }
`

export const HeroSection = styled(AdminWorkspaceHero)`
  padding: 0;
  border: 0;
  background: transparent;
`

export const PostsHeroCopy = styled(AdminWorkspaceHeroCopy)`
  min-width: 0;

  h1 {
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  > span {
    color: ${({ theme }) => theme.colors.blue11};
    font-size: 0.62rem;
    font-weight: 820;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 1rem;
    line-height: 1.5;
  }
`

export const WorkspaceBody = styled.div`
  display: grid;
  gap: 1rem;
`

export const WorkspaceMain = styled.div`
  display: grid;
  gap: 1rem;
`

export const PrimaryCta = styled.button`
  border: 0;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.blue11};
  color: ${({ theme }) => theme.colors.gray1};
  min-height: 38px;
  padding: 0 0.95rem;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  ${focusVisibleRing}

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const ListSection = styled.section`
  display: grid;
  gap: 0.9rem;
`

/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/gh-snippet-preview.hbs (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/tabs.tsx (MIT License, Copyright (c) shadcn)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderSubtle,
  adminCardShadow,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

export const SerpPreviewSection = styled.section`
  display: grid;
  gap: 0.75rem;
  padding-top: 0.9rem;
  border-top: 1px solid ${adminBorderSubtle};
`

export const SerpPreviewHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`

export const SerpPreviewTabs = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: ${adminSurfaceMuted};
`

export const SerpPreviewTabButton = styled.button<{ "data-active"?: boolean }>`
  padding: 0.3rem 0.68rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 0;
  background: ${({ "data-active": active }) => (active ? adminSurface : "transparent")};
  color: ${({ "data-active": active }) => (active ? adminTextPrimary : adminTextMuted)};
  box-shadow: ${({ "data-active": active }) => (active ? adminCardShadow : "none")};
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
  }

  @media (pointer: coarse) {
    min-height: 44px;
    padding: 0.45rem 0.75rem;
  }
`

export const SerpResultCard = styled.div`
  padding: 0.9rem 1rem;
  border-radius: 8px;
  background: ${adminSurface};
  border: 1px solid ${adminBorder};
  display: grid;
  gap: 0.28rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`

export const SerpResultUrl = styled.div`
  font-size: 0.72rem;
  color: ${adminTextMuted};
  display: flex;
  align-items: center;
  gap: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SerpResultTitle = styled.div`
  font-size: 0.94rem;
  font-weight: 600;
  color: ${adminTextPrimary};
  line-height: 1.32;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SerpResultSnippet = styled.div`
  font-size: 0.78rem;
  color: ${adminTextSecondary};
  line-height: 1.48;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const SocialOgCard = styled.div`
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  overflow: hidden;
  background: ${adminSurface};
`

export const SocialOgImageContainer = styled.div`
  width: 100%;
  aspect-ratio: 1.91 / 1;
  background: ${adminSurfaceMuted};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SocialOgNoImage = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: ${adminTextMuted};
`

export const SocialOgMeta = styled.div`
  padding: 0.75rem 1rem;
  display: grid;
  gap: 0.22rem;
  background: ${adminSurfaceRaised};
  border-top: 1px solid ${adminBorderSubtle};
`

export const SocialOgDomain = styled.div`
  font-size: 0.68rem;
  text-transform: uppercase;
  color: ${adminTextMuted};
  letter-spacing: 0.04em;
`

export const SocialOgTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 650;
  color: ${adminTextPrimary};
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SocialOgDescription = styled.div`
  font-size: 0.75rem;
  color: ${adminTextSecondary};
  line-height: 1.42;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

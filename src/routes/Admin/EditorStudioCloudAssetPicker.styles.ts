import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { adminBorderSubtle, adminCheckerboardBackground } from "src/routes/Admin/adminColorTokens"

export const PickerFilterChip = styled.button<{ "data-active"?: boolean }>`
  min-height: 28px;
  padding: 0 0.56rem;
  border-radius: 6px;
  font-size: 0.73rem;
  font-weight: 650;
  cursor: pointer;
  border: 0;
  background: ${({ theme, "data-active": active }) =>
    active ? theme.colors.gray12 : theme.colors.gray3};
  color: ${({ theme, "data-active": active }) =>
    active ? theme.colors.gray1 : theme.colors.gray11};
  ${focusVisibleRing}
  &:hover {
    background: ${({ theme, "data-active": active }) =>
      active ? theme.colors.gray12 : theme.colors.gray4};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const CloudAssetPickerSection = styled.section`
  display: grid;
  gap: 0.5rem;
  padding: 16px 0;
  margin: 0;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;

  .pickerHeader,
  .pickerFilterRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .pickerBody {
    display: grid;
    gap: 0.55rem;
    padding-top: 0.45rem;
    border-top: 1px solid ${adminBorderSubtle};
  }
  .pickerControls {
    display: grid;
    gap: 0.42rem;
  }
  .pickerSearchInput {
    width: 100%;
    min-height: 34px;
    padding: 0 0.65rem;
    border-radius: 6px;
    border: 1px solid transparent;
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 0.78rem;
    box-sizing: border-box;
    ${focusVisibleRing}
    &:focus-visible {
      background: ${({ theme }) => theme.colors.gray1};
      border-color: ${({ theme }) => theme.colors.gray8};
    }
    @media (pointer: coarse) {
      min-height: 44px;
      font-size: 1rem;
    }
  }
  .pickerFilterTabs,
  .pickerFolderRow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.28rem;
  }
  .pickerError {
    margin: 0;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.red11};
  }
  .pickerEmpty {
    margin: 0;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.gray10};
  }
  .assetGrid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    max-height: 18rem;
    overflow-y: auto;
    @media (max-width: 460px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .assetCard {
    display: grid;
    gap: 0.36rem;
    padding: 0.42rem;
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.gray2};
  }
  .assetThumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: 6px;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: ${adminCheckerboardBackground};
    color: ${({ theme }) => theme.colors.gray10};
    &[data-fallback="true"] {
      background: ${({ theme }) => theme.colors.gray3};
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumbFallback {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumbExpandBtn {
      position: absolute;
      top: 0.32rem;
      right: 0.32rem;
      width: 26px;
      height: 26px;
      display: inline-grid;
      place-items: center;
      border: 0;
      border-radius: 6px;
      background: ${({ theme }) => theme.colors.gray1};
      color: ${({ theme }) => theme.colors.gray12};
      cursor: pointer;
      opacity: 0.86;
      ${focusVisibleRing}
      &:hover {
        opacity: 1;
      }
      @media (pointer: coarse) {
        width: 44px;
        height: 44px;
      }
    }
  }
  .assetMeta {
    min-width: 0;
    display: grid;
    gap: 0.08rem;
    strong,
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    strong {
      font-size: 0.74rem;
      font-weight: 700;
      color: ${({ theme }) => theme.colors.gray12};
    }
    span {
      font-size: 0.68rem;
      color: ${({ theme }) => theme.colors.gray10};
    }
    .assetIneligibleReason {
      color: ${({ theme }) => theme.colors.red11};
      font-weight: 600;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      word-break: keep-all;
      line-height: 1.3;
    }
  }
`

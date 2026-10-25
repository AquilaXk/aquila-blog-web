import styled from "@emotion/styled";
export const EditorStudioRoot = styled.main `
  box-sizing: border-box;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  height: 100vh;
  min-height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  padding: 0;
  display: grid;
  grid-template-rows: 58px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  overflow-x: clip;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};

  @media (max-width: 1024px) {
    padding: 0;
  }

  @media (max-width: 820px) {
    grid-template-rows: auto minmax(0, 1fr);
  }
`;
export const EditorStudioPageHeading = styled.h1 `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`;
export const EditorStudioLoadingState = styled.div `
  min-height: calc(100vh - 10rem);
  display: grid;
  place-content: center;
  gap: 0.4rem;
  text-align: center;

  strong {
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 1.1rem;
  }

  span {
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 0.9rem;
  }
`;
export const EditorStudioDedicatedTopBar = styled.div `
  width: 100%;
  height: 58px;
  min-height: 58px;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  padding: 0 16px;
  border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.readableSurface};

  @media (max-width: 820px) {
    height: auto;
    min-height: 52px;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 8px;
    padding: 8px 12px;
  }
`;
export const EditorExitAction = styled.button `
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 9px;
  min-width: 0;
  min-height: 34px;
  width: max-content;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 0.9rem;
  font-weight: 750;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
  @media (pointer: coarse) { min-height: 44px; }

  &:hover {
    background: transparent;
    color: ${({ theme }) => theme.colors.blue10};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${({ theme }) => (theme.colors.blue4)};
  }

  @media (max-width: 1200px) {
    justify-content: flex-start;
  }
`;
export const EditorStudioTopBarActions = styled.div `
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  justify-content: flex-end;

  button {
    height: 38px;
    min-height: 38px;
    padding: 0 14px;
    @media (pointer: coarse) { height: auto; min-height: 44px; }
  }

  @media (max-width: 1200px) {
    width: auto;
    margin-left: auto;
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  @media (max-width: 820px) {
    grid-column: 1 / -1;
    width: 100%;
    justify-self: stretch;
    margin-left: 0;
    justify-content: flex-end;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-top: 2px;

    button {
      height: auto;
      min-height: 44px;
      padding: 0 9px;
      font-size: 0.78rem;
      white-space: nowrap;
      flex-shrink: 0;
    }
  }
`;
export const EditorStudioSaveState = styled.span `
  color: ${({ theme }) => theme.colors.gray10};
  font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  white-space: nowrap;
  text-align: center;

  &[data-tone="success"] {
    color: ${({ theme }) => theme.colors.green12};
  }

  &[data-tone="loading"] {
    color: ${({ theme }) => theme.colors.blue9};
  }

  &[data-tone="error"] {
    color: ${({ theme }) => theme.colors.red10};
  }

  @media (max-width: 820px) {
    font-size: 10px;
  }
`;
const Button = styled.button `
  border: 1px solid ${({ theme }) => (theme.colors.gray6)};
  border-radius: 6px;
  padding: 0.62rem 0.92rem;
  min-height: 44px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray10};
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => (theme.colors.gray8)};
    background: ${({ theme }) => (theme.colors.gray3)};
    color: ${({ theme }) => theme.colors.gray12};
  }

  &:focus-visible {
    outline: none;
    border-color: ${({ theme }) => (theme.colors.blue8)};
    box-shadow: 0 0 0 3px ${({ theme }) => (theme.colors.blue4)};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;
export const PrimaryButton = styled(Button) `
  border-radius: 6px;
  padding: 0.6rem 0.88rem;
  border-color: ${({ theme }) => theme.publicDesign.accent};
  background: ${({ theme }) => theme.publicDesign.accent};
  color: ${({ theme }) => (theme.scheme === "dark" ? theme.colors.gray1 : theme.colors.accentControlText)};
  font-weight: 750;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.publicDesign.accentHover};
    background: ${({ theme }) => theme.publicDesign.accentHover};
    color: ${({ theme }) => (theme.scheme === "dark" ? theme.colors.gray1 : theme.colors.accentControlText)};
  }
`;
export const SecondaryButton = styled(Button) `
  border-radius: 6px;
  border-color: ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
  font-weight: 700;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.publicDesign.borderStrong};
    background: ${({ theme }) => theme.colors.gray2};
  }
`;
export const EditorSidebarToggleButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.gray8 : theme.publicDesign.border)};
  border-radius: 5px;
  background: ${({ theme, $active }) => ($active ? theme.colors.gray4 : theme.publicDesign.readableSurface)};
  color: ${({ theme, $active }) => ($active ? theme.colors.gray12 : theme.colors.gray10)};
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.16s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.gray8};
    color: ${({ theme }) => theme.colors.gray12};
    background: ${({ theme }) => theme.colors.gray3};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.blue4};
  }
  @media (pointer: coarse) { height: auto; min-height: 44px; }

  @media (max-width: 820px) {
    &[data-mobile-hidden="true"] {
      display: none;
    }
  }
`;

export const EditorStudioFrame = styled.div<{
  $showOutline?: boolean;
  $showInspector?: boolean;
}>`
  width: 100%;
  min-height: 0;
  margin: 0;
  display: grid;
  grid-template-columns: ${({ $showOutline = true, $showInspector = true }) => {
    if ($showOutline && $showInspector) return "240px minmax(0, 1fr) 300px"
    if ($showOutline && !$showInspector) return "240px minmax(0, 1fr)"
    if (!$showOutline && $showInspector) return "minmax(0, 1fr) 300px"
    return "minmax(0, 1fr)"
  }};
  gap: 0;
  align-items: stretch;
  overflow-x: clip;

  @media (max-width: 1100px) {
    grid-template-columns: ${({ $showOutline = true, $showInspector = false }) => {
      if ($showOutline && $showInspector) return "200px minmax(0, 1fr)"
      if ($showOutline) return "200px minmax(0, 1fr)"
      if ($showInspector) return "minmax(0, 1fr)"
      return "minmax(0, 1fr)"
    }};
    grid-template-rows: minmax(0, 1fr) auto;
  }

  @media (max-width: 820px) {
    width: 100vw;
    max-width: 100vw;
    display: block;
    overflow-x: hidden;
    overflow-y: auto;
  }
`;

export const EditorStudioWritingColumn = styled.section<{
  $zenMode?: boolean;
}>`
  position: relative;
  display: grid;
  min-width: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0;
  overflow: hidden;
  max-width: ${({ $zenMode }) => ($zenMode ? "880px" : "100%")};
  margin: ${({ $zenMode }) => ($zenMode ? "0 auto" : "0")};
  width: 100%;
`;
export const EditorStudioDedicatedMetaSection = styled.section`
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-inline: auto;
  display: grid;
  gap: 0;
  border: 0;
  border-bottom: 1px solid transparent;
  border-radius: 0;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  padding: 28px 32px 12px 64px;

  @media (max-width: 820px) {
    width: 100vw;
    max-width: 100vw;
    box-sizing: border-box;
    padding: 18px 16px 12px 16px;
  }
`;
export const EditorTagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  min-height: 26px;
`;
export const SelectedTagChip = styled.span`
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  min-height: 26px;
  border-radius: 5px;
  border: 1px solid rgba(35, 131, 226, 0.25);
  background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(35, 131, 226, 0.18)" : "#e9f3f7")};
  color: ${({ theme }) => (theme.scheme === "dark" ? "#93c5fd" : "#14569b")};
  overflow: hidden;
  transition: border-color 0.18s ease, background 0.18s ease;

  &:nth-of-type(6n + 2) {
    border-color: rgba(144, 101, 176, 0.25);
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(144, 101, 176, 0.2)" : "#f6f3f9")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#d8b4fe" : "#5b3678")};
  }
  &:nth-of-type(6n + 3) {
    border-color: rgba(16, 185, 129, 0.25);
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(16, 185, 129, 0.18)" : "#edf3ec")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#6ee7b7" : "#255c3e")};
  }
  &:nth-of-type(6n + 4) {
    border-color: rgba(245, 158, 11, 0.28);
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(245, 158, 11, 0.18)" : "#fbf3db")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#fcd34d" : "#78490a")};
  }
  &:nth-of-type(6n + 5) {
    border-color: rgba(235, 87, 87, 0.25);
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(235, 87, 87, 0.18)" : "#fdebec")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#fca5a5" : "#9c2520")};
  }
  &:nth-of-type(6n + 6) {
    border-color: rgba(2, 132, 199, 0.25);
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(2, 132, 199, 0.18)" : "#e0f2fe")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#7dd3fc" : "#075985")};
  }

  .label {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 8px;
    color: inherit;
    font: 650 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  }

  button {
    display: inline-flex; align-items: center; justify-content: center; align-self: stretch;
    min-width: 24px; padding: 0 5px; border: 0; border-left: 1px solid currentColor;
    background: transparent; color: inherit; opacity: 0.72; cursor: pointer; flex: 0 0 auto;
    font-size: 0.94rem; line-height: 1; transition: opacity 0.15s ease, background 0.15s ease;
    &:hover { opacity: 1; background: rgba(15, 23, 42, 0.06); }
    &:focus-visible { opacity: 1; outline: 2px solid currentColor; outline-offset: -2px; }
    @media (max-width: 768px), (pointer: coarse) { min-width: 44px; min-height: 44px; }
  }
`;
export const InlineMetaInput = styled.input `
  width: 100%; max-width: 100%; box-sizing: border-box; flex: 1 1 12rem; min-width: 11rem;
  border: 0; border-bottom: 1px solid transparent; outline: none; min-height: 32px;
  padding: 0 0.12rem; border-radius: 0; background: transparent;
  color: ${({ theme }) => theme.colors.gray12}; font-size: 0.86rem; font-weight: 500;
  transition: border-color 0.16s ease;
  @media (max-width: 768px), (pointer: coarse) { min-height: 44px; }
  &::placeholder { color: ${({ theme }) => theme.colors.gray10}; }
  &:hover { border-bottom-color: ${({ theme }) => theme.colors.gray6}; }
  &:focus-visible { outline: none; border-bottom-color: ${({ theme }) => theme.colors.blue8}; }
`;

export const EditorInspectorTagInputRow = styled.div`
  display: flex;
  gap: 8px;

  input {
    min-width: 0; flex: 1 1 auto; width: auto; min-height: 44px; box-sizing: border-box;
    border: 1px solid ${({ theme }) => theme.publicDesign.border}; border-radius: 6px;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12}; font-size: 0.88rem; padding: 10px;
    &:focus-visible { outline: none; border-color: ${({ theme }) => theme.colors.blue8}; box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.blue4}; }
  }

  button {
    width: auto; min-width: 44px; min-height: 44px; flex: 0 0 auto;
    border: 1px solid ${({ theme }) => theme.publicDesign.border}; border-radius: 6px; padding: 0 10px;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12}; cursor: pointer; white-space: nowrap;
    &:focus-visible { outline: none; border-color: ${({ theme }) => theme.colors.blue8}; box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.blue4}; }
  }
`;

export const EditorInspectorFullWidthAction = styled(SecondaryButton)`
  width: 100%;
  margin-top: 8px;
`;

export const TitleInput = styled.textarea`
  width: 100%; max-width: 100%; min-width: 0; border: 0; border-radius: 0; padding: 0;
  min-height: 48px; outline: none; background: transparent; box-shadow: none;
  font-family: inherit; font-size: 36px; font-weight: 850; line-height: 1.25;
  letter-spacing: -0.03em; resize: none; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere;
  &::placeholder { color: ${({ theme }) => theme.colors.gray9}; }
  &:focus, &:focus-visible { outline: none; box-shadow: none; border-color: transparent; }
  @media (max-width: 820px) { font-size: 28px; }
`;
export const EditorHeaderMetaRow = styled.div<{
  $collapsedOnMobile?: boolean;
  $collapsedInZen?: boolean;
  $collapsedWhenInspectorOpen?: boolean;
}>`
  display: ${({ $collapsedInZen }) => ($collapsedInZen ? "none" : "flex")};
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
  min-width: 0;
  margin-top: 10px;

  @media (min-width: 1101px) {
    input { ${({ $collapsedWhenInspectorOpen }) => ($collapsedWhenInspectorOpen ? "max-width: 148px;" : "display: inline-flex;")} }
  }

  @media (max-width: 820px) {
    ${({ $collapsedOnMobile }) => ($collapsedOnMobile ? "display: none;" : "display: flex;")}
  }
`;

export const EditorHiddenFileInput = styled.input`
  display: none;
`;

export const EditorStudioTopBarLead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const MobilePropertiesToggle = styled.button<{ $visibleOnDesktop?: boolean }>`
  display: ${({ $visibleOnDesktop }) => ($visibleOnDesktop ? "inline-flex" : "none")};
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 4px;
  padding: 4px 10px;
  margin-top: 8px;
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  &:focus-visible { outline: none; border-color: ${({ theme }) => theme.colors.blue8}; box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.blue4}; }

  @media (max-width: 820px), (pointer: coarse) {
    display: inline-flex;
    min-height: 44px;
    min-width: 44px;
  }
`;
export const EditorHeaderMetaPill = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0;
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
`;
export const PublishNotice = styled.div`
  position: absolute;
  left: 32px;
  right: 32px;
  bottom: 18px;
  z-index: 10;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 6px;
  font-size: 0.83rem;
  line-height: 1.4;
  width: auto;
  box-sizing: border-box;
  &[data-tone="idle"] { color: ${({ theme }) => theme.colors.gray11}; border: 1px solid ${({ theme }) => theme.colors.gray6}; background: transparent; }
  &[data-tone="loading"] { color: ${({ theme }) => theme.colors.blue11}; border: 1px solid ${({ theme }) => theme.colors.blue7}; background: ${({ theme }) => theme.colors.blue3}; }
  &[data-tone="success"] { color: ${({ theme }) => theme.colors.green11}; border: 1px solid ${({ theme }) => theme.colors.green7}; background: ${({ theme }) => theme.colors.green3}; }
  &[data-tone="error"] { color: ${({ theme }) => theme.colors.red11}; border: 1px solid ${({ theme }) => theme.colors.red7}; background: ${({ theme }) => theme.colors.red3}; }
  @media (max-width: 820px) { left: 16px; right: 16px; bottom: 16px; }
`;
export {
  EditorGuideBackdrop,
  EditorGuideBody,
  EditorGuideGrid,
  EditorGuidePanel,
  EditorGuideRepo,
  EditorInspector,
  EditorOutline,
  EditorOutlineItem,
  EditorPanelHeader,
  EditorStudioDedicatedCanvasSection,
  EditorStudioGuideModal,
  EditorStudioStatusBar,
  LocalDraftRestoreCard,
} from "./EditorStudioDedicatedPanelParts";

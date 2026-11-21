/**
 * 참조 구현:
 * 1) phosphor-icons/core assets/regular/*.svg (MIT License, Copyright (c) 2020 Phosphor Icons) — @strapi/icons 원본 벡터
 * 2) strapi/strapi packages/core/upload/admin/src/utils/getAssetIcon.ts (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * 3) igordanchenko/yet-another-react-lightbox src/components/Icons.tsx · src/plugins/zoom/ZoomButton.tsx ·
 *    src/plugins/download/DownloadButton.tsx · src/plugins/fullscreen/FullscreenButton.tsx (MIT License, Copyright (c) 2022 Igor Danchenko)
 */
import React from "react"

export type StrapiIconProps = React.SVGProps<SVGSVGElement>

const createPhosphorIcon = (displayName: string, pathData: string): React.FC<StrapiIconProps> => {
  const Component: React.FC<StrapiIconProps> = ({ width = 20, height = 20, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={width}
      height={height}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={pathData} />
    </svg>
  )
  Component.displayName = displayName
  return Component
}

export const StrapiFileIcon = createPhosphorIcon(
  "StrapiFileIcon",
  "M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"
)

export const StrapiFilePdfIcon = createPhosphorIcon(
  "StrapiFilePdfIcon",
  "M224,152a8,8,0,0,1-8,8H192v16h16a8,8,0,0,1,0,16H192v16a8,8,0,0,1-16,0V152a8,8,0,0,1,8-8h32A8,8,0,0,1,224,152ZM92,172a28,28,0,0,1-28,28H56v8a8,8,0,0,1-16,0V152a8,8,0,0,1,8-8H64A28,28,0,0,1,92,172Zm-16,0a12,12,0,0,0-12-12H56v24h8A12,12,0,0,0,76,172Zm88,8a36,36,0,0,1-36,36H112a8,8,0,0,1-8-8V152a8,8,0,0,1,8-8h16A36,36,0,0,1,164,180Zm-16,0a20,20,0,0,0-20-20h-8v40h8A20,20,0,0,0,148,180ZM40,112V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88v24a8,8,0,0,1-16,0V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0ZM160,80h28.69L160,51.31Z"
)

export const StrapiFileCsvIcon = createPhosphorIcon(
  "StrapiFileCsvIcon",
  "M48,180c0,11,7.18,20,16,20a14.24,14.24,0,0,0,10.22-4.66A8,8,0,0,1,85.78,206.4,30.06,30.06,0,0,1,64,216c-17.65,0-32-16.15-32-36s14.35-36,32-36a30.06,30.06,0,0,1,21.78,9.6,8,8,0,0,1-11.56,11.06A14.24,14.24,0,0,0,64,160C55.18,160,48,169,48,180Zm79.6-8.69c-4-1.16-8.14-2.35-10.45-3.84-1.25-.81-1.23-1-1.12-1.9a4.57,4.57,0,0,1,2-3.67c4.6-3.12,15.34-1.73,19.82-.56A8,8,0,0,0,142,145.86c-2.12-.55-21-5.22-32.84,2.76a20.58,20.58,0,0,0-9,14.95c-2,15.88,13.65,20.41,23,23.11,12.06,3.49,13.12,4.92,12.78,7.59-.31,2.41-1.26,3.34-2.14,3.93-4.6,3.06-15.17,1.56-19.55.36A8,8,0,0,0,109.94,214a61.34,61.34,0,0,0,15.19,2c5.82,0,12.3-1,17.49-4.46a20.82,20.82,0,0,0,9.19-15.23C154,179,137.49,174.17,127.6,171.31Zm83.09-26.84a8,8,0,0,0-10.23,4.84L188,184.21l-12.47-34.9a8,8,0,0,0-15.07,5.38l20,56a8,8,0,0,0,15.07,0l20-56A8,8,0,0,0,210.69,144.47ZM216,88v24a8,8,0,0,1-16,0V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-27.31-8L160,51.31V80Z"
)

export const StrapiFileXlsIcon = createPhosphorIcon(
  "StrapiFileXlsIcon",
  "M156,208a8,8,0,0,1-8,8H120a8,8,0,0,1-8-8V152a8,8,0,0,1,16,0v48h20A8,8,0,0,1,156,208ZM92.65,145.49a8,8,0,0,0-11.16,1.86L68,166.24,54.51,147.35a8,8,0,1,0-13,9.3L58.17,180,41.49,203.35a8,8,0,0,0,13,9.3L68,193.76l13.49,18.89a8,8,0,0,0,13-9.3L77.83,180l16.68-23.35A8,8,0,0,0,92.65,145.49Zm98.94,25.82c-4-1.16-8.14-2.35-10.45-3.84-1.25-.82-1.23-1-1.12-1.9a4.54,4.54,0,0,1,2-3.67c4.6-3.12,15.34-1.72,19.82-.56a8,8,0,0,0,4.07-15.48c-2.11-.55-21-5.22-32.83,2.76a20.58,20.58,0,0,0-8.95,14.95c-2,15.88,13.65,20.41,23,23.11,12.06,3.49,13.12,4.92,12.78,7.59-.31,2.41-1.26,3.33-2.15,3.93-4.6,3.06-15.16,1.55-19.54.35A8,8,0,0,0,173.93,214a60.63,60.63,0,0,0,15.19,2c5.82,0,12.3-1,17.49-4.46a20.81,20.81,0,0,0,9.18-15.23C218,179,201.48,174.17,191.59,171.31ZM40,112V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88v24a8,8,0,1,1-16,0V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0ZM160,80h28.68L160,51.31Z"
)

export const StrapiFileZipIcon = createPhosphorIcon(
  "StrapiFileZipIcon",
  "M184,144H168a8,8,0,0,0-8,8v56a8,8,0,0,0,16,0v-8h8a28,28,0,0,0,0-56Zm0,40h-8V160h8a12,12,0,0,1,0,24Zm-48-32v56a8,8,0,0,1-16,0V152a8,8,0,0,1,16,0ZM96,208a8,8,0,0,1-8,8H56a8,8,0,0,1-7-12l25.16-44H56a8,8,0,0,1,0-16H88a8,8,0,0,1,7,12L69.79,200H88A8,8,0,0,1,96,208ZM213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v72a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48v16a8,8,0,0,0,16,0V88A8,8,0,0,0,213.66,82.34ZM160,80V51.31L188.69,80Z"
)

export const StrapiFileCodeIcon = createPhosphorIcon(
  "StrapiFileCodeIcon",
  "M181.66,146.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L164.69,152l-18.35-18.34a8,8,0,0,1,11.32-11.32Zm-72-24a8,8,0,0,0-11.32,0l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L91.31,152l18.35-18.34A8,8,0,0,0,109.66,122.34ZM216,88V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-56-8h28.69L160,51.31Zm40,136V96H152a8,8,0,0,1-8-8V40H56V216H200Z"
)

export const StrapiFileTextIcon = createPhosphorIcon(
  "StrapiFileTextIcon",
  "M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z"
)

export const StrapiPlayIcon = createPhosphorIcon(
  "StrapiPlayIcon",
  "M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"
)

export const StrapiHeadphonesIcon = createPhosphorIcon(
  "StrapiHeadphonesIcon",
  "M201.89,54.66A103.43,103.43,0,0,0,128.79,24H128A104,104,0,0,0,24,128v56a24,24,0,0,0,24,24H64a24,24,0,0,0,24-24V144a24,24,0,0,0-24-24H40.36A88,88,0,0,1,128,40h.67a87.71,87.71,0,0,1,87,80H192a24,24,0,0,0-24,24v40a24,24,0,0,0,24,24h16a24,24,0,0,0,24-24V128A103.41,103.41,0,0,0,201.89,54.66ZM64,136a8,8,0,0,1,8,8v40a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V136Zm152,48a8,8,0,0,1-8,8H192a8,8,0,0,1-8-8V144a8,8,0,0,1,8-8h24Z"
)

export const StrapiImageIcon = createPhosphorIcon(
  "StrapiImageIcon",
  "M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"
)

export const StrapiFolderIcon = createPhosphorIcon(
  "StrapiFolderIcon",
  "M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z"
)

export const StrapiTrashIcon = createPhosphorIcon(
  "StrapiTrashIcon",
  "M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"
)

export const StrapiLinkIcon = createPhosphorIcon(
  "StrapiLinkIcon",
  "M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,16,.45A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z"
)

export const StrapiDownloadIcon = createPhosphorIcon(
  "StrapiDownloadIcon",
  "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"
)

export const StrapiReplaceIcon = createPhosphorIcon(
  "StrapiReplaceIcon",
  "M88,104H40a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0V76.69L62.63,62.06A95.43,95.43,0,0,1,130,33.94h.53a95.36,95.36,0,0,1,67.07,27.33,8,8,0,0,1-11.18,11.44,79.52,79.52,0,0,0-55.89-22.77h-.45A79.56,79.56,0,0,0,73.94,73.37L59.31,88H88a8,8,0,0,1,0,16Zm128,48H168a8,8,0,0,0,0,16h28.69l-14.63,14.63a79.56,79.56,0,0,1-56.13,23.43h-.45a79.52,79.52,0,0,1-55.89-22.77,8,8,0,1,0-11.18,11.44,95.36,95.36,0,0,0,67.07,27.33H126a95.43,95.43,0,0,0,67.36-28.12L208,179.31V208a8,8,0,0,0,16,0V160A8,8,0,0,0,216,152Z"
)

export const StrapiArrowLineRightIcon = createPhosphorIcon(
  "StrapiArrowLineRightIcon",
  "M189.66,122.34a8,8,0,0,1,0,11.32l-72,72a8,8,0,0,1-11.32-11.32L164.69,136H32a8,8,0,0,1,0-16H164.69L106.34,61.66a8,8,0,0,1,11.32-11.32ZM216,32a8,8,0,0,0-8,8V216a8,8,0,0,0,16,0V40A8,8,0,0,0,216,32Z"
)

export const StrapiCornersOutIcon = createPhosphorIcon(
  "StrapiCornersOutIcon",
  "M216,48V88a8,8,0,0,1-16,0V56H168a8,8,0,0,1,0-16h40A8,8,0,0,1,216,48ZM88,200H56V168a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H88a8,8,0,0,0,0-16Zm120-40a8,8,0,0,0-8,8v32H168a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V168A8,8,0,0,0,208,160ZM88,40H48a8,8,0,0,0-8,8V88a8,8,0,0,0,16,0V56H88a8,8,0,0,0,0-16Z"
)

export const StrapiCrossIcon = createPhosphorIcon(
  "StrapiCrossIcon",
  "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"
)

export const StrapiMoreIcon = createPhosphorIcon(
  "StrapiMoreIcon",
  "M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM128,72a12,12,0,1,0-12-12A12,12,0,0,0,128,72Zm0,112a12,12,0,1,0,12,12A12,12,0,0,0,128,184Z"
)

export const StrapiGridFourIcon = createPhosphorIcon(
  "StrapiGridFourIcon",
  "M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z"
)

export const StrapiListBulletsIcon = createPhosphorIcon(
  "StrapiListBulletsIcon",
  "M80,64a8,8,0,0,1,8-8H216a8,8,0,0,1,0,16H88A8,8,0,0,1,80,64Zm136,56H88a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Zm0,64H88a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16ZM44,52A12,12,0,1,0,56,64,12,12,0,0,0,44,52Zm0,64a12,12,0,1,0,12,12A12,12,0,0,0,44,116Zm0,64a12,12,0,1,0,12,12A12,12,0,0,0,44,180Z"
)

export const StrapiCheckIcon = createPhosphorIcon(
  "StrapiCheckIcon",
  "M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"
)

export const StrapiWarningCircleIcon = createPhosphorIcon(
  "StrapiWarningCircleIcon",
  "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"
)

export const StrapiUploadIcon = createPhosphorIcon(
  "StrapiUploadIcon",
  "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z"
)

const DOC_ICON_MAP: Record<string, React.FC<StrapiIconProps>> = {
  pdf: StrapiFilePdfIcon,
  csv: StrapiFileCsvIcon,
  tsv: StrapiFileCsvIcon,
  xls: StrapiFileXlsIcon,
  xlsx: StrapiFileXlsIcon,
  zip: StrapiFileZipIcon,
  tar: StrapiFileZipIcon,
  gz: StrapiFileZipIcon,
  tgz: StrapiFileZipIcon,
  "7z": StrapiFileZipIcon,
  rar: StrapiFileZipIcon,
  md: StrapiFileCodeIcon,
  markdown: StrapiFileCodeIcon,
  mdx: StrapiFileCodeIcon,
  json: StrapiFileCodeIcon,
  jsonl: StrapiFileCodeIcon,
  yml: StrapiFileCodeIcon,
  yaml: StrapiFileCodeIcon,
  xml: StrapiFileCodeIcon,
  sql: StrapiFileCodeIcon,
  sh: StrapiFileCodeIcon,
  ts: StrapiFileCodeIcon,
  tsx: StrapiFileCodeIcon,
  js: StrapiFileCodeIcon,
  jsx: StrapiFileCodeIcon,
  mjs: StrapiFileCodeIcon,
  kt: StrapiFileCodeIcon,
  java: StrapiFileCodeIcon,
  py: StrapiFileCodeIcon,
  go: StrapiFileCodeIcon,
  rs: StrapiFileCodeIcon,
  html: StrapiFileCodeIcon,
  css: StrapiFileCodeIcon,
  txt: StrapiFileTextIcon,
  log: StrapiFileTextIcon,
}

const AUDIO_EXT_SET = new Set(["mp3", "wav", "m4a", "ogg", "flac", "aac", "opus", "weba"])
const VIDEO_EXT_SET = new Set(["mp4", "webm", "mov", "mkv", "m4v", "avi"])
const IMAGE_EXT_SET = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "ico"])

export const extractNormalizedFileExtension = (extOrFilename: string | undefined): string => {
  if (!extOrFilename) return ""
  const trimmed = extOrFilename.trim()
  if (!trimmed) return ""
  const dotIndex = trimmed.lastIndexOf(".")
  const raw = dotIndex >= 0 ? trimmed.slice(dotIndex + 1) : trimmed
  return raw.toLowerCase()
}

/**
 * Strapi packages/core/upload/admin/src/utils/getAssetIcon.ts 기반 파일 아이콘 매핑
 */
export const getStrapiAssetIcon = (
  mime: string | undefined,
  extOrFilename: string | undefined
): React.FC<StrapiIconProps> => {
  const lowerMime = (mime || "").toLowerCase()
  const ext = extractNormalizedFileExtension(extOrFilename)

  if (lowerMime.includes("image") || IMAGE_EXT_SET.has(ext)) {
    return StrapiImageIcon
  }
  if (lowerMime.includes("video") || VIDEO_EXT_SET.has(ext)) {
    return StrapiPlayIcon
  }
  if (lowerMime.includes("audio") || AUDIO_EXT_SET.has(ext)) {
    return StrapiHeadphonesIcon
  }
  return (ext && DOC_ICON_MAP[ext]) || StrapiFileIcon
}

/* -------------------------------------------------------------------------------------------------
 * Yet-Another-React-Lightbox (MIT) Verbatim 24×24 SVG Icons
 * -----------------------------------------------------------------------------------------------*/

const createYarlIcon = (displayName: string, glyph: React.ReactNode): React.FC<StrapiIconProps> => {
  const Component: React.FC<StrapiIconProps> = ({ width = 24, height = 24, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g fill="currentColor">
        <path d="M0 0h24v24H0z" fill="none" />
        {glyph}
      </g>
    </svg>
  )
  Component.displayName = displayName
  return Component
}

export const YarlCloseIcon = createYarlIcon(
  "YarlCloseIcon",
  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
)

export const YarlPreviousIcon = createYarlIcon(
  "YarlPreviousIcon",
  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
)

export const YarlNextIcon = createYarlIcon(
  "YarlNextIcon",
  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
)

export const YarlZoomInIcon = createYarlIcon(
  "YarlZoomInIcon",
  <>
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" />
  </>
)

export const YarlZoomOutIcon = createYarlIcon(
  "YarlZoomOutIcon",
  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z" />
)

export const YarlDownloadIcon = createYarlIcon(
  "YarlDownloadIcon",
  <path d="M18 15v3H6v-3H4v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h-2zm-1-4-1.41-1.41L13 12.17V4h-2v8.17L8.41 9.59 7 11l5 5 5-5z" />
)

export const YarlEnterFullscreenIcon = createYarlIcon(
  "YarlEnterFullscreenIcon",
  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
)

export const YarlExitFullscreenIcon = createYarlIcon(
  "YarlExitFullscreenIcon",
  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
)

export const YarlErrorIcon = createYarlIcon(
  "YarlErrorIcon",
  <path d="M21.9,21.9l-8.49-8.49l0,0L3.59,3.59l0,0L2.1,2.1L0.69,3.51L3,5.83V19c0,1.1,0.9,2,2,2h13.17l2.31,2.31L21.9,21.9z M5,18 l3.5-4.5l2.5,3.01L12.17,15l3,3H5z M21,18.17L5.83,3H19c1.1,0,2,0.9,2,2V18.17z" />
)

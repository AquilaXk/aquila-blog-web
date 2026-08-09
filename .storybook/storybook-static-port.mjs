/**
 * @param {string | undefined} value
 * @returns {number}
 */
export const resolveStorybookStaticPort = (value) => {
  if (value === undefined) return 6006
  if (!/^[1-9]\d*$/.test(value)) {
    throw new TypeError("STORYBOOK_STATIC_PORT must be a canonical decimal port")
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port > 65_535) {
    throw new RangeError("STORYBOOK_STATIC_PORT must be between 1 and 65535")
  }

  return port
}

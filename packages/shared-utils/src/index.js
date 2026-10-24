const toSafeInt = (value, fallback) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  return fallback
}

module.exports = {
  toSafeInt,
}

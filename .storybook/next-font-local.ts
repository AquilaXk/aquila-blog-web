type LocalFontOptions = {
  fallback?: string[]
}

const localFont = ({ fallback = ["sans-serif"] }: LocalFontOptions) => ({
  className: "storybook-next-font-local",
  style: {
    fontFamily: fallback.join(", "),
    fontWeight: "400",
    fontStyle: "normal",
  },
})

export default localFont

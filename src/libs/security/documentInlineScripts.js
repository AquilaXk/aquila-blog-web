/**
 * Document-level inline scripts owned by `_document.tsx`.
 * CSP `script-src` hashes must match these strings byte-for-byte.
 */

/** @type {string} */
const AQUILA_SCHEME_BOOTSTRAP_SCRIPT = `
(function () {
  if (typeof document === "undefined") return;
  var nextScheme = "light";
  var bootstrapSource = "configured";
  var background = "#f7f7f5";
  var foreground = "#101214";
  document.documentElement.dataset.aquilaScheme = nextScheme;
  document.documentElement.setAttribute("data-aquila-scheme-config", "light");
  document.documentElement.setAttribute("data-aquila-scheme-bootstrap", nextScheme);
  document.documentElement.setAttribute("data-aquila-scheme-bootstrap-source", bootstrapSource);
  document.documentElement.style.colorScheme = nextScheme;
  document.documentElement.style.backgroundColor = background;
  var style = document.createElement("style");
  style.setAttribute("data-aquila-scheme-bootstrap-style", "true");
  style.textContent = "html[data-aquila-scheme-bootstrap]{background:" + background + ";color-scheme:" + nextScheme + ";}html[data-aquila-scheme-bootstrap] body{background:" + background + ";color:" + foreground + ";color-scheme:" + nextScheme + ";}";
  document.head.appendChild(style);
})();
`

/** @type {string} */
const CLIENT_RUNTIME_RECOVERY_SCRIPT = `
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var storageKeyPrefix = "__aquila_client_runtime_recovery__";
  var getBuildId = function () {
    try {
      return (window.__NEXT_DATA__ && window.__NEXT_DATA__.buildId) || "unknown-build";
    } catch (_) {
      return "unknown-build";
    }
  };
  var getStorageKey = function () {
    var pathname = window.location && window.location.pathname ? window.location.pathname : "/";
    return storageKeyPrefix + ":" + getBuildId() + ":" + pathname;
  };
  var isManifestAsset = function (target) {
    return typeof target === "string" && (target.indexOf("/_buildManifest.js") >= 0 || target.indexOf("/_ssgManifest.js") >= 0);
  };
  var isHydrationRuntimeError = function (message) {
    return typeof message === "string" && (
      message.indexOf("Minified React error #418") >= 0 ||
      message.indexOf("Minified React error #423") >= 0 ||
      message.indexOf("Hydration failed") >= 0 ||
      message.indexOf("There was an error while hydrating") >= 0 ||
      message.indexOf("did not match") >= 0
    );
  };
  var extractMessage = function (value) {
    if (typeof value === "string") return value;
    if (value && typeof value.message === "string") return value.message;
    return "";
  };
  var readStorageItem = function (key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (_) {
      return null;
    }
  };
  var writeStorageItem = function (key, value) {
    try {
      window.sessionStorage.setItem(key, value);
      return window.sessionStorage.getItem(key) === value;
    } catch (_) {
      return false;
    }
  };
  var reloadOnce = function (reason) {
    var storageKey = getStorageKey();
    if (readStorageItem(storageKey) === "1") return;
    if (!writeStorageItem(storageKey, "1")) return;
    if (typeof reason === "string" && reason.length > 0) {
      writeStorageItem(storageKey + ":reason", reason);
    }
    window.location.reload();
  };
  window.addEventListener(
    "error",
    function (event) {
      var target = event && event.target;
      if (target instanceof HTMLScriptElement) {
        var src = target.getAttribute("src") || "";
        if (isManifestAsset(src)) {
          reloadOnce("manifest:" + src);
        }
        return;
      }
      var message = extractMessage((event && event.error) || (event && event.message));
      if (!isHydrationRuntimeError(message)) return;
      reloadOnce("hydration:" + message.slice(0, 80));
    },
    true
  );
  window.addEventListener("unhandledrejection", function (event) {
    var message = extractMessage(event && event.reason);
    if (!isHydrationRuntimeError(message)) return;
    reloadOnce("hydration-promise:" + message.slice(0, 80));
  });
})();
`

module.exports = {
  AQUILA_SCHEME_BOOTSTRAP_SCRIPT,
  CLIENT_RUNTIME_RECOVERY_SCRIPT,
}

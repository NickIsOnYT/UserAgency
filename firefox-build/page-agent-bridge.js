(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const messageType = "user-agency:user-agent-settings";
  const stateKeys = ["userAgent", "allowList", "invertAllowList", "siteSettings"];

  function sendSettings(settings) {
    const userAgent = typeof settings.userAgent === "string" ? settings.userAgent.trim() : "";
    const domains = Array.isArray(settings.allowList)
      ? settings.allowList.filter((domain) => typeof domain === "string")
      : [];
    const hostname = location.hostname.toLowerCase();
    const matchesList = domains.some((domain) => {
      const normalizedDomain = domain.toLowerCase();
      return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
    });
    const allowedByList = domains.length === 0
      ? false
      : (settings.invertAllowList === true ? !matchesList : matchesList);
    const siteSettings = settings.siteSettings && typeof settings.siteSettings === "object"
      ? settings.siteSettings
      : {};
    const matchingSettings = Object.keys(siteSettings)
      .filter((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
      .sort((left, right) => right.length - left.length);
    let spoofNavigator = allowedByList;
    for (const domain of matchingSettings) {
      const value = siteSettings[domain]?.spoofNavigator;
      if (typeof value === "boolean") {
        spoofNavigator = value;
        break;
      }
    }
    const shouldOverride = spoofNavigator && userAgent.length > 0;

    window.postMessage({
      type: messageType,
      settings: {
        spoofNavigator: shouldOverride,
        userAgent: shouldOverride ? userAgent : ""
      }
    }, "*");
  }

  extensionApi.storage.local.get(stateKeys)
    .then(sendSettings)
    .catch((error) => console.error("Could not load webpage User-Agent settings:", error));

  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !stateKeys.some((key) => key in changes)) {
      return;
    }
    extensionApi.storage.local.get(stateKeys)
      .then(sendSettings)
      .catch((error) => console.error("Could not refresh webpage User-Agent settings:", error));
  });
})();

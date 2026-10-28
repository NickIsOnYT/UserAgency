(() => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");
  const messageType = "user-agency:user-agent-settings";

  function restoreUserAgent() {
    if (originalDescriptor) {
      Object.defineProperty(navigator, "userAgent", originalDescriptor);
    } else {
      delete navigator.userAgent;
    }
  }

  function applySettings(settings) {
    const userAgent = typeof settings.userAgent === "string"
      ? settings.userAgent.trim()
      : "";
    const shouldOverride = settings.spoofNavigator === true
      && userAgent.length > 0
      && !/[\u0000-\u001f\u007f]/.test(userAgent);

    try {
      if (shouldOverride) {
        Object.defineProperty(navigator, "userAgent", {
          configurable: true,
          enumerable: true,
          get: () => userAgent
        });
      } else {
        restoreUserAgent();
      }
    } catch (error) {
      console.error("Could not override navigator.userAgent:", error);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== messageType) {
      return;
    }
    applySettings(event.data.settings ?? {});
  });
})();

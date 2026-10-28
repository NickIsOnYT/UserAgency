const extensionApi = globalThis.browser ?? globalThis.chrome;
const RULE_IDS = [1, 2, 3];
const STATE_KEYS = ["enabled", "userAgent", "allowList", "invertAllowList"];

async function syncUserAgentRule() {
  const state = await extensionApi.storage.local.get(STATE_KEYS);
  const enabled = state.enabled === true;
  const userAgent = typeof state.userAgent === "string" ? state.userAgent.trim() : "";
  const domains = Array.isArray(state.allowList)
    ? [...new Set(state.allowList.filter((domain) => typeof domain === "string" && domain))]
    : [];

  let addRules = [];
  if (enabled && userAgent) {
    const headerRule = {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "user-agent",
        operation: "set",
        value: userAgent
      }]
    };
    const allHttpRequests = { urlFilter: "|http" };

    if (domains.length === 0) {
      addRules = [{
        id: 1,
        priority: 1,
        action: headerRule,
        condition: allHttpRequests
      }];
    } else if (state.invertAllowList === true) {
      addRules = [
        {
          id: 1,
          priority: 1,
          action: headerRule,
          condition: allHttpRequests
        },
        {
          id: 2,
          priority: 2,
          action: { type: "allow" },
          condition: {
            ...allHttpRequests,
            requestDomains: domains,
            resourceTypes: ["main_frame"]
          }
        },
        {
          id: 3,
          priority: 2,
          action: { type: "allow" },
          condition: {
            ...allHttpRequests,
            initiatorDomains: domains
          }
        }
      ];
    } else {
      addRules = [
        {
          id: 1,
          priority: 1,
          action: headerRule,
          condition: {
            ...allHttpRequests,
            requestDomains: domains,
            resourceTypes: ["main_frame"]
          }
        },
        {
          id: 2,
          priority: 1,
          action: headerRule,
          condition: {
            ...allHttpRequests,
            initiatorDomains: domains
          }
        }
      ];
    }
  }

  await extensionApi.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: RULE_IDS,
    addRules
  });
}

let syncQueue = Promise.resolve();

function scheduleSync() {
  syncQueue = syncQueue
    .then(syncUserAgentRule)
    .catch((error) => console.error("Could not update User-Agent rules:", error));
}

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && STATE_KEYS.some((key) => key in changes)) {
    scheduleSync();
  }
});

extensionApi.runtime.onStartup.addListener(() => {
  scheduleSync();
});

extensionApi.runtime.onInstalled.addListener(() => {
  scheduleSync();
});

scheduleSync();

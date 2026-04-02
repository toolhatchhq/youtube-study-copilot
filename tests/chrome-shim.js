function createChromeEvent() {
  return {
    addListener: () => {}
  };
}

// Minimal chrome.* shim so ES module source files can be imported in Node.
globalThis.chrome = {
  runtime: {
    getManifest: () => ({ version: "1.0.0" }),
    getURL: (path = "") => `chrome-extension://test/${path}`,
    id: "testextensionid1234",
    sendMessage: (_msg, cb) => cb({ ok: true, data: null }),
    lastError: null,
    onInstalled: createChromeEvent(),
    onMessage: createChromeEvent()
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {}
    }
  },
  tabs: {
    query: async () => [],
    get: async () => null,
    create: async () => ({}),
    onActivated: createChromeEvent(),
    onUpdated: createChromeEvent()
  },
  sidePanel: {
    setOptions: async () => {},
    setPanelBehavior: async () => {}
  },
  scripting: {
    executeScript: async () => [{ result: null }]
  },
  permissions: {
    contains: async () => false,
    request: async () => false
  }
};

// DOMParser shim for transcript parsing tests
if (typeof DOMParser === "undefined") {
  const { JSDOM } = await import("jsdom").catch(() => ({ JSDOM: null }));
  if (JSDOM) {
    globalThis.DOMParser = new JSDOM().window.DOMParser;
  }
}

"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const script = fs.readFileSync(path.join(__dirname, "..", "majsoul-naga.user.js"), "utf8");
const fixture = Buffer.from(
  fs.readFileSync(path.join(__dirname, "fixtures", "sample.res.b64"), "utf8"),
  "base64",
);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function varint(value) {
  const bytes = [];
  do {
    bytes.push((value & 127) | (value > 127 ? 128 : 0));
    value >>>= 7;
  } while (value);
  return Buffer.from(bytes);
}
function field(number, value) {
  const bytes = typeof value === "string" ? Buffer.from(value) : value;
  return Buffer.concat([varint(number * 8 + 2), varint(bytes.length), bytes]);
}

// Run the unmodified IIFE, including the real converter and WebSocket hook.
// Every GM request is held locally until a test explicitly resolves/rejects it.
function harness() {
  const listeners = {};
  const cookies = [];
  const requests = [];
  const toast = { style: {} };
  class WebSocket {
    send() {}
    addEventListener(type, listener) {
      this[type] = listener;
    }
  }
  const page = { WebSocket };
  const document = {
    activeElement: null,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    getElementById: () => toast,
  };
  const context = vm.createContext({
    window: {},
    unsafeWindow: page,
    document,
    Uint8Array,
    ArrayBuffer,
    Blob,
    TextDecoder,
    URLSearchParams,
    console: { log() {}, warn() {}, error() {} },
    setTimeout() {},
    clearTimeout() {},
    GM_cookie: { list: (details, callback) => cookies.push(callback) },
    GM_xmlhttpRequest: (request) => requests.push(request),
  });
  vm.runInContext(script, context);
  const core = context.window.__majsoulNaga;
  const recordData = core.decodeRecord(fixture).data;
  const socket = new page.WebSocket("wss://offline.invalid");
  let index = 0;
  function record(id = "replay-a", dataUrl = false) {
    return Buffer.concat([
      field(3, field(1, id)),
      dataUrl ? field(5, "https://offline.invalid/replay") : field(4, recordData),
    ]);
  }
  function capture(bytes = record()) {
    index++;
    socket.send(Buffer.concat([Buffer.from([2, index, 0]), field(1, ".lq.Lobby.fetchGameRecord")]));
    const response = Uint8Array.from(Buffer.concat([Buffer.from([3, index, 0]), field(2, bytes)]));
    socket.message({ data: response.buffer });
  }
  function key(overrides = {}) {
    const target = { tagName: "CANVAS" };
    listeners.keydown({ key: "s", target, composedPath: () => [target], ...overrides });
  }
  async function authorize() {
    assert.ok(cookies.length, "expected a pending CSRF lookup");
    cookies.shift()([{ name: "csrftoken", value: "offline-test-token" }]);
    await flush();
  }
  async function succeed(request = requests.at(-1)) {
    assert.equal(request.method, "POST");
    request.onload({ status: 200, responseText: '{"status":200}' });
    await flush();
  }
  return { document, toast, cookies, requests, record, recordData, capture, key, authorize, succeed };
}

test("shortcut ignores typing, composition, modifiers, repeats, and handled events", async () => {
  const h = harness();
  h.capture();
  for (const event of [
    { key: "x" },
    { repeat: true },
    { defaultPrevented: true },
    { isComposing: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    ...["INPUT", "TEXTAREA", "SELECT"].map((tagName) => ({
      target: { tagName },
      composedPath: undefined,
    })),
    { target: { tagName: "SPAN", isContentEditable: true }, composedPath: undefined },
    // Shadow DOM retargets the event to its host; inspect its composed path too.
    { composedPath: () => [{ tagName: "INPUT" }, { tagName: "DIV" }] },
  ]) {
    h.key(event);
    assert.equal(h.cookies.length, 0, JSON.stringify(event));
  }
  h.document.activeElement = { tagName: "TEXTAREA" };
  h.key();
  h.document.activeElement = null;
  h.document.designMode = "on";
  h.key();
  h.document.designMode = "off";
  assert.equal(h.cookies.length, 0);
  assert.equal(h.requests.length, 0);
  h.key({ key: "S", shiftKey: true });
  await h.authorize();
  await h.succeed();
  assert.match(h.toast.textContent, /Submitted to NAGA/);
});

test("one submission spans CSRF lookup and POST; success survives recapture", async () => {
  const h = harness();
  h.capture();
  h.key();
  h.key();
  assert.equal(h.cookies.length, 1);
  await h.authorize();
  h.key();
  assert.equal(h.requests.length, 1);
  const form = new URLSearchParams(h.requests[0].data);
  assert.equal(form.get("seat"), "0");
  assert.equal(form.get("player_types"), "2");
  assert.equal(form.get("game_type"), "1");
  assert.equal(JSON.parse(form.get("json_data")).length, 3);
  await h.succeed();
  h.key();
  // Same UUID, different serialization: still the same completed replay.
  h.capture(h.record("replay-a", true));
  h.key();
  assert.match(h.toast.textContent, /Already submitted/);
  assert.equal(h.cookies.length, 0);
  assert.equal(h.requests.length, 1);
  h.capture(h.record("replay-b"));
  h.key();
  await h.authorize();
  await h.succeed();
  h.capture();
  h.key();
  assert.equal(h.requests.length, 2);
  assert.equal(h.cookies.length, 0);
});

test("record fetch is guarded and a new capture cannot change the in-flight replay", async () => {
  const h = harness();
  h.capture(h.record("replay-a", true));
  h.key();
  h.key();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].responseType, "arraybuffer");
  h.capture(h.record("replay-b"));
  h.key();
  assert.equal(h.requests.length, 1);
  h.requests[0].onload({ response: Uint8Array.from(h.recordData).buffer });
  await flush();
  await h.authorize();
  await h.succeed();
  h.key();
  await h.authorize();
  await h.succeed();
  h.capture(h.record("replay-a", true));
  h.key();
  assert.equal(h.requests.length, 3); // One fetch and two POSTs.
  assert.equal(h.cookies.length, 0);
});

test("missing capture and conversion errors unlock for a later attempt", async () => {
  const h = harness();
  h.key();
  assert.match(h.toast.textContent, /No replay captured/);
  h.capture(field(3, field(1, "replay-a")));
  h.key();
  assert.match(h.toast.textContent, /neither inline data nor a data_url/);
  h.capture(Buffer.concat([field(3, field(1, "replay-a")), field(4, Buffer.alloc(0))]));
  h.key();
  assert.match(h.toast.textContent, /Error:/);
  assert.equal(h.cookies.length, 0);
  h.capture();
  h.key();
  await h.authorize();
  await h.succeed();
});

test("failed record fetch unlocks without marking the replay completed", async () => {
  const h = harness();
  h.capture(h.record("replay-a", true));
  h.key();
  h.requests[0].onerror(new Error("offline fetch failure"));
  await flush();
  assert.match(h.toast.textContent, /offline fetch failure/);
  h.capture();
  h.key();
  await h.authorize();
  await h.succeed();
});

test("missing CSRF token unlocks and permits a retry", async () => {
  const h = harness();
  h.capture();
  h.key();
  h.cookies.shift()([]);
  await flush();
  h.cookies.shift()([]);
  await flush();
  assert.equal(h.requests[0].method, "GET");
  h.requests[0].onload({ responseHeaders: "" });
  await flush();
  assert.match(h.toast.textContent, /couldn't read NAGA csrftoken/);
  h.key();
  await h.authorize();
  await h.succeed();
});

for (const failure of ["network", "http", "application"]) {
  test(`${failure} submission failure unlocks and permits the same replay to retry`, async () => {
    const h = harness();
    h.capture();
    h.key();
    await h.authorize();
    if (failure === "network") h.requests[0].onerror(new Error("offline POST failure"));
    else
      h.requests[0].onload({
        status: failure === "http" ? 503 : 200,
        responseText: '{"status":500}',
      });
    await flush();
    assert.match(h.toast.textContent, /Error:/);
    h.key();
    await h.authorize();
    await h.succeed();
    h.key();
    assert.equal(h.requests.length, 2);
    assert.equal(h.cookies.length, 0);
  });
}

test("UUID-less replays are deduplicated and a page reload allows deliberate resubmission", async () => {
  const h = harness();
  h.capture(h.record(""));
  h.key();
  await h.authorize();
  await h.succeed();
  h.capture(h.record(""));
  h.key();
  assert.match(h.toast.textContent, /Already submitted/);
  assert.equal(h.requests.length, 1);
  const reloaded = harness();
  reloaded.capture(reloaded.record(""));
  reloaded.key();
  await reloaded.authorize();
  await reloaded.succeed();
});

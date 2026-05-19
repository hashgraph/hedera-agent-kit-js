// Lightweight pub/sub for the chat index. Storage writes call `notifyChange()`
// so the sidebar (and any other listeners) can re-read after a create/save/
// rename/delete. Cross-tab `storage` events are wired by the sidebar directly
// since they only fire on cross-document writes.

const CHANGE_EVENT = "hedera-chat-index-changed";

function getTarget() {
  if (typeof window === "undefined") return null;
  const w = window;
  if (!w.__hederaChatBus) {
    w.__hederaChatBus = new EventTarget();
  }
  return w.__hederaChatBus;
}

export function notifyChange() {
  const target = getTarget();
  if (!target) return;
  target.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onChange(handler) {
  const target = getTarget();
  if (!target) return () => {};
  target.addEventListener(CHANGE_EVENT, handler);
  return () => target.removeEventListener(CHANGE_EVENT, handler);
}

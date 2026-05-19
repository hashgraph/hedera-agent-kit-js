// Canonical chat message types. Runtime-neutral by contract: substrate code,
// storage, and extensions consume these without knowing which runtime adapter
// is active. Runtime mappers translate between this shape and the runtime-
// native wire shape inside `features/chat-runtime/`.

export function isChatToolPart(part) {
  return part.type !== "text";
}

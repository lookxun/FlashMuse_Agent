export function isLocalProtoTestEnabled() {
  return process.env.NODE_ENV !== "production";
}

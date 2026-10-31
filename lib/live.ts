// Live sessions need both keys; without them the app falls back to sample mode.
export function isLive() {
  return Boolean(process.env.QLOO_API_KEY && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN));
}

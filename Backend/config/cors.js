const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://hexachat2.netlify.app',
  'https://hexachat.netlify.app'
].filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

module.exports = { allowedOrigins, isOriginAllowed };

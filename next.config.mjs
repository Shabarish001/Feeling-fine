/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.E2E_GRAPH_TRACE === "1" ? { distDir: ".next-e2e" } : {}),
};
export default nextConfig;

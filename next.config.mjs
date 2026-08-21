/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the whole app runs in the browser and talks to Supabase
  // directly, so Cloudflare Pages only has to serve the files in ./out
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

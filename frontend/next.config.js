/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/backend/:path*",
        destination: `${api}/:path*`,
      },
      {
        source: "/files/:path*",
        destination: `${api}/files/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

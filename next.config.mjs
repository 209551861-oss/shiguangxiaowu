/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  async redirects() {
    return [
      // 画室旧链接：球体明暗那节并入 L1 预科班后换成了 l1-10
      { source: "/studio/sphere-shading", destination: "/studio/l1-10", permanent: true },
    ];
  },
};

export default nextConfig;

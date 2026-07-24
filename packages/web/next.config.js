/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Stake FLX moved onto the /stake page as a section; keep old links working.
      { source: "/stake-rwd", destination: "/stake", permanent: true },
    ];
  },
};

module.exports = nextConfig;

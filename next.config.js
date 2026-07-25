/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/Spa-Weekend-Appetizers",
  assetPrefix: "/Spa-Weekend-Appetizers/",
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

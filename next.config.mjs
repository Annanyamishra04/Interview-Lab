/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    // pdfjs-dist ships ESM-only and mammoth reads zip/xml internals —
    // both should run as real Node modules rather than be bundled.
    serverComponentsExternalPackages: ["pdfjs-dist", "mammoth"],
    // Resume uploads go through a server action; the default 1MB body
    // limit is well under our 5MB resume file cap.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;

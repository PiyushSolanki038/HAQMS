/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the app to call the backend API from any origin in production
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;

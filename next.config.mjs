/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS || false;
let repo = '';
if (isGithubActions && process.env.GITHUB_REPOSITORY) {
  repo = `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`;
} else if (process.env.NEXT_PUBLIC_BASE_PATH) {
  repo = process.env.NEXT_PUBLIC_BASE_PATH;
}

const nextConfig = {
  output: 'export',
  basePath: repo,
  assetPrefix: repo,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;

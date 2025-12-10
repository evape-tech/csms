import type { NextConfig } from "next";

// Bundle analyzer 配置
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // 啟用 Standalone 模式以支援 Docker 部署
  output: "standalone",

  // Server 外部包 (從 experimental 移到頂層)
  serverExternalPackages: ['prisma', '@prisma/client', 'mysql2'],
  
  // 啟用實驗性功能以提升效能
  experimental: {
    // 優化字體載入和包導入
    optimizePackageImports: ['@mui/material', '@mui/icons-material', 'echarts', 'recharts'],
    // 啟用 CSS 優化
    optimizeCss: true,
  },
  
  // 編譯優化
  compiler: {
    // 移除 console.log (生產環境)
    // removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // 圖片優化
  images: {
    // 啟用圖片優化
    formats: ['image/webp', 'image/avif'],
    // 快取優化 - 30天
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // 優化圖片尺寸
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // 啟用 gzip 壓縮
  compress: true,
  
  // 快取優化標頭
  async headers() {
    return [
      {
        // API 路由快取
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        // 靜態資源長期快取
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // 開發環境快取優化
  onDemandEntries: {
    // 開發環境快取時間
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // 其他性能優化
  poweredByHeader: false,
  reactStrictMode: true,
};

export default withBundleAnalyzer(nextConfig);

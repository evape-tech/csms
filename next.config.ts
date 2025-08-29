import type { NextConfig } from "next";

// Bundle analyzer 配置
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
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
    removeConsole: process.env.NODE_ENV === 'production',
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
  
  // webpack 優化
  webpack: (config, { dev, isServer }) => {
    // 開發環境優化
    if (dev) {
      // 減少開發環境的編譯時間
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
      
      // 排除不必要的模組以加速編譯
      config.externals = config.externals || [];
      if (!isServer) {
        config.externals.push({
          'echarts': 'echarts',
          'echarts-for-react': 'echarts-for-react',
        });
      }
    }
    
    // 生產環境優化
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          maxAsyncRequests: 25,
          cacheGroups: {
            default: false,
            vendors: false,
            // 分離 MUI 組件
            mui: {
              name: 'mui',
              test: /[\\/]node_modules[\\/]@mui[\\/]/,
              chunks: 'all',
              priority: 30,
              enforce: true,
            },
            // 分離圖表庫
            charts: {
              name: 'charts',
              test: /[\\/]node_modules[\\/](echarts|recharts)[\\/]/,
              chunks: 'all',
              priority: 25,
              enforce: true,
            },
            // 分離 React
            react: {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            // 其他 vendor 庫
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              chunks: 'all',
              priority: 10,
              minChunks: 1,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    // 加速模組解析
    config.resolve = {
      ...config.resolve,
      modules: ['node_modules'],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    };
    
    return config;
  },
  
  // 啟用 gzip 壓縮
  compress: true,
  
  // 輸出配置
  output: 'standalone',
  
  // 快取優化標頭
  async headers() {
    return [
      {
        // API 路由快取
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300',
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
  // swcMinify 在 Next.js 15 中已移除，因為 SWC 現在是默認的
};

export default withBundleAnalyzer(nextConfig);

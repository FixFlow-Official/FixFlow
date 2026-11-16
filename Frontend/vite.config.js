import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
              priority: 30,
            },
            {
              name: 'pdf-jspdf',
              test: /node_modules[\\/]jspdf[\\/]/,
              priority: 20,
            },
            {
              name: 'pdf-html2canvas',
              test: /node_modules[\\/]html2canvas[\\/]/,
              priority: 20,
            },
            {
              name: 'pdf-dompurify',
              test: /node_modules[\\/]dompurify[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
})

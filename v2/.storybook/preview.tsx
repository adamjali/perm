import type { Preview } from '@storybook/nextjs-vite'
import { withThemeByClassName } from '@storybook/addon-themes'
import { ConvexProvider, ConvexReactClient } from "convex/react"
import "../src/app/globals.css"

// Load Google Fonts for Storybook (Next.js fonts don't work in Storybook)
if (typeof document !== 'undefined' && !document.querySelector('link[href*="fonts.googleapis.com"]')) {
  const fontsLink = document.createElement('link')
  fontsLink.rel = 'stylesheet'
  fontsLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap'
  document.head.appendChild(fontsLink)
}

// Mock Convex client for Storybook - uses a fake URL since we don't actually connect
const mockConvexClient = new ConvexReactClient("https://mock-convex.convex.cloud");

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
    // Wrap with mock Convex provider for components that use Convex hooks
    (Story) => (
      <ConvexProvider client={mockConvexClient}>
        <Story />
      </ConvexProvider>
    ),
    // Add grain overlay and font classes to all stories
    (Story) => (
      <div className="relative min-h-[200px] p-4 bg-background font-body">
        <div className="grain-overlay" aria-hidden="true" />
        <Story />
      </div>
    ),
  ],
};

export default preview;
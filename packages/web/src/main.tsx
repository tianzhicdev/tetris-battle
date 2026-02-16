import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { Capacitor } from '@capacitor/core'
import './App.css'
import './styles/glassmorphism.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isNative = Capacitor.isNativePlatform()

console.log('[MAIN] Platform:', isNative ? 'Native (iOS/Android)' : 'Web')
console.log('[MAIN] Clerk Key exists:', !!PUBLISHABLE_KEY)

// Error Boundary to catch Clerk crashes
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ERROR BOUNDARY] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      console.warn('[ERROR BOUNDARY] Rendering app without Clerk due to error:', this.state.error)
      return <App />
    }
    return this.props.children
  }
}

// Wrapper component for error handling
const AppWrapper = () => {
  // On iOS, skip Clerk entirely for now
  if (isNative) {
    console.warn('[CLERK] Skipping Clerk on native platform')
    return <App />
  }

  if (!PUBLISHABLE_KEY) {
    console.warn('[CLERK] No publishable key - rendering app without auth')
    return <App />
  }

  return (
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#00d4ff',
          colorText: '#ffffff',
          colorTextSecondary: 'rgba(255, 255, 255, 0.7)',
          colorBackground: 'rgba(10, 10, 30, 0.95)',
          colorInputBackground: 'rgba(0, 0, 0, 0.4)',
          colorInputText: '#ffffff',
          colorDanger: '#ff006e',
          borderRadius: '12px',
          fontSize: '16px',
        },
        elements: {
          // Main modal backdrop
          modalBackdrop: {
            backdropFilter: 'blur(20px)',
            background: 'rgba(0, 0, 0, 0.5)',
          },
          rootBox: {
            backdropFilter: 'blur(20px)',
          },
          // Main card container
          card: {
            background: 'rgba(10, 10, 30, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          },
          // Modal content
          modalContent: {
            background: 'rgba(10, 10, 30, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
          },
          // Headers
          headerTitle: {
            color: '#00d4ff',
            textShadow: '0 0 20px rgba(0, 212, 255, 0.6)',
          },
          headerSubtitle: {
            color: 'rgba(255, 255, 255, 0.7)',
          },
          // Social buttons
          socialButtonsBlockButton: {
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: '#ffffff',
            '&:hover': {
              background: 'rgba(0, 212, 255, 0.1)',
              borderColor: 'rgba(0, 212, 255, 0.5)',
            },
          },
          socialButtonsBlockButton__google: {
            '&:hover': {
              background: 'rgba(0, 212, 255, 0.1)',
              borderColor: 'rgba(0, 212, 255, 0.5)',
            },
          },
          socialButtonsBlockButton__apple: {
            '&:hover': {
              background: 'rgba(0, 212, 255, 0.1)',
              borderColor: 'rgba(0, 212, 255, 0.5)',
            },
          },
          // Primary form buttons
          formButtonPrimary: {
            background: 'linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)',
            color: '#000',
            fontWeight: '700',
            boxShadow: '0 4px 15px rgba(0, 212, 255, 0.4)',
            '&:hover': {
              boxShadow: '0 6px 20px rgba(0, 212, 255, 0.6)',
              transform: 'translateY(-1px)',
            },
          },
          // Secondary buttons
          formButtonReset: {
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: '#ffffff',
            '&:hover': {
              background: 'rgba(0, 212, 255, 0.1)',
            },
          },
          // Form inputs
          formFieldInput: {
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: '#ffffff',
            '&:focus': {
              borderColor: 'rgba(0, 212, 255, 0.6)',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
            },
            '&::placeholder': {
              color: 'rgba(255, 255, 255, 0.4)',
            },
          },
          formFieldLabel: {
            color: 'rgba(255, 255, 255, 0.8)',
          },
          // Links
          footerActionLink: {
            color: '#00d4ff',
            '&:hover': {
              color: '#00ff88',
            },
          },
          // Identity preview
          identityPreviewText: {
            color: '#ffffff',
          },
          identityPreviewEditButton: {
            color: '#00d4ff',
            '&:hover': {
              color: '#00ff88',
            },
          },
          // User button popover
          userButtonPopoverCard: {
            background: 'rgba(10, 10, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          },
          userButtonPopoverActionButton: {
            color: '#ffffff',
            '&:hover': {
              background: 'rgba(0, 212, 255, 0.1)',
            },
          },
          userButtonPopoverActionButtonText: {
            color: '#ffffff',
          },
          userButtonPopoverFooter: {
            background: 'rgba(0, 0, 0, 0.2)',
            borderTop: '1px solid rgba(0, 212, 255, 0.2)',
          },
          // Divider
          dividerLine: {
            background: 'rgba(0, 212, 255, 0.2)',
          },
          dividerText: {
            color: 'rgba(255, 255, 255, 0.5)',
          },
          // Alert/Error messages
          formFieldErrorText: {
            color: '#ff006e',
          },
          alertText: {
            color: '#ffffff',
          },
          // Badges
          badge: {
            background: 'rgba(0, 212, 255, 0.2)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: '#00d4ff',
          },
        },
      }}
    >
      <App />
    </ClerkProvider>
    </ErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
)

// Realtime gameplay favors fresh network state over offline caching.
// SW is opt-in via VITE_ENABLE_SW=true.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', async () => {
    const enableServiceWorker = import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW === 'true';

    if (!enableServiceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => /tetris-battle|workbox|vite/i.test(name))
            .map((name) => caches.delete(name))
        );
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

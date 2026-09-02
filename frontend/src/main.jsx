import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MealsApp from './meals/MealsApp.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// Two apps share this bundle and the sign-in: the journal at /, the meals
// list at /meals. One path check instead of a router, since that is the whole
// map. The server hands index.html to both paths.
const Root = window.location.pathname.startsWith('/meals') ? MealsApp : App

// Outside App, so a crash in the very first render — before any screen is
// chosen — is caught too.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Redirect hash preview deployments (which require Vercel SSO auth) to the clean production alias
if (typeof window !== 'undefined' && window.location.hostname.endsWith('nishchay-gaurs-projects.vercel.app')) {
  window.location.replace('https://logdoc-phi.vercel.app' + window.location.pathname + window.location.search);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


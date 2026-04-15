import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import QuickSearchPopup from './components/QuickSearchPopup'

const RootComponent = window.location.hash === '#quick-search' ? QuickSearchPopup : App

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
)

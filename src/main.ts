import './styles/main.css'
import './styles/retro.css'

import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { vTip } from './directives/tip'

const app = createApp(App)
// Dev-only profiler, switched on with VITE_PROFILE (see .env.development).
app.config.performance = import.meta.env.DEV && import.meta.env.VITE_PROFILE === 'true'
app.use(router).directive('tip', vTip).mount('#app')

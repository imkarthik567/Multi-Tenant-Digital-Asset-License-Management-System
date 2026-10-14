import webConfig from './apps/web/tailwind.config.js';

export default {
  ...webConfig,
  content: ['./apps/web/index.html', './apps/web/src/**/*.{js,ts,jsx,tsx}'],
};

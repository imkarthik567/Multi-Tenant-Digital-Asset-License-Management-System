import webConfig from './frontend/tailwind.config.js';

export default {
  ...webConfig,
  content: ['./frontend/index.html', './frontend/src/**/*.{js,ts,jsx,tsx}'],
};

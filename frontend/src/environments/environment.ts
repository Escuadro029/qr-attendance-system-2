// Single source of truth for the backend API base URL.
// Local dev talks to the Express server on :4000.
// In production this is replaced with the deployed Render backend URL
// (see README.md "Deploying to Render" section — Angular's fileReplacements
// swap this file for environment.prod.ts during a production build).
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:4000/api',
};

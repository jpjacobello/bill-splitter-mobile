// Dynamic Expo config layered on top of app.json.
//
// Sole job: pick the APNs `aps-environment` entitlement per EAS build profile so
// we never hand-edit app.json between dev and release again:
//   • production profile        → "production" (TestFlight / App Store → prod APNs)
//   • everything else (dev/preview/local prebuild) → "development" (sandbox APNs)
//
// The Cloud Function (functions/index.js) holds both APNs keys and tries prod
// then sandbox, so whichever token a build registers, background pushes work.
module.exports = ({ config }) => {
  const apsEnvironment =
    process.env.EAS_BUILD_PROFILE === 'production' ? 'production' : 'development';

  return {
    ...config,
    ios: {
      ...config.ios,
      entitlements: {
        ...(config.ios && config.ios.entitlements),
        'aps-environment': apsEnvironment,
      },
    },
  };
};

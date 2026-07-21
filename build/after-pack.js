// Ad-hoc code-sign the macOS app after electron-builder assembles it.
//
// We have no Apple Developer certificate, so the app can't be notarized. But an
// *unsigned* build is worse than useless on Apple Silicon: electron-builder
// modifies the packaged app (injects resources, rewrites Info.plist), which
// invalidates the ad-hoc signature Electron ships with. A downloaded arm64 app
// with a broken signature fails to launch with:
//
//     "Mymd" is damaged and can't be opened. You should move it to the Trash.
//
// Re-signing with the ad-hoc identity ("-") produces a *valid* self-signed
// signature. The app then launches once the user strips the download quarantine
// (`xattr -cr /Applications/Mymd.app`) — see the macOS note in README.
//
// hardenedRuntime is disabled in package.json so ad-hoc signing isn't rejected
// by library validation (an ad-hoc signature carries no Apple Team ID).
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename; // "Mymd"
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`[after-pack] ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
  // Fail loudly if the signature didn't take — better a red CI build than a
  // silently-broken dmg that repeats the "is damaged" bug.
  execFileSync('codesign', ['--verify', '--verbose=2', appPath], {
    stdio: 'inherit',
  });
};

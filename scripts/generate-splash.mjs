import sharp from "sharp";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const CREAM = { r: 247, g: 242, b: 232 };
const SIZE = 2732;
const LOGO_PATH = join(root, "public/decide-logo.png");
const SPLASH_DIR = join(root, "ios/App/App/Assets.xcassets/Splash.imageset");
const LOGO_ASSET_DIR = join(root, "ios/App/App/Assets.xcassets/DecideLogo.imageset");

async function buildSplash(filename) {
  const logo = sharp(LOGO_PATH).resize({ width: 420 });
  const logoBuffer = await logo.png().toBuffer();
  const { width = 420, height = 84 } = await sharp(logoBuffer).metadata();
  const left = Math.round((SIZE - width) / 2);
  const top = Math.round((SIZE - height) / 2);

  await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: CREAM },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toFile(join(SPLASH_DIR, filename));
}

mkdirSync(LOGO_ASSET_DIR, { recursive: true });
copyFileSync(LOGO_PATH, join(LOGO_ASSET_DIR, "decide-logo.png"));

await buildSplash("splash-2732x2732.png");
await buildSplash("splash-2732x2732-1.png");
await buildSplash("splash-2732x2732-2.png");

console.log("Splash + DecideLogo assets generated.");

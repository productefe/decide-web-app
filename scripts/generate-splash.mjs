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
  const logo = await sharp(LOGO_PATH).resize({ width: 420 }).png().toBuffer();
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: CREAM },
  })
    .composite([{ input: logo, left: 80, top: 120 }])
    .png()
    .toFile(join(SPLASH_DIR, filename));
}

mkdirSync(LOGO_ASSET_DIR, { recursive: true });
copyFileSync(LOGO_PATH, join(LOGO_ASSET_DIR, "decide-logo.png"));

await buildSplash("splash-2732x2732.png");
await buildSplash("splash-2732x2732-1.png");
await buildSplash("splash-2732x2732-2.png");

console.log("Splash + DecideLogo assets generated.");

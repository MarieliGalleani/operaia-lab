/** Tema generico de exemplo (assets do "sandbox"). */

import type { AssetManifest } from "../../../contracts/assets";

export const SAMPLE_THEME: AssetManifest = {
  id: "sandbox",
  spritesheets: [
    { id: "actors", imageUrl: "/assets/virtual-world/sandbox/actors.png" },
  ],
  tilesets: [
    { id: "floor", imageUrl: "/assets/virtual-world/sandbox/floor.png", tileWidth: 64, tileHeight: 32 },
  ],
};

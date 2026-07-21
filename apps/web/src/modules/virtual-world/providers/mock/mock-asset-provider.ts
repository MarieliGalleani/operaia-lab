/** AssetProvider generico mock: serve o tema de exemplo. */

import type { AssetManifest, AssetProvider } from "../../contracts/assets";
import { SAMPLE_THEME } from "./data/sample-theme";

export class MockAssetProvider implements AssetProvider {
  async getManifest(_themeId: string): Promise<AssetManifest> {
    return SAMPLE_THEME;
  }
}

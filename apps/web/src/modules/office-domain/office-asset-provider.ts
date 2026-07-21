/** AssetProvider do dominio: entrega o tema visual "corporate". */

import type { AssetManifest, AssetProvider } from "../virtual-world/contracts/assets";
import { CORPORATE_THEME } from "./data/corporate-theme";

export class OfficeAssetProvider implements AssetProvider {
  async getManifest(_themeId: string): Promise<AssetManifest> {
    return CORPORATE_THEME;
  }
}

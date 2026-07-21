/**
 * Tema visual "corporate" do escritorio (assets como DADO).
 *
 * Camada: DOMINIO. A engine so recebe este manifesto via AssetProvider; nao
 * conhece "escritorio".
 *
 * Cenario (piso de madeira, paredes creme/terracota, mobilia): ILUSTRACAO
 * isometrica desenhada pelo renderizador (sem tilesets -> modo vetorial).
 *
 * Personagens: sprites pixel-art (um por ator), mapeados por `spriteId`. Cada
 * `spritesheet.id` casa com o `renderable.spriteId` do ator; a engine desenha o
 * sprite e, se faltar, cai na capsula vetorial. `anchor` = pes no centro do tile.
 */

import type { AssetManifest } from "../../virtual-world/contracts/assets";

export const CORPORATE_THEME_ID = "corporate";

const AVATAR_ANCHOR = { anchorX: 0.5, anchorY: 0.98 };

export const CORPORATE_THEME: AssetManifest = {
  id: CORPORATE_THEME_ID,
  spritesheets: [
    { id: "char-opera", imageUrl: "/assets/office/avatars/av1.png", ...AVATAR_ANCHOR },
    { id: "char-mag", imageUrl: "/assets/office/avatars/av4.png", ...AVATAR_ANCHOR },
    { id: "char-atlas", imageUrl: "/assets/office/avatars/av6.png", ...AVATAR_ANCHOR },
    { id: "char-luna", imageUrl: "/assets/office/avatars/av3.png", ...AVATAR_ANCHOR },
    { id: "char-aurora", imageUrl: "/assets/office/avatars/av5.png", ...AVATAR_ANCHOR },
    { id: "local-actor", imageUrl: "/assets/office/avatars/av2.png", ...AVATAR_ANCHOR },
  ],
  tilesets: [],
};

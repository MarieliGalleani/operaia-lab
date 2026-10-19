<script setup lang="ts">
/**
 * Equipe do 4º andar — Store Flow.
 *
 * Elenco proprio do andar (Flow + Driele), definido no pacote
 * @operaia/store-flow. Nao vem do roster da Equipe Digital nem do
 * runtime de workers: por isso a lista e fixa e nao mostra status ao vivo.
 */
import { findFloor } from "@/data/office-floors";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";

const floor = findFloor("store-flow");

const CREW = [
  {
    id: "flow",
    emoji: "🎯",
    name: "Flow",
    role: "Robô de Ofertas",
    room: "Radar de Ofertas",
    does: "Filtra e pontua os produtos da rodada (nota, loja, vendas, comissão, em alta, desconto), explica cada escolha e cada recusa e gera o link de afiliado. Determinístico: não usa IA e não inventa número.",
  },
  {
    id: "driele",
    emoji: "✍️",
    name: "Driele",
    role: "Escritora",
    room: "Redação",
    does: "Escreve um texto por produto e por canal (Instagram, WhatsApp, Telegram, roteiro de TikTok), em duas versões para teste A/B, sempre com o aviso de afiliado. Tudo espera sua aprovação.",
  },
] as const;
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · elenco próprio`"
    title="Equipe"
    lede="Quem trabalha neste andar. O Store Flow tem equipe própria, separada da Equipe Digital."
    :show-cta="false"
    :show-refresh="false"
  />
  <div class="op-content">
    <div class="op-team-grid">
      <article v-for="m in CREW" :key="m.id" class="op-employee-card">
        <div class="op-employee-card__head">
          <span class="op-avatar-circle" aria-hidden="true">{{ m.emoji }}</span>
          <div class="op-employee-card__id">
            <p class="op-employee-card__name">{{ m.name }}</p>
            <p class="op-employee-card__role">{{ m.role }}</p>
            <p class="op-employee-card__specialty">Sala: {{ m.room }}</p>
          </div>
        </div>
        <p class="sft__does">{{ m.does }}</p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.sft__does {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.8;
}
</style>

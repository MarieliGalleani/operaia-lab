<script setup lang="ts">
/**
 * Aba Sinais (Interface 3.0) — agora real.
 *
 * Le GET /signals (so leitura): acontecimentos das fontes (GitHub,
 * webhooks) que o escritorio capturou, com a decisao do gate. Hoje so o
 * 1º andar tem fonte ligada (8 repositorios no GitHub); os outros andares
 * dizem isso em vez de mostrar uma lista vazia sem explicacao.
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { createHttpClient } from "@/data/adapters/http-client";

interface SignalItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly type: string;
  readonly summary: string;
  readonly status: string;
  readonly decision: string | null;
  readonly reason: string | null;
  readonly missionId: string | null;
  readonly receivedAt: string;
}

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const http = createHttpClient();

const signals = ref<readonly SignalItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const filter = ref<"all" | "converted" | "ignored" | "waiting">("all");

/** Fontes ligadas por andar. So o 1º andar tem GitHub hoje. */
const SOURCES: Record<string, readonly string[]> = {
  dev: ["github"],
  automation: [],
  marketing: [],
  "store-flow": [],
};

const NO_SOURCE_TEXT: Record<string, string> = {
  automation: "Os gatilhos e automações deste andar ainda não mandam sinais para cá. Quando um fluxo do N8N for ligado como fonte, os acontecimentos aparecem nesta lista.",
  marketing: "Nenhuma fonte de marketing (anúncios, redes) está ligada como sinal ainda. As campanhas continuam pela aba Trabalhos.",
  "store-flow": "O Store Flow trabalha por rodadas, não por sinais. Acompanhe pelo Painel e pela Sala de Aprovação.",
};

const floorSources = computed(() => SOURCES[floor.value.id] ?? []);

async function load(): Promise<void> {
  if (floorSources.value.length === 0) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const res = await http.get<{ signals: SignalItem[] }>("/signals?take=100");
    signals.value = (res.signals ?? []).filter((s) => floorSources.value.includes(s.sourceType.toLowerCase()));
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Não foi possível carregar os sinais.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function bucket(s: SignalItem): "converted" | "ignored" | "waiting" {
  if (s.missionId || s.status === "CONVERTED" || s.decision === "CONVERT_CANDIDATE") return "converted";
  if (s.status === "IGNORED" || s.status === "EXPIRED" || s.decision === "IGNORE") return "ignored";
  return "waiting";
}

const LABEL: Record<ReturnType<typeof bucket>, string> = {
  converted: "virou missão",
  ignored: "ignorado",
  waiting: "em observação",
};

const counts = computed(() => {
  const c = { converted: 0, ignored: 0, waiting: 0 };
  for (const s of signals.value) c[bucket(s)] += 1;
  return c;
});

const visible = computed(() =>
  filter.value === "all" ? signals.value : signals.value.filter((s) => bucket(s) === filter.value),
);

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · fontes do andar`"
    title="Sinais"
    lede="Acontecimentos das fontes deste andar, com a decisão que o escritório tomou sobre cada um."
    :show-cta="false"
    :show-refresh="floorSources.length > 0"
    :refreshing="loading"
    @refresh="load"
  />
  <div class="sg">
    <div v-if="floorSources.length === 0" class="sg__empty">
      <p class="sg__empty-title">Nenhuma fonte ligada a este andar</p>
      <p class="sg__empty-body">{{ NO_SOURCE_TEXT[floor.id] }}</p>
    </div>

    <template v-else>
      <p v-if="error" class="sg__error" role="alert">{{ error }}</p>

      <div class="sg__filters" role="group" aria-label="Filtrar sinais">
        <button type="button" :aria-pressed="filter === 'all'" @click="filter = 'all'">Todos <span>{{ signals.length }}</span></button>
        <button type="button" :aria-pressed="filter === 'converted'" @click="filter = 'converted'">Viraram missão <span>{{ counts.converted }}</span></button>
        <button type="button" :aria-pressed="filter === 'waiting'" @click="filter = 'waiting'">Em observação <span>{{ counts.waiting }}</span></button>
        <button type="button" :aria-pressed="filter === 'ignored'" @click="filter = 'ignored'">Ignorados <span>{{ counts.ignored }}</span></button>
      </div>

      <p v-if="loading && signals.length === 0" class="sg__muted">Carregando sinais…</p>
      <p v-else-if="visible.length === 0" class="sg__muted">
        Nenhum sinal {{ filter === "all" ? "recebido ainda" : "neste filtro" }}. O escritório lê os 8 repositórios a cada minuto e
        só cria um sinal quando algo relevante muda (PR aberto, issue nova, build quebrado).
      </p>

      <ul v-else class="sg__list">
        <li v-for="s in visible" :key="s.id" class="sg__row">
          <span class="sg__dot" :class="`is-${bucket(s)}`" aria-hidden="true" />
          <div class="sg__main">
            <p class="sg__summary">{{ s.summary }}</p>
            <p class="sg__meta">{{ s.workspaceId }} · {{ s.sourceType }} · {{ s.type }}<template v-if="s.reason"> · {{ s.reason }}</template></p>
          </div>
          <span class="sg__chip" :class="`is-${bucket(s)}`">{{ LABEL[bucket(s)] }}</span>
          <router-link v-if="s.missionId" :to="`/app/floor/dev/missions/${s.missionId}`" class="sg__link">Ver missão</router-link>
          <span class="sg__when">{{ when(s.receivedAt) }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.sg {
  flex: 1;
  overflow-y: auto;
  padding: 24px var(--op-gutter, 34px) 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sg__empty {
  max-width: 520px;
  padding: 24px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.sg__empty-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.sg__empty-body,
.sg__muted {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--op-muted-2);
  max-width: 640px;
}

.sg__error {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--op-red);
  border-radius: var(--op-radius-sm);
  color: var(--op-red);
  font-size: 13px;
}

.sg__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sg__filters button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--op-bd-chip);
  border-radius: var(--op-radius-full);
  background: transparent;
  color: var(--op-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.sg__filters button[aria-pressed="true"] {
  border-color: var(--op-bd-sel);
  background: var(--op-sel);
  color: var(--op-ink-2);
}

.sg__filters span {
  margin-left: 4px;
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-3);
}

.sg__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  overflow: hidden;
}

.sg__row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--op-line-soft);
}

.sg__row:last-child {
  border-bottom: 0;
}

.sg__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--op-amber);
}

.sg__dot.is-converted {
  background: var(--op-green);
}

.sg__dot.is-ignored {
  background: var(--op-muted-4);
}

.sg__main {
  min-width: 0;
}

.sg__summary {
  margin: 0;
  font-size: 14px;
  color: var(--op-ink-3);
  overflow-wrap: anywhere;
}

.sg__meta {
  margin: 2px 0 0;
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-3);
  overflow-wrap: anywhere;
}

.sg__chip {
  padding: 4px 9px;
  border: 1px solid var(--op-bd-chip);
  border-radius: var(--op-radius-full);
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-amber);
  white-space: nowrap;
}

.sg__chip.is-converted {
  color: var(--op-green);
}

.sg__chip.is-ignored {
  color: var(--op-muted-3);
}

.sg__link {
  font-size: 13px;
  color: var(--op-blue);
  text-decoration: none;
  white-space: nowrap;
}

.sg__when {
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-3);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .sg {
    padding: 16px;
  }
  .sg__row {
    grid-template-columns: 10px minmax(0, 1fr);
  }
  .sg__chip,
  .sg__link,
  .sg__when {
    grid-column: 2;
    justify-self: start;
  }
}
</style>

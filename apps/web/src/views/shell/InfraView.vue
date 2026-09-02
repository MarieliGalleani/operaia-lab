<script setup lang="ts">
/**
 * Aba Infraestrutura / Predio (P1.21) — compartilhada entre andares,
 * fiel ao handoff aprovado. Metricas vem de GET /infra/vps (mesmo
 * dado que VpsPanelView.vue ja usava, so reapresentado no visual
 * novo). "Ocupacao por andar" reusa originToFloor() sobre missoes
 * reais — mesma derivacao ja validada nas outras abas.
 */
import { computed, onMounted, ref } from "vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { OFFICE_FLOORS, findFloor } from "@/data/office-floors";
import { createHttpClient } from "@/data/adapters/http-client";
import { createOfficeStatusClient, type OfficeStatusDto } from "@/data/adapters/office-status-client";
import { originToFloor } from "@/lib/office-floor";
import type { MissionListItemDTO } from "@/data/dto";

interface VpsSnapshotLite {
  readonly healthScore: number;
  readonly host: { readonly cpuPct: number; readonly usedMemPct: number };
  readonly database: { readonly latencyMs: number | null };
  readonly checks: readonly {
    readonly id: string;
    readonly label: string;
    readonly status: string;
    readonly detail: string;
  }[];
}

const httpClient = createHttpClient();
const statusClient = createOfficeStatusClient();

const vps = ref<VpsSnapshotLite | null>(null);
const missions = ref<readonly MissionListItemDTO[]>([]);
const status = ref<OfficeStatusDto | null>(null);
const loading = ref(true);
const refreshing = ref(false);

async function loadAll(): Promise<void> {
  const [vpsResult, missionsResult, statusResult] = await Promise.allSettled([
    httpClient.get<VpsSnapshotLite>("/infra/vps"),
    httpClient.get<{ missions: MissionListItemDTO[] }>("/missions?format=flat&take=100"),
    statusClient.get(),
  ]);
  if (vpsResult.status === "fulfilled") vps.value = vpsResult.value;
  if (missionsResult.status === "fulfilled") missions.value = missionsResult.value.missions ?? [];
  if (statusResult.status === "fulfilled") status.value = statusResult.value;
}

onMounted(async () => {
  loading.value = true;
  try {
    await loadAll();
  } finally {
    loading.value = false;
  }
});

async function refresh(): Promise<void> {
  refreshing.value = true;
  const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
  await Promise.allSettled([loadAll(), minDelay]);
  refreshing.value = false;
}

const occupancy = computed(() =>
  OFFICE_FLOORS.map((floor) => {
    const count = floor.missionFloor
      ? missions.value.filter((m) => originToFloor(m.origin) === floor.missionFloor).length
      : 0;
    return { floor, count };
  }),
);
</script>

<template>
  <OperationalHeader
    :floor="findFloor('dev')"
    scope-line="Compartilhado · todos os andares"
    title="Prédio"
    lede="Infraestrutura e governança são compartilhadas por todos os andares — esta é a única visão que cruza empresas."
    :refreshing="refreshing"
    :show-cta="false"
    @refresh="refresh"
  />
  <div class="op-content">
    <p v-if="loading && !vps" class="op-loading">Carregando…</p>
    <template v-else-if="vps">
      <div class="op-metrics-grid">
        <div class="op-metric">
          <p class="op-eyebrow">CPU do host</p>
          <p class="op-mono op-metric__value">{{ vps.host.cpuPct.toFixed(1) }}%</p>
        </div>
        <div class="op-metric">
          <p class="op-eyebrow">RAM do host</p>
          <p class="op-mono op-metric__value">{{ vps.host.usedMemPct.toFixed(1) }}%</p>
        </div>
        <div class="op-metric">
          <p class="op-eyebrow">Latência Postgres</p>
          <p class="op-mono op-metric__value">{{ vps.database.latencyMs ?? "—" }}ms</p>
        </div>
        <div class="op-metric">
          <p class="op-eyebrow">Health score</p>
          <p class="op-mono op-metric__value">{{ vps.healthScore }}</p>
        </div>
      </div>

      <div class="op-two-col">
        <section>
          <h3 class="op-section-title">Serviços do prédio</h3>
          <div v-for="c in vps.checks" :key="c.id" class="op-service-row">
            <span class="op-dot" :class="c.status === 'up' ? 'is-on' : 'is-off'" />
            <span class="op-service-row__label">{{ c.label }}</span>
            <span class="op-mono op-service-row__detail">{{ c.detail }}</span>
          </div>
        </section>

        <section>
          <h3 class="op-section-title">Ocupação por andar</h3>
          <div v-for="o in occupancy" :key="o.floor.id" class="op-occupancy-row">
            <span class="op-floor-badge">{{ o.floor.code }}</span>
            <span class="op-occupancy-row__name">{{ o.floor.name }}</span>
            <span class="op-mono op-occupancy-row__count">{{ o.count }} trabalhos</span>
          </div>
        </section>
      </div>

      <section v-if="status" class="op-gov">
        <h3 class="op-section-title">Governança · janela 24h</h3>
        <div class="op-gov-grid">
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.execute }}</p>
            <span>Autorizado</span>
          </div>
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.reuse }}</p>
            <span>Reaproveitado</span>
          </div>
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.skip }}</p>
            <span>Evitado</span>
          </div>
          <div class="op-gov-item">
            <p class="op-mono">{{ status.governance.gate.reopen }}</p>
            <span>Reaberto</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-loading {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-mono {
  font-family: var(--op-font-mono);
}

.op-eyebrow {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.op-metric {
  padding: 16px;
  border: 1px solid var(--op-line);
  border-radius: 12px;
  background: var(--op-panel);
}

.op-metric__value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 26px;
}

.op-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--op-ink-2);
  margin-bottom: 12px;
}

.op-service-row,
.op-occupancy-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--op-line-soft);
  font-size: 12.5px;
}

.op-dot {
  width: 6px;
  height: 6px;
  border-radius: 99px;
  flex-shrink: 0;
}

.op-dot.is-on {
  background: var(--op-green);
}

.op-dot.is-off {
  background: var(--op-red);
}

.op-service-row__label {
  flex: 1;
  color: var(--op-ink-4);
}

.op-service-row__detail {
  color: var(--op-muted-4);
  font-size: 11px;
}

.op-floor-badge {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--op-raise);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--op-font-mono);
  font-size: 9px;
  font-weight: 700;
  color: var(--op-muted-2);
}

.op-occupancy-row__name {
  flex: 1;
  color: var(--op-ink-4);
}

.op-occupancy-row__count {
  color: var(--op-muted-4);
  font-size: 11px;
}

.op-gov-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.op-gov-item {
  text-align: center;
  padding: 14px 4px;
  border: 1px solid var(--op-line);
  border-radius: 10px;
  background: var(--op-panel);
}

.op-gov-item p {
  font-size: 19px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-gov-item span {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--op-muted-4);
  text-transform: uppercase;
}

@media (max-width: 900px) {
  .op-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .op-two-col {
    grid-template-columns: 1fr;
  }
}
</style>

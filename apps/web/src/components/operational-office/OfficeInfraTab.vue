<script setup lang="ts">
/**
 * Aba Infraestrutura (P1.19) — compartilhada entre andares, como no
 * design. Metricas vem de GET /infra/vps (ja existente, ja compartilhado
 * — mesmo dado que VpsPanelView.vue usava). "Ocupacao por andar" reusa a
 * mesma derivacao real de originToFloor() da aba Trabalhos — dado
 * derivado real, nao inventado.
 */
import { computed } from "vue";
import type { MissionListItemDTO } from "@/data/dto";
import { originToFloor } from "@/lib/office-floor";
import type { OfficeFloorDef } from "@/data/office-floors";

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

const props = defineProps<{
  vps: VpsSnapshotLite | null;
  loading: boolean;
  floors: readonly OfficeFloorDef[];
  missions: readonly MissionListItemDTO[];
  governance: { execute: number; skip: number; reuse: number; reopen: number } | null;
}>();

const occupancy = computed(() =>
  props.floors.map((floor) => {
    const count = props.missions.filter(
      (m) => originToFloor(m.origin) === floor.missionFloor,
    ).length;
    return { floor, count };
  }),
);
</script>

<template>
  <div class="oo-infra">
    <p v-if="loading && !vps" class="oo-loading">Carregando infraestrutura…</p>
    <template v-else-if="vps">
      <div class="oo-infra__metrics">
        <div class="oo-card oo-metric">
          <p class="oo-eyebrow">CPU host</p>
          <p class="oo-mono oo-metric__value">{{ vps.host.cpuPct.toFixed(1) }}%</p>
        </div>
        <div class="oo-card oo-metric">
          <p class="oo-eyebrow">RAM host</p>
          <p class="oo-mono oo-metric__value">{{ vps.host.usedMemPct.toFixed(1) }}%</p>
        </div>
        <div class="oo-card oo-metric">
          <p class="oo-eyebrow">Latência Postgres</p>
          <p class="oo-mono oo-metric__value">{{ vps.database.latencyMs ?? "—" }}ms</p>
        </div>
        <div class="oo-card oo-metric">
          <p class="oo-eyebrow">Health score</p>
          <p class="oo-mono oo-metric__value">{{ vps.healthScore }}</p>
        </div>
      </div>

      <div class="oo-two-col">
        <section class="oo-card">
          <p class="oo-eyebrow">Serviços do prédio</p>
          <ul class="oo-service-list">
            <li v-for="c in vps.checks" :key="c.id" class="oo-service">
              <span class="oo-dot" :class="c.status === 'up' ? 'oo-dot--ok' : 'oo-dot--off'" />
              <span class="oo-service__label">{{ c.label }}</span>
              <span class="oo-service__detail oo-mono">{{ c.detail }}</span>
            </li>
          </ul>
        </section>

        <section class="oo-card">
          <p class="oo-eyebrow">Ocupação por andar</p>
          <ul class="oo-occupancy-list">
            <li v-for="o in occupancy" :key="o.floor.id" class="oo-occupancy">
              <span class="oo-floor-badge">{{ o.floor.code }}</span>
              <span>{{ o.floor.name }}</span>
              <span class="oo-mono oo-occupancy__count">{{ o.count }} missões</span>
            </li>
          </ul>
        </section>
      </div>

      <section v-if="governance" class="oo-card oo-gov">
        <p class="oo-eyebrow">Governança · janela 24h</p>
        <div class="oo-gov-grid">
          <div class="oo-gov-item">
            <p class="oo-mono">{{ governance.execute }}</p>
            <span>Autorizado</span>
          </div>
          <div class="oo-gov-item">
            <p class="oo-mono">{{ governance.reuse }}</p>
            <span>Reaproveitado</span>
          </div>
          <div class="oo-gov-item">
            <p class="oo-mono">{{ governance.skip }}</p>
            <span>Evitado</span>
          </div>
          <div class="oo-gov-item">
            <p class="oo-mono">{{ governance.reopen }}</p>
            <span>Reaberto</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.oo-loading {
  color: var(--text-soft);
  font-size: 13px;
}

.oo-infra__metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.oo-metric {
  padding: 14px;
}

.oo-metric__value {
  font-size: 22px;
  font-weight: 600;
  margin-top: 6px;
}

.oo-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.oo-two-col .oo-card {
  padding: 16px;
}

.oo-service-list,
.oo-occupancy-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oo-service,
.oo-occupancy {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}

.oo-service__label {
  flex: 1;
}

.oo-service__detail {
  color: var(--text-soft);
  font-size: 11px;
}

.oo-floor-badge {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.oo-occupancy__count {
  margin-left: auto;
  color: var(--text-soft);
}

.oo-gov {
  padding: 16px;
}

.oo-gov-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.oo-gov-item {
  text-align: center;
  padding: 10px 4px;
  border-radius: 8px;
  background: var(--surface-hover);
}

.oo-gov-item p {
  font-size: 18px;
  font-weight: 600;
}

.oo-gov-item span {
  font-size: 10px;
  color: var(--text-soft);
  text-transform: uppercase;
}

@media (max-width: 900px) {
  .oo-infra__metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .oo-two-col {
    grid-template-columns: 1fr;
  }
}
</style>

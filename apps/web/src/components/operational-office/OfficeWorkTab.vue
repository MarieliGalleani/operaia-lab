<script setup lang="ts">
/**
 * Aba Trabalhos (P1.19). Filtra missoes reais por andar via
 * originToFloor(mission.origin) — mecanismo ja existente desde P1.2,
 * nunca antes consumido pelo frontend. Missoes-filha (origin=null)
 * caem em UNKNOWN e ficam fora dos dois floors reais — limitacao
 * conhecida, preferivel a inferir um floor que nao da pra confirmar.
 */
import { computed } from "vue";
import type { MissionListItemDTO } from "@/data/dto";
import { originToFloor, type MissionFloorResult } from "@/lib/office-floor";

const props = defineProps<{
  missions: readonly MissionListItemDTO[];
  loading: boolean;
  floorValue: MissionFloorResult;
}>();

const filtered = computed(() =>
  props.missions.filter((m) => originToFloor(m.origin) === props.floorValue),
);

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Criada",
  QUEUED: "Na fila",
  RUNNING: "Em execução",
  WAITING: "Aguardando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

const KIND_LABEL: Record<string, string> = {
  COORDINATE: "coordinate",
  EXECUTE: "execute",
  CONSOLIDATE: "consolidate",
};
</script>

<template>
  <div class="oo-work">
    <p v-if="loading && missions.length === 0" class="oo-loading">Carregando trabalhos…</p>
    <p v-else-if="filtered.length === 0" class="oo-empty">
      Nenhum trabalho classificado para este andar nas últimas missões carregadas.
    </p>
    <div v-else class="oo-work__grid">
      <router-link
        v-for="m in filtered"
        :key="m.id"
        :to="`/app/floor/dev/missions/${m.id}`"
        class="oo-card oo-work-card oo-rise"
        :class="`is-${m.status.toLowerCase()}`"
      >
        <span class="oo-work-card__bar" />
        <div class="oo-work-card__head">
          <span class="oo-tag">{{ KIND_LABEL[m.missionKind] ?? m.missionKind }}</span>
          <span class="oo-status-badge">{{ STATUS_LABEL[m.status] ?? m.status }}</span>
        </div>
        <p class="oo-work-card__objective">{{ m.objective }}</p>
        <p class="oo-work-card__owner oo-mono">{{ m.ownerEmployeeId }}</p>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.oo-loading,
.oo-empty {
  color: var(--oo-muted-3);
  font-size: 13px;
}

.oo-work__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.oo-work-card {
  position: relative;
  display: block;
  padding: 16px 16px 16px 20px;
  text-decoration: none;
  color: var(--oo-ink);
  overflow: hidden;
}

.oo-work-card__bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--oo-muted-4);
}

.oo-work-card.is-running .oo-work-card__bar {
  background: var(--oo-blue);
}
.oo-work-card.is-completed .oo-work-card__bar {
  background: var(--oo-green);
}
.oo-work-card.is-failed .oo-work-card__bar {
  background: var(--oo-red);
}
.oo-work-card.is-queued .oo-work-card__bar {
  background: var(--oo-amber);
}

.oo-work-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.oo-tag {
  font-size: 10px;
  font-family: var(--oo-mono);
  color: var(--oo-muted-3);
  text-transform: uppercase;
}

.oo-status-badge {
  font-size: 10.5px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--oo-raise);
  color: var(--oo-muted-2);
}

.oo-work-card__objective {
  font-size: 13.5px;
  font-weight: 500;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.oo-work-card__owner {
  font-size: 11px;
  color: var(--oo-muted-3);
}
</style>

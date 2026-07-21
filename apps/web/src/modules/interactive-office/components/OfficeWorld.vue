<script setup lang="ts">
import { ref } from "vue";
import ActivityLayer from "./ActivityLayer.vue";
import OfficeMap from "./OfficeMap.vue";

/**
 * Contêiner do "mundo" do escritório. Hoje há um andar; a estrutura já prevê
 * múltiplos andares/sedes (basta acrescentar entradas e trocar o mapa ativo),
 * sem tocar em dados, engine ou renderização.
 */
interface Floor {
  id: string;
  label: string;
  available: boolean;
}

const floors = ref<Floor[]>([
  { id: "hq-1", label: "Andar 1 · Sede", available: true },
  { id: "hq-2", label: "Andar 2 · Expansão", available: false },
]);
const activeFloor = ref("hq-1");
</script>

<template>
  <div class="world">
    <OfficeMap />

    <nav class="world__floors" aria-label="Andares">
      <button
        v-for="floor in floors"
        :key="floor.id"
        type="button"
        class="world__floor"
        :class="{ 'world__floor--active': floor.id === activeFloor }"
        :disabled="!floor.available"
        @click="floor.available && (activeFloor = floor.id)"
      >
        {{ floor.label }}
      </button>
    </nav>

    <div class="world__ticker">
      <ActivityLayer />
    </div>
  </div>
</template>

<style scoped>
.world {
  position: relative;
  width: 100%;
  height: 100%;
}

.world__floors {
  position: absolute;
  left: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
}

.world__floor {
  margin-top: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
}

.world__floor--active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
}

.world__floor:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.world__ticker {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  pointer-events: none;
}

@media (max-width: 980px) {
  .world__floors {
    display: none;
  }
}
</style>

<script setup lang="ts">
/**
 * Casca principal do Escritorio Operacional (P1.21) — substitui
 * OfficeLayout+SidebarNav nas rotas de floor e sistema. Ver
 * OperationalRail.vue para a justificativa de por que a navegacao usa
 * rotas reais em vez do estado de aba do handoff original.
 */
import { computed, onMounted } from "vue";
import { useOffice } from "@/composables/useOffice";
import OperationalRail from "@/components/shell/OperationalRail.vue";

const office = useOffice();

onMounted(() => {
  void office.load().catch((error) => {
    console.log("[operational-shell] falha ao carregar escritorio", error);
  });
});

const teamCount = computed(() =>
  office.loaded.value ? String(office.employees.value.length) : null,
);
</script>

<template>
  <div class="op-shell">
    <OperationalRail :work-count="null" :team-count="teamCount" :today-count="null" />
    <main class="op-shell__main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.op-shell {
  display: flex;
  height: 100vh;
  background: var(--op-bg);
  color: var(--op-ink-3);
}

.op-shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>

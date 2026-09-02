<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import SidebarNav from "@/components/SidebarNav.vue";
import { useOffice } from "@/composables/useOffice";

const { load } = useOffice();
const route = useRoute();

/** Sala da CEO: viewport travado — scroll só na conversa. */
const lockViewport = computed(() => route.path.includes("/sala-ceo"));

onMounted(() => {
  void load().catch((error) => {
    console.log("[office-layout] falha ao carregar escritorio", error);
  });
});
</script>

<template>
  <div class="office">
    <SidebarNav />
    <main
      class="office__content"
      :class="{ 'office__content--locked': lockViewport }"
    >
      <div class="office__glow" aria-hidden="true" />
      <div class="office__page">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.office {
  display: flex;
  align-items: stretch;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

.office__content {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background:
    radial-gradient(ellipse at 100% 0%, rgba(59, 130, 246, 0.08), transparent 42%),
    radial-gradient(ellipse at 0% 100%, rgba(56, 189, 248, 0.05), transparent 40%),
    var(--bg);
}

.office__content--locked {
  overflow: hidden;
}

.office__glow {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--office-glow);
}

.office__page {
  position: relative;
  z-index: 1;
  min-height: 100%;
}

.office__content--locked .office__page {
  height: 100%;
  overflow: hidden;
}
</style>

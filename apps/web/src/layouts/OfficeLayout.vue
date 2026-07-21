<script setup lang="ts">
import { onMounted } from "vue";
import SidebarNav from "@/components/SidebarNav.vue";
import { useOffice } from "@/composables/useOffice";

const { load } = useOffice();

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="office">
    <SidebarNav />
    <main class="office__content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.office {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
}

.office__content {
  flex: 1;
  min-width: 0;
}
</style>

<script setup lang="ts">
import { onMounted } from "vue";
import { useOffice } from "@/composables/useOffice";
import OfficeShell from "./components/OfficeShell.vue";
import { useInteractiveOffice } from "./composables/useInteractiveOffice";

const office = useInteractiveOffice();
const canonical = useOffice();

onMounted(() => {
  void office.load();
  void canonical.load();
});
</script>

<template>
  <div class="interactive-office">
    <OfficeShell />
  </div>
</template>

<style scoped>
.interactive-office {
  height: calc(100vh - 0px);
  min-height: 620px;
}
</style>

<script setup lang="ts">
import { computed } from "vue";
import type { WorkProgressItem } from "@/data/office-command";
import { useOffice } from "@/composables/useOffice";
import { presentationFor } from "@/data/presentation";

const props = defineProps<{ item: WorkProgressItem }>();
const { employeeById } = useOffice();

const owner = computed(() => employeeById(props.item.ownerEmployeeId));
const ownerName = computed(
  () =>
    owner.value?.name ??
    (props.item.ownerEmployeeId === "operaia-ceo"
      ? "Opera"
      : props.item.ownerEmployeeId),
);
const ownerEmoji = computed(
  () => owner.value?.emoji ?? presentationFor("MANAGEMENT").emoji,
);
</script>

<template>
  <router-link :to="item.href" class="work panel card--lift">
    <p class="eyebrow">{{ item.workspaceName }}</p>
    <h3 class="work__title">{{ item.objective }}</h3>
    <p class="work__owner">
      <span aria-hidden="true">{{ ownerEmoji }}</span> {{ ownerName }}
    </p>
    <p class="work__step">{{ item.stepLabel }}</p>
    <div v-if="item.etaLabel" class="work__foot">
      <span class="work__eta">{{ item.etaLabel }}</span>
    </div>
  </router-link>
</template>

<style scoped>
.work {
  display: block;
  padding: 16px 18px;
  color: inherit;
  height: 100%;
}
.work__title {
  margin-top: 6px;
  font-size: var(--text-md);
}
.work__owner {
  margin-top: 10px;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}
.work__step {
  margin-top: 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.work__foot {
  display: flex;
  align-items: center;
  margin-top: 12px;
}
.work__eta {
  font-size: var(--text-xs);
  color: var(--text-soft);
}
</style>

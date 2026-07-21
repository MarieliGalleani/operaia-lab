<script setup lang="ts">
import { computed } from "vue";
import { STATE_VISUALS } from "../config/office-config";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";

const props = defineProps<{ employeeId: string }>();

const { getEmployee } = useInteractiveOffice();

const employee = computed(() => getEmployee(props.employeeId));
const status = computed(() =>
  employee.value ? STATE_VISUALS[employee.value.state] : null,
);
</script>

<template>
  <header v-if="employee" class="profile">
    <span class="profile__avatar">{{ employee.emoji }}</span>
    <div class="profile__id">
      <span class="profile__role">{{ employee.role }} — {{ employee.name }}</span>
      <span class="profile__spec">{{ employee.specialtyLabel }}</span>
    </div>
    <span
      v-if="status"
      class="profile__status"
      :style="{ color: status.color, borderColor: status.color }"
    >
      {{ status.icon }} {{ status.label }}
    </span>
  </header>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.profile__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #eef2ff;
  font-size: 22px;
  margin-right: 11px;
}

.profile__id {
  display: flex;
  flex-direction: column;
  margin-right: auto;
}

.profile__role {
  font-size: 15px;
  font-weight: 800;
  color: #1e293b;
}

.profile__spec {
  font-size: 11px;
  color: #64748b;
}

.profile__status {
  padding: 3px 9px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
</style>

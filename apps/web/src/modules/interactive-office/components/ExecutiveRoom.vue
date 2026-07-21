<script setup lang="ts">
import { computed } from "vue";
import { STATE_VISUALS } from "../config/office-config";
import { useInteractiveOffice } from "../composables/useInteractiveOffice";
import ConversationPanel from "./ConversationPanel.vue";

const { ceo } = useInteractiveOffice();

const status = computed(() =>
  ceo.value ? STATE_VISUALS[ceo.value.state] : null,
);
</script>

<template>
  <div class="exec">
    <header v-if="ceo" class="exec__head">
      <span class="exec__avatar">{{ ceo.emoji }}</span>
      <div class="exec__id">
        <span class="exec__role">{{ ceo.role }} — {{ ceo.name }}</span>
        <span class="exec__sub">{{ ceo.specialtyLabel }}</span>
      </div>
      <span
        v-if="status"
        class="exec__status"
        :style="{ color: status.color, borderColor: status.color }"
      >
        {{ status.icon }} {{ status.label }}
      </span>
    </header>

    <p class="exec__lead">Sala Executiva</p>
    <ConversationPanel />
  </div>
</template>

<style scoped>
.exec {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.exec__head {
  display: flex;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}

.exec__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ede9fe;
  font-size: 20px;
  margin-right: 10px;
}

.exec__id {
  display: flex;
  flex-direction: column;
  margin-right: auto;
}

.exec__role {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.exec__sub {
  font-size: 11px;
  color: #64748b;
}

.exec__status {
  padding: 3px 9px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.exec__lead {
  margin: 10px 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}
</style>

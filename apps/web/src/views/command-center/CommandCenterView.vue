<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import CommandActionGrid from "@/components/command/CommandActionGrid.vue";
import CommandAutomationSection from "@/components/command/CommandAutomationSection.vue";
import CommandTeamSection from "@/components/command/CommandTeamSection.vue";
import CommandWorkSection from "@/components/command/CommandWorkSection.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { useCommandCenter } from "@/composables/useCommandCenter";
import { useOffice } from "@/composables/useOffice";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { AutomationListItem, OfficeLevel } from "@/data/office-command";

const { data, state, errorMessage, load } = useCommandCenter();
const { employees, load: loadOffice } = useOffice();
const automations = ref<readonly AutomationListItem[]>([]);
const automationsState = ref<"idle" | "loading" | "ready" | "error">("idle");

onMounted(async () => {
  try {
    await loadOffice();
  } catch (error) {
    console.log("[command-center] equipe indisponível", error);
  }

  automationsState.value = "loading";
  try {
    automations.value = await officeCommandClient.listAutomations();
    automationsState.value = "ready";
  } catch (error) {
    console.log("[command-center] automações reais indisponíveis", error);
    automationsState.value = "error";
  }
});

const activeEmployees = computed(() =>
  employees.value.filter((employee) => employee.active).slice(0, 6),
);

const levelMeta: Record<
  OfficeLevel,
  { chip: string; label: string }
> = {
  OPERATING: { chip: "chip--ok", label: "OPERANDO" },
  ATTENTION: { chip: "chip--warn", label: "ATENÇÃO" },
  PROBLEM: { chip: "chip--bad", label: "PROBLEMA" },
};

const meta = computed(() =>
  levelMeta[data.value?.status.level ?? "OPERATING"],
);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
});

const heroLine = computed(() => {
  const d = data.value;
  if (!d) return "";
  if (d.attention.length > 0) {
    return d.attention.length === 1
      ? "Há 1 item que precisa de você."
      : `Há ${d.attention.length} itens que precisam de você.`;
  }
  if (d.idle) return "Tudo em dia.";
  return d.status.summary;
});

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="cc studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">OperaIA.lab</p>
        <h1 class="page__title">Seu escritório digital</h1>
      </div>
      <div class="topbar__right">
        <router-link to="/app/command/new" class="btn btn--primary">
          Nova demanda
        </router-link>
        <button
          type="button"
          class="btn btn--ghost"
          :disabled="state === 'loading' && !data"
          @click="load"
        >
          Atualizar
        </button>
      </div>
    </header>

    <LoadingState v-if="state === 'loading' && !data" label="Carregando Command Center" />

    <div v-else-if="state === 'error' && !data" class="studio__stage" role="alert">
      <section class="panel">
        <p class="empty-state__title">Estado indisponível</p>
        <p>{{ errorMessage }}</p>
        <button type="button" class="btn btn--primary" @click="load">
          Tentar de novo
        </button>
      </section>
    </div>

    <div v-else-if="data" class="studio__stage">
      <p
        v-if="data.source === 'mock-temporary'"
        class="backend-note"
        role="status"
      >
        Fonte: mock explícito (VITE_OFFICE_COMMAND_MOCK=true) — dados de demonstração,
        sem operações reais.
      </p>

      <section
        class="cc__hero panel"
        :class="`cc__hero--${data.status.level.toLowerCase()}`"
        aria-labelledby="cc-hero"
      >
        <p class="cc__greet">{{ greeting }}, Marieli.</p>
        <h2 id="cc-hero" class="cc__level">
          Este é o estado do seu escritório digital.
        </h2>
        <p class="cc__status">
          <span class="chip" :class="meta.chip" aria-hidden="true">●</span>
          Escritório {{ meta.label.toLowerCase() }}
        </p>
        <p class="cc__line">{{ heroLine }}</p>
        <p class="cc__meta">Atualizado {{ formatWhen(data.generatedAt) }}</p>
        <div class="sr-only" aria-live="polite" aria-atomic="true">
          Estado: {{ meta.label }}. {{ heroLine }}.
          {{ data.pendingApprovals }} aprovações pendentes.
        </div>
      </section>

      <CommandActionGrid />

      <CommandAutomationSection
        :automations="automations"
        :state="automationsState"
      />

      <CommandWorkSection :data="data" />
      <CommandTeamSection :employees="activeEmployees" />
    </div>
  </div>
</template>

<style scoped>
.cc__hero {
  padding: 22px 24px;
  margin-bottom: var(--space-3);
  background: var(--surface);
}
.cc__hero--operating {
  border-color: rgba(52, 211, 153, 0.25);
}
.cc__hero--attention {
  border-color: rgba(251, 191, 36, 0.3);
}
.cc__hero--problem {
  border-color: rgba(248, 113, 113, 0.35);
}
.cc__greet {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.cc__level {
  margin-top: 8px;
  font-size: var(--text-2xl);
}
.cc__status {
  display: flex;
  align-items: center;
  margin-top: 14px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.cc__status .chip {
  margin-right: 8px;
}
.cc__line {
  margin-top: 10px;
  font-size: var(--text-lg);
  color: var(--text);
}
.cc__meta {
  margin-top: 10px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.topbar__right .btn {
  margin-left: 8px;
}
@media (max-width: 768px) {
  .topbar__right {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .topbar__right .btn {
    margin-left: 0;
    margin-top: 8px;
    width: 100%;
  }
}
</style>

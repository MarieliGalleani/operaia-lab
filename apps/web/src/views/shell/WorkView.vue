<script setup lang="ts">
/**
 * Aba Trabalhos (P1.21) — visual fiel ao handoff aprovado, dado real
 * por andar:
 * - Dev: Projects/Workspaces reais (useOffice(), mesma fonte de
 *   ProjectsView.vue) — e o que "Trabalhos" mostra no protótipo pra
 *   este andar (Produto/Interno, mesmos nomes reais: Estocai, NEXO...).
 * - Automação: Automations reais (officeCommandClient.listAutomations()),
 *   mesma fonte de AutomationsView.vue.
 * - Marketing: nao existe dado real — ver MarketingWorkView.vue.
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor, floorIdFromPath } from "@/data/office-floors";
import { useOffice } from "@/composables/useOffice";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { AutomationListItem } from "@/data/office-command";

interface WorkCard {
  readonly id: string;
  readonly href: string;
  readonly name: string;
  readonly status: string;
  readonly tone: "green" | "blue" | "amber" | "red" | "muted";
  readonly objective: string;
  readonly meta: string;
}

const route = useRoute();
const floor = computed(() => findFloor(floorIdFromPath(route.path)));
const office = useOffice();

const automations = ref<readonly AutomationListItem[]>([]);
const loading = ref(true);

onMounted(async () => {
  loading.value = true;
  try {
    if (floor.value.id === "automation") {
      automations.value = await officeCommandClient.listAutomations();
    } else if (!office.loaded.value) {
      await office.load();
    }
  } catch (error) {
    console.log("[work-view] falha ao carregar", error);
  } finally {
    loading.value = false;
  }
});

const PROJECT_STATUS_LABEL: Record<string, { label: string; tone: WorkCard["tone"] }> = {
  ACTIVE: { label: "ativo", tone: "green" },
  PLANNED: { label: "planejado", tone: "blue" },
  PAUSED: { label: "pausado", tone: "amber" },
  COMPLETED: { label: "concluído", tone: "blue" },
};

const AUTOMATION_STATUS_LABEL: Record<string, { label: string; tone: WorkCard["tone"] }> = {
  DRAFT: { label: "rascunho", tone: "muted" },
  PLANNED: { label: "planejado", tone: "blue" },
  READY: { label: "pronto", tone: "blue" },
  RUNNING: { label: "em execução", tone: "green" },
  PAUSED: { label: "pausado", tone: "amber" },
  FAILED: { label: "falhou", tone: "red" },
  VALIDATING: { label: "validando", tone: "blue" },
  ACTIVE: { label: "ativo", tone: "green" },
  ARCHIVED: { label: "arquivado", tone: "muted" },
};

const cards = computed<readonly WorkCard[]>(() => {
  if (floor.value.id === "automation") {
    return automations.value.map((a) => {
      const s = AUTOMATION_STATUS_LABEL[a.status] ?? { label: a.status, tone: "muted" as const };
      return {
        id: a.id,
        href: `/app/floor/automation/automations/${a.id}`,
        name: a.name,
        status: s.label,
        tone: s.tone,
        objective: a.objective,
        meta: a.triggerLabel,
      };
    });
  }
  if (floor.value.id === "dev") {
    return office.projects.value.map((p) => {
      const s = PROJECT_STATUS_LABEL[p.status] ?? { label: p.status, tone: "muted" as const };
      return {
        id: p.id,
        href: `/app/floor/dev/workspaces/${p.id}`,
        name: p.name,
        status: p.progress >= 100 ? `${p.progress}%` : s.label,
        tone: p.progress >= 100 ? "blue" : s.tone,
        objective: p.objective,
        meta: `${p.teamIds.length} na equipe`,
      };
    });
  }
  return [];
});
</script>

<template>
  <OperationalHeader
    :floor="floor"
    :scope-line="`${floor.name} · dados isolados`"
    title="Trabalhos"
    lede="Cada repositório, projeto ou automação desta unidade é um trabalho, com seu estado real."
    :show-cta="false"
    @refresh="() => {}"
  />
  <div class="op-content">
    <p v-if="loading" class="op-loading">Carregando…</p>
    <div v-else-if="cards.length > 0" class="op-work-grid">
      <router-link v-for="c in cards" :key="c.id" :to="c.href" class="op-work-card">
        <div class="op-work-card__head">
          <p class="op-work-card__name">{{ c.name }}</p>
          <span class="op-work-card__status" :class="`is-${c.tone}`">{{ c.status }}</span>
        </div>
        <p class="op-work-card__objective">{{ c.objective }}</p>
        <p class="op-mono op-work-card__meta">{{ c.meta }}</p>
      </router-link>
    </div>
    <p v-else class="op-empty-inline">Nenhum trabalho registrado neste andar ainda.</p>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-loading,
.op-empty-inline {
  color: var(--op-muted-4);
  font-size: 13px;
}

.op-mono {
  font-family: var(--op-font-mono);
}

.op-work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.op-work-card {
  display: block;
  padding: 18px;
  border: 1px solid var(--op-line);
  border-radius: 12px;
  background: var(--op-panel);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.op-work-card:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-work-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.op-work-card__name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-work-card__status {
  font-family: var(--op-font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: uppercase;
  flex-shrink: 0;
  background: var(--op-raise);
  color: var(--op-muted-2);
}

.op-work-card__status.is-green { color: var(--op-green); background: rgba(74, 222, 128, 0.14); }
.op-work-card__status.is-blue { color: var(--op-blue); background: rgba(96, 165, 250, 0.14); }
.op-work-card__status.is-amber { color: var(--op-amber); background: rgba(251, 191, 36, 0.14); }
.op-work-card__status.is-red { color: var(--op-red); background: rgba(248, 113, 113, 0.12); }

.op-work-card__objective {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--op-muted-3);
  margin-bottom: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.op-work-card__meta {
  font-size: 11px;
  color: var(--op-muted-5);
}
</style>

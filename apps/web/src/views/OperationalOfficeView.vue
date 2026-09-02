<script setup lang="ts">
/**
 * Escritorio Operacional (P1.19/P1.20) — substitui VpsPanelView.vue na
 * rota /app/system/infra. Vive dentro do OfficeLayout normal (P1.20):
 * a v1 (P1.19) tinha rail/tema proprios porque o pedido original era
 * so essa pagina; quando o pedido virou "a casca do app inteiro", o
 * rail global (SidebarNav.vue) passou a cobrir isso e o rail local foi
 * removido — so sobrou a faixa de abas, que e especifica desta pagina.
 *
 * Ver auditoria em memoria de conversa (P1.19) para o que foi cortado
 * de escopo (3o andar "Marketing", Hoje/Equipe/Sinais por andar) e por
 * que — tudo documentado inline nos componentes das abas.
 *
 * VpsPanelView.vue nao foi apagado: so deixou de ser roteado.
 */
import { computed, onMounted, ref } from "vue";
import OfficeHeader from "@/components/operational-office/OfficeHeader.vue";
import OfficeTodayTab from "@/components/operational-office/OfficeTodayTab.vue";
import OfficeWorkTab from "@/components/operational-office/OfficeWorkTab.vue";
import OfficeTeamTab from "@/components/operational-office/OfficeTeamTab.vue";
import OfficeSignalsTab from "@/components/operational-office/OfficeSignalsTab.vue";
import OfficeInfraTab from "@/components/operational-office/OfficeInfraTab.vue";
import { useOffice } from "@/composables/useOffice";
import { OFFICE_FLOORS, findFloor } from "@/data/office-floors";
import { createOfficeStatusClient, type OfficeStatusDto } from "@/data/adapters/office-status-client";
import { createHttpClient } from "@/data/adapters/http-client";
import type { MissionListItemDTO } from "@/data/dto";

interface VpsSnapshotLite {
  readonly healthScore: number;
  readonly host: { readonly cpuPct: number; readonly usedMemPct: number };
  readonly database: { readonly latencyMs: number | null };
  readonly checks: readonly {
    readonly id: string;
    readonly label: string;
    readonly status: string;
    readonly detail: string;
  }[];
}

const office = useOffice();

const floorId = ref<string>("dev");
const tab = ref<"today" | "work" | "team" | "signals" | "infra">("today");
const activeFloor = computed(() => findFloor(floorId.value));

const statusClient = createOfficeStatusClient();
const httpClient = createHttpClient();

const status = ref<OfficeStatusDto | null>(null);
const statusLoading = ref(true);
const missions = ref<readonly MissionListItemDTO[]>([]);
const missionsLoading = ref(true);
const vps = ref<VpsSnapshotLite | null>(null);
const vpsLoading = ref(true);
const refreshing = ref(false);

async function loadStatus(): Promise<void> {
  statusLoading.value = true;
  try {
    status.value = await statusClient.get();
  } catch (error) {
    console.log("[operational-office] falha ao carregar status", error);
  } finally {
    statusLoading.value = false;
  }
}

async function loadMissions(): Promise<void> {
  missionsLoading.value = true;
  try {
    const payload = await httpClient.get<{ missions: MissionListItemDTO[] }>(
      "/missions?format=flat&take=100",
    );
    missions.value = payload.missions ?? [];
  } catch (error) {
    console.log("[operational-office] falha ao carregar missões", error);
  } finally {
    missionsLoading.value = false;
  }
}

async function loadVps(): Promise<void> {
  vpsLoading.value = true;
  try {
    vps.value = await httpClient.get<VpsSnapshotLite>("/infra/vps");
  } catch (error) {
    console.log("[operational-office] falha ao carregar infra", error);
  } finally {
    vpsLoading.value = false;
  }
}

async function loadEmployees(): Promise<void> {
  if (!office.loaded.value) {
    await office.load();
  }
}

onMounted(async () => {
  await Promise.allSettled([loadStatus(), loadMissions(), loadVps(), loadEmployees()]);
});

async function refresh(): Promise<void> {
  refreshing.value = true;
  const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
  await Promise.allSettled([
    loadStatus(),
    loadMissions(),
    loadVps(),
    office.load(true),
    minDelay,
  ]);
  refreshing.value = false;
}

function onFloorChange(id: string): void {
  floorId.value = id;
}

const TABS = [
  { id: "today", label: "Hoje" },
  { id: "work", label: "Trabalhos" },
  { id: "team", label: "Equipe" },
  { id: "signals", label: "Sinais" },
  { id: "infra", label: "Infraestrutura" },
] as const;

const TAB_META: Record<
  string,
  { title: string; description: string; breadcrumb: (floorName: string) => string }
> = {
  today: {
    title: "Hoje",
    description: "Resumo em tempo real — ainda cobre o escritório inteiro, não segmentado por andar.",
    breadcrumb: () => "Escritório inteiro · ainda não isolado por andar",
  },
  work: {
    title: "Trabalhos",
    description: "Missões deste andar, classificadas pela origem real de cada uma.",
    breadcrumb: (name) => `${name} · dados isolados`,
  },
  team: {
    title: "Equipe",
    description: "Todos os especialistas do escritório — o domínio ainda não separa por andar.",
    breadcrumb: () => "Escritório inteiro · equipe completa",
  },
  signals: {
    title: "Sinais",
    description: "Ainda não disponível — não existe endpoint de leitura para sinais hoje.",
    breadcrumb: () => "Escritório inteiro · indisponível",
  },
  infra: {
    title: "Infraestrutura",
    description: "Saúde do host e do banco — compartilhada entre todos os andares.",
    breadcrumb: () => "Compartilhado · todos os andares",
  },
};

const headerMeta = computed(() => {
  const meta = TAB_META[tab.value]!;
  return {
    title: meta.title,
    description: meta.description,
    breadcrumb: meta.breadcrumb(activeFloor.value.name),
  };
});
</script>

<template>
  <div class="operational-office">
    <OfficeHeader
      :floors="OFFICE_FLOORS"
      :active-floor-id="floorId"
      :title="headerMeta.title"
      :description="headerMeta.description"
      :breadcrumb="headerMeta.breadcrumb"
      :refreshing="refreshing"
      @floor-change="onFloorChange"
      @refresh="refresh"
    />

    <nav class="oo-tabstrip">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        class="oo-tabstrip__item"
        :class="{ 'is-active': tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="oo-content">
      <OfficeTodayTab v-if="tab === 'today'" :status="status" :loading="statusLoading" />
      <OfficeWorkTab
        v-else-if="tab === 'work'"
        :missions="missions"
        :loading="missionsLoading"
        :floor-value="activeFloor.missionFloor"
      />
      <OfficeTeamTab
        v-else-if="tab === 'team'"
        :employees="office.employees.value"
        :loading="office.loading.value"
      />
      <OfficeSignalsTab v-else-if="tab === 'signals'" />
      <OfficeInfraTab
        v-else-if="tab === 'infra'"
        :vps="vps"
        :loading="vpsLoading"
        :floors="OFFICE_FLOORS"
        :missions="missions"
        :governance="status ? status.governance.gate : null"
      />
    </div>
  </div>
</template>

<style scoped>
.oo-tabstrip {
  display: flex;
  gap: 4px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.oo-tabstrip__item {
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}

.oo-tabstrip__item:hover {
  color: var(--text);
}

.oo-tabstrip__item.is-active {
  color: var(--text);
  border-bottom-color: var(--brand);
}

.oo-content {
  padding: 20px 24px 40px;
}
</style>

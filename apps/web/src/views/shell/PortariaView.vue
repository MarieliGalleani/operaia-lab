<script setup lang="ts">
/**
 * Portaria (Terreo) — Interface 3.0. O predio inteiro numa tela.
 *
 * Fontes (nenhum numero inventado):
 * - Sinais vitais: GET /office/status (escritorio inteiro).
 * - Entregues em 7 dias e missoes por andar: GET /missions?format=flat,
 *   separadas por andar com originToFloor() — so Desenvolvimento e
 *   Automacao tem missoes hoje; Marketing e Store Flow dizem isso.
 * - Precisa de voce: aprovacoes pendentes reais (GET /office/approvals).
 * - Quem esta trabalhando: status ao vivo do Command Center.
 */
import { computed, onMounted, ref } from "vue";
import { useAuth } from "@/composables/useAuth";
import { createOfficeStatusClient, type OfficeStatusDto } from "@/data/adapters/office-status-client";
import { createHttpClient } from "@/data/adapters/http-client";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ApprovalListItem } from "@/data/office-command";
import type { MissionListItemDTO } from "@/data/dto";
import { ELEVATOR_ORDER, PORTARIA, type OfficeFloorDef } from "@/data/office-floors";
import { originToFloor } from "@/lib/office-floor";
import { fetchLiveAgentStatus, type LiveAgentStatus } from "@/modules/office-domain/live-agent-status";
import { CAST, OFFICE_3D_FLOORS, floorCastIds, type Office3DFloorId } from "@/modules/office-3d/floors-3d";

const auth = useAuth();
const statusClient = createOfficeStatusClient();
const http = createHttpClient();

const status = ref<OfficeStatusDto | null>(null);
const missions = ref<readonly MissionListItemDTO[]>([]);
const approvals = ref<readonly ApprovalListItem[]>([]);
const live = ref<ReadonlyMap<string, LiveAgentStatus>>(new Map());
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loadError.value = null;
  const results = await Promise.allSettled([
    statusClient.get().then((v) => {
      status.value = v;
    }),
    http.get<{ missions: MissionListItemDTO[] }>("/missions?format=flat&take=200").then((v) => {
      missions.value = v.missions ?? [];
    }),
    officeCommandClient.listApprovals().then((v) => {
      approvals.value = v;
    }),
    fetchLiveAgentStatus().then((v) => {
      live.value = v;
    }),
  ]);
  if (results.every((r) => r.status === "rejected")) {
    loadError.value = "Não foi possível consultar o prédio agora. Tente atualizar.";
  }
}

onMounted(async () => {
  try {
    await load();
  } finally {
    loading.value = false;
  }
});

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
});

const adminName = computed(() => auth.user.value?.login ?? "");
const pending = computed(() => approvals.value.filter((a) => a.status === "PENDING"));
const queue = computed(() => status.value?.status.queue ?? null);
const workers = computed(() => status.value?.status.workers ?? null);

const delivered7d = computed(() => {
  const since = Date.now() - 7 * 24 * 3600 * 1000;
  return missions.value.filter(
    (m) => m.status === "COMPLETED" && new Date(m.finishedAt ?? m.createdAt).getTime() >= since,
  ).length;
});

const headline = computed(() => {
  if (loading.value) return "Consultando o prédio…";
  if (loadError.value) return loadError.value;
  const q = queue.value;
  const parts: string[] = [];
  parts.push(q && q.queued + q.running > 0 ? `${q.queued} na fila e ${q.running} em execução` : "Fila vazia");
  parts.push(pending.value.length ? `${pending.value.length} esperando você` : "ninguém esperando por você");
  if (workers.value) parts.push(`${workers.value.alive} de ${workers.value.expected} no posto`);
  return `${parts.join(", ")}.`;
});

const levelTone = computed(() => {
  const level = status.value?.status.level;
  if (level === "PROBLEM") return "is-problem";
  if (level === "ATTENTION") return "is-attention";
  return "is-ok";
});

const FLOOR_3D_ID: Record<OfficeFloorDef["id"], Office3DFloorId> = {
  dev: "dev",
  automation: "automation",
  marketing: "marketing",
  "store-flow": "store-flow",
};

interface Slab {
  readonly code: string;
  readonly name: string;
  readonly summary: string;
  readonly to: string;
  readonly officeTo: string;
  readonly people: { id: string; name: string; color: string; busy: boolean; live: boolean }[];
  readonly chip: string;
  readonly busy: boolean;
}

function peopleOf(id: Office3DFloorId): Slab["people"] {
  return floorCastIds(OFFICE_3D_FLOORS[id]).map((pid) => {
    const c = CAST[pid]!;
    return { id: pid, name: c.name, color: c.color, busy: Boolean(live.value.get(pid)?.busy), live: c.live };
  });
}

const slabs = computed<Slab[]>(() => {
  const floors: Slab[] = ELEVATOR_ORDER.map((f) => {
    const people = peopleOf(FLOOR_3D_ID[f.id]);
    const busy = people.filter((p) => p.busy).length;
    let summary: string;
    if (f.missionFloor) {
      const mine = missions.value.filter((m) => originToFloor(m.origin) === f.missionFloor);
      const open = mine.filter((m) => ["QUEUED", "RUNNING", "WAITING", "CREATED"].includes(m.status)).length;
      summary = open ? `${open} missões abertas.` : "Sem missões abertas agora.";
    } else if (f.id === "store-flow") {
      summary = "Ofertas e textos de afiliado. Rodadas pela Sala de Aprovação.";
    } else {
      summary = "Ainda sem missões ligadas a este andar.";
    }
    return {
      code: f.code,
      name: f.name,
      summary,
      to: f.todayRoute,
      officeTo: f.officeRoute,
      people,
      chip: busy ? `${busy} trabalhando` : "livre",
      busy: busy > 0,
    };
  });
  const tPeople = peopleOf("portaria");
  const tBusy = tPeople.filter((p) => p.busy).length;
  floors.push({
    code: PORTARIA.code,
    name: PORTARIA.name,
    summary: "Sala do CEO, Finanças e Jurídico.",
    to: PORTARIA.homeRoute,
    officeTo: PORTARIA.officeRoute,
    people: tPeople,
    chip: tBusy ? `${tBusy} trabalhando` : "livre",
    busy: tBusy > 0,
  });
  return floors;
});

const totalPeople = computed(() => Object.keys(CAST).length);
</script>

<template>
  <div class="pt">
    <header class="pt__head">
      <div class="pt__intro">
        <p class="pt__eyebrow">TÉRREO · PORTARIA</p>
        <h1 class="pt__title">{{ greeting }}{{ adminName ? `, ${adminName}` : "" }}.</h1>
        <p class="pt__lead" aria-live="polite">{{ headline }}</p>
      </div>
      <div class="pt__actions">
        <router-link :to="PORTARIA.officeRoute" class="pt__btn">Abrir escritório 3D</router-link>
        <router-link to="/app/floor/dev/command/new" class="pt__btn pt__btn--primary">+ Nova demanda</router-link>
      </div>
    </header>

    <section class="pt__vitals" aria-label="Sinais vitais do prédio">
      <div class="pt__vital">
        <span class="pt__vlabel">NA FILA</span>
        <span class="pt__vvalue">{{ queue ? queue.queued : "—" }}</span>
        <span class="pt__vnote">demandas esperando</span>
      </div>
      <div class="pt__vital">
        <span class="pt__vlabel">EM EXECUÇÃO</span>
        <span class="pt__vvalue">{{ queue ? queue.running : "—" }}</span>
        <span class="pt__vnote">missões rodando agora</span>
      </div>
      <div class="pt__vital">
        <span class="pt__vlabel">ENTREGUES · 7D</span>
        <span class="pt__vvalue">{{ loading ? "—" : delivered7d }}</span>
        <span class="pt__vnote">missões concluídas</span>
      </div>
      <div class="pt__vital">
        <span class="pt__vlabel">NO POSTO</span>
        <span class="pt__vvalue" :class="levelTone">{{ workers ? `${workers.alive}/${workers.expected}` : "—" }}</span>
        <span class="pt__vnote">workers com batimento</span>
      </div>
      <div class="pt__vital">
        <span class="pt__vlabel">ESTADO</span>
        <span class="pt__vvalue pt__vvalue--text" :class="levelTone">{{ status ? status.status.label : "—" }}</span>
        <span class="pt__vnote">supervisor a cada 60 s</span>
      </div>
    </section>

    <div class="pt__grid">
      <section class="pt__floors" aria-labelledby="pt-floors">
        <div class="pt__section-head">
          <h2 id="pt-floors">O prédio, andar por andar</h2>
          <span class="pt__mono">{{ slabs.length - 1 }} andares · {{ totalPeople }} ocupantes</span>
        </div>
        <article v-for="s in slabs" :key="s.code" class="pt__slab">
          <router-link :to="s.to" class="pt__slab-num" :aria-label="`Ir para ${s.name}`">{{ s.code }}</router-link>
          <div class="pt__slab-body">
            <div class="pt__slab-copy">
              <router-link :to="s.to" class="pt__slab-name">{{ s.name }}</router-link>
              <p class="pt__slab-summary">{{ s.summary }}</p>
            </div>
            <div class="pt__slab-side">
              <span class="pt__people">
                <span
                  v-for="p in s.people"
                  :key="p.id"
                  class="pt__av"
                  :style="{ background: p.color }"
                  :title="`${p.name} — ${!p.live ? 'sem status ao vivo' : p.busy ? 'trabalhando' : 'livre'}`"
                >{{ p.name.charAt(0) }}</span>
              </span>
              <span class="pt__chip" :class="{ 'is-busy': s.busy }">{{ s.chip }}</span>
              <router-link :to="s.officeTo" class="pt__link">Ver em 3D</router-link>
            </div>
          </div>
        </article>
      </section>

      <aside class="pt__side">
        <section class="pt__ask" :class="{ 'is-on': pending.length }" aria-labelledby="pt-ask">
          <h2 id="pt-ask" class="pt__ask-title">PRECISA DE VOCÊ</h2>
          <p v-if="!pending.length" class="pt__ask-empty">Nada aguarda sua decisão agora. Quando alguém pedir aprovação, aparece aqui primeiro.</p>
          <ul v-else class="pt__ask-list">
            <li v-for="a in pending" :key="a.id">
              <div>
                <p class="pt__ask-name">{{ a.title }}</p>
                <p class="pt__ask-meta">{{ a.workspaceName }} · risco {{ a.risk.toLowerCase() }}</p>
              </div>
              <router-link :to="`/app/floor/dev/command/approvals/${a.id}`" class="pt__link">Revisar</router-link>
            </li>
          </ul>
        </section>

        <section class="pt__truth" aria-labelledby="pt-truth">
          <h2 id="pt-truth" class="pt__truth-title">QUEM ESTÁ TRABALHANDO</h2>
          <ul class="pt__who">
            <template v-for="s in slabs" :key="s.code">
              <li v-for="p in s.people" :key="p.id">
                <span class="pt__dot" :class="{ 'is-busy': p.busy, 'is-off': !p.live }" aria-hidden="true" />
                <span class="pt__who-name">{{ p.name }}</span>
                <span class="pt__who-state">{{ !p.live ? "sem status" : p.busy ? "trabalhando" : "livre" }}</span>
                <span class="pt__who-floor">{{ s.code }}</span>
              </li>
            </template>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pt {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 36px clamp(16px, 4vw, 48px) 48px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  font-family: "Sora", sans-serif;
  color: var(--op-ink-3);
}

/* Coluna com rolagem: sem isso o flex espreme os blocos (os sinais vitais
   tem overflow:hidden e os numeros saiam cortados pela metade). */
.pt > * {
  flex-shrink: 0;
}

.pt__head {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
}

.pt__intro {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pt__eyebrow,
.pt__mono,
.pt__vlabel,
.pt__ask-title,
.pt__truth-title {
  margin: 0;
  font-family: var(--op-font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--op-muted-3);
  font-weight: 500;
}

.pt__title {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--op-ink);
  text-wrap: balance;
}

.pt__lead {
  margin: 0;
  max-width: 640px;
  font-size: 15px;
  color: var(--op-muted);
}

.pt__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pt__btn {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--op-bd-btn);
  border-radius: var(--op-radius-sm);
  color: var(--op-ink-3);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.pt__btn:hover {
  border-color: var(--op-bd-btn-h);
}

.pt__btn--primary {
  border-color: transparent;
  background: var(--op-cta);
  color: #fff;
  font-weight: 600;
}

.pt__btn--primary:hover {
  background: var(--op-cta-h);
}

.pt__vitals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-line);
}

.pt__vital {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: var(--op-panel);
}

.pt__vvalue {
  font-family: var(--op-font-mono);
  font-size: 26px;
  font-weight: 500;
  color: var(--op-ink);
  font-variant-numeric: tabular-nums;
}

.pt__vvalue--text {
  font-family: "Sora", sans-serif;
  font-size: 18px;
  padding-top: 6px;
}

.pt__vvalue.is-ok {
  color: var(--op-green);
}

.pt__vvalue.is-attention {
  color: var(--op-amber);
}

.pt__vvalue.is-problem {
  color: var(--op-red);
}

.pt__vnote {
  font-size: 12px;
  color: var(--op-muted-2);
}

.pt__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}

.pt__floors {
  flex: 999 1 520px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pt__section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.pt__section-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.pt__slab {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.pt__slab-num {
  display: grid;
  place-items: center;
  border-right: 1px solid var(--op-line);
  background: var(--op-raise);
  font-family: var(--op-font-mono);
  font-size: 20px;
  color: var(--op-ink-4);
  text-decoration: none;
}

.pt__slab-body {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.pt__slab-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 200px;
}

.pt__slab-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--op-ink-2);
  text-decoration: none;
}

.pt__slab-name:hover {
  text-decoration: underline;
}

.pt__slab-summary {
  margin: 0;
  font-size: 13px;
  color: var(--op-muted);
}

.pt__slab-side {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.pt__people {
  display: flex;
}

.pt__av {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 2px solid var(--op-panel);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: #07090d;
}

.pt__av + .pt__av {
  margin-left: -8px;
}

.pt__chip {
  padding: 5px 10px;
  border: 1px solid var(--op-bd-chip);
  border-radius: var(--op-radius-full);
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted);
  white-space: nowrap;
}

.pt__chip.is-busy {
  border-color: color-mix(in srgb, var(--op-green) 45%, transparent);
  color: var(--op-green);
}

.pt__link {
  font-size: 13px;
  color: var(--op-blue);
  text-decoration: none;
  white-space: nowrap;
}

.pt__link:hover {
  text-decoration: underline;
}

.pt__side {
  flex: 1 1 300px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pt__ask,
.pt__truth {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
}

.pt__ask.is-on {
  border-color: color-mix(in srgb, var(--op-violet) 50%, transparent);
}

.pt__ask .pt__ask-title {
  color: var(--op-violet);
}

.pt__ask-empty {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--op-muted);
}

.pt__ask-list,
.pt__who {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pt__ask-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.pt__ask-name {
  margin: 0;
  font-size: 14px;
  color: var(--op-ink-3);
}

.pt__ask-meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--op-muted-2);
}

.pt__who li {
  display: grid;
  grid-template-columns: 10px 1fr auto 28px;
  gap: 10px;
  align-items: center;
  font-size: 13px;
}

.pt__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--op-amber);
}

.pt__dot.is-busy {
  background: var(--op-green);
}

.pt__dot.is-off {
  background: var(--op-muted-4);
}

.pt__who-name {
  color: var(--op-ink-3);
}

.pt__who-state,
.pt__who-floor {
  font-family: var(--op-font-mono);
  font-size: 11px;
  color: var(--op-muted-2);
  text-align: right;
}

.pt__btn:focus-visible,
.pt__link:focus-visible,
.pt__slab-name:focus-visible,
.pt__slab-num:focus-visible {
  outline: 2px solid var(--op-cta);
  outline-offset: 2px;
}
</style>

<script setup lang="ts">
/** Fase 5 — O Mural do Escritório: migra pro sistema visual atual (--op-*). */
import { computed } from "vue";
import OperationalHeader from "@/components/shell/OperationalHeader.vue";
import { findFloor } from "@/data/office-floors";

const envHint = import.meta.env.VITE_USE_REAL_API === "false" ? "Mock local" : "API real";

const rows = computed(() => [
  { label: "Produto", value: "OperaIA · Campus & Lab" },
  { label: "Fundadora", value: "Marieli" },
  { label: "Fonte de dados", value: envHint },
  { label: "Equipe digital ativa", value: "CEO — Opera · CTO — Mag" },
  { label: "Mundo virtual", value: "Opera Campus (entrada) + sedes Residentes" },
  { label: "Infra monitorada", value: "Painel VPS · saúde e custo" },
]);

const shortcuts = [
  { label: "Command Center", to: "/app/command", desc: "Porta do escritório" },
  { label: "Nova demanda", to: "/app/command/new", desc: "Pedir ao escritório" },
  { label: "Sala da Opera", to: "/app/office/sala-ceo", desc: "Decidir com a CEO" },
  { label: "Infra", to: "/app/system/infra", desc: "Profundidade técnica" },
  { label: "Workspaces", to: "/app/workspaces", desc: "Clientes e projetos" },
];
</script>

<template>
  <OperationalHeader
    :floor="findFloor('dev')"
    scope-line="Compartilhado · todos os andares"
    title="Configurações"
    lede="Identidade do escritório e atalhos rápidos — preferências avançadas entram em fases futuras."
    :show-cta="false"
    :show-refresh="false"
  />
  <div class="op-content">
    <div class="op-layout">
      <section class="op-panel op-settings">
        <p class="op-eyebrow-sm">Identidade</p>
        <h2 class="op-panel__title">Identidade do escritório</h2>
        <div v-for="row in rows" :key="row.label" class="op-settings__row">
          <span class="op-settings__label">{{ row.label }}</span>
          <span class="op-settings__value">{{ row.value }}</span>
        </div>
      </section>

      <aside class="op-side">
        <article class="op-panel op-side__card">
          <p class="op-eyebrow-sm">Navegação</p>
          <h2 class="op-panel__title">Atalhos rápidos</h2>
          <p class="op-side__lead">Não saia do fluxo — pule direto para o que importa.</p>
          <router-link v-for="item in shortcuts" :key="item.to" :to="item.to" class="op-shortcut">
            <span class="op-shortcut__label">{{ item.label }}</span>
            <span class="op-shortcut__desc">{{ item.desc }}</span>
          </router-link>
        </article>
        <article class="op-panel op-side__card">
          <p class="op-eyebrow-sm">Roadmap</p>
          <h2 class="op-panel__title">Nota</h2>
          <p class="op-side__lead">
            Preferências avançadas (auth, billing do provedor, multiplayer) entram em fases futuras.
            Por enquanto o valor está em operar o Campus com clareza.
          </p>
        </article>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 34px 40px;
}

.op-eyebrow-sm {
  font-family: var(--op-font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--op-muted-5);
}

.op-panel {
  border: 1px solid var(--op-line);
  border-radius: var(--op-radius);
  background: var(--op-panel);
  padding: 20px;
}

.op-panel__title {
  margin: 4px 0 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--op-ink-2);
}

.op-layout {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.op-settings {
  flex: 1.4;
}

.op-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--op-line);
}

.op-settings__row:last-child {
  border-bottom: none;
}

.op-settings__label {
  font-size: 13px;
  color: var(--op-muted-3);
  margin-right: 16px;
}

.op-settings__value {
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
  text-align: right;
}

.op-side {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.op-side__lead {
  margin: 8px 0 12px;
  font-size: 13px;
  color: var(--op-muted-3);
  line-height: 1.45;
}

.op-shortcut {
  display: block;
  margin-top: 8px;
  padding: 12px;
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-line);
  background: var(--op-raise);
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.op-shortcut:hover {
  border-color: var(--op-line-strong);
  background: var(--op-hover);
}

.op-shortcut__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--op-ink-2);
}

.op-shortcut__desc {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--op-muted-4);
}

@media (max-width: 960px) {
  .op-layout {
    flex-direction: column;
  }
  .op-side {
    width: 100%;
  }
}
</style>

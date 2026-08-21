<script setup lang="ts">
import { computed } from "vue";

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
  { label: "Status", to: "/app/office/status", desc: "Porta do escritório" },
  { label: "Sala da Opera", to: "/app/office/sala-ceo", desc: "Decidir com a CEO" },
  { label: "Campus", to: "/app/campus", desc: "Explorar o mundo" },
  { label: "Infra", to: "/app/office/vps", desc: "Profundidade técnica" },
  { label: "Projetos", to: "/app/office/projetos", desc: "Workspaces vivos" },
];
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Preferências</p>
        <h1 class="page__title">Configurações</h1>
      </div>
      <div class="topbar__right">
        <router-link to="/app/office/status" class="btn btn--primary">Abrir Status</router-link>
      </div>
    </header>

    <div class="studio__stage">
      <div class="layout">
        <section class="panel settings card-motion" style="--d: 1">
          <p class="eyebrow">Identidade</p>
          <h2 class="section__title">Identidade do escritório</h2>
          <div v-for="row in rows" :key="row.label" class="settings__row">
            <span class="settings__label">{{ row.label }}</span>
            <span class="settings__value">{{ row.value }}</span>
          </div>
        </section>

        <aside class="side">
          <article class="panel side__card card-motion" style="--d: 2">
            <p class="eyebrow">Navegação</p>
            <h2 class="section__title">Atalhos rápidos</h2>
            <p class="side__lead">Não saia do fluxo — pule direto para o que importa.</p>
            <router-link
              v-for="item in shortcuts"
              :key="item.to"
              :to="item.to"
              class="shortcut"
            >
              <span class="shortcut__label">{{ item.label }}</span>
              <span class="shortcut__desc">{{ item.desc }}</span>
            </router-link>
          </article>
          <article class="panel side__card side__card--note card-motion" style="--d: 3">
            <p class="eyebrow">Roadmap</p>
            <h2 class="section__title">Nota</h2>
            <p class="side__lead">
              Preferências avançadas (auth, billing do provedor, multiplayer) entram em fases futuras.
              Por enquanto o valor está em operar o Campus com clareza.
            </p>
          </article>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 200px;
  margin-right: 16px;
}

.topbar__right {
  margin-left: auto;
}

.layout {
  display: flex;
  align-items: flex-start;
}

.settings {
  flex: 1.4;
  padding: 16px 20px 18px;
  max-width: none;
}

.settings .section__title {
  margin-top: 6px;
  margin-bottom: 8px;
}

.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.settings__row:last-child {
  border-bottom: none;
}

.settings__label {
  font-size: 13px;
  color: var(--text-muted);
  margin-right: 16px;
}

.settings__value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-align: right;
}

.side {
  width: 320px;
  margin-left: 16px;
  flex-shrink: 0;
}

.side__card {
  padding: 16px;
}

.side__card + .side__card {
  margin-top: 14px;
}

.side__card .section__title {
  margin-top: 6px;
}

.side__lead {
  margin-top: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.45;
}

.shortcut {
  display: block;
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(8, 14, 26, 0.35);
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease), transform 0.2s var(--ease);
}

.shortcut:hover {
  border-color: var(--brand-line);
  background: var(--surface-2);
  transform: translateX(2px);
}

.shortcut__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.shortcut__desc {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-muted);
}

.side__card--note {
  border-color: rgba(56, 189, 248, 0.2);
}

@media (max-width: 960px) {
  .layout {
    flex-direction: column;
  }
  .side {
    width: 100%;
    margin-left: 0;
    margin-top: 14px;
  }
  .studio__topbar {
    flex-wrap: wrap;
  }
  .topbar__right {
    width: 100%;
    margin-left: 0;
    margin-top: 12px;
  }
}
</style>

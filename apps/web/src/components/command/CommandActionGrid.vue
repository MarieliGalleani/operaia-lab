<script setup lang="ts">
const items = [
  {
    to: "/app/command/new",
    primary: true,
    title: "Nova demanda",
    desc: "Descreva o trabalho que você precisa realizar.",
    icon: "M12 5v14M5 12h14",
  },
  {
    to: "#cc-automations",
    primary: false,
    title: "Solicitar automação",
    desc: "Conheça as capacidades que estão sendo preparadas.",
    icon: "M4 12h4l2-6 3 12 2-6h5",
  },
  {
    to: "/app/missions",
    primary: false,
    title: "Ver meu trabalho",
    desc: "Acompanhe missões, resultados e próximos passos.",
    icon: "M4 14h4v6H4zM10 9h4v11h-4zM16 4h4v16h-4z",
  },
  {
    to: "/app/decisions",
    primary: false,
    title: "Revisar decisões",
    desc: "Veja o que precisa da sua análise.",
    icon: "M12 8v5l3 2 M20 12a8 8 0 1 1-8-8",
  },
] as const;
</script>

<template>
  <section class="actions panel" aria-labelledby="cc-actions">
    <div class="section__head">
      <div>
        <p class="eyebrow">Comece por aqui</p>
        <h2 id="cc-actions" class="section__title">O que você quer fazer?</h2>
      </div>
    </div>
    <div class="actions__grid">
      <component
        :is="item.to.startsWith('#') ? 'a' : 'router-link'"
        v-for="item in items"
        :key="item.title"
        :to="item.to.startsWith('#') ? undefined : item.to"
        :href="item.to.startsWith('#') ? item.to : undefined"
        class="actions__item"
        :class="{ 'actions__item--primary': item.primary }"
      >
        <span class="actions__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path :d="item.icon" />
          </svg>
        </span>
        <span class="actions__copy">
          <strong>{{ item.title }}</strong>
          <span>{{ item.desc }}</span>
        </span>
      </component>
    </div>
  </section>
</template>

<style scoped>
.actions {
  padding: 20px;
  margin-bottom: var(--space-4);
}

.actions__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.actions__item {
  display: flex;
  align-items: flex-start;
  padding: 18px;
  margin-right: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  color: inherit;
  background: var(--surface-2);
  transition:
    border-color 180ms var(--ease),
    background 180ms var(--ease),
    transform 180ms var(--ease),
    box-shadow 180ms var(--ease);
}

.actions__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-right: 12px;
  flex-shrink: 0;
  border-radius: 9px;
  background: var(--surface-hover);
  color: var(--text-muted);
  transition: background 180ms var(--ease), color 180ms var(--ease);
}

.actions__icon svg {
  width: 17px;
  height: 17px;
}

.actions__item:hover,
.actions__item:focus-visible {
  border-color: var(--violet-line);
  background: var(--surface-hover);
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.actions__item--primary {
  border-color: var(--violet-line);
  background:
    radial-gradient(140% 140% at 0% 0%, rgba(139, 92, 246, 0.14), transparent 60%),
    var(--brand-soft);
}

.actions__item--primary .actions__icon,
.actions__item:hover .actions__icon,
.actions__item:focus-visible .actions__icon {
  background: var(--gradient-brand);
  color: #fff;
}

.actions__item--primary:hover,
.actions__item--primary:focus-visible {
  border-color: var(--violet-line);
  background:
    radial-gradient(140% 140% at 0% 0%, rgba(139, 92, 246, 0.2), transparent 60%),
    var(--brand-soft);
  box-shadow: var(--glow-brand);
}

.actions__copy {
  display: block;
  min-width: 0;
}

.actions__copy strong,
.actions__copy span {
  display: block;
}

.actions__copy span {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

@media (max-width: 768px) {
  .actions__grid {
    grid-template-columns: 1fr;
  }
}
</style>

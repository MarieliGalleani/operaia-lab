<script setup lang="ts">
const docs = [
  {
    title: "Visão do produto",
    desc: "Diretrizes, objetivos e o papel do Opera Campus na OperaIA.",
    tag: "Produto",
    to: "/campus",
    cta: "Ver o Campus",
  },
  {
    title: "Arquitetura",
    desc: "Como engine, Residentes, missões e o lab se conectam sem se misturar.",
    tag: "Sistema",
    to: "/office/vps",
    cta: "Saúde da infra",
  },
  {
    title: "Operação com a Opera",
    desc: "Peça planos, riscos e próximas ações direto na Sala da CEO.",
    tag: "Executivo",
    to: "/office/sala-ceo",
    cta: "Falar com Opera",
  },
  {
    title: "Workspaces",
    desc: "Projetos vivos, progresso e equipe envolvida em cada missão.",
    tag: "Entrega",
    to: "/office/projetos",
    cta: "Abrir projetos",
  },
];
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Base de conhecimento</p>
        <h1 class="page__title">Conhecimento</h1>
      </div>
      <div class="topbar__right">
        <router-link to="/office/atividades" class="btn btn--ghost">Atividades</router-link>
        <router-link to="/office/sala-ceo" class="btn btn--primary">Perguntar à Opera</router-link>
      </div>
    </header>

    <div class="studio__stage">
      <section class="hero panel card-motion" style="--d: 1">
        <div>
          <p class="eyebrow">Sugestão do lab</p>
          <h2 class="hero__title">Comece pelo Campus, decida com a Opera</h2>
          <p class="hero__body">
            O conhecimento certo não é um PDF — é o próximo clique com contexto.
            Explore a sede, acompanhe a infra e feche a conversa na Sala da CEO.
          </p>
        </div>
        <div class="hero__actions">
          <router-link to="/campus" class="btn btn--primary">Entrar no Campus</router-link>
          <router-link to="/office" class="btn btn--ghost">Andar no Lab</router-link>
        </div>
      </section>

      <div class="grid grid--cards docs">
        <router-link
          v-for="(doc, i) in docs"
          :key="doc.title"
          :to="doc.to"
          class="panel doc card-motion"
          :style="{ '--d': i + 2 }"
        >
          <span class="chip chip--ok">{{ doc.tag }}</span>
          <h3 class="doc__title">{{ doc.title }}</h3>
          <p class="doc__desc">{{ doc.desc }}</p>
          <span class="doc__cta">{{ doc.cta }} →</span>
        </router-link>
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
  display: flex;
  margin-left: auto;
}

.topbar__right .btn + .btn {
  margin-left: 8px;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 26px;
  border-color: var(--brand-line);
  background:
    radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.18), transparent 50%),
    linear-gradient(165deg, rgba(30, 48, 80, 0.45), transparent 42%),
    var(--surface);
}

.hero__title {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.hero__body {
  margin-top: 10px;
  max-width: 56ch;
  font-size: 14px;
  color: var(--text-muted);
}

.hero__actions {
  display: flex;
  flex-direction: column;
  margin-left: 24px;
  flex-shrink: 0;
}

.hero__actions .btn + .btn {
  margin-top: 8px;
}

.docs {
  margin-top: 16px;
}

.doc {
  display: block;
  padding: 18px;
  transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
}

.doc:hover {
  border-color: var(--brand-line);
  transform: translateY(-2px);
}

.doc__title {
  margin-top: 12px;
  font-size: 16px;
  font-weight: 600;
}

.doc__desc {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.45;
}

.doc__cta {
  display: inline-block;
  margin-top: 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--brand);
}

@media (max-width: 900px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
  }
  .hero__actions {
    margin-left: 0;
    margin-top: 16px;
    width: 100%;
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

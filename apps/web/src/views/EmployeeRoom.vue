<script setup lang="ts">
import { computed } from "vue";
import EmployeeProfileCard from "@/components/EmployeeProfileCard.vue";
import { useOffice } from "@/composables/useOffice";

const { employees, projects, summary } = useOffice();

const hired = computed(() => employees.value.filter((e) => e.active));
const upcoming = computed(() => employees.value.filter((e) => !e.active));

function involvedProjects(employeeId: string): readonly string[] {
  return projects.value
    .filter((project) => project.teamIds.includes(employeeId))
    .map((project) => project.name);
}
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Pessoas do lab</p>
        <h1 class="page__title">Equipe</h1>
      </div>

      <div class="studio__pulse" aria-label="Resumo da equipe">
        <span class="studio__pulse-item">
          <strong>{{ hired.length }}</strong> contratados
        </span>
        <span class="studio__pulse-item">
          <strong>{{ upcoming.length }}</strong> em contratação
        </span>
        <span class="studio__pulse-item">
          <strong>{{ summary?.workingEmployees ?? 0 }}</strong> em operação
        </span>
      </div>

      <div class="topbar__right">
        <router-link to="/campus" class="btn btn--ghost">Campus</router-link>
        <router-link to="/office/sala-ceo" class="btn btn--primary">Falar com Opera</router-link>
      </div>
    </header>

    <div class="studio__stage">
      <section class="block">
        <div class="block__head">
          <div>
            <h2 class="block__title">Contratados</h2>
            <p class="block__sub">Especialistas ativos — clique mentalmente no próximo passo com a Opera</p>
          </div>
          <router-link to="/office/projetos" class="section__link">Ver projetos</router-link>
        </div>
        <div class="grid grid--cards">
          <EmployeeProfileCard
            v-for="(employee, i) in hired"
            :key="employee.id"
            :employee="employee"
            :involved-projects="involvedProjects(employee.id)"
            :style="{ '--d': i + 1 }"
          />
        </div>
        <div v-if="hired.length === 0" class="empty-state">
          <p class="empty-state__title">Ninguém contratado ainda</p>
          <p class="empty-state__body">Quando a API trouxer a equipe, os perfis aparecem aqui.</p>
        </div>
      </section>

      <section class="block">
        <div class="block__head">
          <div>
            <h2 class="block__title">Fila de contratação</h2>
            <p class="block__sub">Próximos a entrar no quadro</p>
          </div>
        </div>
        <div class="grid grid--cards">
          <EmployeeProfileCard
            v-for="(employee, i) in upcoming"
            :key="employee.id"
            :employee="employee"
            :involved-projects="involvedProjects(employee.id)"
            :style="{ '--d': i + 1 }"
          />
        </div>
        <div v-if="upcoming.length === 0" class="empty-state">
          <p class="empty-state__title">Fila vazia</p>
          <p class="empty-state__body">Ninguém aguardando contratação no momento — o lab está enxuto.</p>
          <router-link to="/office/sala-ceo" class="btn btn--primary">Pedir indicação à Opera</router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.topbar__left {
  min-width: 180px;
  margin-right: 20px;
}

.topbar__right {
  display: flex;
  margin-left: auto;
}

.topbar__right .btn + .btn {
  margin-left: 10px;
}

.block + .block {
  margin-top: 36px;
}

.block__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 16px;
}

.block__title {
  font-size: 18px;
  font-weight: 600;
}

.block__sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .studio__topbar {
    flex-wrap: wrap;
  }
  .topbar__right {
    width: 100%;
    margin-left: 0;
    margin-top: 14px;
  }
}
</style>

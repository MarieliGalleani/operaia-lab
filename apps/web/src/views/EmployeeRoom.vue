<script setup lang="ts">
import { computed } from "vue";
import EmployeeProfileCard from "@/components/EmployeeProfileCard.vue";
import { useOffice } from "@/composables/useOffice";

const { employees, projects } = useOffice();

const hired = computed(() => employees.value.filter((e) => e.active));
const upcoming = computed(() => employees.value.filter((e) => !e.active));

function involvedProjects(employeeId: string): readonly string[] {
  return projects.value
    .filter((project) => project.teamIds.includes(employeeId))
    .map((project) => project.name);
}
</script>

<template>
  <div class="page">
    <header>
      <h1 class="page__title">Sala dos funcionários</h1>
      <p class="page__subtitle">
        A equipe do OperaIA.lab. Cada especialista trabalha nos bastidores sob a
        coordenação da CEO — Opera.
      </p>
    </header>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Contratados</h2>
      </div>
      <div class="grid grid--cards">
        <EmployeeProfileCard
          v-for="employee in hired"
          :key="employee.id"
          :employee="employee"
          :involved-projects="involvedProjects(employee.id)"
        />
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Preparados para contratação</h2>
      </div>
      <div class="grid grid--cards">
        <EmployeeProfileCard
          v-for="employee in upcoming"
          :key="employee.id"
          :employee="employee"
          :involved-projects="involvedProjects(employee.id)"
        />
      </div>
    </section>
  </div>
</template>

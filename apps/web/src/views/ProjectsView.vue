<script setup lang="ts">
import ProjectCard from "@/components/ProjectCard.vue";
import { useOffice } from "@/composables/useOffice";

const { projects } = useOffice();
</script>

<template>
  <div class="page">
    <header>
      <h1 class="page__title">Projetos</h1>
      <p class="page__subtitle">
        Cada projeto é um workspace vivo, coordenado pela sua equipe.
      </p>
    </header>

    <div class="grid grid--cards section">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
      />
    </div>
  </div>
</template>

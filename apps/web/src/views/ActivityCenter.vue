<script setup lang="ts">
import ActivityStream from "@/components/ActivityStream.vue";
import { useOffice } from "@/composables/useOffice";

const { activities } = useOffice();
</script>

<template>
  <div class="page">
    <header>
      <h1 class="page__title">Central de atividades</h1>
      <p class="page__subtitle">
        A linha do tempo viva do escritório. Acompanhe cada movimento da equipe
        em tempo real.
      </p>
    </header>

    <div class="card section" style="padding: 12px 22px">
      <ActivityStream :activities="activities" />
    </div>
  </div>
</template>

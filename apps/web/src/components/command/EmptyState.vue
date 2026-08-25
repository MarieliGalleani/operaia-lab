<script setup lang="ts">
defineProps<{
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaTo?: string;
}>();
</script>

<template>
  <div class="empty-state">
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="body" class="empty-state__body">{{ body }}</p>
    <router-link
      v-if="ctaTo && ctaLabel"
      :to="ctaTo"
      class="btn btn--primary"
    >
      {{ ctaLabel }}
    </router-link>
    <slot />
  </div>
</template>

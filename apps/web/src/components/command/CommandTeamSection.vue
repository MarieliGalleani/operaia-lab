<script setup lang="ts">
import type { TeamMemberDto } from "@/data/office-command";

defineProps<{ team: readonly TeamMemberDto[] }>();

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
</script>

<template>
  <section class="section" aria-labelledby="cc-team">
    <div class="section__head">
      <div>
        <p class="eyebrow">Equipe digital</p>
        <h2 id="cc-team" class="section__title">Quem está no escritório agora</h2>
      </div>
      <router-link to="/app/team" class="section__link">Ver equipe</router-link>
    </div>
    <div v-if="team.length" class="team">
      <article v-for="member in team" :key="member.employeeId" class="person panel">
        <span class="person__avatar" :class="{ 'person__avatar--busy': member.currentMissionId }">
          {{ initial(member.name) }}
        </span>
        <div>
          <strong>{{ member.name }}</strong>
          <span>{{ member.specialization }}</span>
          <small v-if="member.currentObjective">
            Trabalhando em: {{ member.currentObjective }}
          </small>
          <small v-else>Disponível agora</small>
        </div>
      </article>
    </div>
    <p v-else class="quiet">A equipe ainda não está disponível para consulta.</p>
  </section>
</template>

<style scoped>
.team {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 14px;
}

.person {
  display: flex;
  align-items: center;
  padding: 14px;
  margin-right: 12px;
  margin-bottom: 12px;
}

.person__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  margin-right: 10px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: 16px;
  font-weight: 600;
}

.person__avatar--busy {
  background: rgba(52, 211, 153, 0.18);
  color: #34d399;
  box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.35);
}

.person strong,
.person span,
.person small {
  display: block;
}

.person span,
.person small {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.quiet {
  color: var(--text-soft);
  font-size: var(--text-sm);
}

@media (max-width: 980px) {
  .team {
    grid-template-columns: 1fr;
  }
}
</style>

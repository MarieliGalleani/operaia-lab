<script setup lang="ts">
import type { ApprovalDetailDto } from "@/data/office-command";
import RiskBadge from "./RiskBadge.vue";

defineProps<{ detail: ApprovalDetailDto }>();
const emit = defineEmits<{
  approve: [];
  reject: [];
  modify: [];
}>();
</script>

<template>
  <section class="impact panel" aria-labelledby="approval-why">
    <p class="eyebrow">Aprovação necessária</p>
    <h2 id="approval-why" class="page__title" style="font-size: var(--text-xl)">
      Por que estou pedindo sua aprovação?
    </h2>

    <dl class="impact__grid">
      <div>
        <dt>Ação</dt>
        <dd>{{ detail.action }}</dd>
      </div>
      <div>
        <dt>Workspace</dt>
        <dd>{{ detail.workspaceName }}</dd>
      </div>
      <div>
        <dt>Risco</dt>
        <dd><RiskBadge :risk="detail.risk" /></dd>
      </div>
      <div>
        <dt>Impacto</dt>
        <dd>{{ detail.impact }}</dd>
      </div>
      <div>
        <dt>Motivo</dt>
        <dd>{{ detail.reason }}</dd>
      </div>
      <div>
        <dt>Plano</dt>
        <dd>{{ detail.planSummary }}</dd>
      </div>
      <div>
        <dt>Já validado</dt>
        <dd>
          <ul>
            <li v-for="v in detail.validated" :key="v">{{ v }}</li>
          </ul>
        </dd>
      </div>
      <div>
        <dt>Se aprovar</dt>
        <dd>{{ detail.ifApprove }}</dd>
      </div>
      <div>
        <dt>Se recusar</dt>
        <dd>{{ detail.ifReject }}</dd>
      </div>
      <div>
        <dt>Decisão do escritório</dt>
        <dd>{{ detail.officeDecision }}</dd>
      </div>
    </dl>

    <div class="impact__actions" role="group" aria-label="Ações de aprovação">
      <button type="button" class="btn btn--approve" @click="emit('approve')">
        Aprovar
      </button>
      <button type="button" class="btn btn--danger" @click="emit('reject')">
        Recusar
      </button>
      <button type="button" class="btn btn--ghost" @click="emit('modify')">
        Modificar
      </button>
    </div>
  </section>
</template>

<style scoped>
.impact {
  padding: 22px;
}
.impact__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 20px;
}
.impact__grid > div {
  padding: 12px 14px 12px 0;
  border-bottom: 1px solid var(--border);
}
.impact__grid dt {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-soft);
  margin-bottom: 4px;
}
.impact__grid dd {
  margin: 0;
  color: var(--text);
  font-size: var(--text-sm);
}
.impact__grid ul {
  margin: 0;
  padding-left: 18px;
}
.impact__actions {
  display: flex;
  flex-wrap: wrap;
  margin-top: 24px;
}
.impact__actions .btn {
  margin-right: 10px;
  margin-bottom: 8px;
}
@media (max-width: 768px) {
  .impact__grid {
    grid-template-columns: 1fr;
  }
  .impact__actions {
    position: sticky;
    bottom: 0;
    padding: 12px 0;
    background: linear-gradient(transparent, var(--bg) 30%);
  }
  .impact__actions .btn {
    flex: 1 1 100%;
    margin-right: 0;
  }
}
</style>

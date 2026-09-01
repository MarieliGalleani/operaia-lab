<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ApprovalImpact from "@/components/command/ApprovalImpact.vue";
import LoadingState from "@/components/command/LoadingState.vue";
import { officeCommandClient } from "@/data/adapters/office-client";
import type { ApprovalDetailDto } from "@/data/office-command";

const props = defineProps<{ id: string }>();
const route = useRoute();
const router = useRouter();
const id = props.id || String(route.params.id);

const detail = ref<ApprovalDetailDto | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const feedback = ref("");

onMounted(async () => {
  try {
    detail.value = await officeCommandClient.getApproval(id);
    state.value = detail.value ? "ready" : "error";
  } catch (error) {
    console.log("[approval-detail] failed", error);
    state.value = "error";
  }
});

async function act(action: "approve" | "reject" | "modify") {
  const res = await officeCommandClient.actOnApproval(id, action);
  feedback.value = res.message;
  if (detail.value) {
    detail.value = { ...detail.value, status: res.status };
  }
  if (action === "modify") {
    await router.push({
      path: "/app/command/new",
      query: { workspace: detail.value?.workspaceId },
    });
  }
}
</script>

<template>
  <div class="studio">
    <header class="studio__topbar">
      <div class="topbar__left">
        <p class="page__kicker">Comando › Aprovações › Detalhe</p>
        <h1 class="page__title">Aprovação</h1>
      </div>
      <router-link to="/app/command/approvals" class="btn btn--ghost">Voltar</router-link>
    </header>
    <div class="studio__stage">
      <LoadingState v-if="state === 'loading'" />
      <p v-else-if="state === 'error'" role="alert">Aprovação não encontrada.</p>
      <template v-else-if="detail">
        <p v-if="feedback" class="backend-note" role="status">{{ feedback }}</p>
        <ApprovalImpact
          :detail="detail"
          @approve="act('approve')"
          @reject="act('reject')"
          @modify="act('modify')"
        />
      </template>
    </div>
  </div>
</template>

import { onMounted, readonly, ref } from "vue";
import { officeCommandClient } from "@/data/adapters/office-client";

const count = ref(0);

export function usePendingApprovalsBadge() {
  async function refresh() {
    try {
      count.value = await officeCommandClient.pendingApprovalsCount();
    } catch (error) {
      console.log("[approvals-badge] falha", error);
      count.value = 0;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    pendingApprovals: readonly(count),
    refreshApprovalsBadge: refresh,
  };
}

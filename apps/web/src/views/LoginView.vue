<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";

const auth = useAuth();
const route = useRoute();
const router = useRouter();
const login = ref("");
const password = ref("");

const registrationDisabled = computed(
  () => route.query.registration === "disabled",
);

async function submit(): Promise<void> {
  const authenticated = await auth.login({
    login: login.value,
    password: password.value,
  });
  password.value = "";
  if (authenticated) {
    await router.replace("/app");
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card" aria-labelledby="login-title">
      <div class="login-brand" aria-hidden="true">O</div>
      <p class="login-kicker">OperaIA.lab</p>
      <h1 id="login-title">Acessar escritório</h1>
      <p class="login-description">
        Identificação exclusiva da administradora do ambiente.
      </p>

      <p v-if="registrationDisabled" class="login-notice">
        O cadastro público está desativado. Este ambiente possui uma única
        administradora.
      </p>
      <p v-if="auth.message.value" class="login-error" role="alert">
        {{ auth.message.value }}
      </p>

      <form class="login-form" @submit.prevent="submit">
        <label for="admin-login">Login</label>
        <input
          id="admin-login"
          v-model.trim="login"
          name="login"
          type="text"
          autocomplete="username"
          required
          autofocus
        />

        <label for="admin-password">Senha</label>
        <input
          id="admin-password"
          v-model="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />

        <button
          class="login-submit"
          type="submit"
          :disabled="auth.busy.value"
        >
          {{ auth.busy.value ? "Verificando…" : "Entrar" }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
  background:
    radial-gradient(circle at 50% 10%, rgba(59, 130, 246, 0.14), transparent 38%),
    var(--bg);
}

.login-card {
  width: min(100%, 420px);
  padding: var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.login-brand {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #fff;
  font-weight: 700;
  background: linear-gradient(145deg, var(--brand), var(--brand-strong));
}

.login-kicker {
  margin-top: var(--space-3);
  color: var(--brand);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1 {
  margin-top: var(--space-1);
  font-size: var(--text-2xl);
}

.login-description {
  margin-top: var(--space-1);
}

.login-notice,
.login-error {
  margin-top: var(--space-2);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.login-notice {
  color: var(--warning);
  background: var(--warning-soft);
}

.login-error {
  color: var(--danger);
  background: var(--danger-soft);
}

.login-form {
  margin-top: var(--space-3);
}

.login-form label {
  display: block;
  margin-top: var(--space-2);
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
}

.login-form input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  background: var(--bg-elevated);
  font: inherit;
}

.login-form input:focus {
  border-color: var(--brand);
}

.login-submit {
  width: 100%;
  min-height: 44px;
  margin-top: var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  color: #fff;
  font-weight: 700;
  background: var(--brand);
}

.login-submit:hover:not(:disabled) {
  background: var(--brand-strong);
}

.login-submit:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>

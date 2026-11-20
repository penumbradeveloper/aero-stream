// Aero - Ouvindo agora (extensão): roda só na página de instalar que o próprio app do Aero abre (http://127.0.0.1:41783/instalar).
// Pega o código de pareamento dela e guarda: a pessoa não precisa copiar nada. Criado por Ryan Victtor.
(() => {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const m = document.querySelector('meta[name="aero-par"]');
  const tok = m ? String(m.content || '') : '';
  document.documentElement.dataset.extensao = 'ok';
  if (!/^[a-f0-9]{16,64}$/i.test(tok)) return;
  try { api.runtime.sendMessage({ tipo: 'parear', token: tok }); } catch (e) { /* ok */ }
})();

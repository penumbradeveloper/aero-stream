// Aero Stream - acesso às contas, sem o servidor conhecer os segredos. Criado por Ryan Victtor.
//
// O CÓDIGO DE ACESSO (AERO-XXXX-XXXX-XXXX) NUNCA CHEGA AQUI. O aparelho tira dele duas chaves diferentes (PBKDF2, 310 mil voltas):
//   - "acesso": serve só para entrar; aqui fica apenas o SHA-256 dela (la:<hash> -> conta);
//   - "cofre": abre a chave de criptografia da conta, que fica guardada aqui CIFRADA (cofre.w1). Sem o código, ninguém abre.
// O e-mail fica cifrado (AES-GCM com a chave secreta CHAVE_EMAIL do servidor) e é procurado por um HMAC dele (eh:<hmac> -> conta).
// Esqueceu o código? Um código de 6 números vai para o e-mail; com ele dá para criar um código de acesso novo.
import { resposta, erro, txt, aleatorio, hex, TAG_REGEX, normalizarTag } from './util.js';
import { enviarSmtp, smtpConfigurado } from './smtp.js';

const HEX64 = /^[0-9a-f]{64}$/;
const B64 = /^[A-Za-z0-9+/=_-]+$/;
const sha = async (t) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))));
const cifraOk = (w, max = 20000) => w && typeof w.iv === 'string' && w.iv.length <= 40 && B64.test(w.iv) && typeof w.ct === 'string' && w.ct.length <= max && B64.test(w.ct);
const pubOk = (p) => p && p.kty === 'EC' && p.crv === 'P-256' && typeof p.x === 'string' && typeof p.y === 'string' && p.x.length < 60 && p.y.length < 60 && B64.test(p.x) && B64.test(p.y);
const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const MSG_TAG = 'A # precisa ter de 3 a 20 caracteres: letras, números, _ . ou -';
const QUINZE_MIN = 15 * 60 * 1000;
const QR_VIDA = 5 * 60 * 1000; // (0.9.6) o QR de entrar troca a cada 5 minutos
const QR_GIRO = 30 * 1000, QR_FOLGA = 15 * 1000; // (1.0.0) o QR do aparelho logado troca a cada 30 s (o anterior ainda vale por mais 15 s, para quem está digitando)
// comparação sem atalho (o tempo não diz quantas letras acertou)
const igual = (a, b) => { a = String(a || ''); b = String(b || ''); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// ---------- 2FA (0.6.0): TOTP, o mesmo do Google Authenticator (RFC 6238: HMAC-SHA1, 6 dígitos, 30 s) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32 = (bytes) => { let bits = 0, v = 0, out = ''; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(v << (5 - bits)) & 31]; return out; };
const deBase32 = (t) => { let bits = 0, v = 0; const out = []; for (const ch of String(t).toUpperCase().replace(/[^A-Z2-7]/g, '')) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); };
async function totp(segredo, passo) {
  const k = await crypto.subtle.importKey('raw', deBase32(segredo), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const c = new Uint8Array(8); let x = passo; for (let i = 7; i >= 0; i--) { c[i] = x & 255; x = Math.floor(x / 256); }
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, c)), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1000000).padStart(6, '0');
}
export async function totpConfere(segredo, codigo, agora = Date.now()) {
  codigo = String(codigo || '').replace(/\D/g, ''); if (codigo.length !== 6) return false;
  const p = Math.floor(agora / 30000);
  for (const d of [0, -1, 1]) if ((await totp(segredo, p + d)) === codigo) return true; // aceita 30 s de diferença no relógio do celular
  return false;
}
export { totp as _totp, base32 as _base32 };

export class Acesso {
  constructor(hub) { this.hub = hub; this.st = hub.ctx.storage; }
  get env() { return this.hub.env || {}; }
  get(k) { return this.st.get(k); }

  // ---------- e-mail cifrado ----------
  async chaves() {
    if (this._ch) return this._ch;
    // (0.8.7) sem CHAVE_EMAIL o servidor avisa alto no registro (a chave de reserva continua só para não perder os e-mails já guardados com ela)
    if (!this.env.CHAVE_EMAIL && !Acesso._avisouChave) { Acesso._avisouChave = true; console.error('[SEGURANÇA] CHAVE_EMAIL não configurada: usando a chave de desenvolvimento. Configure com "wrangler secret put CHAVE_EMAIL".'); }
    const segredo = new TextEncoder().encode(this.env.CHAVE_EMAIL || 'aero-stream-desenvolvimento');
    const base = await crypto.subtle.digest('SHA-256', segredo);
    const hmac = await crypto.subtle.importKey('raw', base, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const cif = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new Uint8Array([...new Uint8Array(base), 1])), 'AES-GCM', false, ['encrypt', 'decrypt']);
    const srv = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new Uint8Array([...new Uint8Array(base), 2])), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return (this._ch = { hmac, cif, srv });
  }
  async emailH(email) { const { hmac } = await this.chaves(); return hex(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode('email:' + email)))); }
  async cifrarEmail(email) {
    const { cif } = await this.chaves(), iv = crypto.getRandomValues(new Uint8Array(12));
    return hex(iv) + '.' + hex(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cif, new TextEncoder().encode(email))));
  }
  async abrirEmail(conta) {
    if (conta.email) return conta.email;
    if (!conta.emailC) return '';
    const { cif } = await this.chaves(), [iv, ct] = conta.emailC.split('.');
    const de = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
    try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: de(iv) }, cif, de(ct))); } catch (_) { return ''; }
  }
  // ---------- a chave da conta guardada pelo servidor (0.5.9-3) ----------
  // A criptografia é da CONTA, não do aparelho nem de uma senha: o pacote com as chaves da conta fica aqui cifrado com a chave secreta do
  // servidor (amarrado ao id da conta) e é entregue a qualquer sessão logada nessa conta. Quem entra na conta (código de acesso ou e-mail)
  // lê todas as mensagens; quem copia o banco de dados sem o segredo do servidor não lê nada. Ninguém precisa digitar nada para isso.
  validarPacote(texto) {
    if (typeof texto !== 'string' || texto.length > 12000) return null;
    let p; try { p = JSON.parse(texto); } catch (_) { return null; }
    if (!p || typeof p.atual !== 'string' || !Array.isArray(p.chaves) || !p.chaves.length || p.chaves.length > 20) return null;
    for (const c of p.chaves) if (!c || !/^[0-9a-f]{16}$/.test(String(c.kid)) || ![c.x, c.y, c.d].every((v) => typeof v === 'string' && v.length < 60 && B64.test(v))) return null;
    if (!p.chaves.some((c) => c.kid === p.atual)) return null;
    return p;
  }
  async fecharPacote(conta, texto) {
    const { srv } = await this.chaves(), iv = crypto.getRandomValues(new Uint8Array(12));
    return hex(iv) + '.' + hex(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(conta.id) }, srv, new TextEncoder().encode(texto))));
  }
  async abrirPacote(conta) {
    const ws = conta.cofre && conta.cofre.ws; if (!ws) return null;
    const { srv } = await this.chaves(), [iv, ct] = ws.split('.');
    const de = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
    try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: de(iv), additionalData: new TextEncoder().encode(conta.id) }, srv, de(ct))); } catch (_) { return null; }
  }

  async contaPorEmail(email) {
    let id = await this.get('eh:' + (await this.emailH(email)));
    if (!id) id = await this.get('e:' + email); // conta antiga (e-mail ainda aberto)
    return id ? this.get('c:' + id) : null;
  }
  // contas antigas: o e-mail aberto vira cifrado, e a senha antiga (que o servidor via) sai
  async arrumar(conta) {
    const cf = conta.cofre; // (0.7.9) a senha de recuperação acabou: a cópia do cofre fechada por ela sai do banco
    if (!conta.email && conta.hash === undefined && !(cf && (cf.w2 || cf.sal))) return conta;
    if (cf) { delete cf.w2; delete cf.sal; }
    const grava = {};
    if (conta.email) {
      const h = await this.emailH(conta.email);
      conta.emailC = await this.cifrarEmail(conta.email); conta.emailH = h;
      grava['eh:' + h] = conta.id;
      await this.st.delete('e:' + conta.email);
      delete conta.email;
    }
    delete conta.hash; delete conta.salt;
    grava['c:' + conta.id] = conta;
    await this.st.put(grava);
    return conta;
  }

  // ---------- envio do e-mail ----------
  // (0.9.6) primeiro pelo SMTP grátis (Gmail com senha de app: SMTP_USUARIO e SMTP_SENHA, veja smtp.js); o Brevo (BREVO_API_KEY e
  // EMAIL_REMETENTE) só fica de reserva, se estiver configurado
  emailPronto() { return smtpConfigurado(this.env) || !!(this.env.BREVO_API_KEY && this.env.EMAIL_REMETENTE); }
  async enviarEmail(para, assunto, html) {
    if (this.hub.emailsTeste) { this.hub.emailsTeste.push({ para, assunto, html }); return true; } // testes
    if (smtpConfigurado(this.env)) {
      try { return await enviarSmtp(this.env, para, assunto, html); }
      catch (e) { console.error('e-mail: o SMTP falhou', String((e && e.message) || e).slice(0, 200)); if (!this.env.BREVO_API_KEY) return false; }
    }
    const chave = this.env.BREVO_API_KEY, de = this.env.EMAIL_REMETENTE;
    if (!chave || !de) return null; // ainda não configurado
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': chave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'Aero', email: de }, to: [{ email: para }], subject: assunto, htmlContent: html }),
    });
    if (!r.ok) console.error('e-mail: o Brevo recusou', r.status, (await r.text()).slice(0, 200));
    return r.ok;
  }

  // ---------- rotas sem login ----------
  async rotaPublica(rota, b, ip, hw = '') {
    if (rota === 'registrar') b._hw = hw;
    if (rota === 'registrar') return this.registrar(b, ip);
    if (rota === 'entrar') return this.entrar(b, ip, hw);
    if (rota === 'acesso/esqueci') return this.esqueci(b, ip);
    if (rota === 'acesso/email') return this.emailExiste(b, ip);
    if (rota === 'acesso/verificar') return this.verificar(b, ip);
    if (rota === 'acesso/redefinir') return this.redefinir(b, ip);
    if (rota === 'recuperar') return erro('Atualize o app: agora o código de acesso é redefinido pelo e-mail.', 410);
    if (rota === 'acesso/sal') return this.sal(b, ip);
    if (rota === 'qr/novo') return this.qrNovo(b, ip, hw);
    if (rota === 'qr/estado') return this.qrEstado(b, ip, hw);
    if (rota === 'qr/pedir') return this.qrPedir(b, ip, hw); // (1.0.0) o aparelho novo leu o QR (ou digitou o código) do aparelho logado
    return null;
  }
  // ---------- rotas com login ----------
  async rota(conta, rota, M, b) {
    if (rota === 'cofre' && M === 'GET') return resposta({ ...this.cofrePublico(conta), pacote: await this.abrirPacote(conta) });
    if (rota === 'cofre' && M === 'POST') return this.salvarCofre(conta, b);
    if (rota === 'acesso/trocar' && M === 'POST') return this.trocar(conta, b);
    if (rota === 'acesso/migrar' && M === 'POST') return this.migrar(conta, b);
    if (rota === 'acesso/email-pedir' && M === 'POST') return this.pedirEmail(conta, b);
    if (rota === 'acesso/email-confirmar' && M === 'POST') return this.confirmarEmail(conta, b);
    if (rota === 'acesso/senha' && M === 'POST') return this.definirSenha(conta, b);
    if (rota === 'qr/ver' && M === 'POST') return this.qrVer(conta, b);
    if (rota === 'qr/aprovar' && M === 'POST') return this.qrAprovar(conta, b);
    if (rota === 'qr/gerar' && M === 'POST') return this.qrGerar(conta, b); // (1.0.0) o aparelho logado mostra o QR e o código que muda
    if (rota === 'qr/meu' && M === 'POST') return this.qrMeu(conta, b);
    if (rota === 'qr/decidir' && M === 'POST') return this.qrDecidir(conta, b);
    if (rota === '2fa/iniciar' && M === 'POST') return this.iniciar2fa(conta);
    if (rota === '2fa/ativar' && M === 'POST') return this.ativar2fa(conta, b);
    if (rota === '2fa/desativar' && M === 'POST') return this.desativar2fa(conta, b);
    return null;
  }

  // ---------- 2FA ----------
  async guardarSegredo(conta, seg) { const { srv } = await this.chaves(), iv = crypto.getRandomValues(new Uint8Array(12)); return hex(iv) + '.' + hex(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('2fa:' + conta.id) }, srv, new TextEncoder().encode(seg)))); }
  async abrirSegredo(conta, w) {
    if (!w) return ''; const { srv } = await this.chaves(), [iv, ct] = w.split('.'); const de = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
    try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: de(iv), additionalData: new TextEncoder().encode('2fa:' + conta.id) }, srv, de(ct))); } catch (_) { return ''; }
  }
  async iniciar2fa(conta) {
    if (conta.totp && conta.totp.ativo) return erro('O 2FA já está ligado.');
    const seg = base32(crypto.getRandomValues(new Uint8Array(20)));
    conta.totpNovo = { w: await this.guardarSegredo(conta, seg), t: Date.now() };
    await this.st.put('c:' + conta.id, conta);
    const rotulo = encodeURIComponent('Aero:' + (conta.tag ? '#' + conta.tag : conta.nome));
    return resposta({ segredo: seg, uri: `otpauth://totp/${rotulo}?secret=${seg}&issuer=Aero&digits=6&period=30` });
  }
  async ativar2fa(conta, b) {
    if (!this.hub.limitar('2fa:' + conta.id, 10, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    const n = conta.totpNovo; if (!n || Date.now() - n.t > QUINZE_MIN) return erro('Comece de novo: o prazo acabou.');
    const seg = await this.abrirSegredo(conta, n.w);
    if (!seg || !(await totpConfere(seg, b.codigo))) return erro('Código errado. Confira o horário do celular e tente de novo.');
    conta.totp = { w: n.w, ativo: true, t: Date.now() }; delete conta.totpNovo;
    await this.st.put('c:' + conta.id, conta);
    return resposta({ ok: true });
  }
  async desativar2fa(conta, b) {
    if (!conta.totp || !conta.totp.ativo) return resposta({ ok: true });
    if (!this.hub.limitar('2fa:' + conta.id, 10, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    if (!(await totpConfere(await this.abrirSegredo(conta, conta.totp.w), b.codigo))) return erro('Código errado.');
    delete conta.totp; await this.st.put('c:' + conta.id, conta);
    return resposta({ ok: true });
  }

  // ---------- aparelho novo (0.6.0): IP, aparelho ou sistema que essa conta nunca usou pede um código por e-mail ----------
  async marcaAparelho(conta, meta) { return (await sha(conta.id + '|' + (meta.ip || '') + '|' + (meta.hw || '') + '|' + (meta.so || ''))).slice(0, 24); }
  async lembrarAparelho(conta, meta) { const m = await this.marcaAparelho(conta, meta); conta.conhecidos = [m, ...(conta.conhecidos || []).filter((x) => x !== m)].slice(0, 30); }
  emailConfigurado() { return this.env.VERIFICAR_APARELHO !== '0' && !!(this.hub.emailsTeste || this.emailPronto()); }

  cofrePublico(conta) {
    const k = conta.contaChave, c = conta.cofre || {};
    return { kid: k ? k.kid : null, pub: k ? k.pub : null, w1: c.w1 || null };
  }
  validarCofre(cf, { exigirW1 = true } = {}) {
    if (!cf || !/^[0-9a-f]{16}$/.test(String(cf.kid)) || !pubOk(cf.pub)) return 'Chave inválida.';
    if (exigirW1 && !cifraOk(cf.w1) && !cf.pacote) return 'Cofre inválido.';
    if (cf.w1 && !cifraOk(cf.w1)) return 'Cofre inválido.';
    return '';
  }
  async idConfere(cf) { return (await sha(cf.pub.x + '.' + cf.pub.y)).slice(0, 16) === cf.kid; }
  // põe a chave (e os cofres) na conta; uma chave NOVA guarda a antiga na lista (para abrir mensagens velhas)
  aplicarCofre(conta, cf) {
    const nova = !conta.contaChave || conta.contaChave.kid !== cf.kid;
    if (nova) {
      if (conta.contaChave) conta.contaAntigas = [{ kid: conta.contaChave.kid, pub: conta.contaChave.pub }, ...(conta.contaAntigas || [])].slice(0, 5);
      conta.contaChave = { kid: cf.kid, pub: { kty: 'EC', crv: 'P-256', x: cf.pub.x, y: cf.pub.y }, t: Date.now() };
      conta.cofre = {};
    }
    conta.cofre = conta.cofre || {};
    if (cf.w1) conta.cofre.w1 = { iv: cf.w1.iv, ct: cf.w1.ct };
    return nova;
  }
  // o pacote (as chaves da conta, abertas) só entra se a chave atual dele for a chave da conta
  async guardarPacote(conta, texto) {
    const p = this.validarPacote(texto);
    if (!p || !conta.contaChave || p.atual !== conta.contaChave.kid) return false;
    conta.cofre = conta.cofre || {}; conta.cofre.ws = await this.fecharPacote(conta, texto);
    return true;
  }

  async registrar(b, ip) {
    const H = this.hub;
    if (!H.limitar('reg:' + ip, 10, 3600000)) return erro('Muitas contas criadas daqui. Tente mais tarde.', 429);
    const nome = txt(b.nome, 24), email = txt(b.email, 80).toLowerCase(), acesso = String(b.acesso || '');
    if (nome.length < 2) return erro('Escreva um nome com pelo menos 2 letras.');
    if (!emailOk(email)) return erro('E-mail inválido.');
    if (!HEX64.test(acesso)) return erro('Atualize o app para criar uma conta.', 400);
    const cf = b.cofre, ruim = this.validarCofre(cf);
    if (ruim) return erro(ruim);
    if (!(await this.idConfere(cf))) return erro('Chave inválida.');
    if (await this.contaPorEmail(email)) return erro('Esse e-mail já tem conta. Use "Esqueci meu código".', 409);
    let tag = normalizarTag(b.tag);
    if (tag) {
      if (!TAG_REGEX.test(tag)) return erro(MSG_TAG);
      if (!(await H.tagLivre(tag))) return erro('Essa # já está em uso. Escolha outra.', 409);
    } else tag = await H.gerarTag(nome);
    const id = crypto.randomUUID(), ah = await sha(acesso), emailH = await this.emailH(email);
    let codigo;
    do { codigo = aleatorio(6); } while (await this.get('f:' + codigo));
    const conta = { id, codigo, nome, tag, avatarV: 0, emailC: await this.cifrarEmail(email), emailH, acessoH: ah, sv: 1, amigos: {}, criado: Date.now() };
    { const tv = Math.round(+b.termos || 0); if (tv >= 1 && tv <= 1000) { conta.termos = tv; conta.termosT = Date.now(); } } // (1.0.2) aceitou os termos ao criar a conta
    await this.lembrarAparelho(conta, { ip, hw: b._hw, so: txt(b.so, 16) });
    this.aplicarCofre(conta, cf);
    if (cf.pacote && !(await this.guardarPacote(conta, cf.pacote))) return erro('Chave inválida.');
    await this.st.put({ ['c:' + id]: conta, ['la:' + ah]: id, ['f:' + codigo]: id, ['eh:' + emailH]: id, ['t:' + tag.toLowerCase()]: id });
    try { await H.analytics.novaConta(); } catch (_) { /* ok */ } // (analytics.js) mais uma conta
    return resposta({ token: await H.novaSessao(conta, { ip }), codigo, nome, tag });
  }

  async entrar(b, ip, hw = '') {
    const H = this.hub;
    if (!H.limitar('ent:' + ip, 30, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    const acesso = String(b.acesso || '');
    if (!HEX64.test(acesso)) return erro('Atualize o app para entrar.', 400);
    const ah = await sha(acesso);
    let id = b.senhaDe ? null : await this.get('la:' + ah);
    let conta = id && (await this.get('c:' + id));
    if (b.senhaDe) { // (0.9.6) entrar com a # e a senha (o app manda só o hash da senha, nunca ela)
      const r = await this.contaPorSenha(b.senhaDe, ah);
      if (r === 'limite') return erro('Muitas tentativas nesta conta. Espere alguns minutos.', 429);
      if (!r) return erro('# ou senha errada.', 404);
      conta = r;
    } else if (!conta && b.loginId) { // conta de antes da 0.5.7: o servidor ainda tinha o código aberto; agora troca pelo hash e esquece o código
      const loginId = txt(b.loginId, 32).toUpperCase().replace(/\s/g, '');
      id = loginId && (await this.get('l:' + loginId));
      conta = id && (await this.get('c:' + id));
      if (conta && conta.loginId === loginId) await this.guardarAcesso(conta, ah);
      else conta = null;
    }
    if (!conta) return erro('Código de acesso não encontrado. Confira as letras e os números.', 404);
    conta = await this.arrumar(conta);
    const ban = await H.admin.banimento(conta, (await H.admin.cargo(conta)) ? null : ip, null);
    if (ban) return erro('Conta suspensa' + (ban.ate ? ' até ' + new Date(ban.ate).toLocaleString('pt-BR') : '') + (ban.motivo ? ': ' + ban.motivo : '.'), 403);
    // (0.6.0) 2FA: com o autenticador ligado, o código de 6 números dele é pedido em todo login
    const meta = { ip, hw, so: txt(b.so, 16) };
    const marca = await this.marcaAparelho(conta, meta);
    const r = await this.get('lv:' + conta.id);
    // (0.8.0) o autenticador já foi conferido neste aparelho e agora falta só o código do e-mail: não pede o autenticador de novo (antes o
    // app mandava só o código do e-mail, o servidor pedia o autenticador, e depois o e-mail outra vez: ficava num ciclo sem fim)
    const doisFeito = !!(b.codigoEmail && r && r.f2 && r.f2 === marca && Date.now() - r.t <= QUINZE_MIN);
    if (conta.totp && conta.totp.ativo && !doisFeito) {
      if (!b.totp) return resposta({ precisa: '2fa' });
      if (!H.limitar('tot:' + conta.id, 8, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
      if (!(await totpConfere(await this.abrirSegredo(conta, conta.totp.w), b.totp))) return erro('Código do autenticador errado.', 401);
    }
    // (0.6.0) IP, aparelho ou sistema novo: código por e-mail (se o servidor consegue mandar e-mail e a conta tem um)
    // conta de antes da 0.6.0 (ainda sem lista): o primeiro aparelho a entrar depois da atualização vira conhecido
    if (conta.conhecidos && !conta.conhecidos.includes(marca) && conta.emailC && this.emailConfigurado()) {
      if (!b.codigoEmail) {
        if (!H.limitar('lve:' + conta.id, 5, 900000)) return erro('Muitos pedidos. Espere alguns minutos.', 429);
        const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
        await this.st.put('lv:' + conta.id, { h: await sha(conta.id + ':' + marca + ':' + codigo), t: Date.now(), n: 0, f2: conta.totp && conta.totp.ativo ? marca : undefined }); // f2: o autenticador já passou neste aparelho
        const email = await this.abrirEmail(conta);
        const ok = await this.enviarEmail(email, 'Novo acesso ao Aero: ' + codigo,
          `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:18px;background:linear-gradient(180deg,#e9f6ff,#bfe3fb);color:#0c3a5c">
            <h2 style="margin:0 0 8px">Aero</h2>
            <p>Oi, ${conta.nome.replace(/[<>&]/g, '')}! Alguém está entrando na sua conta por um aparelho, rede ou sistema novo${meta.so ? ' (' + meta.so.replace(/[<>&]/g, '') + ')' : ''}.</p>
            <p>Se foi você, use este código:</p>
            <p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;margin:12px 0">${codigo}</p>
            <p style="font-size:13px">Vale por 15 minutos. Se NÃO foi você, troque o seu código de acesso em Configurações &gt; Conta.</p></div>`);
        if (ok === false) return erro('Não consegui mandar o e-mail de confirmação agora. Tente de novo em instantes.', 502);
        const [u, d] = email.split('@');
        return resposta({ precisa: 'email', email: u.slice(0, 2) + '•••@' + d });
      }
      if (!r || Date.now() - r.t > QUINZE_MIN || r.n >= 5) return erro('Código vencido. Peça um novo.', 400);
      if (r.h !== (await sha(conta.id + ':' + marca + ':' + String(b.codigoEmail).replace(/\D/g, '')))) { r.n++; await this.st.put('lv:' + conta.id, r); return erro('Código errado. Confira o e-mail.', 400); }
      await this.st.delete('lv:' + conta.id);
      conta.emailProva = conta.emailProva || Date.now();
    }
    await this.lembrarAparelho(conta, meta); await this.st.put('c:' + conta.id, conta);
    return resposta({ token: await H.novaSessao(conta, { ip }), codigo: conta.codigo, nome: conta.nome });
  }
  // ---------- (0.9.6) senha: um jeito a mais de entrar (o código de acesso continua valendo e é o padrão) ----------
  // A senha nunca sai do aparelho: ele deriva (PBKDF2, 310 mil voltas, com o "sal" desta conta) e manda só o resultado; o servidor guarda
  // o hash disso. O sal sai por esta rota pública com a #; para # sem senha (ou que nem existe) o sal é falso mas sempre o mesmo, e ninguém
  // descobre por aqui quem tem senha. Errar 10 vezes em 15 min trava as tentativas daquela conta (guardado: reiniciar não zera)
  normTag(t) { return String(t || '').trim().replace(/^#/, '').toLowerCase().slice(0, 20); }
  async sal(b, ip) {
    if (!this.hub.limitar('sal:' + ip, 60, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    const tag = this.normTag(b.tag); if (!/^[a-z0-9_.-]{3,20}$/.test(tag)) return erro('Digite a sua #.');
    const id = await this.get('t:' + tag), conta = id && (await this.get('c:' + id));
    if (conta && conta.senha) return resposta({ sal: conta.senha.sal });
    const { hmac } = await this.chaves();
    return resposta({ sal: hex(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode('sal:' + tag)))).slice(0, 32) });
  }
  async contaPorSenha(tagBruta, ah) {
    const tag = this.normTag(tagBruta); if (!/^[a-z0-9_.-]{3,20}$/.test(tag)) return null;
    const id = await this.get('t:' + tag), conta = id && (await this.get('c:' + id));
    if (!this.hub.limitar('sen:' + (id || tag), 10, 900000)) return 'limite';
    if (!conta || !conta.senha || !igual(conta.senha.h, ah)) return null;
    return conta;
  }
  async definirSenha(conta, b) {
    if (!this.hub.limitar('troca:' + conta.id, 5, 3600000)) return erro('Devagar! Tente mais tarde.', 429);
    if (b.remover) { delete conta.senha; await this.st.put('c:' + conta.id, conta); return resposta({ ok: true, senha: false }); }
    const sal = String(b.sal || ''), acesso = String(b.acesso || '');
    if (!/^[0-9a-f]{32}$/.test(sal) || !HEX64.test(acesso)) return erro('Senha inválida.');
    conta.senha = { sal, h: await sha(acesso), t: Date.now() };
    await this.st.put('c:' + conta.id, conta);
    return resposta({ ok: true, senha: true });
  }

  // ---------- (0.9.6) entrar por QR code: o aparelho novo mostra um QR (e um código curto) que troca a cada 5 minutos; um aparelho já
  // logado lê (ou digita o código) e aprova. O aparelho novo recebe a sessão sem ninguém digitar o código de acesso. A chave das
  // conversas chega depois pelo cofre da conta, como em qualquer login. Fica só na memória do servidor: ninguém guarda nada disso
  qrs() { if (!this._qr) this._qr = new Map(); return this._qr; }
  qrLimpar() { const m = this.qrs(), agora = Date.now(); for (const [k, r] of m) if (agora - r.t > QR_VIDA) m.delete(k); }
  async qrNovo(b, ip, hw) {
    if (!this.hub.limitar('qrn:' + ip, 40, 3600000)) return erro('Muitos pedidos. Espere alguns minutos.', 429);
    this.qrLimpar(); const m = this.qrs();
    if (m.size > 5000) return erro('Tente de novo em instantes.', 503);
    const ant = String(b.antigo || ''); if (m.has(ant) && m.get(ant).segH === (await sha(String(b.antigoSeg || '')))) m.delete(ant); // o QR anterior deste aparelho
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd = crypto.getRandomValues(new Uint8Array(8));
    const curto = Array.from(rnd, (x) => letras[x & 31]).join('');
    const seg = hex(crypto.getRandomValues(new Uint8Array(24)));
    m.set(curto, { segH: await sha(seg), t: Date.now(), ip, hw, so: txt(b.so, 16), maquina: txt(b.maquina, 40), conta: null });
    return resposta({ id: curto, seg, validade: QR_VIDA });
  }
  async qrEstado(b, ip, hw) {
    if (!this.hub.limitar('qre:' + ip, 600, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    const id = String(b.id || '').toUpperCase(), m = this.qrs(), r = m.get(id);
    if (!r || r.segH !== (await sha(String(b.seg || '')))) return resposta({ estado: 'venceu' });
    if (Date.now() - r.t > QR_VIDA) { m.delete(id); return resposta({ estado: 'venceu' }); }
    if (r.recusado) { m.delete(id); return resposta({ estado: 'recusado' }); }
    if (!r.conta) return resposta({ estado: 'espera' });
    m.delete(id);
    let conta = await this.get('c:' + r.conta); if (!conta) return resposta({ estado: 'venceu' });
    conta = await this.arrumar(conta);
    const ban = await this.hub.admin.banimento(conta, (await this.hub.admin.cargo(conta)) ? null : ip, hw || null);
    if (ban) return erro('Conta suspensa.', 403);
    await this.lembrarAparelho(conta, { ip, hw, so: r.so }); await this.st.put('c:' + conta.id, conta); // aprovado por um aparelho dela: vira conhecido
    return resposta({ estado: 'ok', token: await this.hub.novaSessao(conta, { ip }), codigo: conta.codigo, nome: conta.nome });
  }
  qrDe(conta, b) {
    const id = String(b.codigo || '').toUpperCase().replace(/^AERO-?QR[:-]?/, '').replace(/[^A-Z0-9]/g, '');
    const r = /^[A-Z0-9]{8}$/.test(id) && this.qrs().get(id);
    return r && Date.now() - r.t <= QR_VIDA && !r.conta && !r.recusado ? { id, r } : null;
  }
  async qrVer(conta, b) {
    if (!this.hub.limitar('qrv:' + conta.id, 30, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    const q = this.qrDe(conta, b); if (!q) return erro('Esse código venceu ou não existe. Confira no outro aparelho.', 404);
    return resposta({ so: q.r.so, maquina: q.r.maquina, quando: q.r.t });
  }
  async qrAprovar(conta, b) {
    if (!this.hub.limitar('qrv:' + conta.id, 30, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    const q = this.qrDe(conta, b); if (!q) return erro('Esse código venceu ou não existe. Confira no outro aparelho.', 404);
    if (b.recusar) q.r.recusado = true; else q.r.conta = conta.id;
    return resposta({ ok: true });
  }

  // ---------- (1.0.0) o contrário: o aparelho LOGADO mostra um QR e um código curto que muda a cada 30 s. O aparelho novo lê (ou digita) na
  // tela de entrar e o logado ainda confirma "entrar em tal aparelho?" (quem só viu a tela, numa transmissão por exemplo, não entra sozinho).
  // Cada código serve para um pedido só; tudo fica só na memória do servidor, como o QR antigo
  pares() { if (!this._par) this._par = new Map(); return this._par; }
  parLimpar() { const m = this.pares(), agora = Date.now(); for (const [k, r] of m) if (agora - r.t > (r.pedido ? QR_VIDA : QR_GIRO + QR_FOLGA)) m.delete(k); }
  async qrGerar(conta, b) {
    if (!this.hub.limitar('qrg:' + conta.id, 400, 3600000)) return erro('Muitos pedidos. Espere alguns minutos.', 429);
    this.parLimpar(); const m = this.pares();
    if (m.size > 5000) return erro('Tente de novo em instantes.', 503);
    const ant = String(b.antigo || ''), ra = m.get(ant); if (ra && ra.conta === conta.id && !ra.pedido) ra.t = Math.min(ra.t, Date.now() - QR_GIRO); // o anterior vale só a folga
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd = crypto.getRandomValues(new Uint8Array(8));
    const id = Array.from(rnd, (x) => letras[x & 31]).join('');
    m.set(id, { conta: conta.id, t: Date.now(), pedido: null });
    return resposta({ id, validade: QR_GIRO });
  }
  async qrPedir(b, ip, hw) {
    if (!this.hub.limitar('qrp:' + ip, 30, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    this.parLimpar();
    const cod = String(b.codigo || '').toUpperCase().replace(/^AERO-ENTRAR[:-]?/, '').replace(/[^A-Z0-9]/g, ''), par = /^[A-Z0-9]{8}$/.test(cod) && this.pares().get(cod);
    if (!par || par.pedido || Date.now() - par.t > QR_GIRO + QR_FOLGA) return erro('Esse código venceu ou não existe. Confira no outro aparelho.', 404);
    this.qrLimpar(); const m = this.qrs(); if (m.size > 5000) return erro('Tente de novo em instantes.', 503);
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', pid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => letras[x & 31]).join('');
    const seg = hex(crypto.getRandomValues(new Uint8Array(24)));
    m.set(pid, { segH: await sha(seg), t: Date.now(), ip, hw, so: txt(b.so, 16), maquina: txt(b.maquina, 40), conta: null });
    par.pedido = pid; par.t = Date.now();
    return resposta({ id: pid, seg, validade: QR_VIDA });
  }
  async qrMeu(conta, b) {
    if (!this.hub.limitar('qrm:' + conta.id, 900, 600000)) return erro('Muitos pedidos. Espere alguns minutos.', 429);
    const par = this.pares().get(String(b.id || '')); if (!par || par.conta !== conta.id) return resposta({ estado: 'venceu' });
    const r = par.pedido && this.qrs().get(par.pedido);
    if (!r) return resposta({ estado: par.pedido ? 'venceu' : 'espera' });
    return resposta({ estado: 'pedido', so: r.so, maquina: r.maquina });
  }
  async qrDecidir(conta, b) {
    const id = String(b.id || ''), par = this.pares().get(id); if (!par || par.conta !== conta.id || !par.pedido) return erro('Esse pedido venceu. Gere um QR novo.', 404);
    const r = this.qrs().get(par.pedido); this.pares().delete(id);
    if (!r) return erro('Esse pedido venceu. Gere um QR novo.', 404);
    if (b.sim === true) r.conta = conta.id; else r.recusado = true;
    return resposta({ ok: true });
  }

  async guardarAcesso(conta, ah) {
    if (conta.acessoH && conta.acessoH !== ah) await this.st.delete('la:' + conta.acessoH);
    if (conta.loginId) { await this.st.delete('l:' + conta.loginId); delete conta.loginId; }
    conta.acessoH = ah;
    await this.st.put({ ['la:' + ah]: conta.id, ['c:' + conta.id]: conta });
  }
  // aparelho já logado (antes da 0.5.7): manda o hash do código e o servidor apaga o código aberto
  async migrar(conta, b) {
    const acesso = String(b.acesso || '');
    if (!HEX64.test(acesso)) return erro('Acesso inválido.');
    if (conta.loginId || !conta.acessoH) await this.guardarAcesso(conta, await sha(acesso));
    return resposta({ ok: true });
  }
  // (0.7.8) trocar o e-mail: pede o código de acesso, confirma pelo código que chega no e-mail NOVO e avisa o e-mail antigo.
  // A confirmação é obrigatória: e-mail de desenvolvedor vale cargo (admin.js), então ninguém entra num e-mail que não é seu.
  async pedirEmail(conta, b) {
    if (!this.hub.limitar('temail:' + conta.id, 5, 3600000)) return erro('Muitos pedidos. Tente mais tarde.', 429);
    const email = txt(b.email, 80).toLowerCase(), acesso = String(b.acesso || '');
    if (!HEX64.test(acesso) || !conta.acessoH || (await sha(acesso)) !== conta.acessoH) return erro('Código de acesso incorreto.', 403);
    if (!emailOk(email)) return erro('E-mail inválido.');
    if ((await this.abrirEmail(conta)) === email) return erro('Esse já é o seu e-mail.');
    if (await this.contaPorEmail(email)) return erro('Esse e-mail já tem conta.', 409);
    if (!this.hub.emailsTeste && !this.emailPronto()) return erro('O envio de e-mails ainda não foi configurado no servidor. Fale com o Ryan.', 503);
    const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    await this.st.put('te:' + conta.id, { email, h: await sha(conta.id + ':' + email + ':' + codigo), t: Date.now(), n: 0 });
    const ok = await this.enviarEmail(email, 'Confirme seu novo e-mail no Aero: ' + codigo,
      `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:18px;background:linear-gradient(180deg,#e9f6ff,#bfe3fb);color:#0c3a5c">
        <h2 style="margin:0 0 8px">Aero</h2>
        <p>Oi, ${conta.nome.replace(/[<>&]/g, '')}! Para trocar o e-mail da sua conta para este endereço, use o código:</p>
        <p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;margin:12px 0">${codigo}</p>
        <p style="font-size:13px">Ele vale por 15 minutos. Se não foi você, ignore este e-mail: nada muda.</p></div>`);
    if (ok === false) return erro('Não consegui enviar o e-mail agora. Tente de novo em instantes.', 502);
    return resposta({ ok: true });
  }
  async confirmarEmail(conta, b) {
    const codigo = String(b.codigo || '').replace(/\D/g, ''), p = await this.get('te:' + conta.id);
    if (!p || Date.now() - p.t > QUINZE_MIN || p.n >= 5) return erro('Código vencido ou inválido. Peça um novo.', 400);
    if (p.h !== (await sha(conta.id + ':' + p.email + ':' + codigo))) { p.n++; await this.st.put('te:' + conta.id, p); return erro('Código errado. Confira o e-mail.', 400); }
    if (await this.contaPorEmail(p.email)) { await this.st.delete('te:' + conta.id); return erro('Esse e-mail já tem conta.', 409); }
    const antigo = await this.abrirEmail(conta), hNovo = await this.emailH(p.email);
    await this.st.delete('te:' + conta.id); if (conta.emailH) await this.st.delete('eh:' + conta.emailH); if (antigo) await this.st.delete('e:' + antigo);
    conta.emailC = await this.cifrarEmail(p.email); conta.emailH = hNovo; conta.emailProva = Date.now(); delete conta.email;
    await this.st.put({ ['c:' + conta.id]: conta, ['eh:' + hNovo]: conta.id });
    if (antigo) await this.enviarEmail(antigo, 'O e-mail da sua conta do Aero mudou',
      `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:18px;background:linear-gradient(180deg,#e9f6ff,#bfe3fb);color:#0c3a5c">
        <h2 style="margin:0 0 8px">Aero</h2>
        <p>Oi, ${conta.nome.replace(/[<>&]/g, '')}! O e-mail da sua conta acabou de ser trocado, e este endereço não está mais ligado a ela.</p>
        <p style="font-size:13px">Se foi você, está tudo certo. Se não foi, troque seu código de acesso agora e fale com o suporte.</p></div>`).catch(() => {});
    return resposta({ ok: true, email: p.email });
  }
  // trocar o código de acesso (com o app aberto): novo hash, cofre re-cifrado com o código novo; as outras sessões caem
  async trocar(conta, b) {
    const acesso = String(b.acesso || '');
    if (!HEX64.test(acesso)) return erro('Acesso inválido.');
    if (!this.hub.limitar('troca:' + conta.id, 5, 3600000)) return erro('Devagar! Tente mais tarde.', 429);
    const cf = b.cofre, ruim = this.validarCofre(cf);
    if (ruim) return erro(ruim);
    if (!conta.contaChave || conta.contaChave.kid !== cf.kid) return erro('A chave da conta mudou. Abra o app de novo.', 409);
    this.aplicarCofre(conta, cf);
    conta.sv = (conta.sv || 0) + 1;
    await this.guardarAcesso(conta, await sha(acesso));
    const token = await this.hub.novaSessao(conta);
    this.hub.derrubarOutros(conta.id, String(b._sid || '')); // (0.6.0) os outros aparelhos caem NA HORA; este reconecta com a sessão nova
    return resposta({ ok: true, token });
  }
  async salvarCofre(conta, b) {
    const cf = { ...b, kid: b.kid || (conta.contaChave && conta.contaChave.kid), pub: b.pub || (conta.contaChave && conta.contaChave.pub) };
    const ruim = this.validarCofre(cf, { exigirW1: !conta.contaChave });
    if (ruim) return erro(ruim);
    if (!(await this.idConfere(cf))) return erro('Chave inválida.');
    // chave NOVA só quando a atual nunca foi guardada no cofre (ficou presa num aparelho que não existe mais) e a pessoa pediu
    // (0.5.9-3: também quando o servidor ainda não tem o pacote e nenhum aparelho consegue abrir a chave antiga; o histórico volta pelos outros membros)
    const orfa = conta.contaChave && (!(conta.cofre && conta.cofre.w1) || !(conta.cofre && conta.cofre.ws));
    if (conta.contaChave && conta.contaChave.kid !== cf.kid && !(b.novaChave && orfa && (cf.w1 || b.pacote))) return erro('A conta já tem uma chave.', 409);
    const wsAntes = conta.cofre && conta.cofre.ws;
    const nova = this.aplicarCofre(conta, cf);
    if (!nova && wsAntes) conta.cofre.ws = wsAntes;
    if (b.pacote && !(await this.guardarPacote(conta, b.pacote))) return erro('Pacote de chaves inválido.');
    await this.st.put('c:' + conta.id, conta);
    this.hub.social.avisar([conta.id], { tipo: nova ? 'chave-conta-mudou' : 'cofre-mudou', kid: cf.kid });
    return resposta({ ok: true });
  }

  // ---------- esqueci o código: e-mail com um código de 6 números ----------
  async esqueci(b, ip) {
    const email = txt(b.email, 80).toLowerCase();
    if (!emailOk(email)) return erro('E-mail inválido.');
    if (!this.hub.limitar('esq:' + ip, 8, 3600000) || !this.hub.limitar('esqm:' + email, 3, 900000)) return erro('Muitos pedidos. Espere alguns minutos.', 429);
    const conta = await this.contaPorEmail(email);
    // (0.7.9) a resposta é a mesma com ou sem conta (e demora parecido): ninguém descobre aqui quem usa o Aero
    if (!conta) { await new Promise((ok) => setTimeout(ok, this.hub.emailsTeste ? 0 : 150 + Math.random() * 250)); return resposta({ ok: true }); }
    if (await this.recTravada(conta.id)) return resposta({ ok: true }); // (0.9.6) travada por códigos errados: não manda outro (e não conta que travou)
    if (!this.hub.emailsTeste && !this.emailPronto()) return erro('O envio de e-mails ainda não foi configurado no servidor. Fale com o Ryan.', 503);
    {
      const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
      await this.st.put('rc:' + conta.id, { h: await sha(conta.id + ':' + codigo), t: Date.now(), n: 0 });
      const ok = await this.enviarEmail(email, 'Seu código do Aero: ' + codigo,
        `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:18px;background:linear-gradient(180deg,#e9f6ff,#bfe3fb);color:#0c3a5c">
          <h2 style="margin:0 0 8px">Aero</h2>
          <p>Oi, ${conta.nome.replace(/[<>&]/g, '')}! Alguém (provavelmente você) pediu para redefinir o código de acesso da sua conta.</p>
          <p>Seu código de verificação é:</p>
          <p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;margin:12px 0">${codigo}</p>
          <p style="font-size:13px">Ele vale por 15 minutos. Se não foi você, ignore este e-mail: nada muda na sua conta.</p></div>`);
      if (ok === false) return erro('Não consegui enviar o e-mail agora. Tente de novo em instantes.', 502);
    }
    return resposta({ ok: true });
  }
  // (0.7.9) o app não pergunta mais se um e-mail tem conta (dava para descobrir quem usa o Aero). A rota fica para as versões antigas, sem dizer nada
  async emailExiste(b, ip) {
    const email = txt(b.email, 80).toLowerCase();
    if (!emailOk(email)) return erro('E-mail inválido.');
    if (!this.hub.limitar('emx:' + ip, 60, 600000)) return erro('Muitas consultas. Espere alguns minutos.', 429);
    return resposta({ existe: false });
  }
  // (0.9.6) o código de 6 números vence em 15 min e aceita 5 erros; somando todos os códigos pedidos, 20 erros em 24 h travam a
  // recuperação daquela conta por 24 h (fica no armazenamento: reiniciar o servidor não zera). Adivinhar por força bruta fica inviável
  async recTravada(id) { const f = await this.get('rcf:' + id); return !!(f && Date.now() - f.t < 86400000 && f.n >= 20); }
  async recErrou(id) {
    let f = await this.get('rcf:' + id);
    if (!f || Date.now() - f.t >= 86400000) f = { n: 0, t: Date.now() };
    f.n++; await this.st.put('rcf:' + id, f);
  }
  async verificar(b, ip) {
    const email = txt(b.email, 80).toLowerCase(), codigo = String(b.codigo || '').replace(/\D/g, '');
    // (0.7.9) também por e-mail: trocar de IP não dá mais tentativas contra a mesma conta
    if (!this.hub.limitar('ver:' + ip, 20, 3600000) || !this.hub.limitar('verm:' + email, 12, 3600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
    const conta = emailOk(email) && (await this.contaPorEmail(email));
    const r = conta && (await this.get('rc:' + conta.id));
    if (conta && (await this.recTravada(conta.id))) return erro('Muitos códigos errados nesta conta. Tente de novo amanhã.', 429);
    if (!r || Date.now() - r.t > QUINZE_MIN || r.n >= 5) return erro('Código vencido ou inválido. Peça um novo.', 400);
    if (r.h !== (await sha(conta.id + ':' + codigo))) { r.n++; await this.st.put('rc:' + conta.id, r); await this.recErrou(conta.id); return erro('Código errado. Confira o e-mail.', 400); }
    await this.st.delete(['rc:' + conta.id, 'rcf:' + conta.id]);
    if (!conta.emailProva) { conta.emailProva = Date.now(); await this.st.put('c:' + conta.id, conta); } // o código chegou no e-mail: ele é dela
    const ticket = hex(crypto.getRandomValues(new Uint8Array(24)));
    await this.st.put('rt:' + ticket, { id: conta.id, t: Date.now() });
    const cf = this.cofrePublico(conta);
    return resposta({ ticket, nome: conta.nome, codigo: conta.codigo, mantem: !!(conta.cofre && conta.cofre.ws && conta.contaChave), totp: !!(conta.totp && conta.totp.ativo), cofre: { kid: cf.kid, pub: cf.pub } });
  }
  async redefinir(b) {
    const t = String(b.ticket || ''), acesso = String(b.acesso || '');
    const r = /^[0-9a-f]{48}$/.test(t) && (await this.get('rt:' + t));
    if (!r || Date.now() - r.t > QUINZE_MIN) return erro('O prazo acabou. Comece de novo.', 400);
    if (!HEX64.test(acesso)) return erro('Acesso inválido.');
    let conta = await this.get('c:' + r.id);
    if (!conta) return erro('Conta não encontrada.', 404);
    // (0.7.9) quem ligou o 2FA não perde a conta só porque alguém entrou no e-mail dela: trocar o código também pede o autenticador
    if (conta.totp && conta.totp.ativo) {
      if (!this.hub.limitar('2fa:' + conta.id, 10, 600000)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
      if (!(await totpConfere(await this.abrirSegredo(conta, conta.totp.w), b.totp))) return erro('Código do autenticador errado.', 403);
    }
    const temPacote = !!(conta.cofre && conta.cofre.ws && conta.contaChave);
    const cf = b.cofre;
    if (!temPacote || cf) {
      const ruim = this.validarCofre(cf, { exigirW1: !temPacote });
      if (ruim) return erro(ruim);
      if (!(await this.idConfere(cf))) return erro('Chave inválida.');
      if (temPacote && cf.kid !== conta.contaChave.kid) return erro('A conta já tem uma chave.', 409);
    }
    await this.st.delete('rt:' + t);
    conta = await this.arrumar(conta);
    const ws = conta.cofre && conta.cofre.ws;
    const nova = cf ? this.aplicarCofre(conta, cf) : false;
    if (!nova && ws) conta.cofre.ws = ws;
    if (cf && cf.pacote) await this.guardarPacote(conta, cf.pacote);
    conta.sv = (conta.sv || 0) + 1; // quem estava logado com o código antigo sai
    delete conta.senha; // (0.9.6) recuperou pelo e-mail: uma senha que outra pessoa tenha posto não vale mais
    await this.guardarAcesso(conta, await sha(acesso));
    if (nova) this.hub.social.avisar([conta.id], { tipo: 'chave-conta-mudou', kid: cf.kid });
    try { // (0.7.9) a pessoa fica sabendo se não foi ela
      const email = await this.abrirEmail(conta);
      if (email) await this.enviarEmail(email, 'O código de acesso do Aero foi trocado',
        `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:18px;background:linear-gradient(180deg,#e9f6ff,#bfe3fb);color:#0c3a5c">
          <h2 style="margin:0 0 8px">Aero</h2>
          <p>Oi, ${conta.nome.replace(/[<>&]/g, '')}! O código de acesso da sua conta acabou de ser trocado e os outros aparelhos foram desconectados.</p>
          <p style="font-size:13px">Foi você? Pode ignorar este e-mail. Se não foi, peça um código novo em "Esqueci meu código" e troque a senha do seu e-mail.</p></div>`);
    } catch (_) { /* o aviso não pode atrapalhar a troca */ }
    return resposta({ token: await this.hub.novaSessao(conta), codigo: conta.codigo, nome: conta.nome, tag: conta.tag });
  }
}

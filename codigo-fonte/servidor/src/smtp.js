// (0.9.6) E-mail grátis: o servidor fala SMTP direto com o Gmail (ou outro provedor) por uma conexão TLS, sem API paga.
// Configure com:  wrangler secret put SMTP_USUARIO   (o endereço, ex.: aero.app@gmail.com)
//                 wrangler secret put SMTP_SENHA     (a "senha de app" de 16 letras do Google, não a senha da conta)
// Opcional: SMTP_HOST (padrão smtp.gmail.com) e SMTP_PORTA (padrão 465, TLS desde o começo). O Gmail grátis manda até ~500 por dia.

const b64 = (s) => { const b = new TextEncoder().encode(s); let t = ''; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(t); };
const linhas76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const semQuebra = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

export const smtpConfigurado = (env) => !!(env && env.SMTP_USUARIO && env.SMTP_SENHA);

export async function enviarSmtp(env, para, assunto, html, nome = 'Aero', conectar = null) {
  const usuario = semQuebra(env.SMTP_USUARIO), senha = String(env.SMTP_SENHA || '').replace(/\s/g, '');
  const host = semQuebra(env.SMTP_HOST) || 'smtp.gmail.com', porta = Number(env.SMTP_PORTA) || 465;
  para = semQuebra(para);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(para)) throw new Error('destinatário inválido');
  const connect = conectar || (await import('cloudflare:sockets')).connect; // (os testes passam uma conexão falsa)
  const sock = connect({ hostname: host, port: porta }, { secureTransport: 'on', allowHalfOpen: false });
  const w = sock.writable.getWriter(), r = sock.readable.getReader(), dec = new TextDecoder();
  let buf = '';
  const ler = async () => { // uma resposta inteira (as linhas "250-..." continuam até a "250 ...")
    const fim = Date.now() + 15000;
    for (;;) {
      const ls = buf.split('\r\n');
      for (let i = 0; i < ls.length - 1; i++) if (/^\d{3} /.test(ls[i]) || /^\d{3}$/.test(ls[i])) { buf = ls.slice(i + 1).join('\r\n'); return { cod: Number(ls[i].slice(0, 3)), txt: ls.slice(0, i + 1).join(' ') }; }
      if (Date.now() > fim) throw new Error('SMTP sem resposta');
      const { value, done } = await r.read();
      if (done) throw new Error('SMTP fechou a conexão');
      buf += dec.decode(value, { stream: true });
    }
  };
  const cmd = async (c, espera) => {
    if (c != null) await w.write(new TextEncoder().encode(c + '\r\n'));
    const x = await ler();
    if (!espera.includes(x.cod)) throw new Error('SMTP recusou (' + (c || 'saudação').split(' ')[0] + '): ' + x.txt.slice(0, 160));
    return x;
  };
  try {
    await cmd(null, [220]);
    await cmd('EHLO aero.workers.dev', [250]);
    await cmd('AUTH PLAIN ' + b64('\0' + usuario + '\0' + senha), [235]);
    await cmd('MAIL FROM:<' + usuario + '>', [250]);
    await cmd('RCPT TO:<' + para + '>', [250, 251]);
    await cmd('DATA', [354]);
    const dominio = usuario.split('@')[1] || 'aero';
    const msg = [
      'From: =?UTF-8?B?' + b64(nome) + '?= <' + usuario + '>',
      'To: <' + para + '>',
      'Subject: =?UTF-8?B?' + b64(semQuebra(assunto)) + '?=',
      'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
      'Message-ID: <' + crypto.randomUUID() + '@' + dominio + '>',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      linhas76(b64(html)),
    ].join('\r\n');
    await cmd(msg + '\r\n.', [250]); // o corpo é base64: nenhuma linha começa com "." (não precisa escapar)
    await cmd('QUIT', [221]).catch(() => {});
    return true;
  } finally {
    try { w.releaseLock(); r.releaseLock(); await sock.close(); } catch (_) { /* já fechou */ }
  }
}

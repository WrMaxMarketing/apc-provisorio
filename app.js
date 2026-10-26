import { PERGUNTAS, FAIXAS, NIVEIS, avaliar, cnpjValido, telLocal } from "/quiz.js";

const CFG = window.SITE_CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const digits = (v) => String(v || "").replace(/\D/g, "");
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));

// ---------- Meta Pixel + Google Ads + dataLayer + Clarity ----------
if (CFG.pixelId) {
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  fbq("init", CFG.pixelId);
  fbq("track", "PageView");
}
if (CFG.googleAdsId) {
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CFG.googleAdsId)}`;
  document.head.appendChild(tag);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", CFG.googleAdsId);
}
if (CFG.clarityId) {
  /* eslint-disable */
  (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",CFG.clarityId);
  /* eslint-enable */
}

// Página sem servidor: só Pixel no navegador (sem Conversions API)
const track = (evento, dados = {}, { custom = false, eventId = uid() } = {}) => {
  if (window.fbq) fbq(custom ? "trackCustom" : "track", evento, dados, { eventID: eventId });
  if (window.gtag) {
    gtag("event", evento, dados);
    // A conversão do Google Ads é o mesmo momento do "Lead" da Meta
    if (evento === "Lead" && CFG.googleAdsLeadLabel) gtag("event", "conversion", { send_to: `${CFG.googleAdsId}/${CFG.googleAdsLeadLabel}`, transaction_id: eventId });
  }
  (window.dataLayer = window.dataLayer || []).push({ event: evento, ...dados });
};
// Correspondência avançada (Meta) e conversões otimizadas (Google): cada plataforma criptografa o telefone/e-mail antes de enviar
const identificar = (lead) => {
  const tel = `55${lead.whatsapp}`;
  if (window.fbq && CFG.pixelId) fbq("init", CFG.pixelId, { ph: tel, ...(lead.email && { em: lead.email.toLowerCase() }), country: "br" });
  if (window.gtag) gtag("set", "user_data", { phone_number: `+${tel}`, ...(lead.email && { email: lead.email.toLowerCase() }) });
};
track("ViewContent", { content_name: "LP Trabalhista - diagnóstico" });

// ---------- máscaras ----------
const maskTel = (v) => {
  const d = telLocal(v);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return d.replace(/^(\d{2})(\d+)/, "($1) $2");
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
};
const maskCnpj = (v) => digits(v).slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2")
  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2")
  .replace(/(\d{4})(\d)/, "$1-$2");
$$('[data-mask="tel"]').forEach((i) => i.addEventListener("input", () => (i.value = maskTel(i.value))));
$$('[data-mask="cnpj"]').forEach((i) => i.addEventListener("input", () => (i.value = maskCnpj(i.value))));

// ---------- quiz ----------
const quizCard = $("#quiz");
const steps = Object.fromEntries($$(".q-step", quizCard).map((el) => [el.dataset.step, el]));
const estado = { i: 0, etapa: "perguntas", respostas: {}, iniciou: false, lead: null };
let avancoPendente = null;

// Guarda só o progresso do quiz (nunca os dados pessoais) para sobreviver a um F5
const SALVO = "diag_progresso";
const salvar = () => { try { sessionStorage.setItem(SALVO, JSON.stringify({ i: estado.i, etapa: estado.etapa, respostas: estado.respostas })); } catch { /* sem storage */ } };
const carregar = () => { try { return JSON.parse(sessionStorage.getItem(SALVO) || "null"); } catch { return null; } };

const mostrarEtapa = (nome) => {
  for (const [k, el] of Object.entries(steps)) el.hidden = k !== nome;
  const titulo = $(".q-text", steps[nome]);
  if (titulo) titulo.focus({ preventScroll: true });
  const topo = quizCard.getBoundingClientRect().top;
  // Formulário e resultado sempre sobem para o topo: no celular o botão do WhatsApp fica na primeira tela
  if (nome !== "perguntas" || topo < 70 || topo > window.innerHeight * 0.6) quizCard.scrollIntoView({ behavior: "smooth", block: "start" });
};

$("#q-total").textContent = PERGUNTAS.length;
const renderPergunta = () => {
  const p = PERGUNTAS[estado.i];
  $("#q-num").textContent = estado.i + 1;
  $("#q-progress").style.width = `${(estado.i / PERGUNTAS.length) * 100}%`;
  $("#q-texto").textContent = p.texto;
  $("#q-voltar").hidden = estado.i === 0;
  const box = $("#q-opcoes");
  box.innerHTML = "";
  for (const op of p.opcoes) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "q-opt";
    b.dataset.v = op.v;
    b.textContent = op.rotulo;
    b.setAttribute("aria-pressed", String(estado.respostas[p.id] === op.v));
    b.addEventListener("click", () => responder(p, op.v, b));
    box.appendChild(b);
  }
};

// Toda troca de pergunta/etapa passa por aqui: o botão Voltar do navegador volta um passo em vez de sair da página
const irPara = (i, etapa, { push = true } = {}) => {
  if (etapa === "resultado" && !estado.lead) etapa = "captura";
  estado.i = i;
  estado.etapa = etapa;
  if (etapa === "perguntas") renderPergunta();
  mostrarEtapa(etapa);
  salvar();
  if (push) history.pushState({ i, etapa }, "");
};
window.addEventListener("popstate", (e) => {
  clearTimeout(avancoPendente);
  avancoPendente = null;
  const s = e.state || { i: 0, etapa: "perguntas" };
  irPara(s.i, s.etapa, { push: false });
});

const responder = (p, v, botao) => {
  if (avancoPendente) return;
  estado.respostas[p.id] = v;
  salvar();
  $$(".q-opt", $("#q-opcoes")).forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
  if (!estado.iniciou) {
    estado.iniciou = true;
    track("QuizStart", { content_name: "Diagnóstico trabalhista" }, { custom: true });
  }
  avancoPendente = setTimeout(() => {
    avancoPendente = null;
    if (estado.i < PERGUNTAS.length - 1) irPara(estado.i + 1, "perguntas");
    else irPara(estado.i, "captura");
  }, 240);
};

$("#q-voltar").addEventListener("click", () => {
  // Cancela o avanço automático da resposta que acabou de ser tocada
  clearTimeout(avancoPendente);
  avancoPendente = null;
  if (estado.i > 0) irPara(estado.i - 1, "perguntas");
});
$("#q-revisar").addEventListener("click", () => irPara(PERGUNTAS.length - 1, "perguntas"));

// Retoma de onde parou depois de um F5
const salvo = carregar();
if (salvo && salvo.respostas) {
  estado.respostas = salvo.respostas;
  estado.iniciou = Object.keys(salvo.respostas).length > 0;
  const completo = PERGUNTAS.every((p) => p.id in salvo.respostas);
  estado.i = Math.min(salvo.i || 0, PERGUNTAS.length - 1);
  estado.etapa = completo && salvo.etapa !== "perguntas" ? "captura" : "perguntas";
}
renderPergunta();
if (estado.etapa !== "perguntas") mostrarEtapa(estado.etapa);
history.replaceState({ i: estado.i, etapa: estado.etapa }, "");

// ---------- captura ----------
const form = $("#form-lead");
const selFaixa = $("#l-faixa");
for (const f of FAIXAS) selFaixa.add(new Option(f.rotulo, f.v));

// CNPJ → confirma a razão social (se a consulta falhar ou demorar, o formulário segue normalmente)
const cnpjInfo = $("#cnpj-info");
let razaoSocial = "";
let ultimoCnpj = "";
form.cnpj.addEventListener("input", async () => {
  const c = digits(form.cnpj.value);
  if (c.length < 14) { cnpjInfo.textContent = ""; cnpjInfo.className = "cnpj-info"; razaoSocial = ""; ultimoCnpj = ""; return; }
  if (c === ultimoCnpj) return;
  ultimoCnpj = c;
  razaoSocial = "";
  if (!cnpjValido(c)) { cnpjInfo.textContent = ""; validar(form.cnpj); return; }
  validar(form.cnpj);
  cnpjInfo.textContent = "Consultando…";
  cnpjInfo.className = "cnpj-info";
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`, AbortSignal.timeout ? { signal: AbortSignal.timeout(6000) } : {}).then((x) => x.json());
    if (c !== ultimoCnpj) return;
    if (r.razao_social) {
      razaoSocial = r.razao_social;
      cnpjInfo.textContent = `✓ ${r.razao_social}`;
      cnpjInfo.className = "cnpj-info ok";
    } else { cnpjInfo.textContent = ""; }
  } catch { if (c === ultimoCnpj) cnpjInfo.textContent = ""; }
});

// Erro embaixo de cada campo: aparece ao sair do campo e some assim que for corrigido
const REGRAS = {
  nome: (el) => el.value.trim().length >= 3 || "Informe seu nome.",
  whatsapp: (el) => telLocal(el.value).length >= 10 || "Informe o WhatsApp com DDD.",
  email: (el) => !el.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim()) || "Confira o e-mail (ex.: nome@empresa.com) ou deixe em branco.",
  cnpj: (el) => cnpjValido(el.value) || "Confira o CNPJ: são 14 números.",
  faixa: (el) => !!el.value || "Escolha o número de funcionários.",
  lgpd: (el) => el.checked || "Marque a autorização para ver o resultado.",
};
const validar = (el) => {
  const r = REGRAS[el.name](el);
  const ok = r === true;
  el.setAttribute("aria-invalid", String(!ok));
  $(`#e-${el.name}`).textContent = ok ? "" : r;
  return ok;
};
for (const nome of Object.keys(REGRAS)) {
  const el = form.elements[nome];
  el.addEventListener("blur", () => { if (el.value || el.hasAttribute("aria-invalid")) validar(el); });
  el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => { if (el.getAttribute("aria-invalid") === "true") validar(el); });
}

// Lead salvo por e-mail (FormSubmit) no envio do formulário: não depende de a pessoa mandar a mensagem no WhatsApp
let leadContado = false;
const enviarLead = (dados) => {
  if (!CFG.leadEmail) return Promise.resolve(false);
  return fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CFG.leadEmail)}`, {
    method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ _subject: `Novo lead do diagnóstico: ${dados.Resultado} · ${dados.Empresa}`, _template: "table", _captcha: "false", ...dados }),
  }).then((r) => r.ok).catch(() => false);
};

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = $(".msg", form);
  const invalidos = Object.keys(REGRAS).map((n) => form.elements[n]).filter((el) => !validar(el));
  if (invalidos.length) {
    msg.className = "msg err";
    msg.textContent = invalidos.length === 1 ? "Corrija o campo marcado." : `Corrija os ${invalidos.length} campos marcados.`;
    invalidos[0].focus();
    return;
  }
  msg.className = "msg";
  msg.textContent = "";
  estado.lead = { id: uid(), email: form.email.value.trim(), whatsapp: telLocal(form.whatsapp.value), nome: form.nome.value.trim() };
  const resultado = avaliar(estado.respostas, form.faixa.value);
  if (window.clarity) clarity("set", "risco", resultado.nivel);
  const faixaRotulo = (FAIXAS.find((f) => f.v === form.faixa.value) || {}).rotulo || "";
  enviarLead({
    Nome: estado.lead.nome, WhatsApp: maskTel(estado.lead.whatsapp), "E-mail": estado.lead.email || "(não informado)",
    Empresa: razaoSocial || "(não consultada)", CNPJ: maskCnpj(form.cnpj.value), Porte: faixaRotulo,
    Resultado: NIVEIS[resultado.nivel].rotulo, "Pontos de atenção": resultado.pontosAtencao.join(" | ") || "nenhum", Página: location.href,
  }).then((ok) => {
    if (ok && !leadContado) {
      leadContado = true;
      identificar(estado.lead);
      track("Lead", { content_name: "Diagnóstico trabalhista", risco: resultado.nivel, funcionarios: form.faixa.value }, { eventId: estado.lead.id });
    }
  });
  renderResultado(resultado, form.faixa.value);
});

// ---------- resultado + roteamento ----------
const waLink = (texto) => `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(texto)}`;
const icone = (id, t = 18) => `<svg width="${t}" height="${t}" aria-hidden="true"><use href="#${id}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const itemPonto = (t) => {
  const [tema, ...resto] = t.split(": ");
  return `<li>${icone("i-alert", 18)}<span><b>${esc(tema)}:</b> ${esc(resto.join(": "))}</span></li>`;
};

// O convite muda conforme o risco: quem está bem também tem um motivo para conversar
const CONVITE = {
  alto: "Falta 1 passo: fale com a equipe do escritório",
  moderado: "Falta 1 passo: tire suas dúvidas com a equipe",
  baixo: "Quer confirmar que está tudo em dia?",
};
// Celular e notebook 1366x768: só 1 ponto cabe antes do botão do WhatsApp
const visiveis = () => (matchMedia("(max-width: 768px), (min-width: 981px) and (max-height: 820px)").matches ? 1 : 2);

function renderResultado(res, faixa) {
  const faixaRotulo = (FAIXAS.find((f) => f.v === faixa) || {}).rotulo || "";
  const empresa = razaoSocial || maskCnpj(form.cnpj.value);
  const nivelTxt = NIVEIS[res.nivel].rotulo.toLowerCase();

  $("#r-empresa").textContent = empresa;
  $("#r-titulo").textContent = NIVEIS[res.nivel].rotulo;
  $("#r-texto").textContent = NIVEIS[res.nivel].texto;
  steps.resultado.dataset.nivel = res.nivel;
  $$("#r-meter span").forEach((s) => s.classList.toggle("on", s.dataset.n === res.nivel));

  // Entrega um pouco de valor antes do pedido: 2 pontos, o convite e o resto sob "ver mais"
  const pontos = res.pontosAtencao;
  $("#r-sub").hidden = !pontos.length;
  $("#r-pontos").innerHTML = pontos.slice(0, visiveis()).map(itemPonto).join("");
  const mais = $("#r-mais");
  const resto = pontos.slice(visiveis());
  mais.hidden = !resto.length;
  mais.open = false;
  $("summary", mais).textContent = `Ver mais ${resto.length} ${resto.length === 1 ? "ponto" : "pontos"} de atenção`;
  $("ul", mais).innerHTML = resto.map(itemPonto).join("");

  const texto = [
    "Olá! Fiz o diagnóstico trabalhista no site.",
    `Nome: ${estado.lead.nome}`,
    `WhatsApp: ${maskTel(estado.lead.whatsapp)}`,
    estado.lead.email && `E-mail: ${estado.lead.email}`,
    `Empresa: ${empresa} (CNPJ ${maskCnpj(form.cnpj.value)})`,
    `Porte: ${faixaRotulo}`,
    `Resultado: ${nivelTxt}`,
    "Quero entender como funciona a assessoria preventiva.",
  ].filter(Boolean).join("\n");
  const next = $("#r-next");
  next.innerHTML = `<h3>${CONVITE[res.nivel]}</h3>
    <a class="btn btn-wpp btn-block" href="${waLink(texto)}" target="_blank" rel="noopener" data-contact>${icone("i-wpp", 20)}Enviar diagnóstico no WhatsApp</a>`;
  $("[data-contact]", next).addEventListener("click", () => {
    // Sem e-mail de leads configurado (ou se o envio falhou), o toque no WhatsApp é a conversão
    if (!leadContado) {
      leadContado = true;
      identificar(estado.lead);
      track("Lead", { content_name: "Diagnóstico trabalhista", risco: res.nivel, funcionarios: faixa }, { eventId: estado.lead.id });
    }
    track("Contact", { content_name: "WhatsApp diagnóstico", risco: res.nivel });
  });

  irPara(estado.i, "resultado");
}

$("#r-refazer").addEventListener("click", () => {
  estado.respostas = {};
  estado.lead = null;
  leadContado = false;
  form.lgpd.checked = false;
  irPara(0, "perguntas");
});

const ano = $("#ano");
if (ano) ano.textContent = new Date().getFullYear();

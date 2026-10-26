// Diagnóstico de risco trabalhista — regras únicas, usadas no navegador (app.js) e no servidor (server.js).
// Mudou pergunta, peso ou faixa? Mude só aqui: os dois lados recalculam igual.
//
// Pontuação: resposta ideal = 0, intermediária = 1, ruim = 2 (máximo 16).
// Nível: até 3 = baixo · 4 a 8 = moderado · 9 ou mais = alto.
// Roteamento (planejamento WRMax, LP Trabalhista item 6):
//   risco alto OU 20+ funcionários -> WhatsApp da equipe comercial
//   1 a 9 funcionários (sem risco alto) -> kit trabalhista + canal
//   10 a 19 funcionários (sem risco alto) -> WhatsApp (o planejamento não define essa faixa)

const PADRAO = [
  { v: "sim", rotulo: "Sim", pontos: 0 },
  { v: "parcial", rotulo: "Parcial", pontos: 1 },
  { v: "nao", rotulo: "Não", pontos: 2 },
];

export const PERGUNTAS = [
  {
    id: "jornada",
    texto: "Todos os funcionários têm controle de jornada assinado?",
    opcoes: PADRAO,
    alertas: {
      nao: "Controle de jornada: sem registro assinado, a empresa fica sem como provar os horários praticados se alguém pedir horas extras na Justiça.",
      parcial: "Controle de jornada: há funcionários sem registro assinado. Basta um caso sem controle para a empresa ficar sem prova sobre os horários.",
    },
  },
  {
    id: "horas_extras",
    texto: "Horas extras e banco de horas têm acordo por escrito?",
    opcoes: PADRAO,
    alertas: {
      nao: "Horas extras e banco de horas: sem acordo escrito, a compensação pode ser questionada e as horas cobradas como extras.",
      parcial: "Horas extras e banco de horas: acordos incompletos ou desatualizados deixam parte da compensação sem respaldo.",
    },
  },
  {
    id: "rescisoes",
    texto: "As rescisões são conferidas juridicamente antes do pagamento?",
    opcoes: PADRAO,
    alertas: {
      nao: "Rescisões: pagar sem conferência aumenta a chance de erro em verbas e prazos, e esses erros costumam virar pedido em ação trabalhista.",
      parcial: "Rescisões: quando só alguns desligamentos são conferidos, os que passam no automático concentram o risco.",
    },
  },
  {
    id: "advertencias",
    texto: "Advertências e suspensões são registradas por escrito?",
    opcoes: PADRAO,
    alertas: {
      nao: "Advertências e suspensões: sem registro escrito, fica difícil sustentar uma justa causa ou mostrar o histórico do funcionário.",
      parcial: "Advertências e suspensões: registros que dependem de quem aplica deixam lacunas justamente nos casos mais sensíveis.",
    },
  },
  {
    id: "funcoes",
    texto: "Contratos e funções batem com o que o funcionário faz de fato?",
    opcoes: PADRAO,
    alertas: {
      nao: "Contratos e funções: quando o contrato não reflete o trabalho real, abre espaço para pedidos de desvio ou acúmulo de função e de equiparação salarial.",
      parcial: "Contratos e funções: cargos que mudaram na prática sem atualizar o contrato são uma fonte comum de discussão.",
    },
  },
  {
    id: "nr1",
    texto: "A empresa está adequada à NR-1 / PGR?",
    opcoes: PADRAO,
    alertas: {
      nao: "NR-1 / PGR: o gerenciamento de riscos ocupacionais é exigido da maioria das empresas e, desde a atualização da NR-1, inclui os riscos psicossociais. A falta de adequação pode gerar autuação.",
      parcial: "NR-1 / PGR: um programa desatualizado pode não cobrir os riscos psicossociais, que passaram a fazer parte do gerenciamento de riscos com a atualização da NR-1.",
    },
  },
  {
    id: "processo_recente",
    texto: "Recebeu processo trabalhista nos últimos 3 anos?",
    // Pergunta invertida: "Sim" é o pior cenário. "Não sei" ocupa o lugar de "Parcial".
    opcoes: [
      { v: "sim", rotulo: "Sim", pontos: 2 },
      { v: "nao_sei", rotulo: "Não sei", pontos: 1 },
      { v: "nao", rotulo: "Não", pontos: 0 },
    ],
    alertas: {
      sim: "Histórico de processos: uma ação recente costuma indicar uma rotina que pode se repetir com outros funcionários. Vale entender a causa.",
      nao_sei: "Histórico de processos: não saber se houve ação recente já é um ponto de atenção. Esse acompanhamento deveria fazer parte da rotina.",
    },
  },
  {
    id: "acompanhamento",
    texto: "Existe acompanhamento jurídico trabalhista contínuo hoje?",
    opcoes: PADRAO,
    alertas: {
      nao: "Acompanhamento jurídico: sem apoio contínuo, decisões do dia a dia do RH são tomadas sem revisão, e o passivo só aparece quando chega o processo.",
      parcial: "Acompanhamento jurídico: o suporte só em situações pontuais costuma chegar depois que o problema já existe.",
    },
  },
];

// Ordem de desempate dos pontos de atenção (mais sensíveis primeiro)
const PRIORIDADE = ["processo_recente", "jornada", "rescisoes", "horas_extras", "nr1", "funcoes", "advertencias", "acompanhamento"];

export const FAIXAS = [
  { v: "1-9", rotulo: "1 a 9 funcionários", min: 1 },
  { v: "10-19", rotulo: "10 a 19 funcionários", min: 10 },
  { v: "20-49", rotulo: "20 a 49 funcionários", min: 20 },
  { v: "50-99", rotulo: "50 a 99 funcionários", min: 50 },
  { v: "100+", rotulo: "100 ou mais funcionários", min: 100 },
];

export const NIVEIS = {
  baixo: {
    rotulo: "Risco baixo",
    texto: "Pelas suas respostas, a empresa tem boa parte das rotinas documentadas. O cuidado agora é manter tudo atualizado conforme a equipe cresce.",
  },
  moderado: {
    rotulo: "Risco moderado",
    texto: "Há rotinas importantes sem documentação completa. Pontos assim costumam aparecer só quando um processo chega.",
  },
  alto: {
    rotulo: "Risco alto",
    texto: "Várias rotinas que costumam ser discutidas em ações trabalhistas estão sem documentação ou sem acompanhamento. Vale olhar para esses pontos com prioridade.",
  },
};

const MANUTENCAO = [
  "Revisão periódica: rotinas bem documentadas hoje podem ficar desatualizadas com novas contratações e mudanças na legislação.",
  "Prova organizada: guarde controles, acordos e registros de forma que possam ser encontrados com rapidez se um dia forem necessários.",
];

/** respostas: { [idPergunta]: valorOpcao } · faixa: valor de FAIXAS. Retorna null se faltar algo. */
export function avaliar(respostas, faixa) {
  if (!respostas || typeof respostas !== "object") return null;
  let pontos = 0;
  const atencao = [];
  for (const p of PERGUNTAS) {
    const op = p.opcoes.find((o) => o.v === respostas[p.id]);
    if (!op) return null;
    pontos += op.pontos;
    if (op.pontos > 0 && p.alertas[op.v]) atencao.push({ id: p.id, pontos: op.pontos, texto: p.alertas[op.v] });
  }
  const nivel = pontos >= 9 ? "alto" : pontos >= 4 ? "moderado" : "baixo";

  atencao.sort((a, b) => b.pontos - a.pontos || PRIORIDADE.indexOf(a.id) - PRIORIDADE.indexOf(b.id));
  const pontosAtencao = atencao.slice(0, 3).map((a) => a.texto);
  for (const m of MANUTENCAO) if (pontosAtencao.length < 2) pontosAtencao.push(m);

  const f = FAIXAS.find((x) => x.v === faixa);
  const rota = nivel === "alto" || !f || f.min >= 10 ? "whatsapp" : "kit";

  return { pontos, maximo: PERGUNTAS.length * 2, nivel, rotulo: NIVEIS[nivel].rotulo, pontosAtencao, rota };
}

export function cnpjValido(v) {
  const c = String(v || "").replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base) => { let s = 0, p = base.length - 7; for (const n of base) { s += +n * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dv(c.slice(0, 12));
  return c.endsWith(`${d1}${dv(c.slice(0, 12) + d1)}`);
}

// Tira o +55 e o 0 de operadora que o preenchimento automático do celular costuma colocar
export function telLocal(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 11);
}

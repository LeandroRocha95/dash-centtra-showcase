// SAZONALIDADE — a data que o gestor cadastra. Puro.
//
// O calendário base é código curado; isto aqui é o que vem de um formulário, e
// por isso é o único lugar do módulo que precisa desconfiar da entrada.

import type { RegraData } from './datas'

/** O que o formulário entrega. Tudo texto ou número solto — nada é confiável. */
export type FormaDataPropria = {
  nome: string
  tipo: 'fixa' | 'unica' | 'enesimo'
  diaDoMes?: number
  mes?: number
  ano?: number
  dow?: number
  n?: number
  preparo: number
  acao?: string | null
}

export type DataPropriaValida = { nome: string; regra: RegraData; preparo: number; acao: string | null }
export type Validacao = { ok: true; valor: DataPropriaValida } | { ok: false; erro: string }

export const NOME_MAX = 80
export const ACAO_MAX = 240
/** Igual ao CHECK de `client_seasonal_dates`: a validação e o banco não podem discordar. */
export const PREPARO_MIN = 1
export const PREPARO_MAX = 180

/**
 * Os dias da semana em ISO (1 = segunda). O gênero não é preciosismo: em
 * português o ordinal concorda com o dia — "a segunda quinta-feira", mas "o
 * segundo sábado" — e errar isso num texto que o gestor lê toda semana é o
 * tipo de detalhe que faz a tela parecer escrita por máquina.
 */
export const DIAS_DA_SEMANA: { dow: number; label: string; genero: 'f' | 'm' }[] = [
  { dow: 1, label: 'segunda-feira', genero: 'f' },
  { dow: 2, label: 'terça-feira', genero: 'f' },
  { dow: 3, label: 'quarta-feira', genero: 'f' },
  { dow: 4, label: 'quinta-feira', genero: 'f' },
  { dow: 5, label: 'sexta-feira', genero: 'f' },
  { dow: 6, label: 'sábado', genero: 'm' },
  { dow: 7, label: 'domingo', genero: 'm' },
]

const ORDINAIS = {
  f: ['primeira', 'segunda', 'terceira', 'quarta'],
  m: ['primeiro', 'segundo', 'terceiro', 'quarto'],
}

export const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const bissexto = (ano: number): boolean => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
const diasNoMes = (mes: number, ano: number): number =>
  [31, bissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]

const inteiro = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) ? v : null

export function validarDataPropria(f: FormaDataPropria): Validacao {
  const nome = (f.nome ?? '').trim().replace(/\s+/g, ' ')
  if (nome.length < 2) return { ok: false, erro: 'Dê um nome à data.' }
  if (nome.length > NOME_MAX) return { ok: false, erro: `O nome passa de ${NOME_MAX} caracteres.` }

  const preparo = inteiro(f.preparo)
  if (preparo === null || preparo < PREPARO_MIN || preparo > PREPARO_MAX) {
    return { ok: false, erro: `A antecedência precisa ser um número de ${PREPARO_MIN} a ${PREPARO_MAX} dias.` }
  }

  const acaoBruta = (f.acao ?? '').trim()
  if (acaoBruta.length > ACAO_MAX) return { ok: false, erro: `A observação passa de ${ACAO_MAX} caracteres.` }
  const acao = acaoBruta || null

  const mes = inteiro(f.mes)
  if (mes === null || mes < 1 || mes > 12) return { ok: false, erro: 'Escolha o mês.' }

  if (f.tipo === 'fixa' || f.tipo === 'unica') {
    const diaDoMes = inteiro(f.diaDoMes)
    if (diaDoMes === null || diaDoMes < 1) return { ok: false, erro: 'Escolha o dia.' }

    if (f.tipo === 'unica') {
      const ano = inteiro(f.ano)
      if (ano === null || ano < 2024 || ano > 2100) return { ok: false, erro: 'Informe um ano entre 2024 e 2100.' }
      if (diaDoMes > diasNoMes(mes, ano)) {
        return { ok: false, erro: `${MESES_LONGOS[mes - 1]} de ${ano} não tem dia ${diaDoMes}.` }
      }
      return { ok: true, valor: { nome, regra: { tipo: 'unica', ano, mes, diaDoMes }, preparo, acao } }
    }

    // Data que se repete todo ano: o dia tem que existir em QUALQUER ano, e é
    // por isso que 29 de fevereiro é recusado aqui e aceito como data única.
    // Em ano comum ele viraria 1º de março em silêncio — e uma data que se
    // move sozinha é pior que uma data recusada.
    if (diaDoMes > 28 && mes === 2) {
      return { ok: false, erro: 'Fevereiro tem 29 dias só em ano bissexto. Cadastre como data única, ou use 28.' }
    }
    if (diaDoMes > diasNoMes(mes, 2027)) {
      return { ok: false, erro: `${MESES_LONGOS[mes - 1]} não tem dia ${diaDoMes}.` }
    }
    return { ok: true, valor: { nome, regra: { tipo: 'fixa', mes, diaDoMes }, preparo, acao } }
  }

  const dow = inteiro(f.dow)
  if (dow === null || dow < 1 || dow > 7) return { ok: false, erro: 'Escolha o dia da semana.' }
  const n = inteiro(f.n)
  // Até a quarta ocorrência, e não a quinta: todo mês tem quatro de cada dia da
  // semana, mas nem todo mês tem cinco. A quinta transbordaria para o mês
  // seguinte sem avisar — a regra devolveria uma data, só que a errada.
  if (n === null || n < 1 || n > 4) return { ok: false, erro: 'Escolha da primeira à quarta ocorrência do mês.' }
  return { ok: true, valor: { nome, regra: { tipo: 'enesimo', mes, dow, n }, preparo, acao } }
}

/** A regra em uma linha de português, para a lista de datas do cliente. */
export function descreverRegra(regra: RegraData): string {
  if (regra.tipo === 'fixa') return `todo ano em ${regra.diaDoMes} de ${MESES_LONGOS[regra.mes - 1]}`
  if (regra.tipo === 'unica') return `${regra.diaDoMes} de ${MESES_LONGOS[regra.mes - 1]} de ${regra.ano}, uma vez só`
  if (regra.tipo === 'pascoa') {
    const d = regra.deslocaDias
    if (d === 0) return 'no domingo de Páscoa'
    return `${Math.abs(d)} ${Math.abs(d) === 1 ? 'dia' : 'dias'} ${d < 0 ? 'antes' : 'depois'} da Páscoa`
  }
  const d = DIAS_DA_SEMANA.find((x) => x.dow === regra.dow)
  if (!d) return `todo ano em ${MESES_LONGOS[regra.mes - 1]}`
  const ordem = ORDINAIS[d.genero][regra.n - 1] ?? `${regra.n}º`
  return `todo ano ${d.genero === 'f' ? 'na' : 'no'} ${ordem} ${d.label} de ${MESES_LONGOS[regra.mes - 1]}`
}

// SAZONALIDADE — cálculo de datas. Puro, sem banco e sem rede.
//
// ⚠️ NADA AQUI É DIGITADO. Toda data móvel sai de regra, e por um motivo
// prático: data digitada erra em silêncio e ninguém percebe até o dia passar.
// Uma lista de 24 meses também expira — em dois anos alguém teria que semear
// de novo, e esqueceria. Regra calculada não expira e não erra de digitação.

/** Meio-dia UTC: âncora que não escorrega de dia por fuso nem por horário de verão. */
const dia = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m - 1, d, 12))

export const paraYmd = (d: Date): string => d.toISOString().slice(0, 10)

export function somaDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

/**
 * Domingo de Páscoa (calendário gregoriano), algoritmo de Meeus/Jones/Butcher.
 *
 * É de onde saem Carnaval e Sexta-Feira Santa, que arrastam o varejo inteiro no
 * primeiro trimestre. O algoritmo se confere sozinho: o resultado SEMPRE cai
 * num domingo — um erro de implementação sairia do dia da semana, e há teste
 * para isso em vários anos.
 */
export function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const d2 = ((h + l - 7 * m + 114) % 31) + 1
  return dia(ano, mes, d2)
}

/**
 * O enésimo dia-da-semana de um mês. `dow` em ISO: 1 = segunda … 7 = domingo.
 * É a forma de Dia das Mães (2º domingo de maio), Dia dos Pais (2º domingo de
 * agosto) e Black Friday (sexta depois da 4ª quinta de novembro).
 *
 * ⚠️ Todo mês tem quatro de cada dia da semana, mas nem todo mês tem cinco.
 * Pedir a 5ª sexta de um mês que não tem devolveria uma data do mês SEGUINTE —
 * uma data, só que a errada, sem nenhum sinal. Quem valida a entrada é
 * `validarDataPropria`; aqui a função devolve o que a aritmética dá, e é
 * `dataDoAno` que recusa o transbordo.
 */
export function enesimoDiaDaSemana(ano: number, mes: number, dow: number, n: number): Date {
  const primeiro = dia(ano, mes, 1)
  const dowPrimeiro = primeiro.getUTCDay() === 0 ? 7 : primeiro.getUTCDay()
  const desloca = (dow - dowPrimeiro + 7) % 7
  return somaDias(primeiro, desloca + 7 * (n - 1))
}

export type RegraData =
  | { tipo: 'fixa'; mes: number, diaDoMes: number }
  | { tipo: 'enesimo'; mes: number; dow: number; n: number; deslocaDias?: number }
  | { tipo: 'pascoa'; deslocaDias: number }
  /**
   * Acontece UMA vez, num ano específico. É o lançamento, a inauguração, a
   * feira que só tem esta edição — coisas que o gestor cadastra e que
   * repetidas todo ano seriam mentira. As outras três regras são anuais por
   * natureza; esta é a única que precisa carregar o ano dentro de si.
   */
  | { tipo: 'unica'; ano: number; mes: number; diaDoMes: number }

const inteiroEntre = (v: unknown, min: number, max: number): boolean =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/**
 * Resolve a regra para um ano. É a única porta: nenhuma data é lida de lista.
 *
 * Devolve `null` em dois casos, e os dois são deliberados:
 *
 *  1. A regra não acontece NESTE ano (`unica` de outro ano). Devolver a data
 *     do ano certo assim mesmo faria a varredura de dois anos mostrar a mesma
 *     linha duas vezes; o tipo nulo obriga quem chama a tratar.
 *
 *  2. A regra é INVÁLIDA. As regras do catálogo são código revisado, mas as do
 *     cliente vivem num `jsonb` — e `Date.UTC` transborda calado: mês 13 vira
 *     janeiro do ano seguinte, dia 99 anda três meses, a 5ª sexta de um mês que
 *     só tem quatro cai no mês seguinte. Em todos esses casos a tela mostraria
 *     uma data errada com toda a confiança. Sumir com a linha é ruim; mostrar
 *     "Black Friday em 3 de janeiro" é pior, porque alguém age em cima.
 */
export function dataDoAno(regra: RegraData, ano: number): Date | null {
  if (!inteiroEntre(ano, 1, 9999)) return null

  if (regra.tipo === 'pascoa') {
    if (!inteiroEntre(regra.deslocaDias, -366, 366)) return null
    return somaDias(pascoa(ano), regra.deslocaDias)
  }

  if (!inteiroEntre(regra.mes, 1, 12)) return null

  if (regra.tipo === 'fixa' || regra.tipo === 'unica') {
    if (!inteiroEntre(regra.diaDoMes, 1, 31)) return null
    const alvo = regra.tipo === 'unica' ? regra.ano : ano
    if (regra.tipo === 'unica' && (!inteiroEntre(regra.ano, 1, 9999) || regra.ano !== ano)) return null
    const d = dia(alvo, regra.mes, regra.diaDoMes)
    // 31 de abril e 29 de fevereiro em ano comum: `Date.UTC` rola para o mês
    // seguinte em silêncio, e o mês de volta denuncia.
    return d.getUTCMonth() === regra.mes - 1 ? d : null
  }

  if (!inteiroEntre(regra.dow, 1, 7) || !inteiroEntre(regra.n, 1, 5)) return null
  const base = enesimoDiaDaSemana(ano, regra.mes, regra.dow, regra.n)
  // A enésima ocorrência tem que existir DENTRO do mês pedido. O deslocamento
  // vem depois e pode legitimamente atravessar — a Cyber Monday, que é a 4ª
  // quinta de novembro + 4 dias, cai em dezembro em alguns anos.
  if (base.getUTCMonth() !== regra.mes - 1) return null
  const desloca = regra.deslocaDias ?? 0
  if (!inteiroEntre(desloca, -366, 366)) return null
  return somaDias(base, desloca)
}

/** Dias inteiros entre duas datas civis (positivo = `ate` no futuro). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 86400000)
}

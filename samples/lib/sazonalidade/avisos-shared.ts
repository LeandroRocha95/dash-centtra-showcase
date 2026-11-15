// SAZONALIDADE — o aviso. Puro.
//
// ⚠️ AGRUPAR É O PONTO. Doze clientes × ~12 datas por ano dá quase 150 avisos.
// Avulsos, isso é ruído diário e o gestor desliga a funcionalidade inteira na
// segunda semana. Uma data que pega quatro clientes é UMA linha citando os
// quatro, não quatro linhas.

import type { Ocorrencia } from './proximas'

export type ClienteComOcorrencias = { clienteId: string; nome: string; ocorrencias: Ocorrencia[] }

/**
 * O que o gestor já resolveu sobre uma data, para um cliente, num ano.
 *
 * `preparado` e `ignorado` param de avisar pelo mesmo motivo prático — o
 * gestor já decidiu — mas continuam distintos na tela, porque "fiz" e "não vou
 * fazer" respondem coisas diferentes quando ele revisa o ano.
 */
export type Marcacao = 'preparado' | 'ignorado'

/**
 * A chave de uma marcação: cliente + evento + ANO.
 *
 * O ano não é decoração. Ignorar a Black Friday de 2026 para um cliente não
 * pode calar a de 2027 — e numa virada de ano as duas convivem no horizonte.
 */
export const chaveMarcacao = (clienteId: string, eventoId: string, ano: number): string =>
  `${clienteId}|${eventoId}|${ano}`

/** O ano de uma ocorrência, extraído da chave `eventoId:ano`. */
export const anoDaOcorrencia = (o: Pick<Ocorrencia, 'chave'>): number =>
  Number(o.chave.slice(o.chave.lastIndexOf(':') + 1))

export type AvisoSazonal = {
  eventoId: string
  nome: string
  data: string
  diasAte: number
  /** dias até o preparo; negativo = a janela já abriu */
  diasAteOPreparo: number
  clientes: string[]
  acao: string | null
  origem: Ocorrencia['origem']
}

/** Quantos avisos cabem numa mensagem antes de virar lista que ninguém lê. */
export const MAX_AVISOS = 3

/**
 * Junta as ocorrências de vários clientes num aviso por EVENTO.
 *
 * Só entra o que está na janela de preparo: anunciar a Black Friday em março é
 * verdade e é inútil — o gestor não faz nada com isso e passa a ler a mensagem
 * seguinte na diagonal.
 */
export function agruparAvisos(
  clientes: readonly ClienteComOcorrencias[],
  marcadas: ReadonlySet<string> = new Set(),
): AvisoSazonal[] {
  const porEvento = new Map<string, AvisoSazonal>()
  for (const c of clientes) {
    for (const o of c.ocorrencias) {
      if (!o.emPreparo) continue
      // Data que o gestor marcou como preparada ou ignorada sai do aviso. Sem
      // isto o botão seria decoração: ele marcaria "já preparei" e a mensagem
      // de segunda continuaria cobrando — que é o jeito mais rápido de ensinar
      // alguém a ignorar a funcionalidade inteira.
      if (marcadas.has(chaveMarcacao(c.clienteId, o.eventoId, anoDaOcorrencia(o)))) continue
      // A chave inclui o ano: a Black Friday de 2026 e a de 2027 são avisos
      // diferentes, e numa virada de ano as duas podem estar no horizonte.
      const chave = o.chave
      const atual = porEvento.get(chave)
      if (atual) { atual.clientes.push(c.nome); continue }
      porEvento.set(chave, {
        eventoId: o.eventoId, nome: o.nome, data: o.data,
        diasAte: o.diasAte, diasAteOPreparo: o.diasAteOPreparo,
        clientes: [c.nome], acao: o.acao, origem: o.origem,
      })
    }
  }
  // Mais perto primeiro; empate desempata por quantos clientes pega, que é a
  // ordem em que o gestor precisa agir.
  return [...porEvento.values()]
    .map((a) => ({ ...a, clientes: [...a.clientes].sort((x, y) => x.localeCompare(y, 'pt-BR')) }))
    .sort((a, b) => a.diasAte - b.diasAte || b.clientes.length - a.clientes.length)
}

const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos)

/**
 * O aviso em uma linha por evento, pronto para entrar na folha da IA ou sair
 * como texto determinístico.
 *
 * Diz os DIAS QUE FALTAM, não a data: "faltam 21 dias" é acionável, "27/11" o
 * gestor tem que calcular de cabeça no meio da manhã.
 */
export function linhasDoAviso(avisos: readonly AvisoSazonal[], max = MAX_AVISOS): string[] {
  const linhas = avisos.slice(0, max).map((a) => {
    const quem = a.clientes.length <= 3
      ? a.clientes.join(', ')
      : `${a.clientes.slice(0, 2).join(', ')} e mais ${a.clientes.length - 2}`
    // O VERBO também concorda: "falta 1 dia", "faltam 2 dias". Errar isso numa
    // mensagem que o gestor lê toda semana é o tipo de detalhe que faz o
    // produto parecer feito por robô.
    const quando = a.diasAte === 0
      ? 'é hoje'
      : `${plural(a.diasAte, 'falta', 'faltam')} ${a.diasAte} ${plural(a.diasAte, 'dia', 'dias')}`
    const atraso = a.diasAteOPreparo < 0
      ? ` A preparação deveria ter começado há ${Math.abs(a.diasAteOPreparo)} ${plural(Math.abs(a.diasAteOPreparo), 'dia', 'dias')}.`
      : ''
    return `${a.nome}: ${quando} — ${a.clientes.length} ${plural(a.clientes.length, 'cliente', 'clientes')} (${quem}).${atraso}${a.acao ? ' ' + a.acao : ''}`
  })
  if (avisos.length > max) {
    linhas.push(`(mais ${avisos.length - max} ${plural(avisos.length - max, 'data', 'datas')} na janela de preparo)`)
  }
  return linhas
}

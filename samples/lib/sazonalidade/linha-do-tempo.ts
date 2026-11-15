// SAZONALIDADE — a linha do tempo da tela. Puro.
//
// O aviso (`avisos-shared`) e a tela olham para os mesmos dados com objetivos
// opostos, e por isso são funções diferentes:
//
//   - o aviso mostra SÓ o que exige ação agora, e some com o que já foi
//     resolvido — porque ele interrompe o gestor;
//   - a tela mostra TUDO no horizonte, inclusive o que já foi marcado —
//     porque ele foi até ela, e uma tela que esconde o que ele acabou de
//     marcar parece ter perdido a marcação.

import type { Ocorrencia } from './proximas'
import { diasEntre } from './datas'
import { chaveMarcacao, anoDaOcorrencia, type ClienteComOcorrencias, type Marcacao } from './avisos-shared'

export type ClienteNoEvento = { id: string; nome: string; marcacao: Marcacao | null }

/**
 * Onde a data está em relação à sua janela de preparo.
 *
 * ⚠️ "Dentro da janela" NÃO é atraso: a janela existe justamente para ser
 * trabalhada. O que é atraso é chegar à segunda metade dela sem ninguém ter
 * tocado no assunto — e é só esse caso que ganha cor de alerta. Pintar de
 * vermelho o primeiro dia de uma janela de 45 dias treinaria o gestor a
 * ignorar a cor.
 */
export type EstadoEvento = 'resolvido' | 'radar' | 'preparando' | 'apertado'

export type ItemLinha = {
  /** `eventoId:ano` — única no horizonte, serve de key da lista */
  chave: string
  eventoId: string
  ano: number
  nome: string
  origem: Ocorrencia['origem']
  data: string
  diasAte: number
  inicioPreparo: string
  diasAteOPreparo: number
  /** tamanho da janela, em dias */
  preparo: number
  /** 0 = a janela acabou de abrir; 1 = é hoje. Fora da janela, 0. */
  progresso: number
  acao: string | null
  estado: EstadoEvento
  clientes: ClienteNoEvento[]
  /** clientes ainda sem decisão — é o número que pede ação */
  pendentes: number
}

function estadoDe(diasAteOPreparo: number, progresso: number, pendentes: number): EstadoEvento {
  if (pendentes === 0) return 'resolvido'
  if (diasAteOPreparo > 0) return 'radar'
  return progresso > 0.5 ? 'apertado' : 'preparando'
}

/**
 * Junta as ocorrências de todos os clientes numa lista por EVENTO, com quem é
 * afetado e o que já foi decidido sobre cada um.
 *
 * Agrupa pelo mesmo motivo do aviso: quatro clientes na mesma Black Friday são
 * uma linha com quatro nomes, não quatro linhas. A diferença é que aqui cada
 * nome é acionável — a marcação é por cliente, nunca pelo evento inteiro.
 */
export function linhaDoTempo(
  clientes: readonly ClienteComOcorrencias[],
  marcadas: ReadonlyMap<string, Marcacao> = new Map(),
): ItemLinha[] {
  const porEvento = new Map<string, ItemLinha>()

  for (const c of clientes) {
    for (const o of c.ocorrencias) {
      const ano = anoDaOcorrencia(o)
      const marcacao = marcadas.get(chaveMarcacao(c.clienteId, o.eventoId, ano)) ?? null
      const quem: ClienteNoEvento = { id: c.clienteId, nome: c.nome, marcacao }
      const atual = porEvento.get(o.chave)
      if (atual) { atual.clientes.push(quem); continue }

      const preparo = diasEntre(o.inicioPreparo, o.data)
      porEvento.set(o.chave, {
        chave: o.chave, eventoId: o.eventoId, ano, nome: o.nome, origem: o.origem,
        data: o.data, diasAte: o.diasAte, inicioPreparo: o.inicioPreparo,
        diasAteOPreparo: o.diasAteOPreparo, preparo,
        // Janela de zero dia não existe (o banco exige preparo ≥ 1 e o catálogo
        // é curado), mas dividir por ela travaria a tela inteira — e uma tela
        // em branco é um bug muito mais caro de diagnosticar que um progresso 0.
        progresso: preparo > 0 && o.diasAteOPreparo <= 0
          ? Math.min(1, Math.max(0, (preparo - o.diasAte) / preparo))
          : 0,
        acao: o.acao, estado: 'radar', clientes: [quem], pendentes: 0,
      })
    }
  }

  return [...porEvento.values()]
    .map((i) => {
      const clientes = [...i.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      const pendentes = clientes.filter((c) => c.marcacao === null).length
      return { ...i, clientes, pendentes, estado: estadoDe(i.diasAteOPreparo, i.progresso, pendentes) }
    })
    // Mais perto primeiro. O empate desempata por quantos clientes ainda
    // precisam de decisão: no mesmo dia, o que pega mais gente vem antes.
    .sort((a, b) => a.diasAte - b.diasAte || b.pendentes - a.pendentes || a.nome.localeCompare(b.nome, 'pt-BR'))
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Rótulo curto do mês de um `YYYY-MM-DD`, sem depender de locale do runtime. */
export const mesCurto = (ymd: string): string => MESES[Number(ymd.slice(5, 7)) - 1] ?? '?'

export const diaDoMes = (ymd: string): string => ymd.slice(8, 10)

/**
 * Quebra a linha do tempo em meses, na ordem em que aparecem.
 *
 * O ano entra no rótulo SEMPRE que a lista atravessa a virada — em novembro,
 * "jan" sem ano ao lado de "dez" faz o gestor ler como janeiro deste ano, que
 * é o mês que acabou de passar.
 */
export function porMes(itens: readonly ItemLinha[]): { rotulo: string; itens: ItemLinha[] }[] {
  const anos = new Set(itens.map((i) => i.data.slice(0, 4)))
  const grupos: { rotulo: string; itens: ItemLinha[] }[] = []
  for (const i of itens) {
    const rotulo = anos.size > 1
      ? `${mesCurto(i.data)} · ${i.data.slice(0, 4)}`
      : mesCurto(i.data)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.rotulo === rotulo) ultimo.itens.push(i)
    else grupos.push({ rotulo, itens: [i] })
  }
  return grupos
}

export type ResumoLinha = {
  datas: number
  emPreparo: number
  apertadas: number
  clientesAfetados: number
}

/** O cabeçalho da tela em quatro números. */
export function resumoDaLinha(itens: readonly ItemLinha[]): ResumoLinha {
  const afetados = new Set<string>()
  for (const i of itens) for (const c of i.clientes) if (c.marcacao === null) afetados.add(c.id)
  return {
    datas: itens.length,
    emPreparo: itens.filter((i) => i.estado === 'preparando' || i.estado === 'apertado').length,
    apertadas: itens.filter((i) => i.estado === 'apertado').length,
    clientesAfetados: afetados.size,
  }
}

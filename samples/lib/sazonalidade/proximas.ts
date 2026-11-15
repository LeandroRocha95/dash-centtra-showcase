// SAZONALIDADE — o que vem por aí para um cliente. Puro.
//
// O valor da funcionalidade está na ANTECEDÊNCIA, não no calendário: saber que
// a Black Friday é em novembro não ajuda ninguém; saber que a preparação dela
// deveria ter começado ontem, ajuda.

import { dataDoAno, paraYmd, somaDias, diasEntre, type RegraData } from './datas'
import { eventosDoNicho, type Nicho } from './catalogo'

/**
 * De onde a data veio. `aprendida` ainda não é produzida por ninguém — existe
 * desde já porque a camada de sazonalidade detectada no histórico do cliente
 * virá, e ela precisa ser rotulada de forma diferente das datas de calendário.
 * Guardar o campo agora evita migrar a UI depois.
 */
export type OrigemData = 'calendario' | 'cliente' | 'aprendida'

export type DataPropria = {
  id: string
  nome: string
  regra: RegraData
  preparo: number
  acao: string | null
  /** Reservado para a camada aprendida; ausente = data cadastrada pelo gestor. */
  origem?: OrigemData
}

export type Ocorrencia = {
  chave: string
  eventoId: string
  nome: string
  origem: OrigemData
  /** o dia do evento */
  data: string
  diasAte: number
  /** quando a preparação deveria começar */
  inicioPreparo: string
  /**
   * Dias até o início do preparo. NEGATIVO significa que a janela já abriu e o
   * preparo está atrasado — é o número que o aviso precisa dizer.
   */
  diasAteOPreparo: number
  emPreparo: boolean
  acao: string | null
}

function ocorrencia(
  eventoId: string, nome: string, origem: OrigemData, regra: RegraData,
  preparo: number, acao: string | null, ano: number, hoje: string,
): Ocorrencia | null {
  // Regra que não acontece neste ano (data única de outro ano) não vira
  // ocorrência. Ver `dataDoAno`: é o que impede a linha duplicada na varredura
  // de dois anos.
  const d = dataDoAno(regra, ano)
  if (!d) return null
  const data = paraYmd(d)
  const inicioPreparo = paraYmd(somaDias(d, -preparo))
  const diasAte = diasEntre(hoje, data)
  return {
    chave: `${eventoId}:${ano}`,
    eventoId, nome, origem, data, diasAte, inicioPreparo,
    diasAteOPreparo: diasEntre(hoje, inicioPreparo),
    emPreparo: diasAte >= 0 && hoje >= inicioPreparo,
    acao,
  }
}

/**
 * As ocorrências dos próximos `horizonte` dias.
 *
 * Olha o ano corrente E o seguinte: em novembro, "os próximos 90 dias" incluem
 * o Carnaval do ano que vem, e uma varredura só do ano corrente perderia a
 * virada — que é justamente quando o gestor mais precisa de antecedência.
 */
export function proximasOcorrencias(
  nicho: Nicho | null,
  proprias: readonly DataPropria[],
  hoje: string,
  horizonte = 90,
): Ocorrencia[] {
  const ano = Number(hoje.slice(0, 4))
  const out: Ocorrencia[] = []

  for (const a of [ano, ano + 1]) {
    for (const e of eventosDoNicho(nicho)) {
      const o = ocorrencia(e.id, e.nome, 'calendario', e.regra, e.preparo, e.acao, a, hoje)
      if (o) out.push(o)
    }
    for (const p of proprias) {
      const o = ocorrencia(p.id, p.nome, p.origem ?? 'cliente', p.regra, p.preparo, p.acao, a, hoje)
      if (o) out.push(o)
    }
  }

  return out
    // Evento que já passou não é aviso, é histórico.
    .filter((o) => o.diasAte >= 0 && o.diasAte <= horizonte)
    .sort((a, b) => a.diasAte - b.diasAte || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * O que merece virar aviso HOJE.
 *
 * Só o que está na janela de preparo. Anunciar a Black Friday em março é
 * verdade e é inútil — o gestor não vai fazer nada com isso, e a próxima
 * mensagem ele já lê na diagonal.
 */
export function ocorrenciasParaAvisar(ocorrencias: readonly Ocorrencia[]): Ocorrencia[] {
  return ocorrencias.filter((o) => o.emPreparo)
}

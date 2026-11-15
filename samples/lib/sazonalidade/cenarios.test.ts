import { describe, it, expect } from 'vitest'
import { proximasOcorrencias, type DataPropria } from './proximas'
import { linhaDoTempo, porMes } from './linha-do-tempo'
import { agruparAvisos, linhasDoAviso, chaveMarcacao, type ClienteComOcorrencias, type Marcacao } from './avisos-shared'
import { eventosDoNicho, NICHOS_VALIDOS, type Nicho } from './catalogo'

// CENÁRIOS — o fechamento da Fase 4.
//
// Os módulos têm teste unitário cada um. Aqui a pergunta é outra: o que
// acontece com a CARTEIRA quando o ano vira, quando um cliente não está
// classificado, e quando o gestor já resolveu a data. São os três casos em que
// um erro não quebra nada — só faz a tela mentir com confiança.

const cli = (id: string, nome: string, nicho: Nicho | null, hoje: string, proprias: DataPropria[] = [], horizonte = 90): ClienteComOcorrencias =>
  ({ clienteId: id, nome, ocorrencias: proximasOcorrencias(nicho, proprias, hoje, horizonte) })

describe('a virada de ano', () => {
  const HOJE = '2026-12-20'

  it('a carteira enxerga dezembro e o ano seguinte na mesma lista', () => {
    const itens = linhaDoTempo([cli('a', 'Loja', 'ecommerce', HOJE), cli('b', 'Academia', 'fitness', HOJE)])
    const anos = new Set(itens.map((i) => i.data.slice(0, 4)))
    expect(anos).toEqual(new Set(['2026', '2027']))
    expect(itens.find((i) => i.eventoId === 'natal')!.ano).toBe(2026)
    expect(itens.find((i) => i.eventoId === 'janeiro_recomeco')!.ano).toBe(2027)
  })

  // "jan" logo abaixo de "dez" se lê como o janeiro que passou.
  it('o rótulo do mês carrega o ano quando a lista atravessa', () => {
    const g = porMes(linhaDoTempo([cli('a', 'Loja', 'ecommerce', HOJE)]))
    expect(g.every((x) => /· 20\d\d$/.test(x.rotulo))).toBe(true)
  })

  it('o ano de cada item é o ano da OCORRÊNCIA, não o de hoje', () => {
    for (const i of linhaDoTempo([cli('a', 'Loja', 'ecommerce', HOJE, [], 365)])) {
      expect(i.ano, i.nome).toBe(Number(i.data.slice(0, 4)))
    }
  })

  // A data móvel do ano seguinte tem que ser recalculada, não herdada: o
  // Carnaval de 2027 é 09/02 e o de 2026 foi 17/02.
  it('a data móvel do ano seguinte é recalculada', () => {
    const itens = linhaDoTempo([cli('a', 'Restaurante', 'alimentacao', HOJE, [], 120)])
    expect(itens.find((i) => i.eventoId === 'carnaval')!.data).toBe('2027-02-09')
  })
})

describe('a marcação vale por ano', () => {
  // Ignorar a Black Friday de 2026 para um cliente NÃO pode calar a de 2027.
  // Duas ocorrências do mesmo evento anual nunca cabem juntas num horizonte de
  // 90 dias, então o erro só apareceria doze meses depois — quando ninguém
  // mais lembraria de procurá-lo aqui.
  it('marcar 2026 não silencia 2027', () => {
    const marcadas = new Map<string, Marcacao>([[chaveMarcacao('a', 'black_friday', 2026), 'ignorado']])

    const em2026 = linhaDoTempo([cli('a', 'Loja', 'ecommerce', '2026-10-20')], marcadas)
    expect(em2026.find((i) => i.eventoId === 'black_friday')!.clientes[0].marcacao).toBe('ignorado')

    const em2027 = linhaDoTempo([cli('a', 'Loja', 'ecommerce', '2027-10-20')], marcadas)
    const bf27 = em2027.find((i) => i.eventoId === 'black_friday')!
    expect(bf27.ano).toBe(2027)
    expect(bf27.clientes[0].marcacao).toBeNull()
    expect(bf27.pendentes).toBe(1)
  })

  it('e o aviso volta a cobrar no ano seguinte', () => {
    const marcadas = new Set([chaveMarcacao('a', 'black_friday', 2026)])
    const tem = (hoje: string) =>
      agruparAvisos([cli('a', 'Loja', 'ecommerce', hoje)], marcadas).some((av) => av.eventoId === 'black_friday')
    expect(tem('2026-10-20')).toBe(false)
    expect(tem('2027-10-20')).toBe(true)
  })
})

describe('cliente sem nicho', () => {
  const HOJE = '2026-10-20'

  it('não recebe nenhuma data do calendário', () => {
    expect(cli('a', 'Sem nicho', null, HOJE).ocorrencias).toEqual([])
    expect(eventosDoNicho(null)).toEqual([])
  })

  // Mas continua com o que o gestor cadastrou à mão: sumir com a data própria
  // dele seria esconder o único conteúdo que ele mesmo criou.
  it('mas continua com as datas próprias', () => {
    const propria: DataPropria = {
      id: 'aniv', nome: 'Aniversário da loja',
      regra: { tipo: 'fixa', mes: 11, diaDoMes: 10 }, preparo: 30, acao: 'Criativo de aniversário.',
    }
    const itens = linhaDoTempo([cli('a', 'Sem nicho', null, HOJE, [propria])])
    expect(itens).toHaveLength(1)
    expect(itens[0].origem).toBe('cliente')
    expect(itens[0].clientes.map((c) => c.nome)).toEqual(['Sem nicho'])
  })

  it('não some da carteira nem contamina a data de quem tem nicho', () => {
    const itens = linhaDoTempo([
      cli('a', 'Loja', 'ecommerce', HOJE),
      cli('b', 'Sem nicho', null, HOJE),
    ])
    const bf = itens.find((i) => i.eventoId === 'black_friday')!
    expect(bf.clientes.map((c) => c.id)).toEqual(['a'])
  })

  // A `leitura` do servidor trata nicho fora da taxonomia como sem nicho, e é
  // esta lista que ela consulta. Um nicho retirado do catálogo sem migração
  // deixaria linhas apontando para o nada.
  it('nicho fora da taxonomia não é aceito como nicho', () => {
    expect(NICHOS_VALIDOS.has('estetica')).toBe(false)
    expect(NICHOS_VALIDOS.has('Estética')).toBe(false)
    expect(NICHOS_VALIDOS.has('estetica_saude')).toBe(true)
    expect(eventosDoNicho('inexistente' as Nicho)).toEqual([])
  })
})

describe('ano bissexto', () => {
  it('a data única de 29/02 aparece no ano bissexto', () => {
    const propria: DataPropria = {
      id: 'salto', nome: 'Dia extra', regra: { tipo: 'unica', ano: 2028, mes: 2, diaDoMes: 29 },
      preparo: 21, acao: null,
    }
    const itens = linhaDoTempo([cli('a', 'Loja', null, '2028-02-01', [propria])])
    expect(itens.map((i) => i.data)).toEqual(['2028-02-29'])
  })

  it('e não vira 1º de março no ano seguinte', () => {
    const propria: DataPropria = {
      id: 'salto', nome: 'Dia extra', regra: { tipo: 'unica', ano: 2028, mes: 2, diaDoMes: 29 },
      preparo: 21, acao: null,
    }
    expect(linhaDoTempo([cli('a', 'Loja', null, '2029-02-01', [propria], 365)])).toEqual([])
  })
})

describe('a carteira inteira, de ponta a ponta', () => {
  const HOJE = '2026-10-20'
  const carteira = [
    cli('a', 'Loja de Roupas', 'moda_beleza', HOJE),
    cli('b', 'E-commerce', 'ecommerce', HOJE),
    cli('c', 'Madeireira', 'industria_b2b', HOJE),
    cli('d', 'Sem nicho', null, HOJE),
  ]

  it('a data de varejo pega os dois de varejo e nenhum dos outros', () => {
    const bf = linhaDoTempo(carteira).find((i) => i.eventoId === 'black_friday')!
    expect(bf.clientes.map((c) => c.nome)).toEqual(['E-commerce', 'Loja de Roupas'])
  })

  it('a data B2B pega só a madeireira', () => {
    const orc = linhaDoTempo(carteira).find((i) => i.eventoId === 'fechamento_orcamento')!
    expect(orc.clientes.map((c) => c.nome)).toEqual(['Madeireira'])
  })

  it('o aviso vira no máximo três linhas, com o resto contado', () => {
    const avisos = agruparAvisos(carteira)
    const linhas = linhasDoAviso(avisos)
    expect(linhas.length).toBeLessThanOrEqual(4) // 3 avisos + a linha do resto
    if (avisos.length > 3) expect(linhas[3]).toMatch(/^\(mais \d+ datas? na janela de preparo\)$/)
    for (const l of linhas.slice(0, 3)) expect(l).toMatch(/faltam? \d+ dias?|é hoje/)
  })

  it('marcar tudo esvazia o aviso e não esvazia a tela', () => {
    const todas = new Set<string>()
    for (const c of carteira) for (const o of c.ocorrencias) todas.add(chaveMarcacao(c.clienteId, o.eventoId, Number(o.chave.slice(o.chave.lastIndexOf(':') + 1))))
    expect(agruparAvisos(carteira, todas)).toEqual([])
    const marcadas = new Map<string, Marcacao>([...todas].map((k) => [k, 'preparado' as Marcacao]))
    const itens = linhaDoTempo(carteira, marcadas)
    expect(itens.length).toBeGreaterThan(0)
    expect(itens.every((i) => i.estado === 'resolvido')).toBe(true)
  })
})

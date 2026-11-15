import { describe, it, expect } from 'vitest'
import { linhaDoTempo, porMes, resumoDaLinha, mesCurto, diaDoMes } from './linha-do-tempo'
import { proximasOcorrencias } from './proximas'
import { agruparAvisos, chaveMarcacao, type Marcacao } from './avisos-shared'
import type { ClienteComOcorrencias } from './avisos-shared'

const HOJE = '2026-10-20'

const cliente = (id: string, nome: string, nicho: Parameters<typeof proximasOcorrencias>[0], proprias: Parameters<typeof proximasOcorrencias>[1] = []): ClienteComOcorrencias =>
  ({ clienteId: id, nome, ocorrencias: proximasOcorrencias(nicho, proprias, HOJE, 90) })

const acha = (itens: ReturnType<typeof linhaDoTempo>, id: string) => itens.find((i) => i.eventoId === id)!

describe('linha do tempo', () => {
  it('junta o mesmo evento de vários clientes numa linha só', () => {
    const itens = linhaDoTempo([
      cliente('a', 'Loja A', 'ecommerce'),
      cliente('b', 'Loja B', 'varejo_local'),
      cliente('c', 'Escritório', 'servicos_profissionais'),
    ])
    const bf = acha(itens, 'black_friday')
    expect(bf.clientes.map((c) => c.nome)).toEqual(['Loja A', 'Loja B'])
    // O escritório é B2B: a Black Friday não é dele, e listá-lo seria o aviso
    // errado que ensina o gestor a ignorar a funcionalidade.
    expect(bf.clientes.some((c) => c.id === 'c')).toBe(false)
  })

  it('ordena por proximidade e mostra os nomes em ordem alfabética', () => {
    const itens = linhaDoTempo([cliente('z', 'Zeta', 'ecommerce'), cliente('a', 'Alfa', 'ecommerce')])
    const dias = itens.map((i) => i.diasAte)
    expect([...dias].sort((x, y) => x - y)).toEqual(dias)
    expect(acha(itens, 'black_friday').clientes.map((c) => c.nome)).toEqual(['Alfa', 'Zeta'])
  })

  // O estado é o que pinta a tela. Dentro da janela NÃO é atraso: a janela
  // existe para ser trabalhada, e vermelho no primeiro dia treina a ignorar.
  it('separa o que ainda está no radar do que está em preparo e do que aperta', () => {
    const itens = linhaDoTempo([cliente('a', 'Loja A', 'ecommerce')])
    // Black Friday 2026 = 27/11; preparo 45 → janela abriu em 13/10, 7 dias atrás
    const bf = acha(itens, 'black_friday')
    expect(bf.diasAteOPreparo).toBeLessThan(0)
    expect(bf.progresso).toBeCloseTo(7 / 45, 2)
    expect(bf.estado).toBe('preparando')
    // Natal = 25/12, preparo 45 → janela abre em 10/11, ainda no futuro
    expect(acha(itens, 'natal').estado).toBe('radar')
  })

  it('vira “apertado” só depois da metade da janela', () => {
    const proprias = [
      { id: 'quase', nome: 'Quase lá', regra: { tipo: 'fixa' as const, mes: 10, diaDoMes: 24 }, preparo: 20, acao: null },
      { id: 'folgado', nome: 'Folgado', regra: { tipo: 'fixa' as const, mes: 12, diaDoMes: 20 }, preparo: 90, acao: null },
    ]
    const itens = linhaDoTempo([cliente('a', 'Loja A', null, proprias)])
    // faltam 4 de 20 dias → 80% da janela consumida
    expect(acha(itens, 'quase').estado).toBe('apertado')
    // faltam 61 de 90 → ainda no primeiro terço
    expect(acha(itens, 'folgado').estado).toBe('preparando')
  })

  it('marcado por cliente: a linha continua, o cliente é que muda de estado', () => {
    const marcadas = new Map<string, Marcacao>([
      [chaveMarcacao('a', 'black_friday', 2026), 'preparado'],
    ])
    const itens = linhaDoTempo([cliente('a', 'Loja A', 'ecommerce'), cliente('b', 'Loja B', 'ecommerce')], marcadas)
    const bf = acha(itens, 'black_friday')
    // A tela NÃO some com o que foi marcado — o gestor veio até ela.
    expect(bf.clientes).toHaveLength(2)
    expect(bf.clientes.find((c) => c.id === 'a')!.marcacao).toBe('preparado')
    expect(bf.clientes.find((c) => c.id === 'b')!.marcacao).toBeNull()
    expect(bf.pendentes).toBe(1)
    expect(bf.estado).not.toBe('resolvido')
  })

  it('todos marcados ⇒ resolvido', () => {
    const marcadas = new Map<string, Marcacao>([
      [chaveMarcacao('a', 'black_friday', 2026), 'preparado'],
      [chaveMarcacao('b', 'black_friday', 2026), 'ignorado'],
    ])
    const itens = linhaDoTempo([cliente('a', 'A', 'ecommerce'), cliente('b', 'B', 'ecommerce')], marcadas)
    expect(acha(itens, 'black_friday').estado).toBe('resolvido')
    expect(acha(itens, 'black_friday').pendentes).toBe(0)
  })

  // A regressão que este teste existe para pegar: a tela mostrar o que o aviso
  // esconde é intencional; o inverso — o aviso continuar cobrando o que foi
  // marcado — transformaria o botão em decoração.
  it('o que a tela mostra marcado, o aviso não cobra', () => {
    const clientes = [cliente('a', 'A', 'ecommerce')]
    const chave = chaveMarcacao('a', 'black_friday', 2026)
    expect(agruparAvisos(clientes).some((av) => av.eventoId === 'black_friday')).toBe(true)
    expect(agruparAvisos(clientes, new Set([chave])).some((av) => av.eventoId === 'black_friday')).toBe(false)
    expect(linhaDoTempo(clientes, new Map([[chave, 'preparado']])).some((i) => i.eventoId === 'black_friday')).toBe(true)
  })

  it('data única não duplica na varredura de dois anos', () => {
    const proprias = [{ id: 'lanc', nome: 'Lançamento', regra: { tipo: 'unica' as const, ano: 2026, mes: 12, diaDoMes: 1 }, preparo: 30, acao: null }]
    const itens = linhaDoTempo([cliente('a', 'A', null, proprias)])
    expect(itens.filter((i) => i.eventoId === 'lanc')).toHaveLength(1)
    expect(acha(itens, 'lanc').ano).toBe(2026)
  })
})

describe('agrupamento por mês', () => {
  it('agrupa na ordem e sem repetir rótulo', () => {
    const itens = linhaDoTempo([cliente('a', 'A', 'ecommerce')])
    const g = porMes(itens)
    // Em 20/10 as datas de outubro (Dia dos Animais, Dia das Crianças) já
    // passaram: evento vencido não é aviso, é histórico, e não entra.
    expect(g.map((x) => x.rotulo)).toEqual(['nov', 'dez'])
    expect(g.reduce((n, x) => n + x.itens.length, 0)).toBe(itens.length)
  })

  // Em novembro, "jan" ao lado de "dez" se lê como o janeiro que passou.
  it('carimba o ano quando a lista atravessa a virada', () => {
    const proprias = [{ id: 'x', nome: 'Feira', regra: { tipo: 'fixa' as const, mes: 1, diaDoMes: 15 }, preparo: 30, acao: null }]
    const g = porMes(linhaDoTempo([cliente('a', 'A', 'ecommerce', proprias)]))
    expect(g.every((x) => x.rotulo.includes('·'))).toBe(true)
    expect(g.map((x) => x.rotulo)).toContain('jan · 2027')
  })
})

describe('resumo do cabeçalho', () => {
  it('conta clientes distintos com pendência, não ocorrências', () => {
    const r = resumoDaLinha(linhaDoTempo([cliente('a', 'A', 'ecommerce'), cliente('b', 'B', 'ecommerce')]))
    expect(r.clientesAfetados).toBe(2)
    expect(r.datas).toBeGreaterThan(0)
    expect(r.emPreparo).toBeGreaterThanOrEqual(r.apertadas)
  })

  it('não conta quem já resolveu tudo', () => {
    const itens = linhaDoTempo([cliente('a', 'A', 'ecommerce')])
    const marcadas = new Map<string, Marcacao>(itens.map((i) => [chaveMarcacao('a', i.eventoId, i.ano), 'preparado' as Marcacao]))
    expect(resumoDaLinha(linhaDoTempo([cliente('a', 'A', 'ecommerce')], marcadas)).clientesAfetados).toBe(0)
  })
})

describe('rótulos de data', () => {
  it('lê dia e mês do ymd sem depender do fuso do runtime', () => {
    expect(mesCurto('2026-11-27')).toBe('nov')
    expect(diaDoMes('2026-11-27')).toBe('27')
    expect(mesCurto('2026-01-01')).toBe('jan')
    expect(diaDoMes('2026-01-01')).toBe('01')
  })
})

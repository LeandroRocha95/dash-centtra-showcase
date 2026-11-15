import { describe, it, expect } from 'vitest'
import { agruparAvisos, linhasDoAviso, MAX_AVISOS, type ClienteComOcorrencias } from './avisos-shared'
import { proximasOcorrencias } from './proximas'
import type { Ocorrencia } from './proximas'

const oc = (p: Partial<Ocorrencia> = {}): Ocorrencia => ({
  chave: 'black_friday:2026', eventoId: 'black_friday', nome: 'Black Friday',
  origem: 'calendario', data: '2026-11-27', diasAte: 30, inicioPreparo: '2026-10-13',
  diasAteOPreparo: -14, emPreparo: true, acao: 'Verba e criativo.', ...p,
})
const cli = (nome: string, ocorrencias: Ocorrencia[]): ClienteComOcorrencias =>
  ({ clienteId: nome, nome, ocorrencias })

describe('agrupamento', () => {
  // 12 clientes × ~12 datas ≈ 150 avisos. Avulsos, o gestor desliga tudo.
  it('uma data que pega quatro clientes é UM aviso citando os quatro', () => {
    const r = agruparAvisos([
      cli('Acme', [oc()]), cli('Beta', [oc()]), cli('Gama', [oc()]), cli('Delta', [oc()]),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].clientes).toEqual(['Acme', 'Beta', 'Delta', 'Gama'])
  })

  it('separa a mesma data em anos diferentes', () => {
    const r = agruparAvisos([cli('Acme', [
      oc({ chave: 'black_friday:2026', data: '2026-11-27', diasAte: 30 }),
      oc({ chave: 'black_friday:2027', data: '2027-11-26', diasAte: 395 }),
    ])])
    expect(r).toHaveLength(2)
  })

  // Anunciar a Black Friday em março é verdade e é inútil.
  it('só entra o que está na janela de preparo', () => {
    expect(agruparAvisos([cli('Acme', [oc({ emPreparo: false })])])).toEqual([])
  })

  it('mais próximo primeiro; empate, quem pega mais clientes', () => {
    const perto = oc({ chave: 'a:2026', eventoId: 'a', nome: 'Perto', diasAte: 5 })
    const longe = oc({ chave: 'b:2026', eventoId: 'b', nome: 'Longe', diasAte: 40 })
    const outro = oc({ chave: 'c:2026', eventoId: 'c', nome: 'Outro', diasAte: 40 })
    const r = agruparAvisos([
      cli('Acme', [perto, longe, outro]), cli('Beta', [longe]), cli('Gama', [longe]),
    ])
    expect(r.map((a) => a.nome)).toEqual(['Perto', 'Longe', 'Outro'])
  })

  it('não altera a lista recebida', () => {
    const c = cli('Acme', [oc()])
    agruparAvisos([c])
    expect(c.ocorrencias).toHaveLength(1)
  })
})

describe('a linha do aviso', () => {
  // "Faltam 21 dias" é acionável; "27/11" o gestor calcula de cabeça.
  it('diz os dias que faltam, não a data', () => {
    const [l] = linhasDoAviso(agruparAvisos([cli('Acme', [oc({ diasAte: 21 })])]))
    expect(l).toContain('faltam 21 dias')
    expect(l).not.toContain('27/11')
  })

  it('avisa quando o preparo já está atrasado', () => {
    const [l] = linhasDoAviso(agruparAvisos([cli('Acme', [oc({ diasAteOPreparo: -14 })])]))
    expect(l).toContain('deveria ter começado há 14 dias')
  })

  it('não fala em atraso quando a janela abriu hoje', () => {
    const [l] = linhasDoAviso(agruparAvisos([cli('Acme', [oc({ diasAteOPreparo: 0 })])]))
    expect(l).not.toContain('deveria ter começado')
  })

  it('singular e plural certos', () => {
    const [l] = linhasDoAviso(agruparAvisos([cli('Acme', [oc({ diasAte: 1, diasAteOPreparo: -1 })])]))
    expect(l).toContain('falta 1 dia')
    expect(l).toContain('1 cliente (Acme)')
    expect(l).toContain('há 1 dia')
  })

  it('"é hoje" em vez de "faltam 0 dias"', () => {
    const [l] = linhasDoAviso(agruparAvisos([cli('Acme', [oc({ diasAte: 0 })])]))
    expect(l).toContain('é hoje')
  })

  it('resume a lista de clientes quando são muitos', () => {
    const muitos = ['A', 'B', 'C', 'D', 'E'].map((n) => cli(n, [oc()]))
    const [l] = linhasDoAviso(agruparAvisos(muitos))
    expect(l).toContain('5 clientes')
    expect(l).toContain('e mais 3')
  })

  it('corta em MAX_AVISOS e conta o resto', () => {
    const varios = Array.from({ length: MAX_AVISOS + 2 }, (_, i) =>
      oc({ chave: `e${i}:2026`, eventoId: `e${i}`, nome: `Evento ${i}`, diasAte: i }))
    const l = linhasDoAviso(agruparAvisos([cli('Acme', varios)]))
    expect(l).toHaveLength(MAX_AVISOS + 1)
    expect(l[l.length - 1]).toContain('mais 2 datas')
  })
})

describe('ponta a ponta com o calendário real', () => {
  it('em outubro, a Black Friday já está na janela e aparece agrupada', () => {
    const hoje = '2026-10-20'
    const clientes = ['Loja A', 'Loja B'].map((n) =>
      cli(n, proximasOcorrencias('ecommerce', [], hoje, 120)))
    const avisos = agruparAvisos(clientes)
    const bf = avisos.find((a) => a.eventoId === 'black_friday')!
    expect(bf).toBeTruthy()
    expect(bf.clientes).toEqual(['Loja A', 'Loja B'])
    expect(bf.diasAteOPreparo).toBeLessThan(0)
    expect(linhasDoAviso([bf])[0]).toContain('Black Friday')
  })

  it('em março, nada do fim do ano aparece', () => {
    const clientes = [cli('Loja A', proximasOcorrencias('ecommerce', [], '2026-03-01', 365))]
    const ids = agruparAvisos(clientes).map((a) => a.eventoId)
    expect(ids).not.toContain('black_friday')
    expect(ids).not.toContain('natal')
  })
})

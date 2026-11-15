import { describe, it, expect } from 'vitest'
import { EVENTOS, NICHOS, NICHOS_VALIDOS, eventosDoNicho, type Nicho } from './catalogo'
import { dataDoAno, paraYmd } from './datas'

describe('taxonomia de nichos', () => {
  it('não tem nicho repetido e todo nicho tem rótulo e exemplo', () => {
    expect(new Set(NICHOS.map((n) => n.nicho)).size).toBe(NICHOS.length)
    for (const n of NICHOS) {
      expect(n.label.trim(), n.nicho).not.toBe('')
      expect(n.exemplos.trim().length, n.nicho).toBeGreaterThan(10)
    }
  })

  it('cobre os clientes reais da base sem forçar', () => {
    // Os segmentos de texto livre que existem hoje, e onde cada um cai.
    const reais: [string, Nicho][] = [
      ['Estética', 'estetica_saude'], ['Educação', 'educacao'], ['Ecommerce', 'ecommerce'],
      ['Restaurante', 'alimentacao'], ['imobiliário', 'imobiliario'], ['energia', 'energia_solar'],
      ['indústria', 'industria_b2b'], ['arquitetura', 'arquitetura_design'], ['Sistemas', 'software_saas'],
    ]
    for (const [, nicho] of reais) expect(NICHOS_VALIDOS.has(nicho), nicho).toBe(true)
  })
})

describe('calendário base', () => {
  it('não tem id repetido', () => {
    expect(new Set(EVENTOS.map((e) => e.id)).size).toBe(EVENTOS.length)
  })

  it('todo evento tem nome, ação e ao menos um nicho', () => {
    for (const e of EVENTOS) {
      expect(e.nome.trim(), e.id).not.toBe('')
      expect(e.acao.trim().length, e.id).toBeGreaterThan(25)
      expect(e.nichos.length, e.id).toBeGreaterThan(0)
    }
  })

  it('só usa nichos que existem na taxonomia', () => {
    for (const e of EVENTOS) {
      for (const n of e.nichos) expect(NICHOS_VALIDOS.has(n), `${e.id} → ${n}`).toBe(true)
    }
  })

  // A janela de preparo é o produto. Zero seria "avise no dia", que é o
  // problema que a funcionalidade existe para resolver.
  it('toda janela de preparo é útil e não absurda', () => {
    for (const e of EVENTOS) {
      expect(e.preparo, e.id).toBeGreaterThanOrEqual(14)
      expect(e.preparo, e.id).toBeLessThanOrEqual(60)
    }
  })

  it('as datas grandes têm as maiores janelas', () => {
    const p = (id: string) => EVENTOS.find((e) => e.id === id)!.preparo
    expect(p('black_friday')).toBeGreaterThanOrEqual(45)
    expect(p('natal')).toBeGreaterThanOrEqual(45)
    expect(p('dia_maes')).toBeGreaterThanOrEqual(28)
    expect(p('dia_pais')).toBeGreaterThanOrEqual(28)
  })

  // ⚠️ Mandar "prepare a Black Friday" para uma madeireira B2B é o aviso que
  // ensina o gestor a ignorar a funcionalidade inteira.
  it('data de varejo não vai para nicho B2B', () => {
    for (const id of ['black_friday', 'natal', 'dia_maes', 'dia_criancas']) {
      const e = EVENTOS.find((x) => x.id === id)!
      for (const b of ['industria_b2b', 'software_saas', 'imobiliario'] as Nicho[]) {
        expect(e.nichos.includes(b), `${id} não deveria valer para ${b}`).toBe(false)
      }
    }
  })

  it('todo evento resolve numa data válida por 10 anos', () => {
    for (const e of EVENTOS) {
      for (let ano = 2026; ano <= 2036; ano++) {
        const ymd = paraYmd(dataDoAno(e.regra, ano)!)
        expect(ymd.startsWith(String(ano)), `${e.id}/${ano} → ${ymd}`).toBe(true)
      }
    }
  })

  it('Cyber Monday cai na segunda seguinte à Black Friday', () => {
    const bf = EVENTOS.find((e) => e.id === 'black_friday')!
    const cm = EVENTOS.find((e) => e.id === 'cyber_monday')!
    for (let ano = 2026; ano <= 2035; ano++) {
      const d1 = dataDoAno(bf.regra, ano)!
      const d2 = dataDoAno(cm.regra, ano)!
      expect((d2.getTime() - d1.getTime()) / 86400000, String(ano)).toBe(3)
      expect(d2.getUTCDay(), String(ano)).toBe(1) // segunda
    }
  })

  it('sem nicho, nenhum evento', () => {
    expect(eventosDoNicho(null)).toEqual([])
  })

  // Deixar o B2B vazio deixaria cinco dos clientes reais sem nada. B2B tem
  // sazonalidade — é outra, e o calendário do varejo costuma ocupar o espaço.
  it('todo nicho do catálogo recebe ao menos um evento', () => {
    for (const n of NICHOS) {
      if (n.nicho === 'outro') continue // 'outro' é escape, não classificação
      expect(eventosDoNicho(n.nicho).length, `${n.nicho} ficaria sem nenhum aviso`).toBeGreaterThan(0)
    }
  })

  it('as datas de B2B não vazam para varejo puro, e vice-versa', () => {
    const b2b = EVENTOS.filter((e) => e.id.match(/ferias_coletivas|fechamento_orcamento|retomada_fevereiro/))
    for (const e of b2b) {
      expect(e.nichos.includes('ecommerce'), e.id).toBe(false)
      expect(e.nichos.includes('industria_b2b'), e.id).toBe(true)
    }
  })
})

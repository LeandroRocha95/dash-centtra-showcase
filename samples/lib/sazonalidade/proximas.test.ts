import { describe, it, expect } from 'vitest'
import { proximasOcorrencias, ocorrenciasParaAvisar, type DataPropria } from './proximas'

const HOJE = '2026-08-31'

describe('próximas ocorrências', () => {
  it('só traz o que está à frente, dentro do horizonte', () => {
    const r = proximasOcorrencias('ecommerce', [], HOJE, 90)
    expect(r.every((o) => o.diasAte >= 0 && o.diasAte <= 90)).toBe(true)
    expect(r.map((o) => o.eventoId)).toContain('dia_criancas')
    // Dia das Mães já passou em 2026 e o de 2027 está fora do horizonte.
    expect(r.map((o) => o.eventoId)).not.toContain('dia_maes')
  })

  it('vem ordenado do mais próximo para o mais distante', () => {
    const r = proximasOcorrencias('ecommerce', [], HOJE, 120)
    const dias = r.map((o) => o.diasAte)
    expect([...dias].sort((a, b) => a - b)).toEqual(dias)
  })

  // Em novembro, "os próximos 90 dias" incluem o Carnaval do ano seguinte —
  // que é exatamente quando a antecedência mais importa.
  it('atravessa a virada de ano', () => {
    const r = proximasOcorrencias('alimentacao', [], '2026-11-20', 100)
    const ids = r.map((o) => o.eventoId)
    expect(ids).toContain('natal')
    const carnaval = r.find((o) => o.eventoId === 'carnaval')
    expect(carnaval?.data).toBe('2027-02-09')
  })

  it('nicho sem classificação não recebe nada', () => {
    expect(proximasOcorrencias(null, [], HOJE, 365)).toEqual([])
  })

  it('a data própria do cliente entra junto, marcada como dele', () => {
    const propria: DataPropria = {
      id: 'aniv', nome: 'Aniversário da loja',
      regra: { tipo: 'fixa', mes: 9, diaDoMes: 20 }, preparo: 21, acao: null,
    }
    const r = proximasOcorrencias('varejo_local', [propria], HOJE, 60)
    const a = r.find((o) => o.eventoId === 'aniv')!
    expect(a.origem).toBe('cliente')
    expect(a.data).toBe('2026-09-20')
    expect(r.some((o) => o.origem === 'calendario')).toBe(true)
  })

  it('calcula quando o preparo deveria começar', () => {
    const r = proximasOcorrencias('ecommerce', [], HOJE, 120)
    const criancas = r.find((o) => o.eventoId === 'dia_criancas')!
    expect(criancas.data).toBe('2026-10-12')
    expect(criancas.inicioPreparo).toBe('2026-09-21') // 21 dias antes
    expect(criancas.diasAte).toBe(42)
    expect(criancas.diasAteOPreparo).toBe(21)
    expect(criancas.emPreparo).toBe(false)
  })

  // ⚠️ O número que o aviso precisa dizer: negativo = a janela já abriu e o
  // preparo está atrasado.
  it('marca o preparo em curso, com dias negativos quando já atrasou', () => {
    // Em 31/08, a Black Friday de 27/11 tem preparo de 45 dias → começa 13/10.
    const emOutubro = proximasOcorrencias('ecommerce', [], '2026-10-20', 120)
    const bf = emOutubro.find((o) => o.eventoId === 'black_friday')!
    expect(bf.emPreparo).toBe(true)
    expect(bf.diasAteOPreparo).toBeLessThan(0)
  })
})

describe('o que vira aviso', () => {
  // Anunciar a Black Friday em março é verdade e é inútil: o gestor não faz
  // nada com isso, e passa a ler a próxima mensagem na diagonal.
  it('só avisa o que está na janela de preparo', () => {
    const r = proximasOcorrencias('ecommerce', [], '2026-03-01', 365)
    const avisos = ocorrenciasParaAvisar(r)
    expect(r.some((o) => o.eventoId === 'black_friday')).toBe(true)
    expect(avisos.some((o) => o.eventoId === 'black_friday')).toBe(false)
    expect(avisos.every((o) => o.emPreparo)).toBe(true)
  })

  it('avisa quando a janela abre', () => {
    // 13/10/2026 é o primeiro dia de preparo da Black Friday de 27/11.
    const r = proximasOcorrencias('ecommerce', [], '2026-10-13', 120)
    expect(ocorrenciasParaAvisar(r).some((o) => o.eventoId === 'black_friday')).toBe(true)
  })
})

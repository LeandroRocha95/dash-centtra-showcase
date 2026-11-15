import { describe, it, expect } from 'vitest'
import { validarDataPropria, descreverRegra, type FormaDataPropria } from './data-propria'
import { dataDoAno, paraYmd } from './datas'

const base: FormaDataPropria = { nome: 'Aniversário da loja', tipo: 'fixa', diaDoMes: 10, mes: 3, preparo: 21 }
const ok = (f: Partial<FormaDataPropria>) => {
  const r = validarDataPropria({ ...base, ...f })
  if (!r.ok) throw new Error(`esperava válido, veio: ${r.erro}`)
  return r.valor
}
const erro = (f: Partial<FormaDataPropria>) => {
  const r = validarDataPropria({ ...base, ...f })
  if (r.ok) throw new Error('esperava erro e passou')
  return r.erro
}

describe('validação da data própria', () => {
  it('normaliza o nome e devolve a regra', () => {
    const v = ok({ nome: '  Feira   do   setor ' })
    expect(v.nome).toBe('Feira do setor')
    expect(v.regra).toEqual({ tipo: 'fixa', mes: 3, diaDoMes: 10 })
    expect(v.acao).toBeNull()
  })

  it('recusa nome vazio e nome de uma letra', () => {
    expect(erro({ nome: '   ' })).toMatch(/nome/i)
    expect(erro({ nome: 'X' })).toMatch(/nome/i)
  })

  it('recusa antecedência fora da faixa do banco', () => {
    expect(erro({ preparo: 0 })).toMatch(/antecedência/i)
    expect(erro({ preparo: 181 })).toMatch(/antecedência/i)
    expect(erro({ preparo: 21.5 })).toMatch(/antecedência/i)
    expect(ok({ preparo: 1 }).preparo).toBe(1)
    expect(ok({ preparo: 180 }).preparo).toBe(180)
  })

  it('recusa dia que o mês não tem', () => {
    expect(erro({ mes: 4, diaDoMes: 31 })).toMatch(/abril não tem dia 31/i)
    expect(erro({ mes: 6, diaDoMes: 31 })).toMatch(/junho/i)
  })

  // O caso que mais escapa: 29/02 numa regra anual vira 1º de março em três
  // anos de cada quatro, e ninguém percebe até a data passar.
  it('recusa 29 de fevereiro como data ANUAL e aceita como data única de ano bissexto', () => {
    expect(erro({ mes: 2, diaDoMes: 29 })).toMatch(/bissexto/i)
    const v = ok({ tipo: 'unica', mes: 2, diaDoMes: 29, ano: 2028 })
    expect(v.regra).toEqual({ tipo: 'unica', ano: 2028, mes: 2, diaDoMes: 29 })
    expect(erro({ tipo: 'unica', mes: 2, diaDoMes: 29, ano: 2027 })).toMatch(/não tem dia 29/i)
  })

  it('recusa ano implausível na data única', () => {
    expect(erro({ tipo: 'unica', ano: 1999 })).toMatch(/2024/)
    expect(erro({ tipo: 'unica', ano: 2200 })).toMatch(/2100/)
  })

  // A quinta ocorrência não existe em todo mês, e `enesimoDiaDaSemana`
  // transbordaria para o mês seguinte devolvendo uma data — a errada.
  it('aceita da 1ª à 4ª ocorrência do mês, e nunca a 5ª', () => {
    expect(ok({ tipo: 'enesimo', mes: 3, dow: 4, n: 4 }).regra).toEqual({ tipo: 'enesimo', mes: 3, dow: 4, n: 4 })
    expect(erro({ tipo: 'enesimo', mes: 3, dow: 4, n: 5 })).toMatch(/quarta ocorrência/i)
    expect(erro({ tipo: 'enesimo', mes: 3, dow: 8, n: 1 })).toMatch(/dia da semana/i)
  })

  it('trata observação vazia como ausente e corta a longa demais', () => {
    expect(ok({ acao: '   ' }).acao).toBeNull()
    expect(ok({ acao: 'Reforçar verba' }).acao).toBe('Reforçar verba')
    expect(erro({ acao: 'x'.repeat(241) })).toMatch(/observação/i)
  })
})

describe('a regra validada realmente resolve para a data pedida', () => {
  it('data única só acontece no ano dela', () => {
    const v = ok({ tipo: 'unica', ano: 2027, mes: 5, diaDoMes: 20 })
    expect(paraYmd(dataDoAno(v.regra, 2027)!)).toBe('2027-05-20')
    expect(dataDoAno(v.regra, 2026)).toBeNull()
    expect(dataDoAno(v.regra, 2028)).toBeNull()
  })

  it('a 2ª quinta-feira de março cai numa quinta, em qualquer ano', () => {
    const v = ok({ tipo: 'enesimo', mes: 3, dow: 4, n: 2 })
    for (const ano of [2026, 2027, 2028, 2029]) {
      const d = dataDoAno(v.regra, ano)!
      expect(d.getUTCDay()).toBe(4)
      expect(d.getUTCMonth()).toBe(2)
      // 2ª ocorrência ⇒ sempre entre os dias 8 e 14
      expect(d.getUTCDate()).toBeGreaterThanOrEqual(8)
      expect(d.getUTCDate()).toBeLessThanOrEqual(14)
    }
  })
})

describe('descrição da regra em português', () => {
  it('concorda o ordinal com o gênero do dia da semana', () => {
    expect(descreverRegra({ tipo: 'enesimo', mes: 3, dow: 4, n: 2 })).toBe('todo ano na segunda quinta-feira de março')
    expect(descreverRegra({ tipo: 'enesimo', mes: 3, dow: 6, n: 1 })).toBe('todo ano no primeiro sábado de março')
    expect(descreverRegra({ tipo: 'enesimo', mes: 8, dow: 7, n: 2 })).toBe('todo ano no segundo domingo de agosto')
  })

  it('descreve as demais regras', () => {
    expect(descreverRegra({ tipo: 'fixa', mes: 12, diaDoMes: 25 })).toBe('todo ano em 25 de dezembro')
    expect(descreverRegra({ tipo: 'unica', ano: 2027, mes: 4, diaDoMes: 3 })).toBe('3 de abril de 2027, uma vez só')
    expect(descreverRegra({ tipo: 'pascoa', deslocaDias: 0 })).toBe('no domingo de Páscoa')
    expect(descreverRegra({ tipo: 'pascoa', deslocaDias: -47 })).toBe('47 dias antes da Páscoa')
    expect(descreverRegra({ tipo: 'pascoa', deslocaDias: 1 })).toBe('1 dia depois da Páscoa')
  })
})

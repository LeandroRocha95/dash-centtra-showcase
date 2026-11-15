import { describe, it, expect } from 'vitest'
import { pascoa, enesimoDiaDaSemana, dataDoAno, paraYmd, diasEntre, somaDias } from './datas'

const dow = (d: Date) => d.getUTCDay() // 0 = domingo

describe('Páscoa', () => {
  // ⚠️ A CONFERÊNCIA QUE IMPORTA: um erro de implementação sai do dia da
  // semana. Páscoa que não cai em domingo é bug, sem precisar de tabela.
  it('cai SEMPRE num domingo, por trinta anos', () => {
    for (let ano = 2020; ano <= 2050; ano++) {
      expect(dow(pascoa(ano)), `Páscoa de ${ano}`).toBe(0)
    }
  })

  it('bate com anos conhecidos', () => {
    expect(paraYmd(pascoa(2024))).toBe('2024-03-31')
    expect(paraYmd(pascoa(2025))).toBe('2025-04-20')
    expect(paraYmd(pascoa(2026))).toBe('2026-04-05')
    expect(paraYmd(pascoa(2027))).toBe('2027-03-28')
  })

  // A Páscoa gregoriana vive entre 22/03 e 25/04. Fora disso é erro.
  it('fica dentro da faixa possível', () => {
    for (let ano = 2020; ano <= 2050; ano++) {
      const p = paraYmd(pascoa(ano)).slice(5)
      expect(p >= '03-22' && p <= '04-25', `${ano}: ${p}`).toBe(true)
    }
  })
})

describe('enésimo dia da semana', () => {
  it('2º domingo de maio é o Dia das Mães', () => {
    expect(paraYmd(enesimoDiaDaSemana(2026, 5, 7, 2))).toBe('2026-05-10')
    expect(paraYmd(enesimoDiaDaSemana(2027, 5, 7, 2))).toBe('2027-05-09')
  })

  it('2º domingo de agosto é o Dia dos Pais', () => {
    expect(paraYmd(enesimoDiaDaSemana(2026, 8, 7, 2))).toBe('2026-08-09')
  })

  it('sempre devolve o dia da semana pedido', () => {
    for (let ano = 2025; ano <= 2035; ano++) {
      for (let mes = 1; mes <= 12; mes++) {
        expect(dow(enesimoDiaDaSemana(ano, mes, 7, 1))).toBe(0) // domingo
        expect(dow(enesimoDiaDaSemana(ano, mes, 5, 3))).toBe(5) // sexta
      }
    }
  })

  // O 1º cai no dia 1 quando o mês já começa naquele dia da semana.
  it('acerta quando o mês começa no próprio dia da semana', () => {
    // 01/02/2026 é um domingo
    expect(paraYmd(enesimoDiaDaSemana(2026, 2, 7, 1))).toBe('2026-02-01')
  })
})

describe('as datas móveis do varejo', () => {
  // Carnaval (terça) é 47 dias antes da Páscoa — é o que trava o Q1 inteiro.
  it('Carnaval sai da Páscoa e cai sempre numa terça', () => {
    for (let ano = 2024; ano <= 2035; ano++) {
      const c = dataDoAno({ tipo: 'pascoa', deslocaDias: -47 }, ano)!
      expect(dow(c), `Carnaval de ${ano}`).toBe(2)
    }
    expect(paraYmd(dataDoAno({ tipo: 'pascoa', deslocaDias: -47 }, 2026)!)).toBe('2026-02-17')
    expect(paraYmd(dataDoAno({ tipo: 'pascoa', deslocaDias: -47 }, 2027)!)).toBe('2027-02-09')
  })

  it('Sexta-Feira Santa é dois dias antes, e cai numa sexta', () => {
    for (let ano = 2024; ano <= 2035; ano++) {
      expect(dow(dataDoAno({ tipo: 'pascoa', deslocaDias: -2 }, ano)!)).toBe(5)
    }
  })

  // Black Friday = sexta depois da 4ª quinta de novembro.
  it('Black Friday cai sempre numa sexta, entre 23 e 29 de novembro', () => {
    const regra = { tipo: 'enesimo' as const, mes: 11, dow: 4, n: 4, deslocaDias: 1 }
    for (let ano = 2024; ano <= 2040; ano++) {
      const bf = dataDoAno(regra, ano)!
      expect(dow(bf), `BF de ${ano}`).toBe(5)
      const d = bf.getUTCDate()
      expect(d >= 23 && d <= 29, `BF de ${ano} no dia ${d}`).toBe(true)
    }
    expect(paraYmd(dataDoAno(regra, 2026)!)).toBe('2026-11-27')
    expect(paraYmd(dataDoAno(regra, 2027)!)).toBe('2027-11-26')
  })

  it('data fixa é a data fixa', () => {
    expect(paraYmd(dataDoAno({ tipo: 'fixa', mes: 12, diaDoMes: 25 }, 2026)!)).toBe('2026-12-25')
    expect(paraYmd(dataDoAno({ tipo: 'fixa', mes: 6, diaDoMes: 12 }, 2026)!)).toBe('2026-06-12')
  })
})

describe('aritmética de dias', () => {
  it('conta os dias entre duas datas civis', () => {
    expect(diasEntre('2026-08-31', '2026-09-10')).toBe(10)
    expect(diasEntre('2026-09-10', '2026-08-31')).toBe(-10)
    expect(diasEntre('2026-08-31', '2026-08-31')).toBe(0)
  })

  // A âncora de meio-dia UTC existe para isto: virada de horário de verão não
  // pode fazer "+1 dia" virar 23 ou 25 horas e escorregar de dia.
  it('não escorrega de dia na virada do ano nem em mês curto', () => {
    expect(paraYmd(somaDias(new Date(Date.UTC(2026, 11, 31, 12)), 1))).toBe('2027-01-01')
    expect(paraYmd(somaDias(new Date(Date.UTC(2028, 1, 28, 12)), 1))).toBe('2028-02-29') // bissexto
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1)
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2) // bissexto
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// REGRA INVÁLIDA
//
// As regras do catálogo são código revisado em PR. As do cliente vivem num
// `jsonb`, e `Date.UTC` transborda calado: mês 13 vira janeiro do ano seguinte,
// dia 99 anda três meses. Mostrar "Black Friday em 3 de janeiro" com toda a
// confiança é pior que não mostrar nada, porque alguém age em cima.
describe('regra malformada não vira data errada', () => {
  const nada = (r: Parameters<typeof dataDoAno>[0]) => expect(dataDoAno(r, 2026)).toBeNull()

  it('recusa mês e dia fora da faixa', () => {
    nada({ tipo: 'fixa', mes: 13, diaDoMes: 1 })
    nada({ tipo: 'fixa', mes: 0, diaDoMes: 1 })
    nada({ tipo: 'fixa', mes: 1, diaDoMes: 32 })
    nada({ tipo: 'fixa', mes: 1, diaDoMes: 0 })
  })

  it('recusa o dia que o mês não tem, em vez de rolar para o mês seguinte', () => {
    nada({ tipo: 'fixa', mes: 4, diaDoMes: 31 })
    nada({ tipo: 'fixa', mes: 2, diaDoMes: 30 })
    // 29/02 existe em 2028 e não existe em 2026 — a mesma regra, dois anos.
    expect(paraYmd(dataDoAno({ tipo: 'fixa', mes: 2, diaDoMes: 29 }, 2028)!)).toBe('2028-02-29')
    expect(dataDoAno({ tipo: 'fixa', mes: 2, diaDoMes: 29 }, 2026)).toBeNull()
  })

  // Todo mês tem quatro de cada dia da semana; nem todo mês tem cinco.
  it('recusa a enésima ocorrência que transborda o mês', () => {
    // Setembro de 2026 começa numa terça: a 5ª terça seria 29/09 — existe.
    expect(paraYmd(dataDoAno({ tipo: 'enesimo', mes: 9, dow: 2, n: 5 }, 2026)!)).toBe('2026-09-29')
    // Mas a 5ª quarta de setembro/2026 cairia em 30/09... e a 5ª quinta, em
    // 01/10. Essa é a que precisa sumir.
    nada({ tipo: 'enesimo', mes: 9, dow: 4, n: 5 })
    nada({ tipo: 'enesimo', mes: 2, dow: 1, n: 5 })
    nada({ tipo: 'enesimo', mes: 1, dow: 3, n: 6 })
    nada({ tipo: 'enesimo', mes: 1, dow: 8, n: 1 })
  })

  // O deslocamento vem DEPOIS da enésima e pode atravessar de propósito: a
  // Cyber Monday é a 4ª quinta de novembro + 4 dias, e cai em dezembro.
  it('mas deixa o deslocamento atravessar o mês', () => {
    expect(paraYmd(dataDoAno({ tipo: 'enesimo', mes: 11, dow: 4, n: 4, deslocaDias: 4 }, 2030)!)).toBe('2030-12-02')
  })

  it('recusa lixo numérico', () => {
    nada({ tipo: 'fixa', mes: 1.5, diaDoMes: 1 })
    nada({ tipo: 'fixa', mes: NaN, diaDoMes: 1 })
    nada({ tipo: 'pascoa', deslocaDias: 9999 })
    nada({ tipo: 'unica', ano: 2026, mes: 2, diaDoMes: 30 })
  })
})

// SAZONALIDADE — taxonomia de nichos e calendário base do varejo brasileiro.
//
// ⚠️ ISTO É CÓDIGO, NÃO SEED DE BANCO, e a escolha é deliberada. O calendário
// base é curado e igual para todo mundo — como TIPOS no cofre e
// PERMISSION_CATALOG nas permissões. Em código ele é revisado em PR, testado, e
// não diverge entre ambientes. Semeado em tabela, precisaria de migração para
// corrigir uma data e de um job para renovar a cada 24 meses.
//
// O que o gestor cadastra (data própria do cliente) é que vive em tabela.

import type { RegraData } from './datas'

export type Nicho =
  | 'estetica_saude' | 'educacao' | 'ecommerce' | 'varejo_local' | 'alimentacao'
  | 'imobiliario' | 'arquitetura_design' | 'energia_solar' | 'industria_b2b'
  | 'servicos_profissionais' | 'software_saas' | 'automotivo' | 'moda_beleza'
  | 'turismo_eventos' | 'fitness' | 'pet' | 'financeiro_seguros' | 'outro'

export const NICHOS: { nicho: Nicho; label: string; exemplos: string }[] = [
  { nicho: 'estetica_saude', label: 'Estética e saúde', exemplos: 'clínica de estética, odontologia, dermatologia' },
  { nicho: 'educacao', label: 'Educação e cursos', exemplos: 'escola, curso livre, infoproduto' },
  { nicho: 'ecommerce', label: 'E-commerce', exemplos: 'loja virtual, marketplace' },
  { nicho: 'varejo_local', label: 'Varejo local', exemplos: 'loja física, comércio de bairro' },
  { nicho: 'alimentacao', label: 'Alimentação', exemplos: 'restaurante, delivery, padaria' },
  { nicho: 'moda_beleza', label: 'Moda e beleza', exemplos: 'vestuário, cosméticos, salão' },
  { nicho: 'fitness', label: 'Academia e fitness', exemplos: 'academia, estúdio, personal' },
  { nicho: 'pet', label: 'Pet', exemplos: 'petshop, clínica veterinária' },
  { nicho: 'turismo_eventos', label: 'Turismo e eventos', exemplos: 'agência, pousada, buffet' },
  { nicho: 'automotivo', label: 'Automotivo', exemplos: 'concessionária, oficina, acessórios' },
  { nicho: 'imobiliario', label: 'Imobiliário', exemplos: 'imobiliária, incorporadora, corretor' },
  { nicho: 'arquitetura_design', label: 'Arquitetura e design', exemplos: 'escritório de arquitetura, reforma, marcenaria' },
  { nicho: 'energia_solar', label: 'Energia solar', exemplos: 'integrador, instalação fotovoltaica' },
  { nicho: 'industria_b2b', label: 'Indústria e B2B', exemplos: 'fábrica, distribuidora, madeireira' },
  { nicho: 'servicos_profissionais', label: 'Serviços profissionais', exemplos: 'advocacia, contabilidade, consultoria' },
  { nicho: 'software_saas', label: 'Software e SaaS', exemplos: 'sistema, aplicativo, tecnologia' },
  { nicho: 'financeiro_seguros', label: 'Financeiro e seguros', exemplos: 'corretora, consórcio, crédito' },
  { nicho: 'outro', label: 'Outro', exemplos: 'nenhum dos anteriores' },
]

export const NICHO_LABEL = new Map(NICHOS.map((n) => [n.nicho, n.label]))
export const NICHOS_VALIDOS = new Set<string>(NICHOS.map((n) => n.nicho))

/**
 * Quem vende para o consumidor final. As datas grandes do varejo valem para
 * estes — e NÃO para todos: mandar "prepare a Black Friday" para uma madeireira
 * B2B é o tipo de aviso que ensina o gestor a ignorar a funcionalidade.
 */
const CONSUMO: Nicho[] = [
  'ecommerce', 'varejo_local', 'moda_beleza', 'alimentacao',
  'estetica_saude', 'fitness', 'pet', 'turismo_eventos', 'automotivo',
]

export type EventoBase = {
  id: string
  nome: string
  regra: RegraData
  /** Dias de antecedência em que a preparação deveria COMEÇAR. */
  preparo: number
  /** O que fazer, em uma linha. Vira o corpo do aviso. */
  acao: string
  nichos: Nicho[]
}

/**
 * O calendário base. Toda data sai de REGRA — nenhuma é digitada, então nenhuma
 * expira nem erra de digitação. As janelas de preparo são o coração da
 * funcionalidade: o valor está na antecedência, não na data.
 */
export const EVENTOS: EventoBase[] = [
  {
    id: 'ano_novo', nome: 'Virada de ano',
    regra: { tipo: 'fixa', mes: 12, diaDoMes: 31 }, preparo: 21,
    acao: 'Campanha de fim de ano e queima de estoque; o CPM sobe na última semana.',
    // Educação entra pela matrícula de janeiro, que se vende em dezembro.
    nichos: [...CONSUMO, 'educacao'],
  },
  {
    id: 'janeiro_recomeco', nome: 'Recomeço de janeiro',
    regra: { tipo: 'fixa', mes: 1, diaDoMes: 2 }, preparo: 21,
    acao: 'Público em modo "recomeçar": matrícula, plano e mudança de hábito.',
    nichos: ['fitness', 'educacao', 'estetica_saude'],
  },
  {
    id: 'volta_aulas', nome: 'Volta às aulas (1º semestre)',
    regra: { tipo: 'fixa', mes: 2, diaDoMes: 1 }, preparo: 30,
    acao: 'Período, não dia: matrícula, material e uniforme concentram em janeiro.',
    nichos: ['educacao', 'varejo_local', 'ecommerce'],
  },
  {
    id: 'carnaval', nome: 'Carnaval',
    regra: { tipo: 'pascoa', deslocaDias: -47 }, preparo: 21,
    acao: 'Semana morta para B2B e forte para consumo; ajuste verba nos dois sentidos.',
    nichos: [...CONSUMO, 'turismo_eventos'],
  },
  {
    id: 'dia_mulher', nome: 'Dia Internacional da Mulher',
    regra: { tipo: 'fixa', mes: 3, diaDoMes: 8 }, preparo: 14,
    acao: 'Presente e autocuidado; evite discurso oportunista sem oferta real.',
    nichos: ['moda_beleza', 'estetica_saude', 'ecommerce', 'varejo_local'],
  },
  {
    id: 'dia_consumidor', nome: 'Dia do Consumidor',
    regra: { tipo: 'fixa', mes: 3, diaDoMes: 15 }, preparo: 14,
    acao: 'A "Black Friday do primeiro semestre" no e-commerce; prepare oferta.',
    nichos: ['ecommerce', 'varejo_local', 'moda_beleza'],
  },
  {
    id: 'imposto_renda', nome: 'Declaração de Imposto de Renda',
    regra: { tipo: 'fixa', mes: 3, diaDoMes: 15 }, preparo: 21,
    acao: 'Demanda concentrada de março a maio; campanha de captação.',
    nichos: ['servicos_profissionais', 'financeiro_seguros'],
  },
  {
    id: 'pascoa', nome: 'Páscoa',
    regra: { tipo: 'pascoa', deslocaDias: 0 }, preparo: 21,
    acao: 'Pico de alimentação e presente; feriado prolongado derruba B2B.',
    nichos: ['alimentacao', 'ecommerce', 'varejo_local', 'turismo_eventos'],
  },
  {
    id: 'dia_maes', nome: 'Dia das Mães',
    regra: { tipo: 'enesimo', mes: 5, dow: 7, n: 2 }, preparo: 28,
    acao: 'A segunda maior data do varejo brasileiro. Criativo e verba com 4 semanas.',
    nichos: [...CONSUMO],
  },
  {
    id: 'namorados', nome: 'Dia dos Namorados',
    regra: { tipo: 'fixa', mes: 6, diaDoMes: 12 }, preparo: 21,
    acao: 'Presente, jantar e experiência; o pico de busca começa 10 dias antes.',
    nichos: ['alimentacao', 'moda_beleza', 'ecommerce', 'varejo_local', 'turismo_eventos', 'estetica_saude'],
  },
  {
    id: 'sao_joao', nome: 'São João',
    regra: { tipo: 'fixa', mes: 6, diaDoMes: 24 }, preparo: 21,
    acao: 'Forte no Nordeste e no interior; peso muito diferente por região.',
    nichos: ['alimentacao', 'varejo_local', 'turismo_eventos'],
  },
  {
    id: 'ferias_julho', nome: 'Férias de julho',
    regra: { tipo: 'fixa', mes: 7, diaDoMes: 1 }, preparo: 30,
    acao: 'Viagem e atividade para criança; B2B desacelera no mês.',
    nichos: ['turismo_eventos', 'educacao', 'alimentacao'],
  },
  {
    id: 'volta_aulas_agosto', nome: 'Volta às aulas (2º semestre)',
    regra: { tipo: 'fixa', mes: 8, diaDoMes: 1 }, preparo: 30,
    acao: 'Segunda janela de matrícula do ano, menor que a de janeiro mas com concorrência bem mais baixa.',
    nichos: ['educacao', 'varejo_local', 'ecommerce'],
  },
  {
    id: 'dia_pais', nome: 'Dia dos Pais',
    regra: { tipo: 'enesimo', mes: 8, dow: 7, n: 2 }, preparo: 28,
    acao: 'Presente masculino e experiência; prepare com 4 semanas.',
    nichos: [...CONSUMO],
  },
  {
    id: 'dia_cliente', nome: 'Dia do Cliente',
    regra: { tipo: 'fixa', mes: 9, diaDoMes: 15 }, preparo: 14,
    acao: 'Data de relacionamento e recompra; boa para base, fraca para aquisição.',
    nichos: ['ecommerce', 'varejo_local', 'moda_beleza', 'alimentacao'],
  },
  {
    id: 'dia_animal', nome: 'Dia dos Animais',
    regra: { tipo: 'fixa', mes: 10, diaDoMes: 4 }, preparo: 14,
    acao: 'Data própria do setor pet; alto engajamento orgânico.',
    nichos: ['pet'],
  },
  {
    id: 'dia_criancas', nome: 'Dia das Crianças',
    regra: { tipo: 'fixa', mes: 10, diaDoMes: 12 }, preparo: 21,
    acao: 'Brinquedo, vestuário infantil e passeio; concorrência sobe em outubro.',
    nichos: ['ecommerce', 'varejo_local', 'moda_beleza', 'turismo_eventos', 'alimentacao'],
  },
  {
    id: 'black_friday', nome: 'Black Friday',
    regra: { tipo: 'enesimo', mes: 11, dow: 4, n: 4, deslocaDias: 1 }, preparo: 45,
    acao: 'A maior data do ano. Verba, criativo e página com 6 semanas — quem entra em cima paga o CPM inflacionado.',
    // Educação entra: curso e infoproduto fazem Black Friday tão pesada quanto
    // o varejo, e deixá-la de fora esvaziaria o nicho justo na maior data.
    nichos: [...CONSUMO, 'educacao'],
  },
  {
    id: 'cyber_monday', nome: 'Cyber Monday',
    regra: { tipo: 'enesimo', mes: 11, dow: 4, n: 4, deslocaDias: 4 }, preparo: 45,
    acao: 'Segunda seguinte à Black Friday; aproveite o remarketing de quem não converteu.',
    nichos: ['ecommerce', 'software_saas', 'educacao'],
  },
  {
    id: 'natal', nome: 'Natal',
    regra: { tipo: 'fixa', mes: 12, diaDoMes: 25 }, preparo: 45,
    acao: 'Presente e ceia. O CPM sobe desde a Black Friday e não cede até o dia 24.',
    nichos: [...CONSUMO],
  },
]

/**
 * Datas de quem vende para EMPRESA, não para consumidor.
 *
 * Sem elas, cinco dos clientes reais da base — madeireira, imobiliária,
 * arquitetura, solar, software — ficariam com a funcionalidade vazia, porque
 * nenhuma data do varejo se aplica a eles. Não é que B2B não tenha
 * sazonalidade: é outra, e ninguém a escreve porque o calendário do varejo
 * ocupa todo o espaço.
 */
const B2B: Nicho[] = [
  'industria_b2b', 'software_saas', 'servicos_profissionais',
  'imobiliario', 'arquitetura_design', 'energia_solar', 'financeiro_seguros',
]

EVENTOS.push(
  {
    id: 'ferias_coletivas', nome: 'Parada de fim de ano (B2B)',
    regra: { tipo: 'fixa', mes: 12, diaDoMes: 20 }, preparo: 21,
    acao: 'Decisão de compra congela até fevereiro. Antecipe o fechamento ou reduza verba — lead que entra aqui responde só em janeiro.',
    nichos: [...B2B],
  },
  {
    id: 'fechamento_orcamento', nome: 'Fechamento de orçamento anual (B2B)',
    regra: { tipo: 'fixa', mes: 11, diaDoMes: 1 }, preparo: 30,
    acao: 'Empresa gastando o que sobrou do ano e definindo o do ano que vem. Janela boa para proposta e contrato.',
    nichos: [...B2B],
  },
  {
    id: 'retomada_fevereiro', nome: 'Retomada pós-Carnaval (B2B)',
    regra: { tipo: 'pascoa', deslocaDias: -40 }, preparo: 21,
    acao: 'O ano comercial começa de verdade depois do Carnaval. Recomponha verba e reative quem não respondeu em janeiro.',
    nichos: [...B2B],
  },
)

export const EVENTO_POR_ID = new Map(EVENTOS.map((e) => [e.id, e]))

/** Os eventos base que importam para um nicho. Sem nicho, nenhum. */
export function eventosDoNicho(nicho: Nicho | null): EventoBase[] {
  if (!nicho) return []
  return EVENTOS.filter((e) => e.nichos.includes(nicho))
}

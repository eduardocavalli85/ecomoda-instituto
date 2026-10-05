/**
 * Configuração pública do Instituto EcoModa.
 *
 * ATENÇÃO: este arquivo é versionado e vai para o navegador de quem acessa o site.
 * Por isso aqui ficam APENAS dados públicos. Nunca coloque senhas, tokens ou
 * chaves de API neste arquivo (veja a seção "Segurança" do README).
 *
 * Os valores abaixo são fictícios, para demonstração. Troque pelos reais antes
 * de usar em produção (ou, melhor, carregue-os de um backend).
 */
window.ECOMODA_CONFIG = {
  loja: {
    nome: "Instituto EcoModa Sustentável",
    cidade: "Curitiba",
    whatsapp: "5541900000000", // DDI+DDD+número, só dígitos (fictício)
    instagram: "@institutoecomoda",
  },

  // Chave PIX FICTÍCIA. Chave PIX é dado público de recebimento (não é uma senha),
  // mesmo assim não versionamos a chave real da ONG neste repositório de exemplo.
  pix: {
    chave: "pix@ecomoda.example",
    beneficiario: "INSTITUTO ECOMODA",
    cidade: "CURITIBA",
  },

  // Frete: origem Curitiba (CEP 8xxxx). Tabela por região do CEP (1º dígito).
  // Valores ilustrativos; em produção, trocar por API dos Correios/Melhor Envio
  // chamada a partir de um backend (as credenciais NUNCA ficam no front-end).
  frete: {
    gratisAcimaDe: 400,
    adicionalPorPeca: 6,
    zonas: {
      8: { nome: "Sul (PR/SC)", valor: 18, prazo: "3 a 5 dias úteis" },
      9: { nome: "Sul (RS)", valor: 26, prazo: "4 a 6 dias úteis" },
      0: { nome: "Sudeste (SP)", valor: 24, prazo: "4 a 6 dias úteis" },
      1: { nome: "Sudeste (SP)", valor: 24, prazo: "4 a 6 dias úteis" },
      2: { nome: "Sudeste (RJ/ES)", valor: 28, prazo: "5 a 7 dias úteis" },
      3: { nome: "Sudeste (MG)", valor: 28, prazo: "5 a 7 dias úteis" },
      7: { nome: "Centro-Oeste", valor: 36, prazo: "6 a 9 dias úteis" },
      4: { nome: "Nordeste", valor: 44, prazo: "8 a 12 dias úteis" },
      5: { nome: "Nordeste", valor: 44, prazo: "8 a 12 dias úteis" },
      6: { nome: "Norte / Nordeste", valor: 48, prazo: "9 a 14 dias úteis" },
    },
  },

  // Fatores usados para estimar o impacto ecológico por quilo de tecido
  // reaproveitado. São ESTIMATIVAS ILUSTRATIVAS: o Instituto deve validar com
  // seus próprios dados/fornecedores antes de divulgar (evita greenwashing).
  impacto: {
    aguaLitrosPorKg: 7000, // água evitada na produção de tecido novo (algodão)
    co2KgPorKg: 15, // kg de CO2e evitados por kg de tecido novo
  },

  reservaMinutos: 15, // tempo que uma peça única fica reservada no carrinho
};

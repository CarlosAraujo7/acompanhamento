// ============================================================================
//  CONFIGURAÇÃO DO SITE
//  Este arquivo é público (fica no GitHub). NÃO coloque senhas aqui.
// ============================================================================
window.APP_CONFIG = {
  // Cole entre as aspas a URL do "App da Web" do Google Apps Script (termina em /exec).
  // Exemplo: 'https://script.google.com/macros/s/AKfycb.../exec'
  API_URL: 'https://script.google.com/macros/s/AKfycbwdCo1stUNA_5zo5HKzeKVU4nO5cRimZDJb1ukVJ9OkJKYFFfiWyaC_30sgNN-uDzVHYg/exec',

  // De quantos em quantos segundos o site busca as mudanças feitas pela outra pessoa.
  POLL_SECONDS: 15,

  // Tamanho máximo de cada arquivo, em MB. Precisa ser igual ou menor que
  // TAMANHO_MAXIMO_MB do arquivo backend/Code.gs.
  MAX_UPLOAD_MB: 50,
};

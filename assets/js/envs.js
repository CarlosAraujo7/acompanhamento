/* Os dois ambientes do sistema. Tudo que muda entre "Trabalho" e "Acompanhamento" fica aqui. */
(function (SA) {
  'use strict';

  const STATUS_IDS = ['todo', 'doing', 'waiting', 'done'];

  SA.ENVS = {
    trabalho: {
      id: 'trabalho',
      label: 'Trabalho',
      icon: 'briefcase',
      tagline: 'Demandas, clientes e entregas',
      itemSingular: 'demanda',
      itemPlural: 'Demandas',
      newItem: 'Nova demanda',
      emptyTitle: 'Nenhuma demanda por aqui',
      emptyText: 'Cadastre a primeira demanda: quem é o cliente, o tipo de serviço e o valor combinado.',
      statuses: { todo: 'A fazer', doing: 'Em andamento', waiting: 'Aguardando cliente', done: 'Entregue' },
      kindLabel: 'Tipo de serviço',
      kindPlaceholder: 'Ex.: Revisão, Formatação…',
      kindOptions: ['Revisão', 'Formatação', 'Normalização (ABNT)', 'Revisão + Formatação', 'Tradução', 'Elaboração', 'Outro'],
      kindFree: true,
      partyLabel: 'Cliente (para quem é)',
      partyPlaceholder: 'Nome do cliente',
      partyRequired: true,
      hasValue: true,
      dueLabel: 'Prazo de entrega',
      titlePlaceholder: 'Ex.: TCC da Maria — formatação ABNT',
      defaultTabs: [
        { name: 'Material do cliente', type: 'files' },
        { name: 'O que entregar', type: 'notes' },
        { name: 'Entregas', type: 'checklist' },
      ],
      tabSuggestions: ['Manuais de normalização', 'Pesquisa em andamento', 'Material do cliente', 'O que entregar', 'Entregas', 'Versões enviadas'],
      defaultView: 'board',
    },
    acompanhamento: {
      id: 'acompanhamento',
      label: 'Acompanhamento',
      icon: 'heart',
      tagline: 'Faculdade, estágio e artigos',
      itemSingular: 'atividade',
      itemPlural: 'Atividades',
      newItem: 'Nova atividade',
      emptyTitle: 'Nada cadastrado ainda',
      emptyText: 'Cadastre trabalhos da faculdade, pendências do estágio, artigos e as datas importantes.',
      statuses: { todo: 'Pendente', doing: 'Em andamento', waiting: 'Aguardando', done: 'Concluída' },
      kindLabel: 'Categoria',
      kindPlaceholder: '',
      kindOptions: ['Faculdade', 'Estágio', 'Artigo', 'Outro'],
      kindFree: false,
      partyLabel: 'Disciplina ou local',
      partyPlaceholder: 'Ex.: Anatomia, Hospital Central…',
      partyRequired: false,
      hasValue: false,
      dueLabel: 'Data / prazo',
      titlePlaceholder: 'Ex.: Entregar resumo do capítulo 3',
      defaultTabs: [
        { name: 'Materiais', type: 'files' },
        { name: 'O que fazer', type: 'notes' },
        { name: 'Checklist', type: 'checklist' },
      ],
      tabSuggestions: ['Materiais', 'Artigo em andamento', 'Relatório de estágio', 'O que fazer', 'Checklist'],
      defaultView: 'agenda',
    },
  };

  SA.STATUS_IDS = STATUS_IDS;
  SA.TAB_TYPES = {
    files: { label: 'Arquivos', icon: 'folder', hint: 'Guardar e baixar arquivos (manuais, pesquisa, versões…).' },
    notes: { label: 'Texto', icon: 'fileText', hint: 'Escrever o que precisa ser feito ou entregue.' },
    checklist: { label: 'Checklist', icon: 'checkSquare', hint: 'Lista do que está pronto, com arquivos em cada item.' },
  };
})((window.SA = window.SA || {}));

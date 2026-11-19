# Sistema de Acompanhamento

Um sistema simples, de cores calmas (nada de neon), para organizar **demandas de trabalho** e **o acompanhamento de atividades da faculdade, estágio e artigos**. Dois ambientes no mesmo sistema, cada pessoa entra com o seu login e as alterações aparecem para todo mundo sem precisar recarregar a página.

- **Ambiente Trabalho**: cadastro da demanda (cliente, tipo de serviço, valor cobrado, prazo, quem é o responsável), quadro por status, e dentro de cada demanda abas para arquivos do cliente, texto do que entregar e checklist de entregas com anexos.
- **Ambiente Acompanhamento**: o mesmo modelo, para atividades da faculdade, pendências do estágio e artigos, com agenda por datas (atrasadas, hoje, próximos 7 dias…).
- **Logins fixos**: um para você (acessa os dois ambientes), um para a parceira de trabalho (só Trabalho) e um para a esposa (só Acompanhamento).

---

## Respostas diretas às suas perguntas

**1. Dá para sincronizar as alterações de vocês usando o GitHub Pages?**
O GitHub Pages sozinho **não**: ele só hospeda arquivos do site e não guarda dados. A sincronização vem de um "servidor" gratuito que trabalha junto com ele. Aqui esse servidor é um script do **Google Apps Script** na sua conta Google. O site fica no GitHub Pages, o script guarda e entrega os dados. Tudo grátis, sem cartão de crédito.

**2. Dá para usar o Drive como base de dados?**
Sim, e é o que este projeto faz:
- os **dados** (demandas, abas, checklists, quem mexeu em quê) ficam numa **Planilha Google** criada sozinha na sua pasta "Sistema de Acompanhamento" do Drive; você pode abri-la a qualquer hora, filtrar e somar os valores;
- os **arquivos enviados** ficam em **pastas do seu Drive** (uma pasta por demanda);
- a parceira e a esposa **não precisam de conta Google**: elas entram pelo login do sistema.

**3. Existe algo melhor que seja grátis?** Pesquisei as opções:

| Opção | Resultado |
|---|---|
| **Google Apps Script + Planilha + Drive** (escolhida) | Grátis, sem cartão, usa o Drive como você pediu, 15 GB de espaço. Contras: cada ação leva cerca de 1 a 2 segundos, e a sincronização é por consulta a cada 15 s (não é instantânea). |
| Supabase | Também é grátis e sincroniza mais rápido, mas projetos gratuitos **pausam após 1 semana sem uso**, o limite é de 50 MB por arquivo e a configuração é mais técnica. |
| Firebase | O armazenamento de arquivos hoje **exige o plano pago** (cartão de crédito), então foi descartado. |

Fontes: [limites do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [cotas do Apps Script](https://developers.google.com/apps-script/guides/services/quotas), [mudança de armazenamento do Firebase](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) e [planos do Supabase](https://supabase.com/pricing).

---

## Como funciona

```
 Celular / computador  ──►  Site no GitHub Pages  ──►  Script no Google (servidor)
 (cada pessoa com login)     (só telas, sem dados)        ├─ Planilha Google  = dados
                                                          └─ Google Drive     = arquivos
```

- O site não guarda nada importante. Quem decide se a pessoa pode entrar e o que ela vê é o **script no Google**.
- Cada alteração é enviada na hora. A cada 15 segundos (e sempre que você volta para a aba) o site pergunta ao servidor se a outra pessoa mudou algo.
- Se a internet cair, o que você fez fica guardado no aparelho e é enviado quando voltar.
- Se duas pessoas editarem **o mesmo texto** ao mesmo tempo, o sistema não apaga nada em silêncio: ele mostra os dois e você escolhe "juntar", "manter a minha" ou "usar a dela".

---

## Instalação (cerca de 20 minutos)

### Parte 1: o servidor no Google

1. Entre em **<https://script.google.com>** com a sua conta Google e clique em **Novo projeto**. Dê o nome que quiser (ex.: *Acompanhamento*).
2. Apague o código de exemplo que aparece. Abra o arquivo **`backend/Code.gs`** deste projeto, copie tudo e cole no editor. Salve (Ctrl + S).
3. **Troque os logins e as senhas.** No começo do código há a lista `USUARIOS`:
   - `nome` é como a pessoa aparece no sistema;
   - `senha` precisa ter **pelo menos 8 caracteres**. Se continuar como "troque-esta-senha…", o login é recusado de propósito;
   - mantenha `ambientes` como está (quem acessa o quê).
   Faça isso **aqui no editor do Google, não no arquivo do computador**, para a senha nunca ir parar no GitHub.
4. No menu de funções (acima do código) escolha **`configurar`** e clique em **Executar**.
   - O Google pede permissão. Clique em *Revisar permissões*, escolha a sua conta e, na tela "O Google não verificou este app", clique em **Avançado** e depois em **Acessar … (não seguro)** e **Permitir**. É normal: o script é seu.
   - Quando terminar, o **Registro de execução** mostra os links da planilha e da pasta criadas no seu Drive.
5. Clique em **Implantar → Nova implantação**. Na engrenagem ao lado de "Selecionar tipo" escolha **App da Web** e preencha:
   - **Executar como:** *Eu*
   - **Quem pode acessar:** ***Qualquer pessoa***
   Clique em **Implantar** e **copie a "URL do app da Web"** (termina em `/exec`).
6. **Teste rápido:** cole essa URL no navegador. Deve aparecer algo como `{"ok":true,"servico":"sistema-acompanhamento"…}`. Se aparecer, o servidor está no ar.

### Parte 2: o site no GitHub Pages

7. Abra o arquivo **`config.js`** (pode ser no Bloco de Notas) e cole a URL entre as aspas de `API_URL`. Salve.
8. Crie uma conta em **<https://github.com>** (grátis) e clique em **New repository**. Escolha um nome (ex.: `acompanhamento`) e marque **Public**. O GitHub Pages gratuito exige repositório público; não tem problema, porque **nenhum dado nem senha fica no repositório**.
9. No repositório novo, clique em **uploading an existing file** e arraste para lá **o conteúdo desta pasta, menos a pasta `backend`** (ou seja: `index.html`, `config.js`, a pasta `assets` e os demais arquivos). Clique em **Commit changes**.
10. Vá em **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e salve.
11. Depois de 1 a 2 minutos, o endereço aparece no topo da página: `https://SEU-USUARIO.github.io/acompanhamento/`. Esse é o endereço do sistema. Passe-o para a parceira e para a esposa junto com o usuário e a senha de cada uma.

### Primeiro teste recomendado

Antes de passar o endereço para as outras pessoas: entre com o seu login, crie uma demanda de teste, envie um arquivo pequeno na aba de arquivos, baixe-o de volta e abra o sistema em outro aparelho para ver a alteração aparecer. Isso confirma que o servidor do Google está respondendo corretamente.

---

## Usando o sistema

**Entrar:** use o usuário e a senha que você definiu. "Manter conectado" mantém o login por 30 dias naquele aparelho. Quem tem acesso aos dois ambientes alterna pelo seletor no topo.

**Trabalho → nova demanda:** título, cliente, tipo de serviço (revisão, formatação… ou o que você digitar), valor cobrado, se já foi pago, prazo e responsável. O topo mostra *Em aberto*, *A receber* e *Recebido*.

**Dentro de cada demanda há abas.** Já vêm três: **Material do cliente** (arquivos), **O que entregar** (texto) e **Entregas** (checklist). Use **Nova aba** para criar quantas quiser e escolha o tipo:
- **Arquivos:** arraste ou escolha arquivos; qualquer um pode baixar. Crie uma aba por tipo (ex.: *Manuais de normalização*, *Pesquisa em andamento*);
- **Texto:** escrever o que precisa ser feito ou entregue; salva sozinho enquanto você digita;
- **Checklist:** vá marcando o que ficou pronto e **anexe o arquivo final em cada item** (clipe de papel); o sistema mostra quem marcou e quando.

**Acompanhamento:** funciona igual, com categorias (Faculdade, Estágio, Artigo, Outro), disciplina ou local e a **Agenda**, que agrupa por data: atrasadas, hoje, próximos 7 dias, mais para frente e sem data. Dá para alternar para o **Quadro** por status.

**Ver o que a outra pessoa fez:** o sino mostra a *Atividade recente* (quem fez o quê e quando) e um aviso aparece quando alguém muda algo. Nos cartões aparece "Atualizado por …".

---

## Limites e cuidados

- **Arquivos:** até **50 MB** cada. Os maiores que 4 MB são guardados em partes dentro da pasta da demanda (`arquivo.pdf.parte1de3`) e o sistema junta tudo na hora de baixar. **Exclua arquivos pelo sistema**, não direto no Drive; se apagar lá, o download daquele arquivo deixa de funcionar. O que for excluído pelo sistema vai para a **lixeira do Drive** (recuperável por 30 dias).
- **Senhas:** ficam só no `Code.gs`, dentro da sua conta Google. Depois de 8 erros seguidos o login daquele usuário é bloqueado por 10 minutos. Trocar uma senha no código derruba as sessões abertas daquela pessoa.
- **A Planilha é a sua cópia de segurança:** abra *Arquivo → Histórico de versões* para voltar no tempo. Pode abri-la para consultar e somar valores, mas **não edite as colunas à mão** (principalmente as de ID).
- **Cotas do Google:** o uso previsto (3 pessoas) fica muito abaixo dos limites gratuitos.
- **Responsabilidade:** o servidor roda com as permissões da sua conta Google. Quem tem o link do site vê apenas a tela de login; os dados só são entregues depois da senha.

### Atualizar o servidor depois de mexer no `Code.gs`

Só salvar **não** atualiza o que está no ar. Vá em **Implantar → Gerenciar implantações**, clique no lápis, em *Versão* escolha **Nova versão** e clique em **Implantar**. A URL continua a mesma.

---

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "Servidor não configurado" na tela de login | A `API_URL` do `config.js` está vazia. Cole a URL do passo 5 e envie o arquivo de novo ao GitHub. |
| "O servidor respondeu algo inesperado…" | Confira se a implantação está com **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**, e se a URL termina em `/exec`. Depois de qualquer mudança no código, faça uma **Nova versão**. |
| "Configuração pendente no servidor: a senha ainda é a de exemplo" | Troque as senhas na lista `USUARIOS` (mínimo 8 caracteres) e faça uma Nova versão. |
| "Muitas tentativas erradas" | Aguarde 10 minutos e tente de novo. |
| "Sem conexão com o servidor" | Sem internet ou o Google fora do ar por instantes. O sistema guarda o que você fez e reenvia sozinho. |
| Falha ao enviar arquivos grandes | Reduza o tamanho das partes: troque `4 * 1024 * 1024` por `2 * 1024 * 1024` em **dois lugares**, em `assets/js/store.js` (`PART_BYTES`) e em `backend/Code.gs` (`PART_BYTES`), e faça uma Nova versão. |
| A página parece não ter atualizado depois de eu mudar um arquivo | Recarregue com Ctrl + F5. |

---

## O que tem em cada arquivo

```
index.html            página única do sistema
config.js             a URL do servidor (único arquivo que você precisa editar no site)
assets/styles.css     cores e layout (tema claro e escuro automático)
assets/js/            lógica do site (login, sincronização, telas)
assets/vendor/        biblioteca Preact + htm (código aberto, licenças incluídas)
backend/Code.gs       o servidor: cole no Google Apps Script (NÃO envie ao GitHub)
backend/appsscript.json   configuração opcional do Apps Script
```

Para ajustar campos, rótulos e status de cada ambiente, o arquivo é `assets/js/envs.js`.

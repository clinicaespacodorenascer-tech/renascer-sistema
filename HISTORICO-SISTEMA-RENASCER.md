# Protocolo de entrega atual (a partir de 12/10/2026)

O Elismael passou a usar o GitHub Desktop no Mac (antes era só o editor web do GitHub, colando
arquivo por arquivo). A partir desta data, TODA entrega de código para o sistema do Espaço do
Renascer segue este formato — substitui o formato anterior (colar manualmente no editor web):

1. Toda alteração vem num .zip para ele baixar.
2. Dentro do zip, os arquivos ficam nas MESMAS pastas do projeto (ex.: backend/src/routes/arquivo.js,
   frontend/src/pages/arquivo.js) — para ele saber exatamente onde colocar cada um.
3. O zip contém SÓ os arquivos que mudaram ou são novos — nunca o projeto inteiro.
4. Um zip por atualização. Se ele ainda não subiu a entrega anterior, tudo junto num zip só; se já
   subiu, manda só o que é novo.
5. Junto com o zip, sempre vem por escrito: a lista de arquivos com caminho completo (marcando
   quais são novos), a mensagem de commit pronta para colar no GitHub Desktop, e se precisa de algo
   a mais no servidor (ou "não precisa de nada no servidor").

Como ele sobe: arrasta ARQUIVO POR ARQUIVO para dentro da pasta do projeto no Mac, substituindo o
antigo, depois faz Commit e Push pelo GitHub Desktop. Nunca pedir para ele apagar ou substituir uma
pasta inteira ou o repositório todo — se for preciso apagar algum arquivo, avisar qual e por quê,
com o caminho completo. Nunca incluir arquivos .DS_Store no zip.

Segurança: nunca pedir para ele colar senha, chave de API ou token no chat — chaves vão direto nas
variáveis do servidor (Railway, Variables). Não apagar dados do sistema automaticamente —
exclusão só com botão e confirmação dele.

Banco de dados: se mudar o schema.prisma, avisar e garantir que só ADICIONA (nunca remove campo
ou modelo que já existe em produção — ver o alerta já registrado sobre "prisma db push
--accept-data-loss" rodar sozinho no deploy do Railway), e dizer se o servidor aplica sozinho ao
subir (sim, sempre, automaticamente).

Comunicação: responder em português simples, sem termo técnico desnecessário. Antes de mudança
grande, explicar o plano em poucas linhas e esperar confirmação. Testar antes de mandar e dizer o
que foi testado. Manter este documento de histórico atualizado a cada fase (o que mudou e em quais
arquivos) e mandar ele também junto no zip.

Pastas principais do projeto e onde cada uma roda:

- backend/ — Node.js + Express + Prisma + PostgreSQL. Hospedado no Railway (API + banco de
  dados). Todo push no GitHub dispara um novo deploy automático lá, que já roda "prisma db push"
  sozinho (aplica o schema novo no banco de produção).
- frontend/ — Next.js + Tailwind CSS. Hospedado na Vercel (o site/app que o Elismael, as
  profissionais, a atendente e os clientes acessam no navegador ou instalam como app — PWA, desde
  a Fase 10). Todo push no GitHub dispara um novo deploy automático lá também.

---

# Sistema Espaço do Renascer — Status (Fase 1)

Construído em 02/09/2026, nos mesmos moldes do CRM da TurbinaADS: backend em Node.js + Express +
Prisma + PostgreSQL, frontend em Next.js + Tailwind, hospedagem em GitHub → Railway (API + banco) →
Vercel (app).

## As 4 áreas de login

- **Profissional**: agenda estilo Trello por dia da semana, chat/recados com o cliente, financeiro
  (resumo mensal, calculadora de repasse, upload de comprovante com leitura automática via IA da
  Anthropic, registro de pacote pago), lista de clientes, relatórios (público/privado), aviso
  automático de renovação na 2ª/3ª sessão, **perfil completo (foto, idade, categorias/o que atende,
  abordagem)** e disponibilidade semanal (ela mesma libera seus horários).
- **Cliente**: contrato obrigatório no primeiro acesso (nome, CPF, foto do documento) antes de
  liberar o resto do app; agendamento; reagendamento com regra de 24h; troca de profissional
  (bloqueada até encerrar o pacote atual, depois abre escolha de nova profissional); renovação/troca
  de plano e sessão extra (finalizados no WhatsApp por enquanto); chat/recados; diário de humor
  opcional com emojis; biblioteca de tarefas de apoio por tema (com aviso de que não é diagnóstico);
  relatórios públicos; avisos/notificações; suporte com opção de escalar direto pra gerência; link
  para e-book/Hotmart; FAQ; tela de videochamada (pronta pra plugar o Daily.co).
- **Donos** (2 logins): visão geral do negócio, todos os profissionais e seus clientes, financeiro
  consolidado por profissional, criação de novos logins (agora incluindo login de Cliente, ver Fase
  6), suporte escalado.
- **Atendente**: cadastro de novos clientes (agora escolhendo a senha do cliente, ver Fase 6), aba
  "Profissionais e agendar" com o perfil completo de cada profissional (foto, idade, categorias,
  abordagem, disponibilidade), vê os horários livres reais (já descontando sessões marcadas) e
  agenda exatamente o horário que o cliente pediu, registro de pacote pago, agenda geral (leitura),
  suporte escalado (leitura) — sem acesso a financeiro.

## Esquema de agenda

1. A profissional libera sua disponibilidade semanal (dia + faixa de horário) no próprio perfil.
2. O sistema calcula automaticamente, pra qualquer data, os horários exatos livres dentro dessa
   faixa (dividindo por sessões de 30 ou 50min e descontando o que já está ocupado por sobreposição
   real de intervalo, não só por horário de início).
3. Hoje, é a atendente quem vê esses horários (junto ao perfil da profissional) e agenda pro cliente.
4. Fase futura (a definir): o próprio cliente escolhe o horário direto no app, usando essa mesma base
   de cálculo — ainda não habilitado por decisão do Elismael.

## Regra financeira

Divisão padrão 50%/50% entre profissional e Renascer sobre tudo que entra (configurável por
profissional, campo `Profissional.percentualRepasse`, hoje só ajustável direto no banco — não tem
tela de edição). Ex: pacote de R$170 → R$85 pra profissional, R$85 pra Renascer.

## Planos oficiais (iguais ao site)

- 30 minutos: 1 sessão R$60 · 2 sessões R$100 · 4 sessões R$170
- 50 minutos: 1 sessão R$110 · 2 sessões R$180 · 4 sessões R$320

## Decisões tomadas na Fase 1

- Vídeo chamada: Daily.co (falta criar conta e configurar a chave de API)
- Leitura automática de comprovante: IA da Anthropic (mesmo padrão do CRM da Turbineads)
- Pagamento de renovação/sessão extra: continua indo pro WhatsApp por enquanto (Mercado Pago fica
  pra uma fase futura, quando decidirem integrar de verdade)

## Pendências reais da Fase 1

- Integrar Daily.co de verdade (conta + `DAILY_API_KEY` no Railway)
- Storage de arquivos de verdade pra fotos de documento de contrato (Cloudinary ou S3) — os
  comprovantes financeiros já não dependem mais disso, ver Fase 3
- Pagamento automático dentro do app via Mercado Pago (conta já existe no CNPJ do Espaço do Renascer)
- Habilitar o cliente a escolher o próprio horário de agendamento (base já pronta no backend)
- Criar repositório GitHub, projeto Railway (Postgres + backend) e projeto Vercel específicos pra
  esse sistema (separados do site institucional e do CRM da Turbineads)

## Entrega da Fase 1

Entregue como zip (backend/ + frontend/ + README com passo a passo de deploy), atualizado no mesmo
dia com o esquema de agenda. Backend e frontend validados por checagem de sintaxe completa, teste
unitário manual da lógica de horários livres, e build de produção do Next.js sem erros; o teste de
ponta a ponta com banco real acontece no primeiro deploy no Railway (`prisma db push` já configurado
em `railway.json`), já que o sandbox de desenvolvimento não tem acesso de rede aos binários do
Prisma — mesma limitação já vista no desenvolvimento do CRM da Turbineads.

---

# Fase 2 — Notificações, gestão de usuários, mobile e autocadastro (03/09/2026)

Sistema já em produção (GitHub → Railway → Vercel). A partir daqui, toda entrega de código é feita
como instruções de copiar/colar no editor web do GitHub (o Elismael não usa terminal/git — aplica
tudo manualmente e o deploy é automático).

## Lembretes e notificações automáticas por e-mail

- `backend/src/utils/email.js`: envio via Gmail SMTP (nodemailer). Só funciona se `EMAIL_USER` e
  `EMAIL_APP_PASSWORD` estiverem configurados no Railway; sem isso, não quebra nada, só loga no
  console e segue o fluxo normalmente.
- `backend/src/utils/lembretes.js`: dispara automaticamente
  - lembrete de sessão 24h antes e ~6h antes (campos `Agendamento.lembrete24hEmailEm` /
    `lembrete6hEmailEm` evitam reenvio duplicado);
  - aviso de renovação de pacote perto da data marcada (`Cliente.renovarEm` +
    `renovarEmAvisoEnviado` / `Pacote.avisoRenovacaoEmailEm`).
- Rodando via `setInterval` a cada 15 minutos dentro do `server.js` (não usa lib de cron externa),
  chamado uma vez no boot e depois recorrente — sobrevive a restart porque os campos de controle
  ficam salvos no banco.
- **Pendência de decisão do usuário**: WhatsApp automático (via API paga, tipo Twilio/WhatsApp
  Business API) foi avaliado e descartado por enquanto — o usuário escolheu e-mail automático
  grátis como caminho principal. Os links de WhatsApp direto (`wa.me`) continuam existindo nas
  telas para contato manual (troca de plano, renovação, suporte), mas isso é diferente de
  notificação automática via WhatsApp.

## Gestão hierárquica de usuários (login)

Criada porque o Elismael não conseguia excluir usuários de teste.

- `backend/src/utils/excluirUsuario.js`: exclusão em cascata segura (`$transaction`) por tipo de
  login — cliente, profissional, atendente, dono (bloqueia excluir o último Dono restante).
- **Atendente**: só pode excluir login de cliente (`DELETE /atendente/clientes/:id`).
- **Dono**: pode excluir, editar (nome/e-mail/telefone/senha) qualquer login — cliente, profissional,
  atendente ou outro dono (`PUT/DELETE /dono/usuarios/:id`), com bloqueio de autoexclusão e de
  excluir o último Dono.

## Contato de notificação e data de renovação por cliente

Campos novos em `Cliente`: `notifEmail`, `notifTelefone`, `renovarEm`. Editáveis por atendente,
profissional (da própria cliente) ou dono, via `PUT /clientes/:id/notificacao` em cada rota —
usados pelos lembretes automáticos acima.

## Dashboard consolidado e autocadastro de clientes antigos pelas profissionais

Pra evitar que a atendente tenha que recadastrar clientes que a profissional já atendia antes do
sistema existir:

- Nova aba **"Cadastrar cliente"** na área da Profissional — ela mesma cadastra clientes antigos,
  já preenchendo: pacote (duração, total de sessões, sessões restantes, valor), e dia da semana +
  horário fixo já combinado com a cliente. Ao salvar com dia/horário fixo, o sistema cria
  automaticamente o `Pacote` e o primeiro `Agendamento` já na Agenda dela, no dia/horário certo
  (com checagem de conflito de horário).
- Dashboard do Dono agora mostra `clientesPorProfissional` (contagem por profissional, visão total
  da Renascer).
- Dashboard da Profissional mostra a contagem só dos próprios clientes (não da plataforma toda).

## Redesign mobile

- `frontend/src/components/Layout.js`: menu lateral (gaveta) no mobile, ativado por botão hambúrguer
  (☰), com as categorias corretas por tipo de login; desktop mantém a barra horizontal de abas.
- `frontend/src/lib/whatsapp.js`: helper `linkWhatsapp(mensagem)` com o número oficial do WhatsApp
  (`5575983203429`), usado em botões de contato contextual (troca de plano, renovação, suporte).
- Correção de bug: `window.open()` chamado depois de um `await` era bloqueado como pop-up pelo
  navegador do celular — corrigido abrindo a aba em branco antes do `await` e só definindo o
  destino (`.location`) depois da resposta chegar.
- Correção de vazamento horizontal ("vazamento azul na lateral"): um `<select>` com texto de opção
  muito longo forçava a linha (flex sem `flex-wrap`) a estourar a largura da tela no Safari iOS.
  Corrigido com `flex-wrap` + largura máxima no select + `flex-1 min-w-[...]` nos campos vizinhos,
  em cinco pontos do app (cliente, atendente, dono, profissional ×2), mais uma rede de segurança
  global em `globals.css` (`overflow-x: hidden; max-width: 100vw` no `html, body`).
- Reagendamento de sessão pelo cliente: campo confuso de "ID da sessão" trocado por um `<select>`
  com as próprias sessões da cliente em texto legível; dia da semana passou a ser calculado
  automaticamente a partir da data escolhida (em vez de campo solto que podia ficar incoerente com
  a data).

## Bug corrigido: crash na aba Clientes do Dono

"Application error: a client-side exception has occurred" ao clicar num cliente. Causa: uma edição
anterior tinha referenciado uma função `carregar()` que não existia nesse componente (existia só na
versão do Atendente). Corrigido adicionando a função que faltava.

## Status da Fase 2

Usuário confirmou "pronto fiz o outro" em 03/09/2026 — considerar a Fase 2 concluída e aplicada em
produção (mobile + cadastro com pacote/dia fixo pela profissional).

---

# Fase 3 — Comprovante anexado + contabilização automática (entregue em 03/09/2026, aguardando teste do usuário)

Pedido original do Elismael (guardado e implementado na sequência, depois da Fase 2 confirmada):
anexar comprovante na contratação/pagamento/renovação feita pela atendente (fica guardado pra ver
depois), contabilização automática "a receber hoje" no painel do Dono (zera sozinho todo dia, por
ser filtro de data — não é um job que zera nada), total "recebido no mês" (já existia, mantido),
anexo de renovação pela profissional com cálculo automático do repasse de 50%, e detalhamento de
quanto o Dono vai receber de cada profissional.

## Como foi resolvida a pendência de storage (Cloudinary/S3)

Em vez de integrar um storage externo (que exigiria conta/credenciais novas), os comprovantes
financeiros passaram a ser guardados como base64 direto no Postgres (`TransacaoFinanceira.comprovanteBase64`
+ `comprovanteMimeType`), suficiente pro volume de uma clínica pequena. As fotos de documento do
Contrato do cliente (`fotoDocumentoUrl`) continuam como pendência separada — ver Fase 1.

## O que foi implementado

- **Atendente**: dentro de "Profissionais e agendar" → "Registrar contratação, pagamento ou
  renovação" (era "Registrar pacote"), agora escolhe o tipo (contratação nova / renovação / sessão
  extra / outro), anexa o comprovante (imagem) e o valor. O backend (`POST
  /atendente/clientes/:id/pacotes`) cria o `Pacote` E uma `TransacaoFinanceira` já com o repasse
  calculado (`calcularRepasse`, usa o `percentualRepasse` da profissional). Na aba Clientes, cada
  cliente expandido mostra "Pagamentos registrados" com botão "Ver comprovante" (histórico
  permanente, via `GET /atendente/clientes/:id/transacoes` + `GET /comum/transacoes/:id/comprovante`).
- **Profissional**: aba Financeiro ganhou a seção "Anexar renovação ou pagamento" — escolhe cliente
  e tipo, anexa comprovante, o valor pode vir da leitura automática por IA (Anthropic) ou manual, e
  mostra quanto ela vai receber. A tabela "Transações do mês" ganhou botão "Ver comprovante" por
  linha.
- **Dono**: card novo "A receber hoje" na Visão geral — total bruto do dia, quanto vai pras
  profissionais, quanto o Dono recebe (`valorRenascer`), e o detalhamento "Profissional X → R$ Y"
  por profissional, tudo hoje. Esse número não precisa ser zerado manualmente: é sempre um filtro
  `data >= hoje 00h` no banco, então amanhã já nasce zerado sozinho. Os totais mensais que já
  existiam (`faturamentoMes`, `repasseProfissionaisMes`, `receitaRenascerMes`) foram mantidos como
  "recebido no mês". A aba Financeiro ganhou uma tabela com todas as transações do mês e botão "Ver
  comprovante" por linha, além da tabela por profissional que já existia.
- Rota nova compartilhada `GET /comum/transacoes/:id/comprovante`: dono e atendente veem qualquer
  comprovante; profissional só vê os das próprias transações; cliente não tem acesso.
- `frontend/src/lib/comprovante.js` (novo): helper `verComprovante(id)` (abre a imagem numa aba
  nova, com o mesmo cuidado de abrir a aba em branco antes do await pra não travar no celular) e
  `lerArquivoBase64(file)`.

## Pendências / aguardando teste do usuário

- Confirmar que o registro de pagamento pela atendente cria a transação certa e que "Ver
  comprovante" abre a imagem corretamente (testado só localmente por sintaxe, não ponta a ponta
  com banco real — mesma limitação de sempre do sandbox de desenvolvimento).
- Confirmar visualmente o card "A receber hoje" no Dono e a tabela de transações do mês.
- Avaliar mais adiante se o Elismael quer um fluxo de "marcar como recebido" (ex: quando ele de fato
  recebe o repasse da profissional) — hoje "a receber hoje" é só o total do que foi registrado no
  dia, não tem um passo separado de confirmação de recebimento.

---

# Fase 4 — Situação do cliente, fila de reativação, histórico e status por cores (entregue em 03/09/2026, testada e em produção)

Pedido do Elismael com 8 itens, resumindo: dar às profissionais (e à atendente) o poder de marcar
o andamento de cada cliente, criar um fluxo de "não renovou → fila de reativação → histórico" sem
apagar ninguém do sistema, e um sistema de cores (semáforo) que acompanha o ciclo do pacote de 4
sessões, com pop-up de renovação pro cliente.

## Decisões tomadas com o usuário (via pergunta direta)

- Regra do vermelho: dispara se a 4ª sessão terminar sem renovação **ou** se a data de renovação
  (`Cliente.renovarEm`) já tiver passado — o que vier primeiro.
- Pop-up de renovação: aviso mais leve (âmbar) ao concluir a 3ª sessão, reforço mais urgente
  (vermelho) ao concluir a 4ª.
- Quem pode marcar a situação do cliente (ativo/renovou/excluir): profissional **e** atendente
  (o pedido original citava só a profissional, mas o usuário confirmou que a atendente também
  precisa).
- Número de WhatsApp do pop-up de renovação: o usuário não chegou a informar um número novo, então
  foi reaproveitado o `WHATSAPP_RENASCER` que o sistema já usa em outras telas (troca de plano,
  renovação, suporte) — `frontend/src/lib/whatsapp.js`. Se quiser trocar, é só uma linha nesse
  arquivo.

## O que foi implementado

- **Situação do cliente** (`Cliente.situacao`: ATIVO/EXCLUIDO): profissional e atendente marcam
  "ativo", "renovou" ou "excluir (não renovou)" na ficha do cliente
  (`PUT /profissional|atendente/clientes/:id/situacao`). Excluir não apaga login nem histórico — só
  tira o cliente da lista da profissional (zera `profissionalAtualId`), o que automaticamente faz
  ele aparecer na fila de reativação.
- **WhatsApp de cadastro imutável**: campo novo `Cliente.whatsappCadastro`, preenchido uma vez no
  momento do cadastro (por atendente ou profissional) e nunca mais alterado — é o número usado na
  fila de reativação mesmo que o cliente depois troque o telefone de contato normal.
- **Fila de reativação** (aba nova "Reativar clientes" em Atendente e Dono): lista clientes com
  `situacao: EXCLUIDO`, mostrando nome, pacote que tinha e WhatsApp de cadastro, com botão direto
  pro WhatsApp e opção de reativar já vinculando com uma profissional
  (`GET /clientes-reativar` + `PUT /clientes/:id/reativar`).
- **Histórico completo** (aba nova "Histórico", só visível ao Dono): tabela `HistoricoCliente`,
  log append-only com snapshot de nome/whatsapp/pacote/profissional no momento do evento
  (ENTROU/RENOVOU/EXCLUIDO/REATIVADO), pra manter o registro legível mesmo se os dados do cliente
  mudarem depois (`GET /dono/historico-clientes`).
- **Status por cores (semáforo)**: `backend/src/utils/statusCliente.js` calcula
  VERDE/AMARELO/VERMELHO a partir do pacote ativo e da data de renovação — usado tanto na agenda
  da profissional quanto nas listas de clientes (profissional, atendente, dono). Verde na 1ª/2ª
  sessão, amarelo assim que a 3ª sessão é concluída, vermelho na 4ª sessão concluída sem renovar ou
  com renovação atrasada.
- **Bolinha pulsante** (`frontend/src/components/StatusCliente.js`): efeito "premium" feito só com
  a classe `animate-ping` do Tailwind (sem CSS customizado), aparece do lado do nome do cliente.
- **Notificação na 3ª sessão**: ao marcar a 3ª sessão como realizada, o sistema já registra o nível
  de aviso do pop-up (`Pacote.avisoPopupNivel`) — reaproveita a notificação por e-mail que já
  existia (Fase 2) pra avisar cliente e profissional da renovação.
- **Pop-up de renovação pro cliente**: aparece no painel dele ao entrar, se o pacote ativo tiver
  `avisoPopupNivel` e ainda não tiver sido visto (`Pacote.popupVisualizadoEm`). Visual em gradiente
  âmbar (3ª sessão) ou vermelho (4ª sessão), botão que já abre o WhatsApp com mensagem pronta pra
  renovar. Fechar o pop-up marca como visto (`PUT /cliente/pacote/:id/popup-visto`) pra não
  reaparecer a cada vez que o cliente atualiza a página.

## Arquivos novos ou alterados

- `backend/prisma/schema.prisma`: enums `SituacaoCliente`, `TipoEventoHistorico`; modelo
  `HistoricoCliente`; campos novos em `Cliente` (`situacao`, `whatsappCadastro`) e em `Pacote`
  (`avisoPopupNivel`, `popupVisualizadoEm`).
- `backend/src/utils/statusCliente.js` (novo).
- `backend/src/routes/profissional.js`, `atendente.js`, `dono.js`, `cliente.js` (rotas novas de
  situação, reativação, histórico e popup-visto; `statusCliente` anexado nas listagens e na
  agenda).
- `frontend/src/components/StatusCliente.js` e `SituacaoCliente.js` (novos, compartilhados).
- `frontend/src/pages/profissional/index.js`, `atendente/index.js`, `dono/index.js`,
  `cliente/index.js`: abas e componentes novos (fila de reativação, histórico, marcação de
  situação, bolinha de status, pop-up de renovação).

## Status da Fase 4: testada em produção, com dois bugs corrigidos no meio do caminho

O deploy da Fase 4 exigiu várias rodadas de correção — documentado abaixo porque revela um
problema recorrente no fluxo de trabalho (copiar/colar no editor do GitHub) que vale a pena o
Claude de sessões futuras já saber de cara.

### Bug de colagem: a tag `<a` desaparece quando fica sozinha numa linha

Em pelo menos duas rodadas de deploy (`atendente/index.js`, `dono/index.js` e `cliente/index.js`),
o build do Vercel falhou com erros do tipo "Expected ',', got 'href'" ou "Unexpected token... Did
you mean '{'>'}' ou '&gt;'?". Comparando o código enviado com o que realmente ficou no arquivo
depois da colagem do Elismael, ficou claro o padrão: sempre que uma tag `<a` abre sozinha numa
linha (atributos como `href`, `target`, `rel` nas linhas seguintes), essa linha do `<a` some
inteira na colagem, deixando os atributos órfãos e quebrando o JSX. Tags `<button>`, `<select>`,
`<div>` etc. com a mesma estrutura multi-linha NUNCA tiveram esse problema — só `<a` sozinho numa
linha. Hipótese: algum mecanismo de autolink no caminho de cópia do usuário (extensão de
navegador, app de notas, etc.) está interceptando especificamente esse padrão.

**Mitigação permanente**: todo link de WhatsApp que era um `<a href={...} target="_blank">` com a
tag `<a` sozinha numa linha foi trocado por um `<button onClick={() => window.open(url,
"_blank")}>` — mesmo comportamento pro usuário, mas sem o padrão que causa a corrupção. Já
aplicado em `atendente/index.js`, `dono/index.js` e `cliente/index.js` (fila de reativação e
pop-up de renovação). **Lição pra sessões futuras**: evitar `<a` como tag de abertura sozinha em
uma linha nas instruções de colagem pro Elismael — preferir `<button onClick={() =>
window.open(...)}>` desde o início, ou pelo menos manter a tag `<a href=...>` toda na mesma linha
(nunca vi corrupção nesse padrão de uma linha só).

Um segundo tipo de corrupção observado no mesmo lote: um template literal (crase) aninhado dentro
de outro (crase externa com um `${...}` que continha uma segunda crase multi-linha) virou aspas
simples na colagem, quebrando a sintaxe. Trocado por concatenação de string simples (`+`) sem
crases aninhadas. Template literals de um nível só (mesmo multi-linha) nunca mostraram esse
problema.

### Bug de lógica: crash ao abrir "Reativar clientes" quando algum cliente não tem WhatsApp salvo

Depois dos builds passarem, o app quebrava ("Application error: a client-side exception has
occurred") ao abrir a aba "Reativar clientes". Causa: o cálculo do link do WhatsApp
(`c.whatsapp.replace(...)`) rodava pra todo cliente da lista, sem checar antes se `c.whatsapp`
existia — se algum cliente da fila não tinha WhatsApp cadastrado, o `.replace` de `undefined`
travava a página inteira. Corrigido em `atendente/index.js` e `dono/index.js`: o link só é
calculado quando `c.whatsapp` existe (`const linkReativar = c.whatsapp ? ... : null`), e o botão
só aparece quando `linkReativar` não é nulo.

Depois dessas três correções (dois bugs de colagem + um bug de lógica), o Elismael confirmou que
os deploys do atendente, dono e cliente passaram e a Fase 4 está em produção. Pendente apenas o
teste manual de ponta a ponta do fluxo completo (marcar como excluído → aparecer na fila →
reativar → ver no histórico), que ainda não foi confirmado explicitamente.

---

# Fase 5 — Avisos automáticos pra profissional: nova sessão agendada e repasse a receber (entregue em 03/09/2026, aguardando teste do usuário)

Pedido do Elismael: quando a atendente fecha um pagamento de cliente (comprovante + valor), isso já
devia sinalizar automaticamente pro dono quanto ele vai receber naquele dia, com o cálculo de 50%,
e indicando de qual profissional é aquele valor — e a profissional devia ser avisada tanto de uma
sessão nova agendada quanto de quando tem um repasse pra receber.

## O que já existia (não precisou construir de novo)

Ao investigar o código antes de implementar, boa parte do pedido já estava pronta desde a Fase 3:

- Atendente já anexa comprovante e registra o valor na hora de fechar o pagamento
  (`RegistrarPacote`, `POST /atendente/clientes/:id/pacotes`).
- O sistema já calcula automaticamente o repasse (`calcularRepasse`, usa
  `Profissional.percentualRepasse`, 50% por padrão, configurável por profissional só via banco).
- O dono já vê no painel dele, no mesmo dia, quanto vai receber no total e detalhado por
  profissional ("A receber hoje" + "Quanto você vai receber de cada profissional hoje").
- O vínculo de qual profissional recebe aquele valor já é automático (usa a profissional já
  vinculada ao cliente, `cliente.profissionalAtualId`) — decisão confirmada com o usuário: manter
  assim, sem seletor manual pra atendente escolher a profissional na hora do pagamento.

## O que foi implementado agora

Dois avisos novos pra profissional, usando o sistema de notificações que já existia
(`Notificacao` no schema + helper `notificar()` em `backend/src/utils/notificar.js`), sem
precisar de nenhuma migração de banco:

- **Nova sessão agendada**: quando a atendente marca um horário pra um cliente
  (`POST /atendente/agendamentos`), a profissional recebe na hora um aviso com o nome do cliente,
  a data e o horário da sessão.
- **Novo repasse a receber**: quando a atendente registra um pagamento/comprovante
  (`POST /atendente/clientes/:id/pacotes`), a profissional recebe na hora um aviso dizendo o nome
  do cliente e o valor exato do repasse calculado (`valorProfissional`) — decisão confirmada com o
  usuário: o aviso é disparado no momento do registro do pagamento (não existe, e não foi pedido,
  um controle separado de "pago/pendente" pro repasse — é só um aviso informativo de quanto ela
  tem a receber).

Ambos aparecem na aba de avisos/notificações da profissional, do mesmo jeito que os avisos de
renovação já existentes.

## Arquivo alterado

- `backend/src/routes/atendente.js`: as duas rotas (`POST /agendamentos` e
  `POST /clientes/:id/pacotes`) ganharam uma chamada extra a `notificar()` pra profissional, além
  das notificações que já existiam (pro cliente). Mudança só de backend — não mexe no Vercel,
  só no Railway.

## Pendências / aguardando teste do usuário

- Confirmar que a profissional recebe os dois avisos corretamente depois que a atendente marca uma
  sessão nova e registra um pagamento.
- Avaliar, numa fase futura, se vale a pena criar uma tela pro dono editar o `percentualRepasse` de
  cada profissional (hoje só é ajustável direto no banco).

---

# Fase 6 — Contrato sem texto de demonstração, senha escolhida no cadastro do cliente, Dono criando login de Cliente, e login por CPF/telefone (entregue em 04/09/2026, aguardando teste do usuário)

Pedido do Elismael, em várias mensagens seguidas:

1. Remover do contrato do cliente o texto "(Texto de demonstração — recomenda-se revisão por um
   profissional jurídico antes da publicação definitiva.)" — "Nao precisa desse texto no contrato,
   esta tudo certo."
2. A atendente precisa poder escolher a senha do login do cliente no cadastro (não só receber uma
   gerada automaticamente).
3. O Dono não conseguia criar login de Cliente (só Profissional/Atendente/Dono) — "quero te acesso
   a tudo de todos". Junto veio uma declaração mais ampla: acesso a tudo de todo mundo, "menos as
   informacoes de laudo, relatorio ou conversas privadas dos profissionais e clientes".
4. A Profissional (que já tinha cadastro próprio de cliente antigo) também precisa poder escolher a
   senha do cliente, não só receber uma gerada.
5. Todos os tipos de login (dono, atendente, profissional, cliente) devem poder entrar com CPF ou
   telefone, além de e-mail.

## Sobre o pedido 3 (acesso amplo do Dono) — não precisou de código novo

Antes de mexer em qualquer coisa, foi investigado o que o Dono já enxerga hoje: `backend/src/routes/dono.js`
não tem nenhuma rota de chat (`/chat`), relatórios (`/relatorios`) ou laudo — só a Profissional e o
próprio Cliente têm acesso a essas rotas. Ou seja, a regra "acesso a tudo, menos laudo/relatório/
conversas privadas" **já é o comportamento atual do sistema** e não precisou de nenhuma mudança —
só a criação de login de Cliente (item numerado abaixo) estava realmente faltando.

## O que foi implementado

- **Contrato sem o texto de demonstração**: `TEXTO_CONTRATO` em `backend/src/routes/cliente.js`
  agora termina no item "8. ACEITE: ...", sem a frase de aviso jurídico.
- **Atendente escolhe a senha do cliente**: campo novo "Senha do login (opcional, senão é gerada
  uma)" no formulário de cadastro em `frontend/src/pages/atendente/index.js` (`Clientes()`),
  mandando `senhaProvisoria` pro backend — o backend (`POST /atendente/clientes`) já aceitava esse
  campo opcional desde antes, só faltava o campo no formulário.
- **Profissional escolhe a senha do cliente**: mesmo campo adicionado em
  `frontend/src/pages/profissional/index.js` (`AbaCadastrarCliente`), mandando `senhaProvisoria`
  pro backend (`POST /profissional/clientes`, que também já aceitava o campo).
- **Dono cria login de Cliente**: `backend/src/routes/dono.js` (`POST /usuarios`) ganhou
  `"CLIENTE"` na lista de papéis aceitos, com um bloco novo que cria o `Cliente` vinculado
  (`profissionalAtualId` opcional, `whatsappCadastro` a partir do telefone informado) e registra
  `HistoricoCliente` tipo `"ENTROU"` — mesmo padrão que atendente.js e profissional.js já usavam.
  Como o Dono não tem registro de `Atendente`, o campo `cadastradoPorId` fica vazio (é opcional no
  schema). No frontend, `frontend/src/pages/dono/index.js` (`Usuarios()`) ganhou a opção "Cliente"
  no seletor de papel e, quando escolhida, mostra um seletor extra pra vincular uma profissional
  (opcional) — busca a lista via `GET /dono/profissionais`, que já existia.
- **Login por CPF ou telefone**: `User` (schema.prisma) ganhou um campo `cpf` (opcional, sem
  unicidade — só `email` continua único). `POST /auth/login` foi reescrito: se o texto digitado
  tem "@", busca por e-mail como sempre; senão, extrai só os dígitos e busca por `telefone` OU
  `cpf` do próprio `User`, OU pelo `cpf` salvo no cadastro do `Cliente` (que é preenchido no aceite
  do contrato — ver abaixo). A tela de login (`frontend/src/pages/login.js`) trocou o campo de
  "E-mail" (`type="email"`) por "E-mail, CPF ou telefone" (`type="text"`, pra não bloquear dígitos
  puros com a validação nativa do navegador).
- **De onde vem o CPF pra login**: o único ponto do sistema que hoje captura CPF é o aceite do
  contrato do cliente (`POST /cliente/contrato/aceitar`) — a rota foi ajustada pra também gravar
  esse CPF no `User` (além do `Contrato` e do `Cliente`, como já fazia), então o cliente passa a
  poder logar com CPF assim que aceita o contrato pela primeira vez. Dono, Atendente e Profissional
  **não têm** nenhum campo de captura de CPF ainda — pra eles, login por enquanto funciona só por
  e-mail ou telefone (o campo `telefone` já existia e já é comparado no login).

## Arquivos alterados

- `backend/prisma/schema.prisma`: campo `cpf String?` novo em `User`.
- `backend/src/routes/auth.js`: `POST /login` reescrito pra aceitar e-mail, CPF ou telefone.
- `backend/src/routes/cliente.js`: `TEXTO_CONTRATO` sem o aviso de demonstração;
  `POST /contrato/aceitar` agora também grava o CPF no `User` do cliente.
- `backend/src/routes/dono.js`: `POST /usuarios` aceita papel `"CLIENTE"`.
- `frontend/src/pages/login.js`: campo de identificador vira texto livre (e-mail/CPF/telefone).
- `frontend/src/pages/atendente/index.js`: campo de senha no cadastro de cliente.
- `frontend/src/pages/profissional/index.js`: campo de senha no cadastro de cliente antigo.
- `frontend/src/pages/dono/index.js`: opção "Cliente" + seletor de profissional no cadastro de
  novo login.

## Caveat técnico (não é bug, é uma limitação aceita)

`telefone` e `cpf` em `User` não têm restrição de unicidade no banco (ao contrário do `email`, que
sempre foi único). Isso significa que, em teoria, se dois usuários diferentes acabassem cadastrados
com o mesmo número de telefone (por engano, por exemplo), o login por telefone pegaria sempre o
primeiro que o banco encontrar. Pra uma clínica do tamanho da Renascer isso é um risco baixo, e
resolver dá pra fazer depois (ex: exigir telefone único), mas fica registrado aqui como trade-off
consciente, não como esquecimento.

## Pendências / aguardando teste do usuário

- Confirmar que os 8 arquivos (4 backend + 4 frontend) foram colados sem erro de build.
- Testar o fluxo completo: Dono criando um login de Cliente novo, cliente conseguindo entrar com a
  senha definida; atendente/profissional cadastrando cliente com senha escolhida; cliente
  conseguindo logar com CPF depois de aceitar o contrato; qualquer login testando entrar com
  telefone.
- Decidir, numa fase futura, se vale a pena adicionar um campo de CPF nos cadastros de
  Dono/Atendente/Profissional (hoje só o Cliente tem captura de CPF, via contrato).

---

# Fase 7 — Financeiro completo: pagamento já no cadastro, repasse "quem recebeu" e trava antiduplicidade (entregue em 04/09/2026, aguardando teste do usuário)

Pedido do Elismael, em sequência (depois de eu explicar que cadastrar um cliente sozinho não
contabilizava nada, e que o cadastro de cliente antigo pela profissional criava o Pacote mas não a
transação financeira — uma inconsistência que eu mesmo apontei e ele pediu pra corrigir junto):

1. A atendente, ao cadastrar um cliente, precisa conseguir lançar de uma vez o valor do
   pacote/sessões (ou de uma renovação), indo direto pro financeiro.
2. Nova aba pro Dono conseguir lançar quanto recebeu de repasse de uma profissional específica.
3. Quando a profissional lança um valor que ela recebeu direto (na aba financeiro dela), ela
   precisa conseguir marcar que já repassou — isso zera a parte que ela devia mandar pra Renascer.
4. Trava antiduplicidade: se a atendente (ou a atendente e a profissional) registrarem o mesmo
   comprovante/valor pro mesmo cliente no mesmo dia, o sistema não pode contar 2 vezes pro
   repasse. Critério definido pelo próprio usuário: mesmo cliente + mesmo valor + mesmo dia.
5. Pedido geral: deixar toda a parte financeira (dono, atendente, profissional) coerente/redonda,
   já que os três lados mexem em dinheiro de formas diferentes.

## Conceito novo: "quem recebeu o dinheiro" (`recebidoPor`)

Até a Fase 6, toda `TransacaoFinanceira` tratava o valor como se tivesse entrado igual, mas na
prática há duas situações bem diferentes:

- **CLINICA** (padrão): o cliente pagou pra clínica, e é a atendente quem registra — nesse caso, é
  a clínica que deve repassar a parte da profissional (fluxo que já existia desde a Fase 3/5).
- **PROFISSIONAL**: o cliente pagou direto pra profissional (Pix/dinheiro na mão dela), e é ela
  quem registra — nesse caso, é a PROFISSIONAL que fica devendo a parte da Renascer pra clínica.

Campo novo `TransacaoFinanceira.recebidoPor` (enum `QuemRecebeu`: `CLINICA` | `PROFISSIONAL`),
preenchido automaticamente pela origem do registro (não é um campo que o usuário escolhe na tela):
tudo que é criado pelas rotas da atendente nasce `CLINICA`; tudo que é criado pelas rotas da
própria profissional (cadastro de cliente antigo com valor, "Pacote/pagamento" da ficha do
cliente, ou "Anexar renovação ou pagamento" no Financeiro) nasce `PROFISSIONAL`.

Só quando `recebidoPor = PROFISSIONAL` é que existe uma pendência de repasse pra fechar — os
campos novos `repassado` (Boolean), `repassadoEm` (data) e `repassadoObs` (texto livre, pra
auditoria) controlam isso. Duas pessoas podem fechar essa pendência: a própria profissional
(marca sozinha, sabe que já mandou o Pix) ou o Dono (confirma que recebeu, aba Repasses).

## O que foi implementado, por pedido

### 1. Atendente lança pagamento junto com o cadastro

`POST /atendente/clientes` ganhou campos opcionais (`tipo`, `duracao`, `totalSessoes`,
`valorTotal`, `imagemBase64`, `mimeType`, `observacao`) — se a atendente informar um valor (e tiver
escolhido a profissional no mesmo formulário), o sistema já cria o `Pacote` E a
`TransacaoFinanceira` (`recebidoPor: "CLINICA"`) no mesmo request, contabilizando na hora no "A
receber hoje" do Dono. O seletor de tipo inclui "Renovação", então também serve pra lançar
renovação já no cadastro (embora na prática renovação normalmente aconteça num cliente já
existente, via "Registrar contratação, pagamento ou renovação", que continua existindo do jeito
que já era). Sem valor informado, o cadastro continua funcionando exatamente como antes (só cria o
login).

### 2. Aba "Repasses" pro Dono

Aba nova em `frontend/src/pages/dono/index.js`, ligada a três rotas novas em
`backend/src/routes/dono.js`:

- `GET /dono/repasses-pendentes`: lista, agrupado por profissional, tudo que está com
  `recebidoPor: PROFISSIONAL` e `repassado: false`, com o total pendente de cada uma.
- `PUT /dono/repasses/:transacaoId/marcar`: marca uma transação específica como recebida.
- `POST /dono/repasses/:profissionalId/lancar`: o Dono digita só um valor ("recebi R$X dessa
  profissional") e o sistema marca sozinho, do mais antigo pro mais novo, as pendências dela até
  bater esse valor (FIFO) — não precisa caçar uma por uma, mas continua baseado em transações
  reais (não é um lançamento solto/fantasma).

O card "A receber hoje" do Dono ganhou um aviso extra (`totalPendenteRepasseProfissionais`) quando
existe pendência, e a aba Financeiro geral passou a mostrar, por transação, se foi "Clínica",
"Profissional (pendente)" ou "Profissional (repassado)".

### 3. Profissional marca que já repassou

Rota nova `PUT /profissional/financeiro/:id/repassar` — só funciona nas transações da própria
profissional com `recebidoPor: PROFISSIONAL`. Na aba Financeiro dela, cada transação desse tipo
mostra um botão "Marcar repasse feito (R$ X)"; depois de marcado, vira um selo "Já repassado". Um
card novo no topo ("Você ainda deve repassar") soma tudo que está pendente, pra ela nunca perder
de vista.

Aproveitei pra fechar a inconsistência que eu tinha identificado: o cadastro de cliente antigo
pela profissional (`POST /profissional/clientes`) e o "Pacote/pagamento" da ficha do cliente
(`POST /profissional/clientes/:id/pacotes`) criavam o `Pacote` mas **não** a `TransacaoFinanceira`
— ou seja, um valor informado ali não contava em lugar nenhum do financeiro. As duas rotas agora
também criam a transação (`recebidoPor: PROFISSIONAL`), com o mesmo cálculo de repasse de sempre.

### 4. Trava antiduplicidade

Função nova `transacaoDuplicada()` em `backend/src/utils/financeiro.js`: antes de criar qualquer
`TransacaoFinanceira`, checa se já existe uma pra esse mesmo `clienteId`, com o mesmo `valorTotal`,
registrada no mesmo dia (hoje) — exatamente o critério que o Elismael pediu (mesmo cliente + mesmo
valor + mesmo dia). Se achar, a rota não cria de novo: devolve um aviso amigável em vez de duplicar
o repasse. Aplicado em todos os pontos que criam transação: cadastro da atendente com pagamento,
"Registrar contratação/pagamento/renovação" da atendente, cadastro da profissional com pagamento,
"Pacote/pagamento" da ficha do cliente pela profissional, e "Anexar renovação ou pagamento" da
profissional (quando um cliente é selecionado).

### 5. "Deixar redondo" — o que ficou consistente entre os três papéis

- As mesmas duas peças (`recebidoPor` + trava antiduplicidade) valem pra atendente e profissional,
  então o mesmo pagamento nunca conta duas vezes nem fica "invisível" dependendo de quem lançou.
- O Dono agora enxerga, numa tabela só (Financeiro) e numa aba dedicada (Repasses), tanto o
  dinheiro que entrou pela clínica quanto o que as profissionais receberam direto — antes só o
  primeiro tipo aparecia de forma útil.
- Nenhuma tela antiga quebrou: cadastro sem valor continua funcionando igual, "Registrar
  pacote"/"Anexar comprovante" continuam do jeito que eram (só ganharam o `recebidoPor` e a trava
  por baixo dos panos).

## Arquivos alterados

- `backend/prisma/schema.prisma`: enum `QuemRecebeu` novo; campos `recebidoPor`, `repassado`,
  `repassadoEm`, `repassadoObs` em `TransacaoFinanceira`.
- `backend/src/utils/financeiro.js`: função nova `transacaoDuplicada()`.
- `backend/src/routes/atendente.js`: `POST /clientes` ganhou lançamento financeiro opcional;
  `POST /clientes/:id/pacotes` ganhou a trava antiduplicidade.
- `backend/src/routes/profissional.js`: `POST /clientes` e `POST /clientes/:id/pacotes` passaram a
  criar `TransacaoFinanceira` (antes só criavam `Pacote`); `POST /financeiro/comprovante` ganhou
  `recebidoPor` e a trava; rota nova `PUT /financeiro/:id/repassar`; `GET /financeiro/resumo`
  ganhou `totalPendenteRepassar`.
- `backend/src/routes/dono.js`: `GET /dashboard` ganhou `totalPendenteRepasseProfissionais`;
  `GET /financeiro` ganhou `recebidoPor`/`repassado` na listagem; três rotas novas de Repasses.
- `frontend/src/pages/atendente/index.js`: formulário de cadastro ganhou a seção "Já lançar
  pagamento agora".
- `frontend/src/pages/profissional/index.js`: cadastro e "Pacote/pagamento" mostram o repasse
  quando existe transação; aba Financeiro ganhou card de pendência e botão de marcar repasse feito.
- `frontend/src/pages/dono/index.js`: aba nova "Repasses"; Dashboard e Financeiro mostram a
  pendência/origem do dinheiro.

## Pendências / aguardando teste do usuário

- Confirmar que os 3 arquivos de backend + 3 de frontend foram colados sem erro de build (schema
  novo precisa passar pelo `prisma db push` automático do Railway).
- Testar o fluxo ponta a ponta: atendente cadastrando cliente já com pagamento (aparece no "A
  receber hoje"); profissional cadastrando cliente antigo com valor (aparece como pendente de
  repasse); profissional marcando "repasse feito"; Dono lançando um valor recebido de uma
  profissional na aba Repasses; tentar registrar de propósito o mesmo valor duas vezes no mesmo
  dia pro mesmo cliente e confirmar que a segunda vez é bloqueada com aviso, não duplicada.
- `telefone`/`cpf` sem unicidade (caveat da Fase 6) e `percentualRepasse` só editável via banco
  (pendência da Fase 5) continuam como estavam — não fizeram parte deste pedido.

---

# Fase 8 — Finanças Pessoais do Dono + histórico mensal (entregue em 12-13/09/2026)

Pedido do Elismael: uma área separada, só do Dono, pra controlar finanças pessoais (não da clínica)
— lançamentos, metas, poupança, notas — e depois, no meio do desenvolvimento, um pedido extra:
"Quero que coloque histórico também dentro dessa aba, histórico de quanto recebi total no mês, pra
conseguir ir acompanhando os meses."

## O que foi implementado

- `backend/src/routes/financaPessoal.js` (novo): CRUD completo de `LancamentoPessoal`,
  `MetaPessoal`, `PoupancaAportePessoal`, `NotaPessoal` (modelos isolados no schema, sem relação
  com o financeiro da clínica), endpoint `/resumo` e endpoint novo `/historico-mensal` (total
  recebido por mês, pra acompanhar a evolução mês a mês).
- Rota montada em `backend/src/server.js` como `/api/financa-pessoal`.
- `frontend/src/pages/dono/index.js`: aba nova "Financeiro pessoal" (`AbaFinancaPessoal`) com toda
  a árvore de componentes (lançamentos, metas, poupança, notas, histórico mensal).

Status: entregue e validado por sintaxe; sem pendência conhecida.

---

# Fase 9 — Correções no sistema de renovação e reconhecimento de comprovante (entregue em 13/09/2026)

Pedido do Elismael (mensagem longa, em áudio transcrito): confirmar se o aviso de renovação
dispara certo pra pacote de 4 sessões (aviso na 3ª, ou seja, faltando 1); permitir pacotes de
qualquer tamanho (5, 6, 10, 12 sessões...) e não só múltiplos fixos; corrigir o reconhecimento de
valor no comprovante quando vem com "R$" e vírgula decimal (ex: "R$ 85,00") — antes só reconhecia
número puro ("85").

## O que foi corrigido

- `backend/src/utils/financeiro.js`: função nova `parseValorMonetario()` — aceita "85", "85,00",
  "R$ 85,00", "R$85,00", "1.234,56". Aplicada em 8 pontos de lançamento manual de valor
  (atendente.js, profissional.js, dono.js) que antes usavam `Number()` puro (que falhava
  silenciosamente com "R$" ou vírgula, e às vezes nem dava erro porque `if (valorFinal)` tratava
  `NaN` como falso).
- `backend/src/utils/notificar.js`: `precisaAvisoRenovacao()` reescrita pra funcionar com QUALQUER
  tamanho de pacote — pacotes de 4+ sessões avisam quando restam 2 e reforçam quando resta 1
  (baseado em sessões RESTANTES, não usadas, então funciona igual num pacote de 4 ou de 12);
  pacotes de 1-3 sessões avisam só quando resta 1.
- `frontend/src/pages/profissional/index.js` e `atendente/index.js`: os 4 `<select>` de "total de
  sessões" (fixos em 1/2/4) foram trocados por `<input type="number">` livre, pra permitir 5, 6,
  10, 12... sessões.
- **IA não reconhecia comprovante**: diagnosticado como provável falta da variável de ambiente
  `ANTHROPIC_API_KEY` no Railway (sem ela, a chamada de visão da IA nunca é nem tentada). Instruído
  o usuário a gerar a chave em console.anthropic.com e configurar no Railway — não foi possível
  confirmar diretamente se ele completou esse passo.

## Pendência

- Confirmar com o usuário se a `ANTHROPIC_API_KEY` foi de fato configurada no Railway e se o
  reconhecimento de comprovante voltou a funcionar.

---

# Fase 10 — Transformação em PWA (app instalável, iOS/Android/desktop, grátis) (entregue em 13/09/2026)

Pedido do Elismael: transformar o sistema num aplicativo instalável (celular e computador, iOS e
Android e Windows/Mac) sem precisar publicar na App Store nem Play Store, de forma gratuita.

## O que foi implementado

- `frontend/public/manifest.json` (novo): nome, ícones, cor do tema, `display: standalone`.
- `frontend/public/sw.js` (novo, depois estendido na Fase 12 com push — ver abaixo): service worker
  que só cacheia os 3 ícones estáticos (`icon-192.png`, `icon-512.png`, `logo.png`) — de propósito
  NÃO cacheia páginas nem chamadas de API, pra sempre mostrar dado atualizado (isso é o que faz o
  app atualizar sozinho quando o sistema muda, sem precisar "baixar de novo").
- `frontend/public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (novos, gerados a partir
  da logo oficial).
- `frontend/src/pages/_document.js`: meta tags de PWA (theme-color, apple-mobile-web-app-*, links
  pros ícones).
- `frontend/src/pages/_app.js`: registro do service worker (`navigator.serviceWorker.register("/sw.js")`).

## Como instalar (documentado pro usuário)

- **Android/Chrome**: prompt automático "Instalar aplicativo".
- **iOS/Safari**: SEM prompt automático (limitação da Apple) — precisa abrir no Safari, tocar em
  Compartilhar → "Adicionar à Tela de Início", manualmente. Isso vale pra qualquer papel de login
  (dono, profissional, atendente, cliente).
- **macOS (Sonoma+)**: Safari → menu Arquivo → "Adicionar ao Dock".
- **Windows/Chrome/Edge**: ícone de instalar na barra de endereço.

Foi entregue também uma imagem (PNG, estilo WhatsApp) com passo a passo ilustrado em iOS/Android
pros clientes, gerada com QR code linkando pro site, nas cores oficiais da marca.

## Bugs de deploy encontrados e corrigidos (relevante pra sessões futuras)

Dois rounds de erro de instalação (ícone genérico em vez do logo real), ambos por erro no upload
manual do GitHub (o usuário não usa terminal/git):

1. **Round 1**: os arquivos PNG simplesmente não tinham sido enviados (só os arquivos de texto
   foram colados) — `manifest.json`/`sw.js` retornavam 200, os 3 ícones retornavam 404.
2. **Round 2**: os arquivos FORAM enviados, mas mantiveram o nome do arquivo de origem
   (`frontend-public-icon-192.png` em vez de `icon-192.png`) — GitHub aceita o upload de binário
   mas não renomeia sozinho; é preciso um passo extra de renomear (editar o nome no commit) depois
   do upload.

**Lição permanente pra instruções futuras de upload de imagem/PNG pro Elismael**: sempre deixar
explícito, em destaque, que depois de fazer "Add file → Upload files" no GitHub é preciso também
RENOMEAR o arquivo pro nome final antes de commitar — o nome que aparece na tela após o upload é o
nome do arquivo de origem, não o nome que o sistema espera.

## Pendência não confirmada

Na última verificação (via WebFetch, antes do início da Fase 11/12), `apple-touch-icon.png` ainda
retornava 404 — não foi re-testado desde então. Vale confirmar no próximo contato com o usuário.

---

# Fase 11 — Performance: índices no banco de dados (entregue em 13/09/2026)

Pedido do Elismael (com 2 screenshots de lentidão, relatada por uma funcionária): "Parece que está
tendo algum atraso no sistema... demora às vezes pra carregar."

## Diagnóstico

`backend/prisma/schema.prisma` (antes desta fase) tinha ZERO declarações `@@index` em qualquer
modelo — só os índices implícitos de `@id`/`@unique`. Isso é uma pegadinha clássica do
Prisma/Postgres: colunas de chave estrangeira (foreign key) NÃO são indexadas automaticamente.
Qualquer filtro por `clienteId`, `profissionalId`, `userId` etc. (que o sistema faz o tempo todo)
estava fazendo full table scan.

## Correção

- 29 declarações `@@index` adicionadas em 13 modelos (Cliente, HistoricoCliente, Pacote,
  Agendamento, TransacaoFinanceira, RelatorioCliente, MensagemInterna, RecadoDiario,
  CheckinDiario, Mensagem, TicketSuporte, TarefaCliente, Notificacao, Disponibilidade) —
  cobrindo as chaves estrangeiras e colunas de status/data mais filtradas.
- `backend/src/routes/dono.js`: rota `/repasses/:profissionalId/lancar` tinha uma query sem
  `select`, trazendo linhas inteiras de `TransacaoFinanceira` (incluindo o campo base64 do
  comprovante) sem necessidade — corrigido com `select: { id: true, valorRenascer: true }`.
- Aplicado automaticamente no próximo deploy via `prisma db push` (já configurado no Railway,
  mudança 100% aditiva e sem risco).

## Suspeita não verificável (avisado ao usuário, não uma correção)

Se o plano do Railway estiver configurado para hibernar o serviço quando ocioso ("sleep"), o
primeiro acesso depois de um tempo sem uso pode demorar mais (cold start) — isso não é visível ou
ajustável pelo código, só pelo painel do Railway. Avisado ao usuário como possibilidade secundária.

---

# Fase 12 — Notificações push (toque/vibração no aparelho) pros 4 papéis (entregue em 13/09/2026)

Pedido completo do Elismael (verbatim, resumido): agora que o sistema é um app, ele quer
notificação de toque no próprio aparelho pra dono, profissional, cliente e atendente, cobrindo:
novo cliente cadastrado (avisa donos + atendentes), cliente vinculado a uma profissional (avisa
essa profissional), resumo diário de agenda pra profissional, aviso de sessão 1 dia antes e horas
antes pro cliente, aviso de renovação pra cliente E profissional, dono recebendo TODOS esses avisos
(cliente, financeiro, saída de cliente) pra poder cobrar profissionais, e aviso de repasse/dinheiro
entrando pro dono.

## Arquitetura (decisão de design mais importante desta fase)

`backend/src/utils/notificar.js` (helper que JÁ existia desde a Fase 2, usado em ~17 pontos do
código pra criar o registro de `Notificacao` no banco) foi reescrito pra, no mesmo lugar, TAMBÉM
disparar o push de verdade (`enviarPushParaUsuario`). Resultado: todo ponto do sistema que já
chamava `notificar()` — lembrete de sessão, aviso de renovação, aviso de repasse, etc. — ganhou
push automaticamente, sem precisar tocar em cada um desses pontos individualmente. Só os pontos que
precisavam de um aviso NOVO (que não existia antes) precisaram de código novo.

Dois helpers novos, generalizando um padrão que só existia uma vez (loop de avisar todos os donos
na conferência de repasse): `notificarDonos({...}, excetoUserId?)` e
`notificarAtendentes({...}, excetoUserId?)`.

## Infraestrutura de push (Web Push padrão, não Firebase/APNs)

- Protocolo Web Push via lib `web-push` (adicionada em `backend/package.json`).
- `backend/prisma/schema.prisma`: modelo novo `PushSubscription` (1 usuário pode ter várias
  inscrições — celular + computador), relacionado a `User`.
- `backend/src/utils/push.js` (novo): `enviarPushParaUsuario()` — só funciona se
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` estiverem configuradas no Railway; sem elas, o push
  simplesmente não sai, mas o sininho dentro do app continua funcionando normal. Auto-limpa
  inscrições mortas (erro 404/410 do navegador = desinstalou o app ou trocou de aparelho).
- **Chaves VAPID já geradas e entregues ao usuário no chat** (não repetidas aqui por ser segredo de
  app — mesmo tratamento dado à `ANTHROPIC_API_KEY`) — pendente dele configurar
  `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no Railway. Se precisar gerar de novo: `npx web-push
  generate-vapid-keys`.
- `backend/src/routes/comum.js`: 3 rotas novas — `GET /push/chave-publica` (pública, qualquer
  papel logado), `POST /push/inscrever` (upsert por endpoint), `DELETE /push/inscrever`.

## Avisos novos adicionados (por arquivo)

- `backend/src/utils/lembretes.js`: função nova `verificarResumoDiarioProfissionais()` (lista de
  clientes/horários do dia, 1x por dia, dedupe por `Notificacao.tipo: "resumo_diario"` criada
  hoje) — chamada dentro do mesmo `verificarLembretes()` que já roda a cada 15min via
  `setInterval` no `server.js` (nenhum agendador novo precisou ser criado). Lembretes de sessão
  (24h/6h antes) e de renovação também ganharam `notificarDonos()` além do que já existia.
- `backend/src/routes/atendente.js`, `profissional.js`, `dono.js`: pontos de cadastro de cliente
  novo (`notificarDonos` + `notificarAtendentes`), vínculo/reativação com profissional
  (`notificar` pra profissional recém-vinculada), pagamento/pacote registrado
  (`notificarDonos` "Tem dinheiro na área!"), e cliente excluído/não renovou
  (`notificarDonos` "Cliente saiu").

## Frontend

- `frontend/src/lib/push.js` (novo): `suportaPush()`, `statusPermissao()`, `inscreverPush()`
  (pede permissão, busca a chave pública, assina via `pushManager.subscribe`, manda pro backend),
  `cancelarPush()`, `tentarReinscreverSilenciosamente()` (se a permissão já foi concedida antes
  mas a inscrição caiu por algum motivo, tenta de novo sem interromper com popup).
- `frontend/src/components/Layout.js`: sininho de notificação novo no cabeçalho, visível pros
  4 papéis (Dono e Atendente não tinham NENHUMA visualização de aviso antes — só Cliente e
  Profissional tinham aba própria "Avisos"). Mostra contador de não lidas, lista com marcar como
  lida, e botão "Ativar no aparelho" quando a permissão push ainda não foi concedida.
- `frontend/public/sw.js`: eventos `push` (mostra a notificação do sistema operacional,
  ícone/badge = `icon-192.png`) e `notificationclick` (foca ou abre a aba certa).

## Limitação importante a comunicar ao usuário

Push só chega em quem (a) instalou o app (crítico no iPhone — a Apple só libera Web Push pra PWA
instalada na Tela de Início, nunca numa aba normal do Safari) E (b) tocou no botão "Ativar no
aparelho" pelo menos uma vez.

## Status

Entregue em 12 arquivos (9 backend + 3 frontend), todos validados por sintaxe (`node -c` no
backend, babel `parseSync` no JSX do frontend). Aguardando o usuário: (1) configurar as duas
variáveis VAPID no Railway, (2) testar no próprio aparelho o botão "Ativar no aparelho" e depois
confirmar que os toques chegam nos cenários pedidos.

---

# Fase 13 — Dono também é Profissional: Elismael atendendo seus próprios pacientes pelo login de Dono (entregue em 14/09/2026)

Pedido do Elismael (áudio transcrito): ele é psicoterapeuta além de dono da clínica, e queria
conseguir atender seus próprios pacientes pelo mesmo login de Dono — com uma agenda, cadastro de
cliente, lista de clientes, financeiro e disponibilidade "normal, tranquila, igual das
profissionais, tudo que tem os profissionais eu também quero". Ele também deixou claro que isso
deveria valer como possibilidade geral (qualquer Dono podendo virar também Profissional), não só
pro caso dele.

Em seguida, pedido complementar no mesmo fio: quando ele mesmo registra um pagamento (ou quando a
atendente registra pra ele), o valor tem que ser **integral**, sem repasse pra Renascer — já que
nesse caso o "dono" e a "profissional" são a mesma pessoa.

## Decisão de arquitetura

Investigando o código antes de mexer, ficou claro que o backend já carregava tudo que era preciso:
o middleware `autenticar` (`backend/src/middleware/auth.js`) sempre inclui `profissional`,
`cliente`, `atendente` e `dono` no `req.user`, independente do papel principal (`role`) do login.
Ou seja, um usuário "Dono" já vem com `req.user.profissional` populado assim que existir um
cadastro de `Profissional` vinculado ao mesmo `User` — o sistema já era preparado pra login duplo,
só faltavam duas peças:

1. O middleware `permitir(...)` bloqueava por papel principal só (`req.user.role`), sem abrir
   exceção pra quem tinha um cadastro extra de Profissional.
2. Não existia nenhuma rota pra criar esse cadastro de `Profissional` pra um usuário que já é Dono.

Com essas duas peças resolvidas, o resto foi reaproveitar (não duplicar) a tela da Profissional.

## O que foi implementado

- **`backend/src/middleware/auth.js`**: `permitir(...papeis)` ganhou uma exceção — mesmo que o
  papel principal do usuário não esteja na lista permitida, se a rota aceita `"PROFISSIONAL"` e o
  usuário tem um `req.user.profissional` vinculado, o acesso é liberado. É isso que permite o Dono
  Elismael acessar as rotas de agenda/clientes/financeiro da Profissional sem precisar de um
  segundo login nem trocar o papel principal dele.
- **`backend/src/routes/dono.js`**:
  - `POST /usuarios`: ganhou o campo `tambemProfissional` — quando o Dono cria um novo login de
    Dono marcando essa caixa, o sistema já cria o cadastro de `Profissional` vinculado junto.
  - Rota nova `POST /usuarios/:id/tornar-profissional`: ativa esse "modo profissional" pra um
    login de Dono já existente (idempotente — se já existe cadastro de Profissional, só devolve
    ele; senão cria um novo).
  - `GET /usuarios` passou a incluir se o usuário já tem `profissional` vinculado, pra mostrar o
    selo/botão certo na lista.
- **`frontend/src/pages/profissional/index.js`**: os componentes de Agenda, Cadastrar cliente,
  Clientes, Financeiro e Configurações/disponibilidade (`AbaAgenda`, `AbaCadastrarCliente`,
  `AbaClientes`, `AbaFinanceiro`, `AbaConfig`) ganharam `export` (além do padrão de já serem usados
  dentro dessa mesma página) — puramente pra poderem ser importados por outra página sem duplicar
  código. Não muda nada pra quem usa a página normal da Profissional.
- **`frontend/src/pages/dono/index.js`**:
  - Aba nova "Atender pacientes" no painel do Dono. Se o login ainda não tem cadastro de
    Profissional, mostra um botão "Ativar minha agenda de atendimento" (chama
    `POST /dono/usuarios/:id/tornar-profissional`); depois de ativado, essa aba se transforma numa
    mini área de Profissional dentro do próprio painel de Dono, com sub-abas Agenda / Cadastrar
    cliente / Clientes / Financeiro / Disponibilidade — os mesmos componentes reaproveitados de
    `profissional/index.js`, sem duplicação.
  - Na tela "Usuários" (gestão de logins), ao criar um novo login de Dono aparece a caixinha
    "Também é profissional (atende pacientes)"; e cada login de Dono já existente na lista ganhou
    um botão "Ativar atendimento" (ou um selo "também atende pacientes", se já estiver ativo).

## Sem repasse quando o Dono atende os próprios pacientes

Pedido complementar: "quando eu mesmo colocar, gerar o valor que é somente meu, pra não ficar
repasse; ou quando a atendente colocar pra mim, não gerar valor de meio, mas sim completo."

A correção ficou concentrada num único lugar: o campo `Profissional.percentualRepasse` (que já
existia desde a Fase 1, e todo ponto do sistema que calcula repasse — `calcularRepasse()`, usado
tanto nas rotas da atendente quanto nas da profissional — já lê esse campo direto do cadastro, sem
valor fixo no código). Bastou mudar o **valor padrão** desse campo na hora de criar o cadastro de
Profissional pra um Dono: em vez do 50% padrão de qualquer profissional comum, o cadastro criado
via "tambem profissional" ou via "tornar-profissional" já nasce com `percentualRepasse: 100`. Como
100% vai pra profissional e 0% pra Renascer, todo pagamento registrado — seja pelo próprio
Elismael, seja pela atendente — já sai automaticamente com o valor cheio, sem gerar pendência de
repasse. Isso vale só pra esse cadastro específico (o dele); qualquer outra profissional continua
com a divisão 50/50 padrão, a menos que seja ajustada manualmente no banco (como já era desde a
Fase 1).

## Arquivos alterados

- `backend/src/middleware/auth.js`
- `backend/src/routes/dono.js`
- `frontend/src/pages/profissional/index.js`
- `frontend/src/pages/dono/index.js`

## Status

Entregue em 4 arquivos, todos validados por sintaxe (`node -c` no backend, babel `parseSync` no
JSX do frontend). Não precisou de nenhuma variável de ambiente nova no Railway — só o
`prisma db push` automático de sempre (o modelo `Profissional` já existia, só o valor de
`percentualRepasse` mudou de padrão em código, não no schema).

---

# Fase 14 — Trocar cliente de profissional pela recepção e pelo Dono (entregue em 14/09/2026)

Pedido do Elismael, no seguimento direto da Fase 13: com a agenda própria dele já pronta, ele
precisava conseguir mover pra ela os clientes que já eram atendidos em outro login antes —
"Coloque a possibilidade de eu e a atendente poder trocar o cliente de profissional, vou precisar
trocar os clientes que estavam em outro login pra o dono."

## O que já existia (achado, não construído do zero)

Investigando antes de escrever qualquer coisa nova, já existia uma rota de backend pronta pra isso
desde uma fase anterior — `PUT /atendente/clientes/:id/vincular-profissional` — mas ela nunca tinha
sido ligada a nenhum botão na tela: nem a atendente, nem o dono tinham como chamá-la. A troca de
profissional que os usuários enxergavam até aqui era só a do próprio cliente pelo app dele
(`POST /cliente/trocar-profissional`), que **exige encerrar o pacote atual antes** — regra correta
pra quando é o cliente decidindo por conta própria, mas errada pro caso de agora (mover clientes de
um login pro outro, administrativamente, sem essa trava).

## O que foi implementado

- **`backend/src/routes/atendente.js`**: a rota `PUT /clientes/:id/vincular-profissional` foi
  reforçada — agora exige escolher uma profissional (400 se vazio), registra a troca no
  `HistoricoCliente` (com o nome da profissional antiga, quando havia uma, no campo `motivo`) e
  também reativa o cliente automaticamente (`situacao: "ATIVO"`) se ele estava com situação
  excluída — útil justamente pro caso de mover um cliente que tinha saído de um login antigo.
- **`backend/src/routes/dono.js`**: rota nova e equivalente, `PUT /clientes/:id/vincular-profissional`,
  com a mesma lógica — o Dono ganha o mesmo poder de trocar qualquer cliente de profissional
  direto pela própria tela dele, sem precisar da atendente.
- **`backend/prisma/schema.prisma`**: o enum `TipoEventoHistorico` ganhou o valor
  `TROCOU_PROFISSIONAL`, pra essas trocas aparecerem certinho na aba "Histórico" do Dono (mudança
  aditiva, sem risco, aplicada automaticamente pelo `prisma db push` do Railway).
- **`frontend/src/components/TrocarProfissionalCliente.js`** (novo, componente compartilhado):
  seletor de profissional + botão "Trocar", mostrando quem é a profissional atual do cliente (se
  tiver alguma). Usado tanto na tela da atendente quanto na do Dono.
- **`frontend/src/pages/atendente/index.js`** e **`frontend/src/pages/dono/index.js`**: a aba
  "Clientes" de cada um ganhou esse seletor na ficha expandida do cliente (a mesma área onde já
  tinha as métricas de retenção, o histórico de pagamentos etc.). No painel do Dono, a lista de
  clientes passou também a carregar a lista de profissionais (antes só carregava os clientes) pra
  poder popular esse seletor.

## Como usar (pro Elismael)

Na aba "Clientes" (tanto como Dono quanto pedindo pra atendente fazer), clique no cliente que quer
mover pra abrir a ficha dele, e no fim da ficha vai aparecer "Trocar de profissional" com a
profissional atual e um seletor pra escolher a nova — inclusive pra ele mesmo, já que agora ele
também aparece na lista de profissionais depois de ativar a aba "Atender pacientes" (Fase 13). A
profissional nova recebe um aviso automático ("Novo cliente pra você!") assim que a troca é feita.

## Status

Entregue em 6 arquivos (3 backend + 3 frontend, incluindo o componente novo), todos validados por
sintaxe (`node -c` no backend, babel `parseSync` no JSX do frontend). Não precisa de nenhuma
variável de ambiente nova no Railway — só o `prisma db push` automático de sempre, por causa do
valor novo no enum.

---

# Fase 15 — Selo "(Dono)" nas listas de profissional, pra recepção identificar o Elismael (entregue em 14/09/2026)

Pedido do Elismael (áudio transcrito, adendo à Fase 13/14): "Eu preciso que a atendente consiga
ver Dono/terapeuta ou psicoterapeuta na parte dela, para ela saber que é o Elismael." Ou seja:
depois da Fase 13 (Dono também Profissional), o cadastro de Profissional do próprio Elismael passou
a aparecer misturado com o das outras profissionais nas listas e seletores da atendente — faltava
uma forma clara de diferenciar qual entrada é ele.

## O que foi implementado

- **`backend/src/routes/atendente.js`** e **`backend/src/routes/dono.js`**: as rotas `GET
  /profissionais` e `GET /clientes` passaram a incluir `role: true` no `select` do `user` (da
  profissional e/ou do profissional atual do cliente) — informação que já existia no banco, só não
  estava sendo enviada pro frontend.
- **`frontend/src/pages/atendente/index.js`**: selo "Dono" (fundo âmbar) do lado do nome nos cards
  da aba "Profissionais e agendar"; sufixo " (Dono)" no nome dentro dos seletores de profissional
  — cadastro de cliente, fila de reativação, coluna "Profissional" da tabela de clientes.
- **`frontend/src/pages/dono/index.js`**: mesmo tratamento nos lugares equivalentes (fila de
  reativação, seletor no cadastro de login de Cliente, coluna "Profissional" da tabela de
  clientes, e a própria lista "Profissionais" do painel do Dono).
- **`frontend/src/components/TrocarProfissionalCliente.js`**: sufixo " (Dono)" no seletor de nova
  profissional e no texto "(hoje: Nome)" que mostra a profissional atual do cliente.

## Status

Entregue em 5 arquivos (2 backend + 3 frontend), todos validados por sintaxe (`node -c` no
backend, babel `parseSync` no JSX do frontend). Não precisa de nenhuma variável de ambiente nova
no Railway nem mudança de schema — só reaproveita o campo `role` que já existia em `User`.

---

# Fase 16 — Pop-up de novidades + convite pra ativar notificação na entrada do app (cliente) (entregue em 15/09/2026)

Pedido do Elismael (áudio transcrito): o sininho de notificações (Fase 12) ficava escondido no
cabeçalho e muita gente nunca chegava a clicar nele nem a ativar a notificação push no aparelho.
Ele queria que, quando o cliente entrasse no app, aparecesse já um pop-up explícito avisando que
tem novidade (mensagem da profissional, aviso de renovação, sessão do dia etc.) e, junto, um
convite pra ativar a notificação push — sem depender da pessoa achar o sininho sozinha.

## O que foi implementado

- **`backend/src/routes/comum.js`**: rota nova `PUT /comum/notificacoes/marcar-todas-lidas` — marca
  de uma vez todas as notificações não lidas do usuário logado. Usada quando o pop-up de entrada é
  fechado, pra não ficar reaparecendo pra sempre com as mesmas notificações já mostradas.
- **`frontend/src/pages/cliente/index.js`**: componente novo `AvisoEntrada`, montado uma vez por
  carregamento do app (não a cada troca de aba — fica no nível de `AreaCliente`, por fora do
  conteúdo de cada aba). Ao entrar:
  - Busca as notificações não lidas (`GET /comum/notificacoes`) e o status da permissão de push
    (`statusPermissao()`, já existente desde a Fase 12).
  - Se tiver notificação não lida, mostra um pop-up "Enquanto você esteve fora..." com o título e a
    mensagem de cada uma (até 4, com "e mais X..." se tiver mais), e um botão "Ver todos os
    avisos" que leva direto pra aba Avisos.
  - Se a notificação push do aparelho ainda não tiver sido ativada (`status !== "granted"`), mostra
    também — na mesma tela ou isolado, se não houver notificação nova — um convite "🔔 Ativar
    notificações no aparelho", que já chama `inscreverPush()` (mesma função da Fase 12) direto,
    sem precisar abrir o sininho.
  - Ao fechar (ou depois de ativar o push), marca as notificações mostradas como lidas
    (`PUT /comum/notificacoes/marcar-todas-lidas`), pra não repetir o mesmo aviso pra sempre.
  - Convive com o pop-up de renovação de pacote que já existia (Fase 4): esse novo fica com
    `z-index` menor, então se os dois quiserem aparecer ao mesmo tempo, o de renovação (financeiro,
    mais urgente) aparece primeiro, e esse de novidades/push aparece em seguida, assim que o de
    renovação for fechado — sem os dois se sobreporem ao mesmo tempo na tela.

## Decisão de escopo

O pedido falava especificamente do cliente ("quando o cliente entrar..."), então esse pop-up foi
implementado só na área do Cliente. As áreas de Dono, Atendente e Profissional continuam com o
comportamento de sempre — o link "Ativar no aparelho" dentro do sininho (Fase 12), sem pop-up
automático — já que ali o padrão de uso é diferente (login mais frequente, em computador).

## Status

Entregue em 2 arquivos (1 backend + 1 frontend), validados por sintaxe (`node -c` no backend,
babel `parseSync` no JSX do frontend). Não precisa de nenhuma variável de ambiente nova no Railway.

---

# Fase 17 — Mostrar/esconder senha no login, presença online e status de sessão em tempo real (entregue em 15/09/2026)

Pedido do Elismael (áudio transcrito), com três partes:

1. Um "olhinho" no campo de senha do login, pra dar pra conferir se digitou certo antes de
   entrar.
2. Saber quando cliente e profissional estão online — mas só numa direção: o cliente NUNCA vê se
   a profissional está online; a profissional vê se o cliente está online (ou há quanto tempo foi
   visto por último: "online agora", "visto há 29 min", "visto há 2h" etc.); atendente e dono veem
   se as profissionais estão online.
3. Dono e atendente conseguirem ver se a profissional realmente está atendendo uma sessão
   (quando ela "aperta o botão" pra iniciar o atendimento) e serem avisados se ela não iniciar a
   sessão na hora marcada — "não apertou o botão de iniciar".

## Item 1 — Olhinho no login

- `frontend/src/pages/login.js`: botão 👁️/🙈 dentro do campo de senha, que alterna
  `type="password"` / `type="text"`. Só isso, sem mudança de backend.

## Item 2 — Presença (online agora / visto há X)

- `backend/prisma/schema.prisma`: campo novo `User.ultimoAcessoEm DateTime?`.
- `backend/src/middleware/auth.js`: o middleware `autenticar` (que já roda em toda rota protegida)
  passou a atualizar esse campo — com um limite de 1x por minuto por usuário, pra não gerar um
  UPDATE a cada request, e sem `await` (nunca atrasa nem quebra a resposta se falhar). Não
  precisou de nenhuma chamada nova no frontend: o sininho de notificações (Fase 12) já faz uma
  consulta a cada 60 segundos pra qualquer papel logado, e essa consulta sozinha já serve de
  "sinal de vida" — é basicamente de graça.
- `frontend/src/lib/presenca.js` (novo): `formatarPresenca(ultimoAcessoEm)` — "Online agora" se
  visto há menos de 2 minutos, senão "Visto há X min/h/dias".
- `frontend/src/components/IndicadorPresenca.js` (novo): bolinha verde pulsando + texto, ou
  bolinha cinza + "Visto há...".
- **Quem manda esse dado pra quem** (a regra de privacidade pedida): cada rota do backend só
  inclui `ultimoAcessoEm` de quem tem permissão de ver.
  - `GET /profissional/clientes` → manda o `ultimoAcessoEm` de cada cliente (a profissional vê).
  - `GET /atendente/profissionais` e `GET /dono/profissionais` → mandam o `ultimoAcessoEm` de
    cada profissional (atendente e dono veem).
  - Nenhuma rota do Cliente foi tocada — ele nunca recebe o `ultimoAcessoEm` de ninguém, então
    não tem como aparecer pra ele em lugar nenhum.
- Aparece: na lista "Meus clientes" da profissional, nos cards de "Profissionais e agendar" da
  atendente, e na lista "Profissionais" do dono.

## Item 3 — Status da sessão em tempo real + aviso de sessão não iniciada

Em vez de criar um botão novo de "iniciar atendimento", foi reaproveitado algo que já existia: a
profissional já tem o botão "🎥 Entrar na videochamada" em cada sessão do dia (usa o link fixo do
Google Meet dela), e isso já cria/atualiza um registro `ChamadaVideo` com `iniciadaEm` assim que
ela entra — só que até agora esse registro não era mostrado pra ninguém além dela e do cliente. Ou
seja, o "apertar o botão pra iniciar" que o Elismael descreveu já existia; faltava só dar
visibilidade dele pro dono e pra atendente, e o aviso automático de atraso.

- `backend/prisma/schema.prisma`: campo novo `Agendamento.avisoNaoIniciadoEnviado Boolean
  @default(false)` — só controla pra não mandar o aviso de atraso duas vezes pro mesmo
  agendamento.
- `backend/src/routes/atendente.js` e `backend/src/routes/dono.js`: a "Agenda geral" da atendente
  (já existia) e uma nova aba "Agenda geral" pro dono (rota nova `GET /dono/agenda-geral`, mesmo
  formato) agora incluem o `chamadaVideo` de cada sessão.
- `frontend/src/lib/presenca.js`: função `statusSessao()` calcula, a partir do horário marcado e
  do `chamadaVideo`, um dos status: "Em atendimento agora" (entrou na chamada, ainda não saiu),
  "Concluída (X min)" (já saiu), "⚠️ Não iniciada" (já passou 15 minutos do horário marcado sem
  ela ter entrado), ou "Aguardando horário" (ainda não chegou a hora).
- `frontend/src/pages/atendente/index.js` e `frontend/src/pages/dono/index.js`: coluna "Sessão"
  nova na tabela da Agenda geral, com essa cor/texto.
- `backend/src/utils/lembretes.js`: função nova `verificarSessoesNaoIniciadas()`, rodando dentro
  do mesmo ciclo de 15 em 15 minutos que já existia (nenhum agendador novo) — se uma sessão de
  hoje passou 15 minutos do horário marcado e a profissional não entrou na videochamada, avisa o
  Dono E a Atendente ("Sessão não iniciada — [profissional] não iniciou a sessão de [cliente],
  marcada para [hora]"), só uma vez por agendamento.

## Status

Entregue em 12 arquivos (6 backend + 6 frontend), todos validados por sintaxe (`node -c` no
backend, babel `parseSync` no JSX do frontend). O schema tem duas colunas novas — ambas aditivas,
aplicadas automaticamente pelo `prisma db push` do Railway, sem risco pros dados existentes. Não
precisa de nenhuma variável de ambiente nova.

## Pendência / aguardando teste do usuário

- Confirmar visualmente a presença (online/visto há X) na lista de clientes da profissional, nos
  cards de profissionais da atendente e na lista de profissionais do dono.
- Confirmar que a coluna "Sessão" na Agenda geral (atendente e dono) mostra "Em atendimento agora"
  quando a profissional entra na videochamada, e que o aviso de "Sessão não iniciada" chega pro
  dono e pra atendente depois de 15 minutos de atraso sem ela ter entrado.

---

# Fase 18 — Correção: horário errado nos avisos de "sessão não iniciada" (entregue em 15/09/2026)

O Elismael reportou (com print) avisos de "Sessão não iniciada" dizendo que já tinham passado
157 e 97 minutos do horário marcado, pra sessões marcadas pra horários que ainda nem tinham
chegado.

## Causa

`Agendamento.data` guarda só o DIA (meia-noite UTC), sem hora — o horário de verdade fica separado
no campo `horaInicio` (texto, ex: "15:00", sempre no horário de Bahia/Brasília). Pra descobrir o
instante exato da sessão, o código da Fase 17 combinava os dois com `data.setHours(hora,
minuto)` — só que isso usa o fuso horário configurado no SERVIDOR (o Railway roda em UTC por
padrão), não o de Bahia/Brasília (UTC-3). Resultado: toda sessão marcada, por exemplo, pra 15:00,
era calculada internamente como se já tivesse acontecido 3 horas antes do horário real — daí os
avisos de atraso aparecerem com minutagem muito maior que a real, inclusive pra sessões futuras.

Ao investigar, o mesmo problema de fundo já existia desde antes na Fase 2/5 (lembrete de sessão
por e-mail 24h/6h antes): o filtro de banco comparava `Agendamento.data` (meia-noite) direto com o
horário atual, o que descartava sessões do dia assim que passava da meia-noite UTC (21h de
Bahia/Brasília na noite anterior) — ou seja, os lembretes de 6h antes praticamente nunca
disparavam pra sessões do próprio dia. Corrigido junto, já que é a mesma causa.

## Correção

- `backend/src/utils/horarios.js`: função nova `horarioAgendamentoParaData(data, horaInicio)` —
  monta o instante exato combinando o dia (em UTC, extraído com `toISOString()`) com o horário e
  um fuso fixo `-03:00` (Bahia/Brasília não tem horário de verão desde 2019, então esse valor não
  muda ao longo do ano).
- `backend/src/utils/lembretes.js`: `verificarSessoesNaoIniciadas()` e
  `verificarLembretesDeSessao()` passaram a usar essa função em vez de `setHours()`; o filtro de
  banco do lembrete de sessão também foi ajustado pra olhar "desde ontem" (o filtro fino de
  verdade agora é feito em código, com o horário certo).
- `frontend/src/lib/presenca.js`: `statusSessao()` (usado na coluna "Sessão" da Agenda geral,
  Fase 17) recebeu o mesmo ajuste, por consistência — mesmo que o navegador de quem está vendo já
  esteja no fuso certo, fica independente disso.

## Status

Entregue em 3 arquivos (2 backend + 1 frontend), validados por sintaxe e testados manualmente com
um script simulando o horário do print do Elismael (sessão marcada pra 15:00, checada as 14:41 —
antes calculava "157 min de atraso", agora calcula corretamente "-19 min", ou seja, ainda não
chegou a hora). Não precisa de variável nova no Railway nem mudança de schema.


---

# Fase 19 — Correção: clicar em "Entrar na videochamada" jogava de volta pro login (entregue em 15/09/2026)

O Elismael reportou (com print da tela de login): "Quando clico em iniciar sessão com o cliente
ele volta pra essa tela [login]."

## Causa

Isso só acontece com a conta Dono que também é Profissional (Fase 13 — "Dono também é
Profissional"). Na Agenda do próprio Dono (aba "Minha agenda", que reaproveita o componente
`AbaAgenda` da tela da Profissional), o botão "Entrar na videochamada" de cada sessão leva pra
uma página separada: `/profissional/videochamada/[id]`.

Essa página é protegida pelo hook `useAuth("PROFISSIONAL")`
(`frontend/src/lib/useAuth.js`), que checava o papel de um jeito rígido: `usuário.role !==
"PROFISSIONAL"` → manda pro login. Só que o papel PRINCIPAL de um Dono continua sendo "DONO",
mesmo quando ele também atende — então, ao clicar no botão, a própria tela de proteção da página
achava que ele não tinha permissão e mandava ele de volta pro login, antes de qualquer chamada ao
servidor.

O backend já tinha essa exceção certinha desde a Fase 13 (a função `permitir()` em
`backend/src/middleware/auth.js` libera rotas de PROFISSIONAL pra quem tem um cadastro de
Profissional vinculado, mesmo não sendo esse o papel principal) — só o frontend, no arquivo
`useAuth.js`, tinha ficado de fora dessa mesma regra.

## Correção

- `frontend/src/lib/useAuth.js`: agora, quando a página pede acesso de "PROFISSIONAL", o hook
  também libera passagem se o usuário tiver um cadastro de Profissional vinculado
  (`usuario.profissional`), mesmo que o papel principal dele seja outro — exatamente a mesma regra
  que o backend já usa. Esse dado (`profissional`) já vinha desde sempre na resposta do login, não
  precisou de nada novo no backend.

## Status

Entregue em 1 arquivo (frontend), validado por sintaxe (babel `parseSync`). Não precisa de
variável nova no Railway nem mudança de schema — é só a tela de proteção da página que estava
checando o papel de um jeito rígido demais.

## Pendência / aguardando teste do usuário

- Confirmar que, logado como Dono, clicar em "Entrar na videochamada" na própria agenda agora
  abre a sala do Google Meet normalmente, em vez de voltar pro login.


---

# Fase 20 — Próxima sessão gerada automaticamente ao marcar "Realizada" (entregue em 15/09/2026)

Pedido do Elismael: quando marca uma sessão como "Realizada", ele quer que o sistema já gere
automaticamente a próxima sessão pra semana seguinte, no mesmo dia da semana e mesmo horário
(ex: atendeu numa segunda às 15h, o sistema já cria a próxima segunda às 15h) — e avise tanto a
cliente quanto ele mesmo que a nova data ficou marcada. Vale pra qualquer pacote, de qualquer
duração.

## O que foi implementado

- `backend/src/routes/profissional.js`: na rota `PUT /agenda/:id/status` (é ela que roda quando
  clica em "Realizada" na Agenda), depois de somar a sessão no pacote, se ainda restar sessão
  disponível no pacote (`restantes > 0`), o sistema cria sozinho um novo agendamento pro mesmo
  cliente, mesma profissional, mesmo pacote, 7 dias depois, no mesmo dia da semana e horário — e
  manda uma notificação pra cliente ("Sua próxima sessão já está marcada... ficou marcada para
  [data] às [hora]") e uma pra profissional ("Próxima sessão gerada... foi marcada
  automaticamente para [data] às [hora]").
- Antes de criar, confere se já não existe uma sessão futura marcada pra esse mesmo dia/horário
  (evita duplicar caso a profissional já tivesse reagendado manualmente antes de marcar
  "Realizada").
- Se o pacote tiver acabado naquela sessão (não resta mais nenhuma), o sistema NÃO gera sessão
  nova sozinho — nesse caso já existia (desde antes) o aviso de renovação de pacote pra cliente,
  profissional e donos, pedindo pra registrar um pacote novo primeiro. Isso é intencional: sem
  sessão sobrando no pacote não tem como marcar uma sessão nova sem pagamento.
- Como o Dono que também atende (Fase 13) usa exatamente essa mesma rota por baixo dos panos,
  esse comportamento vale igual pra ele, sem precisar de nada a mais.

## Status

Entregue em 1 arquivo (backend), validado por sintaxe (`node -c`). Não precisa de variável nova
no Railway nem mudança de schema — só reaproveita campos que já existiam no agendamento.

## Pendência / aguardando teste do usuário

- Marcar uma sessão como "Realizada" com o pacote ainda tendo sessão sobrando, e confirmar que:
  aparece um novo card na Agenda pra semana seguinte, mesmo dia/horário; chega notificação pra
  cliente e pra profissional avisando a nova data.
- Confirmar que, na ÚLTIMA sessão do pacote (sem sessão sobrando), o sistema NÃO cria sessão nova
  sozinho — só manda o aviso de renovação, como já era antes.


---

# Fase 22 — Prontuário e Evolução do cliente (entregue em 15/09/2026)

Uma profissional deu a dica pro Elismael de acrescentar ao sistema: prontuário, evolução,
relatórios pra atestado/encaminhamento/declaração de horas, e recursos terapêuticos. Depois de
confirmar com o Elismael como cada peça deveria funcionar, essa fase entrega as duas primeiras
(prontuário e evolução) — o resto (relatórios em PDF e biblioteca de recursos compartilhada com
o cliente) fica pra uma próxima fase.

## Decisões confirmadas com o Elismael

- Prontuário e Evolução são DUAS abas separadas (não uma mistura só): Prontuário é o cadastro
  clínico geral do cliente (fixo, vai sendo atualizado); Evolução é o histórico de anotações,
  uma entrada por sessão/data.
- Confidencial: só a profissional responsável ATUAL pelo cliente lê e escreve nas duas abas —
  nunca aparece pro cliente, pra atendente nem pro dono (mesmo se o dono também atender
  pacientes, ele só vê o prontuário/evolução dos PRÓPRIOS clientes, nunca dos de outra
  profissional). Isso é igual à regra de "quem é responsável pelo cliente agora" que já existia
  pra outras abas (chat, relatórios, etc.).

## O que foi implementado

- `backend/prisma/schema.prisma`: dois modelos novos — `Prontuario` (um por cliente: queixa
  principal, histórico/anamnese, diagnóstico, medicações em uso, observações importantes,
  objetivos terapêuticos) e `Evolucao` (várias por cliente, cada uma com data e texto).
- `backend/src/routes/profissional.js`: rotas novas —
  `GET/PUT /clientes/:id/prontuario` e `GET/POST /clientes/:id/evolucoes` +
  `PUT/DELETE /evolucoes/:id` — todas conferindo primeiro que o cliente é mesmo da profissional
  logada antes de deixar ler ou escrever.
- `frontend/src/pages/profissional/index.js`: duas abas novas dentro do cadastro do cliente —
  "Prontuário" (formulário com os campos acima, botão "Salvar prontuário", mostra "última
  atualização... por [nome]") e "Evolução" (campo de data + texto pra adicionar uma anotação
  nova, lista das anotações já feitas, com opção de editar ou excluir cada uma). Como o Dono que
  também atende (Fase 13) reaproveita esse mesmo arquivo pra sua própria agenda de clientes, as
  duas abas aparecem pra ele também, automaticamente, sem precisar tocar em `dono/index.js`.

## Status

Entregue em 3 arquivos (schema + rota do backend, e a página da profissional no frontend),
todos validados por sintaxe. O schema tem dois modelos novos — só cria tabela nova, não altera
nem apaga nada que já existia, aplicado automaticamente pelo `prisma db push` do Railway.

## Pendência / aguardando teste do usuário

- Abrir um cliente na aba "Clientes" da profissional (ou do Dono, na aba "Atender pacientes"),
  clicar em "Prontuário", preencher e salvar, confirmar que volta a mostrar o que foi salvo ao
  reabrir.
- Testar "Evolução": adicionar uma anotação, confirmar que aparece na lista, testar editar e
  excluir.
- Confirmar que essas duas abas NÃO aparecem em nenhuma tela da atendente, do dono (fora do que
  é dele mesmo) nem do cliente.

## ⚠️ Alerta pra sessões futuras: confirmar se a Fase 22 chegou a entrar em produção

Ao reabrir o projeto numa sessão seguinte (11/10/2026), o `schema.prisma` do zip mais recente
baixado direto do GitHub **não tinha** os modelos `Prontuario`/`Evolucao` desta fase, embora
tivesse campos de fases cronologicamente vizinhas (Fase 17/18, antes; nada de posterior pra
comparar na época). Ou seja: não está confirmado se o Elismael chegou a colar os 3 arquivos desta
Fase 22 no GitHub. Antes de entregar qualquer novo `schema.prisma` (full-file replacement), checar
isso com o usuário — senão a entrega mais nova apaga essas duas tabelas sem querer. **Decisão de
segurança adotada enquanto isso não é confirmado**: qualquer novo `schema.prisma` entregue a partir
de agora deve sempre incluir de novo os modelos `Prontuario`/`Evolucao` (copiados desta Fase 22),
mesmo que o zip mais recente não os tenha — reaplicar um modelo que já existe no banco não causa
nenhum dano (o `prisma db push` só confirma que a tabela já está do jeito que devia).

## Próximos passos combinados (ainda não entregues)

- Relatórios em PDF pronto pra baixar/imprimir (atestado, encaminhamento, declaração de horas),
  preenchidos automaticamente com nome do cliente/datas/sessões.
- "Recursos terapêuticos": biblioteca de materiais que a profissional sobe (PDFs, exercícios,
  links) e o cliente vê/baixa na área dele.

---

# Fase 23 — Redesign visual: menu lateral no computador + identidade azul da Renascer IA (entregue em 11/10/2026)

Pedido do Elismael (com prints das telas da Renascer IA — ver Fase "Renascer IA" abaixo): "Com esse
design super sofisticado eu gostaria também de alterar o app da Renascer da plataforma, gostei
muito do estilo do computador com as opções das coisas do lado esquerdo... Que gostaria de ficasse
de lado, a cor mas com nossa logo que você já tem... Sem remover nada do sistema apenas alterar o
design para computador e celular." Pedido esclarecido antes de começar (pergunta direta ao
usuário): aplicar nas 4 áreas (incluindo Cliente), trocar a cor pro azul da Renascer IA, e usar o
arquivo de logo que ele mandou.

## Decisão de escopo: só 3 arquivos, zero risco de quebrar função

Antes de escrever qualquer coisa, foi investigado o código atual (`Layout.js`,
`tailwind.config.js`, `globals.css`, `Logo.js`) e duas descobertas mudaram o tamanho do trabalho
pra muito menor do que parecia:

1. **A logo já estava certa.** `frontend/public/logo.png` já é exatamente a mesma imagem que o
   Elismael mandou (logo circular "ER" com o fundo de rede neural azul-clara) — não precisou
   trocar nenhum arquivo de imagem.
2. **A cor azul já era a mesma.** `renascer.DEFAULT` no `tailwind.config.js` já era `#005096` —
   exatamente a cor principal usada em todas as telas da Renascer IA (conferido lendo o HTML real
   de uma das telas do design, `DesktopDono.dc.html`, published em
   `https://claude.ai/artifact/5yGB3ZfHgyhXkGLQDVvGiJ`).

Como `Layout.js` é o único componente que desenha o cabeçalho/menu e é usado por TODAS as páginas
(cada uma só passa `abas`/`children`, nunca desenha o próprio menu), a troca do padrão de navegação
ficou inteira dentro dele — nenhuma das 4 páginas de papel (`profissional/index.js`,
`cliente/index.js`, `dono/index.js`, `atendente/index.js`) precisou ser tocada. Isso é o que
garante "sem remover nada do sistema": zero lógica de negócio foi mexida, só a casca visual.

## O que foi implementado

- **`frontend/src/components/Layout.js`** (reescrito): no computador (telas `md:` pra cima), a
  fileira horizontal de abas debaixo do cabeçalho foi substituída por um menu lateral FIXO à
  esquerda (estilo das telas da Renascer IA — branco, borda fina, ~256px de largura): logo + nome
  no topo, lista de categorias com ícone (cada aba ganhou um ícone automático a partir do próprio
  `id` que já existia, com um ícone genérico de reserva pra qualquer aba nova no futuro — nenhuma
  página precisou declarar ícone), item ativo destacado em azul-claro, e avatar/nome/sininho/Sair
  fixados embaixo. No celular, continua existindo o cabeçalho fixo + menu em gaveta (hambúrguer)
  que já existia, só com as cores novas e ícone em cada item da gaveta também.
- **`frontend/tailwind.config.js`**: o token de cor `gold` (usado em dezenas de lugares do sistema
  inteiro — selo de item ativo, badges, contorno do avatar, linha decorativa do topo, bolinha do
  sininho etc.) deixou de ser dourado e virou o azul-destaque da Renascer IA (`#4FA8DE` claro,
  `#E3EFF8` fundo suave, `#003A6E` escuro — esse último e o `renascer.dark` tirados direto do HTML
  real das telas da Renascer IA). Como é só o VALOR da cor que mudou (o nome do token continua
  `gold` por baixo dos panos), nenhum outro arquivo do sistema — nenhuma das 4 páginas, nenhum
  componente — precisou ser editado pra "repintar" sozinho em todo canto que já usava esse token.
  A fonte do sistema inteiro também trocou de Plus Jakarta Sans + Fraunces (serifada) pra Manrope
  — a mesma fonte usada em todas as telas da Renascer IA.
- **`frontend/src/styles/globals.css`**: import da fonte trocado pra Manrope; o brilho de fundo da
  página (que tinha um tom dourado/amarronzado) trocado pra um tom azul, pra combinar com a cor
  nova — resto do arquivo (botões, cards, inputs) mantido igual, porque já usa os tokens do
  Tailwind (herdam a cor nova automaticamente).

## Por que essa abordagem foi escolhida (em vez de reescrever cada página)

Reescrever manualmente cada uma das 4 páginas pra "parecer" com o design da Renascer IA teria
multiplicado o número de arquivos a colar no GitHub (e o risco de erro de colagem, como já
aconteceu antes — ver Fase 4), sem ganho real: como o menu e o cabeçalho já eram 100% compartilhado
(`Layout.js`), bastava redesenhar essa UMA peça pra toda a casca do sistema mudar de cara, com o
conteúdo de cada aba (agenda, financeiro, clientes etc.) absolutamente intocado.

## Status

Entregue em 3 arquivos (só frontend — Vercel, nenhum arquivo de backend/Railway nesta fase), todos
validados por sintaxe (babel `parseSync` no JSX do `Layout.js`, `node -c` no `tailwind.config.js`).
Não precisa de variável de ambiente nova nem mudança de schema.

## Pendência / aguardando teste do usuário

- Colar os 3 arquivos e confirmar visualmente: menu lateral aparecendo no computador (com ícone +
  nome de cada aba, item ativo destacado em azul), cabeçalho/gaveta funcionando igual no celular,
  cores atualizadas em botões/badges/selos por todo o sistema (dono, atendente, profissional,
  cliente).
- Se algum ícone de aba não combinar bem com o nome dela, é só avisar qual aba (id/rótulo) que o
  ícone é ajustado — a lista de ícones por aba mora toda dentro de `Layout.js`
  (`MAPA_ICONE_POR_ABA`), fácil de trocar sem mexer em mais nada.

## Pendência maior ainda não iniciada: Renascer IA

Em paralelo a este redesign, o Elismael pediu pra construir a **Renascer IA** — uma companheira de
chat por IA (Claude), separada deste sistema de gestão mas rodando dentro do mesmo app, aberta ao
público (não só clientes da clínica), com plano grátis limitado + assinatura R$19,90/mês, protocolo
de crise, travas de custo, e um funil de clientes novos pra clínica. Especificação completa
guardada em `claude/renascer-ia-especificacao.md` (neste mesmo Projeto) e nas telas de design em
`https://claude.ai/artifact/5yGB3ZfHgyhXkGLQDVvGiJ`. O Elismael pediu pra começar pela Etapa 1 da
ordem de construção do documento ("Base grátis"). Ainda não iniciado nesta sessão — fica registrado
aqui como o próximo grande passo, depois que o Elismael testar e confirmar esta Fase 23.

---

# Fase 24 — Renascer IA, Etapa 1: base grátis (entregue em 12/10/2026)

Pedido do Elismael: "Vamos iniciar o Renascer IA." Seguindo a ordem de construção sugerida na
especificação (`claude/renascer-ia-especificacao.md`), esta fase entrega só a Etapa 1 ("Base
grátis"): cadastro público com bloqueio de duplicidade, avisos e termos, conversa com limite de 15
mensagens por dia, protocolo de crise, travas de custo, e painel do Dono. As Etapas 2 a 6 (porta de
entrada da clínica, uso diário/jornadas, assinatura via Mercado Pago, memória da IA, áudio) **ainda
não foram construídas** — ficam para as próximas fases.

## Como a Renascer IA encaixa no sistema que já existia

Reaproveitou o máximo possível do que já estava pronto, em vez de duplicar:

- **Login**: a Renascer IA usa o MESMO `POST /auth/login` que já existia (e-mail, CPF ou telefone)
  — não precisou de nenhum login separado. Só foi criado um papel novo (`Role.USUARIO_IA`) e uma
  rota pública de cadastro (`POST /ia/cadastro`), que devolve token igual ao login normal.
- **IA da Anthropic**: reaproveita a mesma `ANTHROPIC_API_KEY` que já está configurada no Railway
  desde a leitura automática de comprovante (Fase 1/9) — não precisa de nenhuma chave nova.
- **Privacidade (LGPD)**: a conversa (`ConversaIA`) é isolada por usuário — nenhuma rota de dono,
  atendente ou profissional lê a conversa de ninguém. Só a própria pessoa (via `/ia/mensagens`)
  acessa a própria conversa.

## O que foi implementado

### Cadastro público e bloqueio de duplicidade

`POST /ia/cadastro` (pública, sem login): nome, e-mail, WhatsApp, senha, e um aceite obrigatório
(18+ e termos). Bloqueia e-mail duplicado (o `email` já é único no banco) e bloqueia WhatsApp
duplicado comparando só os dígitos do número (o campo `telefone` não tem unicidade garantida no
banco — caveat já registrado desde a Fase 6 — então a checagem é feita no código, buscando por uma
aproximação pelos últimos 8 dígitos antes de comparar o número completo). Devolve token + usuário,
igual ao login normal, e a pessoa já entra direto na conversa.

### Conversa com limite diário

`GET /ia/mensagens` (histórico) e `POST /ia/mensagens` (enviar) — model `claude-haiku-5-5`,
conforme decidido na especificação, com um prompt de sistema que define o jeito de a IA conversar
(acolhedora, sem diagnóstico, sem substituir terapia, sugere sessão só quando faz sentido). Limite
padrão de 15 mensagens por dia (contado por `ConversaIA` do dia, sem precisar de contador separado
— mesmo padrão de "a receber hoje" que o sistema já usa há várias fases), reconta sozinho à meia-
noite.

### Protocolo de crise

`backend/src/utils/crise.js`: lista de palavras-chave (sem diagnóstico ou "não aguento mais" etc.)
que, quando aparecem na mensagem da pessoa, fazem a resposta vir com `crise: true`. A conversa **não
pausa** (decisão do Elismael) — a IA responde normalmente, e o app mostra um cartão fixo por cima
com "Ligar para o CVV: 188", "Falar com a equipe da Renascer" (abre WhatsApp) e "Risco imediato:
SAMU 192". É um casamento de palavras-chave, não uma IA de verdade analisando a mensagem —
propositalmente mais sensível do que preciso (prefere mostrar o cartão numa mensagem que não era
bem uma crise a deixar passar uma que era).

### Travas de custo

As 4 aprovadas pelo Elismael, todas ativas:

1. Uma conta por WhatsApp e por e-mail (ver cadastro, acima).
2. Tamanho máximo de cada resposta da IA (`max_tokens: 500` na chamada à Anthropic).
3. Teto mensal de gasto com a IA: R$ 150 por padrão, editável pelo Dono. Ao atingir, o grátis cai
   sozinho de 15 para 5 mensagens por dia até o mês virar (modelo `ConfiguracaoIA`, singleton no
   banco, zera `gastoMesAtualReais` sozinho quando o mês muda).
4. Painel do Dono (abaixo).

O gasto é uma ESTIMATIVA (R$ 0,002 por mensagem respondida, somada a cada resposta da IA) — não é
o valor real cobrado pela Anthropic, é só pra alimentar o teto e travar antes que vire um problema
de verdade.

### Painel do Dono — aba nova "Renascer IA"

`GET/PUT /dono/renascer-ia`: mostra gasto do mês contra o teto (com barra), quantos usuários
grátis já se cadastraram, e os campos pra editar o teto mensal e os limites diários (grátis e
assinante). "Assinantes" e "Assinaturas no mês" aparecem zerados com a nota "chega na próxima
etapa" — a assinatura (plano completo pago) é a Etapa 4 da especificação, ainda não construída.

### Telas novas (frontend)

- `/ia/cadastro`: formulário de cadastro + os 4 avisos resumidos (grátis pra começar, conversa
  privada, não é diagnóstico, emergência 188/192) + os 2 aceites.
- `/ia`: a conversa em si — bolhas de mensagem, contador "Restam X de 15 hoje", cartão de crise
  fixo no topo quando acionado, cartão de "limite do dia" com links pro WhatsApp (plano completo /
  profissionais disponíveis — ainda sem página própria, então abrem o WhatsApp da clínica por
  enquanto), aviso fixo embaixo ("Apoio para reflexão. Não é diagnóstico nem substitui terapia."),
  e um botão de microfone desabilitado ("conversa por áudio chega em breve" — Etapa 6).
- `frontend/src/pages/login.js`: ganhou um link "Ainda não tem conta? Conhecer a Renascer IA".
- Como ainda não existe o menu de baixo com as 5 abas da especificação (Hoje, Conversa, Jornadas,
  Sessões, Perfil) — só a Conversa existe nesta etapa — a tela `/ia` não usa o `Layout.js`
  compartilhado do sistema de gestão (que é pros 4 papéis da clínica); tem seu próprio cabeçalho
  simples, já na mesma identidade visual azul/Manrope da Fase 23.

## Simplificações assumidas nesta primeira entrega (vale saber)

A especificação deixa claro que algumas regras dependem de entender o CONTEÚDO da conversa (ex:
"quando o mesmo assunto volta em 3 conversas ou mais", sugerir sessão). Sem um sistema de análise
de tema de verdade, a Etapa 1 usa uma aproximação determinística, documentada no código
(`backend/src/routes/ia.js`): sugere sessão na hora se a pessoa pedir/mencionar terapia
explicitamente, ou a cada 8 mensagens da pessoa (nunca na primeira), respeitando os 7 dias de
pausa quando ela toca em "Agora não". Pode ser ajustado quando o Elismael testar e achar a
frequência muito alta, baixa, ou quiser uma régua diferente.

## Correção feita antes da entrega (vale registrar)

A primeira versão de `backend/src/routes/ia.js` chamava a IA da Anthropic sem proteção de erro —
se a chamada falhasse por qualquer motivo (chave com problema, instabilidade, limite de uso), isso
podia derrubar o servidor inteiro (as 4 áreas da clínica, não só a Renascer IA), por causa de como
o Node trata uma promessa rejeitada sem `try/catch`. Corrigido antes do Elismael colar qualquer
coisa: a chamada agora está protegida, igual ao padrão que `reconhecerComprovante` (leitura de
comprovante) já usava desde o início — se a IA falhar, a pessoa só recebe uma mensagem de
indisponibilidade, o resto do sistema continua no ar.

## ⚠️ Ordem de colagem importa nesta entrega (backend)

Diferente da maioria das fases anteriores, aqui a ORDEM em que os arquivos de backend são colados
no GitHub importa de verdade, porque `backend/src/server.js` agora exige
(`require("./routes/ia")`) o arquivo novo de rotas — se `server.js` for colado ANTES de
`routes/ia.js` existir no repositório, o servidor inteiro trava ao subir (crash de boot), derrubando
as 4 áreas da clínica até o próximo arquivo ser colado. A ordem seguida e recomendada:

1. `backend/prisma/schema.prisma`
2. `backend/src/utils/crise.js`
3. `backend/src/utils/configuracaoIA.js`
4. `backend/src/utils/limiteIA.js`
5. `backend/src/utils/ia.js` (substitui o arquivo que já existia — a leitura de comprovante
   continua funcionando igual, só ganhou a função nova da conversa)
6. `backend/src/routes/dono.js` (substitui o arquivo que já existia)
7. `backend/src/routes/ia.js` (arquivo novo — só depois dos 4 utils acima)
8. `backend/src/server.js` (substitui o arquivo que já existia — **sempre por último**, porque é
   ele que liga a rota nova)

Depois do backend confirmado no ar (todas as 4 áreas antigas continuando normais + `/api/ia/...`
respondendo), os 5 arquivos de frontend podem ser colados em qualquer ordem:
`frontend/src/lib/api.js`, `frontend/src/pages/login.js`, `frontend/src/pages/ia/cadastro.js`
(novo), `frontend/src/pages/ia/index.js` (novo), `frontend/src/pages/dono/index.js` (substitui).

## Arquivos alterados ou criados

- `backend/prisma/schema.prisma`: `Role` ganhou `USUARIO_IA`; `User` ganhou `aceitouTermosIAEm` e
  `sessaoIADispensadaAte`; modelos novos `ConversaIA`, `ConfiguracaoIA` (e o enum
  `AutorMensagemIA`).
- `backend/src/utils/crise.js` (novo), `configuracaoIA.js` (novo), `limiteIA.js` (novo), `ia.js`
  (substituído — ganhou `responderRenascerIA`, manteve `reconhecerComprovante`).
- `backend/src/routes/ia.js` (novo): cadastro público, conversa, dispensar sugestão de sessão,
  apagar conversa.
- `backend/src/routes/dono.js` (substituído): rotas `GET/PUT /renascer-ia`.
- `backend/src/server.js` (substituído): monta `/api/ia`.
- `frontend/src/lib/api.js` (substituído): `rotaPorPapel` manda `USUARIO_IA` pra `/ia`.
- `frontend/src/pages/login.js` (substituído): link pro cadastro da Renascer IA.
- `frontend/src/pages/ia/cadastro.js` (novo), `frontend/src/pages/ia/index.js` (novo).
- `frontend/src/pages/dono/index.js` (substituído): aba nova "Renascer IA".

## Pendência em aberto, não resolvida nesta fase: Prontuário/Evolução (Fase 22)

Ao investigar o código antes de começar esta fase, ficou confirmado que não é só o `schema.prisma`
que está sem os modelos `Prontuario`/`Evolucao` da Fase 22 (já registrado como alerta) — as ROTAS
também estão ausentes de `backend/src/routes/profissional.js` do zip mais recente. Ou seja: é bem
provável que a Fase 22 nunca tenha sido de fato colada no GitHub. Como essa dúvida não bloqueia a
Renascer IA, ela não foi resolvida nesta entrega — o `schema.prisma` desta Fase 24 NÃO reincluiu os
modelos `Prontuario`/`Evolucao` (diferente do que a Fase 22 tinha deixado como plano de segurança),
porque reincluir só o schema sem as rotas e o frontend criaria tabelas sem nenhuma função ligada a
elas. Fica como pergunta em aberto pro Elismael: ele quer que essa funcionalidade (prontuário e
evolução do cliente) seja reconstruída do zero numa fase futura, ou foi descartada?

## Pendências / aguardando teste do usuário

- Colar os 13 arquivos NA ORDEM indicada acima, confirmando "Ready" no Railway e no Vercel antes
  de seguir pro próximo.
- Criar uma conta nova em `/ia/cadastro`, conversar até bater o limite de 15 mensagens, e conferir
  o cartão de "limite do dia".
- Testar o protocolo de crise mandando uma mensagem com uma das palavras-chave (ex: "não aguento
  mais") e confirmar que o cartão aparece sem travar a conversa.
- Como Dono, abrir a aba "Renascer IA", conferir o gasto/usuários, e testar editar o teto e os
  limites.
- Confirmar que o modelo `claude-haiku-5-5` (decidido na especificação) está respondendo — se a
  Anthropic não reconhecer esse identificador de modelo, a IA vai responder sempre com a mensagem
  de "temporariamente indisponível" (proteção que evita derrubar o servidor, mas precisa ser
  testada de verdade em produção pra confirmar que o nome do modelo está certo).
- Decidir a pergunta em aberto do Prontuário/Evolução (acima).

## Próximos passos (ordem de construção da especificação)

Etapa 2 (porta de entrada da clínica): lista de profissionais disponíveis, mini site de cada uma,
formulário que abre o WhatsApp, aviso pra atendente ("Pedidos da Renascer IA"). Depois: Etapa 3
(tela Hoje, perguntas de entrada, alívio rápido, primeira jornada), Etapa 4 (assinatura via Mercado
Pago), Etapa 5 (memória da IA, resumo pra profissional, lembretes, demais jornadas), Etapa 6
(áudio).

---

# Fase 25 -- Correção: fundo branco quadrado atrás da logo em todo o sistema (entregue em 12/10/2026)

O Elismael reportou (com print da tela de cadastro da Renascer IA) que a logo aparecia dentro de
um quadrado branco, em vez de flutuar livre sobre o fundo da página -- pediu para corrigir em
TODAS as telas do sistema (cabeçalho/menu, login, e as telas da Renascer IA), não só numa tela
específica.

## Causa

A Fase 23 tinha registrado que "a logo já estava certa" porque o arquivo
`frontend/public/logo.png` parecia ser a mesma imagem enviada pelo Elismael -- só que, nessa
checagem, ninguém tinha conferido se o arquivo realmente tinha fundo transparente. Na prática, o
`frontend/public/logo.png` que está no repositório é uma versão sem transparência (modo RGB puro,
sem canal alfa) -- fundo branco sólido "gravado" dentro da própria imagem. Como o componente
`Logo.js` (usado por `Layout.js`, `login.js`, `ia/index.js` e `ia/cadastro.js` -- ou seja, por
TODAS as telas que mostram a logo) sempre aponta para esse mesmo arquivo único, o quadrado branco
aparecia em qualquer lugar do sistema, sempre que o fundo da página não fosse também branco.

## Correção

- `frontend/public/logo.png` foi reprocessado para remover o fundo branco e ganhar transparência
  de verdade (canal alfa), preservando as cores, os traços e o padrão sutil de rede neural que já
  faziam parte do desenho original -- testado visualmente sobre fundo claro, fundo escuro e fundo
  quadriculado antes do envio, sem nenhuma borda ou "auréola" branca sobrando ao redor das letras.
- Como é o ÚNICO arquivo de imagem que todas as telas usam (através do componente `Logo.js`),
  trocar só esse arquivo já resolve o quadrado branco em todo lugar de uma vez: menu lateral e
  cabeçalho do sistema de gestão (dono, atendente, profissional, cliente), tela de login, e as
  telas da Renascer IA (cadastro e conversa) -- sem precisar editar nenhum arquivo de código.
- Os ícones do aplicativo instalável (PWA -- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`)
  NÃO foram alterados nesta fase: esses têm fundo de propósito (o sistema do celular/computador
  aplica um formato por cima do ícone, e um ícone transparente costuma ficar feio nesse caso) --
  se o Elismael achar que esses também precisam de ajuste, é só avisar.

## Arquivo alterado

- `frontend/public/logo.png` (substituído -- é uma imagem, não tem como mostrar o "código"
  alterado, mas o arquivo é mais leve que parece: mesma logo oficial, só com o fundo branco
  removido).

## Pendência / aguardando teste do usuário

- Confirmar visualmente, depois do deploy, que a logo aparece sem o quadrado branco no menu do
  sistema, na tela de login e nas telas da Renascer IA (`/ia/cadastro` e `/ia`).

---

# Fase 26 -- Link da Renascer IA dentro do painel do Dono + tela não ficar presa em "Carregando..." (entregue em 12/10/2026)

Dois pedidos do Elismael juntos: (1) ele reportou (com print) que a aba "Renascer IA" do painel do
Dono ficava presa em "Carregando..." para sempre; (2) ele pediu para também conseguir pegar o link
de cadastro da Renascer IA de dentro do painel do Dono, sem precisar lembrar o endereço de cor.

## Causa do "Carregando..." para sempre

A função que busca os dados dessa aba (`GET /dono/renascer-ia`) não tinha nenhum tratamento de
erro -- se a chamada falhasse por qualquer motivo (instabilidade, sessão expirada, etc.), a tela
ficava esperando pra sempre um resultado que nunca chegava, sem avisar nada pro Elismael nem dar
um jeito de tentar de novo. É a mesma categoria de cuidado já aplicada antes na chamada da IA de
verdade (Fase 24) -- proteger toda chamada de rede pra nunca travar a tela sem explicação.

## O que foi corrigido/adicionado

- A busca dos dados agora tem tratamento de erro: se não conseguir carregar, aparece uma mensagem
  clara explicando isso e um botão "Tentar de novo", em vez de ficar preso pra sempre em
  "Carregando...".
- Card novo no topo da aba "Renascer IA" do Dono: "Link para divulgar a Renascer IA", mostrando o
  endereço completo (`/ia/cadastro`, no mesmo domínio que o Elismael estiver acessando) e um botão
  "Copiar link" -- copia pra área de transferência com um aviso "Copiado!", pronto pra colar no
  WhatsApp ou onde quiser divulgar.

## Arquivo alterado

- `frontend/src/pages/dono/index.js` (substituído): só a função `AbaRenascerIA` foi alterada --
  nada mais da tela do Dono foi tocado.

## Pendência / aguardando teste do usuário

- Confirmar, depois do deploy, que a aba "Renascer IA" do Dono carrega normalmente (gasto,
  usuários, limites) -- se continuar presa em "Carregando..." ou mostrar a mensagem de erro,
  avisar a mensagem exata que aparece, pra investigar a causa raiz do lado do servidor.
- Testar o botão "Copiar link" e confirmar que o link colado abre a tela de cadastro da Renascer
  IA corretamente.

---

# Fase 27 -- Primeira rodada de segurança: freio contra tentativa de adivinhar senha, cabeçalhos de proteção (entregue em 17/10/2026)

O Elismael perguntou se o sistema é criptografado de ponta a ponta, se alguém conseguiria invadir
hoje, e pediu pra fechar as vulnerabilidades pensando na LGPD (dados de saúde). Resposta dada na
hora, registrada aqui pra não se perder: o sistema NÃO é criptografado de ponta a ponta (isso é só
pra apps tipo WhatsApp -- um sistema de prontuário PRECISA que o servidor leia os dados pra
funcionar), mas toda informação que viaja entre o aparelho e o servidor já vai protegida por HTTPS
(criptografia "em trânsito"), senha de todo mundo já é guardada criptografada (bcrypt) e cada
papel só acessa o que tem permissão -- isso já estava certo desde o início. Os pontos fracos reais,
identificados nessa conversa, viraram um plano em ordem de prioridade; esta fase entrega os dois
primeiros, que são só backend e não mexem em nenhuma tela.

## O que foi corrigido nesta fase

- **Freio contra adivinhar senha (força bruta)**: antes, não existia NENHUM limite de quantas vezes
  alguém podia tentar logar errado seguidas vezes -- um programa automatizado podia tentar milhares
  de senhas sem o sistema notar ou bloquear. Agora, `POST /api/auth/login` aceita no máximo 15
  tentativas por IP a cada 15 minutos; passou disso, a resposta vira "Muitas tentativas seguidas.
  Aguarde alguns minutos e tente de novo." -- não afeta ninguém no uso normal (uma pessoa não erra a
  senha 15 vezes em 15 minutos à toa).
- **Mesmo freio no cadastro público da Renascer IA** (`POST /api/ia/cadastro`): limite de 10
  tentativas por IP a cada 15 minutos, pra não dar pra criar contas em massa automaticamente.
- **Freio geral mais largo em toda a API** (600 requisições por IP a cada 15 minutos): uma rede de
  segurança básica contra um ataque de sobrecarga, sem afetar o uso real de ninguém (é bem mais que
  qualquer uso humano normal do sistema).
- **Cabeçalhos de proteção padrão** (biblioteca `helmet`): ativa um conjunto de proteções do
  navegador contra alguns ataques conhecidos (ex: um site malicioso tentando se passar pela nossa
  API). Como a API só devolve dado (JSON), não tela, isso não muda nada visualmente em lugar
  nenhum.
- **Brecha fechada no CORS**: antes, se a variável `FRONTEND_URL` não estivesse configurada no
  Railway, a API aceitava pedido de QUALQUER site (`origin: "*"`) -- agora, sem essa variável
  configurada, o padrão passa a ser só o endereço oficial do sistema
  (`https://renascer-sistema.vercel.app`), em vez de liberar geral.
- Ajuste técnico necessário pros freios funcionarem certo: `app.set("trust proxy", 1")` -- o
  Railway coloca a API atrás de um proxy, e sem essa linha o sistema de freio podia achar que todo
  mundo que acessa é "o mesmo computador" (o que quebraria a contagem por pessoa).

## O que FICA de pendência, pra uma próxima rodada (ainda não resolvido)

- **Backup do banco de dados**: ainda não está confirmado se o Railway tem uma rotina de backup
  automático ativada pro banco Postgres do sistema. Isso não se resolve por código -- é uma
  configuração direto no painel do Railway (plano/serviço de banco). Preciso que o Elismael
  confira isso no painel (ou me diga o plano do Railway que está usando) pra eu orientar certo.
- **Verificação em duas etapas (2FA)** pra login de Dono e Profissional (quem vê mais dado
  sensível) -- ainda não existe.
- **Criptografia a mais pros campos mais sensíveis** dentro do próprio banco (CPF, prontuário,
  evolução) -- hoje ficam protegidos por quem pode acessar, mas não "embaralhados" dentro do banco
  além disso.
- **Parte jurídica da LGPD** (política de privacidade, base legal de cada dado, um responsável
  formal pelos dados/encarregado, fluxo de exclusão de dados a pedido do cliente) -- isso não é
  código, precisa do setor jurídico do Elismael.

## Arquivos alterados

- `backend/package.json`: duas dependências novas (`helmet`, `express-rate-limit`).
- `backend/src/server.js`: freios de tentativa, cabeçalhos de proteção, ajuste de proxy e correção
  do CORS -- tudo dentro do mesmo arquivo que já configura a API, nenhuma rota de negócio foi
  tocada.

## Teste feito antes de entregar

Simulação isolada (fora do sistema de verdade, só pra validar o comportamento do freio): 5
tentativas seguidas de login contra um servidor de teste com o mesmo código -- as 3 primeiras
passaram normal, a 4ª e a 5ª foram bloqueadas com a mensagem de espera, confirmando que o freio
funciona exatamente como esperado antes de aplicar o valor final (15) no sistema de verdade.

## Pendência / aguardando teste do usuário

- Confirmar que login, cadastro da Renascer IA e o uso normal do sistema continuam funcionando
  normalmente depois do deploy (o freio é alto o bastante pra nunca incomodar o uso real).
- Me dizer se o Railway já tem backup automático do banco configurado, pra eu documentar isso e
  partir pro próximo item da lista de segurança.

---

# Fase 28 -- Categoria "Formulários": pesquisas com link público (estudo de clima da equipe) (entregue em 20/10/2026)

O Elismael pediu uma nova categoria chamada "Formulários": o Dono cria um formulário com
perguntas (ex: uma pesquisa de clima com a equipe, depois uma pesquisa de satisfação com os
clientes), o sistema gera um link único pra esse formulário, e qualquer pessoa que receber o
link -- profissional ou cliente -- consegue preencher nome, e-mail e as respostas SEM precisar
ter login no sistema. Assim que alguém envia, a resposta aparece listada dentro do formulário,
pro Dono ver quem respondeu e o que respondeu.

Essa fase entrega a primeira versão funcionando, já com o primeiro formulário pronto pra usar: o
"Estudo de Clima" com a equipe, com as 8 perguntas que o Elismael mandou (o texto de introdução
foi adaptado -- a frase pedindo pra responder até uma data foi removida, já que agora é um link
que ele manda direto, sem prazo fixo escrito).

## Como funciona

- **Categoria "Formulários" nova** no menu do Dono: lista todos os formulários criados, cada um
  com seu link público (com botão de copiar), quantas respostas já chegaram, um jeito de ativar
  ou desativar o link (desativar fecha o formulário pra novas respostas sem apagar as que já
  chegaram) e de excluir (isso sim apaga tudo daquele formulário, com confirmação antes).
- **Criar um novo formulário**: título, um texto de introdução (opcional, aparece antes das
  perguntas) e as perguntas, uma por uma -- cada pergunta tem um texto e um tipo: resposta curta
  (uma linha), texto longo (várias linhas), múltipla escolha (o Dono digita as opções) ou escala
  de 0 a 10 (nota, tipo NPS -- o mesmo formato da última pergunta do estudo de clima). Dá pra
  marcar cada pergunta como obrigatória ou não.
- **Link público pra responder** (`/formularios/{link}`): tela própria, sem precisar de login,
  parecida com a do cadastro da Renascer IA -- mostra o título, a introdução e as perguntas, pede
  nome e e-mail de quem está respondendo, e ao enviar mostra uma tela de agradecimento. Se o
  formulário foi desativado ou o link está errado, mostra um aviso em vez de dar erro.
- **Ver respostas**: dentro de cada formulário, um botão "Ver respostas" mostra a lista de quem
  respondeu -- nome, e-mail, data/hora e a resposta de cada pergunta, uma abaixo da outra.
- **Primeiro formulário já vem pronto**: o "Estudo de Clima" com a equipe, com as 8 perguntas que
  o Elismael mandou, já criado automaticamente no deploy (o Elismael só precisa abrir a aba
  Formulários, copiar o link e mandar pra quem quiser responder -- não precisa criar nada na
  mão). Se ele quiser mudar alguma pergunta depois, pode editar normalmente pela tela (criar um
  novo formulário com o texto ajustado, ou pedir pra eu ajustar o texto original).

## Uso planejado (avisado pelo Elismael, ainda não construído nesta fase)

Uma segunda pesquisa, parecida, pra mandar pros clientes avaliarem o atendimento e os
profissionais -- ainda sem as perguntas definidas; entra numa próxima fase quando o Elismael
mandar o conteúdo.

## Arquivos novos ou alterados

- `backend/prisma/schema.prisma`: 3 modelos novos (`Formulario`, `PerguntaFormulario`,
  `RespostaFormulario`) e 1 enum novo (`TipoPerguntaFormulario`) -- mudança só de "adicionar",
  não apaga nem muda nada que já existia; aplica sozinha no próximo deploy.
- `backend/src/routes/formulario.js` **(novo)**: rotas públicas (ver formulário e enviar
  resposta, sem login) e rotas só do Dono (criar, editar, excluir, listar e ver respostas).
- `backend/src/server.js`: liga as rotas novas (`/api/formularios`) e aplica o mesmo freio contra
  spam que já existe nas outras rotas públicas (máximo de respostas por IP a cada 15 minutos).
- `backend/prisma/seed.js`: cria automaticamente o primeiro formulário ("Estudo de Clima") com
  as 8 perguntas, de um jeito que não duplica nada se o seed rodar de novo em deploys futuros.
- `frontend/src/pages/dono/index.js`: aba nova "Formulários" no menu do Dono (listar, criar,
  copiar link, ativar/desativar, excluir, ver respostas).
- `frontend/src/pages/formularios/[token].js` **(novo)**: a tela pública onde qualquer pessoa
  preenche e envia as respostas pelo link.

Essa entrega vem junto com a Fase 27 (segurança -- freio contra tentativa de adivinhar senha,
cabeçalhos de proteção, correção do CORS), porque o Elismael avisou que ainda não tinha aplicado
aquela atualização e preferiu subir as duas juntas.

## Teste feito antes de entregar

- `node -c` em todos os arquivos novos/alterados do backend (sem erro de sintaxe).
- Checagem de chaves/parênteses balanceados no `schema.prisma` inteiro depois da edição.
- Validação de JSX (Babel) nos dois arquivos de frontend alterados/criados.

## Pendência / aguardando teste do usuário

- Depois do deploy: abrir a aba Formulários, confirmar que o "Estudo de Clima" já aparece
  pronto, copiar o link e testar preenchendo numa aba anônima (sem estar logado) pra confirmar
  que a resposta chega certinho na lista.
- Me avisar quando tiver o conteúdo da segunda pesquisa (clientes) pra eu criar do mesmo jeito.


---

# Fase 30 — "Meu dia" entra no sistema de verdade: checklist diário, indicadores reais, marketing, gestão de pessoas, fechamento de caixa, diário de decisões e metas do trimestre, pros 3 logins de gestão (entregue em 21/10/2026)

O Elismael pediu pra trazer pro sistema de verdade o módulo "Meu dia" que já existia como mockup
(visual) — e, quando perguntado sobre o tamanho da entrega, escolheu a versão mais completa
possível: pros 3 logins de gestão de uma vez (Dono, Atendente e Profissional, não só o Dono) e com
todos os indicadores puxando dado real já nessa entrega, mesmo os que ainda não tinham nenhuma
fonte de dado no sistema (precisando então criar essa fonte de dado nova, não só a conta em cima
do que já existia).

## Decisão de recorte entre os 3 logins (importante)

O mockup original só existia pro Dono. Como não havia nenhuma referência visual pro "Meu dia" da
Atendente ou da Profissional, a entrega seguiu um critério claro, coerente com a separação de
permissões que o sistema já tinha desde o início (financeiro consolidado da clínica sempre foi só
do Dono):

- **Dono**: painel completo, igual ao mockup — checklist diário, indicadores de toda a clínica
  (financeiro, crescimento, marketing, processos, pessoas, estratégia), marketing, gestão de
  pessoas, fechamento de caixa, diário de decisões e metas do trimestre.
- **Atendente**: um "Meu dia" enxuto, só com o que já era dela em outras partes do sistema —
  checklist diário operacional, indicadores de agenda do dia e fila de reativação, e o mesmo
  registro de marketing do Dono (ela também pode lançar o que postou/respondeu). **Nenhum número
  financeiro consolidado da clínica aparece pra ela** — contratos quebrariam uma separação que o
  sistema sempre manteve.
- **Profissional**: um "Meu dia" enxuto, só com os dados dela mesma, que ela já vê em outras
  abas (Agenda, Financeiro) — checklist diário, sessões de hoje, repasse pendente, taxa de faltas
  e tempo de resposta dela, clientes perto de renovar.

Se esse recorte não for o que o Elismael tinha em mente, é só avisar — dá pra ajustar o que cada
papel vê sem precisar refazer a base.

## Indicadores: o que já tinha dado real e o que precisou de fonte de dado nova

Boa parte dos indicadores do mockup já tinha tudo que precisava no sistema (só precisava da
conta): saldo de caixa, faturamento, repasses, clientes novos/churn, sessões realizadas por
profissional. Esses entraram direto, sem mudança de schema.

Três indicadores PRECISAVAM de dado novo e a entrega já criou a fonte, além da conta:

- **Taxa de faltas** e **tempo médio de resposta**: na real já existia tudo (status "FALTOU" do
  Agendamento, e as mensagens entre profissional e cliente) — só faltava a conta em cima disso.
  Sem mudança de schema.
- **Leads/clientes novos por canal e CAC (custo por cliente)**: precisou de um campo novo opcional
  no cadastro do cliente (de onde ele veio: Instagram, Facebook, Google, Indicação, Outro) e um
  registro novo de gasto com anúncio (dentro do Fechamento de caixa, com o canal). Como o sistema
  não tem hoje nenhuma captura de "lead" que não virou cliente, o indicador conta clientes
  CONVERTIDOS por canal — não visitas/contatos que não fecharam. Fica zerado até a Atendente
  começar a informar a origem nos cadastros novos e o Dono lançar gasto de anúncio.
- **Ponto de equilíbrio, lucro do mês e meses de reserva**: dependiam de o Elismael definir o que é
  "custo fixo mensal" da clínica — isso não existia em nenhum lugar do sistema (só existe o caixa
  de entradas/saídas). Criada uma configuração simples (custo fixo mensal + reserva de caixa,
  editável na aba Fechamento de caixa) — enquanto não for preenchida, esses indicadores aparecem
  zerados/sem conta, nunca inventados.

**Ficou de fora desta entrega** (avisado, não construído): alcance e engajamento reais do
Instagram/Meta — isso exigiria integração com a API do Meta Business (login comercial, permissões,
etc.), um projeto à parte, bem maior que "adicionar um campo". Por enquanto esse número continua
sem indicador automático — o registro de marketing (quantos posts/stories/respostas no mês) é o
que existe como proxy.

## O que foi criado — resumo por categoria

- **Checklist diário e de implantação**: um item só de banco de dados (`ChecklistConclusao`) serve
  os 3 papéis — cada um com sua própria lista de itens (definida no código de cada painel,
  fácil de ajustar depois). "Hoje" marca por dia; "Implantação" marca uma vez só e não some.
- **Marketing**: registro de post/stories/resposta/avaliação, com link opcional — Dono e Atendente
  registram no mesmo lugar (log compartilhado da equipe).
- **Gestão de pessoas**: anotações do Dono sobre cada profissional (alinhamento, feedback,
  dificuldade, treinamento) — só o Dono vê e registra.
- **Diário de decisões**: registro livre de decisões/ideias do dia a dia, só do Dono.
- **Fechamento de caixa**: lançamentos soltos de entrada/saída que não são pagamento de cliente
  (anúncio, aluguel, material, repasse pago, outro), com o saldo do sistema calculado
  automaticamente pro dia (entradas de cliente recebidas pela clínica + esses lançamentos) e uma
  conferência contra o saldo informado do banco/Pix, salva por dia.
- **Metas do trimestre**: diferente da "Meta pessoal" que já existia (essa é a finança pessoal do
  Elismael) — aqui são metas da CLÍNICA (faturamento, clientes novos, o que o Dono quiser),
  separadas por trimestre, com valor atual atualizado manualmente.
- **Indicadores**: uma rota só por papel, já calculando tudo junto (nunca mais de uma chamada por
  tela).

## O que muda pra quem já usa o sistema hoje

- Nenhum dado existente foi alterado ou apagado — todas as mudanças de banco são só de
  "acrescentar" (campos e tabelas novas), aplicam sozinhas no próximo deploy.
- O cadastro de cliente (recepção) ganhou um campo novo opcional "De onde veio?" — quem não
  preencher, nada muda pra esse cliente.
- Marcar falta numa sessão já era possível (status "Faltou" já existia na Agenda) — agora esse
  dado também alimenta o indicador de taxa de faltas.

## Arquivos novos ou alterados

- `backend/prisma/schema.prisma`: 4 enums novos (`CanalOrigem`, `TipoMovimentoCaixa`,
  `TipoRegistroMarketing`, `TipoRegistroPessoas`), 1 campo novo opcional em `Cliente`
  (`canalOrigem`) e 8 modelos novos (`ChecklistConclusao`, `RegistroMarketing`, `RegistroPessoas`,
  `DecisaoRegistro`, `MovimentoCaixa`, `ConferenciaCaixa`, `MetaTrimestre`,
  `ConfiguracaoFinanceiraClinica`) — tudo "acrescentar", nada removido/alterado do que já existia.
- `backend/src/utils/meuDia.js` **(novo)**: todas as contas compartilhadas pelos 3 painéis (saldo
  de caixa do dia, taxa de faltas, tempo de resposta, CAC por canal, configuração financeira da
  clínica) — um lugar só, pra não repetir a mesma conta 3 vezes.
- `backend/src/routes/comum.js`: rotas de checklist (`/comum/meu-dia/checklist`), compartilhadas
  pelos 3 papéis de gestão (Cliente e usuário da Renascer IA não têm acesso).
- `backend/src/routes/dono.js`: todas as rotas do painel completo (`/dono/meu-dia/*`) —
  indicadores, configuração financeira, marketing, pessoas, caixa, decisões, metas.
- `backend/src/routes/atendente.js`: rotas do recorte dela (`/atendente/meu-dia/*`) — indicadores
  operacionais e marketing; e o cadastro de cliente ganhou o campo opcional `canalOrigem`.
- `backend/src/routes/profissional.js`: rota do recorte dela (`/profissional/meu-dia/indicadores`).
- `frontend/src/components/ChecklistMeuDia.js` **(novo)**: componente do checklist, reaproveitado
  pelos 3 painéis.
- `frontend/src/components/Layout.js`: ícone novo (sol) pra aba "Meu dia" no menu lateral.
- `frontend/src/pages/dono/index.js`: aba nova "Meu dia", com as 8 sub-abas (Hoje, Indicadores,
  Marketing, Gestão de pessoas, Fechamento de caixa, Diário de decisões, Metas do trimestre,
  Implantação).
- `frontend/src/pages/atendente/index.js`: aba nova "Meu dia" (Hoje, Indicadores, Marketing,
  Implantação) e o campo "De onde veio?" no cadastro de cliente.
- `frontend/src/pages/profissional/index.js`: aba nova "Meu dia" (Hoje, Indicadores, Implantação).

## Teste feito antes de entregar

- `node -c` (checagem de sintaxe) em todos os arquivos de backend novos/alterados.
- Checagem de chaves/parênteses balanceados e de nomes duplicados (modelo, enum e tabela) no
  `schema.prisma` inteiro depois da edição — sem conseguir rodar o `prisma validate` de verdade
  aqui (sem acesso de rede pro binário do Prisma neste ambiente), então essa é uma checagem
  estrutural, não substitui o `npx prisma generate` que o Railway já roda sozinho no deploy.
- Validação de JSX (Babel) em todos os arquivos de frontend novos/alterados.
- Checagem de função/componente duplicado (mesmo nome declarado duas vezes) em cada página de
  frontend alterada.
- Simulação isolada (sem banco de dados) da LÓGICA das contas mais delicadas de
  `backend/src/utils/meuDia.js` — pareamento de mensagens pro tempo de resposta, combinação de
  canal pro CAC, aritmética do saldo de caixa e taxa de faltas — com dados de exemplo, incluindo os
  casos de borda (sem dado nenhum, gasto sem cliente novo, mensagem sem resposta) — todos os casos
  bateram com o esperado antes de aplicar a mesma lógica nas rotas de verdade.
- **Não foi possível testar contra um banco Postgres real** (não tenho acesso ao banco de
  produção nem a um Postgres neste ambiente) — isso é obrigatório fazer depois do deploy, antes de
  divulgar a funcionalidade pra equipe.

## Pendência / aguardando teste do usuário

- Depois do deploy: abrir a aba "Meu dia" nos 3 logins, confirmar que cada uma carrega sem erro.
- Testar o checklist (marcar/desmarcar) em "Hoje" e "Implantação" nos 3 logins.
- No login do Dono: configurar o custo fixo mensal e a reserva de caixa (aba Fechamento de caixa)
  pra ativar os indicadores de ponto de equilíbrio/lucro/meses de reserva; cadastrar a primeira
  meta do trimestre; lançar um gasto de anúncio de teste com canal, e cadastrar um cliente teste
  com "De onde veio?" preenchido (como Atendente), pra ver o CAC calcular.
- Confirmar se o recorte entre os 3 logins (o que cada um vê) ficou do jeito que o Elismael
  esperava — esse ponto foi uma decisão minha, documentada acima, pra manter a mesma separação de
  financeiro que o sistema já tinha, mas pode ser ajustado se não for o que ele queria.
- Avisar se "alcance e engajamento do Instagram" (não construído — precisaria de integração com a
  API do Meta) é prioridade pra uma próxima fase.

# Fase 31 — Setor Financeiro: login novo, painel de CAC/ROI/imposto/retiradas (entregue em 21/10/2026)

Depois da Fase 30 ("Meu dia"), o Elismael mandou o link do canvas de design completo (26 telas,
"Novo Layout — Espaço do Renascer") e deixou claro que queria TUDO que foi desenhado ali, não só a
parte de "Meu dia" — incluindo um login novo que ainda não existia em nenhum lugar do sistema até
essa conversa: o **Setor Financeiro** (uma pessoa, ex: "Patrícia", cuidando do financeiro da
clínica no dia a dia). Essa entrega é a primeira parte desse pedido maior — o login e o painel
financeiro completos. As outras partes (Mapas mentais, Secretaria/Supervisão da atendente, e o
redesign visual das ~20 telas que já existiam) vêm em fases separadas, avisando a cada uma pronta.

## O que entrou nessa fase

- **Login novo**: papel `FINANCEIRO` no sistema, criável pelo Dono em Usuários (`Setor
  Financeiro` no formulário de criar login), com e-mail/senha provisória iguais a qualquer outro
  login. Pode ser excluído como qualquer outro.
- **Painel financeiro** (tela nova, `/financeiro`, já no novo visual — ver abaixo):
  - 4 indicadores do dia: CAC, ROI, Receita de hoje e Lucro de hoje (os dois últimos reaproveitam
    a MESMA conta de saldo de caixa que o Dono já usa em "Meu dia > Caixa" — não é um número
    novo/paralelo, é o mesmo caixa visto por outro login).
  - **Investimento em anúncios — análise diária**: lança quanto foi investido + leads do WhatsApp
    + conversões de hoje; isso alimenta o CAC/ROI de cima e também lança automaticamente a saída
    correspondente no caixa da clínica (lançar de novo o mesmo dia atualiza em vez de duplicar).
  - **Calculadora de imposto**: valor recebido + % → calcula e lança como saída no caixa.
  - **Retiradas e pró-labore**: sem valor fixo — cada retirada (Maria, Patrícia, pró-labore do
    Elismael etc.) é lançada na hora, com filtro por hoje/semana/mês/histórico completo.
  - **Pagamento de anúncios de hoje**: liga/desliga "pago" pra Meta Ads e Google Ads, por dia.
  - 3 abas de apoio, reaproveitando a MESMA lógica que Dono/Atendente já usam (sem duplicar
    conta): **Clientes pra renovar**, **Repasses** (marcar repasse de profissional como
    confirmado) e **Agenda geral**.

## Decisão de arquitetura: por que quase não criei tabela nova

O mockup pedia retirada, imposto e investimento em anúncio como "lançamentos". Em vez de criar uma
tabela nova pra cada um (o que duplicaria o `MovimentoCaixa` que a Fase 30 já criou pro caixa do
Dono), **retirada e imposto viram um `MovimentoCaixa` de saída normal** (mesma tabela,
categorias `"Retirada/Pró-labore"` e `"Imposto"`) — assim o caixa/lucro do dia do Dono já sai
batendo sozinho com o que o Setor Financeiro lança, sem precisar de nenhuma conciliação manual
entre duas fontes de dado. Só o **investimento em anúncio** precisou de tabela própria
(`InvestimentoAnuncioDiario`), porque é o único lançamento que guarda *leads* e *conversões* —
dados que não existiam (e não fazem sentido) dentro de `MovimentoCaixa`; mesmo assim, ele também
gera/atualiza um `MovimentoCaixa` ligado, pelo mesmo motivo acima.

O **ROI** usa o ticket médio real dos últimos 30 dias (média de `valorTotal` das transações), em
vez de um valor fixo — fica mais preciso conforme a clínica for lançando pagamentos de verdade, e
não exige cadastrar "preço médio do pacote" em nenhum lugar.

## Visual: começo do novo design (Sora + Public Sans, navy/azul/dourado)

O painel financeiro já nasce no visual NOVO do canvas (sidebar navy `#0D1B30`, azul `#0B5FA8`,
detalhe dourado `#9C6B2E`, títulos em Sora e texto em Public Sans) — não no visual atual
(Manrope/azul claro) usado pelas outras ~20 telas. Pra isso, criei um componente de casca
reaproveitável, `frontend/src/components/LayoutNovo.js`, com a MESMA API de props do `Layout.js`
atual (user/abas/abaAtiva/onTrocarAba/children) — ele vai servir de base pro redesign visual das
telas antigas na(s) próxima(s) fase(s), em vez de reescrever a casca de novo pra cada uma. Os
tokens de cor/fonte novos entraram em `tailwind.config.js` com nomes próprios (prefixo `nv`:
`nv-navy`, `nv-blue`, `nv-gold` etc., fontes `font-sora`/`font-publicSans`) — **sem tocar** nos
tokens `renascer`/`gold` que as telas antigas ainda usam, então nada do visual atual muda até eu
redesenhar tela por tela.

As 3 abas de apoio (Clientes pra renovar, Repasses, Agenda geral) foram construídas funcionais
nesse mesmo visual novo, mas sem o acabamento 1:1 dos artboards específicos deles no canvas (eu só
tinha lido o artboard do próprio Painel Financeiro até agora) — a função tá completa, o polimento
visual exato dessas 3 entra junto do lote de redesign.

## Arquivos novos ou alterados

- `backend/prisma/schema.prisma`: 1 valor novo no enum `Role` (`FINANCEIRO`), 1 campo novo em
  `User` (`financeiro`), 3 modelos novos (`Financeiro`, `InvestimentoAnuncioDiario`,
  `PagamentoAnuncioStatus`) — tudo "acrescentar", nada removido/alterado do que já existia.
- `backend/src/routes/financeiro.js` **(novo)**: todas as rotas do painel (`/financeiro/*`).
- `backend/src/server.js`: registra a rota nova (`app.use("/api/financeiro", ...)`).
- `backend/src/middleware/auth.js` e `backend/src/routes/auth.js`: o login/sessão passam a
  carregar também o perfil `financeiro` (igual já faziam com profissional/cliente/atendente/dono).
- `backend/src/routes/dono.js`: o formulário de criar login (`POST /dono/usuarios`) aceita o
  papel `FINANCEIRO`.
- `backend/src/utils/excluirUsuario.js`: função nova `excluirFinanceiro` + ligada na exclusão
  genérica de usuário.
- `frontend/src/pages/dono/index.js`: opção "Setor Financeiro" no select de criar login.
- `frontend/src/lib/api.js`: `rotaPorPapel` manda `FINANCEIRO` pra `/financeiro` depois do login.
- `frontend/src/components/LayoutNovo.js` **(novo)**: casca do novo visual (ver seção acima).
- `frontend/src/pages/financeiro/index.js` **(novo)**: a tela toda do Setor Financeiro.
- `frontend/tailwind.config.js`: tokens de cor/fonte novos (`nv-*`, `font-sora`,
  `font-publicSans`), sem alterar nenhum token existente.
- `frontend/src/styles/globals.css`: import das fontes Sora + Public Sans (Google Fonts), sem
  remover o import da Manrope que as telas antigas usam.

## Teste feito antes de entregar

- `node -c` (checagem de sintaxe) em todos os arquivos de backend novos/alterados — todos OK.
- Checagem de chaves/parênteses balanceados no `schema.prisma` inteiro e nos 2 arquivos de
  frontend novos (`LayoutNovo.js`, `financeiro/index.js`) depois da edição.
- **Não foi possível rodar `npx prisma validate`** nem `next build` de verdade neste ambiente
  (sem acesso de rede pro binário do Prisma; o `node_modules` do frontend aqui não tem o Next
  instalado) — a mesma limitação já registrada na Fase 30. Isso é checagem estrutural, não
  substitui o `npx prisma generate`/build que o Railway e a Vercel já rodam sozinhos no deploy.
- Revisão manual linha a linha de cada conta nova (CAC, ROI, custo por lead, cor vermelho/verde do
  CAC comparando com o dia anterior, total do período de retiradas) comparando com a lógica
  exata do mockup (`Financeiro-Setor.dc.html`), incluindo os casos de borda (sem lançamento
  nenhum ainda, dia sem conversão, histórico vazio).

## Pendência / aguardando teste do usuário

- Depois do deploy: `npx prisma migrate dev` (ou `deploy`, conforme o ambiente) pra criar as
  tabelas novas no Postgres do Railway — sem isso o painel financeiro não funciona.
- Criar o primeiro login de Setor Financeiro pelo painel do Dono (Usuários → Setor Financeiro) e
  testar o login.
- Lançar um dia de investimento em anúncio de teste e confirmar que aparece certo no histórico e
  que o CAC/ROI do topo atualiza.
- Confirmar que "Receita de hoje"/"Lucro de hoje" batem com o que o Dono já vê em "Meu dia > Caixa"
  no mesmo dia (é a mesma conta, então tem que bater exatamente).
- Avisar se quer que o Dono também acesse essa MESMA tela (hoje o acesso de tela é só pro login
  Setor Financeiro; o backend já libera o Dono também, só falta decidir se vale a pena abrir a
  tela pra ele ou se o painel de "Meu dia" dele já basta).
- Próximas partes do pedido maior (vou avisando conforme cada uma ficar pronta): Mapas mentais
  (Dono), Secretaria/Supervisão da Atendente (Dono), e o redesign visual lote a lote das telas que
  já existem.

# Fase 32 — Mapas mentais do Dono: planejamento visual com nós arrastáveis (entregue em 21/10/2026)

## Contexto do pedido

Segunda parte do pedido maior (depois do Setor Financeiro, na Fase 31): uma aba nova dentro do
próprio login do Dono, "Mapas mentais", pra ele organizar estratégias, tarefas e ideias pro futuro
em formato de mapa mental — nós que podem ter filhos, arrastáveis pela tela, agrupados em mapas
separados (ex: "Estratégias", "Tarefas", "Futuro da plataforma").

## O que foi construído

- Tabela nova `mapas_mentais`, uma por mapa, pertencendo a um Dono. Cada mapa guarda nome, cor (a
  cor dos ramos/nó raiz) e a lista de nós inteira num campo JSON (`nodes`), no formato
  `[{id, texto, x, y, parentId}]` — o mesmo formato usado no mockup/canvas. Optei por JSON em vez
  de uma tabela "nó" separada porque a estrutura de um mapa é livre (qualquer nó pode ter qualquer
  quantidade de filhos, em qualquer profundidade) e o mapa inteiro sempre é lido/editado de uma vez
  só — não tem nenhuma tela que precise buscar "só um nó" no banco.
- Rotas novas em `backend/src/routes/mapasMentais.js` (só pra quem loga como DONO):
  - `GET /mapas-mentais` — lista os mapas do Dono (nome, cor, quantidade de nós).
  - `GET /mapas-mentais/:id` — um mapa específico, com todos os nós.
  - `POST /mapas-mentais` — cria um mapa novo (já nasce com o nó raiz, que é o próprio nome do
    mapa); a cor é escolhida automaticamente, alternando entre 5 cores.
  - `DELETE /mapas-mentais/:id` — apaga o mapa inteiro.
  - `POST /mapas-mentais/:id/nos` — adiciona um nó filho a um nó existente.
  - `PATCH /mapas-mentais/:id/nos/:nodeId` — atualiza o texto e/ou a posição (x, y) de um nó —
    usada tanto quando o Dono edita o texto quanto quando solta um nó depois de arrastar.
  - `DELETE /mapas-mentais/:id/nos/:nodeId` — apaga um nó e toda a ramificação dele (os filhos, os
    filhos dos filhos etc.); não deixa apagar o nó raiz do mapa (pra isso existe o
    `DELETE /mapas-mentais/:id`, que apaga o mapa inteiro).
  Toda rota confirma que o mapa pertence ao Dono logado antes de deixar ver/editar/apagar.
- Nova aba "Mapas mentais" dentro do próprio painel do Dono (`frontend/src/pages/dono/index.js`),
  logo depois de "Visão geral" no menu — não é um login separado, é só mais uma aba de quem já loga
  como Dono. Tela com: lista de mapas na lateral (criar novo mapa, trocar entre eles, contador de
  nós), um canvas com fundo pontilhado onde os nós aparecem como caixinhas conectadas por linhas
  (a raiz com a cor do mapa, os filhos em branco com uma borda lateral colorida), e um painel
  embaixo pra editar o texto do nó selecionado, adicionar um nó filho ou excluir o nó.
- Arrastar um nó: o movimento do mouse só atualiza a posição na tela (prá ficar fluido); a posição
  só é salva no banco quando solta o mouse — assim não manda uma requisição por pixel arrastado.
  Editar o texto de um nó salva automaticamente meio segundo depois de parar de digitar (não a
  cada letra), pelo mesmo motivo.
- Por enquanto, feita dentro do visual atual (as mesmas cores/fontes que o resto do painel do Dono
  já usa), pra não misturar dois estilos diferentes na mesma tela — o visual novo (navy/dourado,
  igual ao canvas) entra junto com o redesign geral da Fase 33+, quando essa aba também vai ganhar
  a cara nova de uma vez com o resto do painel do Dono.

## Arquivos alterados/criados

- `backend/prisma/schema.prisma` — modelo novo `MapaMental` (aditivo) + relação `mapasMentais` no
  modelo `Dono`.
- `backend/src/routes/mapasMentais.js` (novo) — todas as rotas de mapas mentais.
- `backend/src/server.js` — registra a rota nova em `/api/mapas-mentais`.
- `frontend/src/pages/dono/index.js` — aba nova "Mapas mentais" no menu do Dono + componente
  `MapasMentais` (lista de mapas, canvas arrastável, painel de edição do nó).

## O que foi testado nesta sessão

- `node --check` nos arquivos de backend alterados/criados — sem erro de sintaxe.
- Contagem de chaves/parênteses/colchetes no `schema.prisma` e no `dono/index.js` — todos
  equilibrados.
- Revisão manual da lógica de arrastar nó, adicionar nó filho e excluir nó (com exclusão em
  cascata dos filhos), comparando com o comportamento do mockup original
  (`Mapas-Mentais-Dono.dc.html`).
- Como nas fases anteriores, não foi possível rodar `npx prisma validate` nem `npx next build`
  neste ambiente (mesmas limitações de rede/sandbox já registradas nas Fases 22, 28, 30 e 31) — o
  teste real de ponta a ponta (criar mapa, arrastar nó, editar texto, excluir) só vai acontecer
  depois do deploy.

## Pendência / aguardando teste do usuário

- Depois do deploy: o Railway já cria a tabela `mapas_mentais` sozinho (é mudança aditiva no
  schema, sem precisar de nenhum comando manual).
- Abrir a aba "Mapas mentais" dentro do login de Dono e testar: criar um mapa, adicionar um nó
  filho, arrastar um nó pra outra posição, editar o texto de um nó, excluir um nó e excluir um
  mapa inteiro.
- Próximas partes do pedido maior: Secretaria/Supervisão da Atendente (Dono) e o redesign visual
  lote a lote das telas que já existem.

# Fase 33 — Secretaria: Supervisão de setor (Dono acompanhando a Atendente) (entregue em 21/10/2026)

## Contexto do pedido

Do canvas de 26 telas ("Novo Layout — Espaço do Renascer"), a tela `Secretaria-Supervisao.dc.html`
mostra o Dono acompanhando um login da recepção (ex.: Maria): se está online agora e há quanto
tempo, quanto tempo ficou ativa no dia, quantos clientes cadastrou, quantas reativações fez,
quantos chamados de suporte respondeu, um gráfico de cadastros dos últimos 7 dias e um feed de
"Atividade de hoje".

## O que foi construído

- **Presença e tempo online** — reaproveitado o mesmo carimbo `User.ultimoAcessoEm` que já existia
  (atualizado, no máximo 1x por minuto, em praticamente toda request autenticada — ver
  `middleware/auth.js`). Nesse mesmo bloco, sem nenhuma chamada nova no frontend, passaram a ser
  calculados também:
  - `sessaoAtivaDesde`: quando a sessão contínua atual começou (reseta quando a pessoa fica mais
    de ~6 minutos sem usar o sistema e depois volta — aí conta como uma sessão nova).
  - `tempoOnlineHojeSegundos` + `tempoOnlineHojeData`: quanto tempo, somado, essa pessoa ficou
    "ativa" hoje (zera sozinho quando o dia muda).
  - "Online agora" na tela de supervisão = o último acesso foi há até 3 minutos.
  - Isso é uma aproximação (baseada em uso do app, não numa conexão permanente de verdade) — mesmo
    princípio que já valia pro indicador de presença que já existia noutras telas.
- **Atribuição de ações a um login específico** — o modelo `HistoricoCliente` (linha do tempo do
  cliente: entrou/renovou/saiu/reativado/trocou de profissional) ganhou um campo novo e opcional
  `realizadoPorId`, preenchido em toda rota que já criava esses registros (em `dono.js`,
  `atendente.js`, `profissional.js` e `financeiro.js`) com o id de quem fez a ação. Sem isso não
  dava pra saber, por exemplo, quantas reativações a Maria especificamente fez hoje (só dava pra
  saber que alguém reativou). Registros antigos (de antes dessa fase) ficam com esse campo vazio e
  simplesmente não entram em nenhuma conta de "hoje" — não é um problema, porque essas contas são
  sempre do dia atual.
- **Indicadores do dia da Atendente**: clientes cadastrados hoje (`Cliente.cadastradoPorId` +
  `criadoEm`), reativações hoje (`HistoricoCliente` tipo REATIVADO + `realizadoPorId`) e suportes
  atendidos hoje (tickets distintos em que essa pessoa mandou mensagem hoje, via `Mensagem`).
- **Gráfico "Cadastros por dia — últimos 7 dias"** e **feed "Atividade de hoje"** (junta cadastros,
  reativações e suportes respondidos num único feed, do mais recente pro mais antigo).
- **Onde abrir**: não é uma aba nova no menu — fica dentro da aba "Usuários" já existente. Toda
  linha de um login com papel Atendente ganhou um botão "Supervisão" que abre o painel ali mesmo,
  embaixo da linha (mesmo padrão já usado pelo botão "Editar"). Só funciona pra logins da
  Secretaria (Atendente) por enquanto — Profissional e Setor Financeiro podem ganhar o próprio
  painel depois, se fizer sentido.
- Feita dentro do visual atual (mesmas cores/fontes do resto do painel do Dono hoje), pelo mesmo
  motivo da Fase 32 (Mapas mentais): evitar misturar dois estilos na mesma tela antes do redesign
  geral.

## Arquivos alterados/criados

- `backend/prisma/schema.prisma` (aditivo) — 3 campos novos em `User` (`sessaoAtivaDesde`,
  `tempoOnlineHojeSegundos`, `tempoOnlineHojeData`) e 1 campo novo em `HistoricoCliente`
  (`realizadoPorId`).
- `backend/src/middleware/auth.js` — a mesma atualização de presença (`autenticar()`) passou a
  também calcular o acumulado de tempo online de hoje e o início da sessão contínua.
- `backend/src/routes/dono.js` — rota nova `GET /dono/usuarios/:id/supervisao`, que devolve tudo
  que a tela precisa (presença, indicadores, gráfico, feed de atividade) pra um login Atendente.
- `backend/src/routes/dono.js`, `atendente.js`, `profissional.js`, `financeiro.js` — todo lugar que
  já criava um registro em `HistoricoCliente` passou a gravar também `realizadoPorId: req.user.id`.
- `frontend/src/pages/dono/index.js` — botão "Supervisão" na linha de cada Atendente (dentro da aba
  Usuários) + componente novo `SupervisaoSecretaria` (badge de presença, 4 cartões de indicador,
  gráfico de barras e feed de atividade).

## O que foi testado nesta sessão

- `node --check` em todos os arquivos de backend alterados — sem erro de sintaxe.
- Contagem de chaves/parênteses/colchetes no `schema.prisma` e no `dono/index.js` — todos
  equilibrados.
- Revisão manual de cada ponto onde `HistoricoCliente` é criado, confirmando que `realizadoPorId`
  foi adicionado em todos (dono, atendente, profissional, financeiro) sem alterar o resto do
  comportamento de cada rota.
- Como nas fases anteriores, não foi possível rodar `npx prisma validate` nem `npx next build`
  neste ambiente (mesma limitação de rede/sandbox já registrada nas Fases 22, 28, 30, 31 e 32).

## Pendência / aguardando teste do usuário

- Depois do deploy: mudança aditiva no schema — o Railway cria os campos novos sozinho, sem
  comando manual.
- Entrar como Dono, abrir "Usuários", achar um login da Secretaria e clicar em "Supervisão": 1)
  conferir se aparece "Online agora" quando a atendente estiver de fato usando o sistema; 2)
  cadastrar um cliente ou reativar um cliente usando o login da atendente, e checar se o indicador
  do dia correspondente sobe; 3) responder um chamado de suporte com o login dela e checar
  "Suportes atendidos".
- Importante: o "tempo online hoje" e o "online agora" só começam a acumular depois do deploy
  dessa fase — não existe isso retroativo pra hoje antes do deploy.
- Próxima parte do pedido maior: redesign visual lote a lote das telas que já existem (Fase 34+).

---

# Fase 34 — Redesign visual (lote 1): a casca nova (navy + azul + dourado, Sora/Public Sans) chega pro Dono, Atendente, Profissional e Cliente (entregue em 21/10/2026)

Primeira parte do "redesign visual completo das telas que já existem", combinado desde a Fase 31
(quando o Setor Financeiro nasceu direto no visual novo do canvas "Novo Layout — Espaço do
Renascer"). Em vez de redesenhar cada aba de cada papel de uma vez (entrega gigante e arriscada),
esta fase troca só a CASCA compartilhada — menu lateral no computador, cabeçalho no celular, menu
em gaveta — que every tela de Dono/Atendente/Profissional/Cliente usa. É a mesma estratégia já
usada com sucesso na Fase 23 (quando o visual mudou de cara inteiro só editando o `Layout.js`
antigo): trocar a peça compartilhada muda a aparência de todo o sistema de uma vez, sem precisar
editar aba por aba.

## O que mudou

- As 4 áreas de login que ainda usavam a casca antiga (`Layout.js` — menu claro, azul-destaque,
  fonte Manrope) passam a usar a casca nova (`LayoutNovo.js` — menu lateral navy escuro, detalhe
  azul `#0B5FA8`/dourado `#9C6B2E` na borda de cima, fonte Sora nos títulos e Public Sans no corpo)
  que já estava rodando desde a Fase 31 só no Setor Financeiro.
- Visualmente, todo o sistema passa a abrir com o mesmo menu lateral escuro do canvas: Dono,
  Atendente, Profissional e Cliente (inclusive as telas de videochamada de Profissional e Cliente).
- O CONTEÚDO de cada aba (tabelas, formulários, cards, gráficos) continua exatamente igual — essa
  troca foi só da casca em volta. O acabamento visual 1:1 de cada aba específica (cores dos cards,
  layout interno) é o próximo lote, tela por tela.

## Cuidado tomado: não perder nenhuma função ao trocar a casca

A casca nova (`LayoutNovo.js`), construída na Fase 31 só pra servir ao Setor Financeiro (um papel
novo, sem casca antiga pra comparar), não tinha ainda duas funções que a casca antiga já oferecia
pra Dono/Atendente/Profissional/Cliente há várias fases: a foto de perfil clicável no cabeçalho
(pra trocar a própria foto a qualquer momento) e o sininho de notificações (avisos salvos + botão
de ativar notificação push no aparelho). Antes de trocar qualquer página pra essa casca, as duas
funções foram adicionadas na `LayoutNovo.js` (mesma lógica de sempre, só com as cores adaptadas pro
fundo escuro) — pra ninguém perder nada ao ganhar o visual novo.

## Arquivos alterados

- `frontend/src/components/LayoutNovo.js`: ganhou a foto de perfil clicável e o sininho de
  notificações (antes só existiam na casca antiga `Layout.js`).
- `frontend/src/pages/dono/index.js`, `atendente/index.js`, `cliente/index.js`,
  `profissional/index.js`, `profissional/videochamada/[agendamentoId].js`,
  `cliente/videochamada/[agendamentoId].js`: trocada a casca (`Layout` → `LayoutNovo`) — nenhuma
  outra linha de lógica ou conteúdo foi alterada nesses 6 arquivos.
- A casca antiga (`Layout.js`) não foi apagada — fica sem uso por enquanto, sem risco nenhum de
  deixar no repositório.

## Teste feito antes de entregar

Checagem de sintaxe com o parser do Babel (JSX) em todos os 7 arquivos alterados — todos OK.
Revisão visual do código: como cada uma dessas 4 telas só mostra UM bloco de conteúdo por vez
(a aba ativa), a troca de casca não arrisca nenhuma mudança de espaçamento/organização do conteúdo
em si. Mesma limitação de sempre nesse ambiente pra `next build` de verdade.

## Pendência / aguardando teste do usuário

- Nenhuma mudança de banco de dados nem de backend nesta fase — é só visual, só frontend (Vercel).
- Depois do deploy: abrir o sistema como Dono, Atendente, Profissional e Cliente (computador e
  celular) e confirmar: 1) o menu lateral/cabeçalho aparece no visual novo (navy, azul, dourado);
  2) a foto de perfil ainda pode ser trocada clicando no avatar; 3) o sininho de notificações ainda
  mostra os avisos e ainda oferece ativar notificação push; 4) nenhuma aba perdeu conteúdo ou
  função.
- Próxima parte: redesign do CONTEÚDO de cada aba, lote por papel de login, pra chegar no
  acabamento 1:1 de cada artboard do canvas.

# Fase 35 — Redesign visual (lote 2, parte 1): conteúdo da Visão geral do Dono (entregue em 21/10/2026)

Primeira tela de CONTEÚDO redesenhada no padrão novo (navy + azul + dourado, Sora/Public Sans),
depois da casca (Fase 34). Começou pelo Dono porque é quem mais abre essa tela no dia a dia.

## O que mudou

- **Visão geral (aba "Visão geral" do Dono)** foi reconstruída do zero visualmente, seguindo o
  artboard "Visão geral" do canvas novo:
  - Cabeçalho com "Painel do Dono" + título "Visão geral" + selo "Atualizado agora".
  - 4 cartões de número: Profissionais ativos, Clientes cadastrados, Sessões essa semana (NOVO
    indicador) e Taxa de renovação (NOVO indicador).
  - Cartão "Resultado da semana": gráfico de barras clicável (segunda a sábado) — cada dia mostra,
    ao clicar, faturamento, agendamentos, investido em anúncio, conversões (clientes novos) e CAC
    do dia (custo por cliente novo = investimento ÷ conversões).
  - Cartão "Pacotes por status": rosquinha (donut) com Ativos / A renovar / Encerrados, mais a
    legenda com contagem e percentual de cada um.
  - Cartão "Clientes para renovar": lista os clientes com data de renovação cadastrada mais
    próxima primeiro, com uma bolinha de status (verde/amarelo/vermelho, o mesmo semáforo usado no
    resto do sistema) e um selo "renova em X dia(s)".
  - Os cartões operacionais que já existiam — "A receber hoje", "Repasses pendentes das
    profissionais" e "Clientes por profissional" — foram MANTIDOS, só com a roupagem visual nova,
    porque são conferência financeira do dia a dia que você já usa e nada disso pode sumir.

## Ajustes importantes de conteúdo (pra você entender os números novos)

- **"Sessões essa semana"** conta os agendamentos de segunda a sábado da semana atual que não
  foram cancelados (conta mesmo se ainda não aconteceu).
- **"Taxa de renovação"** é o percentual de pacotes que estão ativos ou aguardando renovação,
  sobre o total de pacotes que não foram cancelados (ou seja: de tudo que não foi cancelado, quanto
  está em andamento/continuando vs. quanto já encerrou). Fica "—" se ainda não existe nenhum pacote
  no sistema.
- **"Investido em anúncio" e "CAC do dia"** usam os mesmos lançamentos de "Anúncio" que você já
  registra no Financeiro pessoal/caixa (Fase 30) — não é um indicador novo de marketing que
  precisa de cadastro extra, só está sendo mostrado por dia da semana agora.
- O mockup original (canvas) tinha também um indicador de "Leads no WhatsApp" (conversas que
  chegam mas não necessariamente viram cliente). O sistema hoje **não tem** essa captura — só sabe
  contar quando um lead vira cliente de fato (isso é o "Conversões"). Por isso esse indicador foi
  deixado de fora, pra não inventar número. Se no futuro você quiser rastrear lead que não virou
  cliente, dá pra criar isso depois como uma feature nova.
- A legenda do donut "Pacotes por status" no mockup original abria uma listinha com o nome de cada
  cliente ao clicar. Isso foi simplificado pra só mostrar a contagem/percentual — o nome de cada
  cliente por status já dá pra ver nas abas "Clientes" e "Histórico".

## Backend

- `GET /dono/dashboard` agora também devolve: `sessoesSemana`, `taxaRenovacao`, `resultadoSemana`
  (array com os 6 dias, seg-sáb), `pacotesPorStatus` (contagem ativos/a renovar/encerrados) e
  `clientesParaRenovar` (até 8 clientes, os mais próximos da data de renovação primeiro). Tudo
  calculado a partir de dados que já existiam (Agendamento, TransacaoFinanceira, MovimentoCaixa,
  Pacote, Cliente.renovarEm) — nenhum campo novo no banco, mudança 100% aditiva.

## Frontend

- Nova classe utilitária `nv-*` em `globals.css`: `.nv-card`, `.nv-eyebrow`, `.nv-num`, `.nv-dot` (com
  as 3 variantes pulsantes ok/atenção/urgente). Essas classes vão ser reaproveitadas em todas as
  próximas telas de conteúdo redesenhadas — não é só pra Visão geral.

## O que testar

1. Entrar como Dono e abrir a aba "Visão geral" — conferir se os 4 cartões, o gráfico da semana,
   a rosquinha de pacotes e a lista de clientes pra renovar aparecem certinho.
2. Clicar em dias diferentes da barra "Resultado da semana" e ver se o detalhe embaixo muda.
3. Conferir se "A receber hoje", "Repasses pendentes" (se houver) e "Clientes por profissional"
   continuam aparecendo com os mesmos números de antes — só a cor/visual mudou.
4. Se não tiver nenhum cliente com data de renovação cadastrada, a lista "Clientes para renovar"
   deve mostrar a mensagem de vazio, sem quebrar a tela.

## Próxima parte

Seguindo direto para o resto das abas do Dono (Clientes, Histórico, Usuários, Agenda geral,
Profissionais, Repasses, Formulários, Suporte, Reativar, Meu dia, Mapas mentais, Secretaria), sem
parar, depois Atendente, Profissional e Cliente — conforme combinado.

# Fase 36 — Redesign visual (lote 2, parte 2): Clientes e Reativar clientes (entregue em 21/10/2026)

Continuação direta da Fase 35, sem pausa.

## O que mudou

- **Clientes (Dono)**: lista redesenhada no visual novo — nome + bolinha de status (o mesmo
  semáforo verde/amarelo/vermelho de sempre) + "com {profissional} · contratado em {data} · encerra
  em {data}" e um selo "aguardando renovação" quando for o caso. Ganhou também o alternador
  "Todos" / "Por profissional" do mockup (agrupa os clientes por profissional, em ordem alfabética
  dentro de cada grupo). Clicar em "Ver ficha" continua abrindo, na hora, a ficha completa do
  cliente embaixo do nome dele — métricas, contrato, contato de notificação/data de renovação,
  histórico de pagamentos e trocar de profissional — exatamente as mesmas informações de antes, só
  que agora dentro do card no visual novo.
- **Reativar clientes (Dono e Atendente)**: mesma lista redesenhada nos dois logins — nome do
  cliente, resumo do pacote e data de saída, botão "Chamar no WhatsApp" (quando ele tiver WhatsApp
  salvo), seletor de profissional e botão "Reativar". A lista agora vem sempre em ordem alfabética.

## Observação sobre o mockup "Clientes"

O artboard original tinha um botão "Excluir" direto na linha da lista. Como excluir um cliente é
uma ação que apaga sessões, mensagens e pacotes dele (sem volta), esse botão continua só dentro da
ficha expandida ("Ver ficha" → "Excluir login deste cliente"), do jeito que já era — pra evitar
clique sem querer direto na lista. Se quiser que fique mais rápido de acessar, é só avisar.

## Arquivos alterados

- `frontend/src/pages/dono/index.js`: `Clientes()` e `ClientesParaReativar()` redesenhadas.
- `frontend/src/pages/atendente/index.js`: `ClientesParaReativar()` redesenhada (mesma lógica da
  versão do Dono).
- `frontend/src/styles/globals.css`: classes novas `.nv-seg`/`.nv-seg-ativo` (alternador tipo
  "Todos" / "Por profissional"), reaproveitáveis nas próximas telas.

## O que testar

1. Como Dono, abrir "Clientes": alternar entre "Todos" e "Por profissional", clicar em "Ver ficha"
   de um cliente e conferir que tudo (métricas, contrato, pagamentos, trocar profissional) continua
   aparecendo certinho.
2. Como Dono e como Atendente, abrir "Reativar clientes" e testar o botão de WhatsApp e reativar
   um cliente de teste.

## Próxima parte

Seguindo com Histórico, Agenda geral, Profissionais, Repasses, Usuários, Suporte escalado — sem
parar.

# Fase 37 — Redesign visual (lote 2, parte 3): Histórico e Profissionais (entregue em 21/10/2026)

Continuação direta da Fase 36, sem pausa.

## O que mudou

- **Histórico (Dono)**: virou uma linha do tempo — cada evento (entrada, renovação, saída,
  reativação) com uma bolinha colorida por tipo, o nome do cliente e o que aconteceu, a data por
  extenso e os detalhes (profissional, pacote, WhatsApp). Ganhou um filtro "Todos / Entradas /
  Renovações / Saídas / Reativações" (o mockup original só tinha 3 filtros — acrescentei
  "Reativações" porque esse tipo de evento já existe no sistema e não fazia sentido ficar de fora).
- **Profissionais (Dono)**: virou a tela de "ficha" do mockup — grade de cartões (foto com
  iniciais, bolinha de presença, título, especialidades, quantos clientes ativos e há quanto tempo
  foi visto) com um campo de busca por nome ou especialidade, e um painel de detalhe à direita da
  profissional selecionada: biografia, especialidades completas, status "Ativa agora"/"Offline",
  número de clientes ativos e a taxa de renovação dela. A lista de clientes dela (que já existia na
  versão antiga) continua aparecendo embaixo do painel.

## De onde veio o conteúdo da ficha (nada foi inventado)

Biografia, especialidades e abordagem já existiam no cadastro de cada profissional desde a Fase 1
(campos `bio`, `especialidades`, `abordagens` no perfil completo) — só não apareciam nessa tela
ainda. A "taxa de renovação" por profissional é nova: mesmo cálculo já usado na Visão geral (Fase
35), mas agora separado por profissional (% de pacotes dela que estão ativos/aguardando renovação
sobre o total de pacotes não cancelados dela).

## Backend

- `GET /dono/profissionais` agora também devolve `taxaRenovacao` em cada profissional — cálculo
  aditivo, sem campo novo no banco.

## Arquivos alterados

- `backend/src/routes/dono.js`
- `frontend/src/pages/dono/index.js`

## O que testar

1. Como Dono, abrir "Histórico" e testar os 5 filtros.
2. Abrir "Profissionais": testar a busca por nome e por especialidade, clicar em cada cartão e
   conferir se o painel da direita atualiza (bio, especialidades, clientes, taxa de renovação).
3. Se alguma profissional não tiver bio ou especialidades cadastradas ainda, a tela não deve
   quebrar — só aparece sem essas seções.

## Próxima parte

Agenda geral, Repasses, Usuários e Suporte escalado — sem parar.

# Fase 38 — Redesign visual (lote 2, parte 4): Agenda geral (entregue em 21/10/2026)

## O que mudou (visual)

- **Agenda geral (Dono)**: a tela que antes mostrava só uma lista das próximas sessões virou um
  **calendário do mês completo**. No topo tem setas para trocar de mês e, ao lado, uma legenda com
  uma cor para cada profissional (a mesma profissional aparece sempre com a mesma cor, em qualquer
  mês). O calendário mostra os dias da semana em colunas e, dentro de cada dia, "pilulas" coloridas
  com horário e nome do cliente, uma por sessão agendada, na cor da profissional responsável.
- Ao clicar num dia do calendário, abre um painel à direita com a lista completa das sessões
  daquele dia (horário, cliente, profissional) e, para cada uma, o selo de status da sessão que já
  existia (confirmada, realizada, cancelada, etc. — mesma lógica de sempre, sem mudança).
- O dia de hoje aparece destacado no calendário.

## De onde veio o conteúdo (nada foi inventado)

Os agendamentos mostrados são os mesmos que já existiam no sistema (tabela `Agendamento`); a única
mudança é que agora dá para navegar entre meses, e não só ver "os próximos 100 agendamentos". A cor
de cada profissional é calculada a partir do nome dela (mesma técnica já usada na tela de
Profissionais, Fase 37) — não é um campo novo no banco, é só visual.

## Backend

- `GET /dono/agenda-geral` agora aceita, opcionalmente, `?mes=` e `?ano=` na URL. Quando esses
  parâmetros vêm preenchidos (é o que o calendário novo usa), a rota devolve todos os agendamentos
  daquele mês. Quando não vêm (comportamento antigo, para não quebrar nada que já use essa rota),
  continua devolvendo os próximos 100 agendamentos a partir de agora, como sempre foi. Mudança
  aditiva — nenhum comportamento antigo foi removido.

## Arquivos alterados

- `backend/src/routes/dono.js`
- `frontend/src/pages/dono/index.js`

## O que testar

1. Como Dono, abrir "Agenda geral" e confirmar que aparece o calendário do mês atual, com o dia de
   hoje destacado.
2. Clicar nas setas de navegação e confirmar que troca de mês (inclusive virando o ano, de dezembro
   para janeiro e vice-versa).
3. Clicar em um dia que tenha sessões marcadas e confirmar que abre o painel com a lista daquele
   dia, mostrando horário, cliente, profissional e o selo de status da sessão.
4. Confirmar que a legenda de cores das profissionais no topo corresponde às cores das pílulas
   dentro do calendário.
5. Clicar em um dia sem nenhuma sessão e confirmar que o painel mostra que não há sessões, sem
   quebrar a tela.

## Próxima parte

Repasses, Usuários, Suporte escalado, Formulários, Meu dia, Mapas mentais e Secretaria do Dono —
sem parar.

# Fase 39 — Redesign visual (lote 2, parte 5): Repasses, Usuários e Suporte escalado (entregue em 21/10/2026)

## O que mudou (visual)

- **Repasses (Dono)**: ganhou o filtro "Todos / Pendentes / Confirmados" no topo. "Pendentes"
  continua mostrando exatamente o que já existia (lista por profissional, com o valor total que
  ela deve, campo pra lançar quanto você recebeu dela, botão pra marcar pagamento específico como
  recebido, aviso de comprovante enviado aguardando confirmação). "Confirmados" é novo: mostra um
  ledger dos repasses já conferidos recentemente (profissional, tipo, data, valor). "Todos" mostra
  as duas coisas juntas.
- **Usuários (Dono)**: o formulário de criar login agora fica escondido até clicar em "+ Novo
  usuário" (antes ficava sempre aberto no topo da tela). A lista virou cartões com um círculo de
  iniciais colorido por papel (Dono azul, Atendente roxo, Profissional verde, Setor financeiro
  dourado, Cliente cinza) em vez de tabela. Todas as ações continuam: editar, excluir, ativar
  atendimento (pra outro Dono), abrir supervisão (pra Atendente).
- **Suporte escalado (Dono)**: ganhou o filtro "Todos / Em aberto / Resolvidos". Os chamados
  viraram cartões com a mensagem do cliente em um bloco destacado e o selo de status (laranja =
  em aberto, verde = resolvido). Quando resolvido, a caixa de resposta fica escondida — mas tem um
  link "Responder de novo" pra abrir ela de volta se precisar (nada foi removido, só escondido até
  pedir).

## De onde veio o conteúdo (nada foi inventado)

A lista de "Confirmados" em Repasses usa transações que já existiam no banco (mesma tabela de
sempre, filtrando as que já foram marcadas como repassadas) — é um dado novo mostrado, não um dado
inventado. Nada mudou na lógica de quem deve o quê pra quem.

## Backend

- `GET /dono/repasses-pendentes` agora também devolve `confirmados` (últimos 40 repasses já
  conferidos) — campo novo na resposta, aditivo, sem mudar o que já existia.

## Arquivos alterados

- `backend/src/routes/dono.js`
- `frontend/src/pages/dono/index.js`

## O que testar

1. Como Dono, abrir "Repasses" e testar os 3 filtros (Todos/Pendentes/Confirmados). Testar lançar
   um recebimento e marcar um pagamento específico como recebido, como já era possível antes.
2. Abrir "Usuários": clicar em "+ Novo usuário", criar um login de teste, depois editar e excluir
   um usuário. Testar "Ativar atendimento" num Dono e "Supervisão" numa Atendente.
3. Abrir "Suporte escalado": testar os 3 filtros, responder um chamado em aberto e confirmar que
   ele marca como resolvido e esconde a caixa de resposta (com a opção de abrir de novo).

## Próxima parte

Formulários, Meu dia, Mapas mentais e Secretaria do Dono — sem parar.

  // Fase 75 — Rotatividade e filtro de gênero: antes, os dois rodavam em IIFEs separadas logo no
  // carregamento do script, porque os cards (.pro-card) já existiam prontos no HTML estático. Com
  // a lista agora vindo da API (ver IIFE principal mais abaixo, objeto PROFISSIONAIS), os cards só
  // existem DEPOIS que a resposta chega — rodar isso aqui, como antes, resultaria numa grade vazia
  // na primeira checagem (0 cards) e nunca mais rodaria de novo, e os botões de filtro ficariam
  // "mudos" porque teriam capturado uma lista vazia de cards. Por isso virou uma função nomeada,
  // pendurada em window (mesmo padrão já usado por window.__RENASCER_API_URL__ — ver
  // frontend/src/pages/site/index.js) pra poder ser chamada de dentro da outra IIFE, DEPOIS que os
  // cards de verdade forem montados.
  window.__RENASCER_SITE_APLICAR_ROTATIVIDADE__ = function(){
    // Rotatividade: a cada 10 minutos, o ponto de partida da lista muda,
    // então um profissional diferente aparece primeiro — ao longo do dia,
    // todos passam pelo topo da lista com a mesma frequência (antes era
    // por dia, mas ficava só um profissional recebendo a maioria dos
    // agendamentos porque via poucas janelas de rotação por dia).
    var grid = document.getElementById('proGrid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.pro-card'));
    if (cards.length > 1) {
      var JANELA_MS = 10 * 60 * 1000; // 10 minutos
      var janelasDesdeEpoca = Math.floor(Date.now() / JANELA_MS);
      var deslocamento = janelasDesdeEpoca % cards.length;
      cards.slice(deslocamento).concat(cards.slice(0, deslocamento)).forEach(function(card){
        grid.appendChild(card);
      });
    }
  };

  (function(){
    var buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(function(btn){
      btn.addEventListener('click', function(){
        buttons.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var f = btn.getAttribute('data-filter');
        // Fase 75 — busca os cards NA HORA do clique (em vez de uma lista capturada só uma vez no
        // carregamento do script), porque agora eles são criados depois, de forma assíncrona.
        document.querySelectorAll('.pro-card').forEach(function(card){
          var match = (f === 'all' || card.getAttribute('data-gender') === f);
          card.style.display = match ? '' : 'none';
        });
      });
    });
  })();

  /* ======================================================================
     Home redesign — header ao rolar, revelação suave, números animados,
     acordeão do FAQ (apenas efeitos visuais; nenhuma rota/formulário/
     integração existente é alterada por este bloco)
     ====================================================================== */
  (function(){
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- header: sólido ao rolar ---------- */
    var SCROLL_THRESHOLD = 30;
    function onScroll(){
      document.body.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------- números animados (contam uma única vez, ao entrar na tela) ---------- */
    var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count-to]'));
    function animateCounter(counterEl){
      var target = parseInt(counterEl.getAttribute('data-count-to'), 10) || 0;
      var suffix = counterEl.getAttribute('data-suffix') || '';
      if (reduceMotion) { counterEl.textContent = target + suffix; return; }
      var duration = 1700;
      var start = null;
      function step(ts){
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        counterEl.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    /* ---------- revelação suave (fade-in ao rolar) ---------- */
    var revealTargets = Array.prototype.slice.call(document.querySelectorAll('.reveal, .reveal-stagger'));
    if ('IntersectionObserver' in window) {
      var revealObserver = new IntersectionObserver(function(entries, obs){
        entries.forEach(function(entry){
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.16 });
      revealTargets.forEach(function(t){ revealObserver.observe(t); });

      var statRow = document.getElementById('statRow');
      if (statRow && counters.length) {
        var statObserver = new IntersectionObserver(function(entries, obs){
          entries.forEach(function(entry){
            if (!entry.isIntersecting) return;
            counters.forEach(animateCounter);
            obs.disconnect();
          });
        }, { threshold: 0.4 });
        statObserver.observe(statRow);
      }
    } else {
      revealTargets.forEach(function(t){ t.classList.add('is-visible'); });
      counters.forEach(animateCounter);
    }

    /* ---------- FAQ: abertura suave, preservando <details>/<summary> ---------- */
    if (!reduceMotion) {
      document.querySelectorAll('#faq details').forEach(function(detailsEl){
        var summaryEl = detailsEl.querySelector('summary');
        var answerEl = detailsEl.querySelector('.faq-answer');
        if (!summaryEl || !answerEl) return;
        answerEl.style.overflow = 'hidden';
        answerEl.style.transition = 'max-height .28s ease';
        summaryEl.addEventListener('click', function(ev){
          ev.preventDefault();
          if (detailsEl.hasAttribute('open')) {
            answerEl.style.maxHeight = answerEl.scrollHeight + 'px';
            window.requestAnimationFrame(function(){ answerEl.style.maxHeight = '0px'; });
            window.setTimeout(function(){
              detailsEl.removeAttribute('open');
              answerEl.style.maxHeight = '';
            }, 260);
          } else {
            detailsEl.setAttribute('open', '');
            answerEl.style.maxHeight = '0px';
            window.requestAnimationFrame(function(){ answerEl.style.maxHeight = answerEl.scrollHeight + 'px'; });
            window.setTimeout(function(){ answerEl.style.maxHeight = ''; }, 280);
          }
        });
      });
    }
  })();

  /* ======================================================================
     Espaço do Renascer — páginas individuais + agendamento (SPA)
     ====================================================================== */
  (function(){
    'use strict';

    var WHATSAPP_NUMBER = '5575983203429';

    // Fase 62 — base da API (mesmo sistema de agenda/disponibilidade de verdade), injetada pela
    // página Next.js antes de carregar este arquivo (ver frontend/src/pages/site/index.js). Sem
    // isso definido (ex: alguém abrindo este arquivo solto), cai num endereço local de
    // desenvolvimento só pra não quebrar.
    var API_URL = window.__RENASCER_API_URL__ || 'http://localhost:4000/api';

    var DIAS_SEMANA_LABEL = {
      DOMINGO: 'Domingo', SEGUNDA: 'Segunda-feira', TERCA: 'Terça-feira', QUARTA: 'Quarta-feira',
      QUINTA: 'Quinta-feira', SEXTA: 'Sexta-feira', SABADO: 'Sábado'
    };

    var PRECOS = {
      '30min': { rotulo: '30 minutos', 1: 'R$ 60', 2: 'R$ 100', 4: 'R$ 170' },
      '50min': { rotulo: '50 minutos', 1: 'R$ 110', 2: 'R$ 180', 4: 'R$ 320' }
    };

    var TURNOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

    // Fase 75 — antes, isso era um objeto fixo com os 13 perfis escritos à mão (cada vez que o
    // Dono queria adicionar/editar/remover alguém do site, só dava editando este arquivo). Agora
    // fica vazio aqui e é preenchido pela API (ver backend/src/routes/publico.js, rota
    // GET /site/profissionais), que lê do cadastro editável em "Site" no painel do Dono.
    var PROFISSIONAIS = {};

    // Monta um card de profissional (mesma estrutura HTML que existia fixa no body.html antes da
    // Fase 75 — texto/foto agora vêm de "p" em vez de estarem escritos na própria tag).
    function montarCardProfissional(p){
      var article = el('article','pro-card');
      if (p.genero) article.setAttribute('data-gender', p.genero);

      var top = el('div','pro-top');
      var avatarWrap = el('div','avatar');
      if (p.foto) {
        var img = document.createElement('img');
        img.src = p.foto;
        img.alt = 'Foto de ' + p.nome;
        img.width = 58;
        img.height = 58;
        avatarWrap.appendChild(img);
      }
      top.appendChild(avatarWrap);
      var nomeWrap = el('div');
      nomeWrap.appendChild(el('div','pro-name',p.nome));
      nomeWrap.appendChild(el('div','pro-role',p.cargo));
      top.appendChild(nomeWrap);
      article.appendChild(top);

      // Teaser curto da bio na grade (o detalhe mostra todos os parágrafos completos) — corta no
      // fim de uma palavra pra não quebrar no meio, igual um resumo editorial normal.
      var primeiroParagrafo = (p.bio && p.bio[0]) || '';
      var resumo = primeiroParagrafo.length > 220 ? primeiroParagrafo.slice(0, 220).replace(/\s+\S*$/, '') + '…' : primeiroParagrafo;
      article.appendChild(el('p','pro-bio',resumo));

      var tagsWrap = el('div','pro-tags');
      (p.tags || []).forEach(function(t){ tagsWrap.appendChild(el('span','tag',t)); });
      article.appendChild(tagsWrap);

      var meta = el('div','pro-meta');
      meta.appendChild(el('span', null, 'Online'));
      meta.appendChild(el('span','pro-price','A partir de ' + PRECOS['30min'][1]));
      article.appendChild(meta);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary pro-card-btn';
      btn.setAttribute('data-slug', p.slug);
      btn.setAttribute('data-route', '#/profissional/' + p.slug);
      btn.textContent = 'Ver perfil e agendar';
      article.appendChild(btn);

      return article;
    }

    // Busca a lista de profissionais ativos no site (API), preenche PROFISSIONAIS (mesmo formato
    // que o objeto fixo de antes usava, pra não precisar mexer em renderDetail) e monta os cards
    // na grade. Só depois disso a primeira rota da página é de fato aplicada (ver chamada de
    // applyRoute mais abaixo) — assim um link direto pra "#/profissional/slug" (ex: vindo de
    // anúncio) espera os dados chegarem antes de tentar renderizar o perfil, em vez de cair no
    // "profissional não encontrada" só porque a lista ainda não tinha carregado.
    function carregarProfissionaisEIniciarRota(){
      var grid = document.getElementById('proGrid');
      fetch(API_URL + '/publico/site/profissionais')
        .then(function(r){ if (!r.ok) throw new Error('resposta ' + r.status); return r.json(); })
        .then(function(lista){
          lista.forEach(function(p){
            PROFISSIONAIS[p.slug] = {
              nome: p.nome, cargo: p.cargo, registro: p.registro, tags: p.tags || [],
              bio: p.bio || [], quote: p.quote, testemunhos: p.testemunhos || [],
              foto: p.foto, genero: p.genero, slug: p.slug
            };
          });
          if (grid) {
            grid.innerHTML = '';
            lista.forEach(function(p){ grid.appendChild(montarCardProfissional(PROFISSIONAIS[p.slug])); });
            if (window.__RENASCER_SITE_APLICAR_ROTATIVIDADE__) window.__RENASCER_SITE_APLICAR_ROTATIVIDADE__();
          }
        })
        .catch(function(erro){
          console.error('Não deu pra carregar a lista de profissionais:', erro);
          if (grid) grid.innerHTML = '<p class="step-hint">Não conseguimos carregar a lista de profissionais agora. Atualize a página em alguns instantes — se continuar assim, fale com a gente pelo WhatsApp.</p>';
        })
        .then(function(){ applyRoute(window.location.hash, true); }); // roda sempre, deu certo ou não
    }


    var VIEWS = {
      home: document.getElementById('homeView'),
      lista: document.getElementById('listView'),
      detail: document.getElementById('detailView')
    };
    var activeViewKey = 'home';
    var currentSlug = null;

    function el(tag, cls, text){
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      return e;
    }

    function switchView(hide, show, instant){
      if (hide === show) { show.hidden = false; return; }
      function reveal(){
        hide.hidden = true;
        hide.classList.remove('view-out');
        show.hidden = false;
        show.classList.remove('view');
        void show.offsetWidth;
        show.classList.add('view');
      }
      if (instant) { reveal(); return; }
      hide.classList.add('view-out');
      window.setTimeout(reveal, 240);
    }

    function renderDetail(slug){
      var p = PROFISSIONAIS[slug];
      if (!p) return false;
      currentSlug = slug;

      document.getElementById('detailName').textContent = p.nome;
      document.getElementById('detailRole').textContent = p.cargo;
      var detailRegEl = document.getElementById('detailReg');
      detailRegEl.textContent = p.registro || '';
      detailRegEl.hidden = !p.registro;
      document.getElementById('modalProName').textContent = 'Agendar com ' + p.nome;

      var tagsWrap = document.getElementById('detailTags');
      tagsWrap.innerHTML = '';
      p.tags.forEach(function(t){ tagsWrap.appendChild(el('span','tag',t)); });

      var avatarWrap = document.getElementById('detailAvatar');
      avatarWrap.innerHTML = '';
      // Fase 75: antes buscava a foto no DOM (card já renderizado). Agora os dados já vêm
      // prontos da API junto com o resto do perfil, então usa p.foto direto.
      if (p.foto) {
        var img = document.createElement('img');
        img.src = p.foto;
        img.alt = p.nome;
        avatarWrap.appendChild(img);
      }

      var bioWrap = document.getElementById('detailBioWrap');
      bioWrap.innerHTML = '';
      p.bio.forEach(function(paragraph){
        bioWrap.appendChild(el('p','detail-bio',paragraph));
      });

      var quoteSection = document.getElementById('detailQuoteSection');
      if (p.quote) {
        document.getElementById('detailQuote').textContent = '“' + p.quote + '”';
        quoteSection.hidden = false;
      } else {
        quoteSection.hidden = true;
      }

      var testiSection = document.getElementById('detailTestiSection');
      var testiGrid = document.getElementById('detailTestiGrid');
      testiGrid.innerHTML = '';
      if (p.testemunhos && p.testemunhos.length) {
        p.testemunhos.forEach(function(txt){
          var card2 = el('div','testi-card');
          card2.appendChild(el('p', null, txt));
          card2.appendChild(el('span','testi-tag','Paciente do Espaço do Renascer'));
          testiGrid.appendChild(card2);
        });
        testiSection.hidden = false;
      } else {
        testiSection.hidden = true;
      }

      return true;
    }

    var HOME_ANCHORS = ['sobre','missao','como-funciona','compromisso','faq'];

    // Fase 78: botões flutuantes (FAB) — mudam de cara dependendo da tela atual.
    function atualizarFabFlutuante(){
      var primaryBtn = document.getElementById('fabPrimaryBtn');
      var primaryLabel = document.getElementById('fabPrimaryLabel');
      var whatsappBtn = document.getElementById('fabWhatsappBtn');

      if (whatsappBtn) {
        whatsappBtn.hidden = (activeViewKey !== 'lista');
      }

      if (!primaryBtn || !primaryLabel) return;
      if (activeViewKey === 'lista') {
        primaryBtn.hidden = true;
        primaryBtn.classList.remove('fab-btn-pulse');
        return;
      }
      primaryBtn.hidden = false;
      if (activeViewKey === 'detail') {
        primaryLabel.textContent = 'Agendar sessão';
        primaryBtn.classList.add('fab-btn-pulse');
      } else {
        primaryLabel.textContent = 'Ver profissionais';
        primaryBtn.classList.remove('fab-btn-pulse');
      }
    }

    function activateView(key, instant, slug, anchorId){
      if (key === 'detail' && !renderDetail(slug)) { key = 'home'; anchorId = null; }
      var target = VIEWS[key];
      var current = VIEWS[activeViewKey];
      var changed = (current !== target);
      if (changed) {
        switchView(current, target, instant);
        activeViewKey = key;
      }
      document.body.classList.toggle('is-home', key === 'home');
      atualizarFabFlutuante();
      var delay = (changed && !instant) ? 260 : 0;
      window.setTimeout(function(){
        if (anchorId) {
          var elTarget = document.getElementById(anchorId);
          if (elTarget) elTarget.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' });
        }
      }, delay);
    }

    function applyRoute(hash, instant){
      hash = hash || '';
      var mProf = hash.match(/^#\/profissional\/([a-z0-9-]+)/);
      if (mProf && PROFISSIONAIS[mProf[1]]) {
        activateView('detail', instant, mProf[1]);
        return;
      }
      if (hash === '#/profissionais' || hash === '#lista') {
        activateView('lista', instant);
        return;
      }
      var plain = hash.replace(/^#/, '');
      var anchorId = (HOME_ANCHORS.indexOf(plain) !== -1) ? plain : null;
      activateView('home', instant, null, anchorId);
    }

    window.addEventListener('hashchange', function(){ applyRoute(window.location.hash, false); });
    // Fase 75: antes chamava applyRoute direto (cards já existiam no HTML, fixos). Agora os
    // cards vêm da API, então primeiro carrega os profissionais e só no final (dentro de
    // carregarProfissionaisEIniciarRota, dê certo ou não) é que a rota inicial é aplicada.
    carregarProfissionaisEIniciarRota();

    document.addEventListener('click', function(ev){
      var btn = ev.target.closest('[data-route]');
      if (!btn) return;
      var href = btn.getAttribute('data-route');
      if (!href) return;
      if (window.location.hash === href) { applyRoute(href, false); }
      else { window.location.hash = href; }
    });

    
/* ---------------- modal de agendamento ---------------- */
    var modal = document.getElementById('bookingModal');
    var steps = Array.prototype.slice.call(document.querySelectorAll('.modal-step'));
    var dotsWrap = document.getElementById('modalDots');
    var backBtn = document.getElementById('modalBackBtn');
    var nextBtn = document.getElementById('modalNextBtn');
    var stepIndex = 0;
    // Fase 62 — horário real escolhido no novo passo (substitui o antigo par "disponibilidade"
    // genérica + "quando quer começar"): { data: 'AAAA-MM-DD', diaSemana: 'SEGUNDA', horaInicio: '09:00' }
    var horarioEscolhido = null;
    // true quando a API não devolveu nenhum horário (agenda cheia ou API fora do ar) — nesse
    // caso a pessoa pode seguir mesmo sem escolher um horário exato, e combina direto no
    // WhatsApp, pra nunca travar o funil por causa disso.
    var horariosIndisponiveis = false;

    steps.forEach(function(_, i){
      var dot = el('span','modal-dot');
      dot.dataset.i = i;
      dotsWrap.appendChild(dot);
    });
    var dots = Array.prototype.slice.call(dotsWrap.children);

    // Fase 62 — horários realmente livres da profissional (lidos da agenda de verdade do
    // sistema, mesma lógica usada no painel interno), já descontando o que está ocupado. Refaz a
    // busca toda vez que esse passo é aberto (ex: se a pessoa voltar e trocar a duração, a lista
    // muda, já que sessão de 50min ocupa mais espaço que uma de 30min).
    function formatarDiaLabel(dataISO, diaSemana){
      var partes = dataISO.split('-');
      return (DIAS_SEMANA_LABEL[diaSemana] || diaSemana) + ' (' + partes[2] + '/' + partes[1] + ')';
    }

    function buildHorarios(){
      var duracao = getVal('fDuracao') || '50min';
      var duracaoApi = duracao === '30min' ? 'MIN30' : 'MIN50';
      var wrap = document.getElementById('horariosList');
      horarioEscolhido = null;
      horariosIndisponiveis = false;
      wrap.innerHTML = '<p class="step-hint">Carregando horários livres...</p>';

      fetch(API_URL + '/publico/site/horarios/' + encodeURIComponent(currentSlug) + '?duracao=' + duracaoApi)
        .then(function(r){ if (!r.ok) throw new Error('falhou'); return r.json(); })
        .then(function(data){
          wrap.innerHTML = '';
          if (!data.dias || data.dias.length === 0) {
            horariosIndisponiveis = true;
            wrap.innerHTML = '<p class="step-hint">Sem horários livres nos próximos dias. Pode continuar e combinamos um horário direto pelo WhatsApp.</p>';
            return;
          }
          data.dias.forEach(function(dia){
            var grupo = el('div','avail-day-group');
            grupo.appendChild(el('p','avail-day-label', formatarDiaLabel(dia.data, dia.diaSemana)));
            var chips = el('div','avail-day-chips');
            dia.horarios.forEach(function(hora){
              var chip = document.createElement('button');
              chip.type = 'button';
              chip.className = 'avail-chip';
              chip.textContent = hora;
              chip.addEventListener('click', function(){
                Array.prototype.slice.call(wrap.querySelectorAll('.avail-chip.checked')).forEach(function(c){ c.classList.remove('checked'); });
                chip.classList.add('checked');
                horarioEscolhido = { data: dia.data, diaSemana: dia.diaSemana, horaInicio: hora };
              });
              chips.appendChild(chip);
            });
            grupo.appendChild(chips);
            wrap.appendChild(grupo);
          });
        })
        .catch(function(){
          horariosIndisponiveis = true;
          wrap.innerHTML = '<p class="step-hint">Não conseguimos carregar os horários agora. Pode continuar e combinamos um horário direto pelo WhatsApp.</p>';
        });
    }

    function buildPacotes(){
      var duracao = getVal('fDuracao');
      var wrap = document.getElementById('pacoteList');
      if (!duracao) { wrap.innerHTML = ''; return; }
      if (wrap.dataset.builtFor === duracao) return;
      wrap.dataset.builtFor = duracao;
      wrap.innerHTML = '';
      var tabela = PRECOS[duracao];
      var opcoes = [
        { qtd: 1, label: 'Sessão única' },
        { qtd: 2, label: '2 sessões' },
        { qtd: 4, label: '4 sessões' }
      ];
      opcoes.forEach(function(o){
        var label = document.createElement('label');
        label.className = 'option-item';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'fPacote';
        input.value = o.label;
        input.dataset.preco = tabela[o.qtd];
        label.appendChild(input);
        label.appendChild(document.createTextNode(o.label));
        label.appendChild(el('span','opt-price',tabela[o.qtd]));
        wrap.appendChild(label);
      });
    }

    function getVal(name){
      var input = document.querySelector('input[name="' + name + '"]:checked');
      return input ? input.value : '';
    }
    function getValues(name){
      return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function(i){ return i.value; });
    }

    modal.addEventListener('change', function(ev){
      if (ev.target.type === 'radio' || ev.target.type === 'checkbox') {
        var item = ev.target.closest('.option-item');
        if (item) {
          var siblings = item.parentElement.querySelectorAll('.option-item');
          if (ev.target.type === 'radio') {
            siblings.forEach(function(s){ s.classList.remove('checked'); });
          }
          item.classList.toggle('checked', ev.target.checked);
        }
      }
    });

    function buildSummary(){
      var p = PROFISSIONAIS[currentSlug];
      var duracao = getVal('fDuracao');
      var box = document.getElementById('summaryBox');
      box.innerHTML = '';
      var horarioLabel = horarioEscolhido
        ? (formatarDiaLabel(horarioEscolhido.data, horarioEscolhido.diaSemana) + ' às ' + horarioEscolhido.horaInicio)
        : 'A combinar pelo WhatsApp';
      var linhas = [
        ['Profissional', p.nome],
        ['Tratar', getVal('fTema') || document.getElementById('fTema').value],
        ['Duração', duracao === '50min' ? '50 minutos' : '30 minutos'],
        ['Pacote', getVal('fPacote') || '—'],
        ['Dia e horário', horarioLabel]
      ];
      linhas.forEach(function(l){
        var line = document.createElement('div');
        var strong = document.createElement('strong');
        strong.textContent = l[0] + ': ';
        line.appendChild(strong);
        line.appendChild(document.createTextNode(l[1]));
        box.appendChild(line);
      });
    }

    function validateStep(i){
      if (i === 1) return !!getVal('fPrimeiraVez');
      if (i === 2) return !!getVal('fDuracao');
      if (i === 3) return !!horarioEscolhido || horariosIndisponiveis;
      if (i === 4) return !!getVal('fPacote');
      if (i === 5) {
        var nome = document.getElementById('fNome').value.trim();
        var tel = document.getElementById('fTelefone').value.trim();
        return nome.length > 1 && tel.length > 7;
      }
      return true;
    }

    function goToStep(i){
      stepIndex = i;
      steps.forEach(function(s){ s.classList.toggle('active', Number(s.dataset.step) === i); });
      dots.forEach(function(d,di){
        d.classList.toggle('active', di === i);
        d.classList.toggle('done', di < i);
      });
      backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
      nextBtn.textContent = (i === steps.length - 1) ? 'Garantir minha vaga agora' : 'Continuar';
      if (i === 3) buildHorarios();
      if (i === 4) buildPacotes();
      if (i === 5) buildSummary();
    }

    function openModal(slug){
      currentSlug = slug;
      document.getElementById('bookingForm').reset();
      document.querySelectorAll('.option-item.checked, .avail-chip.checked').forEach(function(o){ o.classList.remove('checked'); });
      document.getElementById('pacoteList').dataset.builtFor = '';
      horarioEscolhido = null;
      horariosIndisponiveis = false;
      renderDetail(slug);
      goToStep(0);
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
    }

    function closeModal(){
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', function(ev){ if (ev.target === modal) closeModal(); });
    document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && !modal.hidden) closeModal(); });

    backBtn.addEventListener('click', function(){ if (stepIndex > 0) goToStep(stepIndex - 1); });

    nextBtn.addEventListener('click', function(){
      if (!validateStep(stepIndex)) {
        nextBtn.style.animation = 'none';
        void nextBtn.offsetWidth;
        nextBtn.style.animation = null;
        return;
      }
      if (stepIndex === steps.length - 1) {
        finalizarAgendamento();
        return;
      }
      goToStep(stepIndex + 1);
    });

    function finalizarAgendamento(){
      var p = PROFISSIONAIS[currentSlug];
      var tema = document.getElementById('fTema').value;
      var temaDetalhe = document.getElementById('fTemaDetalhe').value.trim();
      var primeiraVez = getVal('fPrimeiraVez');
      var duracao = getVal('fDuracao');
      var duracaoLabel = duracao === '50min' ? '50 minutos' : '30 minutos';
      var pacote = getVal('fPacote');
      var pacoteInput = document.querySelector('input[name="fPacote"]:checked');
      var preco = pacoteInput ? pacoteInput.dataset.preco : '';
      var horarioLabel = horarioEscolhido
        ? (formatarDiaLabel(horarioEscolhido.data, horarioEscolhido.diaSemana) + ' às ' + horarioEscolhido.horaInicio)
        : 'a combinar com a equipe (sem horário fixo escolhido no site)';
      var nome = document.getElementById('fNome').value.trim();
      var telefone = document.getElementById('fTelefone').value.trim();

      var msg = 'Olá! Vim pelo site do Espaço do Renascer e quero garantir minha vaga agora, antes que as vagas da semana se esgotem. 🌱\n\n' +
        'Profissional escolhido(a): ' + p.nome + '\n' +
        'O que gostaria de tratar: ' + tema + (temaDetalhe ? ', ' + temaDetalhe : '') + '\n' +
        'Já fez terapia antes: ' + primeiraVez + '\n' +
        'Duração da sessão: ' + duracaoLabel + '\n' +
        'Pacote: ' + pacote + ' (' + preco + ')\n' +
        'Dia e horário escolhido: ' + horarioLabel + '\n\n' +
        'Meu nome: ' + nome + '\n' +
        'Meu WhatsApp: ' + telefone + '\n\n' +
        'Já estou sendo direcionado(a) para a equipe finalizar meu atendimento e receber o Pix ou o link de pagamento com cartão.';

      if (typeof fbq === 'function') {
        fbq('track', 'Lead', {
          content_name: p.nome,
          content_category: 'Agendamento de sessão'
        });
      }

      var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
      window.open(url, '_blank', 'noopener');
      closeModal();
    }

    document.addEventListener('click', function(ev){
      if (ev.target.id === 'detailAgendarBtn') {
        openModal(currentSlug);
      }
    });

    /* ---------------- Fase 78: FAB flutuante (sem o botão de WhatsApp genérico, que agora só
       existe dentro da lista de profissionais) ---------------- */
    var fabPrimaryBtn = document.getElementById('fabPrimaryBtn');

    if (fabPrimaryBtn) {
      fabPrimaryBtn.addEventListener('click', function(){
        if (activeViewKey === 'detail') {
          openModal(currentSlug);
          return;
        }
        var href = '#/profissionais';
        if (window.location.hash === href) { applyRoute(href, false); }
        else { window.location.hash = href; }
      });
    }

    /* ---------------- Fase 78: modal genérico de WhatsApp (sem profissional escolhida) ----------------
       Mesmo wizard de passos do #bookingModal (tema, já fez terapia, duração, pacote, dados
       finais), só troca a escolha de dia/horário real (passo que depende de uma profissional
       específica) por turno + prioridade. Implementação própria, independente da do
       #bookingModal, pra não disputar os mesmos ids/seletores globais (#modalDots,
       #modalBackBtn, #modalNextBtn, .modal-step) usados pelo agendamento normal. Só é aberto a
       partir do botão flutuante de WhatsApp (#fabWhatsappBtn), que só aparece na lista. */
    var genericoModal = document.getElementById('genericoModal');

    if (genericoModal) {
      var gSteps = Array.prototype.slice.call(genericoModal.querySelectorAll('.g-modal-step'));
      var gDotsWrap = document.getElementById('gModalDots');
      var gBackBtn = document.getElementById('gModalBackBtn');
      var gNextBtn = document.getElementById('gModalNextBtn');
      var gStepIndex = 0;

      gSteps.forEach(function(_, i){
        var dot = el('span','modal-dot');
        dot.dataset.i = i;
        gDotsWrap.appendChild(dot);
      });
      var gDots = Array.prototype.slice.call(gDotsWrap.children);

      function buildPacotesGenerico(){
        var duracao = getVal('gDuracao');
        var wrap = document.getElementById('gPacoteList');
        if (!duracao) { wrap.innerHTML = ''; return; }
        if (wrap.dataset.builtFor === duracao) return;
        wrap.dataset.builtFor = duracao;
        wrap.innerHTML = '';
        var tabela = PRECOS[duracao];
        var opcoes = [
          { qtd: 1, label: 'Sessão única' },
          { qtd: 2, label: '2 sessões' },
          { qtd: 4, label: '4 sessões' }
        ];
        opcoes.forEach(function(o){
          var label = document.createElement('label');
          label.className = 'option-item';
          var input = document.createElement('input');
          input.type = 'radio';
          input.name = 'gPacote';
          input.value = o.label;
          input.dataset.preco = tabela[o.qtd];
          label.appendChild(input);
          label.appendChild(document.createTextNode(o.label));
          label.appendChild(el('span','opt-price',tabela[o.qtd]));
          wrap.appendChild(label);
        });
      }

      function buildSummaryGenerico(){
        var duracao = getVal('gDuracao');
        var box = document.getElementById('gSummaryBox');
        box.innerHTML = '';
        var temaEl = document.getElementById('gTema');
        var linhas = [
          ['Tratar', getVal('gTema') || (temaEl ? temaEl.value : '')],
          ['Duração', duracao === '50min' ? '50 minutos' : '30 minutos'],
          ['Pacote', getVal('gPacote') || '—'],
          ['Turno', getVal('gTurno') || 'Sem preferência'],
          ['Prioridade', getVal('gPrioridade') || 'A combinar']
        ];
        linhas.forEach(function(l){
          var line = document.createElement('div');
          var strong = document.createElement('strong');
          strong.textContent = l[0] + ': ';
          line.appendChild(strong);
          line.appendChild(document.createTextNode(l[1]));
          box.appendChild(line);
        });
      }

      function validateStepGenerico(i){
        if (i === 1) return !!getVal('gPrimeiraVez');
        if (i === 2) return !!getVal('gDuracao');
        if (i === 3) return !!getVal('gTurno') && !!getVal('gPrioridade');
        if (i === 4) return !!getVal('gPacote');
        if (i === 5) {
          var nome = document.getElementById('gNome').value.trim();
          var tel = document.getElementById('gTelefone').value.trim();
          return nome.length > 1 && tel.length > 7;
        }
        return true;
      }

      function goToStepGenerico(i){
        gStepIndex = i;
        gSteps.forEach(function(s){ s.classList.toggle('active', Number(s.dataset.gStep) === i); });
        gDots.forEach(function(d,di){
          d.classList.toggle('active', di === i);
          d.classList.toggle('done', di < i);
        });
        gBackBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
        gNextBtn.textContent = (i === gSteps.length - 1) ? 'Falar no WhatsApp' : 'Continuar';
        if (i === 4) buildPacotesGenerico();
        if (i === 5) buildSummaryGenerico();
      }

      function abrirModalGenerico(){
        var form = document.getElementById('genericoForm');
        if (form) form.reset();
        genericoModal.querySelectorAll('.option-item.checked').forEach(function(o){ o.classList.remove('checked'); });
        genericoModal.querySelectorAll('.option-item').forEach(function(item){
          var input = item.querySelector('input');
          if (input && input.checked) item.classList.add('checked');
        });
        document.getElementById('gPacoteList').dataset.builtFor = '';
        goToStepGenerico(0);
        genericoModal.hidden = false;
        document.body.style.overflow = 'hidden';
      }

      function fecharModalGenerico(){
        genericoModal.hidden = true;
        document.body.style.overflow = '';
      }

      var fabWhatsappBtn = document.getElementById('fabWhatsappBtn');
      if (fabWhatsappBtn) {
        fabWhatsappBtn.addEventListener('click', abrirModalGenerico);
      }

      var genericoCloseBtn = document.getElementById('genericoCloseBtn');
      if (genericoCloseBtn) genericoCloseBtn.addEventListener('click', fecharModalGenerico);
      genericoModal.addEventListener('click', function(ev){ if (ev.target === genericoModal) fecharModalGenerico(); });
      document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && !genericoModal.hidden) fecharModalGenerico(); });

      genericoModal.addEventListener('change', function(ev){
        if (ev.target.type === 'radio' || ev.target.type === 'checkbox') {
          var item = ev.target.closest('.option-item');
          if (item) {
            var siblings = item.parentElement.querySelectorAll('.option-item');
            if (ev.target.type === 'radio') {
              siblings.forEach(function(s){ s.classList.remove('checked'); });
            }
            item.classList.toggle('checked', ev.target.checked);
          }
        }
      });

      gBackBtn.addEventListener('click', function(){ if (gStepIndex > 0) goToStepGenerico(gStepIndex - 1); });

      gNextBtn.addEventListener('click', function(){
        if (!validateStepGenerico(gStepIndex)) {
          gNextBtn.style.animation = 'none';
          void gNextBtn.offsetWidth;
          gNextBtn.style.animation = null;
          return;
        }
        if (gStepIndex === gSteps.length - 1) {
          finalizarContatoGenerico();
          return;
        }
        goToStepGenerico(gStepIndex + 1);
      });

      function finalizarContatoGenerico(){
        var tema = document.getElementById('gTema').value;
        var temaDetalhe = document.getElementById('gTemaDetalhe').value.trim();
        var primeiraVez = getVal('gPrimeiraVez');
        var duracao = getVal('gDuracao');
        var duracaoLabel = duracao === '50min' ? '50 minutos' : '30 minutos';
        var pacote = getVal('gPacote');
        var pacoteInput = document.querySelector('input[name="gPacote"]:checked');
        var preco = pacoteInput ? pacoteInput.dataset.preco : '';
        var turno = getVal('gTurno') || 'Sem preferência';
        var prioridade = getVal('gPrioridade') || 'A combinar';
        var nome = document.getElementById('gNome').value.trim();
        var telefone = document.getElementById('gTelefone').value.trim();

        var msg = 'Olá! Vim pelo site do Espaço do Renascer e ainda não escolhi uma profissional. 🌱\n\n' +
          'Gostaria que a equipe me indicasse quem está disponível.\n\n' +
          'O que gostaria de tratar: ' + tema + (temaDetalhe ? ', ' + temaDetalhe : '') + '\n' +
          'Já fez terapia antes: ' + primeiraVez + '\n' +
          'Duração da sessão: ' + duracaoLabel + '\n' +
          'Pacote: ' + pacote + ' (' + preco + ')\n' +
          'Turno de preferência: ' + turno + '\n' +
          'Prioridade para começar: ' + prioridade + '\n\n' +
          'Meu nome: ' + nome + '\n' +
          'Meu WhatsApp: ' + telefone + '\n\n' +
          'Podem me indicar qual profissional tem horário disponível?';

        if (typeof fbq === 'function') {
          fbq('track', 'Lead', {
            content_category: 'Fale conosco (sem profissional escolhida)'
          });
        }

        var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
        window.open(url, '_blank', 'noopener');
        fecharModalGenerico();
      }
    }

  })();


  (function(){
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
  })();

  (function(){
    var buttons = document.querySelectorAll('.filter-btn');
    var cards = document.querySelectorAll('.pro-card');
    buttons.forEach(function(btn){
      btn.addEventListener('click', function(){
        buttons.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var f = btn.getAttribute('data-filter');
        cards.forEach(function(card){
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

    var PROFISSIONAIS = {
      'andrea-santos': {
        nome: 'Andrea Santos',
        cargo: 'Psicóloga Clínica',
        registro: null,
        tags: ['TCC', 'Neuropsicologia', 'Todas as idades'],
        bio: [
          'Psicóloga clínica com cerca de 8 anos de experiência, atendendo crianças, adolescentes e adultos. É especialista em Terapia Cognitivo-Comportamental (TCC) e em Psicopedagogia Clínica e Institucional, e atualmente é pós-graduanda em Neuropsicologia.',
          'Tem experiência em psicoterapia individual e em grupo, Home Care e acompanhamento de pacientes com doenças crônicas, oncológicas e em reabilitação. Seu trabalho tem foco em ansiedade, depressão, trauma, burnout, luto e promoção da saúde mental.'
        ],
        quote: null,
        testemunhos: [
          'Me senti muito confortável na terapia com a Andrea e logo a primeira sessão trouxe um insight importante da causa da minha ansiedade. Admiro a dedicação dela. Quando precisar novamente, já sei a quem buscar.',
          'A terapia mudou minha vida de forma incrível, trouxe mudanças profundas e positivas que eu nunca imaginei alcançar. Sou grata pela minha nova perspectiva, minha autoconfiança renovada e pela paz interior que encontrei.',
          'Minha experiência com a Andrea tem sido excelente. Ela é uma profissional muito acolhedora, atenciosa e humana. Tenho percebido avanços reais desde o início das sessões.'
        ],
        disponibilidade: [
          { turno: 'manha' }, { turno: 'tarde' }, { turno: 'noite' }
        ]
      },
      'anderson-muller': {
        nome: 'Anderson Muller',
        cargo: 'Psicanalista',
        registro: 'Mestrado livre em Psicanálise · Conselho Nacional de Psicanálise',
        tags: ['Psicanálise', 'TDAH', 'Pesquisa acadêmica'],
        bio: [
          'Atua na área da saúde mental há um ano e meio, dedicado à psicanálise. É graduado em Pedagogia, com pós-graduações em Psicopedagogia Clínica e Institucional e em Psicanálise Clínica e Intervenções na Psicanálise, além de formações complementares em psicanálise para traumas familiares, psicanálise voltada ao TDAH e psicanálise forense.',
          'Possui mestrado livre em Psicanálise pelo Conselho Nacional de Psicanálise, entidade à qual é filiado, e atualmente cursa o doutorado pela mesma instituição. Tem um artigo científico publicado, em parceria com uma neuropsicopedagoga e um médico, sobre inclusão, que fará parte do Congresso Internacional Movimentos Docentes 2026, além de um segundo artigo já aprovado na primeira etapa de avaliação do MEC para o caderno de educação inclusiva de 2027. Se descreve como um estudioso e pesquisador da mente humana.'
        ],
        quote: null,
        testemunhos: [],
        disponibilidade: [
          { turno: 'manha', nota: 'somente sexta-feira' },
          { turno: 'tarde', nota: 'somente sexta-feira' },
          { turno: 'noite', nota: 'segunda a sexta' }
        ]
      },
      'lucyjane': {
        nome: 'Lucyjane',
        cargo: 'Psicanalista',
        registro: '20 anos de experiência como terapeuta',
        tags: ['Psicanálise', 'Acolhimento', '20 anos de experiência'],
        bio: [
          'Psicanalista com 20 anos de experiência como terapeuta. Conduz cada processo com sinceridade, dedicação e um cuidado genuíno por quem atende, criando um espaço de confiança para a jornada terapêutica.'
        ],
        quote: null,
        testemunhos: [],
        disponibilidade: [
          { turno: 'manha' }, { turno: 'tarde' }
        ]
      },
      'carla-santos': {
        nome: 'Carla Santos',
        cargo: 'Psicanalista Clínica e Forense',
        registro: 'Formada pela Academy PSMS',
        tags: ['Autoconhecimento', 'Relacionamentos', 'Luto e mudanças'],
        bio: [
          'Psicanalista Clínica e Forense, formada pela Academy PSMS. Atua com autoconhecimento e desenvolvimento pessoal, autoestima e inseguranças, questões emocionais, conflitos familiares, dificuldades nos relacionamentos, luto, momentos de mudança, conflitos internos e questões profissionais.'
        ],
        quote: 'Um espaço seguro para você falar, ser ouvido(a) e olhar para si com mais atenção.',
        testemunhos: [],
        disponibilidade: [
          { turno: 'tarde' }
        ]
      },
      'laryssa-souza': {
        nome: 'Laryssa Souza',
        cargo: 'Psicóloga Clínica',
        registro: null,
        tags: ['Ansiedade', 'Depressão', 'Autoestima'],
        bio: [
          'Psicóloga formada em 2022, atualmente pós-graduanda em Psicanálise Clínica e Saúde Mental. Atua com depressão, ansiedade, término de relacionamentos, dificuldades de relacionamento familiar, autoconhecimento, autoestima e insegurança.'
        ],
        quote: null,
        testemunhos: [
          'Uma profissional super atenciosa! Cada sessão me sinto melhor. Em tão pouco tempo percebo mudanças nos meus atos e pensamentos. Hoje estou conseguindo enfrentar meus problemas com mais leveza, respeitando minha mente.',
          'Me abrir para você foi a melhor coisa que eu fiz na vida, um sentimento libertador de falar sem ser julgado, sem ser culpado e sem se vitimizar. Hoje me encontro em um momento de vida melhor.',
          'Ótimo atendimento, muito atenciosa, paciente, ótima ouvinte, já que na terapia falamos muito. Ótima terapeuta!'
        ],
        disponibilidade: [
          { turno: 'tarde' }, { turno: 'noite' }
        ]
      },
      'leticia-baes': {
        nome: 'Letícia Baes Wieczorek',
        cargo: 'Psicóloga (Lê Baes)',
        registro: null,
        tags: ['Ansiedade', 'Autoestima', 'LGBTQIAPN+'],
        bio: [
          'Psicóloga que atende sob a marca Lê Baes, com abordagem cognitivo-comportamental (TCC). Trabalha demandas de ansiedade, autoestima e relacionamentos, com um olhar acolhedor especialmente voltado ao público LGBTQIAPN+.'
        ],
        quote: null,
        testemunhos: [],
        disponibilidade: [
          { turno: 'manha' }, { turno: 'tarde' }, { turno: 'noite' }
        ]
      },
      'stefani-simas': {
        nome: 'Stefani Simas',
        cargo: 'Psicoterapeuta',
        registro: 'TCC · Psicanálise',
        tags: ['Ansiedade', 'Terapia de Casal', 'Acolhimento'],
        bio: [
          'Psicoterapeuta com abordagem em TCC e Psicanálise, especialista em ansiedade e terapia de casal. Conduz o processo terapêutico com acolhimento, escuta e cuidado emocional, atendendo online em todo o Brasil.'
        ],
        quote: null,
        testemunhos: [],
        disponibilidade: [
          { turno: 'manha', nota: 'seg. a sáb.' },
          { turno: 'tarde', nota: 'seg. a sex., até 13h no sáb.' },
          { turno: 'noite', nota: 'seg. a sex., até 22h' }
        ]
      },
      'liane-figueiredo': {
        nome: 'Liane Figueirêdo',
        cargo: 'Terapeuta ABA',
        registro: 'Formação em Psicologia, Psicopedagogia e Terapia ABA',
        tags: ['Neurodivergência', 'Aprendizagem', 'Terapia ABA'],
        bio: [
          'Terapeuta ABA e psicopedagoga, com um trabalho voltado ao cuidado, ao desenvolvimento e à promoção da saúde mental, respeitando a história e as necessidades de cada pessoa. Atende crianças, adolescentes e adultos de forma individualizada.',
          'Principais áreas de atuação: dificuldades de aprendizagem, desenvolvimento infantil, neurodivergência, baixa autoestima, ansiedade, depressão, dificuldades de relação social, pessoal e sentimental, além de orientação e acolhimento às famílias. Atua como terapeuta ABA há dois anos, com passagem por estágio em Clínica Escola e pela Clínica Ser e Sentir, sempre com supervisão.'
        ],
        quote: null,
        testemunhos: [],
        disponibilidade: [
          { turno: 'manha' }, { turno: 'tarde' }, { turno: 'noite' }
        ]
      },
      'raquel-aranha': {
        nome: 'Raquel Aranha',
        cargo: 'Psicóloga Clínica',
        registro: null,
        tags: ['ACP', 'Acolhimento', 'Relacionamentos'],
        bio: [
          'Psicóloga, graduada pelo CEUMA (Centro Universitário do Maranhão) e pós-graduada em Abordagem Centrada na Pessoa (ACP) pela faculdade Inspirar. Atua na psicologia há 8 anos.',
          'Sensível e empática, conduz o processo terapêutico com escuta ativa e acolhimento, ajudando pessoas a atravessar relações difíceis e a se reconectar com o próprio valor.'
        ],
        quote: 'O autoconhecimento é a chave para a sua liberdade.',
        testemunhos: [
          'Cada encontro me faz sentir mais segura e mais feliz. Sei que fiz a escolha certa quando decidi fazer esse acompanhamento.',
          'Fui muito bem acolhida, mesmo online me senti totalmente assistida. Passei por um relacionamento difícil e a terapia me ajudou muito além do que eu esperava; hoje me sinto muito mais forte.',
          'A terapia está me ajudando a compreender e a trabalhar meu emocional depois de um relacionamento difícil, para não voltar para o mesmo ciclo.'
        ],
        disponibilidade: [
          { turno: 'tarde' }, { turno: 'noite' }
        ]
      },
      'thainnara-dias': {
        nome: 'Thainnara Pereira Dias',
        cargo: 'Psicóloga Clínica',
        registro: null,
        tags: ['TCC', '7 anos de experiência', 'Atendimento Online'],
        bio: [
          'Psicóloga, formada desde 2018 e atuando na área há 7 anos, com abordagem Cognitivo-Comportamental (TCC).'
        ],
        quote: null,
        testemunhos: [],
        disponibilidade: [
          { turno: 'tarde', nota: 'terça e quinta-feira' },
          { turno: 'noite', nota: 'terça e quinta-feira' }
        ]
      },
      'barbara-santos': {
        nome: 'Bárbara Santos',
        cargo: 'Terapeuta TCC',
        registro: 'Formação em Coaching e PNL',
        tags: ['TCC', 'Coaching e PNL', 'Ansiedade e autoestima'],
        bio: [
          'Terapeuta especialista em Terapia Cognitivo-Comportamental (TCC), com formação em Coaching e PNL. Seu trabalho é pautado em acolhimento, empatia e escuta sem julgamentos.',
          'Atua especialmente com dependência emocional, luto, ansiedade, autoestima, traumas e relacionamentos abusivos, ajudando cada pessoa a compreender suas emoções, ressignificar experiências e construir relações mais saudáveis consigo e com os outros.'
        ],
        quote: null,
        testemunhos: [],
        disponibilidade: [
          { turno: 'tarde', nota: 'seg., a partir das 13h30' },
          { turno: 'noite', nota: 'seg., até 20h' },
          { turno: 'manha', nota: 'ter. a qui.' },
          { turno: 'tarde', nota: 'ter. a qui.' },
          { turno: 'noite', nota: 'ter. a qui., até 20h' }
        ]
      },
      'daniela': {
        nome: 'Daniela',
        cargo: 'Psicóloga Clínica',
        registro: null,
        tags: ['TCC', 'Acolhimento', 'Autoconhecimento'],
        bio: [
          'Psicóloga clínica, trabalha com a abordagem da Terapia Cognitivo-Comportamental (TCC). Seu trabalho é voltado para compreender, junto ao paciente, a forma como pensamentos, emoções e comportamentos se relacionam, buscando desenvolver estratégias mais saudáveis para lidar com as situações do dia a dia.',
          'Acredita em uma psicoterapia acolhedora, individualizada e construída em conjunto, respeitando a história, o momento e as necessidades de cada pessoa. Seu objetivo é que a terapia seja um espaço de escuta, compreensão e, principalmente, de construção de mudanças possíveis.'
        ],
        quote: null,
        testemunhos: [
          'Sua escuta e acolhimento fazem a diferença. Obrigada por me guiar com tanta sabedoria; seu tempo e dedicação transformam minha vida. Sou grata por me ajudar a ser mais forte.',
          'Quero te agradecer pelo carinho durante todo o tempo em que estivemos em terapia. Você é extremamente atenciosa e só tenho elogios a fazer.',
          'Aconteceram algumas coisas desde o nosso último encontro e queria agradecer pelas viradas de chave na minha cabeça. Foi pouco tempo, mas o suficiente para eu enxergar o que não estava conseguindo sozinha. Obrigada por me mostrar possibilidades de futuro.'
        ],
        disponibilidade: [
          { turno: 'manha' }, { turno: 'tarde' }, { turno: 'noite' }
        ]
      },
      'nathalia-moreno': {
        nome: 'Nathalia Moreno',
        cargo: 'Psicóloga Clínica',
        registro: null,
        tags: ['TCC', 'Ansiedade e depressão', 'Autoconhecimento'],
        bio: [
          'Psicóloga clínica há mais de 10 anos, com abordagem em Terapia Cognitivo-Comportamental (TCC). Seu objetivo é ajudar cada paciente a identificar, entender e modificar padrões de pensamento e comportamento que impactam negativamente a saúde mental e o bem-estar.',
          'Atua com dependência emocional, ansiedade, depressão, estresse, medo e insegurança, burnout, luto, autocobrança, autoconhecimento e desenvolvimento pessoal, com atendimento para todo o Brasil.'
        ],
        quote: null,
        testemunhos: [
          'Tive muita sorte em te encontrar logo de primeira, quando eu mais precisava. Muita gente fica trocando de psicólogo, né.',
          'Nem eu consigo acreditar que, um mês atrás, eu estava sem vontade e sem perspectiva de nada. Estou me sentindo bem melhor com as sessões. Você é a melhor, obrigada pela atenção de sempre.',
          'A melhor escolha da minha vida foi ter procurado uma profissional, e você foi a melhor escolha possível. As orientações e os caminhos que me mostrou me ajudaram a chegar no controle. Gratidão pelo profissionalismo, pela atenção e pelo cuidado de sempre.'
        ],
        disponibilidade: [
          { turno: 'manha' }, { turno: 'tarde' }
        ]
      }
    };

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
      var card = document.querySelector('.pro-card-btn[data-slug="' + slug + '"]');
      var srcImg = card ? card.closest('.pro-card').querySelector('.avatar img') : null;
      if (srcImg) {
        var img = document.createElement('img');
        img.src = srcImg.src;
        img.alt = srcImg.alt;
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
    applyRoute(window.location.hash, true);

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

  })();


// ============================================
// PWA - SERVICE WORKER E INSTALAÇÃO
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then((reg) => console.log('[PWA] Service Worker registrado:', reg.scope))
      .catch((err) => console.error('[PWA] Falha ao registrar Service Worker:', err));
  });
}

let deferredPrompt = null;
const installAppBtn = document.getElementById('install-app-btn');
function isStandaloneMode() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
if (isStandaloneMode() && installAppBtn) installAppBtn.classList.add('hidden');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  if (installAppBtn && !isStandaloneMode()) installAppBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App instalado com sucesso!');
  if (installAppBtn) installAppBtn.classList.add('hidden');
  deferredPrompt = null;
});

if (installAppBtn) {
  installAppBtn.addEventListener('click', async () => {
    if (!deferredPrompt) { showToast('Para instalar, use o menu do navegador (⋮ > "Instalar app").', 'info'); return; }
    deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; installAppBtn.classList.add('hidden');
  });
}

// ============================================
// OBSERVADOR DE MODAIS
// ============================================
const modalObserver = new MutationObserver(() => {
  const openModals = document.querySelectorAll('.modal-overlay.open');
  if (openModals.length > 0) document.body.classList.add('no-scroll');
  else document.body.classList.remove('no-scroll');
});
document.querySelectorAll('.modal-overlay').forEach(el => modalObserver.observe(el, { attributes: true, attributeFilter: ['class'] }));

// ============================================
// CONFIGURAÇÃO DO SUPABASE E GÊNEROS TMDB
// ============================================
const SUPABASE_URL = 'https://ayxaylngrbozoasribyf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cu9L5NgYLAwnxC_Z0KW43g_dfgopJMX';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TMDB_API_KEY = 'e9ede36f1f7b66d5e8457d5a26f399e7'; 
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

// Banco de dados completo de gêneros do TMDB
const TMDB_GENRES = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime', 99: 'Documentário',
  18: 'Drama', 10751: 'Família', 14: 'Fantasia', 36: 'História', 27: 'Terror', 10402: 'Música',
  9648: 'Mistério', 10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV', 53: 'Suspense',
  10752: 'Guerra', 37: 'Faroeste',
  10759: 'Ação & Aventura', 10762: 'Kids', 10763: 'Notícias', 10764: 'Reality', 
  10765: 'Sci-Fi & Fantasia', 10766: 'Novela', 10767: 'Talk Show', 10768: 'Guerra & Política'
};

// ============================================
// ESTADO GLOBAL E REALTIME
// ============================================
const state = {
  user: null, userProfile: null, lists: [], activeListId: null, isReadOnly: false, items: [],
  filter: 'all', searchFilterText: '', genreFilter: 'all', sortOrder: 'recent', currentTab: 'my-lists', confirmCallback: null,
  searchTimeout: null, selectedResult: null, seasonsCache: {}, episodesCache: {},
  viewingUserId: null, currentRating: 0, listToShare: null, isLocalAction: false,
  processingEp: new Set(), activities: [], rouletteInterval: null, currentRouletteItem: null,
  rouletteType: 'all', rouletteGenre: 'all', viewingPublicUserId: null, followingIds: new Set(), socialTab: 'search'
};

let realtimeChannel = null;

// Elementos DOM
const authForm = document.getElementById('auth-form');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const listsContainer = document.getElementById('lists-container');
const activeListName = document.getElementById('active-list-name');
const activeListDesc = document.getElementById('active-list-desc');
const addBtn = document.getElementById('addBtn');
const membersBtn = document.getElementById('membersBtn');
const discoverBtn = document.getElementById('discoverBtn');
const internalSearchContainer = document.getElementById('internalSearchContainer');
const gridEl = document.getElementById('grid');
const statsEl = document.getElementById('stats');
const filtersEl = document.getElementById('filters');
const modal = document.getElementById('modal');
const confirmModal = document.getElementById('confirmModal');
const form = document.getElementById('itemForm');
const modalTitle = document.getElementById('modalTitle');
const confirmText = document.getElementById('confirmText');
const searchInput = document.getElementById('searchInput');
const searchDropdown = document.getElementById('searchDropdown');
const searchSpinner = document.getElementById('searchSpinner');
const saveBtn = document.getElementById('saveBtn');
const posterPlaceholder = document.getElementById('posterPlaceholder');
const largePoster = document.getElementById('largePoster');
const posterBg = document.getElementById('posterBg');
const activityListContainer = document.getElementById('activity-list-container');
const socialFeedContainer = document.getElementById('social-feed-container');
const socialSearchView = document.getElementById('social-search-view');
const socialFeedView = document.getElementById('social-feed-view');

// Elementos da Roda da Sorte
const discoverModal = document.getElementById('discoverModal');
const slotMachine = document.getElementById('slotMachine');
const slotPoster = document.getElementById('slotPoster');
const slotPlaceholder = document.getElementById('slotPlaceholder');
const slotTitle = document.getElementById('slotTitle');
const slotType = document.getElementById('slotType');
const slotAcceptBtn = document.getElementById('slotAcceptBtn');
const slotRetryBtn = document.getElementById('slotRetryBtn');
const slotStartBtn = document.getElementById('slotStartBtn');
const rouletteInitialActions = document.getElementById('rouletteInitialActions');
const slotFinalActions = document.getElementById('slotFinalActions');

const rouletteTypeContainer = document.getElementById('rouletteTypeContainer');
const rouletteTypeTrigger = document.getElementById('rouletteTypeTrigger');
const rouletteTypeOptions = document.getElementById('rouletteTypeOptions');
const rouletteTypeText = document.getElementById('rouletteTypeText');

const rouletteGenreContainer = document.getElementById('rouletteGenreContainer');
const rouletteGenreTrigger = document.getElementById('rouletteGenreTrigger');
const rouletteGenreOptions = document.getElementById('rouletteGenreOptions');
const rouletteGenreText = document.getElementById('rouletteGenreText');

// Elementos de filtro avançado
const filterGenreContainer = document.getElementById('filterGenreContainer');
const filterGenreTrigger = document.getElementById('filterGenreTrigger');
const filterGenreOptions = document.getElementById('filterGenreOptions');
const filterGenreText = document.getElementById('filterGenreText');
const sortOrderContainer = document.getElementById('sortOrderContainer');
const sortOrderTrigger = document.getElementById('sortOrderTrigger');
const sortOrderOptions = document.getElementById('sortOrderOptions');
const sortOrderText = document.getElementById('sortOrderText');

// Elementos de gênero nos modais
const editGenresDisplay = document.getElementById('editGenresDisplay');
const viewGenresDisplay = document.getElementById('viewGenresDisplay');

const seasonContainer = document.getElementById('seasonContainer');
const seasonTrigger = document.getElementById('seasonTrigger');
const seasonOptions = document.getElementById('seasonOptions');
const seasonText = document.getElementById('seasonText');
const seasonInput = document.getElementById('seasonSelect');
const episodeContainer = document.getElementById('episodeContainer');
const episodeTrigger = document.getElementById('episodeTrigger');
const episodeOptions = document.getElementById('episodeOptions');
const episodeText = document.getElementById('episodeText');
const episodeInput = document.getElementById('episodeSelect');

const starRating = document.getElementById('starRating');
const stars = starRating.querySelectorAll('.star');
const ratingInput = document.getElementById('rating');

const viewItemModal = document.getElementById('viewItemModal');
const viewTitle = document.getElementById('viewTitle');
const viewBadges = document.getElementById('viewBadges');
const viewReviewsList = document.getElementById('viewReviewsList');
const viewProgressSection = document.getElementById('viewProgressSection');
const viewProgressText = document.getElementById('viewProgressText');
const viewLargePoster = document.getElementById('viewLargePoster');
const viewPosterPlaceholder = document.getElementById('viewPosterPlaceholder');
const viewPosterBg = document.getElementById('viewPosterBg');
const viewWatchProvidersSection = document.getElementById('viewWatchProvidersSection');
const viewWatchProviders = document.getElementById('viewWatchProviders');

const profileModal = document.getElementById('profileModal');
const publicProfileModal = document.getElementById('publicProfileModal');
const searchInternal = document.getElementById('searchInternal');
const communitySearch = document.getElementById('communitySearch');
const communityResults = document.getElementById('communityResults');
const shareModal = document.getElementById('shareModal');
const shareCodeText = document.getElementById('shareCodeText');
const joinListModal = document.getElementById('joinListModal');
const joinCodeInput = document.getElementById('joinCodeInput');
const membersModal = document.getElementById('membersModal');
const btnFollow = document.getElementById('btn-follow');

// Utilitários
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusLabel = (s) => ({ want: 'Quero ver', watching: 'Assistindo', watched: 'Já vi' }[s]);
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const icons = {
  layers: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  bookmark: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  play: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  checkCircle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  lock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  unlock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  users: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
};

// ============================================
// FEED SOCIAL E SEGUIR USUÁRIOS
// ============================================
async function loadFollowingList() {
  const { data } = await supabaseClient.from('follows').select('following_id').eq('follower_id', state.user.id);
  state.followingIds = new Set((data || []).map(f => f.following_id));
}

window.switchSocialTab = (tab) => {
  state.socialTab = tab;
  document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  if (tab === 'search') {
    socialSearchView.classList.remove('hidden');
    socialFeedView.classList.add('hidden');
  } else {
    socialSearchView.classList.add('hidden');
    socialFeedView.classList.remove('hidden');
    loadSocialFeed();
  }
};

async function loadSocialFeed() {
  socialFeedContainer.innerHTML = '<p class="community-hint">Carregando feed...</p>';
  
  if (state.followingIds.size === 0) {
    socialFeedContainer.innerHTML = '<p class="community-hint">Você ainda não segue ninguém. Vá em "Descobrir" e siga amigos!</p>';
    return;
  }

  const followingArray = Array.from(state.followingIds);
  const { data, error } = await supabaseClient
    .from('activities')
    .select(`*, profiles ( username, avatar_url )`)
    .in('user_id', followingArray)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    socialFeedContainer.innerHTML = '<p class="community-hint">Erro ao carregar o feed.</p>';
    return;
  }

  if (!data || data.length === 0) {
    socialFeedContainer.innerHTML = '<p class="community-hint">Nenhuma atividade recente das pessoas que você segue.</p>';
    return;
  }

  socialFeedContainer.innerHTML = data.map(act => {
    const username = `@${act.profiles?.username || 'Usuário'}`;
    const avatar = act.profiles?.avatar_url ? `<img src="${act.profiles.avatar_url}">` : act.profiles?.username?.charAt(0).toUpperCase() || '?';
    const date = new Date(act.created_at);
    const timeString = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="activity-item">
        <div class="activity-avatar">${avatar}</div>
        <div class="activity-content">
          <div class="activity-text"><strong>${username}</strong> ${escapeHTML(act.description)}</div>
          <div class="activity-time">${timeString}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleFollow(targetUserId) {
  const isFollowing = state.followingIds.has(targetUserId);
  
  btnFollow.disabled = true;
  btnFollow.textContent = isFollowing ? 'Deixando...' : 'Seguindo...';

  if (isFollowing) {
    const { error } = await supabaseClient.from('follows').delete().eq('follower_id', state.user.id).eq('following_id', targetUserId);
    if (!error) {
      state.followingIds.delete(targetUserId);
      btnFollow.textContent = 'Seguir';
      btnFollow.classList.remove('btn-ghost');
      btnFollow.classList.add('btn-primary');
      showToast('Deixou de seguir.', 'info');
    }
  } else {
    const { error } = await supabaseClient.from('follows').insert({ follower_id: state.user.id, following_id: targetUserId });
    if (!error) {
      state.followingIds.add(targetUserId);
      btnFollow.textContent = 'Seguindo';
      btnFollow.classList.remove('btn-primary');
      btnFollow.classList.add('btn-ghost');
      showToast('Agora você está seguindo!', 'success');
    }
  }
  btnFollow.disabled = false;
}

btnFollow.addEventListener('click', () => {
  if (state.viewingPublicUserId) toggleFollow(state.viewingPublicUserId);
});

// ============================================
// RODA DA SORTE GLOBAL (DESCUBRA)
// ============================================
discoverBtn.addEventListener('click', () => {
  state.rouletteType = 'all';
  state.rouletteGenre = 'all';
  rouletteTypeText.textContent = 'Tudo';
  rouletteGenreText.textContent = 'Todos os Gêneros';
  
  populateRouletteTypes();
  populateRouletteGenres();
  
  discoverModal.classList.add('open');
  
  slotTitle.style.opacity = '0';
  slotType.style.opacity = '0';
  slotPoster.style.display = 'none';
  slotPoster.classList.remove('slot-reveal');
  slotPlaceholder.style.display = 'flex';
  slotPlaceholder.textContent = '🎬';
  slotMachine.classList.remove('slot-spinning');
  
  rouletteInitialActions.style.display = 'grid';
  slotFinalActions.classList.add('hidden');
  slotRetryBtn.classList.add('hidden');
  slotStartBtn.textContent = 'Girar Roda 🎲';
  slotStartBtn.disabled = false;
});

function populateRouletteTypes() {
  rouletteTypeOptions.innerHTML = `
    <div class="custom-option ${state.rouletteType === 'all' ? 'selected' : ''}" data-value="all">Tudo</div>
    <div class="custom-option ${state.rouletteType === 'movie' ? 'selected' : ''}" data-value="movie">Filmes</div>
    <div class="custom-option ${state.rouletteType === 'tv' ? 'selected' : ''}" data-value="tv">Séries</div>
  `;
}

function populateRouletteGenres() {
  const sortedGenres = Object.keys(TMDB_GENRES).sort((a,b) => TMDB_GENRES[a].localeCompare(TMDB_GENRES[b]));
  let html = `<div class="custom-option ${state.rouletteGenre === 'all' ? 'selected' : ''}" data-value="all">Todos os Gêneros</div>`;
  html += sortedGenres.map(id => `<div class="custom-option ${state.rouletteGenre === String(id) ? 'selected' : ''}" data-value="${id}">${TMDB_GENRES[id]}</div>`).join('');
  rouletteGenreOptions.innerHTML = html;
}

rouletteTypeOptions.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-option'); if (!opt) return;
  state.rouletteType = opt.dataset.value;
  rouletteTypeText.textContent = opt.textContent;
  rouletteTypeOptions.classList.remove('open'); rouletteTypeContainer.classList.remove('open');
});

rouletteGenreOptions.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-option'); if (!opt) return;
  state.rouletteGenre = opt.dataset.value;
  rouletteGenreText.textContent = opt.textContent;
  rouletteGenreOptions.classList.remove('open'); rouletteGenreContainer.classList.remove('open');
});

rouletteTypeTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(rouletteTypeTrigger, rouletteTypeOptions, rouletteTypeContainer); });
rouletteGenreTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(rouletteGenreTrigger, rouletteGenreOptions, rouletteGenreContainer); });

// FUNÇÃO BLINDADA: Busca qualquer gênero em Filmes e Séries
async function fetchRandomGlobalItem(genreId, typeFilter) {
  let types = [];
  if (typeFilter === 'movie') types = ['movie'];
  else if (typeFilter === 'tv') types = ['tv'];
  else types = Math.random() > 0.5 ? ['movie', 'tv'] : ['tv', 'movie'];

  for (const type of types) {
    try {
      // 1. Descobre o total de páginas
      let initialUrl = `${TMDB_BASE}/discover/${type}?api_key=${TMDB_API_KEY}&language=pt-BR&sort_by=popularity.desc&page=1`;
      if (genreId !== 'all') initialUrl += `&with_genres=${genreId}`;

      const initialRes = await fetch(initialUrl);
      if (!initialRes.ok) continue; 
      const initialData = await initialRes.json();
      if (!initialData.results || initialData.results.length === 0) continue; 

      const totalPages = initialData.total_pages;
      
      // 2. Tenta até 3 vezes achar uma página com capa
      for (let attempt = 0; attempt < 3; attempt++) {
        const randomPage = Math.floor(Math.random() * totalPages) + 1;
        
        let finalUrl = `${TMDB_BASE}/discover/${type}?api_key=${TMDB_API_KEY}&language=pt-BR&sort_by=popularity.desc&page=${randomPage}`;
        if (genreId !== 'all') finalUrl += `&with_genres=${genreId}`;

        const finalRes = await fetch(finalUrl);
        if (!finalRes.ok) continue;

        const finalData = await finalRes.json();
        if (finalData.results && finalData.results.length > 0) {
          const validItems = finalData.results.filter(item => item.poster_path);
          if (validItems.length > 0) {
            const randomIndex = Math.floor(Math.random() * validItems.length);
            const item = validItems[randomIndex];
            
            return {
              tmdb_id: item.id,
              title: item.title || item.name,
              type: type === 'movie' ? 'movie' : 'series',
              poster_path: item.poster_path,
              genre_ids: JSON.stringify(item.genre_ids || []),
            };
          }
        }
      }
    } catch (err) {
      console.warn(`Erro ao tentar buscar ${type}, tentando o próximo...`, err);
    }
  }
  return null;
}

window.startRoulette = async () => {
  if (state.rouletteInterval) clearInterval(state.rouletteInterval);
  
  slotStartBtn.disabled = true;
  slotStartBtn.textContent = 'Buscando...';
  
  rouletteInitialActions.style.display = 'none';
  slotFinalActions.classList.add('hidden');
  slotRetryBtn.classList.add('hidden');
  slotTitle.style.opacity = '0';
  slotType.style.opacity = '0';
  slotTitle.classList.remove('slot-reveal');
  slotPoster.classList.remove('slot-reveal');
  
  slotMachine.classList.add('slot-spinning');
  slotPoster.style.display = 'none';
  slotPlaceholder.style.display = 'flex';

  const winner = await fetchRandomGlobalItem(state.rouletteGenre, state.rouletteType);
  
  if (!winner) {
    slotMachine.classList.remove('slot-spinning');
    slotPlaceholder.textContent = '🎬';
    rouletteInitialActions.style.display = 'grid';
    slotStartBtn.disabled = false;
    slotStartBtn.textContent = 'Girar Roda 🎲';
    return showToast('Nenhum título encontrado com essa combinação. Tente outro!', 'info');
  }

  let shuffleCount = 0;
  const totalShuffles = 20 + Math.floor(Math.random() * 10);
  const emojis = ['🎬', '🍿', '🎭', '🎲', '👻', '🚀', '🦸‍♂️', '🕵️‍♂️', '🦖', '💘', '🎟️'];

  state.rouletteInterval = setInterval(() => {
    slotPlaceholder.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    shuffleCount++;
    
    if (shuffleCount >= totalShuffles) {
      clearInterval(state.rouletteInterval);
      state.rouletteInterval = null;
      stopRoulette(winner);
    }
  }, 80);
};

function stopRoulette(winner) {
  slotMachine.classList.remove('slot-spinning');
  state.currentRouletteItem = winner;
  
  slotPlaceholder.style.display = 'none';
  slotPoster.src = `${TMDB_IMG}${winner.poster_path}`;
  slotPoster.style.display = 'block';
  slotPoster.classList.add('slot-reveal');
  
  slotTitle.textContent = winner.title;
  slotType.textContent = winner.type === 'series' ? 'Série' : 'Filme';
  
  slotTitle.style.opacity = '1';
  slotType.style.opacity = '1';
  slotTitle.classList.add('slot-reveal');
  
  slotFinalActions.classList.remove('hidden');
  slotAcceptBtn.classList.remove('hidden');
  slotRetryBtn.classList.remove('hidden');
}

document.getElementById('slotAcceptBtn').addEventListener('click', async () => {
  if (!state.currentRouletteItem) return;
  const item = state.currentRouletteItem;
  
  const existing = state.items.find(i => i.tmdb_id == item.tmdb_id);
  if (existing) {
    discoverModal.classList.remove('open');
    return showToast(`"${item.title}" já está na sua lista!`, 'info');
  }

  slotAcceptBtn.disabled = true;
  slotAcceptBtn.textContent = 'Salvando...';
  
  const { data: newItem, error } = await supabaseClient.from('items').insert({
    list_id: state.activeListId,
    title: item.title,
    type: item.type,
    status: 'want',
    tmdb_id: item.tmdb_id,
    poster_path: item.poster_path,
    genre_ids: item.genre_ids
  }).select().single();

  if (!error) {
    await supabaseClient.from('item_reviews').insert({
      item_id: newItem.id, user_id: state.user.id, rating: 0, note: ''
    });
    
    await logActivity(`adicionou "${item.title}" via Roda da Sorte`);
    await fetchItems();
    showToast(`"${item.title}" adicionado à lista!`, 'success');
  } else {
    showToast('Erro ao adicionar à lista.', 'error');
  }
  
  slotAcceptBtn.disabled = false;
  slotAcceptBtn.textContent = 'Adicionar à Lista';
  discoverModal.classList.remove('open');
});


// ============================================
// LÓGICA DE FILTROS E ORDENAÇÃO (TELA PRINCIPAL)
// ============================================
function populateFilterGenres() {
  const genresInList = new Set();
  state.items.forEach(item => {
    let gIds = item.genre_ids;
    if (typeof gIds === 'string') { try { gIds = JSON.parse(gIds); } catch(e) { gIds = []; } }
    if (Array.isArray(gIds)) gIds.forEach(id => genresInList.add(Number(id)));
  });

  const sortedGenres = Array.from(genresInList).sort((a,b) => (TMDB_GENRES[a]||'').localeCompare(TMDB_GENRES[b]||''));

  let html = `<div class="custom-option ${state.genreFilter === 'all' ? 'selected' : ''}" data-value="all">Todos os Gêneros</div>`;
  html += sortedGenres.map(id => `<div class="custom-option ${state.genreFilter === String(id) ? 'selected' : ''}" data-value="${id}">${TMDB_GENRES[id] || 'Outro'}</div>`).join('');
  filterGenreOptions.innerHTML = html;
}

filterGenreOptions.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-option'); if (!opt) return;
  state.genreFilter = opt.dataset.value;
  filterGenreText.textContent = opt.textContent;
  filterGenreOptions.classList.remove('open'); filterGenreContainer.classList.remove('open');
  renderGrid();
});

sortOrderOptions.innerHTML = `
  <div class="custom-option ${state.sortOrder === 'recent' ? 'selected' : ''}" data-value="recent">Mais Recentes</div>
  <div class="custom-option ${state.sortOrder === 'az' ? 'selected' : ''}" data-value="az">A-Z</div>
  <div class="custom-option ${state.sortOrder === 'rating' ? 'selected' : ''}" data-value="rating">Nota Mais Alta</div>
`;

sortOrderOptions.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-option'); if (!opt) return;
  state.sortOrder = opt.dataset.value;
  sortOrderText.textContent = opt.textContent;
  sortOrderOptions.classList.remove('open'); sortOrderContainer.classList.remove('open');
  renderGrid();
});

// ============================================
// FUNÇÃO DE LOG E BUSCA DE ATIVIDADES
// ============================================
async function logActivity(description) {
  if (!state.activeListId || !state.user) return;
  await supabaseClient.from('activities').insert({
    list_id: state.activeListId,
    user_id: state.user.id,
    description: description
  });
}

async function fetchActivities() {
  if (!state.activeListId) return;
  activityListContainer.innerHTML = '<p class="community-hint">Carregando atividades...</p>';
  const { data, error } = await supabaseClient.from('activities').select(`*, profiles ( username, avatar_url )`).eq('list_id', state.activeListId).order('created_at', { ascending: false }).limit(50);
  if (error) { console.error(error); activityListContainer.innerHTML = '<p class="community-hint">Erro ao carregar.</p>'; return; }
  state.activities = data || []; renderActivities();
}

function renderActivities() {
  if (state.activities.length === 0) { activityListContainer.innerHTML = '<p class="community-hint">Nenhuma atividade recente nesta lista.</p>'; return; }
  activityListContainer.innerHTML = state.activities.map(act => {
    const isMe = act.user_id === state.user.id;
    const username = isMe ? 'Você' : `@${act.profiles?.username || 'Usuário'}`;
    const avatar = act.profiles?.avatar_url ? `<img src="${act.profiles.avatar_url}">` : act.profiles?.username?.charAt(0).toUpperCase() || '?';
    const date = new Date(act.created_at);
    const timeString = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="activity-item">
        <div class="activity-avatar">${avatar}</div>
        <div class="activity-content">
          <div class="activity-text"><strong>${username}</strong> ${escapeHTML(act.description)}</div>
          <div class="activity-time">${timeString}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// REALTIME (SINCRONIZAÇÃO EM TEMPO REAL)
// ============================================
function setupRealtime(listId) {
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  if (!listId || state.isReadOnly) return;

  realtimeChannel = supabaseClient
    .channel('list-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
      if (state.isLocalAction) return;
      if (payload.eventType === 'INSERT' && payload.new.list_id === state.activeListId) {
        fetchItems(); showToast(`Novo título: "${payload.new.title}"`, 'info');
      } else if (payload.eventType === 'UPDATE' && payload.new.list_id === state.activeListId) {
        const idx = state.items.findIndex(i => i.id === payload.new.id);
        if (idx > -1) { state.items[idx] = { ...state.items[idx], ...payload.new }; render(); }
      } else if (payload.eventType === 'DELETE') {
        if (payload.old && payload.old.id) {
          const idx = state.items.findIndex(i => i.id === payload.old.id);
          if (idx > -1) { state.items.splice(idx, 1); render(); }
        } else { fetchItems(); }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'item_reviews' }, (payload) => {
      if (state.isLocalAction) return;
      if (payload.new && payload.new.user_id !== state.user.id) fetchItems();
      else if (payload.eventType === 'DELETE') fetchItems();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, (payload) => {
      if (payload.new.list_id === state.activeListId) fetchActivities();
      if (state.followingIds.has(payload.new.user_id) && state.socialTab === 'feed') loadSocialFeed();
    })
    .subscribe();
}

// ============================================
// LÓGICA DE COMPARTILHAMENTO E MEMBROS
// ============================================
document.getElementById('btn-join-list').addEventListener('click', () => { joinCodeInput.value = ''; joinListModal.classList.add('open'); });

async function joinSharedList() {
  const code = joinCodeInput.value.trim().toUpperCase(); if (!code) return showToast('Digite o código.', 'error');
  const { data: listData, error: listErr } = await supabaseClient.from('lists').select('*').eq('invite_code', code).maybeSingle();
  if (listErr || !listData) return showToast('Código inválido ou lista não encontrada.', 'error');
  if (listData.user_id === state.user.id) return showToast('Você já é o dono desta lista!', 'info');
  const { data: existing } = await supabaseClient.from('list_collaborators').select('*').eq('list_id', listData.id).eq('user_id', state.user.id).maybeSingle();
  if (existing) return showToast('Você já está nesta lista.', 'info');
  const { error } = await supabaseClient.from('list_collaborators').insert({ list_id: listData.id, user_id: state.user.id, role: 'member' });
  if (error) showToast('Erro ao entrar na lista.', 'error');
  else { 
    showToast('Você entrou na lista!', 'success'); joinListModal.classList.remove('open'); await fetchLists();
    await logActivity(`entrou na lista`); 
  }
}

window.openShareModal = async (listId) => {
  const list = state.lists.find(l => l.id === listId); if (!list) return;
  state.listToShare = list; shareModal.classList.add('open');
  if (!list.invite_code) {
    shareCodeText.textContent = 'GERANDO...'; const code = generateCode();
    const { error } = await supabaseClient.from('lists').update({ invite_code: code }).eq('id', listId);
    if (!error) { list.invite_code = code; shareCodeText.textContent = code; }
    else { showToast('Erro ao gerar código.', 'error'); shareCodeText.textContent = 'ERRO'; }
  } else shareCodeText.textContent = list.invite_code;
};

function copyShareCode() {
  const text = shareCodeText.textContent;
  if (text && text !== 'GERANDO...' && text !== 'ERRO') { navigator.clipboard.writeText(text); showToast('Código copiado!', 'success'); }
}

window.openMembersModal = async () => {
  if (!state.activeListId) return;
  const list = state.lists.find(l => l.id === state.activeListId); if (!list) return;
  const canManage = list.user_id === state.user.id || list.my_role === 'admin';
  membersModal.classList.add('open'); const container = document.getElementById('membersList');
  container.innerHTML = '<p style="color:var(--text-2); font-size:13px; text-align:center;">Carregando...</p>';
  const { data: listData } = await supabaseClient.from('lists').select('*').eq('id', state.activeListId).single();
  const { data: ownerProfile } = await supabaseClient.from('profiles').select('*').eq('id', listData.user_id).single();
  let html = `<div class="member-item"><div class="member-info"><div class="user-avatar">${ownerProfile?.avatar_url ? `<img src="${ownerProfile.avatar_url}">` : ownerProfile?.username?.charAt(0).toUpperCase()}</div><div><div class="member-name">@${ownerProfile?.username}</div><div class="member-role">Dono</div></div></div></div>`;
  const { data: collabs } = await supabaseClient.from('list_collaborators').select('*').eq('list_id', state.activeListId);
  if (collabs && collabs.length > 0) {
    for (const c of collabs) {
      const { data: prof } = await supabaseClient.from('profiles').select('*').eq('id', c.user_id).single();
      const isMe = c.user_id === state.user.id;
      html += `<div class="member-item"><div class="member-info"><div class="user-avatar">${prof?.avatar_url ? `<img src="${prof.avatar_url}">` : prof?.username?.charAt(0).toUpperCase()}</div><div><div class="member-name">@${prof?.username} ${isMe ? '(Você)' : ''}</div><div class="member-role">${c.role === 'admin' ? 'Administrador' : 'Membro'}</div></div></div><div class="member-actions">${canManage && !isMe ? `${c.role === 'member' ? `<button class="btn btn-ghost" style="padding:4px 8px; font-size:11px;" onclick="promoteMember('${c.user_id}')">Tornar Admin</button>` : `<button class="btn btn-ghost" style="padding:4px 8px; font-size:11px;" onclick="demoteMember('${c.user_id}')">Tornar Membro</button>`}<button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="removeMember('${c.user_id}')">Remover</button>` : ''}${isMe && c.user_id !== listData.user_id ? `<button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="leaveList()">Sair</button>` : ''}</div></div>`;
    }
  } else { html += `<p style="text-align:center; color:var(--text-2); font-size:13px; margin-top:16px;">Nenhum membro além de você.</p>`; }
  container.innerHTML = html;
};

window.leaveList = async () => {
  await logActivity('saiu da lista');
  await supabaseClient.from('list_collaborators').delete().eq('list_id', state.activeListId).eq('user_id', state.user.id);
  showToast('Você saiu da lista.', 'info'); membersModal.classList.remove('open'); state.activeListId = null; await fetchLists();
};
window.removeMember = async (userId) => { const { error } = await supabaseClient.from('list_collaborators').delete().eq('list_id', state.activeListId).eq('user_id', userId); if (error) showToast('Erro.', 'error'); else { showToast('Removido.', 'info'); openMembersModal(); } };
window.promoteMember = async (userId) => { const { data, error } = await supabaseClient.from('list_collaborators').update({ role: 'admin' }).eq('list_id', state.activeListId).eq('user_id', userId).select(); if (error || !data || data.length === 0) showToast('Erro.', 'error'); else { showToast('Promovido.', 'success'); openMembersModal(); } };
window.demoteMember = async (userId) => { const { data, error } = await supabaseClient.from('list_collaborators').update({ role: 'member' }).eq('list_id', state.activeListId).eq('user_id', userId).select(); if (error || !data || data.length === 0) showToast('Erro.', 'error'); else { showToast('Rebaixado.', 'info'); openMembersModal(); } };

window.deleteList = async (listId) => {
  openConfirm({ title: 'Excluir Lista?', text: 'Tem certeza?', confirmLabel: 'Excluir', onConfirm: async () => {
    const { error } = await supabaseClient.from('lists').delete().eq('id', listId);
    if (!error) { showToast('Lista excluída.', 'info'); if (state.activeListId === listId) state.activeListId = null; await fetchLists(); } 
    else showToast('Erro.', 'error');
  }});
};

// ============================================
// LÓGICA DAS ESTRELAS
// ============================================
function setRating(val) { state.currentRating = val; ratingInput.value = val; updateStarsVisual(val); updateLivePreview(); }
function updateStarsVisual(val, isHover = false) {
  stars.forEach(star => {
    const starVal = parseInt(star.dataset.value);
    if (isHover) { star.classList.toggle('hover', starVal <= val); star.classList.remove('active'); } 
    else { star.classList.toggle('active', starVal <= val); star.classList.remove('hover'); }
  });
}
stars.forEach(star => { star.addEventListener('mouseenter', () => updateStarsVisual(parseInt(star.dataset.value), true)); star.addEventListener('mouseleave', () => updateStarsVisual(state.currentRating, false)); star.addEventListener('click', () => setRating(parseInt(star.dataset.value))); });
document.getElementById('note').addEventListener('input', updateLivePreview);

function updateLivePreview() {
  const container = document.getElementById('otherReviewsContainer'); if (!container || container.style.display === 'none') return;
  const myLiveNote = document.getElementById('myLiveNote'); const myLiveStars = document.getElementById('myLiveStars');
  if (myLiveNote) { const note = document.getElementById('note').value.trim(); myLiveNote.innerHTML = note ? `"${escapeHTML(note)}"` : 'Sem comentário.'; }
  if (myLiveStars) {
    const rating = parseInt(ratingInput.value) || 0;
    myLiveStars.innerHTML = Array(5).fill(0).map((_, i) => `<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:${i < rating ? 'var(--amber)' : 'rgba(255,255,255,0.1)'};"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join('');
  }
}

// ============================================
// RENDERIZADOR DE TAGS DE GÊNERO
// ============================================
function renderGenreTags(container, genreIdsStr) {
  let gIds = genreIdsStr || '[]';
  if (typeof gIds === 'string') { try { gIds = JSON.parse(gIds); } catch(e) { gIds = []; } }
  const genres = gIds.map(id => TMDB_GENRES[id]).filter(Boolean);
  
  if (genres.length > 0) {
    container.innerHTML = genres.map(g => `<span style="font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; background:rgba(139,92,246,0.15); color:var(--accent); text-transform:uppercase; letter-spacing:0.5px;">${g}</span>`).join('');
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
}

// ============================================
// MODAL DE VISUALIZAÇÃO E ONDE ASSISTIR
// ============================================
async function fetchWatchProviders(tmdbId, type) {
  const endpoint = type === 'series' ? 'tv' : 'movie';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
    const data = await res.json();
    const brProviders = data.results?.BR;
    
    if (!brProviders) return null;
    return brProviders.flatrate || brProviders.rent || brProviders.buy || null;
  } catch (error) {
    console.error("Erro ao buscar streamings:", error);
    return null;
  }
}

window.viewItemDetails = async (id) => {
  const item = state.items.find(i => i.id === id); if (!item) return;
  viewTitle.textContent = item.title;
  viewBadges.innerHTML = `<span class="badge type">${item.type === 'series' ? 'Série' : 'Filme'}</span><span class="badge status-${item.status}">${statusLabel(item.status)}</span>`;
  
  renderGenreTags(viewGenresDisplay, item.genre_ids);
  
  if (item.item_reviews && item.item_reviews.length > 0) {
    viewReviewsList.innerHTML = item.item_reviews.map(r => `<div class="review-card"><div class="review-header"><div class="review-avatar">${r.profiles?.avatar_url ? `<img src="${r.profiles.avatar_url}">` : r.profiles?.username?.charAt(0).toUpperCase()}</div><span class="review-user">@${r.profiles?.username}</span><div class="card-stars" style="margin-left:auto;">${Array(5).fill(0).map((_, i) => `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:${i < r.rating ? 'var(--amber)' : 'rgba(255,255,255,0.1)'};"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join('')}</div></div><p class="review-note">${r.note ? `"${escapeHTML(r.note)}"` : 'Sem comentário.'}</p></div>`).join('');
  } else { viewReviewsList.innerHTML = '<p style="color:var(--text-2); font-size:13px;">Nenhuma avaliação ainda.</p>'; }
  
  if (item.type === 'series' && item.episode > 0) { 
    viewProgressSection.style.display = 'flex'; 
    viewProgressText.textContent = `Parou na Temporada ${item.season || 1}, Episódio ${item.episode}`; 
  } else { 
    viewProgressSection.style.display = 'none'; 
  }
  
  if (item.poster_path) { 
    viewLargePoster.src = `${TMDB_IMG}${item.poster_path}`; 
    viewLargePoster.style.display = 'block'; 
    viewPosterPlaceholder.style.display = 'none'; 
    viewPosterBg.style.backgroundImage = `url(${TMDB_IMG}${item.poster_path})`; 
  } else { 
    viewLargePoster.style.display = 'none'; 
    viewPosterPlaceholder.style.display = 'flex'; 
    viewPosterBg.style.backgroundImage = 'none'; 
  }

  viewWatchProvidersSection.style.display = 'none';
  viewWatchProviders.innerHTML = '';
  if (item.tmdb_id) {
    viewWatchProviders.innerHTML = '<span style="font-size:12px;color:var(--text-3);">Buscando...</span>';
    viewWatchProvidersSection.style.display = 'flex';
    
    const providers = await fetchWatchProviders(item.tmdb_id, item.type);
    if (providers && providers.length > 0) {
      viewWatchProviders.innerHTML = providers.map(p => `
        <img class="provider-logo" src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${p.provider_name}" title="${p.provider_name}">
      `).join('');
    } else {
      viewWatchProvidersSection.style.display = 'none';
    }
  }

  viewItemModal.classList.add('open');
};

// ============================================
// AUTENTICAÇÃO
// ============================================
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim().toLowerCase(); const password = document.getElementById('auth-password').value; const btn = document.getElementById('btn-login');
  if (!username || !password) return;
  const fakeEmail = `${username}@watchlist.app`; btn.textContent = 'Entrando...';
  const { error } = await supabaseClient.auth.signInWithPassword({ email: fakeEmail, password });
  if (error) { showToast(error.message === 'Invalid login credentials' ? 'Usuário ou senha incorretos.' : error.message, 'error'); btn.textContent = 'Entrar'; }
});

document.getElementById('btn-signup').addEventListener('click', async (e) => {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim().toLowerCase(); const password = document.getElementById('auth-password').value; const btn = e.target;
  if (!username || !password) return showToast('Preencha usuário e senha.', 'error');
  if (username.length < 3) return showToast('O usuário precisa ter pelo menos 3 letras.', 'error');
  if (password.length < 6) return showToast('A senha precisa ter pelo menos 6 caracteres.', 'error');
  if (username.includes(' ')) return showToast('O nome não pode ter espaços.', 'error');
  const fakeEmail = `${username}@watchlist.app`; btn.textContent = 'Criando...';
  const { error } = await supabaseClient.auth.signUp({ email: fakeEmail, password });
  if (error) { showToast(error.message.includes('already registered') ? 'Este usuário já existe.' : error.message, 'error'); btn.textContent = 'Criar Conta'; } 
  else { showToast('Conta criada!', 'success'); await supabaseClient.auth.signInWithPassword({ email: fakeEmail, password }); }
});

document.getElementById('btn-logout').addEventListener('click', async () => { await supabaseClient.auth.signOut(); });

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    state.user = session.user; authScreen.classList.add('hidden'); appScreen.classList.remove('hidden'); await fetchUserProfile();
    await loadFollowingList();
    document.getElementById('user-info').innerHTML = `<div class="user-avatar">${state.userProfile?.avatar_url ? `<img src="${state.userProfile.avatar_url}" alt="Avatar">` : state.userProfile?.username?.charAt(0).toUpperCase()}</div><div class="user-email">@${state.userProfile?.username}</div>`;
    await checkMigration(); await fetchLists(); updateProfileModal();
  } else {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    state.user = null; state.userProfile = null; authScreen.classList.remove('hidden'); appScreen.classList.add('hidden');
    state.lists = []; state.activeListId = null; state.items = []; state.isReadOnly = false; state.activities = []; state.followingIds.clear();
    gridEl.innerHTML = ''; statsEl.innerHTML = '';
    document.getElementById('auth-username').value = ''; document.getElementById('auth-password').value = '';
    document.getElementById('btn-login').textContent = 'Entrar'; document.getElementById('btn-signup').textContent = 'Criar Conta';
    profileModal.classList.remove('open'); publicProfileModal.classList.remove('open'); viewItemModal.classList.remove('open');
    shareModal.classList.remove('open'); joinListModal.classList.remove('open'); membersModal.classList.remove('open'); discoverModal.classList.remove('open');
  }
});

async function fetchUserProfile() {
  if (!state.user) return;
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', state.user.id).single();
  if (!error) state.userProfile = data; else state.userProfile = { username: state.user.email.split('@')[0], avatar_url: null };
}

// ============================================
// PERFIL E EDIÇÃO
// ============================================
function updateProfileModal() {
  if (!state.user) return;
  const username = state.userProfile?.username || 'usuario'; const avatarUrl = state.userProfile?.avatar_url;
  const joinDate = new Date(state.user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  document.getElementById('profileUsername').textContent = `@${username}`; document.getElementById('profileJoinDate').textContent = `Entrou em ${joinDate}`;
  const avatarImg = document.getElementById('profileAvatarImg'); const avatarText = document.getElementById('profileAvatarText');
  if (avatarUrl) { avatarImg.src = avatarUrl; avatarImg.style.display = 'block'; avatarText.style.display = 'none'; } 
  else { avatarImg.style.display = 'none'; avatarText.style.display = 'flex'; avatarText.textContent = username.charAt(0).toUpperCase(); }
}

async function openProfileModal() {
  updateProfileModal(); profileModal.classList.add('open');
  document.getElementById('pStatTotalLists').textContent = state.lists.length; document.getElementById('pStatTotalItems').textContent = '...';
  const listIds = state.lists.map(l => l.id);
  if (listIds.length > 0) { const { count, error } = await supabaseClient.from('items').select('*', { count: 'exact', head: true }).in('list_id', listIds); if (!error) document.getElementById('pStatTotalItems').textContent = count || 0; else document.getElementById('pStatTotalItems').textContent = state.items.length; } 
  else document.getElementById('pStatTotalItems').textContent = 0;
}

function toggleProfileEdit(show) {
  document.getElementById('profileViewMode').classList.toggle('hidden', show); document.getElementById('profileEditMode').classList.toggle('hidden', !show);
  if (show) {
    document.getElementById('editUsername').value = state.userProfile.username;
    const preview = document.getElementById('editAvatarPreview'); const text = document.getElementById('editAvatarText');
    if (state.userProfile.avatar_url) { preview.src = state.userProfile.avatar_url; preview.style.display = 'block'; text.style.display = 'none'; } 
    else { preview.style.display = 'none'; text.style.display = 'flex'; text.textContent = state.userProfile.username.charAt(0).toUpperCase(); }
  }
}

function previewAvatar(event) {
  const file = event.target.files[0];
  if (file) { const reader = new FileReader(); reader.onload = function(e) { const preview = document.getElementById('editAvatarPreview'); const text = document.getElementById('editAvatarText'); preview.src = e.target.result; preview.style.display = 'block'; text.style.display = 'none'; }; reader.readAsDataURL(file); }
}

async function saveProfileChanges() {
  const newUsername = document.getElementById('editUsername').value.trim().toLowerCase(); const avatarFile = document.getElementById('avatarUpload').files[0]; const btn = document.getElementById('btn-save-profile');
  if (!newUsername) return showToast('O nome não pode ser vazio.', 'error');
  if (newUsername.includes(' ')) return showToast('O nome não pode ter espaços.', 'error');
  btn.textContent = 'Salvando...'; btn.disabled = true; let newAvatarUrl = state.userProfile.avatar_url;
  if (avatarFile) {
    const fileExt = avatarFile.name.split('.').pop(); const fileName = `${state.user.id}-${Math.random()}.${fileExt}`;
    const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, avatarFile);
    if (uploadError) { showToast('Erro imagem: ' + uploadError.message, 'error'); btn.textContent = 'Salvar'; btn.disabled = false; return; }
    const { data: publicUrlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName); newAvatarUrl = publicUrlData.publicUrl;
  }
  const { error } = await supabaseClient.from('profiles').update({ username: newUsername, avatar_url: newAvatarUrl }).eq('id', state.user.id);
  if (error) { showToast(error.message.includes('unique') ? 'Este nome já está em uso.' : 'Erro.', 'error'); } 
  else {
    showToast('Perfil atualizado!', 'success'); await fetchUserProfile();
    document.getElementById('user-info').innerHTML = `<div class="user-avatar">${state.userProfile?.avatar_url ? `<img src="${state.userProfile.avatar_url}" alt="Avatar">` : state.userProfile?.username?.charAt(0).toUpperCase()}</div><div class="user-email">@${state.userProfile?.username}</div>`;
    updateProfileModal(); toggleProfileEdit(false);
  }
  btn.textContent = 'Salvar'; btn.disabled = false;
}

// ============================================
// COMUNIDADE E PERFIS PÚBLICOS
// ============================================
window.switchSidebarTab = (tab) => {
  state.currentTab = tab;
  if (tab === 'my-lists') { state.isReadOnly = false; fetchLists(); }
  if (tab === 'activity') fetchActivities();
  
  document.getElementById('tab-my-lists').classList.toggle('active', tab === 'my-lists'); 
  document.getElementById('tab-community').classList.toggle('active', tab === 'community');
  document.getElementById('tab-activity').classList.toggle('active', tab === 'activity');
  
  document.getElementById('view-my-lists').classList.toggle('hidden', tab !== 'my-lists'); 
  document.getElementById('view-community').classList.toggle('hidden', tab !== 'community');
  document.getElementById('view-activity').classList.toggle('hidden', tab !== 'activity');
};

let communityTimeout;
communitySearch.addEventListener('input', (e) => {
  clearTimeout(communityTimeout); const query = e.target.value.trim().toLowerCase();
  if (query.length < 2) { communityResults.innerHTML = `<p class="community-hint">Digite pelo menos 2 letras.</p>`; return; }
  communityTimeout = setTimeout(async () => {
    communityResults.innerHTML = `<p class="community-hint">Buscando...</p>`;
    const { data, error } = await supabaseClient.from('profiles').select('*').ilike('username', `%${query}%`).neq('id', state.user.id).limit(5);
    if (error) { communityResults.innerHTML = `<p class="community-hint" style="color:var(--red)">Erro.</p>`; return; }
    if (data.length === 0) { communityResults.innerHTML = `<p class="community-hint">Nenhum usuário.</p>`; return; }
    communityResults.innerHTML = data.map(u => `<div class="user-card" onclick="openPublicProfile('${u.id}', '${u.username}', '${u.avatar_url || ''}')"><div class="user-card-avatar">${u.avatar_url ? `<img src="${u.avatar_url}">` : u.username.charAt(0).toUpperCase()}</div><div class="user-card-name">@${escapeHTML(u.username)}</div></div>`).join('');
  }, 500);
});

async function openPublicProfile(userId, username, avatarUrl) {
  state.viewingPublicUserId = userId;
  document.getElementById('pubProfileUsername').textContent = `@${username}`;
  const img = document.getElementById('pubProfileAvatarImg'); const text = document.getElementById('pubProfileAvatarText');
  if (avatarUrl) { img.src = avatarUrl; img.style.display = 'block'; text.style.display = 'none'; } 
  else { img.style.display = 'none'; text.style.display = 'flex'; text.textContent = username.charAt(0).toUpperCase(); }
  
  if (state.followingIds.has(userId)) {
    btnFollow.textContent = 'Seguindo';
    btnFollow.classList.remove('btn-primary');
    btnFollow.classList.add('btn-ghost');
  } else {
    btnFollow.textContent = 'Seguir';
    btnFollow.classList.remove('btn-ghost');
    btnFollow.classList.add('btn-primary');
  }
  btnFollow.classList.remove('hidden');

  const container = document.getElementById('publicListsContainer'); container.innerHTML = `<p style="color:var(--text-2); font-size:13px; text-align:center;">Buscando...</p>`;
  publicProfileModal.classList.add('open');
  
  const { data: lists } = await supabaseClient.from('lists').select('*').eq('user_id', userId).eq('is_public', true);
  if (lists && lists.length > 0) {
    container.innerHTML = lists.map(l => `<div class="public-list-item" onclick="viewPublicList('${l.id}', '${l.name}', '${username}')"><span class="public-list-name">${escapeHTML(l.name)}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></div>`).join('');
  } else { container.innerHTML = `<p style="color:var(--text-2); font-size:13px; text-align:center;">Nenhuma lista pública.</p>`; }
}

window.viewPublicList = async (listId, listName, username) => {
  publicProfileModal.classList.remove('open'); state.activeListId = listId; state.isReadOnly = true;
  document.getElementById('active-list-name').textContent = listName; document.getElementById('active-list-desc').textContent = `Visualizando lista de @${username} (Leitura)`;
  addBtn.classList.add('hidden'); membersBtn.classList.add('hidden'); discoverBtn.classList.add('hidden'); internalSearchContainer.classList.remove('hidden'); filtersEl.style.display = 'flex';
  searchInternal.value = ''; state.searchFilterText = ''; renderSidebar(); await fetchItems();
};

// ============================================
// MIGRAÇÃO DE DADOS
// ============================================
async function checkMigration() {
  const oldData = localStorage.getItem('watchlist-v1');
  if (oldData) {
    try {
      const items = JSON.parse(oldData);
      if (items && items.length > 0) {
        const confirmMigrate = confirm("Encontramos títulos salvos neste navegador. Deseja importá-los?");
        if (confirmMigrate) {
          const { data: newList, error: listErr } = await supabaseClient.from('lists').insert({ user_id: state.user.id, name: 'Minha Lista Antiga', description: 'Importada', is_public: false }).select().single();
          if (!listErr && newList) {
            for (const i of items) {
              const { data: newItem } = await supabaseClient.from('items').insert({ list_id: newList.id, title: i.title, type: i.type, status: i.status, season: i.season || 0, episode: i.episode || 0, tmdb_id: i.tmdbId || null, poster_path: i.posterPath || null, genre_ids: [] }).select().single();
              if (newItem) await supabaseClient.from('item_reviews').insert({ item_id: newItem.id, user_id: state.user.id, rating: i.rating || 0, note: i.note || '' });
            }
            localStorage.removeItem('watchlist-v1'); showToast('Dados importados!', 'success');
          }
        } else { localStorage.removeItem('watchlist-v1'); }
      }
    } catch (e) { console.error(e); }
  }
}

// ============================================
// LISTAS (SIDEBAR)
// ============================================
async function fetchLists() {
  const { data: ownedLists, error: ownedErr } = await supabaseClient.from('lists').select('*').eq('user_id', state.user.id);
  const { data: collabData, error: collabErr } = await supabaseClient.from('list_collaborators').select('list_id, role').eq('user_id', state.user.id);
  if (ownedErr || collabErr) return showToast('Erro ao carregar listas', 'error');
  let lists = ownedLists || [];
  if (collabData && collabData.length > 0) {
    const collabIds = collabData.map(c => c.list_id);
    const { data: sharedLists } = await supabaseClient.from('lists').select('*').in('id', collabIds);
    if (sharedLists) { sharedLists.forEach(sl => { sl.is_shared = true; const info = collabData.find(c => c.list_id === sl.id); sl.my_role = info ? info.role : 'member'; lists.push(sl); }); }
  }
  state.lists = lists; renderSidebar();
  if (!state.activeListId && state.lists.length > 0 && !state.isReadOnly) { selectList(state.lists[0].id); } 
  else if (state.lists.length === 0) {
    state.activeListId = null; activeListName.textContent = 'Nenhuma lista'; activeListDesc.textContent = 'Crie ou entre em uma lista para começar.';
    addBtn.classList.add('hidden'); membersBtn.classList.add('hidden'); discoverBtn.classList.add('hidden'); internalSearchContainer.classList.add('hidden');
    gridEl.innerHTML = `<div class="empty"><div class="empty-icon">📂</div><h3>Você ainda não tem listas</h3><p>Crie uma lista ou use um código de convite.</p></div>`;
    statsEl.innerHTML = ''; filtersEl.style.display = 'none';
  } else { const listExists = state.lists.find(l => l.id === state.activeListId); if (!listExists && !state.isReadOnly) selectList(state.lists[0].id); }
}

function renderSidebar() {
  listsContainer.innerHTML = state.lists.map(list => {
    const isOwner = list.user_id === state.user.id; const isAdmin = list.my_role === 'admin'; const canManage = isOwner || isAdmin;
    let shareBtn = canManage ? `<button class="icon-btn list-action-share" onclick="event.stopPropagation(); openShareModal('${list.id}')" title="Compartilhar">${icons.users}</button>` : `<div class="collab-badge" title="Colaborador">${icons.users}</div>`;
    return `
    <div class="list-item ${list.id === state.activeListId && !state.isReadOnly ? 'active' : ''}" onclick="selectList('${list.id}')">
      <div class="list-info"><div style="display: flex; align-items: center;"><span class="list-name">${escapeHTML(list.name)}</span>${!canManage ? shareBtn : ''}</div><span class="list-meta">${list.is_public ? 'Pública 🔓' : 'Privada 🔒'}</span></div>
      <div class="list-actions">${isOwner ? `<button class="icon-btn" onclick="togglePrivacy(event, '${list.id}', ${list.is_public})">${list.is_public ? icons.unlock : icons.lock}</button>` : ''}${canManage ? shareBtn : ''}${canManage ? `<button class="icon-btn" onclick="event.stopPropagation(); deleteList('${list.id}')" style="color:var(--red);">${icons.trash}</button>` : ''}</div>
    </div>`;
  }).join('');
}

window.selectList = async (id) => {
  state.activeListId = id; state.isReadOnly = false;
  state.genreFilter = 'all'; filterGenreText.textContent = 'Todos os Gêneros';
  const list = state.lists.find(l => l.id === id); if (!list) return;
  gridEl.innerHTML = `<div style="color:var(--text-2); text-align:center; width:100%; grid-column: 1/-1; padding: 60px 0;">Carregando...</div>`;
  statsEl.innerHTML = ''; activeListName.textContent = list.name;
  activeListDesc.textContent = list.is_public ? 'Lista pública' : 'Lista privada';
  addBtn.classList.remove('hidden'); membersBtn.classList.remove('hidden'); discoverBtn.classList.remove('hidden'); internalSearchContainer.classList.remove('hidden');
  filtersEl.style.display = 'flex'; renderSidebar(); searchInternal.value = ''; state.searchFilterText = '';
  await fetchItems(); setupRealtime(id);
  if (state.currentTab === 'activity') fetchActivities();
};

window.togglePrivacy = async (e, id, currentStatus) => {
  e.stopPropagation();
  const { error } = await supabaseClient.from('lists').update({ is_public: !currentStatus }).eq('id', id);
  if (!error) { showToast(`Lista agora é ${!currentStatus ? 'Pública' : 'Privada'}`, 'info'); await fetchLists(); }
};

document.getElementById('btn-create-list').addEventListener('click', () => { document.getElementById('listForm').reset(); document.getElementById('listModal').classList.add('open'); });

document.getElementById('listForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const name = document.getElementById('listName').value; const isPublic = document.getElementById('listPublic').checked;
  const btn = e.target.querySelector('button[type="submit"]'); btn.textContent = 'Criando...';
  const { data, error } = await supabaseClient.from('lists').insert({ user_id: state.user.id, name, is_public: isPublic }).select().single();
  if (error) { showToast('Erro ao criar lista', 'error'); btn.textContent = 'Criar Lista'; return; }
  document.getElementById('listModal').classList.remove('open'); showToast('Lista criada!', 'success');
  state.activeListId = data.id; state.isReadOnly = false; await fetchLists(); setupRealtime(data.id);
  await logActivity(`criou a lista "${name}"`);
});

// ============================================
// ITENS (FILMES/SÉRIES)
// ============================================
async function fetchItems() {
  if (!state.activeListId) return;
  const { data, error } = await supabaseClient.from('items').select(`*, item_reviews (*, profiles ( username, avatar_url ))`).eq('list_id', state.activeListId).order('created_at', { ascending: false });
  if (error) return showToast('Erro ao carregar itens', 'error');
  state.items = data || []; 
  
  if (state.items.length > 0 && !state.isReadOnly) populateFilterGenres();
  
  render();
}

function render() { renderStats(); renderFilterCounts(); renderGrid(); }

function renderStats() {
  const total = state.items.length; const want = state.items.filter(i => i.status === 'want').length;
  const watching = state.items.filter(i => i.status === 'watching').length; const watched = state.items.filter(i => i.status === 'watched').length;
  statsEl.innerHTML = `
    <div class="stat"><div class="stat-top"><div class="stat-icon">${icons.layers}</div></div><span class="stat-num">${total}</span><span class="stat-label">Total</span></div>
    <div class="stat"><div class="stat-top"><div class="stat-icon blue">${icons.bookmark}</div></div><span class="stat-num">${want}</span><span class="stat-label">Quero ver</span></div>
    <div class="stat"><div class="stat-top"><div class="stat-icon amber">${icons.play}</div></div><span class="stat-num">${watching}</span><span class="stat-label">Assistindo</span></div>
    <div class="stat"><div class="stat-top"><div class="stat-icon green">${icons.check}</div></div><span class="stat-num">${watched}</span><span class="stat-label">Já vi</span></div>`;
}

function renderFilterCounts() {
  const counts = { all: state.items.length, want: state.items.filter(i => i.status === 'want').length, watching: state.items.filter(i => i.status === 'watching').length, watched: state.items.filter(i => i.status === 'watched').length };
  filtersEl.querySelectorAll('[data-count]').forEach(el => { el.textContent = counts[el.dataset.count] || 0; });
}

function createSingleCardHTML(item) {
  const isReadOnly = state.isReadOnly;
  const clickAttr = isReadOnly ? `onclick="viewItemDetails('${item.id}')"` : `onclick="editItem('${item.id}')"`;
  const deleteBtn = isReadOnly ? '' : `<button class="icon-btn" onclick="event.stopPropagation(); deleteItem('${item.id}')" style="padding:4px; color:#fff; background:rgba(0,0,0,0.5); border-radius:50%; backdrop-filter:blur(4px);">${icons.trash}</button>`;
  const progressControls = isReadOnly ? '' : `<div class="ep-controls"><button class="ep-btn" onclick="event.stopPropagation(); changeEp('${item.id}', -1)">−</button><button class="ep-btn" onclick="event.stopPropagation(); changeEp('${item.id}', 1)">+</button></div>`;
  const myReview = item.item_reviews ? item.item_reviews.find(r => r.user_id === state.user.id) : null;
  const myRating = myReview ? myReview.rating : 0; const myNote = myReview ? myReview.note : '';
  let starsHTML = '';
  if (myRating > 0) { starsHTML = `<div class="card-stars">`; for (let i = 1; i <= 5; i++) { if (i <= myRating) starsHTML += icons.star; } starsHTML += `</div>`; }
  return `
    <div class="card" data-id="${item.id}" ${clickAttr}>
      ${item.poster_path ? `<img class="card-poster" src="${TMDB_IMG}${item.poster_path}" alt="${escapeHTML(item.title)}" loading="lazy" />` : `<div class="card-poster-placeholder">${item.type === 'series' ? '📺' : '🎬'}</div>`}
      <div class="card-overlay">
        <div class="card-top"><div class="badges"><span class="badge type">${item.type === 'series' ? 'Série' : 'Filme'}</span><span class="badge status-${item.status}">${statusLabel(item.status)}</span></div>${deleteBtn}</div>
        <h3 class="card-title">${escapeHTML(item.title)}</h3>${starsHTML}${myNote ? `<p class="card-note">"${escapeHTML(myNote)}"</p>` : ''}
        ${item.type === 'series' && item.status === 'watching' ? `<div class="progress-box" style="${isReadOnly ? 'justify-content:center;' : ''}"><div class="progress-info">T${item.season || 1} · E${item.episode || 0}</div>${progressControls}</div>` : ''}
        ${item.type === 'series' && item.status === 'watched' && item.episode ? `<div class="progress-box done" style="justify-content:center; color:var(--green);">✓ T${item.season || 1} E${item.episode}</div>` : ''}
      </div>
    </div>`;
}

function getAvgRating(item) {
  if (!item.item_reviews || item.item_reviews.length === 0) return 0;
  const sum = item.item_reviews.reduce((acc, rev) => acc + (rev.rating || 0), 0);
  return sum / item.item_reviews.length;
}

function renderGrid() {
  let filtered = state.filter === 'all' ? [...state.items] : state.items.filter(i => i.status === state.filter);
  
  if (state.searchFilterText) { 
    const query = state.searchFilterText.toLowerCase(); 
    filtered = filtered.filter(i => i.title.toLowerCase().includes(query)); 
  }

  if (state.genreFilter !== 'all') {
    filtered = filtered.filter(i => {
      let gIds = i.genre_ids;
      if (typeof gIds === 'string') { try { gIds = JSON.parse(gIds); } catch(e) { gIds = []; } }
      return Array.isArray(gIds) && gIds.includes(parseInt(state.genreFilter));
    });
  }

  if (filtered.length === 0) {
    gridEl.innerHTML = `<div class="empty"><div class="empty-icon">${state.items.length === 0 ? '🍿' : '🔍'}</div><h3>${state.items.length === 0 ? 'Lista vazia' : 'Nada encontrado'}</h3><p>${state.items.length === 0 ? 'Adicione um filme ou série clicando em "Adicionar".' : 'Tente buscar por outro nome, mudar o filtro ou o gênero.'}</p></div>`;
    return;
  }

  const order = { watching: 0, want: 1, watched: 2 }; 
  filtered.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (state.sortOrder === 'az') {
      return a.title.localeCompare(b.title);
    } else if (state.sortOrder === 'rating') {
      const ratA = getAvgRating(a); const ratB = getAvgRating(b);
      if (ratA !== ratB) return ratB - ratA;
      return new Date(b.created_at) - new Date(a.created_at); 
    } else {
      return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  const currentIds = Array.from(gridEl.querySelectorAll('.card')).map(c => c.dataset.id).join(','); const newIds = filtered.map(i => i.id).join(',');
  if (currentIds !== newIds) { gridEl.innerHTML = filtered.map(item => createSingleCardHTML(item)).join(''); return; }
  
  filtered.forEach(item => {
    const cardEl = gridEl.querySelector(`.card[data-id="${item.id}"]`);
    if (cardEl) {
      const tempDiv = document.createElement('div'); tempDiv.innerHTML = createSingleCardHTML(item); const newCard = tempDiv.firstElementChild;
      const oldImg = cardEl.querySelector('.card-poster'); const newImg = newCard.querySelector('.card-poster');
      if (oldImg && newImg) newImg.src = oldImg.src;
      cardEl.innerHTML = newCard.innerHTML; cardEl.className = newCard.className;
    }
  });
}

searchInternal.addEventListener('input', (e) => { state.searchFilterText = e.target.value; renderGrid(); });

// ============================================
// FUNÇÕES DE MANIPULAÇÃO DE ITENS
// ============================================
window.deleteItem = (id) => {
  const item = state.items.find(i => i.id === id);
  openConfirm({
    title: 'Remover item?', text: 'Tem certeza que deseja remover este título da lista?', confirmLabel: 'Remover',
    onConfirm: async () => {
      state.isLocalAction = true;
      const { error } = await supabaseClient.from('items').delete().eq('id', id);
      if (!error) { 
        state.items = state.items.filter(i => i.id !== id); 
        render(); showToast('Item removido', 'error'); 
        await logActivity(`removeu "${item.title}" da lista`);
      }
      setTimeout(() => { state.isLocalAction = false; }, 1000);
    }
  });
};

window.changeEp = async (id, delta) => {
  const item = state.items.find(i => i.id === id); if (!item || !item.tmdb_id) return;
  if (state.processingEp.has(id)) return;
  state.processingEp.add(id);

  const cardEl = document.querySelector(`.card[data-id="${id}"]`);
  let btnEl = null;
  if (cardEl) {
    const btns = cardEl.querySelectorAll('.ep-btn');
    btnEl = delta > 0 ? btns[1] : btns[0];
    if (btnEl) btnEl.style.opacity = '0.4';
  }

  let newSeason = item.season || 1; let newEp = (item.episode || 0) + delta; let newStatus = item.status;
  
  try {
    const seasons = await getTvSeasons(item.tmdb_id);
    if (delta > 0) {
      const currentSeasonData = seasons.find(s => s.season_number === newSeason);
      const maxEpisodes = currentSeasonData ? currentSeasonData.episode_count : 999;
      if (newEp > maxEpisodes) {
        const nextSeason = seasons.find(s => s.season_number === newSeason + 1);
        if (nextSeason) { newSeason = nextSeason.season_number; newEp = 1; showToast(`Avançou para T${newSeason}!`, 'success'); }
        else { newStatus = 'watched'; newEp = maxEpisodes; showToast(`"${item.title}" concluído!`, 'success'); }
      }
    } else {
      if (newEp < 1) {
        const prevSeason = seasons.find(s => s.season_number === newSeason - 1);
        if (prevSeason) { newSeason = prevSeason.season_number; newEp = prevSeason.episode_count; showToast(`Voltou para T${newSeason}`, 'info'); }
        else { newEp = 1; }
      }
    }
    
    const oldSeason = item.season; const oldEp = item.episode;
    
    item.season = newSeason; item.episode = newEp; item.status = newStatus; render();
    state.isLocalAction = true;
    await supabaseClient.from('items').update({ season: newSeason, episode: newEp, status: newStatus }).eq('id', id);
    setTimeout(() => { state.isLocalAction = false; }, 1000);
    
    if (newStatus === 'watched' && item.status !== 'watched') {
       await logActivity(`marcou "${item.title}" como concluído`);
    } else if (newSeason !== oldSeason) {
       await logActivity(`avançou para a Temporada ${newSeason} de "${item.title}"`);
    }
    
  } catch (err) { console.error(err); } 
  finally {
    state.processingEp.delete(id);
    if (btnEl) btnEl.style.opacity = '1';
  }
};

filtersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter'); if (!btn) return;
  state.filter = btn.dataset.filter; filtersEl.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b === btn)); renderGrid();
});

// ============================================
// TMDB E CACHE LOCAL
// ============================================
async function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`); url.searchParams.set('api_key', TMDB_API_KEY); url.searchParams.set('language', 'pt-BR');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString()); if (!res.ok) throw new Error(`TMDB error: ${res.status}`); return res.json();
}

async function searchTMDB(query) {
  if (!query.trim()) { searchDropdown.innerHTML = `<div class="search-empty">Digite algo acima...</div>`; return; }
  searchSpinner.classList.add('active'); searchDropdown.classList.add('open');
  try {
    const data = await tmdbFetch('/search/multi', { query, include_adult: false });
    const filtered = (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv'); renderSearchResults(filtered);
  } catch (err) { searchDropdown.innerHTML = `<div class="search-empty">Erro ao buscar.</div>`; } finally { searchSpinner.classList.remove('active'); }
}

function renderSearchResults(results) {
  if (!results.length) { searchDropdown.innerHTML = `<div class="search-empty">Nenhum resultado.</div>`; return; }
  searchDropdown.innerHTML = results.slice(0, 8).map(r => {
    const title = r.title || r.name || 'Sem título'; const year = (r.release_date || r.first_air_date || '').slice(0, 4);
    const typeLabel = r.media_type === 'tv' ? 'Série' : 'Filme'; const poster = r.poster_path ? `${TMDB_IMG}${r.poster_path}` : '';
    const genreIdsStr = r.genre_ids ? JSON.stringify(r.genre_ids) : '[]';
    return `<div class="search-result" data-tmdb-id="${r.id}" data-media-type="${r.media_type}" data-poster="${r.poster_path || ''}" data-title="${escapeHTML(title)}" data-genres="${genreIdsStr}">${poster ? `<img class="search-result-poster" src="${poster}" alt="" loading="lazy" />` : `<div class="search-result-poster"></div>`}<div class="search-result-info"><div class="search-result-title">${escapeHTML(title)}</div><div class="search-result-meta">${year ? year + ' · ' : ''}${typeLabel}</div></div></div>`;
  }).join('');

  searchDropdown.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', async () => {
      const tmdbId = el.dataset.tmdbId; const mediaType = el.dataset.mediaType; const posterPath = el.dataset.poster; const title = el.dataset.title;
      const genreIds = el.dataset.genres || '[]';
      
      state.selectedResult = { tmdbId, mediaType, posterPath, title, genreIds };
      
      document.getElementById('title').value = title; 
      document.getElementById('tmdbId').value = tmdbId; 
      document.getElementById('posterPath').value = posterPath;
      document.getElementById('genreIds').value = genreIds;
      document.getElementById('type').value = mediaType === 'tv' ? 'series' : 'movie';
      searchInput.value = title; searchDropdown.classList.remove('open'); saveBtn.disabled = false; posterPlaceholder.style.display = 'none';
      if (posterPath) { largePoster.src = `${TMDB_IMG}${posterPath}`; largePoster.style.display = 'block'; posterBg.style.backgroundImage = `url(${TMDB_IMG}${posterPath})`; } 
      else { largePoster.style.display = 'none'; posterPlaceholder.style.display = 'flex'; posterBg.style.backgroundImage = 'none'; }
      if (mediaType === 'tv') await loadSeasons(tmdbId); updateProgressVisibility();
      
      renderGenreTags(editGenresDisplay, genreIds);
    });
  });
}

function updateProgressVisibility() {
  const type = document.getElementById('type').value; const status = document.getElementById('status').value;
  document.getElementById('progressFields').style.display = (type === 'series' && status === 'watching') ? 'grid' : 'none';
}

async function getTvSeasons(tvId) {
  const cacheKey = `tv_${tvId}`; 
  if (state.seasonsCache[cacheKey]) return state.seasonsCache[cacheKey];
  const lsCache = localStorage.getItem(cacheKey);
  if (lsCache) { try { const parsed = JSON.parse(lsCache); state.seasonsCache[cacheKey] = parsed; return parsed; } catch (e) {} }
  const data = await tmdbFetch(`/tv/${tvId}`); const seasons = (data.seasons || []).filter(s => s.season_number > 0);
  state.seasonsCache[cacheKey] = seasons; localStorage.setItem(cacheKey, JSON.stringify(seasons)); return seasons;
}

async function loadSeasons(tvId) { try { const seasons = await getTvSeasons(tvId); populateSeasonSelect(seasons); } catch (err) { console.error(err); } }

function populateSeasonSelect(seasons) {
  seasonOptions.innerHTML = seasons.map(s => `<div class="custom-option" data-value="${s.season_number}">Temporada ${s.season_number} (${s.episode_count} eps)</div>`).join('');
  if (seasons[0]) selectSeason(seasons[0].season_number, seasons[0].episode_count);
}

seasonOptions.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-option'); if (!opt) return;
  const seasonNum = parseInt(opt.dataset.value); const tvId = state.selectedResult?.tmdbId;
  const seasons = state.seasonsCache[`tv_${tvId}`] || []; const seasonData = seasons.find(s => s.season_number === seasonNum);
  selectSeason(seasonNum, seasonData ? seasonData.episode_count : 0);
  document.querySelectorAll('.custom-options').forEach(opt => opt.classList.remove('open')); document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
});

function selectSeason(seasonNum, episodeCount) {
  seasonInput.value = seasonNum; seasonText.textContent = `T${seasonNum} (${episodeCount} eps)`;
  seasonOptions.querySelectorAll('.custom-option').forEach(o => o.classList.toggle('selected', parseInt(o.dataset.value) === seasonNum)); loadEpisodes(seasonNum);
}

async function loadEpisodes(seasonNumber) {
  const tvId = state.selectedResult?.tmdbId; if (!tvId) return;
  const cacheKey = `tv_${tvId}_s${seasonNumber}`;
  if (state.episodesCache[cacheKey]) return populateEpisodeSelect(state.episodesCache[cacheKey]);
  const lsCache = localStorage.getItem(cacheKey);
  if (lsCache) { try { const parsed = JSON.parse(lsCache); state.episodesCache[cacheKey] = parsed; return populateEpisodeSelect(parsed); } catch(e) {} }
  episodeOptions.innerHTML = `<div class="custom-option">Carregando episódios...</div>`;
  try {
    const data = await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`); const episodes = data.episodes || [];
    state.episodesCache[cacheKey] = episodes; localStorage.setItem(cacheKey, JSON.stringify(episodes));
    populateEpisodeSelect(episodes);
  } catch (err) { episodeOptions.innerHTML = `<div class="custom-option">Erro ao carregar.</div>`; }
}

function populateEpisodeSelect(episodes) {
  episodeOptions.innerHTML = episodes.map(e => `<div class="custom-option" data-value="${e.episode_number}">Ep. ${e.episode_number} — ${escapeHTML(e.name)}</div>`).join('');
  if (episodes[0]) selectEpisode(episodes[0].episode_number, episodes[0].name);
}

episodeOptions.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-option'); if (!opt || !opt.dataset.value) return;
  const epNum = parseInt(opt.dataset.value); const tvId = state.selectedResult?.tmdbId; const currentSeason = parseInt(seasonInput.value);
  const episodes = state.episodesCache[`tv_${tvId}_s${currentSeason}`] || []; const epData = episodes.find(ep => ep.episode_number === epNum);
  selectEpisode(epNum, epData ? epData.name : ''); document.querySelectorAll('.custom-options').forEach(opt => opt.classList.remove('open')); document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
});

function selectEpisode(epNum, epName) {
  episodeInput.value = epNum; const fullText = `Ep. ${epNum} — ${epName}`; episodeText.textContent = fullText; episodeContainer.setAttribute('data-tooltip', fullText);
  episodeOptions.querySelectorAll('.custom-option').forEach(o => o.classList.toggle('selected', parseInt(o.dataset.value) === epNum));
}

function toggleDropdown(triggerEl, optionsEl, containerEl) {
  const isOpen = optionsEl.classList.contains('open'); 
  document.querySelectorAll('.custom-options').forEach(opt => opt.classList.remove('open')); 
  document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
  if (isOpen) return; containerEl.classList.add('open'); optionsEl.classList.add('open');
  const rect = triggerEl.getBoundingClientRect();
  
  if (window.innerWidth <= 900) {
    optionsEl.style.left = '20px'; optionsEl.style.width = 'calc(100vw - 40px)';
    if (rect.bottom + 250 > window.innerHeight) { optionsEl.style.bottom = `${window.innerHeight - rect.top + 4}px`; optionsEl.style.top = 'auto'; } 
    else { optionsEl.style.top = `${rect.bottom + 4}px`; optionsEl.style.bottom = 'auto'; }
  } else {
    optionsEl.style.left = `${rect.left}px`; 
    if (optionsEl.id === 'seasonOptions' || optionsEl.id === 'filterGenreOptions' || optionsEl.id === 'sortOrderOptions' || optionsEl.id === 'rouletteGenreOptions' || optionsEl.id === 'rouletteTypeOptions') {
      optionsEl.style.width = `${rect.width}px`;
    } else {
      optionsEl.style.width = `${rect.width}px`;
    }
    if (rect.bottom + 250 > window.innerHeight) { optionsEl.style.bottom = `${window.innerHeight - rect.top + 4}px`; optionsEl.style.top = 'auto'; } 
    else { optionsEl.style.top = `${rect.bottom + 4}px`; optionsEl.style.bottom = 'auto'; }
  }
  const selected = optionsEl.querySelector('.custom-option.selected');
  if (selected) optionsEl.scrollTop = selected.offsetTop - optionsEl.clientHeight / 2 + selected.clientHeight / 2;
}

seasonTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(seasonTrigger, seasonOptions, seasonContainer); });
episodeTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(episodeTrigger, episodeOptions, episodeContainer); });
filterGenreTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(filterGenreTrigger, filterGenreOptions, filterGenreContainer); });
sortOrderTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(sortOrderTrigger, sortOrderOptions, sortOrderContainer); });

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-container') && !e.target.closest('.custom-options')) {
    document.querySelectorAll('.custom-options').forEach(opt => opt.classList.remove('open')); 
    document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
  }
  if (!e.target.closest('.search-field')) searchDropdown.classList.remove('open');
});

window.addEventListener('scroll', (e) => {
  if (e.target.classList && e.target.classList.contains('custom-options')) return;
  document.querySelectorAll('.custom-options').forEach(opt => opt.classList.remove('open'));
  document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
}, true);

const formCol = document.querySelector('.form-col');
if (formCol) formCol.addEventListener('scroll', (e) => { 
  if (e.target.classList && e.target.classList.contains('custom-options')) return;
  document.querySelectorAll('.custom-options').forEach(opt => opt.classList.remove('open')); 
  document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open')); 
});

window.editItem = (id) => {
  if (state.isReadOnly) return;
  const item = state.items.find(i => i.id === id); if (!item) return;
  document.getElementById('itemId').value = item.id; modalTitle.textContent = 'Editar título'; searchInput.value = item.title; document.getElementById('title').value = item.title;
  document.getElementById('tmdbId').value = item.tmdb_id || ''; document.getElementById('posterPath').value = item.poster_path || ''; document.getElementById('type').value = item.type; setSegmented('status', item.status);
  
  let gIds = item.genre_ids || '[]';
  if (typeof gIds !== 'string') gIds = JSON.stringify(gIds);
  document.getElementById('genreIds').value = gIds;
  
  renderGenreTags(editGenresDisplay, gIds);

  const myReview = item.item_reviews.find(r => r.user_id === state.user.id); setRating(myReview ? myReview.rating : 0); document.getElementById('note').value = myReview ? myReview.note : '';
  const others = item.item_reviews.filter(r => r.user_id !== state.user.id);
  const otherContainer = document.getElementById('otherReviewsContainer'); const otherList = document.getElementById('otherReviewsList');
  let reviewsHTML = others.map(r => `<div class="review-card" style="padding: 8px; margin-bottom: 0;"><div class="review-header" style="margin-bottom: 4px;"><div class="review-avatar" style="width:20px;height:20px;font-size:10px;">${r.profiles?.avatar_url ? `<img src="${r.profiles.avatar_url}">` : r.profiles?.username?.charAt(0).toUpperCase()}</div><span class="review-user" style="font-size:11px;">@${r.profiles?.username}</span><div class="card-stars" style="margin-left:auto;">${Array(5).fill(0).map((_, i) => `<svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:${i < r.rating ? 'var(--amber)' : 'rgba(255,255,255,0.1)'};"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join('')}</div></div><p class="review-note" style="font-size:11px;">${r.note ? `"${escapeHTML(r.note)}"` : 'Sem comentário.'}</p></div>`).join('');
  const myInitialHTML = `<div class="review-card" style="padding: 8px; margin-bottom: 0; border-color: rgba(139,92,246,0.3);"><div class="review-header" style="margin-bottom: 4px;"><div class="review-avatar" style="width:20px;height:20px;font-size:10px;">${state.userProfile?.avatar_url ? `<img src="${state.userProfile.avatar_url}">` : state.userProfile?.username?.charAt(0).toUpperCase()}</div><span class="review-user" style="font-size:11px;">@${state.userProfile?.username} (Você)</span><div class="card-stars" id="myLiveStars" style="margin-left:auto;">${Array(5).fill(0).map((_, i) => `<svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:${i < (myReview?.rating || 0) ? 'var(--amber)' : 'rgba(255,255,255,0.1)'};"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join('')}</div></div><p class="review-note" id="myLiveNote" style="font-size:11px;">${myReview?.note ? `"${escapeHTML(myReview.note)}"` : 'Sem comentário.'}</p></div>`;
  if (others.length > 0 || myReview) { otherContainer.style.display = 'block'; otherList.innerHTML = myInitialHTML + reviewsHTML; } else { otherContainer.style.display = 'none'; }
  saveBtn.disabled = false; posterPlaceholder.style.display = 'none';
  if (item.poster_path) { largePoster.src = `${TMDB_IMG}${item.poster_path}`; largePoster.style.display = 'block'; posterBg.style.backgroundImage = `url(${TMDB_IMG}${item.poster_path})`; } 
  else { largePoster.style.display = 'none'; posterPlaceholder.style.display = 'flex'; posterBg.style.backgroundImage = 'none'; }
  if (item.type === 'series' && item.tmdb_id) {
    state.selectedResult = { tmdbId: item.tmdb_id, mediaType: 'tv', posterPath: item.poster_path, title: item.title };
    loadSeasons(item.tmdb_id).then(() => { const targetSeason = item.season || 1; const sData = state.seasonsCache[`tv_${item.tmdb_id}`].find(s => s.season_number === targetSeason); selectSeason(targetSeason, sData ? sData.episode_count : 0); loadEpisodes(targetSeason).then(() => { const targetEp = item.episode || 1; const epData = state.episodesCache[`tv_${item.tmdb_id}_s${targetSeason}`]?.find(e => e.episode_number === targetEp); if (epData) selectEpisode(targetEp, epData.name); }); });
  }
  updateProgressVisibility(); modal.classList.add('open');
};

addBtn.addEventListener('click', () => {
  form.reset(); document.getElementById('itemId').value = ''; document.getElementById('genreIds').value = '[]'; document.getElementById('type').value = 'movie'; document.getElementById('progressFields').style.display = 'none'; searchInput.value = '';
  editGenresDisplay.innerHTML = ''; editGenresDisplay.style.display = 'none'; 
  searchDropdown.innerHTML = `<div class="search-empty">Digite para buscar...</div>`; state.selectedResult = null; saveBtn.disabled = true;
  posterPlaceholder.style.display = 'flex'; largePoster.style.display = 'none'; largePoster.src = ''; posterBg.style.backgroundImage = 'none';
  seasonOptions.innerHTML = ''; episodeOptions.innerHTML = ''; seasonText.textContent = 'Selecione...'; episodeText.textContent = 'Selecione...';
  episodeContainer.setAttribute('data-tooltip', ''); seasonInput.value = '1'; episodeInput.value = '1'; setRating(0);
  const otherContainer = document.getElementById('otherReviewsContainer'); const otherList = document.getElementById('otherReviewsList');
  otherList.innerHTML = `<div class="review-card" style="padding: 8px; margin-bottom: 0; border-color: rgba(139,92,246,0.3);"><div class="review-header" style="margin-bottom: 4px;"><div class="review-avatar" style="width:20px;height:20px;font-size:10px;">${state.userProfile?.avatar_url ? `<img src="${state.userProfile.avatar_url}">` : state.userProfile?.username?.charAt(0).toUpperCase()}</div><span class="review-user" style="font-size:11px;">@${state.userProfile?.username} (Você)</span><div class="card-stars" id="myLiveStars" style="margin-left:auto;">${Array(5).fill(0).map((_, i) => `<svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:rgba(255,255,255,0.1);"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join('')}</div></div><p class="review-note" id="myLiveNote" style="font-size:11px;">Sem comentário.</p></div>`;
  otherContainer.style.display = 'block'; modalTitle.textContent = 'Adicionar título'; setSegmented('status', 'want'); updateProgressVisibility(); modal.classList.add('open');
});

document.getElementById('closeModal').addEventListener('click', () => modal.classList.remove('open'));
document.getElementById('cancelBtn').addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
viewItemModal.addEventListener('click', (e) => { if (e.target === viewItemModal) viewItemModal.classList.remove('open'); });
shareModal.addEventListener('click', (e) => { if (e.target === shareModal) shareModal.classList.remove('open'); });
joinListModal.addEventListener('click', (e) => { if (e.target === joinListModal) joinListModal.classList.remove('open'); });
membersModal.addEventListener('click', (e) => { if (e.target === membersModal) membersModal.classList.remove('open'); });
discoverModal.addEventListener('click', (e) => { if (e.target === discoverModal) { discoverModal.classList.remove('open'); if (state.rouletteInterval) clearInterval(state.rouletteInterval); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { modal.classList.remove('open'); viewItemModal.classList.remove('open'); shareModal.classList.remove('open'); joinListModal.classList.remove('open'); membersModal.classList.remove('open'); discoverModal.classList.remove('open'); closeConfirm(); profileModal.classList.remove('open'); publicProfileModal.classList.remove('open'); if (state.rouletteInterval) clearInterval(state.rouletteInterval); } });

form.addEventListener('submit', async (e) => {
  e.preventDefault(); const id = document.getElementById('itemId').value; const title = document.getElementById('title').value.trim();
  if (!title) return showToast('Selecione um título na busca', 'error');
  const status = document.getElementById('status').value; const type = document.getElementById('type').value;
  const rating = parseInt(ratingInput.value) || 0; const note = document.getElementById('note').value.trim();
  
  let genreIds = [];
  try { genreIds = JSON.parse(document.getElementById('genreIds').value || '[]'); } catch(err) {}

  saveBtn.textContent = 'Salvando...'; saveBtn.disabled = true; state.isLocalAction = true;
  
  if (id) {
    const { error } = await supabaseClient.from('items').update({ status: status, season: (type === 'series' && status === 'watching') ? parseInt(seasonInput.value) || 1 : 0, episode: (type === 'series' && status === 'watching') ? parseInt(episodeInput.value) || 1 : 0, genre_ids: genreIds }).eq('id', id);
    if (error) showToast('Erro ao atualizar item', 'error');
    const myReview = state.items.find(i => i.id === id)?.item_reviews.find(r => r.user_id === state.user.id);
    if (myReview) await supabaseClient.from('item_reviews').update({ rating, note }).eq('id', myReview.id);
    else await supabaseClient.from('item_reviews').insert({ item_id: id, user_id: state.user.id, rating, note });
    
    showToast('Título atualizado', 'success');
    await logActivity(`atualizou as informações de "${title}"`);
  } else {
    const { data: newItem, error } = await supabaseClient.from('items').insert({ list_id: state.activeListId, title: title, type: type, status: status, season: (type === 'series' && status === 'watching') ? parseInt(seasonInput.value) || 1 : 0, episode: (type === 'series' && status === 'watching') ? parseInt(episodeInput.value) || 1 : 0, tmdb_id: document.getElementById('tmdbId').value || null, poster_path: document.getElementById('posterPath').value || null, genre_ids: genreIds }).select().single();
    if (error) { showToast('Erro ao adicionar', 'error'); } 
    else { 
      await supabaseClient.from('item_reviews').insert({ item_id: newItem.id, user_id: state.user.id, rating, note }); 
      showToast(`"${title}" adicionado`, 'success'); 
      await logActivity(`adicionou "${title}" à lista`);
    }
  }
  saveBtn.textContent = 'Salvar'; saveBtn.disabled = false; modal.classList.remove('open'); await fetchItems(); setTimeout(() => { state.isLocalAction = false; }, 1000);
});

function setSegmented(field, value) {
  const seg = document.querySelector(`.segmented[data-field="${field}"]`); seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === value));
  document.getElementById(field).value = value; if (field === 'status') updateProgressVisibility();
}

document.querySelectorAll('.segmented').forEach(seg => {
  seg.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (!btn) return; setSegmented(seg.dataset.field, btn.dataset.value); });
});

searchInput.addEventListener('input', () => { clearTimeout(state.searchTimeout); state.searchTimeout = setTimeout(() => searchTMDB(searchInput.value), 500); });

function openConfirm({ title, text, confirmLabel, onConfirm }) {
  confirmModal.querySelector('h2').textContent = title; confirmText.innerHTML = text; document.getElementById('confirmOk').textContent = confirmLabel; state.confirmCallback = onConfirm; confirmModal.classList.add('open');
}
function closeConfirm() { confirmModal.classList.remove('open'); state.confirmCallback = null; }
document.getElementById('confirmCancel').addEventListener('click', closeConfirm);
document.getElementById('confirmOk').addEventListener('click', () => { const cb = state.confirmCallback; closeConfirm(); if (cb) cb(); });
confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirm(); });

function showToast(message, type = 'success') {
  const container = document.getElementById('toasts'); const toast = document.createElement('div'); toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? icons.checkCircle : type === 'error' ? icons.trash : icons.info;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast); requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 320); }, 2800);
}
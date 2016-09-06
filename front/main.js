import Polyfills from './scripts/Polyfills';

import LocaleManager  from './scripts/LocaleManager';
import Preloader      from './scripts/Preloader';
import Utils          from './scripts/Utils';
import PokeUtils      from './scripts/Utils/PokeUtils';

import ListView             from './scripts/Views/ListView';
import CounterView          from './scripts/Views/CounterView';
import DetailsView          from './scripts/Views/DetailsView';
import LanguageSelectView   from './scripts/Views/LanguageSelectView';

Polyfills.objectAssign();

const NB_VISITS_KEY = 'number-of-visits';

const NAVIGATOR_LANG_TO_LANG = {
  'en-US': 'en',
  'fr-fr': 'fr',
  'fr': 'fr'
};

const MINIUM_MOVE_EFFICIENCY_REQUIRED = 1.25;

function _findById(list, id) {
  if (typeof(id) === 'string') {
    id = Number(id);
  }
  const results = list.filter((item) => item.id === id);
  return results && results[0];
}

function _findTypeById(id) {
  return _findById(types, id);
}

function _findMoveById(id) {
  const move = Object.assign({}, _findById(moves, id));
  move.type = _findTypeById(move.type);
  return move;
}

function _augmentPokemonsData(pokemons) {
  return pokemons
    .map((pokemon) => {
      return {
        id: pokemon.id,
        name: LocaleManager.getInstance().translate(pokemon.key),
        key: pokemon.key,
        types: pokemon.types
          .map((typeId) => _findById(types, typeId))
          .map((type) => Object.assign({}, type, {
              name: LocaleManager.getInstance().translate(type.key),
              cssClass: Utils.getClassForType(type.id)
          })),
        moves: {
          quick: pokemon.moves.quick.map(_findMoveById),
          charge: pokemon.moves.special.map(_findMoveById)
        },
        tiers: pokemon.tiers,
        cpMax: pokemon.cpMax
      }
    });
}
function updateDetail(pokemons, pokemon) {
  const counters = pokemons
    .map(PokeUtils.getCounters.bind(null, MINIUM_MOVE_EFFICIENCY_REQUIRED, pokemon))
    .filter(p => p) // Filter null efficiencies
    .map((counter) => {
      const move = _findMoveById(counter.move.move);
      const moveName = LocaleManager.getInstance().translate(move.key);
      const moveType = move.type;
      const fontSize = Utils.getFontSize(moveName, 70);
      const cp = Math.round(2400 / counter.efficiency);

      if (counter.cpMax < cp) {
        return null;
      }

      return {
        id: counter.id,
        key: counter.key,
        moveType,
        moveName,
        fontSize,
        efficiency: counter.efficiency,
        cp,
        pokemon: counter.pokemon
      };
    })
    .filter(c => c) // Filter null entries
    .sort((item1, item2) => item1.cp - item2.cp);

  new DetailsView()
    .on(DetailsView.EVENTS.COUNTER_SELECTED, updateDetail.bind(null, pokemons))
    .render({
      pokemon,
      counters,
      isLoading
    })
}

const overlay = document.querySelector('.overlay');
const pokedex = document.querySelector('.pokedex');

function showDetail() {
  window.scroll(0, 0);
  overlay.style.display = "initial";
  overlay.classList.remove('is-hidden');
  pokedex.classList.add('is-behind');
}

overlay.addEventListener('transitionend', () => {
  overlay.style.display = "none";
});
overlay.style.display = "none";
function hideDetail() {
  overlay.classList.add('is-hidden');
  pokedex.classList.remove('is-behind');
}

function toggleIntro() {
  document.querySelector('.intro').classList.toggle('is-collapsed');
}

//===== Loading screen =====//

const loadingEl = document.querySelector('.loading-screen');
const loadingProgress = document.querySelector('.loading-screen .progress .value');

loadingEl.addEventListener('transitionend', () => {
    loadingEl.style.display = "none";
  });
loadingEl.addEventListener('webkitTransitionend', () => {
    loadingEl.style.display = "none";
  });
function _hideLoading() {
  loadingEl.classList.add('is-hidden');
}

function _setProgress(progress) {
  loadingProgress.innerHTML = progress;
}

//===== Startup =====//

// Listeners

function _addKeyboardListener() {
  window.addEventListener('keyup', (e) => {
    if (e.keyCode === 27) {
      hideDetail();
    }
  })
}

function _onPokemonSelected(pokemons, pokemon) {
  updateDetail(pokemons, pokemon);
  showDetail();
}

function _removeLoadingState() {
  isLoading = false;
  Array.prototype.forEach.call(document.querySelectorAll('.pokemon-image'), (el) => {
    el.classList.remove('is-loading');
  });
}

function _onLanguageSelected(lang) {
  LocaleManager.getInstance().setLanguage(lang || 'en');
  LocaleManager.getInstance().scanAndLocalise();
}

// Startup

let pokemons = null, types = null, moves = null, dictionary = null;
let pokemonsFull;
let isLoading = true;

function _startup () {
  const preloader = new Preloader()
    .on(Preloader.EVENTS.PROGRESS, _setProgress);

  preloader
    .fetchAll([
      {
        name: 'pokemons',
        url: `${location.origin}/data/pokemons.json`
      },
      {
        name: 'types',
        url: `${location.origin}/data/types.json`
      },
      {
        name: 'moves',
        url: `${location.origin}/data/moves.json`
      },
      {
        name: 'dictionary',
        url: `${location.origin}/data/dictionary.json`
      },
      {
        name: 'spritesheet-lowres',
        url: `${location.origin}/images/pokemon-spritesheet-lowres.png`,
        type: 'image'
      }
    ])
    .then((allJSONResults) => {
      // We need one object like {entryName: json, otherEntry: otherjson}
      // from array of [entryName, json]
      const entryJsonMap = allJSONResults.reduce((state, tuple) => {
        state[tuple[0]] = tuple[1];
        return state;
      }, {});

      pokemons = JSON.parse(entryJsonMap.pokemons);
      types = JSON.parse(entryJsonMap.types);
      moves = JSON.parse(entryJsonMap.moves);
      dictionary = JSON.parse(entryJsonMap.dictionary);

      LocaleManager.prepare(dictionary);
      const localeManager = LocaleManager.getInstance();
      const browserLang = navigator.language || navigator.userLanguage || 'en';

      const languageSelectView = new LanguageSelectView(
          document.querySelector('.js-language-selector-wrapper'),
          localeManager.getLanguages()
        )
        .on(LanguageSelectView.ACTIONS.SELECT_LANGUAGE, _onLanguageSelected);
      languageSelectView.render();
      languageSelectView.selectLanguage(NAVIGATOR_LANG_TO_LANG[browserLang]);

      pokemonsFull = _augmentPokemonsData(pokemons);
      const listView = new ListView()
        .on(ListView.EVENTS.POKEMON_SELECTED, _onPokemonSelected.bind(null, pokemonsFull));
      listView.render(pokemonsFull);

      _addKeyboardListener();

      document.querySelector('.js-background').addEventListener('click', hideDetail);
      document.querySelector('.js-close').addEventListener('click', hideDetail);
      document.querySelector('.js-intro').addEventListener('click', toggleIntro);

      // Check in localStorage whether we need to show the intro collapsed on start
      let nbVisits = localStorage && localStorage.getItem(NB_VISITS_KEY);
      if (nbVisits && nbVisits >= 3) {
        toggleIntro();
      } else {
        localStorage.setItem(NB_VISITS_KEY, ++nbVisits);
      }

      // Preload the high res spritesheet now that the page has loaded
      preloader.preloadImage(`${location.origin}/images/pokemon-spritesheet.png`)
        .then(_removeLoadingState);

      setTimeout(_hideLoading, 600);

      // debug
      window.__localeManager = localeManager;
    })
    .catch((err) => console.error.bind(console))
}

_startup();
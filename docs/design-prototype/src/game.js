const screens = document.querySelectorAll('.screen');
const heroes = {
  nova: { name: 'NOVA', role: 'THE QUICK THINKER', description: 'Quick casts and bright ideas. Nova turns sharp answers into swift bursts of power.', focus: 8, spark: 9, className: 'nova' },
  orion: { name: 'ORION', role: 'THE PATTERN SEER', description: 'Orion spots a rule in every puzzle and turns careful timing into powerful combos.', focus: 9, spark: 7, className: 'orion' },
  mira: { name: 'MIRA', role: 'THE NUMBER KNIGHT', description: 'Mira is steady under pressure. Every correct answer strengthens her shield.', focus: 7, spark: 8, className: 'mira' }
};
const questions = [
  { prompt: 'What is 8 × 7?', correct: '56', choices: ['54', '56', '63', '48'] },
  { prompt: 'What is 72 ÷ 8?', correct: '9', choices: ['7', '8', '9', '10'] },
  { prompt: 'What is 145 + 38?', correct: '183', choices: ['173', '183', '193', '178'] },
  { prompt: 'Which fraction is equal to 1/2?', correct: '4/8', choices: ['2/3', '4/8', '3/8', '5/8'] }
];
let selectedHero = 'nova';
let questionIndex = 0;
let streak = 3;
let gold = 240;
let isQuestionOpen = false;
let timer;

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
  document.querySelectorAll('.question-modal,.shop-drawer,.pause-modal').forEach((el) => el.classList.remove('show'));
  clearInterval(timer);
}

function chooseHero(key) {
  selectedHero = key;
  const hero = heroes[key];
  document.querySelectorAll('.hero-card').forEach((card) => card.classList.toggle('selected', card.dataset.hero === key));
  const preview = document.querySelector('#hero-preview');
  preview.className = `large-portrait ${hero.className}`;
  preview.innerHTML = `<span class="portrait-symbol">${key === 'nova' ? '✦' : key === 'orion' ? '◈' : '❋'}</span>`;
  document.querySelector('#hero-role').textContent = hero.role;
  document.querySelector('#hero-name').textContent = hero.name;
  document.querySelector('#hero-description').textContent = hero.description;
  document.querySelector('#focus-value').textContent = hero.focus;
  document.querySelector('#spark-value').textContent = hero.spark;
}

function renderQuestion() {
  const question = questions[questionIndex % questions.length];
  document.querySelector('#question-title').textContent = question.prompt;
  document.querySelector('#answers').innerHTML = question.choices.map((choice, index) => `<button class="answer" data-answer="${choice}"><b>${'ABCD'[index]}.</b> ${choice}</button>`).join('');
  document.querySelector('#streak-text').textContent = `★ ${streak} correct in a row! +${Math.min(streak * 5, 25)}% bonus`;
  document.querySelectorAll('.answer').forEach((button) => button.addEventListener('click', () => answerQuestion(button.dataset.answer)));
}

function openQuestion() {
  if (isQuestionOpen) return;
  isQuestionOpen = true;
  renderQuestion();
  document.querySelector('#question-modal').classList.add('show');
  let seconds = 8;
  document.querySelector('#timer-value').textContent = String(seconds).padStart(2, '0');
  timer = setInterval(() => {
    seconds -= 1;
    document.querySelector('#timer-value').textContent = String(Math.max(0, seconds)).padStart(2, '0');
    if (seconds <= 0) resolveQuestion(false, null);
  }, 1000);
}

function answerQuestion(answer) {
  const correct = questions[questionIndex % questions.length].correct;
  const selected = [...document.querySelectorAll('.answer')].find((item) => item.dataset.answer === answer);
  selected.classList.add(answer === correct ? 'correct' : 'wrong');
  if (answer !== correct) [...document.querySelectorAll('.answer')].find((item) => item.dataset.answer === correct).classList.add('correct');
  setTimeout(() => resolveQuestion(answer === correct, answer), 460);
}

function resolveQuestion(won) {
  if (!isQuestionOpen) return;
  clearInterval(timer);
  isQuestionOpen = false;
  document.querySelector('#question-modal').classList.remove('show');
  if (won) {
    streak += 1;
    gold += 30;
    document.querySelector('#gold-value').textContent = gold;
    document.querySelector('#accuracy').textContent = '100%';
    document.querySelector('#result-title').textContent = 'BRILLIANT!';
    document.querySelector('#result-copy').textContent = 'Correct! Your bonus gold and EXP are ready.';
  } else {
    streak = 0;
    document.querySelector('#accuracy').textContent = '75%';
    document.querySelector('#result-title').textContent = 'KEEP GOING!';
    document.querySelector('#result-copy').textContent = 'A wrong answer still earns progress. Try the next wave!';
  }
  questionIndex += 1;
  setTimeout(() => showScreen('result-screen'), 350);
}

document.querySelector('#play-button').addEventListener('click', () => showScreen('select-screen'));
document.querySelector('#continue-button').addEventListener('click', () => showScreen('game-screen'));
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.back)));
document.querySelectorAll('.hero-card').forEach((card) => card.addEventListener('click', () => chooseHero(card.dataset.hero)));
document.querySelector('#attack-button').addEventListener('click', () => {
  const pop = document.querySelector('#damage-pop');
  pop.classList.remove('show');
  void pop.offsetWidth;
  pop.classList.add('show');
  openQuestion();
});
document.querySelector('#spell-button').addEventListener('click', openQuestion);
document.querySelector('#shop-button').addEventListener('click', () => document.querySelector('#shop-drawer').classList.toggle('show'));
document.querySelector('#close-shop').addEventListener('click', () => document.querySelector('#shop-drawer').classList.remove('show'));
document.querySelectorAll('.item').forEach((item) => item.addEventListener('click', () => {
  item.animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 220 });
}));
document.querySelector('#pause-button').addEventListener('click', () => document.querySelector('#pause-modal').classList.add('show'));
document.querySelector('#resume-button').addEventListener('click', () => document.querySelector('#pause-modal').classList.remove('show'));
document.querySelector('#play-again').addEventListener('click', () => showScreen('game-screen'));
document.querySelector('#how-button').addEventListener('click', () => document.querySelector('#how-modal').classList.add('show'));
document.querySelector('#close-how').addEventListener('click', () => document.querySelector('#how-modal').classList.remove('show'));
document.querySelector('#got-it').addEventListener('click', () => document.querySelector('#how-modal').classList.remove('show'));
document.querySelector('#sound-button').addEventListener('click', (event) => { event.currentTarget.textContent = event.currentTarget.textContent === '♫' ? '×' : '♫'; });
chooseHero(selectedHero);

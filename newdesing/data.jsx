// Mock data for the prototype
const SEED_POSTS = [
  {
    id: 'p1',
    author: { name: 'fluttershy', handle: '@fluttershy', avatar: '🦄', color: 'oklch(0.72 0.14 340)' },
    title: 'когда продакшн упал в пятницу 17:59',
    body: null,
    media: { kind: 'video', poster: 'gradient-1', label: 'demo.mp4' },
    tags: ['#fluttershy', '#dev', '#friday'],
    likes: 142, comments: 23, saves: 12,
    liked: false, saved: false,
    createdAt: Date.now() - 1000 * 60 * 22,
    type: 'meme',
  },
  {
    id: 'p2',
    author: { name: 'vasya_dev', handle: '@vasya_dev', avatar: 'V', color: 'oklch(0.7 0.15 60)' },
    title: 'мой первый деплой на проде',
    body: 'Думал git push origin main — это шутка. Оказалось нет.',
    media: null,
    tags: ['#git', '#story', '#fail'],
    likes: 89, comments: 41, saves: 6,
    liked: true, saved: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    type: 'text',
  },
  {
    id: 'p3',
    author: { name: 'kira_404', handle: '@kira_404', avatar: 'K', color: 'oklch(0.65 0.18 280)' },
    title: 'светящиеся кроссы за 14к р',
    body: null,
    media: { kind: 'image', poster: 'gradient-2', label: 'sneakers.jpg' },
    tags: ['#sale', '#fashion'],
    likes: 312, comments: 18, saves: 47,
    liked: false, saved: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
    type: 'sale',
    price: '14 880 ₽',
  },
  {
    id: 'p4',
    author: { name: 'ghoul_man', handle: '@ghoul_man', avatar: 'G', color: 'oklch(0.6 0.2 25)' },
    title: 'Tokyo Ghoul с самого детства',
    body: 'Когда наконец дочитал последний том. Эмоции переполняют.',
    media: { kind: 'image', poster: 'gradient-3', label: 'manga-cover.png' },
    tags: ['#anime', '#manga', '#tokyoghoul'],
    likes: 567, comments: 89, saves: 134,
    liked: false, saved: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    type: 'meme',
  },
  {
    id: 'p5',
    author: { name: 'dev_356', handle: '@dev_356', avatar: 'D', color: 'oklch(0.72 0.13 145)' },
    title: 'кто-нибудь шарит за rust?',
    body: 'Пытаюсь понять lifetimes третий день. Borrow checker меня сломал.',
    media: null,
    tags: ['#rust', '#help', '#beginner'],
    likes: 34, comments: 67, saves: 4,
    liked: false, saved: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    type: 'question',
  },
  {
    id: 'p6',
    author: { name: 'memer_42', handle: '@memer_42', avatar: 'M', color: 'oklch(0.68 0.16 200)' },
    title: 'когда ревьюер пишет "looks good but..."',
    body: null,
    media: { kind: 'image', poster: 'gradient-4', label: 'reviewer.gif' },
    tags: ['#codereview', '#pain', '#meme'],
    likes: 891, comments: 124, saves: 203,
    liked: true, saved: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    type: 'meme',
  },
  {
    id: 'p7',
    author: { name: 'nullptr', handle: '@nullptr', avatar: 'N', color: 'oklch(0.7 0.14 320)' },
    title: 'segfault на ровном месте',
    body: 'три часа дебажил. оказалось — забыл проинициализировать указатель. как всегда.',
    media: null,
    tags: ['#cpp', '#debug', '#story'],
    likes: 156, comments: 28, saves: 9,
    liked: false, saved: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
    type: 'text',
  },
  {
    id: 'p8',
    author: { name: 'ui_witch', handle: '@ui_witch', avatar: 'U', color: 'oklch(0.72 0.15 100)' },
    title: 'дизайнер прислал макет в paint',
    body: null,
    media: { kind: 'image', poster: 'gradient-5', label: 'design.png' },
    tags: ['#design', '#wtf', '#frontend'],
    likes: 423, comments: 56, saves: 38,
    liked: false, saved: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    type: 'meme',
  },
];

const POPULAR_TAGS = [
  { tag: '#fluttershy', count: 142 },
  { tag: '#killpiratepuiltyofanything', count: 3 },
  { tag: '#meme', count: 89 },
  { tag: '#dev', count: 234 },
  { tag: '#dota2', count: 56 },
  { tag: '#rust', count: 41 },
  { tag: '#frontend', count: 178 },
  { tag: '#tiktok', count: 67 },
  { tag: '#mobile', count: 23 },
  { tag: '#git', count: 91 },
  { tag: '#react', count: 145 },
  { tag: '#fail', count: 33 },
];

const SAMPLE_COMMENTS = [
  { id: 'c1', author: 'dev_356', avatar: 'D', color: 'oklch(0.72 0.13 145)', text: 'это мой каждый пятничный вечер 😩', likes: 12, time: '2ч' },
  { id: 'c2', author: 'kira_404', avatar: 'K', color: 'oklch(0.65 0.18 280)', text: 'rollback и пиво — наше всё', likes: 8, time: '1ч' },
  { id: 'c3', author: 'memer_42', avatar: 'M', color: 'oklch(0.68 0.16 200)', text: 'feature freeze не существует', likes: 4, time: '34м' },
];

const NAV_ITEMS = [
  { id: 'feed', label: 'Лента', icon: 'feed' },
  { id: 'create', label: 'Новый пост', icon: 'plus' },
  { id: 'saved', label: 'Сохранённое', icon: 'bookmark' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

const FILTERS = [
  { id: 'all', label: 'Всё' },
  { id: 'meme', label: 'Мемы' },
  { id: 'text', label: 'Тексты' },
  { id: 'question', label: 'Вопросы' },
  { id: 'sale', label: 'Барахолка' },
];

const SORTS = [
  { id: 'hot', label: 'Горячее' },
  { id: 'new', label: 'Новое' },
  { id: 'top', label: 'Топ' },
];

window.SEED_POSTS = SEED_POSTS;
window.POPULAR_TAGS = POPULAR_TAGS;
window.SAMPLE_COMMENTS = SAMPLE_COMMENTS;
window.NAV_ITEMS = NAV_ITEMS;
window.FILTERS = FILTERS;
window.SORTS = SORTS;

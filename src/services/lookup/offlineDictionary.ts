import type { LookupDraft } from '@/types';
import { splitSyllables } from './syllable';

export interface OfflineEntry {
  word: string;
  translation: string;
  phonetic: string;
  pos?: string;
  exampleEn?: string;
  exampleZh?: string;
  emoji: string;
}

/**
 * 内置离线词库 —— 查词的主路径。
 *
 * 为什么是主路径而不是兜底：本应用面向家庭使用，孩子的网络环境不可控，
 * 而「查词等半天」是这类产品最大的体验杀手。把二年级高频词内置进来，
 * 命中时 0ms 返回完整数据，孩子完全没有等待感。
 *
 * 在线 API 只作为「生僻词补全」的增强手段（见 lookupService）。
 */
const DICT: Record<string, OfflineEntry> = {
  // ───── 单元 1：我的家人与朋友 ─────
  family: { word: 'family', translation: '家庭；家人', phonetic: '/ˈfæməli/', pos: 'n.', emoji: '👨‍👩‍👧', exampleEn: 'This is my family.', exampleZh: '这是我的家人。' },
  father: { word: 'father', translation: '爸爸', phonetic: '/ˈfɑːðər/', pos: 'n.', emoji: '👨', exampleEn: 'My father is tall.', exampleZh: '我的爸爸很高。' },
  mother: { word: 'mother', translation: '妈妈', phonetic: '/ˈmʌðər/', pos: 'n.', emoji: '👩', exampleEn: 'My mother is kind.', exampleZh: '我的妈妈很温柔。' },
  brother: { word: 'brother', translation: '哥哥；弟弟', phonetic: '/ˈbrʌðər/', pos: 'n.', emoji: '👦', exampleEn: 'I have a brother.', exampleZh: '我有一个兄弟。' },
  sister: { word: 'sister', translation: '姐姐；妹妹', phonetic: '/ˈsɪstər/', pos: 'n.', emoji: '👧', exampleEn: 'My sister likes dolls.', exampleZh: '我的姐妹喜欢洋娃娃。' },
  grandpa: { word: 'grandpa', translation: '爷爷；外公', phonetic: '/ˈɡrænpɑː/', pos: 'n.', emoji: '👴', exampleEn: 'Grandpa tells stories.', exampleZh: '爷爷讲故事。' },
  grandma: { word: 'grandma', translation: '奶奶；外婆', phonetic: '/ˈɡrænmɑː/', pos: 'n.', emoji: '👵', exampleEn: 'Grandma makes cookies.', exampleZh: '奶奶做饼干。' },
  friend: { word: 'friend', translation: '朋友', phonetic: '/frend/', pos: 'n.', emoji: '🧑‍🤝‍🧑', exampleEn: 'She is my friend.', exampleZh: '她是我的朋友。' },
  boy: { word: 'boy', translation: '男孩', phonetic: '/bɔɪ/', pos: 'n.', emoji: '👦', exampleEn: 'The boy is running.', exampleZh: '那个男孩在跑步。' },
  girl: { word: 'girl', translation: '女孩', phonetic: '/ɡɜːrl/', pos: 'n.', emoji: '👧', exampleEn: 'The girl is singing.', exampleZh: '那个女孩在唱歌。' },
  baby: { word: 'baby', translation: '婴儿；宝宝', phonetic: '/ˈbeɪbi/', pos: 'n.', emoji: '👶', exampleEn: 'The baby is sleeping.', exampleZh: '宝宝在睡觉。' },
  people: { word: 'people', translation: '人们', phonetic: '/ˈpiːpl/', pos: 'n.', emoji: '👥', exampleEn: 'Many people are here.', exampleZh: '很多人在这里。' },
  name: { word: 'name', translation: '名字', phonetic: '/neɪm/', pos: 'n.', emoji: '📛', exampleEn: 'My name is Tom.', exampleZh: '我的名字是汤姆。' },
  home: { word: 'home', translation: '家', phonetic: '/hoʊm/', pos: 'n.', emoji: '🏠', exampleEn: 'I go home at five.', exampleZh: '我五点回家。' },
  love: { word: 'love', translation: '爱', phonetic: '/lʌv/', pos: 'v.', emoji: '❤️', exampleEn: 'I love my family.', exampleZh: '我爱我的家人。' },
  happy: { word: 'happy', translation: '快乐的', phonetic: '/ˈhæpi/', pos: 'adj.', emoji: '😊', exampleEn: 'I am happy today.', exampleZh: '我今天很快乐。' },

  // ───── 单元 2：食物与饮料 ─────
  apple: { word: 'apple', translation: '苹果', phonetic: '/ˈæpl/', pos: 'n.', emoji: '🍎', exampleEn: 'I like apples.', exampleZh: '我喜欢苹果。' },
  banana: { word: 'banana', translation: '香蕉', phonetic: '/bəˈnɑːnə/', pos: 'n.', emoji: '🍌', exampleEn: 'The banana is yellow.', exampleZh: '香蕉是黄色的。' },
  orange: { word: 'orange', translation: '橙子；橙色', phonetic: '/ˈɔːrɪndʒ/', pos: 'n.', emoji: '🍊', exampleEn: 'I eat an orange.', exampleZh: '我吃一个橙子。' },
  bread: { word: 'bread', translation: '面包', phonetic: '/bred/', pos: 'n.', emoji: '🍞', exampleEn: 'I have bread for breakfast.', exampleZh: '我早餐吃面包。' },
  milk: { word: 'milk', translation: '牛奶', phonetic: '/mɪlk/', pos: 'n.', emoji: '🥛', exampleEn: 'Drink your milk.', exampleZh: '把牛奶喝掉。' },
  water: { word: 'water', translation: '水', phonetic: '/ˈwɔːtər/', pos: 'n.', emoji: '💧', exampleEn: 'I drink water.', exampleZh: '我喝水。' },
  juice: { word: 'juice', translation: '果汁', phonetic: '/dʒuːs/', pos: 'n.', emoji: '🧃', exampleEn: 'Orange juice is yummy.', exampleZh: '橙汁很好喝。' },
  rice: { word: 'rice', translation: '米饭', phonetic: '/raɪs/', pos: 'n.', emoji: '🍚', exampleEn: 'I eat rice.', exampleZh: '我吃米饭。' },
  egg: { word: 'egg', translation: '鸡蛋', phonetic: '/eɡ/', pos: 'n.', emoji: '🥚', exampleEn: 'I have two eggs.', exampleZh: '我有两个鸡蛋。' },
  cake: { word: 'cake', translation: '蛋糕', phonetic: '/keɪk/', pos: 'n.', emoji: '🍰', exampleEn: 'The cake is sweet.', exampleZh: '蛋糕很甜。' },
  noodle: { word: 'noodle', translation: '面条', phonetic: '/ˈnuːdl/', pos: 'n.', emoji: '🍜', exampleEn: 'I like noodles.', exampleZh: '我喜欢面条。' },
  candy: { word: 'candy', translation: '糖果', phonetic: '/ˈkændi/', pos: 'n.', emoji: '🍬', exampleEn: 'One candy, please.', exampleZh: '请给我一颗糖。' },
  cookie: { word: 'cookie', translation: '饼干', phonetic: '/ˈkʊki/', pos: 'n.', emoji: '🍪', exampleEn: 'The cookie is big.', exampleZh: '这块饼干很大。' },
  meat: { word: 'meat', translation: '肉', phonetic: '/miːt/', pos: 'n.', emoji: '🍖', exampleEn: 'I eat meat.', exampleZh: '我吃肉。' },
  fish: { word: 'fish', translation: '鱼', phonetic: '/fɪʃ/', pos: 'n.', emoji: '🐟', exampleEn: 'The fish is swimming.', exampleZh: '鱼在游。' },
  soup: { word: 'soup', translation: '汤', phonetic: '/suːp/', pos: 'n.', emoji: '🍲', exampleEn: 'The soup is hot.', exampleZh: '汤很烫。' },

  // ───── 常见动物 ─────
  cat: { word: 'cat', translation: '猫', phonetic: '/kæt/', pos: 'n.', emoji: '🐱', exampleEn: 'The cat is cute.', exampleZh: '这只猫很可爱。' },
  dog: { word: 'dog', translation: '狗', phonetic: '/dɔːɡ/', pos: 'n.', emoji: '🐶', exampleEn: 'The dog runs fast.', exampleZh: '狗跑得很快。' },
  bird: { word: 'bird', translation: '鸟', phonetic: '/bɜːrd/', pos: 'n.', emoji: '🐦', exampleEn: 'A bird can fly.', exampleZh: '鸟会飞。' },
  panda: { word: 'panda', translation: '熊猫', phonetic: '/ˈpændə/', pos: 'n.', emoji: '🐼', exampleEn: 'The panda is black and white.', exampleZh: '熊猫是黑白色的。' },
  rabbit: { word: 'rabbit', translation: '兔子', phonetic: '/ˈræbɪt/', pos: 'n.', emoji: '🐰', exampleEn: 'The rabbit is white.', exampleZh: '兔子是白色的。' },
  tiger: { word: 'tiger', translation: '老虎', phonetic: '/ˈtaɪɡər/', pos: 'n.', emoji: '🐯', exampleEn: 'The tiger is strong.', exampleZh: '老虎很强壮。' },
  monkey: { word: 'monkey', translation: '猴子', phonetic: '/ˈmʌŋki/', pos: 'n.', emoji: '🐵', exampleEn: 'The monkey likes bananas.', exampleZh: '猴子喜欢香蕉。' },
  elephant: { word: 'elephant', translation: '大象', phonetic: '/ˈelɪfənt/', pos: 'n.', emoji: '🐘', exampleEn: 'The elephant is big.', exampleZh: '大象很大。' },
  duck: { word: 'duck', translation: '鸭子', phonetic: '/dʌk/', pos: 'n.', emoji: '🦆', exampleEn: 'The duck can swim.', exampleZh: '鸭子会游泳。' },
  pig: { word: 'pig', translation: '猪', phonetic: '/pɪɡ/', pos: 'n.', emoji: '🐷', exampleEn: 'The pig is pink.', exampleZh: '猪是粉色的。' },
  cow: { word: 'cow', translation: '奶牛', phonetic: '/kaʊ/', pos: 'n.', emoji: '🐮', exampleEn: 'The cow gives milk.', exampleZh: '奶牛产奶。' },
  horse: { word: 'horse', translation: '马', phonetic: '/hɔːrs/', pos: 'n.', emoji: '🐴', exampleEn: 'The horse runs fast.', exampleZh: '马跑得快。' },

  // ───── 学习用品 ─────
  book: { word: 'book', translation: '书', phonetic: '/bʊk/', pos: 'n.', emoji: '📖', exampleEn: 'I read a book.', exampleZh: '我读一本书。' },
  pen: { word: 'pen', translation: '钢笔', phonetic: '/pen/', pos: 'n.', emoji: '🖊️', exampleEn: 'This is my pen.', exampleZh: '这是我的钢笔。' },
  pencil: { word: 'pencil', translation: '铅笔', phonetic: '/ˈpensl/', pos: 'n.', emoji: '✏️', exampleEn: 'I have a pencil.', exampleZh: '我有一支铅笔。' },
  ruler: { word: 'ruler', translation: '尺子', phonetic: '/ˈruːlər/', pos: 'n.', emoji: '📏', exampleEn: 'Where is my ruler?', exampleZh: '我的尺子在哪里？' },
  bag: { word: 'bag', translation: '书包；包', phonetic: '/bæɡ/', pos: 'n.', emoji: '🎒', exampleEn: 'My bag is heavy.', exampleZh: '我的书包很重。' },
  desk: { word: 'desk', translation: '书桌', phonetic: '/desk/', pos: 'n.', emoji: '🪑', exampleEn: 'The book is on the desk.', exampleZh: '书在书桌上。' },
  chair: { word: 'chair', translation: '椅子', phonetic: '/tʃer/', pos: 'n.', emoji: '💺', exampleEn: 'Sit on the chair.', exampleZh: '坐在椅子上。' },
  school: { word: 'school', translation: '学校', phonetic: '/skuːl/', pos: 'n.', emoji: '🏫', exampleEn: 'I go to school.', exampleZh: '我去上学。' },
  class: { word: 'class', translation: '班级；课', phonetic: '/klæs/', pos: 'n.', emoji: '🧑‍🏫', exampleEn: 'Our class is fun.', exampleZh: '我们班很有趣。' },
  teacher: { word: 'teacher', translation: '老师', phonetic: '/ˈtiːtʃər/', pos: 'n.', emoji: '👩‍🏫', exampleEn: 'My teacher is nice.', exampleZh: '我的老师很好。' },
  student: { word: 'student', translation: '学生', phonetic: '/ˈstuːdnt/', pos: 'n.', emoji: '🎓', exampleEn: 'I am a student.', exampleZh: '我是一名学生。' },

  // ───── 颜色与形状 ─────
  red: { word: 'red', translation: '红色', phonetic: '/red/', pos: 'adj.', emoji: '🔴', exampleEn: 'The apple is red.', exampleZh: '苹果是红色的。' },
  blue: { word: 'blue', translation: '蓝色', phonetic: '/bluː/', pos: 'adj.', emoji: '🔵', exampleEn: 'The sky is blue.', exampleZh: '天空是蓝色的。' },
  yellow: { word: 'yellow', translation: '黄色', phonetic: '/ˈjeloʊ/', pos: 'adj.', emoji: '🟡', exampleEn: 'The sun is yellow.', exampleZh: '太阳是黄色的。' },
  green: { word: 'green', translation: '绿色', phonetic: '/ɡriːn/', pos: 'adj.', emoji: '🟢', exampleEn: 'The grass is green.', exampleZh: '草是绿色的。' },
  black: { word: 'black', translation: '黑色', phonetic: '/blæk/', pos: 'adj.', emoji: '⚫', exampleEn: 'The cat is black.', exampleZh: '这只猫是黑色的。' },
  white: { word: 'white', translation: '白色', phonetic: '/waɪt/', pos: 'adj.', emoji: '⚪', exampleEn: 'The cloud is white.', exampleZh: '云是白色的。' },
  pink: { word: 'pink', translation: '粉色', phonetic: '/pɪŋk/', pos: 'adj.', emoji: '🌸', exampleEn: 'I like pink.', exampleZh: '我喜欢粉色。' },
  purple: { word: 'purple', translation: '紫色', phonetic: '/ˈpɜːrpl/', pos: 'adj.', emoji: '🟣', exampleEn: 'The flower is purple.', exampleZh: '这朵花是紫色的。' },

  // ───── 数字 ─────
  one: { word: 'one', translation: '一', phonetic: '/wʌn/', pos: 'num.', emoji: '1️⃣', exampleEn: 'I have one pen.', exampleZh: '我有一支钢笔。' },
  two: { word: 'two', translation: '二', phonetic: '/tuː/', pos: 'num.', emoji: '2️⃣', exampleEn: 'Two cats are here.', exampleZh: '两只猫在这里。' },
  three: { word: 'three', translation: '三', phonetic: '/θriː/', pos: 'num.', emoji: '3️⃣', exampleEn: 'I see three birds.', exampleZh: '我看见三只鸟。' },
  four: { word: 'four', translation: '四', phonetic: '/fɔːr/', pos: 'num.', emoji: '4️⃣', exampleEn: 'Four books.', exampleZh: '四本书。' },
  five: { word: 'five', translation: '五', phonetic: '/faɪv/', pos: 'num.', emoji: '5️⃣', exampleEn: 'Five fingers.', exampleZh: '五根手指。' },
  six: { word: 'six', translation: '六', phonetic: '/sɪks/', pos: 'num.', emoji: '6️⃣', exampleEn: 'Six eggs.', exampleZh: '六个鸡蛋。' },
  seven: { word: 'seven', translation: '七', phonetic: '/ˈsevn/', pos: 'num.', emoji: '7️⃣', exampleEn: 'Seven days a week.', exampleZh: '一周七天。' },
  eight: { word: 'eight', translation: '八', phonetic: '/eɪt/', pos: 'num.', emoji: '8️⃣', exampleEn: 'Eight apples.', exampleZh: '八个苹果。' },
  nine: { word: 'nine', translation: '九', phonetic: '/naɪn/', pos: 'num.', emoji: '9️⃣', exampleEn: 'Nine students.', exampleZh: '九个学生。' },
  ten: { word: 'ten', translation: '十', phonetic: '/ten/', pos: 'num.', emoji: '🔟', exampleEn: 'Ten pencils.', exampleZh: '十支铅笔。' },

  // ───── 动作 ─────
  run: { word: 'run', translation: '跑', phonetic: '/rʌn/', pos: 'v.', emoji: '🏃', exampleEn: 'I can run fast.', exampleZh: '我能跑得很快。' },
  jump: { word: 'jump', translation: '跳', phonetic: '/dʒʌmp/', pos: 'v.', emoji: '🤸', exampleEn: 'The rabbit can jump.', exampleZh: '兔子会跳。' },
  eat: { word: 'eat', translation: '吃', phonetic: '/iːt/', pos: 'v.', emoji: '🍽️', exampleEn: 'I eat breakfast.', exampleZh: '我吃早饭。' },
  drink: { word: 'drink', translation: '喝', phonetic: '/drɪŋk/', pos: 'v.', emoji: '🥤', exampleEn: 'Drink some water.', exampleZh: '喝点水。' },
  sing: { word: 'sing', translation: '唱歌', phonetic: '/sɪŋ/', pos: 'v.', emoji: '🎤', exampleEn: 'She can sing well.', exampleZh: '她唱歌很好听。' },
  dance: { word: 'dance', translation: '跳舞', phonetic: '/dæns/', pos: 'v.', emoji: '💃', exampleEn: 'Let us dance.', exampleZh: '我们来跳舞吧。' },
  read: { word: 'read', translation: '读；看', phonetic: '/riːd/', pos: 'v.', emoji: '📚', exampleEn: 'I read every day.', exampleZh: '我每天读书。' },
  write: { word: 'write', translation: '写', phonetic: '/raɪt/', pos: 'v.', emoji: '✍️', exampleEn: 'Write your name.', exampleZh: '写下你的名字。' },
  play: { word: 'play', translation: '玩；踢', phonetic: '/pleɪ/', pos: 'v.', emoji: '⚽', exampleEn: 'I play football.', exampleZh: '我踢足球。' },
  sleep: { word: 'sleep', translation: '睡觉', phonetic: '/sliːp/', pos: 'v.', emoji: '😴', exampleEn: 'The baby sleeps at nine.', exampleZh: '宝宝九点睡觉。' },

  // ───── 日常物品与环境 ─────
  sun: { word: 'sun', translation: '太阳', phonetic: '/sʌn/', pos: 'n.', emoji: '☀️', exampleEn: 'The sun is bright.', exampleZh: '太阳很明亮。' },
  moon: { word: 'moon', translation: '月亮', phonetic: '/muːn/', pos: 'n.', emoji: '🌙', exampleEn: 'The moon is round.', exampleZh: '月亮是圆的。' },
  star: { word: 'star', translation: '星星', phonetic: '/stɑːr/', pos: 'n.', emoji: '⭐', exampleEn: 'Stars are in the sky.', exampleZh: '星星在天上。' },
  tree: { word: 'tree', translation: '树', phonetic: '/triː/', pos: 'n.', emoji: '🌳', exampleEn: 'The tree is tall.', exampleZh: '这棵树很高。' },
  flower: { word: 'flower', translation: '花', phonetic: '/ˈflaʊər/', pos: 'n.', emoji: '🌸', exampleEn: 'The flower smells good.', exampleZh: '花闻起来很香。' },
  rain: { word: 'rain', translation: '雨', phonetic: '/reɪn/', pos: 'n.', emoji: '🌧️', exampleEn: 'It is going to rain.', exampleZh: '要下雨了。' },
  snow: { word: 'snow', translation: '雪', phonetic: '/snoʊ/', pos: 'n.', emoji: '❄️', exampleEn: 'Snow is white.', exampleZh: '雪是白色的。' },
  ball: { word: 'ball', translation: '球', phonetic: '/bɔːl/', pos: 'n.', emoji: '⚽', exampleEn: 'Throw the ball.', exampleZh: '把球扔过来。' },
  car: { word: 'car', translation: '小汽车', phonetic: '/kɑːr/', pos: 'n.', emoji: '🚗', exampleEn: 'The car is fast.', exampleZh: '这辆车很快。' },
  bike: { word: 'bike', translation: '自行车', phonetic: '/baɪk/', pos: 'n.', emoji: '🚲', exampleEn: 'I ride a bike.', exampleZh: '我骑自行车。' },
  bus: { word: 'bus', translation: '公共汽车', phonetic: '/bʌs/', pos: 'n.', emoji: '🚌', exampleEn: 'I take the bus.', exampleZh: '我坐公交车。' },
  door: { word: 'door', translation: '门', phonetic: '/dɔːr/', pos: 'n.', emoji: '🚪', exampleEn: 'Close the door.', exampleZh: '关上门。' },
  window: { word: 'window', translation: '窗户', phonetic: '/ˈwɪndoʊ/', pos: 'n.', emoji: '🪟', exampleEn: 'Open the window.', exampleZh: '打开窗户。' },
  clock: { word: 'clock', translation: '钟表', phonetic: '/klɑːk/', pos: 'n.', emoji: '🕐', exampleEn: 'Look at the clock.', exampleZh: '看钟表。' },
  birthday: { word: 'birthday', translation: '生日', phonetic: '/ˈbɜːrθdeɪ/', pos: 'n.', emoji: '🎂', exampleEn: 'Happy birthday!', exampleZh: '生日快乐！' },
  gift: { word: 'gift', translation: '礼物', phonetic: '/ɡɪft/', pos: 'n.', emoji: '🎁', exampleEn: 'This is a gift for you.', exampleZh: '这是给你的礼物。' },
  toy: { word: 'toy', translation: '玩具', phonetic: '/tɔɪ/', pos: 'n.', emoji: '🧸', exampleEn: 'The toy is fun.', exampleZh: '这个玩具很好玩。' },
};

/** 规范化单词：小写、去首尾空格、去非法字符 */
export function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z'-]/g, '');
}

/** 查询离线词库；未收录返回 null */
export function lookupOffline(raw: string): OfflineEntry | null {
  return DICT[normalizeWord(raw)] ?? null;
}

/** 离线词库收录数量（用于界面提示） */
export function offlineWordCount(): number {
  return Object.keys(DICT).length;
}

/** 按首字母选一个图示 emoji（离线未收录时用） */
export function pickEmojiByWord(word: string): string {
  const pool = ['🌟', '🎈', '🐣', '🍭', '🧸', '🌈', '🐬', '🍀', '🎨', '🪁'];
  const code = word.charCodeAt(0) || 0;
  return pool[code % pool.length];
}

/**
 * 由离线词条生成草稿。
 * 这是「秒回」的关键：纯同步计算，无需等待任何网络。
 */
export function draftFromOffline(entry: OfflineEntry): LookupDraft {
  return {
    word: entry.word,
    translation: entry.translation,
    phonetic: entry.phonetic,
    syllables: splitSyllables(entry.word),
    pos: entry.pos,
    exampleEn: entry.exampleEn,
    exampleZh: entry.exampleZh,
    imageEmoji: entry.emoji,
    lookupStatus: 'offline',
    lookupSource: 'offline',
  };
}

/** 未收录时生成占位草稿（音标/翻译留占位，后台去在线补） */
export function draftPlaceholder(word: string): LookupDraft {
  return {
    word,
    translation: '暂无翻译',
    phonetic: '/—/',
    syllables: splitSyllables(word),
    imageEmoji: pickEmojiByWord(word),
    lookupStatus: 'partial',
    lookupSource: 'offline',
  };
}

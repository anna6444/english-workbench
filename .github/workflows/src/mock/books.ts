/**
 * Mock 数据 —— 低幼绘本（6 册）。
 *
 * 用 emoji 当插画：一页 = 一个 emoji + 一句英文 + 一句中文。
 * 每册 5-6 页，读完 1-2 分钟，符合「单次学习 10-15 分钟」的节奏。
 */

import type { PictureBook } from '../types';

const T = Date.parse('2026-09-01T09:00:00+08:00');

export const MOCK_BOOKS: PictureBook[] = [
  {
    id: 'bk-1',
    title: 'My Little Cat',
    titleZh: '我的小猫',
    coverEmoji: '🐱',
    level: 1,
    pages: [
      { emoji: '🐱', en: 'I have a little cat.', zh: '我有一只小猫。' },
      { emoji: '⬜', en: 'My cat is white.', zh: '我的猫是白色的。' },
      { emoji: '👀', en: 'It has two big eyes.', zh: '它有两只大眼睛。' },
      { emoji: '🥛', en: 'It likes milk.', zh: '它喜欢牛奶。' },
      { emoji: '😴', en: 'It sleeps on my bed.', zh: '它睡在我的床上。' },
      { emoji: '❤️', en: 'I love my cat.', zh: '我爱我的猫。' },
    ],
    newWords: ['cat', 'little', 'white', 'eye', 'milk', 'bed'],
    question: {
      question: '小猫喜欢喝什么？',
      options: ['牛奶', '果汁', '水'],
      correctAnswer: '牛奶',
      explanation: '绘本里说 It likes milk，所以小猫喜欢牛奶。',
    },
    estimatedMinutes: 2,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'bk-2',
    title: 'The Red Apple',
    titleZh: '红苹果',
    coverEmoji: '🍎',
    level: 1,
    pages: [
      { emoji: '🌳', en: 'This is an apple tree.', zh: '这是一棵苹果树。' },
      { emoji: '🍎', en: 'I see a red apple.', zh: '我看到一个红苹果。' },
      { emoji: '🙋', en: 'I want to eat it.', zh: '我想吃掉它。' },
      { emoji: '😋', en: 'The apple is sweet.', zh: '苹果是甜的。' },
      { emoji: '😊', en: 'I am very happy.', zh: '我非常开心。' },
    ],
    newWords: ['apple', 'tree', 'red', 'sweet', 'happy'],
    question: {
      question: '苹果是什么颜色的？',
      options: ['红色的', '黄色的', '绿色的'],
      correctAnswer: '红色的',
      explanation: '绘本里说 I see a red apple，red 就是红色。',
    },
    estimatedMinutes: 2,
    createdAt: T + 1,
    updatedAt: T + 1,
  },
  {
    id: 'bk-3',
    title: 'Go to School',
    titleZh: '去上学',
    coverEmoji: '🏫',
    level: 2,
    pages: [
      { emoji: '🌅', en: 'It is a sunny morning.', zh: '这是一个晴朗的早晨。' },
      { emoji: '🧒', en: 'I put on my bag.', zh: '我背上我的书包。' },
      { emoji: '🚶', en: 'I walk to school.', zh: '我走路去学校。' },
      { emoji: '🧑‍🏫', en: 'My teacher says hello.', zh: '我的老师跟我打招呼。' },
      { emoji: '🧑‍🤝‍🧑', en: 'I play with my friends.', zh: '我和朋友们一起玩。' },
      { emoji: '📚', en: 'I like my school.', zh: '我喜欢我的学校。' },
    ],
    newWords: ['morning', 'sunny', 'bag', 'school', 'teacher', 'play'],
    question: {
      question: '我是怎么去学校的？',
      options: ['走路', '坐车', '骑车'],
      correctAnswer: '走路',
      explanation: '绘本里说 I walk to school，walk 就是走路。',
    },
    estimatedMinutes: 3,
    createdAt: T + 2,
    updatedAt: T + 2,
  },
  {
    id: 'bk-4',
    title: 'A Big Dinner',
    titleZh: '丰盛的晚餐',
    coverEmoji: '🍽️',
    level: 2,
    pages: [
      { emoji: '🕕', en: 'It is six o\'clock.', zh: '现在六点了。' },
      { emoji: '👩', en: 'My mother cooks dinner.', zh: '我的妈妈在做晚饭。' },
      { emoji: '🍚', en: 'We have rice and fish.', zh: '我们有米饭和鱼。' },
      { emoji: '🍲', en: 'The soup is very hot.', zh: '汤非常烫。' },
      { emoji: '👨', en: 'My father likes the fish.', zh: '我的爸爸喜欢这条鱼。' },
      { emoji: '😊', en: 'We are a happy family.', zh: '我们是快乐的一家人。' },
    ],
    newWords: ['dinner', 'cook', 'rice', 'fish', 'soup', 'family'],
    question: {
      question: '晚饭是谁做的？',
      options: ['妈妈', '爸爸', '我'],
      correctAnswer: '妈妈',
      explanation: '绘本里说 My mother cooks dinner，是妈妈做的晚饭。',
    },
    estimatedMinutes: 3,
    createdAt: T + 3,
    updatedAt: T + 3,
  },
  {
    id: 'bk-5',
    title: 'The Four Seasons',
    titleZh: '四季',
    coverEmoji: '🍂',
    level: 3,
    pages: [
      { emoji: '🌸', en: 'Spring is warm. Flowers open.', zh: '春天很温暖，花儿开了。' },
      { emoji: '☀️', en: 'Summer is hot. We swim.', zh: '夏天很热，我们游泳。' },
      { emoji: '🍁', en: 'Autumn is cool. Leaves fall.', zh: '秋天很凉爽，叶子落了。' },
      { emoji: '❄️', en: 'Winter is cold. It snows.', zh: '冬天很冷，下雪了。' },
      { emoji: '🌈', en: 'I like all four seasons.', zh: '我喜欢全部四个季节。' },
    ],
    newWords: ['spring', 'summer', 'autumn', 'winter', 'warm', 'cold'],
    question: {
      question: '哪个季节会下雪？',
      options: ['冬天', '夏天', '春天'],
      correctAnswer: '冬天',
      explanation: '绘本里说 Winter is cold. It snows. 冬天会下雪。',
    },
    estimatedMinutes: 3,
    createdAt: T + 4,
    updatedAt: T + 4,
  },
  {
    id: 'bk-6',
    title: 'My Day',
    titleZh: '我的一天',
    coverEmoji: '⏰',
    level: 3,
    pages: [
      { emoji: '🌅', en: 'I get up at seven.', zh: '我七点起床。' },
      { emoji: '🥛', en: 'I have milk for breakfast.', zh: '我早餐喝牛奶。' },
      { emoji: '📚', en: 'I study English at school.', zh: '我在学校学英语。' },
      { emoji: '⚽', en: 'I play football after school.', zh: '放学后我踢足球。' },
      { emoji: '🍽️', en: 'I have dinner with my family.', zh: '我和家人一起吃晚饭。' },
      { emoji: '😴', en: 'I go to bed at nine.', zh: '我九点上床睡觉。' },
    ],
    newWords: ['get up', 'breakfast', 'study', 'football', 'dinner', 'bed'],
    question: {
      question: '我几点上床睡觉？',
      options: ['九点', '七点', '十点'],
      correctAnswer: '九点',
      explanation: '最后一页说 I go to bed at nine，九点睡觉。',
    },
    estimatedMinutes: 4,
    createdAt: T + 5,
    updatedAt: T + 5,
  },
];

export function findBook(id: string): PictureBook | undefined {
  return MOCK_BOOKS.find((b) => b.id === id);
}

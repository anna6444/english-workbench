/**
 * Mock 数据 —— 听力电台（6 期）。
 *
 * 音频不存文件：每期只存 audioText 朗读文稿，播放时由 useSpeech 现场合成。
 * 好处是零音频资源依赖（外链 CDN 在家庭网络里随时可能挂），包体也极小。
 *
 * 语速刻意偏慢：0.7 / 0.75 / 0.8，对应 level 1 / 2 / 3。
 */

import type { ListeningEpisode, Question } from '../types';

const T = Date.parse('2026-09-01T08:30:00+08:00');

/** 听力节目里的理解题：不单独入库，随节目一起走 */
function q(
  id: string,
  question: string,
  options: string[],
  correctAnswer: string,
  explanation: string,
  emoji: string,
  base: number,
): Question {
  return {
    id,
    type: 'listening',
    question,
    options,
    correctAnswer,
    explanation,
    image: { emoji, labelZh: '听一听' },
    points: 5,
    createdAt: base,
    updatedAt: base,
  };
}

export const MOCK_EPISODES: ListeningEpisode[] = [
  {
    id: 'ep-1',
    title: 'My Morning',
    titleZh: '我的早晨',
    coverEmoji: '🌅',
    level: 1,
    audioText:
      'Good morning! I get up at seven. I wash my face. I eat bread and drink milk. Then I go to school.',
    translationZh:
      '早上好！我七点起床。我洗脸。我吃面包、喝牛奶。然后我去上学。',
    questions: [
      q('ep-1-q1', '我几点起床？', ['七点', '八点', '六点'], '七点', '短文里说 get up at seven，就是七点起床。', '⏰', T),
      q('ep-1-q2', '早餐我喝了什么？', ['牛奶', '果汁', '水'], '牛奶', 'I drink milk 就是喝牛奶。', '🥛', T + 1),
    ],
    speechRate: 0.7,
    estimatedMinutes: 3,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'ep-2',
    title: 'My Family',
    titleZh: '我的家人',
    coverEmoji: '👨‍👩‍👧',
    level: 1,
    audioText:
      'This is my family. My father is tall. My mother is kind. I have a little sister. I love them very much.',
    translationZh:
      '这是我的家人。我的爸爸很高。我的妈妈很温柔。我有一个小妹妹。我非常爱他们。',
    questions: [
      q('ep-2-q1', '我的爸爸怎么样？', ['很高', '很矮', '很胖'], '很高', 'My father is tall，tall 就是高。', '👨', T + 2),
      q('ep-2-q2', '我有一个……？', ['小妹妹', '小弟弟', '大哥哥'], '小妹妹', 'a little sister 就是一个小妹妹。', '👧', T + 3),
    ],
    speechRate: 0.7,
    estimatedMinutes: 3,
    createdAt: T + 1,
    updatedAt: T + 1,
  },
  {
    id: 'ep-3',
    title: 'At the Zoo',
    titleZh: '在动物园',
    coverEmoji: '🦁',
    level: 2,
    audioText:
      'Today we go to the zoo. I can see a big lion. The monkey is eating a banana. The elephant is very big. I like the zoo.',
    translationZh:
      '今天我们去了动物园。我看到一只大狮子。猴子在吃香蕉。大象非常大。我喜欢动物园。',
    questions: [
      q('ep-3-q1', '猴子在吃什么？', ['香蕉', '苹果', '面包'], '香蕉', 'The monkey is eating a banana，猴在吃香蕉。', '🐒', T + 4),
      q('ep-3-q2', '在哪里的动物非常大？', ['大象', '猴子', '狮子'], '大象', 'The elephant is very big，大象非常大。', '🐘', T + 5),
    ],
    speechRate: 0.75,
    estimatedMinutes: 4,
    createdAt: T + 2,
    updatedAt: T + 2,
  },
  {
    id: 'ep-4',
    title: 'My Lunch',
    titleZh: '我的午饭',
    coverEmoji: '🍱',
    level: 2,
    audioText:
      'It is twelve o\'clock. Time for lunch! I have rice, fish and soup. The soup is hot. I drink water after lunch.',
    translationZh:
      '现在十二点了。该吃午饭啦！我吃米饭、鱼和汤。汤很烫。午饭后我喝水。',
    questions: [
      q('ep-4-q1', '午饭我吃了什么？', ['米饭、鱼和汤', '面包和牛奶', '蛋糕'], '米饭、鱼和汤', '短文说 I have rice, fish and soup。', '🍚', T + 6),
      q('ep-4-q2', '汤是热的还是凉的？', ['很烫', '很凉', '很甜'], '很烫', 'The soup is hot，hot 就是烫的。', '🍲', T + 7),
    ],
    speechRate: 0.75,
    estimatedMinutes: 4,
    createdAt: T + 3,
    updatedAt: T + 3,
  },
  {
    id: 'ep-5',
    title: 'Rainy Day',
    titleZh: '下雨天',
    coverEmoji: '🌧️',
    level: 3,
    audioText:
      'It is raining today. I can not go out to play. I stay at home. I read a book with my mother. We are happy together.',
    translationZh:
      '今天下雨了。我不能出去玩。我待在家里。我和妈妈一起看书。我们在一起很开心。',
    questions: [
      q('ep-5-q1', '今天天气怎么样？', ['下雨', '晴天', '下雪'], '下雨', 'It is raining today，今天在下雨。', '🌧️', T + 8),
      q('ep-5-q2', '我和谁一起看书？', ['妈妈', '爸爸', '老师'], '妈妈', 'read a book with my mother，和妈妈一起看书。', '👩', T + 9),
    ],
    speechRate: 0.8,
    estimatedMinutes: 4,
    createdAt: T + 4,
    updatedAt: T + 4,
  },
  {
    id: 'ep-6',
    title: 'My Best Friend',
    titleZh: '我最好的朋友',
    coverEmoji: '🧑‍🤝‍🧑',
    level: 3,
    audioText:
      'My best friend is Lily. She is eight years old. She likes apples and candy. We play together every day. She is very kind.',
    translationZh:
      '我最好的朋友是 Lily。她八岁了。她喜欢苹果和糖果。我们每天一起玩。她非常友善。',
    questions: [
      q('ep-6-q1', 'Lily 几岁了？', ['八岁', '七岁', '九岁'], '八岁', 'She is eight years old，她八岁。', '🎂', T + 10),
      q('ep-6-q2', 'Lily 喜欢什么？', ['苹果和糖果', '肉和汤', '面包'], '苹果和糖果', 'She likes apples and candy。', '🍬', T + 11),
    ],
    speechRate: 0.8,
    estimatedMinutes: 5,
    createdAt: T + 5,
    updatedAt: T + 5,
  },
];

export function findEpisode(id: string): ListeningEpisode | undefined {
  return MOCK_EPISODES.find((e) => e.id === id);
}

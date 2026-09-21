import type { BaseEntity, ID } from './base';
import type { Question } from './question';

/**
 * 听力电台一期节目。
 * 音频不存文件，而是存朗读文稿 —— 由 TTS 现场合成，
 * 这样既不依赖任何音频 CDN，包体也极小。
 */
export interface ListeningEpisode extends BaseEntity {
  title: string;
  titleZh: string;
  coverEmoji: string;
  /** 难度：1 最慢最简单 */
  level: 1 | 2 | 3;
  /** 朗读文稿（英文），会被 TTS 慢速朗读 */
  audioText: string;
  /** 中文对照，帮助家长辅导 */
  translationZh: string;
  /** 收听后的理解题 */
  questions: Question[];
  /** 朗读语速倍率，听力偏慢：0.7 / 0.8 / 0.9 */
  speechRate: number;
  estimatedMinutes: number;
}

/**
 * 全局设置仓储 —— localStorage 实现。
 * key = egw:v1:settings（不分学生，家长改完全局生效）。
 */

import type { SystemSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { storage } from '@/storage/StorageManager';
import { GLOBAL_KEYS } from '@/storage/keys';
import type { SettingsRepository as ISettingsRepository } from '../types';

export class SettingsRepositoryImpl implements ISettingsRepository {
  async getSettings(): Promise<SystemSettings> {
    return storage.get<SystemSettings>(GLOBAL_KEYS.settings, { ...DEFAULT_SETTINGS });
  }

  async updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
    const cur = await this.getSettings();
    const next: SystemSettings = { ...cur, ...patch, updatedAt: Date.now() };
    storage.set<SystemSettings>(GLOBAL_KEYS.settings, next);
    return next;
  }
}

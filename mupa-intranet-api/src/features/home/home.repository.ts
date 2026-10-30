import { eq } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { homeLayouts, homeSettings } from '../../database/schema/index.ts'

export type HomeSettingKey = 'content' | 'default_layout'

export class HomeRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findSetting(key: HomeSettingKey): Promise<unknown> {
    const [row] = await this.db.select({ value: homeSettings.value }).from(homeSettings).where(eq(homeSettings.key, key)).limit(1)
    return row?.value ?? null
  }

  async saveSetting(key: HomeSettingKey, value: unknown): Promise<void> {
    await this.db.insert(homeSettings).values({ key, value }).onConflictDoUpdate({ target: homeSettings.key, set: { value, updatedAt: new Date() } })
  }

  async deleteSetting(key: HomeSettingKey): Promise<void> {
    await this.db.delete(homeSettings).where(eq(homeSettings.key, key))
  }

  async findLayoutByUserId(userId: number): Promise<unknown> {
    const [row] = await this.db.select({ layout: homeLayouts.layout }).from(homeLayouts).where(eq(homeLayouts.userId, userId)).limit(1)
    return row?.layout ?? null
  }

  async saveLayout(userId: number, layout: unknown): Promise<void> {
    await this.db
      .insert(homeLayouts)
      .values({ userId, layout })
      .onConflictDoUpdate({ target: homeLayouts.userId, set: { layout, updatedAt: new Date() } })
  }

  async deleteLayout(userId: number): Promise<void> {
    await this.db.delete(homeLayouts).where(eq(homeLayouts.userId, userId))
  }
}

export const homeRepository = new HomeRepository(db)

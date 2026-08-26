import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const EnvSchema = z.object({ DATABASE_URL: z.string().url(), TODO_TEST_DATABASE_URL: z.string().url().optional(), API_PORT: z.coerce.number().int().positive().default(3001) });
export type Config = z.infer<typeof EnvSchema>;
export function readConfig(env: unknown = process.env): Config { const result = EnvSchema.safeParse(env); if (!result.success) throw new Error('数据库配置无效，请检查 DATABASE_URL'); return result.data; }

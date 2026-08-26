import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config({path:new URL('../.env',import.meta.url)});
export default defineConfig({testDir:'.',use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},webServer:[{command:'pnpm --filter @todo/api dev',url:'http://127.0.0.1:3001',reuseExistingServer:true,env:{DATABASE_URL:process.env.DATABASE_URL ?? '',TODO_TEST_DATABASE_URL:process.env.TODO_TEST_DATABASE_URL ?? ''}},{command:'pnpm --filter @todo/web dev --host 127.0.0.1',url:'http://127.0.0.1:5173',reuseExistingServer:true,env:{VITE_API_BASE_URL:'http://127.0.0.1:3001'}}],});

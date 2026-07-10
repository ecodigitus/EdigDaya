import { startBot } from './whatsapp';
import { logger } from './logger';
import { config, aiEnabled, activeModel, activeKeyEnv } from './config';
import { cleanup } from './session';
import { dbEnabled } from './db';
import { hydrateMembers } from './members';
import { hydratePreOrders } from './preorder';

async function main(): Promise<void> {
  logger.info(
    { aiEnabled, provider: config.ai.provider, model: aiEnabled ? activeModel : 'disabled' },
    '🤖 Memulai WhatsApp CS Chatbot...',
  );

  if (!aiEnabled) {
    logger.warn(
      `${activeKeyEnv} kosong — bot jalan mode rule-based (menu) saja. Isi .env untuk aktifkan AI (${config.ai.provider}).`,
    );
  }

  // Muat data awal dari Supabase (seed) — read bot tetap sinkron sesudahnya.
  if (dbEnabled) {
    const [nMembers, nPo] = await Promise.all([hydrateMembers(), hydratePreOrders()]);
    logger.info({ members: nMembers, preOrders: nPo }, '🗄️  Data dimuat dari Supabase');
  } else {
    logger.info('🗄️  Supabase nonaktif (SUPABASE_* kosong) — pakai data dummy in-memory');
  }

  // Bersih-bersih sesi tidak aktif tiap 5 menit (mencegah memory bocor)
  setInterval(() => cleanup(config.limits.sessionTtlMinutes), 5 * 60_000).unref();

  await startBot();
}

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
process.on('SIGINT', () => {
  logger.info('👋 Menutup bot...');
  process.exit(0);
});

main().catch((err) => {
  logger.error({ err }, 'Fatal error saat start');
  process.exit(1);
});

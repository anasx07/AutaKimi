import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Mock schema
const testTable = sqliteTable('test', {
  mangaId: text('manga_id'),
  coverUrl: text('cover_url'),
});

console.log('Keys in testTable:');
Object.keys(testTable).forEach(key => {
  if (key !== '_' && key !== '$inferSelect' && key !== '$inferInsert') {
    console.log(`- ${key}: ${testTable[key].name}`);
  }
});

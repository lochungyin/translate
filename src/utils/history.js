import Database from 'tauri-plugin-sql-api';
let database;

export function getHistoryDatabase() {
    if (!database) {
        database = Database.load('sqlite:history.db')
            .then(async (db) => {
                await db.execute(
                    'CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, source TEXT NOT NULL, target TEXT NOT NULL, service TEXT NOT NULL, result TEXT NOT NULL, timestamp INTEGER NOT NULL)'
                );
                return db;
            })
            .catch((error) => {
                database = undefined;
                throw error;
            });
    }
    return database;
}

export async function clearHistoryDatabase(db) {
    await db.execute('DELETE FROM history');
    await db.execute('VACUUM');
}

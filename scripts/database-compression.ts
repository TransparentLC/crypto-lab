import Database from 'better-sqlite3';

const db = new Database('./database/database.db');
db.loadExtension(process.platform === 'win32' ? './database/sqlite_zstd.dll' : './database/libsqlite_zstd.so');
db.exec('PRAGMA journal_mode = WAL');

([
    {
        table: 'experiments',
        column: 'description',
        compression_level: 12,
        dict_chooser: "'[nodict]'",
    },
    {
        table: 'experiments',
        column: 'compile_commands',
        compression_level: 12,
        dict_chooser: "'[nodict]'",
    },
    {
        table: 'submissions',
        column: 'code',
        compression_level: 12,
        dict_chooser: "'[nodict]'",
    },
    {
        table: 'submissions',
        column: 'compile_output',
        compression_level: 12,
        dict_chooser: "'[nodict]'",
    },
    {
        table: 'submissions',
        column: 'result',
        compression_level: 12,
        dict_chooser: "'[nodict]'",
    },
] as SQLiteZSTD.TransparentCompressConfig[]).forEach(e => {
    try {
        db.prepare('SELECT zstd_enable_transparent(?)').bind(JSON.stringify(e)).run();
    } catch (err) {
        if (!(err as Error).message.match(/^Column .+? is already enabled for compression\.$/g)) throw err;
    }
});
try {
    db.prepare('SELECT zstd_incremental_maintenance(?, ?)').bind(null, 1).run();
} catch (err) {
    console.log(err);
}
db.exec('VACUUM');

package com.orbis.research

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** Everything the app keeps: the sources, the queue of addresses to read, documents and their paragraphs. */
class Db private constructor(ctx: Context) : SQLiteOpenHelper(ctx, "orbis.db", null, 1) {

    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""CREATE TABLE sources(id INTEGER PRIMARY KEY, url TEXT NOT NULL, name TEXT NOT NULL,
            scope TEXT NOT NULL UNIQUE, added_at INTEGER NOT NULL)""")
        db.execSQL("""CREATE TABLE queue(url TEXT PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            lastmod TEXT NOT NULL DEFAULT '', state INTEGER NOT NULL DEFAULT 0, added_at INTEGER NOT NULL)""")
        db.execSQL("CREATE INDEX queue_pick ON queue(source_id, state, lastmod)")
        db.execSQL("""CREATE TABLE docs(id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, date TEXT NOT NULL, fetched_at INTEGER NOT NULL)""")
        db.execSQL("""CREATE TABLE paras(id INTEGER PRIMARY KEY, doc_id INTEGER NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
            idx INTEGER NOT NULL, text TEXT NOT NULL)""")
        db.execSQL("CREATE INDEX paras_doc ON paras(doc_id)")
        // Word index over the paragraphs; English word endings are folded (taxes -> tax).
        db.execSQL("CREATE VIRTUAL TABLE paras_fts USING fts4(text, tokenize=porter)")
        db.execSQL("CREATE TRIGGER paras_del AFTER DELETE ON paras BEGIN DELETE FROM paras_fts WHERE docid = old.id; END")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    // ---- sources ----

    fun sources(): List<Source> = readableDatabase.rawQuery(
        """SELECT s.id, s.url, s.name, s.scope, s.added_at, (SELECT COUNT(*) FROM docs d WHERE d.source_id = s.id)
           FROM sources s ORDER BY s.name COLLATE NOCASE""", null,
    ).use { c ->
        buildList { while (c.moveToNext()) add(Source(c.getLong(0), c.getString(1), c.getString(2), c.getString(3), c.getLong(4), c.getInt(5))) }
    }

    /** Adds the sources whose scope is not already listed; returns how many were new. */
    fun addSources(list: List<SourceInput>): Int {
        val db = writableDatabase
        var added = 0
        db.beginTransaction()
        try {
            val now = System.currentTimeMillis()
            for (s in list) {
                val v = ContentValues().apply {
                    put("url", s.url); put("name", s.name); put("scope", s.scope); put("added_at", now)
                }
                if (db.insertWithOnConflict("sources", null, v, SQLiteDatabase.CONFLICT_IGNORE) > 0) added++
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        return added
    }

    /** Removes sources together with every document and paragraph read from them. */
    fun removeSources(ids: Collection<Long>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (id in ids) db.delete("sources", "id = ?", arrayOf(id.toString()))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    fun renameSource(id: Long, name: String) {
        writableDatabase.update("sources", ContentValues().apply { put("name", name) }, "id = ?", arrayOf(id.toString()))
    }

    // ---- queue ----

    fun enqueue(sourceId: Long, urls: List<Pair<String, String>>): Int {
        val db = writableDatabase
        var n = 0
        db.beginTransaction()
        try {
            val now = System.currentTimeMillis()
            for ((url, lastmod) in urls) {
                val v = ContentValues().apply {
                    put("url", url); put("source_id", sourceId); put("lastmod", lastmod); put("added_at", now)
                }
                if (db.insertWithOnConflict("queue", null, v, SQLiteDatabase.CONFLICT_IGNORE) > 0) n++
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        return n
    }

    /** Next unread addresses of a source, newest first; addresses without a date come last. */
    fun nextInQueue(sourceId: Long, limit: Int): List<String> = readableDatabase.rawQuery(
        "SELECT url FROM queue WHERE source_id = ? AND state = 0 ORDER BY lastmod = '', lastmod DESC, added_at LIMIT ?",
        arrayOf(sourceId.toString(), limit.toString()),
    ).use { c -> buildList { while (c.moveToNext()) add(c.getString(0)) } }

    fun markQueued(url: String, state: Int) {
        writableDatabase.update("queue", ContentValues().apply { put("state", state) }, "url = ?", arrayOf(url))
    }

    fun queueCount(sourceId: Long, state: Int): Int = readableDatabase.rawQuery(
        "SELECT COUNT(*) FROM queue WHERE source_id = ? AND state = ?", arrayOf(sourceId.toString(), state.toString()),
    ).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }

    fun queueSize(sourceId: Long): Int = readableDatabase.rawQuery(
        "SELECT COUNT(*) FROM queue WHERE source_id = ?", arrayOf(sourceId.toString()),
    ).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }

    // ---- documents ----

    fun hasDoc(url: String): Boolean = readableDatabase.rawQuery(
        "SELECT 1 FROM docs WHERE url = ?", arrayOf(url),
    ).use { it.moveToFirst() }

    fun saveDoc(sourceId: Long, url: String, title: String, date: String, paragraphs: List<String>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val docId = db.insertWithOnConflict("docs", null, ContentValues().apply {
                put("source_id", sourceId); put("url", url); put("title", title); put("date", date)
                put("fetched_at", System.currentTimeMillis())
            }, SQLiteDatabase.CONFLICT_IGNORE)
            if (docId > 0) {
                paragraphs.forEachIndexed { i, p ->
                    val pid = db.insert("paras", null, ContentValues().apply {
                        put("doc_id", docId); put("idx", i); put("text", p)
                    })
                    db.insert("paras_fts", null, ContentValues().apply { put("docid", pid); put("text", p) })
                }
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    fun totals(): Pair<Int, Int> = readableDatabase.rawQuery(
        "SELECT (SELECT COUNT(*) FROM docs), (SELECT COUNT(*) FROM paras)", null,
    ).use { c -> c.moveToFirst(); c.getInt(0) to c.getInt(1) }

    // ---- search ----

    /** Paragraph ids matching an FTS query (all its words), at most [limit]. */
    fun match(query: String, limit: Int): List<Long> = try {
        readableDatabase.rawQuery(
            "SELECT docid FROM paras_fts WHERE paras_fts MATCH ? LIMIT ?", arrayOf(query, limit.toString()),
        ).use { c -> buildList { while (c.moveToNext()) add(c.getLong(0)) } }
    } catch (e: Exception) { emptyList() }

    fun paragraph(id: Long): Paragraph? = readableDatabase.rawQuery(
        """SELECT p.id, p.text, d.url, d.title, d.date, s.name FROM paras p
           JOIN docs d ON d.id = p.doc_id JOIN sources s ON s.id = d.source_id WHERE p.id = ?""",
        arrayOf(id.toString()),
    ).use { c -> if (c.moveToFirst()) Paragraph(c.getLong(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4), c.getString(5)) else null }

    companion object {
        @Volatile private var instance: Db? = null
        fun get(ctx: Context): Db = instance ?: synchronized(this) { instance ?: Db(ctx.applicationContext).also { instance = it } }
    }
}

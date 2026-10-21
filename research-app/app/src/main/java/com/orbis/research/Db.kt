package com.orbis.research

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** Everything the app keeps: the sources, the queue of addresses to read, documents and their paragraphs. */
class Db private constructor(ctx: Context) : SQLiteOpenHelper(ctx, "orbis.db", null, 2) {

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
        createGroups(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) createGroups(db)
    }

    /** Headings (version 2): removing a heading leaves its sources; removing a source leaves the heading. */
    private fun createGroups(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE headings(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE)")
        db.execSQL("""CREATE TABLE source_headings(source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            heading_id INTEGER NOT NULL REFERENCES headings(id) ON DELETE CASCADE, PRIMARY KEY(source_id, heading_id))""")
        db.execSQL("CREATE INDEX source_headings_heading ON source_headings(heading_id)")
    }

    // ---- sources ----

    fun sources(): List<Source> = readableDatabase.rawQuery(
        """SELECT s.id, s.url, s.name, s.scope, s.added_at, (SELECT COUNT(*) FROM docs d WHERE d.source_id = s.id),
                  (SELECT group_concat(g.name, char(31)) FROM source_headings sg JOIN headings g ON g.id = sg.heading_id WHERE sg.source_id = s.id)
           FROM sources s ORDER BY s.name COLLATE NOCASE""", null,
    ).use { c ->
        buildList {
            while (c.moveToNext()) {
                val groups = c.getString(6)?.split('\u001f')?.sortedBy { it.lowercase() } ?: emptyList()
                add(Source(c.getLong(0), c.getString(1), c.getString(2), c.getString(3), c.getLong(4), c.getInt(5), groups))
            }
        }
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
                // Headings in an imported list also apply to sources already on the phone.
                if (s.groups.isNotEmpty()) {
                    val id = db.rawQuery("SELECT id FROM sources WHERE scope = ?", arrayOf(s.scope)).use { c -> if (c.moveToFirst()) c.getLong(0) else null }
                    if (id != null) for (g in s.groups) link(db, id, groupId(db, g))
                }
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

    // ---- headings ----

    fun groups(): List<Group> = readableDatabase.rawQuery(
        """SELECT g.id, g.name, (SELECT COUNT(*) FROM source_headings sg WHERE sg.heading_id = g.id)
           FROM headings g ORDER BY g.name COLLATE NOCASE""", null,
    ).use { c -> buildList { while (c.moveToNext()) add(Group(c.getLong(0), c.getString(1), c.getInt(2))) } }

    private fun groupId(db: SQLiteDatabase, name: String): Long {
        db.insertWithOnConflict("headings", null, ContentValues().apply { put("name", name.trim()) }, SQLiteDatabase.CONFLICT_IGNORE)
        return db.rawQuery("SELECT id FROM headings WHERE name = ?", arrayOf(name.trim())).use { c -> c.moveToFirst(); c.getLong(0) }
    }

    private fun link(db: SQLiteDatabase, sourceId: Long, groupId: Long) {
        db.insertWithOnConflict("source_headings", null, ContentValues().apply {
            put("source_id", sourceId); put("heading_id", groupId)
        }, SQLiteDatabase.CONFLICT_IGNORE)
    }

    /** Puts the sources under the named heading, creating it if it is new. */
    fun addToGroup(sourceIds: Collection<Long>, name: String) = tx { db ->
        val g = groupId(db, name)
        for (id in sourceIds) link(db, id, g)
    }

    fun removeFromGroup(sourceIds: Collection<Long>, groupId: Long) = tx { db ->
        for (id in sourceIds) db.delete("source_headings", "source_id = ? AND heading_id = ?", arrayOf(id.toString(), groupId.toString()))
    }

    /** Renames a heading; if another heading already has the new name, the two become one. */
    fun renameGroup(groupId: Long, name: String) = tx { db ->
        val other = db.rawQuery("SELECT id FROM headings WHERE name = ? AND id <> ?", arrayOf(name.trim(), groupId.toString()))
            .use { c -> if (c.moveToFirst()) c.getLong(0) else null }
        if (other == null) {
            db.update("headings", ContentValues().apply { put("name", name.trim()) }, "id = ?", arrayOf(groupId.toString()))
        } else {
            db.execSQL("INSERT OR IGNORE INTO source_headings(source_id, heading_id) SELECT source_id, ? FROM source_headings WHERE heading_id = ?", arrayOf(other, groupId))
            db.delete("headings", "id = ?", arrayOf(groupId.toString()))
        }
    }

    fun deleteGroup(groupId: Long) = tx { db -> db.delete("headings", "id = ?", arrayOf(groupId.toString())) }

    /** The sources under any of the given headings. */
    fun sourcesIn(groupIds: Collection<Long>): Set<Long> {
        if (groupIds.isEmpty()) return emptySet()
        return readableDatabase.rawQuery(
            "SELECT DISTINCT source_id FROM source_headings WHERE heading_id IN (${groupIds.joinToString(",")})", null,
        ).use { c -> buildSet { while (c.moveToNext()) add(c.getLong(0)) } }
    }

    private fun <T> tx(block: (SQLiteDatabase) -> T): T {
        val db = writableDatabase
        db.beginTransaction()
        try { return block(db).also { db.setTransactionSuccessful() } } finally { db.endTransaction() }
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

    /**
     * Paragraph ids matching an FTS query (all its words) in documents dated within [range], from the
     * given sources (null: all), at most [limit].
     */
    fun match(query: String, limit: Int, range: DateRange = DateRange(), sourceIds: Set<Long>? = null): List<Long> = try {
        if (sourceIds != null && sourceIds.isEmpty()) return emptyList()
        val (cond, args) = range.sqlCondition("d.date")
        readableDatabase.rawQuery(
            """SELECT paras_fts.docid FROM paras_fts JOIN paras p ON p.id = paras_fts.docid JOIN docs d ON d.id = p.doc_id
               WHERE paras_fts MATCH ? AND $cond ${inSources(sourceIds)} LIMIT ?""",
            (listOf(query) + args + limit.toString()).toTypedArray(),
        ).use { c -> buildList { while (c.moveToNext()) add(c.getLong(0)) } }
    } catch (e: Exception) { emptyList() }

    /** (documents in [range], of which undated) — undated ones are counted only when the range takes them. */
    fun docsIn(range: DateRange, sourceIds: Set<Long>? = null): Pair<Int, Int> {
        if (sourceIds != null && sourceIds.isEmpty()) return 0 to 0
        val (cond, args) = range.sqlCondition("d.date")
        return readableDatabase.rawQuery(
            "SELECT COUNT(*), SUM(d.date = '') FROM docs d WHERE $cond ${inSources(sourceIds)}", args.toTypedArray(),
        ).use { c -> c.moveToFirst(); c.getInt(0) to c.getInt(1) }
    }

    // Source ids are numbers the app made itself, so they go into the query as they are.
    private fun inSources(ids: Set<Long>?) = if (ids == null) "" else "AND d.source_id IN (${ids.joinToString(",")})"

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

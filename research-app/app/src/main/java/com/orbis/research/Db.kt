package com.orbis.research

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Everything the app keeps: the sources and their headings, the queue of addresses to read,
 * documents, their paragraphs and the meaning vector of each, and the search under way.
 */
class Db private constructor(ctx: Context) : SQLiteOpenHelper(ctx, "orbis.db", null, 4) {

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
        createGroups(db)
        createMeaning(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) createGroups(db)
        if (oldVersion < 3) {
            // Version 1 and 2 searched by words; meaning vectors replace the word index.
            db.execSQL("DROP TRIGGER IF EXISTS paras_del")
            db.execSQL("DROP TABLE IF EXISTS paras_fts")
            createMeaning(db)
        } else if (oldVersion < 4) {
            db.execSQL("ALTER TABLE search_run ADD COLUMN english TEXT")
        }
    }

    /**
     * Version 3: a meaning vector per paragraph, and the search under way, kept so a search the
     * phone interrupts goes on from the paragraph it had reached.
     */
    private fun createMeaning(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE para_vec(para_id INTEGER PRIMARY KEY REFERENCES paras(id) ON DELETE CASCADE, vec BLOB NOT NULL)")
        db.execSQL("""CREATE TABLE search_run(id INTEGER PRIMARY KEY CHECK (id = 1), claim TEXT NOT NULL, date_from TEXT,
            date_to TEXT, undated INTEGER NOT NULL, sources TEXT, state INTEGER NOT NULL, prepared INTEGER NOT NULL DEFAULT 0,
            suggestion TEXT, message TEXT, started_at INTEGER NOT NULL, english TEXT)""")
        db.execSQL("CREATE TABLE search_items(idx INTEGER PRIMARY KEY, para_id INTEGER NOT NULL, answer TEXT, judged INTEGER NOT NULL DEFAULT 0)")
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
                    db.insert("paras", null, ContentValues().apply {
                        put("doc_id", docId); put("idx", i); put("text", p)
                    })
                }
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    fun totals(): Pair<Int, Int> = readableDatabase.rawQuery(
        "SELECT (SELECT COUNT(*) FROM docs), (SELECT COUNT(*) FROM paras)", null,
    ).use { c -> c.moveToFirst(); c.getInt(0) to c.getInt(1) }

    // ---- search ----

    // ---- meaning ----

    /** Paragraphs that have no meaning vector yet, oldest first. */
    fun unindexed(limit: Int): List<Pair<Long, String>> = readableDatabase.rawQuery(
        "SELECT p.id, p.text FROM paras p LEFT JOIN para_vec v ON v.para_id = p.id WHERE v.para_id IS NULL ORDER BY p.id LIMIT ?",
        arrayOf(limit.toString()),
    ).use { c -> buildList { while (c.moveToNext()) add(c.getLong(0) to c.getString(1)) } }

    fun saveVectors(vectors: List<Pair<Long, ByteArray>>) = tx { db ->
        for ((id, v) in vectors) db.insertWithOnConflict("para_vec", null, ContentValues().apply {
            put("para_id", id); put("vec", v)
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun clearVectors() { writableDatabase.delete("para_vec", null, null) }

    /** (paragraphs with a vector, paragraphs without one). */
    fun vectorCounts(): Pair<Int, Int> = readableDatabase.rawQuery(
        "SELECT (SELECT COUNT(*) FROM para_vec), (SELECT COUNT(*) FROM paras p WHERE NOT EXISTS (SELECT 1 FROM para_vec v WHERE v.para_id = p.id))", null,
    ).use { c -> c.moveToFirst(); c.getInt(0) to c.getInt(1) }

    /**
     * The [k] paragraphs closest in meaning to [query], among documents dated within [range] from the
     * given sources (null: all), closest first.
     */
    fun closest(query: FloatArray, k: Int, range: DateRange, sourceIds: Set<Long>?): List<Long> {
        if (sourceIds != null && sourceIds.isEmpty()) return emptyList()
        val (cond, args) = range.sqlCondition("d.date")
        val best = java.util.PriorityQueue<Pair<Float, Long>>(k + 1, compareBy { it.first })
        readableDatabase.rawQuery(
            """SELECT v.para_id, v.vec FROM para_vec v JOIN paras p ON p.id = v.para_id JOIN docs d ON d.id = p.doc_id
               WHERE $cond ${inSources(sourceIds)}""", args.toTypedArray(),
        ).use { c ->
            while (c.moveToNext()) {
                best.add(Vectors.score(c.getBlob(1), query) to c.getLong(0))
                if (best.size > k) best.poll()
            }
        }
        return best.sortedByDescending { it.first }.map { it.second }
    }

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

    // ---- the search under way ----

    /** Starts a new search, replacing the last one. */
    fun newRun(claim: String, range: DateRange, sourceIds: Set<Long>?) = tx { db ->
        db.delete("search_items", null, null)
        db.delete("search_run", null, null)
        db.insert("search_run", null, ContentValues().apply {
            put("id", 1); put("claim", claim); put("date_from", range.from); put("date_to", range.to)
            put("undated", if (range.includeUndated) 1 else 0); put("sources", sourceIds?.joinToString(","))
            put("state", RUN_GOING); put("started_at", System.currentTimeMillis())
        })
    }

    fun run(): SearchRun? = readableDatabase.rawQuery(
        """SELECT claim, date_from, date_to, undated, sources, state, prepared, suggestion, message, started_at,
                  (SELECT COUNT(*) FROM search_items), (SELECT COUNT(*) FROM search_items WHERE judged = 1), english
           FROM search_run WHERE id = 1""", null,
    ).use { c ->
        if (!c.moveToFirst()) null else SearchRun(
            claim = c.getString(0),
            range = DateRange(c.getString(1), c.getString(2), c.getInt(3) == 1),
            sourceIds = c.getString(4)?.split(',')?.filter { it.isNotEmpty() }?.map { it.toLong() }?.toSet(),
            state = c.getInt(5), prepared = c.getInt(6) == 1, suggestion = c.getString(7), message = c.getString(8),
            startedAt = c.getLong(9), total = c.getInt(10), done = c.getInt(11), english = c.getString(12),
        )
    }

    fun setRun(state: Int? = null, prepared: Boolean? = null, suggestion: String? = null, message: String? = null, english: String? = null) {
        val v = ContentValues()
        english?.let { v.put("english", it) }
        state?.let { v.put("state", it) }
        prepared?.let { v.put("prepared", if (it) 1 else 0) }
        suggestion?.let { v.put("suggestion", it) }
        message?.let { v.put("message", it) }
        if (v.size() > 0) writableDatabase.update("search_run", v, "id = 1", null)
    }

    fun setItems(paraIds: List<Long>) = tx { db ->
        db.delete("search_items", null, null)
        paraIds.forEachIndexed { i, id -> db.insert("search_items", null, ContentValues().apply { put("idx", i); put("para_id", id) }) }
    }

    /** Paragraphs of the search not yet read by the model, in order. */
    fun pendingItems(): List<Pair<Int, Long>> = readableDatabase.rawQuery(
        "SELECT idx, para_id FROM search_items WHERE judged = 0 ORDER BY idx", null,
    ).use { c -> buildList { while (c.moveToNext()) add(c.getInt(0) to c.getLong(1)) } }

    /** Saves an answer, but only into the search it belongs to (a new search may have replaced it). */
    fun saveAnswer(idx: Int, answer: String?, runStartedAt: Long) {
        writableDatabase.update(
            "search_items", ContentValues().apply { put("answer", answer); put("judged", 1) },
            "idx = ? AND (SELECT started_at FROM search_run WHERE id = 1) = ?", arrayOf(idx.toString(), runStartedAt.toString()),
        )
    }

    /** What the model said about each paragraph read so far, in order. */
    fun answers(): List<Pair<Long, String?>> = readableDatabase.rawQuery(
        "SELECT para_id, answer FROM search_items WHERE judged = 1 ORDER BY idx", null,
    ).use { c -> buildList { while (c.moveToNext()) add(c.getLong(0) to c.getString(1)) } }

    fun paragraph(id: Long): Paragraph? = readableDatabase.rawQuery(
        """SELECT p.id, p.text, d.url, d.title, d.date, s.name FROM paras p
           JOIN docs d ON d.id = p.doc_id JOIN sources s ON s.id = d.source_id WHERE p.id = ?""",
        arrayOf(id.toString()),
    ).use { c -> if (c.moveToFirst()) Paragraph(c.getLong(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4), c.getString(5)) else null }

    companion object {
        const val RUN_GOING = 0
        const val RUN_DONE = 1
        const val RUN_STOPPED = 2
        const val RUN_FAILED = 3

        @Volatile private var instance: Db? = null
        fun get(ctx: Context): Db = instance ?: synchronized(this) { instance ?: Db(ctx.applicationContext).also { instance = it } }
    }
}

data class SearchRun(
    val claim: String, val range: DateRange, val sourceIds: Set<Long>?, val state: Int, val prepared: Boolean,
    val suggestion: String?, val message: String?, val startedAt: Long, val total: Int, val done: Int,
    /** The claim in English, once the search has made it. */
    val english: String? = null,
)

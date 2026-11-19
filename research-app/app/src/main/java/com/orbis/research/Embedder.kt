package com.orbis.research

import android.content.Context

/**
 * The meaning model (owner, 19 Nov 2026): no longer the small model inside the phone, which
 * missed relevant paragraphs, but OpenAI's embedding model through the Orbis service. The
 * phone sends texts in batches and stores the vectors it gets back.
 */
object Embedder {
    /** Stands where a model file's path stood; also names the vectors kept on the phone. */
    const val CLOUD = "cloud:text-embedding-3-large-1024"
    private const val BATCH = 96

    @Suppress("UNUSED_PARAMETER")
    suspend fun ensure(ctx: Context, path: String): Boolean = true

    /** The meaning of [text] as a vector, or null if it could not be read. */
    suspend fun embed(text: String): FloatArray? = embedAll(listOf(text)).firstOrNull()

    /** Vectors for many texts at once, in order; null for a blank text. */
    suspend fun embedAll(texts: List<String>): List<FloatArray?> = embedBytes(texts).map { b -> b?.let(Vectors::fromBytes) }

    /** The stored form: signed bytes, as the service sends them; null for a blank text. */
    suspend fun embedBytes(texts: List<String>): List<ByteArray?> {
        val out = arrayOfNulls<ByteArray>(texts.size)
        val wanted = texts.indices.filter { texts[it].isNotBlank() }
        for (chunk in wanted.chunked(BATCH)) {
            val vectors = CloudReader.embed(chunk.map { texts[it].take(6000) })
            chunk.forEachIndexed { i, at -> out[at] = vectors[i] }
        }
        return out.toList()
    }

    suspend fun release() = Unit
}

/**
 * Gives every paragraph on the phone its meaning vector. Runs after collecting and whenever the
 * owner asks; a paragraph is read once. If the meaning model changes, the old vectors are dropped.
 */
object Indexer {
    suspend fun run(ctx: Context, stop: () -> Boolean, progress: (done: Int, left: Int) -> Unit): Boolean {
        val path = Models.embedderPath(ctx) ?: return false
        val db = Db.get(ctx)
        val name = Embedder.CLOUD
        if (Settings.vectorModel(ctx) != name) { db.clearVectors(); Settings.setVectorModel(ctx, name) }
        if (!Embedder.ensure(ctx, path)) return false
        try {
            var done = 0
            while (!stop()) {
                val batch = db.unindexed(32)
                if (batch.isEmpty()) break
                if (stop()) break
                // A paragraph the model cannot read gets an empty vector, so it is not tried again.
                val vectors = Embedder.embedBytes(batch.map { Vectors.docText(path, it.second) })
                val out = batch.mapIndexed { i, (id, _) -> id to (vectors[i] ?: ByteArray(0)) }
                db.saveVectors(out)
                done += out.size
                progress(done, db.vectorCounts().second)
            }
        } finally {
            Embedder.release()
        }
        return true
    }
}

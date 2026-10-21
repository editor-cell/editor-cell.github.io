package com.orbis.research

import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * The meaning model running inside the phone; loaded only while it is needed. Indexing and a
 * search may use it at once: each [ensure] that succeeds is matched by one [release], and the
 * model is unloaded when the last user is done.
 */
object Embedder {
    private val lock = Mutex()
    @Volatile private var handle = 0L
    private var loadedPath: String? = null
    private var users = 0

    suspend fun ensure(ctx: Context, path: String): Boolean = lock.withLock {
        Llm.init(ctx)
        if (loadedPath != path || handle == 0L) {
            if (handle != 0L) LlmNative.nativeFree(handle)
            handle = LlmNative.nativeLoadEmbedder(path, 512)
            loadedPath = if (handle != 0L) path else null
        }
        if (handle != 0L) users++
        handle != 0L
    }

    /** The meaning of [text] as a vector of length 1, or null if it could not be read. */
    suspend fun embed(text: String): FloatArray? = lock.withLock {
        if (handle == 0L) null else LlmNative.nativeEmbed(handle, text)?.let(Vectors::normalize)
    }

    suspend fun release() = lock.withLock {
        users = maxOf(0, users - 1)
        if (users == 0 && handle != 0L) { LlmNative.nativeFree(handle); handle = 0L; loadedPath = null }
    }
}

/**
 * Gives every paragraph on the phone its meaning vector. Runs after collecting and whenever the
 * owner asks; a paragraph is read once. If the meaning model changes, the old vectors are dropped.
 */
object Indexer {
    suspend fun run(ctx: Context, stop: () -> Boolean, progress: (done: Int, left: Int) -> Unit): Boolean {
        val path = Models.embedderPath(ctx) ?: return false
        val db = Db.get(ctx)
        val name = Models.embedder(ctx).fileName
        if (Settings.vectorModel(ctx) != name) { db.clearVectors(); Settings.setVectorModel(ctx, name) }
        if (!Embedder.ensure(ctx, path)) return false
        try {
            var done = 0
            while (!stop()) {
                val batch = db.unindexed(32)
                if (batch.isEmpty()) break
                val out = ArrayList<Pair<Long, ByteArray>>()
                for ((id, text) in batch) {
                    if (stop()) break
                    // A paragraph the model cannot read gets an empty vector, so it is not tried again.
                    val v = Embedder.embed(Vectors.docText(path, text))
                    out += id to (v?.let(Vectors::toBytes) ?: ByteArray(0))
                }
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

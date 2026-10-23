package com.orbis.research

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Only the checkpoint pinned in this APK is selectable. Missing weights never load another model. */
object Nli {
    @Volatile private var engine: NliEngine? = null
    @Volatile private var stopped = false
    private var labels = emptyList<String>()
    private val lock = Mutex()
    private var users = 0

    fun allow() { stopped = false }
    fun abortNow() { stopped = true; engine?.abort() }

    suspend fun ensure(ctx: Context) = withContext(Dispatchers.IO) { lock.withLock {
        if (engine == null) {
            check(NliFiles.ready(ctx)) { "Önce Model sekmesinden son eğitilmiş modeli indirin." }
            labels = NliFiles.manifest(ctx).getJSONObject("encoding").getJSONArray("labels").let { a -> List(a.length()) { a.getString(it) } }
            engine = NliEngine(NliFiles.directory(ctx))
        }
        users++
    } }

    suspend fun judge(paragraph: String, claim: String): String? = withContext(Dispatchers.IO) {
        if (stopped) return@withContext null
        val scores = try { engine?.logits(paragraph, claim) ?: error("Model yüklenmedi.") }
        catch (e: Exception) { if (stopped) return@withContext null else throw e }
        if (stopped) return@withContext null
        check(scores.size == 3 && scores.all { it.isFinite() }) { "Model geçerli bir sonuç üretmedi." }
        when (labels[scores.indices.maxBy { scores[it] }]) {
            "entailment" -> "SUPPORTS"
            "contradiction" -> "CONTRADICTS"
            "neutral" -> "UNRELATED"
            else -> error("Model etiketleri tanınmıyor.")
        }
    }

    suspend fun release() = withContext(Dispatchers.IO) { lock.withLock {
        users = maxOf(0, users - 1)
        if (users == 0) { engine?.close(); engine = null }
    } }
}

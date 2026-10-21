package com.orbis.research

import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** The language model running inside the phone (llama.cpp). One model loaded at a time. */
object Llm {
    private val lock = Mutex()
    @Volatile private var handle = 0L
    private var loadedPath: String? = null
    private var ready = false

    /** Loads the engine library once; shared with the meaning model. */
    @Synchronized fun init(ctx: Context) {
        if (ready) return
        System.loadLibrary("orbisllm")
        LlmNative.nativeInit(ctx.applicationInfo.nativeLibraryDir)
        ready = true
    }

    /** Loads the model at [path] unless it is already loaded; false if the file cannot be used. */
    suspend fun ensure(ctx: Context, path: String): Boolean = lock.withLock {
        init(ctx)
        if (loadedPath == path && handle != 0L) return@withLock true
        if (handle != 0L) { LlmNative.nativeFree(handle); handle = 0L; loadedPath = null }
        // 2048 tokens hold the longest prompt (a paragraph is cut at 2000 characters) and keep
        // the model's working memory small enough for a 4 GB phone.
        handle = LlmNative.nativeLoad(path, 2048)
        if (handle != 0L) loadedPath = path
        handle != 0L
    }

    // Set by a stop and kept until the next search starts, so a stop that lands between two
    // paragraphs also holds; the engine's own flag is cleared at the start of each answer.
    @Volatile private var stopped = false

    /** Ends the answer being written now, from any thread, within one small step. */
    fun abortNow() {
        stopped = true
        val h = handle
        if (h != 0L) LlmNative.nativeAbort(h)
    }

    /** Lets answers be written again after a stop. */
    fun allow() { stopped = false }

    suspend fun release() = lock.withLock {
        if (handle != 0L) LlmNative.nativeFree(handle)
        handle = 0L; loadedPath = null
    }

    suspend fun generate(system: String, user: String, grammar: String = "", maxTokens: Int = 64): String? = lock.withLock {
        if (handle == 0L || stopped) return@withLock null
        val out = LlmNative.nativeGenerate(handle, system, user, grammar, Prompts.answerPrefix(loadedPath ?: ""), maxTokens)
        if (stopped) null else out?.let(Prompts::clean)
    }
}

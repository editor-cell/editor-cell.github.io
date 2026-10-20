package com.orbis.research

import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** The language model running inside the phone (llama.cpp). One model loaded at a time. */
object Llm {
    private val lock = Mutex()
    private var handle = 0L
    private var loadedPath: String? = null
    private var ready = false

    private fun init(ctx: Context) {
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
        handle = LlmNative.nativeLoad(path, 4096)
        if (handle != 0L) loadedPath = path
        handle != 0L
    }

    suspend fun release() = lock.withLock {
        if (handle != 0L) LlmNative.nativeFree(handle)
        handle = 0L; loadedPath = null
    }

    suspend fun generate(system: String, user: String, grammar: String = "", maxTokens: Int = 64): String? = lock.withLock {
        if (handle == 0L) return@withLock null
        LlmNative.nativeGenerate(handle, system, Prompts.forModel(loadedPath ?: "", user), grammar, maxTokens)?.let(Prompts::clean)
    }
}

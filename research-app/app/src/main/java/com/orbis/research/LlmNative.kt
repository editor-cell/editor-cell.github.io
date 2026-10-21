package com.orbis.research

/** The calls into llama.cpp (llm.cpp). Kept free of Android so the tests can use them too. */
object LlmNative {
    external fun nativeInit(libDir: String)
    external fun nativeLoad(path: String, nCtx: Int): Long
    external fun nativeFree(handle: Long)
    external fun nativeGenerate(handle: Long, system: String, user: String, grammar: String, prefix: String, maxTokens: Int): String?
    /** Stops the call running on [handle] at once; safe from any thread. */
    external fun nativeAbort(handle: Long)

    external fun nativeLoadEmbedder(path: String, nCtx: Int): Long
    /** The meaning of a text as a vector (not normalised); free with [nativeFree]. */
    external fun nativeEmbed(handle: Long, text: String): FloatArray?
}

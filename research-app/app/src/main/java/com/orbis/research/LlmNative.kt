package com.orbis.research

/** The calls into llama.cpp (llm.cpp). Kept free of Android so the tests can use them too. */
object LlmNative {
    external fun nativeInit(libDir: String)
    external fun nativeLoad(path: String, nCtx: Int): Long
    external fun nativeFree(handle: Long)
    external fun nativeGenerate(handle: Long, system: String, user: String, grammar: String, prefix: String, maxTokens: Int): String?
}

package com.orbis.research

/** The trained checkpoint's exact Hugging Face tokenizer, shared by host tests and Android. */
object NativeTokenizer {
    init {
        val hostLibrary = System.getProperty("orbis.tokenizer.lib")
        if (hostLibrary != null) System.load(hostLibrary) else System.loadLibrary("orbistokenizer")
    }
    @JvmStatic external fun open(path: String): Long
    @JvmStatic external fun encode(handle: Long, paragraph: String, claim: String): Array<LongArray>
    @JvmStatic external fun close(handle: Long)
}

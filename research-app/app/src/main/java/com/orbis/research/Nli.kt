package com.orbis.research

import android.content.Context

/** The paragraph reader runs on Cloudflare; no local reader weights are required. */
object Nli {
    const val MODEL_ID = CloudReader.MODEL_ID
    fun allow() = Unit
    // WorkManager cancellation cancels the coroutine and its HTTP call.
    fun abortNow() = Unit
    @Suppress("UNUSED_PARAMETER")
    suspend fun ensure(ctx: Context) = CloudReader.checkConnection()
    suspend fun judge(paragraph: String, claim: String): String = CloudReader.judge(paragraph, claim)
    suspend fun release() = Unit
}

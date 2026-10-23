package com.orbis.research

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Only the research query and candidate paragraph go to this fixed inference endpoint. */
object CloudReader {
    const val MODEL_ID = "deepseek-r1-32b-v1"
    const val MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
    const val BASE_URL = "https://orbis-deepseek-trial.editor-aa8.workers.dev"
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .callTimeout(150, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .followRedirects(false)
        .build()

    private suspend fun request(request: Request): JSONObject = suspendCancellableCoroutine { continuation ->
        val call = client.newCall(request)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(IOException("DeepSeek bağlantısı kurulamadı: ${e.message}", e))
            }
            override fun onResponse(call: Call, response: Response) {
                try {
                    val data = response.use { r ->
                        val body = r.body ?: error("DeepSeek boş yanıt verdi.")
                        val bytes = body.byteStream().use { input ->
                            val out = java.io.ByteArrayOutputStream()
                            val buffer = ByteArray(2048)
                            while (out.size() <= 16384) {
                                val count = input.read(buffer, 0, minOf(buffer.size, 16385 - out.size()))
                                if (count < 0) break
                                out.write(buffer, 0, count)
                            }
                            out.toByteArray()
                        }
                        check(bytes.size <= 16384) { "DeepSeek yanıtı beklenenden uzun." }
                        val json = JSONObject(bytes.toString(Charsets.UTF_8))
                        check(r.isSuccessful) { json.optString("error", "DeepSeek yanıt veremedi (${r.code}).") }
                        json
                    }
                    if (continuation.isActive) continuation.resume(data)
                } catch (e: Exception) {
                    if (continuation.isActive) continuation.resumeWithException(e)
                }
            }
        })
    }

    suspend fun checkConnection() {
        val data = request(Request.Builder().url("$BASE_URL/health").get().build())
        check(data.optBoolean("ok") && data.optString("model") == MODEL && data.optString("version") == MODEL_ID) {
            "DeepSeek servisi bu uygulama sürümüyle uyumlu değil."
        }
    }

    suspend fun judge(paragraph: String, query: String): String {
        val body = JSONObject().put("query", query).put("paragraph", paragraph).toString()
        val data = request(Request.Builder().url("$BASE_URL/judge")
            .post(body.toRequestBody("application/json; charset=utf-8".toMediaType())).build())
        check(data.optString("model") == MODEL && data.optString("version") == MODEL_ID) { "Yanıt beklenen DeepSeek modelinden gelmedi." }
        val verdict = data.getString("verdict")
        val kind = data.getString("query_kind")
        check(verdict in setOf("SUPPORTS", "CONTRADICTS", "UNRELATED") && kind in setOf("claim", "topic")) { "DeepSeek geçerli karar üretmedi." }
        check(kind != "topic" || verdict != "CONTRADICTS") { "Bilgi sorgusu için geçersiz karar alındı." }
        return "$verdict\nCLOUD_MODEL: $MODEL_ID\nQUERY_KIND: $kind"
    }
}

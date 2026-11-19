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
    const val MODEL_ID = "gpt-6.2-sol-v1"
    const val MODEL = "gpt-6.2-sol"
    private val VERDICTS = setOf("SUPPORTS", "CONTRADICTS", "UNRELATED")
    const val BASE_URL = "https://orbisreadingatlas.com/research"
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(240, TimeUnit.SECONDS)
        .callTimeout(270, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .followRedirects(false)
        .build()

    private suspend fun request(request: Request): JSONObject = suspendCancellableCoroutine { continuation ->
        val call = client.newCall(request)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(IOException("Sol bağlantısı kurulamadı: ${e.message}", e))
            }
            override fun onResponse(call: Call, response: Response) {
                try {
                    val data = response.use { r ->
                        val body = r.body ?: error("Sol boş yanıt verdi.")
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
                        check(bytes.size <= 16384) { "Sol yanıtı beklenenden uzun." }
                        val json = JSONObject(bytes.toString(Charsets.UTF_8))
                        check(r.isSuccessful) { json.optString("error", "Sol yanıt veremedi (${r.code}).") }
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
        check(data.optString("model") == MODEL && data.optString("version") == MODEL_ID) {
            "Sol servisi bu uygulama sürümüyle uyumlu değil."
        }
        check(data.optBoolean("ok")) { "OpenAI anahtarı Cloudflare'e henüz eklenmemiş." }
    }

    suspend fun judge(paragraph: String, query: String): String {
        val body = JSONObject().put("query", query).put("paragraph", paragraph).toString()
        val data = request(Request.Builder().url("$BASE_URL/judge")
            .post(body.toRequestBody("application/json; charset=utf-8".toMediaType())).build())
        check(data.optString("model") == MODEL && data.optString("version") == MODEL_ID) { "Yanıt beklenen Sol modelinden gelmedi." }
        val verdict = data.getString("verdict")
        val kind = data.getString("query_kind")
        check(verdict in VERDICTS && kind in setOf("claim", "topic")) { "Sol geçerli karar üretmedi." }
        check(kind != "topic" || verdict != "CONTRADICTS") { "Bilgi sorgusu için geçersiz karar alındı." }
        // Sol reads; where Sol is unsure the service asks GPT-6.2 Astra, whose verdict stands.
        // When the two differ: the flag and both verdicts.
        val sol = data.optJSONObject("reader")?.optString("verdict")?.takeIf { it in VERDICTS }
        val astra = data.optJSONObject("second")?.optString("verdict")?.takeIf { it in VERDICTS }
        val split = if (data.optBoolean("disagree") && sol != null && astra != null) {
            "\nSPLIT: Sol=$sol Astra=$astra"
        } else ""
        return "$verdict\nCLOUD_MODEL: $MODEL_ID\nQUERY_KIND: $kind$split"
    }
    /** The query as separate parts to search on their own; the whole query when it cannot be split. */
    suspend fun split(query: String): List<String> = try {
        val body = JSONObject().put("query", query).toString()
        val data = request(Request.Builder().url("$BASE_URL/split")
            .post(body.toRequestBody("application/json; charset=utf-8".toMediaType())).build())
        val arr = data.optJSONArray("parts")
        val parts = (0 until (arr?.length() ?: 0)).map { arr!!.getString(it).trim() }.filter { it.isNotEmpty() }.distinct().take(4)
        parts.ifEmpty { listOf(query) }
    } catch (e: kotlin.coroutines.cancellation.CancellationException) {
        throw e
    } catch (e: Exception) {
        listOf(query)
    }
}

package com.orbis.research

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

class OutOfScope(url: String) : IOException("Listede olmayan bir siteye gidilmedi: $url")

class Fetched(val url: String, val contentType: String, val bytes: ByteArray)

/**
 * The only door to the internet while collecting documents. Every request, and every redirect
 * on the way, must land on a listed source; anything else is refused before it is sent.
 */
class Net(private val scopes: () -> Collection<String>) {
    private val guard = Interceptor { chain ->
        val url = chain.request().url
        if (url.scheme != "https" && url.scheme != "http") throw OutOfScope(url.toString())
        if (!Sources.inScope(url.host, scopes())) throw OutOfScope(url.toString())
        chain.proceed(chain.request())
    }

    private val client = OkHttpClient.Builder()
        .addNetworkInterceptor(guard)
        .addInterceptor(guard)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .callTimeout(180, TimeUnit.SECONDS)
        .build()

    private val robots = HashMap<String, Robots>()

    /** Fetches an address if robots.txt allows it; null when it is missing, refused or too large. */
    fun get(url: String, maxBytes: Long = MAX_BYTES): Fetched? {
        val req = Request.Builder().url(url).header("User-Agent", USER_AGENT)
            .header("Accept", "text/html,application/xhtml+xml,application/xml,application/pdf;q=0.9,*/*;q=0.5")
            .build()
        client.newCall(req).execute().use { r: Response ->
            if (!r.isSuccessful) return null
            val body = r.body ?: return null
            if (body.contentLength() > maxBytes) return null
            val bytes = body.byteStream().use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    out.write(buf, 0, n)
                    if (out.size() > maxBytes) return null
                }
                out.toByteArray()
            }
            return Fetched(r.request.url.toString(), r.header("Content-Type") ?: "", bytes)
        }
    }

    fun allowed(url: String): Boolean {
        val u = url.toHttpUrlOrNull() ?: return false
        val key = "${u.scheme}://${u.host}"
        val rules = robots.getOrPut(key) {
            val txt = try { get("$key/robots.txt", 512 * 1024)?.bytes?.toString(Charsets.UTF_8) } catch (e: IOException) { null }
            Robots.parse(txt ?: "", ROBOTS_AGENT)
        }
        return rules.allows(u.encodedPath + (u.encodedQuery?.let { "?$it" } ?: ""))
    }

    fun sitemapsFromRobots(base: String): List<String> {
        val txt = try { get("$base/robots.txt", 512 * 1024)?.bytes?.toString(Charsets.UTF_8) } catch (e: IOException) { null }
        return Robots.sitemaps(txt ?: "")
    }

    companion object {
        const val MAX_BYTES = 40L * 1024 * 1024
        const val ROBOTS_AGENT = "OrbisResearch"
        const val USER_AGENT = "Mozilla/5.0 (Linux; Android) OrbisResearch/0.1 (+https://orbisreadingatlas.com)"
    }
}

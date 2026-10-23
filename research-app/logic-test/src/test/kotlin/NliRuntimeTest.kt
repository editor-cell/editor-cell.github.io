import com.orbis.research.NativeTokenizer
import com.orbis.research.NliEngine
import org.junit.jupiter.api.Assumptions.assumeTrue
import java.io.File
import java.util.Base64
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** These fixtures compare runtimes, not invented semantic labels or training questions. */
class NliRuntimeTest {
    private fun directory(): File {
        val path = System.getenv("ORBIS_NLI_MODEL")
        assumeTrue(!path.isNullOrBlank())
        return File(path!!)
    }
    private fun text(encoded: String) = String(Base64.getDecoder().decode(encoded), Charsets.UTF_8)
    private fun numbers(csv: String) = if (csv.isBlank()) longArrayOf() else csv.split(',').map { it.toLong() }.toLongArray()

    @Test fun exactTrainedTokenizerOnUnicodeAndPairs() {
        val model = directory()
        val handle = NativeTokenizer.open(File(model, "tokenizer.json").path)
        try {
            val rows = javaClass.getResourceAsStream("/nli-tokenizer.tsv")!!.bufferedReader().readLines()
            assertTrue(rows.size >= 10)
            for (row in rows) {
                val parts = row.split('\t')
                val got = NativeTokenizer.encode(handle, text(parts[0]), text(parts[1]))
                assertContentEquals(numbers(parts[2]), got[0], "Trained token IDs changed")
                assertContentEquals(LongArray(got[0].size) { 1 }, got[1])
                assertContentEquals(numbers(parts[3]), got[2], "Pair segment IDs changed")
            }
            val long = NativeTokenizer.encode(handle, "reading research evidence ".repeat(1500), "A short claim.")
            assertEquals(1024, long[0].size)
        } finally { NativeTokenizer.close(handle) }
    }

    @Test fun phoneInferenceMatchesVerifiedExport() {
        NliEngine(directory()).use { model ->
            val rows = javaClass.getResourceAsStream("/nli-runtime.tsv")!!.bufferedReader().readLines()
            assertTrue(rows.size >= 3)
            for (row in rows) {
                val p = row.split('\t')
                val expected = p[2].split(',').map { it.toFloat() }
                val started = System.nanoTime()
                val actual = model.logits(text(p[0]), text(p[1]))
                println("Current trained reader host inference: ${(System.nanoTime() - started) / 1_000_000} ms")
                assertEquals(3, actual.size)
                for (i in actual.indices) assertTrue(actual[i].isFinite() && abs(actual[i] - expected[i]) < 0.002f,
                    "Native phone-runtime parity failed for logit $i")
            }
        }
    }
}

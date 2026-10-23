import com.orbis.research.CloudReader
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assumptions.assumeTrue
import kotlin.test.Test
import kotlin.test.assertTrue

class CloudReaderTest {
    @Test fun phoneClientReadsTheDeployedService() = runBlocking {
        assumeTrue(System.getenv("ORBIS_CLOUD_SMOKE") == "1")
        CloudReader.checkConnection()
        val result = CloudReader.judge("Situation épidémiologique - Cameroun", "obezitenin en çok görüldüğü ülkeler")
        assertTrue(result.startsWith("UNRELATED\n"), result)
        assertTrue(result.contains("QUERY_KIND: topic"), result)
    }
}

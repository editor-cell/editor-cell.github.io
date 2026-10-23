import com.orbis.research.CloudReader
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assumptions.assumeTrue
import kotlin.test.Test
import kotlin.test.assertTrue

/** Fresh synthetic text, sent through the exact client compiled into the phone app. */
class CloudReaderTest {
    private fun check(query: String, paragraph: String, expected: String, kind: String) = runBlocking {
        assumeTrue(System.getenv("ORBIS_CLOUD_SMOKE") == "1")
        CloudReader.checkConnection()
        val result = CloudReader.judge(paragraph, query)
        assertTrue(result.startsWith("$expected\n"), result)
        assertTrue(result.contains("QUERY_KIND: $kind"), result)
    }

    @Test fun bareCountryHeading() = check("obezitenin en çok görüldüğü ülkeler",
        "Situation épidémiologique - Cameroun", "UNRELATED", "topic")
    @Test fun obesityRankingAnswersTopic() = check("obezitenin en çok görüldüğü ülkeler",
        "In this fictional survey of five countries, obesity prevalence was highest in Country A at 38%, followed by Country B at 31%. Country C had the lowest prevalence at 12%.", "SUPPORTS", "topic")
    @Test fun increasedRiskSupportsClaim() = check("Obezite kalp krizi ihtimalini artırır.",
        "In this fictional cohort, people with obesity had a higher risk of myocardial infarction than people of normal weight, even after adjustment for age.", "SUPPORTS", "claim")
    @Test fun noIncreaseContradictsClaim() = check("Obezite kalp krizi ihtimalini artırır.",
        "This fictional study found no increase in myocardial infarction risk among participants with obesity compared with participants of normal weight.", "CONTRADICTS", "claim")
    @Test fun sharedTopicAloneIsUnrelated() = check("Obezite kalp krizi ihtimalini artırır.",
        "The fictional report describes childhood obesity prevalence by region. It contains no cardiovascular outcome data.", "UNRELATED", "claim")
    @Test fun turkishDefinitionAnswersQuestion() = check("Obezite ne demektir?",
        "Obezite, sağlığı bozabilecek ölçüde aşırı veya anormal yağ birikmesidir.", "SUPPORTS", "topic")
}

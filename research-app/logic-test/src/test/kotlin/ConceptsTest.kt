import com.orbis.research.Concepts
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** The concept check that stands between the paragraphs closest in meaning and the language model. */
class ConceptsTest {
    private val rates = Concepts.parse(
        "- interest rate increase: interest rate increase, raise interest rates, rate hike, monetary tightening, policy rate, higher rates, faiz artışı, politika faizi\n" +
            "- inflation: inflation, disinflation, price growth, rising prices, consumer prices, enflasyon, fiyat artışı\n" +
            "- economic stagnation: economic stagnation, stagnation, recession, economic slowdown, contraction, output decline, durgunluk, resesyon, daralma",
    )

    @Test fun readsTheModelsLines() {
        val c = Concepts.parse("nonsense\n- a: b\n- ok name: first term, second term, , x\n• bullet one: some words here\n- no colon here")
        assertEquals(listOf("ok name", "bullet one"), c.map { it.name })
        // The name counts as a term; terms shorter than three letters are dropped.
        assertEquals(listOf("ok name", "first term", "second term"), c[0].terms)
        assertEquals(emptyList(), Concepts.parse(null))
        assertEquals(emptyList(), Concepts.parse("   "))
    }

    @Test fun keepsAtMostThreeConceptsAndTheTermLimit() {
        val many = (1..6).joinToString("\n") { "- idea $it: " + (1..15).joinToString(", ") { t -> "word$t" } }
        val c = Concepts.parse(many)
        assertEquals(Concepts.MAX_CONCEPTS, c.size)
        assertTrue(c.all { it.terms.size == Concepts.MAX_TERMS })
    }

    @Test fun savedAndReadBackTheSame() {
        assertEquals(rates, Concepts.parse(Concepts.format(rates)))
        assertEquals("interest rate increase · inflation · economic stagnation", Concepts.names(rates))
    }

    @Test fun formsOfOneWordMatch() {
        for ((a, b) in listOf("rate" to "rates", "raise" to "raised", "stagnant" to "stagnation", "tax" to "taxes", "decline" to "declined", "bank" to "banking"))
            assertTrue(Concepts.sameWord(a, b), "$a/$b")
        for ((a, b) in listOf("tax" to "taxi", "rate" to "rather", "bank" to "bankruptcy", "price" to "prize", "cut" to "cutter"))
            assertFalse(Concepts.sameWord(a, b), "$a/$b")
    }

    @Test fun mostConceptsMustBeThere() {
        assertEquals(listOf(1, 2, 2, 3), (1..4).map { Concepts.needed(it) })
    }

    /** The paragraphs the phone called "supporting" on 21 Oct 2026 for the phrase about interest rates and stagnation. */
    @Test fun paragraphsThatDoNotSpeakOfTheClaimNeverReachTheModel() {
        val away = listOf(
            "European banks are sitting sure in the saddle nowadays, even in the face of bucking economic and financial conditions. " +
                "Neither the pandemic nor the banking turmoil in 2023 threw them off, a remarkable turnaround compared with the great financial crisis.",
            "Price stability provides an essential foundation for financial planning. High and unpredictable inflation erodes purchasing power " +
                "and makes planning difficult. The current monetary policy framework aims to maintain inflation around the target of 5 per cent.",
            "Since 2020, African economies have been most severely tested by a salvo of shocks. Almost all originated outside of our continent. " +
                "The formulation of domestic economic policies is increasingly shaped by pandemics, trade wars, military conflicts and climate shocks.",
            "Addresses statistical issues relating to economic, monetary and financial stability.",
        )
        for (p in away) assertFalse(Concepts.passes(p, rates), p)
    }

    @Test fun findingsGoOnToTheModel() {
        val on = listOf(
            "After the central bank raised its policy rate from 0.25% to 5.25% to bring inflation down, output contracted for two " +
                "consecutive quarters and the economy entered a recession.",
            // Close cases pass too: the model, not the word check, decides about them.
            "More aggressive monetary tightening would have brought inflation down faster.",
        )
        for (p in on) assertTrue(Concepts.passes(p, rates), p)
    }

    @Test fun aParagraphThatSaysThereWasNoEffectSpeaksOfTheSameThings() {
        val sugar = Concepts.parse(
            "- sugar tax: sugar tax, sugary drinks tax, tax on soft drinks, excise tax, levy\n" +
                "- soft drink consumption: soft drinks, sugar sweetened beverages, carbonated drinks, consumption, purchases, sales",
        )
        assertTrue(Concepts.passes("Denmark's tax on soft drinks had no measurable effect on consumption: sales of carbonated soft drinks " +
            "did not fall after the tax was raised.", sugar))
        assertFalse(Concepts.passes("The ministry will publish its annual report on road safety in March, covering traffic accidents.", sugar))
    }

    /** The same thing said in other words: the claim speaks of raising rates, the paragraph of tightening. */
    @Test fun otherWordsForTheSameThingAreCaught() {
        val tighter = "The monetary tightening of 2022 pushed borrowing costs up, consumer prices stopped climbing, and the economy " +
            "slipped into a recession."
        assertTrue(Concepts.passes(tighter, rates))
        val hike = "A rate hike was followed by a sharp contraction in output."
        assertTrue(Concepts.passes(hike, rates))
    }

    /** A Turkish source: the paragraph is found by the Turkish words the model lists, in any letter case or ending. */
    @Test fun turkishParagraphsAreCaught() {
        val tr = "Politika faizinin yükseltilmesinin ardından enflasyon geriledi, ancak ekonomi durgunluğa girdi."
        assertTrue(Concepts.passes(tr, rates))
        assertTrue(Concepts.passes(tr.uppercase(java.util.Locale.forLanguageTag("tr")), rates))
        assertFalse(Concepts.passes("Bu yıl turizm gelirleri ve tarımsal üretim rekor kırdı; otel doluluk oranları arttı.", rates))
        for ((a, b) in listOf("yasak" to "yasağı", "durgunluk" to "durgunluğu", "faiz" to "faizleri"))
            assertTrue(Concepts.sameWord(a, b), "$a/$b")
    }

    @Test fun turkishLettersAreOneWordWithPlainOnes() {
        val c = Concepts.parse("- phone ban: phone ban, telefon yasağı, ısıtma sistemi")
        assertTrue(Concepts.passes("TELEFON YASAGI getirildi", c))
        assertTrue(Concepts.passes("Isitma sistemleri değişti; telefon yasağı", c))
    }

    @Test fun withNoConceptsEveryParagraphGoes() {
        assertTrue(Concepts.passes("Any paragraph at all.", emptyList()))
    }
}

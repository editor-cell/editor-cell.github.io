import com.orbis.research.Paragraph
import com.orbis.research.Prompts
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/**
 * The one-word verdict ([Prompts.judge]) against reading for meaning first ([Prompts.read]) and reading
 * from the last sentence back to the first, the hafız's way ([Prompts.readBackwards]), on the
 * same paragraphs, on the real model (ORBIS_MODEL). Nothing here fails the build: every case prints a
 * COMPARE line (old answer, new answer, the right answer) and the reading itself, and the workflow
 * turns them into a score card. The paragraphs are the ones the phone returned for RATES on
 * 21 Oct 2026, the paragraphs of the same ECB speech the phone missed, and the cases the small model
 * got wrong in the earlier runs.
 */
class ReadingCompareTest {
    private class Case(val label: String, val claim: String, val want: String, val text: String)

    private companion object {
        const val RATES = "enflasyon düşürmek için faiz yükselten ülkelerde ekonomik durgunluk"
        const val SUGAR = "Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü."
        const val WAGE = "Asgari ücret artışı istihdamı azaltmadı."
        const val U = "UNRELATED"
        const val S = "SUPPORTS"
        const val C = "CONTRADICTS"
    }

    private val cases = listOf(
        // The evrak of 21 Oct 2026: shown as supporting, none of them says a slowdown followed a rate rise.
        Case("ECB 1 strength of demand", RATES, U, "Furthermore, the strength of the economy is relevant to the risk of inflation pressures " +
            "broadening beyond the initial shock: the stronger aggregate demand, the more scope firms have to pass higher input costs " +
            "on to consumer prices."),
        Case("ECB 1 anchored expectations", RATES, U, "As long as expectations are firmly anchored and backed up by a track record of " +
            "delivering on the inflation target, monetary policy can tolerate a more gradual return of inflation to target. But when " +
            "expectations show signs of becoming less firmly anchored, a more forceful response may be required to prevent temporary " +
            "shocks from becoming more persistent."),
        Case("ECB 1 underlying inflation", RATES, U, "Monetary policy needs to focus on underlying inflation to assess price stability. " +
            "Although the ECB's inflation target is expressed in terms of headline inflation, the best way to achieve that target " +
            "sustainably is, in many circumstances, to focus on the dynamics of underlying inflation."),
        Case("ECB 1 real rates", RATES, U, "In recent years, real interest rates at distant horizons have increased. This is happening at a " +
            "time when the global economy is facing substantial demand for funding from both the public and private sectors, as fiscal " +
            "deficits remain elevated across many countries and the AI buildout advances."),
        Case("ECB 1 what the ECB is doing", RATES, U, "This is what the ECB is doing. Faced with a renewed deterioration in the inflation " +
            "outlook, we adjusted policy rates in a timely manner to limit the pass-through to underlying inflation and bring inflation " +
            "back to target."),
        Case("banks capital", RATES, U, "On the contrary, they found that higher levels of capital lower both interest rate expenses and the " +
            "volatility of earnings. This allows banks to reduce their funding premia, which drives up profitability."),
        Case("banks efficiency", RATES, U, "Together, these measures will facilitate a more efficient financial system. This will also allow a " +
            "better channelling of funds into productive investments within the continent. Overall, it will make the EU economy more competitive."),
        Case("Sri Lanka literacy", RATES, U, "Financial literacy helps people interpret these conditions accurately. People need to understand " +
            "how inflation affects the real value of income and the affordability of financial commitments. They also need to distinguish " +
            "between the price level and the inflation. Slower price increases do not mean lower prices."),
        Case("Philippines money supply", RATES, U, "So when you want to lower inflation, you tighten money supply, you reduce money supply. But " +
            "in the 1990s, we found out that it works the same way if you raise interest rates. Tightening money supply is the same as " +
            "raising interest rates."),
        Case("Philippines target", RATES, U, "By the way, 3 percent is our target for inflation. That, we figured out, is the sweet spot for a " +
            "growing economy like ours. Other central banks, the US has a 2 percent target. Other developed countries have 2 percent targets."),
        Case("ECB 5 diagnosis", RATES, U, "A collection of other driving forces (fiscal policy, AI and financial conditions) are also shaping " +
            "output and inflation dynamics in the euro area, both directly and via their interactions with the energy supply shock. This " +
            "means that the appropriate monetary policy should not be interpreted as solely driven by the energy supply shock but rather " +
            "requires a multi-pronged diagnostic assessment."),
        Case("Norway wages", RATES, U, "First, the global price shock that hit the economy in the aftermath of the pandemic made imports more " +
            "expensive. But it also raised the prices of Norway's exports. Higher export prices contributed to stronger wage growth, which " +
            "is now sustaining inflation."),
        Case("Africa payments", RATES, U, "Enhancing cross-border payments is thus a necessity for the resilience and economic transformation " +
            "of African economies. But it is not sufficient."),
        // The same ECB speech: what the phone missed.
        Case("ECB 1 restraining demand", RATES, S, "By restraining growth in aggregate demand, higher interest rates can limit the extent to " +
            "which a relative price shock, often originating from the energy sector, can broaden into more persistent, economy-wide inflation."),
        Case("ECB 1 larger decline avoided", RATES, S, "Instead, the trade-off between inflation and output that arises under an adverse supply " +
            "shock is resolved by allowing inflation to return to target more gradually in exchange for avoiding a larger decline in " +
            "economic activity."),
        Case("ECB 1 GDP may respond more", RATES, S, "Some models imply stronger transmission than the elasticities used in the staff " +
            "projections, especially with respect to the impact on GDP. It is therefore possible that the economy responds more to the " +
            "recent tightening than currently assumed, which would dampen medium-term inflationary pressures compared with the baseline projection."),
        Case("ECB 1 credit still robust", RATES, C, "In any case, the recent robust credit dynamics suggest that financial conditions are not " +
            "yet restrictive or that parts of lending, particularly related to AI investment, have become less sensitive to interest rates " +
            "as expected returns have risen."),
        // Cases the small model got wrong before.
        Case("sugar Denmark", SUGAR, C, "Denmark's tax on soft drinks had no measurable effect on consumption: sales of carbonated soft drinks " +
            "did not fall after the tax was raised, because consumers bought the same drinks cheaply across the German border."),
        Case("rates in other words", RATES, S, "The monetary tightening of 2022 pushed borrowing costs up sharply. Consumer prices stopped " +
            "climbing, but the economy slipped into a downturn, with output falling for three quarters."),
        // Cases it got right, to see that reading does not break them.
        Case("rates plain", RATES, S, "After the central bank raised its policy rate from 0.25% to 5.25% to bring inflation down, output " +
            "contracted for two consecutive quarters and the economy entered a recession."),
        Case("sugar Mexico", SUGAR, S, "In Mexico, purchases of taxed sugar-sweetened beverages declined by 6% in the first year after the " +
            "excise tax was introduced in 2014, and by 9.7% in the second year, compared with the trend expected without the tax."),
        Case("wage Seattle", WAGE, C, "After Seattle raised its minimum wage to 13 dollars, hours worked in low-wage jobs fell by around 9 " +
            "percent, and the number of such jobs declined, according to the city's evaluation."),
        Case("wage 138 increases", WAGE, S, "Across the 138 increases studied, the number of low-wage jobs remained essentially unchanged five " +
            "years after the minimum wage was raised, while the earnings of affected workers rose."),
        Case("words only", RATES, U, "Interest rates on savings accounts rose last year, so savers earned more on their deposits. A recession " +
            "in the local housing market was blamed on the inflation of building costs."),
        Case("Norway close", RATES, U, "Part of the explanation lies in the weight the committee has given to striking an appropriate balance " +
            "between reducing inflation and sustaining employment. More aggressive monetary tightening would have brought inflation down faster."),
    )

    @TestFactory fun oneWordAgainstReading() = cases.map { c ->
        DynamicTest.dynamicTest(c.label) {
            assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && !System.getenv("ORBIS_MODEL").isNullOrEmpty())
            val p = Paragraph(1, c.text, "https://example.org/r", "Report", "", "Example")
            val en = LiveModelTest.english(c.claim)
            var t = System.currentTimeMillis()
            val old = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.judge(c.claim, en, p), Prompts.JUDGE_GRAMMAR, 8).trim()
            val oldMs = System.currentTimeMillis() - t
            t = System.currentTimeMillis()
            val reading = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.read(c.claim, en, p), Prompts.READ_GRAMMAR, Prompts.READ_MAX)
            val newMs = System.currentTimeMillis() - t
            val new = Prompts.verdictOfReading(reading) ?: "UNFINISHED"
            t = System.currentTimeMillis()
            val backReading = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.readBackwards(c.claim, en, p), Prompts.readBackwardsGrammar(c.text), Prompts.readBackwardsMax(c.text))
            val backMs = System.currentTimeMillis() - t
            val back = Prompts.verdictOfReading(backReading) ?: "UNFINISHED"
            println("COMPARE\t${c.label}\t$old\t$new\t$back\t${c.want}\t$oldMs\t$newMs\t$backMs")
            println("READING\t${c.label}\t${reading.replace("\n", " | ")}")
            println("BACKWARDS\t${c.label}\t${backReading.replace("\n", " | ")}")
        }
    }

    /** The paragraph the ECB speech sets out only to reject, read with the sentence after it. */
    @TestFactory fun refutedInTheSpeech() = listOf(Unit).map {
        DynamicTest.dynamicTest("ECB 1 view it rejects") {
            assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && !System.getenv("ORBIS_MODEL").isNullOrEmpty())
            val middle = "The reason given is that monetary policy cannot address the source of the shock. Higher interest rates, for " +
                "example, will not remove supply disruptions or reopen the Strait of Hormuz. Tightening would therefore unnecessarily " +
                "weaken the economy without eliminating the underlying cause of higher inflation, which will eventually vanish by itself."
            val before = "It is often argued that inflation targeting implies that central banks should look through adverse supply " +
                "shocks that push up inflation and weaken output."
            val after = "This characterisation, however, is too simple. In the benchmark models underlying modern monetary policy " +
                "frameworks, the distinction between supply and demand shocks does not alter the direction of the optimal policy response."
            val p = Paragraph(1, middle, "https://example.org/r", "Report", "", "Example")
            val en = LiveModelTest.english(RATES)
            val old = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.judge(RATES, en, p), Prompts.JUDGE_GRAMMAR, 8).trim()
            val reading = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.read(RATES, en, p), Prompts.READ_GRAMMAR, Prompts.READ_MAX)
            val new = Prompts.verdictOfReading(reading) ?: "UNFINISHED"
            val backReading = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.readBackwards(RATES, en, p), Prompts.readBackwardsGrammar(middle), Prompts.readBackwardsMax(middle))
            val back = Prompts.verdictOfReading(backReading) ?: "UNFINISHED"
            val stance = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.stance(p, before, after), Prompts.STANCE_GRAMMAR, 8).trim()
            // Kept out either way: not a finding (UNRELATED), or a finding the document refutes (REFUTED).
            fun out(v: String) = if (v == "SUPPORTS" || v == "CONTRADICTS") (if (stance == "REFUTED") "REFUTED" else v) else v
            println("COMPARE\tECB 1 view it rejects\t${out(old)}\t${out(new)}\t${out(back)}\tKEPT OUT\t0\t0\t0")
            println("READING\tECB 1 view it rejects\t${reading.replace("\n", " | ")} | stance: $stance")
            println("BACKWARDS\tECB 1 view it rejects\t${backReading.replace("\n", " | ")}")
        }
    }
}

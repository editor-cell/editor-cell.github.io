package com.orbis.research

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LightPalette = lightColorScheme(
    primary = Color(0xFF24574C), onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE0EDE6), onPrimaryContainer = Color(0xFF183F35),
    secondary = Color(0xFF49675C), onSecondary = Color.White,
    secondaryContainer = Color(0xFFEAF1E9), onSecondaryContainer = Color(0xFF254638),
    tertiary = Color(0xFF866439), onTertiary = Color.White,
    tertiaryContainer = Color(0xFFF3E9D7), onTertiaryContainer = Color(0xFF5C4325),
    background = Color(0xFFF6F4EE), onBackground = Color(0xFF24382F),
    surface = Color(0xFFFFFEFA), onSurface = Color(0xFF24382F),
    surfaceVariant = Color(0xFFF0EFE7), onSurfaceVariant = Color(0xFF626C64),
    surfaceContainerLowest = Color(0xFFFFFEFA), surfaceContainerLow = Color(0xFFFAF8F2),
    surfaceContainer = Color(0xFFF0EFE7), surfaceContainerHigh = Color(0xFFEAEAE1),
    surfaceContainerHighest = Color(0xFFE5E7DD), surfaceTint = Color(0xFF24574C),
    outline = Color(0xFF818E80), outlineVariant = Color(0xFFDFE2D6),
    error = Color(0xFF963F37), onError = Color.White,
    errorContainer = Color(0xFFF9EBE7), onErrorContainer = Color(0xFF77392F),
)

private val DarkPalette = darkColorScheme(
    primary = Color(0xFFA4CEB9), onPrimary = Color(0xFF183C30),
    primaryContainer = Color(0xFF284C3E), onPrimaryContainer = Color(0xFFD4ECDF),
    secondary = Color(0xFFB2CABB), onSecondary = Color(0xFF233C30),
    secondaryContainer = Color(0xFF2B3C32), onSecondaryContainer = Color(0xFFDCE8DC),
    tertiary = Color(0xFFD9BD8B), onTertiary = Color(0xFF3E2E17),
    tertiaryContainer = Color(0xFF443A28), onTertiaryContainer = Color(0xFFF3DDB5),
    background = Color(0xFF131D18), onBackground = Color(0xFFE3E8DF),
    surface = Color(0xFF1B2820), onSurface = Color(0xFFE3E8DF),
    surfaceVariant = Color(0xFF26352C), onSurfaceVariant = Color(0xFFB6C2B6),
    surfaceContainerLowest = Color(0xFF131D18), surfaceContainerLow = Color(0xFF19251E),
    surfaceContainer = Color(0xFF202E25), surfaceContainerHigh = Color(0xFF29372E),
    surfaceContainerHighest = Color(0xFF314036), surfaceTint = Color(0xFFA4CEB9),
    outline = Color(0xFF8B9B8E), outlineVariant = Color(0xFF3A4B3D),
    error = Color(0xFFF0B2A6), onError = Color(0xFF55251F),
    errorContainer = Color(0xFF412C27), onErrorContainer = Color(0xFFF5C4B8),
)

@Composable
fun OrbisTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkPalette else LightPalette
    val type = Typography(
        headlineLarge = TextStyle(fontFamily = FontFamily.Serif, fontSize = 31.sp, lineHeight = 38.sp, letterSpacing = (-0.6).sp),
        headlineMedium = TextStyle(fontFamily = FontFamily.Serif, fontSize = 28.sp, lineHeight = 35.sp, letterSpacing = (-0.4).sp),
        headlineSmall = TextStyle(fontFamily = FontFamily.Serif, fontSize = 24.sp, lineHeight = 31.sp),
        titleLarge = TextStyle(fontFamily = FontFamily.Serif, fontSize = 21.sp, lineHeight = 29.sp),
        titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold),
        titleSmall = TextStyle(fontSize = 14.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold),
        bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 24.sp),
        bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 22.sp),
        bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 19.sp, color = colors.onSurfaceVariant),
        labelLarge = TextStyle(fontSize = 13.sp, lineHeight = 19.sp, fontWeight = FontWeight.SemiBold),
        labelMedium = TextStyle(fontSize = 11.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
        labelSmall = TextStyle(fontSize = 10.sp, lineHeight = 15.sp, letterSpacing = 0.3.sp),
    )
    MaterialTheme(
        colorScheme = colors, typography = type,
        shapes = Shapes(
            extraSmall = RoundedCornerShape(8.dp), small = RoundedCornerShape(12.dp),
            medium = RoundedCornerShape(16.dp), large = RoundedCornerShape(22.dp), extraLarge = RoundedCornerShape(28.dp),
        ), content = content,
    )
}

/** A lightweight vector mark; no bitmap, network image or animation is required. */
@Composable
fun OrbisMark(modifier: Modifier = Modifier) {
    val ink = MaterialTheme.colorScheme.primary
    val accent = MaterialTheme.colorScheme.tertiary
    Canvas(modifier.size(34.dp)) {
        val stroke = Stroke(width = 1.4.dp.toPx())
        drawCircle(ink, radius = size.minDimension * 0.43f, style = stroke)
        drawOval(ink, topLeft = Offset(size.width * 0.29f, size.height * 0.07f),
            size = Size(size.width * 0.42f, size.height * 0.86f), style = stroke)
        drawLine(ink, Offset(size.width * 0.07f, size.height * 0.50f), Offset(size.width * 0.93f, size.height * 0.50f), strokeWidth = 1.4.dp.toPx())
        drawLine(accent, Offset(size.width * 0.77f, size.height * 0.77f), Offset(size.width * 0.98f, size.height * 0.98f), strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
    }
}

@Composable
fun ScreenIntro(eyebrow: String, title: String, description: String, modifier: Modifier = Modifier) {
    Column(modifier.padding(top = 8.dp, bottom = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(eyebrow, color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.labelSmall,
            letterSpacing = 1.6.sp, fontWeight = FontWeight.SemiBold)
        Text(title, style = MaterialTheme.typography.headlineMedium)
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun PaperCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Card(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
}

@Composable
fun SmallTag(text: String) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = RoundedCornerShape(8.dp)) {
        Text(text, Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun LibraryStats(documents: Int, paragraphs: Int) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        SmallTag("$documents belge")
        Spacer(Modifier.width(8.dp))
        SmallTag("$paragraphs paragraf")
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall,
        letterSpacing = 1.sp, fontWeight = FontWeight.SemiBold)
}

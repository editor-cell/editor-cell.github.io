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

// The look of 20 Nov 2026: warm off-white ground, near-black ink, Orbis bordo as the one accent.
private val LightPalette = lightColorScheme(
    primary = Color(0xFF7A2633), onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFF3E7E8), onPrimaryContainer = Color(0xFF5C1C26),
    secondary = Color(0xFF3A3D44), onSecondary = Color.White,
    secondaryContainer = Color(0xFFECE9E2), onSecondaryContainer = Color(0xFF16181D),
    tertiary = Color(0xFF7A2633), onTertiary = Color.White,
    tertiaryContainer = Color(0xFFF3E7E8), onTertiaryContainer = Color(0xFF5C1C26),
    background = Color(0xFFF7F5F0), onBackground = Color(0xFF16181D),
    surface = Color(0xFFFFFFFF), onSurface = Color(0xFF16181D),
    surfaceVariant = Color(0xFFECE9E2), onSurfaceVariant = Color(0xFF5E6168),
    surfaceContainerLowest = Color(0xFFFFFFFF), surfaceContainerLow = Color(0xFFFBFAF7),
    surfaceContainer = Color(0xFFF1EEE8), surfaceContainerHigh = Color(0xFFECE9E2),
    surfaceContainerHighest = Color(0xFFE6E2DA), surfaceTint = Color(0xFF7A2633),
    outline = Color(0xFF9A9790), outlineVariant = Color(0xFFE2DED6),
    error = Color(0xFF963F37), onError = Color.White,
    errorContainer = Color(0xFFF9EBE7), onErrorContainer = Color(0xFF77392F),
)

private val DarkPalette = darkColorScheme(
    primary = Color(0xFFE6A8B1), onPrimary = Color(0xFF4A1119),
    primaryContainer = Color(0xFF5C1C26), onPrimaryContainer = Color(0xFFF6D9DD),
    secondary = Color(0xFFC9CBD0), onSecondary = Color(0xFF26282D),
    secondaryContainer = Color(0xFF2C2E33), onSecondaryContainer = Color(0xFFECEAE6),
    tertiary = Color(0xFFE6A8B1), onTertiary = Color(0xFF4A1119),
    tertiaryContainer = Color(0xFF5C1C26), onTertiaryContainer = Color(0xFFF6D9DD),
    background = Color(0xFF121316), onBackground = Color(0xFFECEAE6),
    surface = Color(0xFF1B1C20), onSurface = Color(0xFFECEAE6),
    surfaceVariant = Color(0xFF2A2C31), onSurfaceVariant = Color(0xFFA9ABB0),
    surfaceContainerLowest = Color(0xFF121316), surfaceContainerLow = Color(0xFF17181C),
    surfaceContainer = Color(0xFF1F2025), surfaceContainerHigh = Color(0xFF26282D),
    surfaceContainerHighest = Color(0xFF2E3035), surfaceTint = Color(0xFFE6A8B1),
    outline = Color(0xFF6E7076), outlineVariant = Color(0xFF2E3036),
    error = Color(0xFFF0B2A6), onError = Color(0xFF55251F),
    errorContainer = Color(0xFF412C27), onErrorContainer = Color(0xFFF5C4B8),
)

@Composable
fun OrbisTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkPalette else LightPalette
    val type = Typography(
        headlineLarge = TextStyle(fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.3).sp),
        headlineMedium = TextStyle(fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.3).sp),
        headlineSmall = TextStyle(fontSize = 22.sp, lineHeight = 29.sp, fontWeight = FontWeight.SemiBold),
        titleLarge = TextStyle(fontSize = 19.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold),
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

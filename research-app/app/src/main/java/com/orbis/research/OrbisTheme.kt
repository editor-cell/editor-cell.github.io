package com.orbis.research

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// The look of 20 Nov 2026, second pass: warm off-white ground, near-black ink for every button,
// selection and focus; Orbis bordo only as a small accent (tertiary).
private val LightPalette = lightColorScheme(
    primary = Color(0xFF16181D), onPrimary = Color(0xFFF7F5F0),
    primaryContainer = Color(0xFFECE9E2), onPrimaryContainer = Color(0xFF16181D),
    secondary = Color(0xFF3A3D44), onSecondary = Color.White,
    secondaryContainer = Color(0xFFECE9E2), onSecondaryContainer = Color(0xFF16181D),
    tertiary = Color(0xFF7A2633), onTertiary = Color.White,
    tertiaryContainer = Color(0xFFF3E7E8), onTertiaryContainer = Color(0xFF5C1C26),
    background = Color(0xFFF7F5F0), onBackground = Color(0xFF16181D),
    surface = Color(0xFFFFFFFF), onSurface = Color(0xFF16181D),
    surfaceVariant = Color(0xFFECE9E2), onSurfaceVariant = Color(0xFF5E6168),
    surfaceContainerLowest = Color(0xFFFFFFFF), surfaceContainerLow = Color(0xFFFBFAF7),
    surfaceContainer = Color(0xFFF1EEE8), surfaceContainerHigh = Color(0xFFECE9E2),
    surfaceContainerHighest = Color(0xFFE6E2DA), surfaceTint = Color(0xFF16181D),
    outline = Color(0xFF9A9790), outlineVariant = Color(0xFFE2DED6),
    error = Color(0xFF963F37), onError = Color.White,
    errorContainer = Color(0xFFF9EBE7), onErrorContainer = Color(0xFF77392F),
)

private val DarkPalette = darkColorScheme(
    primary = Color(0xFFECEAE6), onPrimary = Color(0xFF121316),
    primaryContainer = Color(0xFF2C2E33), onPrimaryContainer = Color(0xFFECEAE6),
    secondary = Color(0xFFC9CBD0), onSecondary = Color(0xFF26282D),
    secondaryContainer = Color(0xFF2C2E33), onSecondaryContainer = Color(0xFFECEAE6),
    tertiary = Color(0xFFE6A8B1), onTertiary = Color(0xFF4A1119),
    tertiaryContainer = Color(0xFF5C1C26), onTertiaryContainer = Color(0xFFF6D9DD),
    background = Color(0xFF121316), onBackground = Color(0xFFECEAE6),
    surface = Color(0xFF1B1C20), onSurface = Color(0xFFECEAE6),
    surfaceVariant = Color(0xFF2A2C31), onSurfaceVariant = Color(0xFFA9ABB0),
    surfaceContainerLowest = Color(0xFF121316), surfaceContainerLow = Color(0xFF17181C),
    surfaceContainer = Color(0xFF1F2025), surfaceContainerHigh = Color(0xFF26282D),
    surfaceContainerHighest = Color(0xFF2E3035), surfaceTint = Color(0xFFECEAE6),
    outline = Color(0xFF6E7076), outlineVariant = Color(0xFF2E3036),
    error = Color(0xFFF0B2A6), onError = Color(0xFF55251F),
    errorContainer = Color(0xFF412C27), onErrorContainer = Color(0xFFF5C4B8),
)

/** Text and controls: IBM Plex Sans. Headings: DM Serif Display, the site's heading face. */
val PlexSans = FontFamily(
    Font(R.font.plex_sans_regular, FontWeight.Normal),
    Font(R.font.plex_sans_medium, FontWeight.Medium),
    Font(R.font.plex_sans_semibold, FontWeight.SemiBold),
    Font(R.font.plex_sans_semibold, FontWeight.Bold),
)
val DmSerif = FontFamily(Font(R.font.dm_serif_display, FontWeight.Normal))

@Composable
fun OrbisTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkPalette else LightPalette
    val sans = TextStyle(fontFamily = PlexSans)
    val type = Typography(
        headlineLarge = TextStyle(fontFamily = DmSerif, fontSize = 32.sp, lineHeight = 38.sp),
        headlineMedium = TextStyle(fontFamily = DmSerif, fontSize = 29.sp, lineHeight = 35.sp),
        headlineSmall = TextStyle(fontFamily = DmSerif, fontSize = 23.sp, lineHeight = 29.sp),
        titleLarge = sans.copy(fontSize = 18.sp, lineHeight = 25.sp, fontWeight = FontWeight.SemiBold),
        titleMedium = sans.copy(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold),
        titleSmall = sans.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
        bodyLarge = sans.copy(fontSize = 15.sp, lineHeight = 23.sp),
        bodyMedium = sans.copy(fontSize = 14.sp, lineHeight = 21.sp),
        bodySmall = sans.copy(fontSize = 12.sp, lineHeight = 18.sp, color = colors.onSurfaceVariant),
        labelLarge = sans.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium),
        labelMedium = sans.copy(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
        labelSmall = sans.copy(fontSize = 11.sp, lineHeight = 15.sp, letterSpacing = 0.4.sp),
    )
    MaterialTheme(
        colorScheme = colors, typography = type,
        shapes = Shapes(
            extraSmall = RoundedCornerShape(6.dp), small = RoundedCornerShape(10.dp),
            medium = RoundedCornerShape(12.dp), large = RoundedCornerShape(14.dp), extraLarge = RoundedCornerShape(20.dp),
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
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
}

@Composable
fun SmallTag(text: String) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = RoundedCornerShape(6.dp)) {
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

/** The one strong button of a screen: ink ground, paper text. */
@Composable
fun InkButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
              icon: ImageVector? = null, height: Dp = 52.dp) {
    val c = MaterialTheme.colorScheme
    Button(onClick = onClick, modifier = modifier.height(height), enabled = enabled, shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(containerColor = c.onBackground, contentColor = c.background,
            disabledContainerColor = c.surfaceContainerHighest, disabledContentColor = c.outline),
        elevation = null, contentPadding = PaddingValues(horizontal = 18.dp)) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, fontSize = 15.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.2.sp, maxLines = 1)
    }
}

/** A quieter button beside it: thin line, ink text. */
@Composable
fun LineButton(text: String?, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
               icon: ImageVector? = null, height: Dp = 52.dp) {
    val c = MaterialTheme.colorScheme
    OutlinedButton(onClick = onClick, modifier = modifier.height(height), enabled = enabled, shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, if (enabled) c.outline else c.outlineVariant),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = c.onSurface, containerColor = c.surface),
        contentPadding = PaddingValues(horizontal = if (text == null) 0.dp else 16.dp)) {
        if (icon != null) Icon(icon, contentDescription = text, modifier = Modifier.size(19.dp))
        if (icon != null && text != null) Spacer(Modifier.width(8.dp))
        if (text != null) Text(text, fontSize = 15.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

/** A choice among several: chosen ones filled with ink, the others a thin outline. */
@Composable
fun Pill(text: String, selected: Boolean, onClick: () -> Unit, enabled: Boolean = true) {
    val c = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(50)
    Box(Modifier.alpha(if (enabled) 1f else 0.45f).height(36.dp).clip(shape)
        .background(if (selected) c.onBackground else c.surface)
        .border(1.dp, if (selected) c.onBackground else c.outlineVariant, shape)
        .clickable(enabled = enabled, onClick = onClick)
        .padding(horizontal = 15.dp), contentAlignment = Alignment.Center) {
        Text(text, fontSize = 14.sp, fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
            color = if (selected) c.background else c.onSurface, maxLines = 1)
    }
}

/** Two or three side-by-side choices in one frame (the reader: Sol or Astra). */
@Composable
fun Segmented(options: List<Pair<String, String>>, selected: String, enabled: Boolean, onPick: (String) -> Unit) {
    val c = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().alpha(if (enabled) 1f else 0.45f)
        .border(1.dp, c.outlineVariant, RoundedCornerShape(10.dp))
        .background(c.surface, RoundedCornerShape(10.dp)).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for ((key, name) in options) {
            val on = key == selected
            Box(Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(8.dp))
                .background(if (on) c.onBackground else Color.Transparent)
                .clickable(enabled = enabled) { onPick(key) }, contentAlignment = Alignment.Center) {
                Text(name, fontSize = 15.sp, fontWeight = if (on) FontWeight.Medium else FontWeight.Normal,
                    color = if (on) c.background else c.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun InkCheckbox(checked: Boolean, onCheckedChange: ((Boolean) -> Unit)?, enabled: Boolean = true) {
    val c = MaterialTheme.colorScheme
    Checkbox(checked, onCheckedChange, enabled = enabled, colors = CheckboxDefaults.colors(
        checkedColor = c.onBackground, uncheckedColor = c.outline, checkmarkColor = c.background))
}

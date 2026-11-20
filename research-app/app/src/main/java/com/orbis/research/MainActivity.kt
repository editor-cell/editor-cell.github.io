package com.orbis.research

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= 33) {
            registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
                .launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        setContent { OrbisTheme { App() } }
    }
}

private class Tab(val title: String, val icon: ImageVector)

/** Material's outlined folder, drawn here because the core icon set has none. */
private val FolderIcon: ImageVector = ImageVector.Builder("Folder", 24.dp, 24.dp, 24f, 24f).addPath(
    androidx.compose.ui.graphics.vector.PathParser().parsePathString(
        "M9.17,6l2,2H20v10L4,18V6h5.17M10,4H4c-1.1,0 -1.99,0.9 -1.99,2L2,18c0,1.1 0.9,2 2,2h16c1.1,0 2,-0.9 2,-2V8c0,-1.1 -0.9,-2 -2,-2h-8l-2,-2z",
    ).toNodes(),
    fill = androidx.compose.ui.graphics.SolidColor(androidx.compose.ui.graphics.Color.Black),
).build()
// Topla and Model left the app (owner, 20 Nov 2026): the evrak is what matters, and the kept
// evraks have their own tab, with a search inside them.
private val tabs = listOf(
    Tab("Ara", Icons.Filled.Search), Tab("Kaynaklar", Icons.Filled.List), Tab("Evraklar", FolderIcon),
)

@Composable
private fun BrandHeader() {
    Surface(color = MaterialTheme.colorScheme.background) {
        Row(Modifier.statusBarsPadding().fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 18.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text("ORBIS", fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold,
                fontSize = 21.sp, letterSpacing = 5.5.sp, lineHeight = 26.sp)
            Spacer(Modifier.weight(1f))
            Text("ARAŞTIRMA", color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp, fontWeight = FontWeight.Medium, letterSpacing = 1.sp)
        }
    }
}

@Composable
private fun App() {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { BrandHeader() },
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.surface) {
                Column {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
                        tabs.forEachIndexed { i, t ->
                            NavigationBarItem(
                                selected = tab == i, onClick = { tab = i },
                                icon = { Icon(t.icon, contentDescription = null) },
                                label = { Text(t.title, fontWeight = if (tab == i) FontWeight.SemiBold else FontWeight.Normal) },
                                colors = NavigationBarItemDefaults.colors(
                                    indicatorColor = MaterialTheme.colorScheme.surface,
                                    selectedIconColor = MaterialTheme.colorScheme.primary,
                                    selectedTextColor = MaterialTheme.colorScheme.primary,
                                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                ),
                            )
                        }
                    }
                }
            }
        },
    ) { pad ->
        Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.TopCenter) {
            Column(Modifier.fillMaxHeight().widthIn(max = 760.dp).fillMaxWidth()) {
                UpdateBanner()
                Box(Modifier.fillMaxSize()) {
                    when (tab) {
                        0 -> SearchScreen(goTo = { tab = it })
                        1 -> SourcesScreen()
                        else -> EvraklarScreen()
                    }
                }
            }
        }
    }
}

package org.javafreedom.kbeatz.tagger.codec.flac

import java.io.File
import org.junit.jupiter.api.Tag
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Generates the committed FLAC fixture files under src/test/resources/fixtures/.
 *
 * Re-run manually when the codec changes and the fixture bytes need to be refreshed:
 *   ./gradlew :kbeatz-tagger:test --tests "*.GenerateFixturesTest"
 *
 * The test also acts as a sanity check: it regenerates the fixtures in a temp directory
 * and verifies the resulting files are non-empty and start with the fLaC marker.
 *
 * Tagged "generators" so it is excluded from the default test run (which reads committed
 * fixtures) and only runs when explicitly requested.
 */
@Tag("generators")
class GenerateFixturesTest {

    @Test
    fun `generate fixture files into test resources directory`() {
        // Determine the canonical fixture directory in the source tree.
        val moduleDir = findModuleDir()
        val fixturesDir = File(moduleDir, "src/test/resources/fixtures")

        FixtureGenerator.generate(fixturesDir)

        val expected = listOf("with-tags.flac", "with-cover.flac", "corrupted.flac")
        expected.forEach { name ->
            val file = File(fixturesDir, name)
            assertTrue(file.exists(), "Expected fixture $name to exist at ${file.absolutePath}")
            assertTrue(file.length() > 0, "Fixture $name must not be empty")
        }

        // Verify that with-tags.flac and with-cover.flac start with the fLaC marker.
        listOf("with-tags.flac", "with-cover.flac").forEach { name ->
            val bytes = File(fixturesDir, name).readBytes()
            assertTrue(bytes.size >= 4, "Fixture $name too short to contain fLaC marker")
            val marker = String(bytes.sliceArray(0..3))
            assertTrue(marker == "fLaC", "Fixture $name does not start with fLaC marker (got: $marker)")
        }
    }

    /**
     * Locates the kbeatz-tagger module root by walking up from the test class-file location
     * until a directory that contains build.gradle.kts for that module is found.
     */
    private fun findModuleDir(): File {
        // Walk up from the working directory until we find the kbeatz-tagger module.
        var dir = File(System.getProperty("user.dir")).canonicalFile
        repeat(10) {
            val candidate = File(dir, "kbeatz-tagger")
            if (candidate.isDirectory && File(candidate, "build.gradle.kts").exists()) {
                return candidate
            }
            if (File(dir, "build.gradle.kts").exists() && dir.name == "kbeatz-tagger") {
                return dir
            }
            dir = dir.parentFile ?: return dir
        }
        // Fallback: look for kbeatz-tagger in common locations relative to working dir.
        val fallback = File(System.getProperty("user.dir"))
        return if (fallback.name == "kbeatz-tagger") fallback
        else File(fallback, "kbeatz-tagger").takeIf { it.isDirectory } ?: fallback
    }
}

package org.javafreedom.kbeatz.cli.util

import kotlinx.io.files.FileMetadata
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem

internal fun walkDirectories(root: Path, maxDepth: Int): Sequence<Path> = sequence {
    if (maxDepth <= 0) return@sequence
    val children = runCatching { SystemFileSystem.list(root) }.getOrElse { emptyList() }
    for (child in children) {
        val meta: FileMetadata = SystemFileSystem.metadataOrNull(child) ?: continue
        if (meta.isDirectory) {
            yield(child)
            yieldAll(walkDirectories(child, maxDepth - 1))
        }
    }
}

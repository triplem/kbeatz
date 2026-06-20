package org.javafreedom.kbeatz.catalog.domain.model

/**
 * The planned on-disk location for an album, produced by the [DirectoryLayoutPlanner].
 *
 * This is a planning artifact only: no filesystem move is performed by producing it.
 *
 * @property relativePath The sanitised, `/`-separated path relative to the library root.
 * @property absolutePath The normalised absolute path (library root joined with [relativePath]).
 */
data class DirectoryLayoutResult(
    val relativePath: String,
    val absolutePath: String,
)

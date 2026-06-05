package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.uuid.Uuid

data class Album(
    val id: Uuid,
    val albumArtist: String,
    val album: String,
    val date: String?,
    val genre: String?,
    val label: String?,
    val catalogNumber: String?,
    val composer: String?,
    val conductor: String?,
    val ensemble: String?,
    val discogsId: String?,
    val directoryPath: String,
    val hasCoverArt: Boolean,
)

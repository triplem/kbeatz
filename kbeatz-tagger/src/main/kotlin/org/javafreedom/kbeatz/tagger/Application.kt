package org.javafreedom.kbeatz.tagger

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.subcommands
import org.javafreedom.kbeatz.tagger.command.MigrateIdFilesCommand
import org.javafreedom.kbeatz.tagger.command.TagAlbumsCommand

class KbeatzTaggerCli : CliktCommand(
    name = "kbeatz-tagger",
    help = "kbeatz CLI — tag FLAC albums from Discogs metadata and migrate id files.",
) {
    override fun run() = Unit
}

fun main(args: Array<String>) {
    KbeatzTaggerCli()
        .subcommands(TagAlbumsCommand(), MigrateIdFilesCommand())
        .main(args)
}
